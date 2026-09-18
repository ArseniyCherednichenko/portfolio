import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Sunburst — the chart family's radial-hierarchy shape, and the one none of the
// others is. The donut bends a single flat share into one ring; the treemap
// packs a nested whole into rectangles; circle-packing nests it as bubbles. A
// sunburst does the nesting *radially*: the root is the still centre, its parts
// fan out as the first ring of wedges, and each part's own parts fan out again
// on the ring beyond — angle carries value, distance from the centre carries
// depth. You read a whole tree in one glance, and you read it *around*, which is
// the reading the rectangular and bubble hierarchies cannot give.
//
// And it zooms. Click a wedge that has parts of its own and it becomes the new
// centre — its children re-fan to fill the whole circle, so a small outer branch
// opens into its own full sunburst. Click the centre (or a breadcrumb crumb) to
// climb back out. That drill-down is the interaction the flat charts have no room
// for: the figure is also a way to move through the data.
//
// Colour discipline matches the rest of the site's data-viz: one lime, stepped
// not by identity but by *depth* — the ring nearest the centre is the bright
// leaf, each ring out a step deeper into forest — so hue only ever encodes how
// far down the tree you are. A hovered or focused wedge lifts to full lime while
// the rest dim, and the readout names its share of the current centre. Wedges
// sweep open on scroll under normal motion; under reduced motion they are simply
// present, nothing growing.

export interface SunburstNode {
  /** Names the part — drawn on its wedge when it fits, and read by assistive tech. */
  label: string
  /** Leaf amount. Ignored when `children` is set (a parent's value is its sum). */
  value?: number
  /** Optional short unit for the readout, e.g. "files". */
  unit?: string
  children?: SunburstNode[]
}

// One laid-out wedge: a node placed at a depth and an angular span.
interface Wedge {
  node: LaidNode
  depth: number
  a0: number
  a1: number
}

// A node with its rolled-up total and a stable id path, computed once.
interface LaidNode {
  label: string
  unit?: string
  total: number
  id: string
  children: LaidNode[]
}

const EASE = [0.16, 1, 0.3, 1] as const

// One square field so a unit reads as a pixel and the ring sizes are predictable.
const SIZE = 320
const CX = SIZE / 2
const CY = SIZE / 2
const R0 = 54 // centre hole: carries the current focus label + total
const RING = 33 // thickness of each ring out from the hole
const RINGS = 3 // how many rings of descendants to draw beyond the centre
const PAD = 0.008 // hairline angular gap between neighbouring wedges (radians)
const TAU = Math.PI * 2
const START = -Math.PI / 2 // 12 o'clock

// The single lime, stepped by depth between a bright leaf (ring 1) and a deep
// forest (the outermost ring), so the ramp only ever encodes depth.
const LEAF = [220, 248, 124] as const
const FOREST = [30, 44, 20] as const

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function toneAt(t: number): { fill: string; ink: string } {
  const r = Math.round(lerp(LEAF[0], FOREST[0], t))
  const g = Math.round(lerp(LEAF[1], FOREST[1], t))
  const b = Math.round(lerp(LEAF[2], FOREST[2], t))
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return { fill: `rgb(${r}, ${g}, ${b})`, ink: lum > 150 ? 'rgba(12,15,8,0.92)' : 'rgba(255,255,255,0.9)' }
}

// Roll a raw tree up into LaidNodes carrying summed totals and stable id paths.
function layout(node: SunburstNode, id: string): LaidNode {
  const children = (node.children ?? []).map((c, i) => layout(c, `${id}.${i}`))
  const total = children.length
    ? children.reduce((s, c) => s + c.total, 0)
    : Math.max(node.value ?? 0, 0)
  return { label: node.label, unit: node.unit, total, id, children }
}

function polar(r: number, ang: number): [number, number] {
  return [CX + r * Math.cos(ang), CY + r * Math.sin(ang)]
}

// A ring-segment path from (r0,a0) to (r1,a1), swept clockwise.
function arcPath(r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0o, y0o] = polar(r1, a0)
  const [x1o, y1o] = polar(r1, a1)
  const [x1i, y1i] = polar(r0, a1)
  const [x0i, y0i] = polar(r0, a0)
  return [
    `M ${x0o} ${y0o}`,
    `A ${r1} ${r1} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${r0} ${r0} 0 ${large} 0 ${x0i} ${y0i}`,
    'Z',
  ].join(' ')
}

// Walk the focus subtree, placing each descendant (down to RINGS deep) into the
// angular span its value earns inside its parent. The focus itself is the hole.
function place(focus: LaidNode): Wedge[] {
  const out: Wedge[] = []
  const walk = (node: LaidNode, depth: number, a0: number, a1: number) => {
    if (depth > RINGS || node.total <= 0) return
    const span = a1 - a0
    let cursor = a0
    for (const child of node.children) {
      const frac = child.total / node.total
      const cA0 = cursor
      const cA1 = cursor + span * frac
      cursor = cA1
      // Inset each wedge by a hairline so neighbours read as separate parts.
      const pad = Math.min(PAD, (cA1 - cA0) / 2.5)
      out.push({ node: child, depth, a0: cA0 + pad, a1: cA1 - pad })
      if (child.children.length) walk(child, depth + 1, cA0, cA1)
    }
  }
  walk(focus, 1, START, START + TAU)
  return out
}

export function Sunburst({
  data,
  unit,
  className = '',
  ariaLabel,
}: {
  data: SunburstNode
  /** Fallback unit for the readout when a node carries none. */
  unit?: string
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()

  const root = useMemo(() => layout(data, 'r'), [data])

  // The zoom stack: root first, current focus last. Reset if the data changes.
  const [path, setPath] = useState<LaidNode[]>([root])
  // Guard against a stale path after a data swap.
  const safePath = path[0]?.id === root.id ? path : [root]
  const current = safePath[safePath.length - 1]

  const [hover, setHover] = useState<string | null>(null)

  const wedges = useMemo(() => place(current), [current])

  const zoomTo = (node: LaidNode) => {
    if (!node.children.length) return // leaves do not zoom
    const at = safePath.findIndex((n) => n.id === node.id)
    if (at >= 0) setPath(safePath.slice(0, at + 1))
    else setPath([...safePath, node])
  }
  const zoomToDepth = (i: number) => setPath(safePath.slice(0, i + 1))
  const zoomOut = () => {
    if (safePath.length > 1) setPath(safePath.slice(0, -1))
  }

  // The readout node: the hovered wedge, else the current focus itself.
  const hovered = hover ? wedges.find((w) => w.node.id === hover)?.node ?? null : null
  const readout = hovered ?? current
  const share = hovered && current.total > 0 ? Math.round((hovered.total / current.total) * 100) : 100

  const summary =
    ariaLabel ??
    `Sunburst of ${root.label}. ${root.children
      .map(
        (c) =>
          `${c.label}, ${c.total}${c.unit || unit ? ` ${c.unit ?? unit}` : ''} (${
            root.total > 0 ? Math.round((c.total / root.total) * 100) : 0
          } percent)`,
      )
      .join('; ')}.`

  return (
    <div className={`flex w-full flex-col ${className}`}>
      {/* Breadcrumb — the zoom path, each crumb a way back up. */}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
        {safePath.map((n, i) => {
          const last = i === safePath.length - 1
          return (
            <span key={n.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/25" aria-hidden>/</span>}
              <button
                type="button"
                onClick={() => zoomToDepth(i)}
                disabled={last}
                className={`rounded px-1.5 py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 ${
                  last ? 'font-semibold text-white/85' : 'text-white/45 hover:text-[#DCF87C]'
                }`}
              >
                {n.label}
              </button>
            </span>
          )
        })}
      </div>

      <div className="relative w-full" style={{ aspectRatio: '1 / 1', maxWidth: 380 }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label={summary}>
          {wedges.map((w, i) => {
            const rIn = R0 + (w.depth - 1) * RING
            const rOut = rIn + RING
            const on = hover === w.node.id
            const dim = hover != null && !on
            const t = RINGS <= 1 ? 0 : (w.depth - 1) / RINGS
            const tone = toneAt(t)
            const fill = on ? `rgb(${LEAF[0]}, ${LEAF[1]}, ${LEAF[2]})` : tone.fill
            const mid = (w.a0 + w.a1) / 2
            const rMid = (rIn + rOut) / 2
            const arc = rMid * (w.a1 - w.a0)
            const [lx, ly] = polar(rMid, mid)
            // Only label a wedge with room for it, and only on the first ring or
            // when hovered, so the outer rings stay clean.
            const showLabel = arc > 34 && rOut - rIn > 20 && (w.depth === 1 || on)
            const canZoom = w.node.children.length > 0
            return (
              <motion.g
                key={w.node.id}
                initial={reduce ? false : { opacity: 0 }}
                whileInView={reduce ? undefined : { opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.04 * w.depth + i * 0.012 }}
                style={{ opacity: dim ? 0.3 : 1, transition: 'opacity 0.25s ease', cursor: canZoom ? 'pointer' : 'default' }}
                onMouseEnter={() => setHover(w.node.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => zoomTo(w.node)}
              >
                <path
                  d={arcPath(rIn, rOut, w.a0, w.a1)}
                  fill={fill}
                  stroke={on ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,10,0.65)'}
                  strokeWidth={on ? 1.2 : 0.75}
                  style={{ transition: 'fill 0.2s ease' }}
                />
                {showLabel && (
                  <text
                    x={lx}
                    y={ly}
                    fill={on ? 'rgba(12,15,8,0.92)' : tone.ink}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-semibold"
                    style={{ fontSize: 9.5, letterSpacing: 0.2, pointerEvents: 'none' }}
                  >
                    {w.node.label.length > 12 ? `${w.node.label.slice(0, 11)}…` : w.node.label}
                  </text>
                )}
              </motion.g>
            )
          })}

          {/* Centre — the current focus, its total, and a way back out. */}
          <g
            style={{ cursor: safePath.length > 1 ? 'pointer' : 'default' }}
            onClick={zoomOut}
            role={safePath.length > 1 ? 'button' : undefined}
            aria-label={safePath.length > 1 ? `Zoom out to ${safePath[safePath.length - 2].label}` : undefined}
          >
            <circle cx={CX} cy={CY} r={R0 - 3} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={CX} y={CY - 6} textAnchor="middle" fill="rgba(255,255,255,0.85)" className="font-semibold" style={{ fontSize: 12 }}>
              {current.label.length > 13 ? `${current.label.slice(0, 12)}…` : current.label}
            </text>
            <text x={CX} y={CY + 12} textAnchor="middle" fill="#DCF87C" className="tabular-nums font-bold" style={{ fontSize: 15 }}>
              {current.total}
            </text>
            {safePath.length > 1 && (
              <text x={CX} y={CY + 27} textAnchor="middle" fill="rgba(255,255,255,0.35)" style={{ fontSize: 7.5, letterSpacing: 0.5 }}>
                CLICK TO ZOOM OUT
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* Readout — the hovered wedge's share of the current centre, or the centre
          itself. aria-hidden: the svg summary already carries the tree. */}
      <div aria-hidden className="mt-4 flex items-baseline gap-3">
        <motion.span
          key={`${uid}-${readout.id}`}
          initial={reduce ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="font-display text-2xl font-bold leading-none tracking-tight text-[#DCF87C]"
        >
          {share}
          <span className="text-base text-white/40">%</span>
        </motion.span>
        <span className="text-sm text-white/60">
          <span className="font-semibold text-white/80">{readout.label}</span>
          {' — '}
          {readout.total}
          {readout.unit || unit ? ` ${readout.unit ?? unit}` : ''}
          {hovered ? ` of ${current.total} in ${current.label}` : ' in total'}
        </span>
      </div>
    </div>
  )
}
