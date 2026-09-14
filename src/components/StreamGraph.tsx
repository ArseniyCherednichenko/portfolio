import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// StreamGraph — the chart family's twelfth shape, and the one none of the others
// draw: how several quantities move *together* over an ordered axis. The
// AreaChart shows a single series rising from a floor; the donut and waffle show
// a part-to-whole at one instant; the Sankey shows flow between stages. This is
// the theme-river — many series stacked around a free, centred baseline so the
// whole reads as one organic ribbon whose branches thicken and thin over time,
// and each band's *height* at any point is that series' value there.
//
// The signature of the form is the baseline. A normal stacked area pins the
// bottom to zero, which makes the upper layers ride the sum of everything below
// and wobble for reasons that aren't their own. Here the bottom offset is the
// wiggle-minimising baseline from the ThemeRiver work (Byron & Wattenberg): each
// column's stack is pushed down by a weighted sum of its layers so the river
// floats, centred, and every band's own shape stays legible. Built here from the
// values, no plotting library — one useMemo does the whole layout.
//
// Colour discipline of the family: one lime, stepped by each series' total so
// the busiest band reads brightest and colour never has to mean two things. The
// bands' top and bottom edges are Catmull-Rom splines, so the river flows rather
// than folds. The reveal is a single left-to-right wipe, the same move the
// AreaChart draws with — the whole river plots itself in one pass. Under reduced
// motion the wipe is full width from the first frame: the finished river, no draw.
//
// Quietly interactive: each series is a real legend button (so the whole chart
// is keyboard-reachable), and hovering or focusing one lifts its band to full
// tone while the rest dim, with a readout line naming that series and its total.
// The SVG carries a full role="img" summary walking every series, so the shape
// is legible to a screen reader without the picture.

export interface StreamSeries {
  /** Stable id. */
  id: string
  /** Human label shown in the legend and readout. */
  label: string
  /** One value per step along the x axis; read up to the shared step count. */
  values: number[]
  /** Optional explicit colour; defaults to the lime ramp stepped by total. */
  color?: string
}

// The drawing surface, in viewBox units. A wide field so a long run of steps
// still breathes, with padding for the axis labels below.
const VBW = 720
const VBH = 300
const PAD = { top: 18, right: 14, bottom: 34, left: 14 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

// The family's single-hue ramp, brightest first — shared with the Sankey and the
// rest of the chart set so the whole family reads as one material.
const LIME_STEPS = [
  'rgba(220,248,124,1)',
  'rgba(220,248,124,0.82)',
  'rgba(220,248,124,0.66)',
  'rgba(220,248,124,0.52)',
  'rgba(220,248,124,0.42)',
  'rgba(220,248,124,0.34)',
]

interface Band {
  id: string
  label: string
  color: string
  total: number
  /** Closed SVG path for the filled ribbon. */
  path: string
  /** Fractional x (0..1) of the band's fattest column — anchors nothing today,
   *  but keeps the shape self-describing. */
  peakFx: number
}

/**
 * The "C ..." commands of a Catmull-Rom spline through the given points, assuming
 * the current pen position is already at pts[0]. Emitted as cubic beziers so the
 * river edge is smooth without a library. Straight segments would fold the band
 * into a polygon; the spline lets it flow.
 */
function curveThrough(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

export function StreamGraph({
  series,
  labels,
  unit,
  className = '',
  ariaLabel,
  showLegend = true,
}: {
  series: StreamSeries[]
  /** X-axis tick labels; the step count is min(labels.length, each series' length). */
  labels: string[]
  /** Optional short noun shown after a total, e.g. "components". */
  unit?: string
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
  showLegend?: boolean
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<string | null>(null)

  const { bands, ticks, grandTotal } = useMemo(() => {
    const n = series.length
    // Shared step count — the shortest series (and the labels) decide it, so no
    // band ever reads past its data.
    const steps = series.reduce(
      (m, s) => Math.min(m, s.values.length),
      labels.length || Infinity,
    )
    if (n === 0 || !Number.isFinite(steps) || steps < 2) {
      return { bands: [] as Band[], ticks: [] as { x: number; label: string }[], grandTotal: 0 }
    }

    const denom = steps - 1
    const cols = Array.from({ length: steps }, (_, t) => t / denom)

    // Totals per series (for colour rank and the readout).
    const totals = series.map((s) => s.values.slice(0, steps).reduce((a, b) => a + Math.max(0, b), 0))
    const grand = totals.reduce((a, b) => a + b, 0)

    // The wiggle-minimising baseline (ThemeRiver). For each column, the bottom of
    // the whole stack is pushed down by a weighted sum of its layers — heavier,
    // lower layers weigh more — so the river floats centred and each band keeps
    // its own shape instead of riding the sum below it.
    //   g0[t] = -(1 / (n + 1)) * Σ_i (n - i) * f_i[t]      (i = 0 at the bottom)
    // top[i][t] and bottom[i][t] are then a simple cumulative sum up from g0.
    const bottomOf: number[][] = series.map(() => new Array(steps).fill(0))
    const topOf: number[][] = series.map(() => new Array(steps).fill(0))
    let minY = Infinity
    let maxY = -Infinity
    for (let t = 0; t < steps; t++) {
      let weighted = 0
      for (let i = 0; i < n; i++) weighted += (n - i) * Math.max(0, series[i].values[t] ?? 0)
      let cursor = -weighted / (n + 1)
      for (let i = 0; i < n; i++) {
        const v = Math.max(0, series[i].values[t] ?? 0)
        bottomOf[i][t] = cursor
        cursor += v
        topOf[i][t] = cursor
      }
      if (cursor > maxY) maxY = cursor
      const first = bottomOf[0][t]
      if (first < minY) minY = first
    }

    // One shared value→pixel scale, fixed off the tallest column so bands compare
    // across the whole set, centred vertically in the plot box.
    const span = maxY - minY || 1
    const scale = PLOT_H / span
    const yMid = PAD.top + PLOT_H / 2
    const dataMid = (maxY + minY) / 2
    const toX = (fx: number) => PAD.left + fx * PLOT_W
    const toY = (v: number) => yMid - (v - dataMid) * scale

    // Colour rank by total, brightest for the busiest.
    const order = totals.map((_, i) => i).sort((a, b) => totals[b] - totals[a])
    const rank = new Map<number, number>()
    order.forEach((i, r) => rank.set(i, r))

    const built: Band[] = series.map((s, i) => {
      const topPts = cols.map((fx, t) => ({ x: toX(fx), y: toY(topOf[i][t]) }))
      const botPts = cols.map((fx, t) => ({ x: toX(fx), y: toY(bottomOf[i][t]) }))
      const botRev = [...botPts].reverse()
      const d =
        `M ${topPts[0].x.toFixed(2)} ${topPts[0].y.toFixed(2)}` +
        curveThrough(topPts) +
        ` L ${botRev[0].x.toFixed(2)} ${botRev[0].y.toFixed(2)}` +
        curveThrough(botRev) +
        ' Z'
      // The fattest column, for a self-describing peak anchor.
      let peakT = 0
      let peakH = -Infinity
      for (let t = 0; t < steps; t++) {
        const h = topOf[i][t] - bottomOf[i][t]
        if (h > peakH) {
          peakH = h
          peakT = t
        }
      }
      return {
        id: s.id,
        label: s.label,
        color: s.color ?? LIME_STEPS[rank.get(i) ?? 0] ?? LIME_STEPS[LIME_STEPS.length - 1],
        total: totals[i],
        path: d,
        peakFx: peakT / denom,
      }
    })

    const tk = labels.slice(0, steps).map((label, t) => ({ x: toX(cols[t]), label }))

    return { bands: built, ticks: tk, grandTotal: grand }
  }, [series, labels])

  const shown = active != null ? bands.find((b) => b.id === active) ?? null : null

  const summary =
    ariaLabel ??
    `Stream graph of ${bands.length} series across ${ticks.length} steps${
      unit ? `, measuring ${unit}` : ''
    }. ` +
      bands
        .map((b) => `${b.label}: ${b.total}${unit ? ` ${unit}` : ''} total`)
        .join('; ') +
      `. Grand total ${grandTotal}${unit ? ` ${unit}` : ''}.`

  const maskId = `${uid}-wipe`

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          <defs>
            <mask id={maskId}>
              {/* The wipe: a white rect whose width grows from zero, so the whole
                  river plots itself left-to-right in one pass. */}
              <motion.rect
                x={0}
                y={0}
                height={VBH}
                fill="#fff"
                initial={reduce ? { width: VBW } : { width: 0 }}
                whileInView={reduce ? undefined : { width: VBW }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              />
            </mask>
          </defs>

          <g mask={`url(#${maskId})`}>
            {bands.map((b) => {
              const isActive = active === b.id
              const dim = active != null && !isActive
              return (
                <motion.path
                  key={`${uid}-band-${b.id}`}
                  d={b.path}
                  fill={b.color}
                  stroke={isActive ? 'rgba(220,248,124,0.9)' : 'transparent'}
                  strokeWidth={isActive ? 1 : 0}
                  animate={{ opacity: dim ? 0.16 : 1 }}
                  transition={{ duration: 0.25 }}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActive(b.id)}
                  onMouseLeave={() => setActive((cur) => (cur === b.id ? null : cur))}
                />
              )
            })}
          </g>

          {/* X-axis labels — the ordered marks under the river. */}
          {ticks.map((t, i) => (
            <text
              key={`${uid}-tick-${i}`}
              x={t.x}
              y={VBH - 10}
              textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
              className="fill-white/40"
              style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}
            >
              {t.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Readout line — names the focused series and its total, else the whole
          river's shape. */}
      <div className="mt-4 min-h-[1.25rem] text-sm text-white/55" aria-hidden>
        {shown ? (
          <span>
            <span className="font-display font-bold text-[#DCF87C]">{shown.label}</span>
            <span className="mx-1.5 text-white/30">·</span>
            <span className="tabular-nums text-white/80">{shown.total}</span>
            {unit && <span className="ml-1 text-white/45">{unit}</span>}
            <span className="text-white/40"> total across the run</span>
          </span>
        ) : (
          <span>
            <span className="tabular-nums text-white/80">{grandTotal}</span>
            {unit && <span className="ml-1 text-white/45">{unit}</span>}
            <span className="text-white/40">
              {' '}
              through {bands.length} series over {ticks.length} steps
            </span>
          </span>
        )}
      </div>

      {/* The accessible, always-there face of the chart — a legend of every
          series, each a keyboard-reachable button that lifts its band. */}
      {showLegend && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {bands.map((b) => {
            const isActive = active === b.id
            return (
              <li key={`${uid}-key-${b.id}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(b.id)}
                  onMouseLeave={() => setActive((cur) => (cur === b.id ? null : cur))}
                  onFocus={() => setActive(b.id)}
                  onBlur={() => setActive((cur) => (cur === b.id ? null : cur))}
                  className={`flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                    isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-xs uppercase tracking-[0.12em] text-white/50">{b.label}</span>
                  <span className="font-display text-sm font-bold tabular-nums text-white/85">
                    {b.total}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
