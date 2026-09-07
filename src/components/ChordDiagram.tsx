import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// ChordDiagram — the chart family's relational shape, the one none of the others
// can draw. The bar, ring, donut, gauge, and waffle each measure things in
// isolation: how much, how full, what share. This measures the thing *between*
// things — how a set of groups connect to one another — the one question a
// column of numbers cannot answer. Groups sit as arcs around a circle, sized by
// how connected each is; a ribbon flows between every pair that shares a link,
// its two ends as wide as the tie is strong. Read the rim for who matters, read
// the ribbons for who they matter to.
//
// Same "made, not assembled" rules as the rest of the site's data-viz: no
// charting library, just SVG arcs and quadratic-Bézier ribbons whose geometry is
// laid out here from a symmetric matrix — the same chord layout d3 computes, done
// by hand. And the same colour discipline: one lime, stepped by rank so the most
// connected group reads brightest, because position on the rim carries identity
// and the legend names it — colour never has to. Ribbons borrow their end's tone
// at a low alpha, so the weave reads as one material, not a rainbow of cables.
//
// Interactive like its siblings: the legend rows are real buttons, and hovering
// or focusing one lifts that group's arc and lights every ribbon it touches while
// the rest fall back, and the centre readout names the group and its share of all
// the links. Under reduced motion every arc is simply present, drawn to full, the
// ribbons rest at their weave, and nothing sweeps in.

export interface ChordNode {
  /** Names the group — shown in the legend and read by assistive tech. */
  label: string
  /** Override the stepped-lime tone for this group (a design token, rare). */
  color?: string
}

const EASE = [0.16, 1, 0.3, 1] as const
const TAU = Math.PI * 2

// Geometry in a 100 x 100 viewBox.
const CX = 50
const CY = 50
const R = 43 // arc centre-line radius
const BAND = 4.2 // arc thickness
const R_RIBBON = R - BAND / 2 - 0.4 // where ribbons attach (inner edge of the band)
const PAD = 0.05 // radians of gap between groups
const LIFT = 1.8 // how far an active group's arc lifts outward

// The site's single lime, stepped down by rank so the most-connected group reads
// brightest and each quieter one a touch dimmer — identity by rim position, not
// by hue. Groups past the ramp reuse its faintest step.
const LIME_STEPS = [
  'rgba(220,248,124,1)',
  'rgba(220,248,124,0.82)',
  'rgba(220,248,124,0.66)',
  'rgba(220,248,124,0.52)',
  'rgba(220,248,124,0.42)',
  'rgba(220,248,124,0.34)',
]

/** Point on a circle of radius r at angle a, measured clockwise from twelve. */
function polar(r: number, a: number): { x: number; y: number } {
  const t = -Math.PI / 2 + a
  return { x: CX + r * Math.cos(t), y: CY + r * Math.sin(t) }
}

/** Large-arc flag for an arc that sweeps from a0 to a1 (a1 >= a0). */
function laf(a0: number, a1: number): 0 | 1 {
  return a1 - a0 > Math.PI ? 1 : 0
}

/** A stroked band arc from a0 to a1 at radius r, swept clockwise. */
function arcPath(r: number, a0: number, a1: number): string {
  const p0 = polar(r, a0)
  const p1 = polar(r, a1)
  return `M ${p0.x.toFixed(3)} ${p0.y.toFixed(3)} A ${r} ${r} 0 ${laf(a0, a1)} 1 ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`
}

/** A filled ribbon: source sub-arc [s0,s1] tied to target sub-arc [t0,t1],
 *  each pair of ends pulled through the centre with a quadratic curve. */
function ribbonPath(s0: number, s1: number, t0: number, t1: number): string {
  const a0 = polar(R_RIBBON, s0)
  const a1 = polar(R_RIBBON, s1)
  const b0 = polar(R_RIBBON, t0)
  const b1 = polar(R_RIBBON, t1)
  return [
    `M ${a0.x.toFixed(3)} ${a0.y.toFixed(3)}`,
    `A ${R_RIBBON} ${R_RIBBON} 0 ${laf(s0, s1)} 1 ${a1.x.toFixed(3)} ${a1.y.toFixed(3)}`,
    `Q ${CX} ${CY} ${b0.x.toFixed(3)} ${b0.y.toFixed(3)}`,
    `A ${R_RIBBON} ${R_RIBBON} 0 ${laf(t0, t1)} 1 ${b1.x.toFixed(3)} ${b1.y.toFixed(3)}`,
    `Q ${CX} ${CY} ${a0.x.toFixed(3)} ${a0.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

interface Group {
  index: number
  label: string
  color: string
  total: number
  start: number
  end: number
  mid: number
  /** Fraction of all link weight this group carries. */
  share: number
}

interface Chord {
  i: number
  j: number
  source: [number, number]
  target: [number, number]
  weight: number
}

export function ChordDiagram({
  nodes,
  matrix,
  size = 300,
  className = '',
  ariaLabel,
  showLegend = true,
}: {
  nodes: ChordNode[]
  /** Symmetric weight matrix; matrix[i][j] is the tie between groups i and j. The
   *  diagonal is ignored. Anything asymmetric is read as its larger half. */
  matrix: number[][]
  /** Rendered width in pixels; the figure stays square. */
  size?: number
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
  showLegend?: boolean
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { groups, chords, grand } = useMemo(() => {
    const n = nodes.length
    // Symmetrise defensively so a tie is one number however it was entered.
    const w = (i: number, j: number): number =>
      i === j ? 0 : Math.max(matrix[i]?.[j] ?? 0, matrix[j]?.[i] ?? 0)

    const totals = nodes.map((_, i) => {
      let s = 0
      for (let j = 0; j < n; j++) s += w(i, j)
      return s
    })
    const grandTotal = totals.reduce((a, b) => a + b, 0) || 1
    const available = TAU - n * PAD

    // Rank by connectedness so the busiest rim segment gets the brightest step.
    const order = [...totals.keys()].sort((a, b) => totals[b] - totals[a])
    const rank = new Map<number, number>()
    order.forEach((idx, r) => rank.set(idx, r))

    const built: Group[] = []
    // Per-group running cursor for laying out each tie's sub-arc within the arc.
    const subStart: number[] = new Array(n).fill(0)
    let cursor = 0
    for (let i = 0; i < n; i++) {
      const arcAngle = (totals[i] / grandTotal) * available
      built.push({
        index: i,
        label: nodes[i].label,
        color: nodes[i].color ?? LIME_STEPS[rank.get(i) ?? 0] ?? LIME_STEPS[LIME_STEPS.length - 1],
        total: totals[i],
        start: cursor,
        end: cursor + arcAngle,
        mid: cursor + arcAngle / 2,
        share: totals[i] / grandTotal,
      })
      subStart[i] = cursor
      cursor += arcAngle + PAD
    }

    // Each unordered pair becomes one ribbon; its two ends are the sub-arcs it
    // claims on each group's rim, sized by the same weight.
    const subCursor = [...subStart]
    // Walk ties in a stable order so the sub-arcs pack the same way every render.
    const sub: Record<string, [number, number]> = {}
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const weight = w(i, j)
        if (weight <= 0) continue
        const span = (weight / grandTotal) * available
        sub[`${i}-${j}`] = [subCursor[i], subCursor[i] + span]
        subCursor[i] += span
      }
    }

    const built_chords: Chord[] = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const weight = w(i, j)
        if (weight <= 0) continue
        const s = sub[`${i}-${j}`]
        const t = sub[`${j}-${i}`]
        if (!s || !t) continue
        built_chords.push({ i, j, source: s, target: t, weight })
      }
    }

    return { groups: built, chords: built_chords, grand: grandTotal }
  }, [nodes, matrix])

  const focus = active != null ? groups[active] : null
  const summary =
    ariaLabel ??
    `Chord diagram of ${groups.length} connected groups. ${groups
      .map((g) => {
        const ties = chords
          .filter((c) => c.i === g.index || c.j === g.index)
          .map((c) => nodes[c.i === g.index ? c.j : c.i].label)
        return `${g.label}, ${Math.round(g.share * 100)} percent of the links${
          ties.length ? `, tied to ${ties.join(', ')}` : ''
        }`
      })
      .join('; ')}.`

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      style={{ width: 'min(84vw, ' + size + 'px)' }}
    >
      <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={summary}>
          {/* Ribbons first, so the rim arcs read on top of the weave. */}
          <g>
            {chords.map((c, k) => {
              const touches = active == null || active === c.i || active === c.j
              const tone = groups[c.i].color
              return (
                <motion.path
                  key={`r-${k}`}
                  d={ribbonPath(c.source[0], c.source[1], c.target[0], c.target[1])}
                  fill={tone}
                  stroke={tone}
                  strokeWidth={0.2}
                  style={{ opacity: touches ? 0.28 : 0.05, transition: 'opacity 0.32s ease' }}
                  initial={reduce ? { opacity: touches ? 0.28 : 0.05 } : { opacity: 0 }}
                  whileInView={reduce ? undefined : { opacity: touches ? 0.28 : 0.05 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.55 + k * 0.04 }}
                />
              )
            })}
          </g>

          {/* Group arcs — the rim. Each draws itself in clockwise from its start. */}
          <g>
            {groups.map((g) => {
              const isActive = active === g.index
              const dim = active != null && !isActive
              const r = R + (isActive ? LIFT : 0)
              return (
                <motion.path
                  key={`a-${g.index}`}
                  d={arcPath(r, g.start, g.end)}
                  fill="none"
                  stroke={g.color}
                  strokeWidth={isActive ? BAND + 1 : BAND}
                  strokeLinecap="butt"
                  pathLength={1}
                  onMouseEnter={() => setActive(g.index)}
                  onMouseLeave={() => setActive(null)}
                  style={{
                    opacity: dim ? 0.32 : 1,
                    cursor: 'pointer',
                    transition: 'opacity 0.3s ease, stroke-width 0.3s ease, d 0.3s ease',
                  }}
                  initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                  whileInView={reduce ? undefined : { pathLength: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.1 + g.index * 0.08 }}
                />
              )
            })}
          </g>
        </svg>

        {/* Centre readout — the active group's share, or a quiet title at rest.
            aria-hidden: the svg summary already carries every group for AT. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          {focus ? (
            <motion.div
              key={`${uid}-${active}`}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex flex-col items-center"
            >
              <span className="font-display text-3xl font-bold leading-none tracking-tight text-[#DCF87C] sm:text-4xl">
                {Math.round(focus.share * 100)}
                <span className="text-lg text-white/40">%</span>
              </span>
              <span className="mt-1 max-w-[7.5rem] text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/45">
                {focus.label}
              </span>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="font-display text-2xl font-semibold leading-none tracking-tight text-white/80 sm:text-3xl">
                {groups.length}
              </span>
              <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/35">
                Groups
              </span>
            </div>
          )}
        </div>
      </div>

      {showLegend && (
        <ul className="mt-6 flex w-full flex-col gap-1.5">
          {groups.map((g) => {
            const degree = chords.filter((c) => c.i === g.index || c.j === g.index).length
            return (
              <li key={g.index}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(g.index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(g.index)}
                  onBlur={() => setActive(null)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                  aria-label={`${g.label}: ${Math.round(g.share * 100)} percent of links, ${degree} ${
                    degree === 1 ? 'tie' : 'ties'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: g.color }}
                    aria-hidden
                  />
                  <span className="flex-1 text-sm text-white/70">{g.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-white/85">
                    {degree} {degree === 1 ? 'tie' : 'ties'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Grand total kept honest and off-screen for anyone counting. */}
      <span className="sr-only">{`Total link weight ${grand}.`}</span>
    </div>
  )
}
