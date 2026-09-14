import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Sankey — the chart family's flow shape, the one none of the others can draw.
// The bar, donut, gauge, and waffle each measure a quantity in isolation; the
// chord measures what ties two things together, but without direction. This is
// the only one that measures *movement*: how a quantity splits, travels, and
// re-gathers as it passes from one stage to the next. Nodes sit in columns by
// how far along the flow they are; a band leaves each node as wide as the amount
// it carries, curves across the gap, and lands on the next node exactly that
// wide — so width is conserved end to end, the way real throughput is. Read the
// columns for the stages, read the bands for where the weight actually goes.
//
// Same "made, not assembled" rules as the rest of the site's data-viz: no
// charting library. The layering (which column each node lands in), the vertical
// packing, and the ribbon geometry are all computed here — the layout d3-sankey
// would hand you, laid out by hand from a list of links. And the same colour
// discipline: one lime, stepped by rank so the node carrying the most reads
// brightest, because column and label already carry identity and the legend
// names each one — colour never has to. Every band borrows its source node's
// tone at a low alpha, so a flow reads as one material rather than a tangle of
// cables.
//
// Interactive like its siblings: nodes and legend rows are real buttons, and
// hovering or focusing one lifts that node and lights every band that flows in
// or out of it while the rest fall back. Under reduced motion the bands rest at
// full width, the nodes are simply present, and nothing sweeps in.

export interface SankeyNode {
  /** Stable id referenced by links. */
  id: string
  /** Shown in the legend and read by assistive tech. */
  label: string
  /** Override the stepped-lime tone for this node (a design token, rare). */
  color?: string
}

export interface SankeyLink {
  /** Node id the flow leaves. */
  source: string
  /** Node id the flow arrives at. */
  target: string
  /** How much travels along this link — sets the band's width. */
  value: number
}

const EASE = [0.16, 1, 0.3, 1] as const

// Geometry in a 100-wide viewBox; the height is computed to fit the busiest
// column, so a tall flow gets more room without squashing the bands.
const VW = 100
const NODE_W = 2.6 // node bar width, in viewBox units
const NODE_GAP = 3.4 // vertical gap between stacked nodes in a column
const VPAD = 3 // top/bottom breathing room
const HPAD = 1.6 // left/right breathing room for the outer node columns
const LIFT = 0.9 // how far an active node lifts out to the side

// The site's single lime, stepped down by rank so the node carrying the most
// flow reads brightest and each quieter one a touch dimmer — identity by column
// and label, not by hue. Nodes past the ramp reuse its faintest step.
const LIME_STEPS = [
  'rgba(220,248,124,1)',
  'rgba(220,248,124,0.82)',
  'rgba(220,248,124,0.66)',
  'rgba(220,248,124,0.52)',
  'rgba(220,248,124,0.42)',
  'rgba(220,248,124,0.34)',
]

interface Band {
  key: string
  sourceIndex: number
  targetIndex: number
  value: number
  tone: string
  /** The filled ribbon path from the source's right edge to the target's left. */
  d: string
}

interface Placed {
  index: number
  id: string
  label: string
  color: string
  /** max(inflow, outflow) — the throughput the node's bar height represents. */
  value: number
  col: number
  x: number
  y0: number
  y1: number
  cy: number
}

/** A conserved-width Sankey ribbon: a band leaving [sy0,sy1] on the source's
 *  right edge and landing on [ty0,ty1] on the target's left edge, its two long
 *  sides drawn as horizontal cubic curves that meet at the vertical midpoint. */
function ribbon(sx: number, sy0: number, sy1: number, tx: number, ty0: number, ty1: number): string {
  const mx = (sx + tx) / 2
  return [
    `M ${sx.toFixed(2)} ${sy0.toFixed(2)}`,
    `C ${mx.toFixed(2)} ${sy0.toFixed(2)} ${mx.toFixed(2)} ${ty0.toFixed(2)} ${tx.toFixed(2)} ${ty0.toFixed(2)}`,
    `L ${tx.toFixed(2)} ${ty1.toFixed(2)}`,
    `C ${mx.toFixed(2)} ${ty1.toFixed(2)} ${mx.toFixed(2)} ${sy1.toFixed(2)} ${sx.toFixed(2)} ${sy1.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export function Sankey({
  nodes,
  links,
  size = 460,
  className = '',
  ariaLabel,
  showLegend = true,
  unit = 'units',
}: {
  nodes: SankeyNode[]
  links: SankeyLink[]
  /** Rendered max width in pixels; the height follows the data. */
  size?: number
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
  showLegend?: boolean
  /** What one unit of flow is, for the readouts (e.g. "hours", "components"). */
  unit?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { placed, bands, height, grand } = useMemo(() => {
    const n = nodes.length
    const byId = new Map(nodes.map((node, i) => [node.id, i]))
    // Keep only links whose both ends resolve to a real node.
    const edges = links
      .map((l) => ({ s: byId.get(l.source) ?? -1, t: byId.get(l.target) ?? -1, value: Math.max(0, l.value) }))
      .filter((e) => e.s >= 0 && e.t >= 0 && e.s !== e.t && e.value > 0)

    // Column (depth) of each node: 0 for a pure source, else one past its
    // deepest feeder. Relaxed n times, which converges for any acyclic flow.
    const col = new Array<number>(n).fill(0)
    for (let pass = 0; pass < n; pass++) {
      for (const e of edges) {
        if (col[e.t] < col[e.s] + 1) col[e.t] = col[e.s] + 1
      }
    }
    const maxCol = col.reduce((a, b) => Math.max(a, b), 0)

    // Throughput per node = max(sum in, sum out) — a node conserves flow, so its
    // bar is as tall as the busier of its two sides.
    const inSum = new Array<number>(n).fill(0)
    const outSum = new Array<number>(n).fill(0)
    for (const e of edges) {
      outSum[e.s] += e.value
      inSum[e.t] += e.value
    }
    const value = nodes.map((_, i) => Math.max(inSum[i], outSum[i], 0))

    // Rank by throughput so the busiest node gets the brightest lime step.
    const order = [...value.keys()].sort((a, b) => value[b] - value[a])
    const rank = new Map<number, number>()
    order.forEach((idx, r) => rank.set(idx, r))

    // Which nodes sit in each column, in input order (stable layout).
    const columns: number[][] = Array.from({ length: maxCol + 1 }, () => [])
    for (let i = 0; i < n; i++) columns[col[i]].push(i)

    // One value scale, shared across every column so bars compare stage to
    // stage. Fix it from the busiest column: its bars should sum to ~46 units of
    // the viewBox, and the overall height then grows to fit whichever column
    // needs the most room once its inter-node gaps are added.
    const colValue = columns.map((c) => c.reduce((a, i) => a + value[i], 0))
    const maxColValue = colValue.reduce((a, b) => Math.max(a, b), 0) || 1
    const TARGET = 46
    const scale = TARGET / maxColValue
    let bestNeed = 0
    // Height that fits every column at that scale, plus its gaps and padding.
    for (let c = 0; c <= maxCol; c++) {
      const need = colValue[c] * scale + Math.max(0, columns[c].length - 1) * NODE_GAP
      if (need > bestNeed) bestNeed = need
    }
    const H = Math.max(38, bestNeed + VPAD * 2)
    const usableH = H - VPAD * 2

    // Column x positions across the viewBox, node bars inset by HPAD at the ends.
    const innerW = VW - HPAD * 2 - NODE_W
    const colX = (c: number) => HPAD + (maxCol === 0 ? innerW / 2 : (c / maxCol) * innerW)

    // Place each node: stack its column, centred vertically.
    const placedNodes: Placed[] = new Array(n)
    for (let c = 0; c <= maxCol; c++) {
      const ids = columns[c]
      const colH = colValue[c] * scale + Math.max(0, ids.length - 1) * NODE_GAP
      let cursor = VPAD + (usableH - colH) / 2
      for (const i of ids) {
        const h = value[i] * scale
        const x = colX(c)
        placedNodes[i] = {
          index: i,
          id: nodes[i].id,
          label: nodes[i].label,
          color: nodes[i].color ?? LIME_STEPS[rank.get(i) ?? 0] ?? LIME_STEPS[LIME_STEPS.length - 1],
          value: value[i],
          col: c,
          x,
          y0: cursor,
          y1: cursor + h,
          cy: cursor + h / 2,
        }
        cursor += h + NODE_GAP
      }
    }

    // Order each node's out-links by the target's vertical centre (and in-links
    // by the source's), so bands fan out cleanly instead of crossing needlessly.
    const outCursor = placedNodes.map((p) => p.y0)
    const inCursor = placedNodes.map((p) => p.y0)
    const sortedOut = [...edges].sort(
      (a, b) => a.s - b.s || placedNodes[a.t].cy - placedNodes[b.t].cy,
    )
    const inByNode: Record<number, typeof edges> = {}
    for (const e of edges) (inByNode[e.t] ??= []).push(e)
    for (const t of Object.keys(inByNode)) {
      inByNode[+t].sort((a, b) => placedNodes[a.s].cy - placedNodes[b.s].cy)
    }
    // Assign each link its source sub-band (walking out-links top to bottom per
    // source) and its target sub-band (walking in-links top to bottom per target).
    const srcBand = new Map<string, [number, number]>()
    for (const e of sortedOut) {
      const key = `${e.s}>${e.t}`
      const h = e.value * scale
      srcBand.set(key, [outCursor[e.s], outCursor[e.s] + h])
      outCursor[e.s] += h
    }
    const tgtBand = new Map<string, [number, number]>()
    for (const t of Object.keys(inByNode)) {
      for (const e of inByNode[+t]) {
        const key = `${e.s}>${e.t}`
        const h = e.value * scale
        tgtBand.set(key, [inCursor[e.t], inCursor[e.t] + h])
        inCursor[e.t] += h
      }
    }

    const builtBands: Band[] = sortedOut.map((e) => {
      const key = `${e.s}>${e.t}`
      const [sy0, sy1] = srcBand.get(key) ?? [0, 0]
      const [ty0, ty1] = tgtBand.get(key) ?? [0, 0]
      const s = placedNodes[e.s]
      const t = placedNodes[e.t]
      return {
        key,
        sourceIndex: e.s,
        targetIndex: e.t,
        value: e.value,
        tone: s.color,
        d: ribbon(s.x + NODE_W, sy0, sy1, t.x, ty0, ty1),
      }
    })

    const grandTotal = edges.reduce((a, e) => a + e.value, 0) || 1
    return { placed: placedNodes, bands: builtBands, height: H, grand: grandTotal }
  }, [nodes, links])

  const focus = active != null ? placed[active] : null
  const summary =
    ariaLabel ??
    `Flow diagram of ${placed.length} stages in ${
      placed.reduce((a, p) => Math.max(a, p.col), 0) + 1
    } columns. ${placed
      .map((p) => {
        const outs = bands
          .filter((b) => b.sourceIndex === p.index)
          .map((b) => `${placed[b.targetIndex].label} (${b.value})`)
        return `${p.label} carries ${p.value} ${unit}${outs.length ? `, flowing to ${outs.join(', ')}` : ''}`
      })
      .join('; ')}.`

  return (
    <div className={`flex w-full flex-col items-center ${className}`} style={{ maxWidth: size }}>
      <div className="relative w-full" style={{ aspectRatio: `${VW} / ${height}` }}>
        <svg viewBox={`0 0 ${VW} ${height}`} className="h-full w-full" role="img" aria-label={summary}>
          {/* Bands first, so the node bars read on top of the weave. */}
          <g>
            {bands.map((b, k) => {
              const touches = active == null || active === b.sourceIndex || active === b.targetIndex
              return (
                <motion.path
                  key={b.key}
                  d={b.d}
                  fill={b.tone}
                  stroke={b.tone}
                  strokeWidth={0.15}
                  style={{ opacity: touches ? 0.3 : 0.06, transition: 'opacity 0.32s ease' }}
                  initial={reduce ? { opacity: touches ? 0.3 : 0.06 } : { opacity: 0 }}
                  whileInView={reduce ? undefined : { opacity: touches ? 0.3 : 0.06 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.45 + k * 0.05 }}
                />
              )
            })}
          </g>

          {/* Node bars — the stages. Each grows from its centre on scroll. */}
          <g>
            {placed.map((p) => {
              const isActive = active === p.index
              const dim = active != null && !isActive
              const dx = isActive ? (p.col === 0 ? -LIFT : LIFT) : 0
              return (
                <motion.rect
                  key={p.id}
                  x={p.x + dx}
                  y={p.y0}
                  width={NODE_W}
                  height={Math.max(0.4, p.y1 - p.y0)}
                  rx={0.7}
                  fill={p.color}
                  onMouseEnter={() => setActive(p.index)}
                  onMouseLeave={() => setActive(null)}
                  style={{
                    opacity: dim ? 0.34 : 1,
                    cursor: 'pointer',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transition: 'opacity 0.3s ease, x 0.3s ease',
                  }}
                  initial={reduce ? { scaleY: 1 } : { scaleY: 0 }}
                  whileInView={reduce ? undefined : { scaleY: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, ease: EASE, delay: 0.1 + p.col * 0.09 }}
                />
              )
            })}
          </g>
        </svg>
      </div>

      {showLegend && (
        <ul className="mt-6 grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2">
          {placed.map((p) => {
            const degree = bands.filter((b) => b.sourceIndex === p.index || b.targetIndex === p.index).length
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(p.index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(p.index)}
                  onBlur={() => setActive(null)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                  aria-label={`${p.label}: ${p.value} ${unit}, ${degree} ${degree === 1 ? 'link' : 'links'}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  <span className="flex-1 truncate text-sm text-white/70">{p.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-white/85">{p.value}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Live readout: the focused node, or a quiet total at rest. aria-hidden —
          the svg summary already carries every stage for assistive tech. */}
      <p aria-hidden className="mt-4 h-5 text-center text-xs text-white/45">
        {focus ? (
          <motion.span
            key={`${uid}-${active}`}
            initial={reduce ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <span className="font-semibold text-white/80">{focus.label}</span> carries{' '}
            <span className="font-semibold text-[#DCF87C]">
              {focus.value} {unit}
            </span>
          </motion.span>
        ) : (
          <span>
            {grand} {unit} through {placed.length} stages
          </span>
        )}
      </p>
    </div>
  )
}
