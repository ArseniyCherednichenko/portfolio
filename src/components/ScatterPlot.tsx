import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// ScatterPlot — the chart family's next distinct shape, and the one none of the
// others can be: the relationship-between-two-variables one. Every chart before
// it maps a single dimension to a position or a size — the bar a height, the
// donut a share, the candlestick four prices along one time axis. A scatter maps
// a point into a plane: an x AND a y for every mark, with no ordering imposed.
// That is its whole reason to exist. Its subject is not "how much" but "do these
// two things move together" — the shape a cloud of points makes IS the answer,
// and no other chart here can ask that question.
//
// So it earns a mechanism none of the others need: a least-squares regression
// line, computed by hand (no library), that draws the straight line closest to
// the cloud, plus the r-squared — how tightly the points hug that line, from 0
// (no relationship) to 1 (a perfect one). The line is the reading a scatter
// exists to give; it draws itself left-to-right after the points land.
//
// It keeps the family's rules. No plotting library: SVG circles, hairlines, and
// a computed round-number axis on BOTH sides (a scatter floats in two dimensions,
// so neither axis is forced to zero — the frame hugs the cloud with headroom).
// One lime: the points, the trend line, the active ring — colour never means two
// things. It is quietly interactive: hover or focus a point (each is a real
// focusable target) and a readout floats beside it naming its label and both
// coordinates while the rest of the cloud dims. The SVG carries a full text
// summary and a visible list of every point sits beneath, so the numbers never
// rest on the picture alone.

export interface ScatterPoint {
  x: number
  y: number
  /** Optional name for this observation, shown in the readout and the list. */
  label?: string
}

// The drawing surface, in viewBox units. A near-square field so neither axis is
// visually favoured, with padding for the y-axis labels + title (left), the
// x-axis labels + title (bottom), and a little headroom (top/right) so a point at
// the extreme still has room for its focus ring and readout.
const VBW = 560
const VBH = 460
const PAD = { top: 20, right: 20, bottom: 50, left: 56 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

/**
 * Round a raw [min, max] span out to friendly axis bounds and hand back the tick
 * values that divide it evenly, so gridlines land on round numbers a reader can
 * count by. Unlike a bar axis this does NOT force zero — a scatter's marks are
 * positions, not lengths, so the frame hugs the data with a little headroom on
 * each side. Aims for roughly four steps.
 */
function niceRange(min: number, max: number): { lo: number; hi: number; ticks: number[]; step: number } {
  if (max <= min) {
    const pad = Math.abs(min) > 1 ? Math.abs(min) * 0.1 : 1
    return { lo: min - pad, hi: max + pad, ticks: [min - pad, max + pad], step: pad }
  }
  const span = max - min
  const rough = span / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = mag * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(v)
  return { lo, hi, ticks, step }
}

/** Trim a value to a short, honest label — whole numbers stay whole, otherwise
 *  one decimal, so tick and readout text never runs to a jitter of digits. */
function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return (Math.round(v * 10) / 10).toFixed(1)
}

/** Put the strength of a correlation into plain words — a description of the
 *  PLOTTED cloud, honest to the data on screen, not a claim about the world. */
function strength(r2: number, slope: number): string {
  const dir = slope >= 0 ? 'positive' : 'negative'
  if (r2 >= 0.85) return `a strong ${dir} relationship`
  if (r2 >= 0.5) return `a moderate ${dir} relationship`
  if (r2 >= 0.2) return `a weak ${dir} relationship`
  return 'little to no relationship'
}

interface Plotted extends ScatterPoint {
  index: number
  /** Pixel position in the viewBox. */
  px: number
  py: number
}

export function ScatterPlot({
  data,
  xLabel,
  yLabel,
  xUnit = '',
  yUnit = '',
  showTrend = true,
  className = '',
  ariaLabel,
}: {
  data: ScatterPoint[]
  /** Axis title for the horizontal variable. */
  xLabel: string
  /** Axis title for the vertical variable. */
  yLabel: string
  /** Optional short unit appended to x values in the readout, e.g. "h". */
  xUnit?: string
  /** Optional short unit appended to y values in the readout. */
  yUnit?: string
  /** Draw the least-squares trend line and report r². Default true. */
  showTrend?: boolean
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { points, xTicks, yTicks, xR, yR, trend, r2, slope } = useMemo(() => {
    const empty = {
      points: [] as Plotted[],
      xTicks: [0],
      yTicks: [0],
      xR: { lo: 0, hi: 1 },
      yR: { lo: 0, hi: 1 },
      trend: null as null | { x1: number; y1: number; x2: number; y2: number },
      r2: 0,
      slope: 0,
    }
    if (data.length === 0) return empty

    const xs = data.map((d) => d.x)
    const ys = data.map((d) => d.y)
    const xRange = niceRange(Math.min(...xs), Math.max(...xs))
    const yRange = niceRange(Math.min(...ys), Math.max(...ys))
    const xSpan = xRange.hi - xRange.lo || 1
    const ySpan = yRange.hi - yRange.lo || 1
    const xFor = (v: number) => PAD.left + ((v - xRange.lo) / xSpan) * PLOT_W
    const yFor = (v: number) => PAD.top + (1 - (v - yRange.lo) / ySpan) * PLOT_H

    const pts: Plotted[] = data.map((d, i) => ({
      ...d,
      index: i,
      px: xFor(d.x),
      py: yFor(d.y),
    }))

    // Least squares by hand: slope from the covariance over the x-variance,
    // intercept anchoring the line through the means, r² from the covariance
    // normalised by both spreads. Guarded so a vertical or single-point cloud
    // (zero x-variance) simply draws no line rather than dividing by zero.
    const n = data.length
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    let sxx = 0
    let syy = 0
    let sxy = 0
    for (let i = 0; i < n; i++) {
      sxx += (xs[i] - mx) ** 2
      syy += (ys[i] - my) ** 2
      sxy += (xs[i] - mx) * (ys[i] - my)
    }
    let line: null | { x1: number; y1: number; x2: number; y2: number } = null
    let rSq = 0
    let m = 0
    if (n >= 2 && sxx > 1e-9) {
      m = sxy / sxx
      const b = my - m * mx
      rSq = syy > 1e-9 ? (sxy * sxy) / (sxx * syy) : 0
      // Draw the line only across the visible x-range so it never shoots past
      // the frame; both endpoints are clamped to the plotted bounds.
      const yAt = (x: number) => m * x + b
      line = {
        x1: xFor(xRange.lo),
        y1: yFor(yAt(xRange.lo)),
        x2: xFor(xRange.hi),
        y2: yFor(yAt(xRange.hi)),
      }
    }

    return {
      points: pts,
      xTicks: xRange.ticks,
      yTicks: yRange.ticks,
      xR: { lo: xRange.lo, hi: xRange.hi },
      yR: { lo: yRange.lo, hi: yRange.hi },
      trend: line,
      r2: rSq,
      slope: m,
    }
  }, [data])

  const xFor = (v: number) => PAD.left + ((v - xR.lo) / (xR.hi - xR.lo || 1)) * PLOT_W
  const yFor = (v: number) => PAD.top + (1 - (v - yR.lo) / (yR.hi - yR.lo || 1)) * PLOT_H
  const shown = active != null ? points[active] : null
  const drawTrend = showTrend && trend != null

  const summary =
    ariaLabel ??
    `Scatter plot of ${data.length} points, ${xLabel} on the horizontal axis versus ${yLabel} on the vertical. ` +
      (drawTrend
        ? `The least-squares trend line shows ${strength(r2, slope)}, r-squared ${r2.toFixed(2)}.`
        : '')

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Horizontal gridlines + y-axis value labels — round numbers off the
              nice range, so a point can be placed against a value without a hover. */}
          {yTicks.map((t) => {
            const y = yFor(t)
            return (
              <g key={`${uid}-yt-${t}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={VBW - PAD.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-white/35"
                  style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmt(t)}
                </text>
              </g>
            )
          })}

          {/* Vertical gridlines + x-axis value labels. */}
          {xTicks.map((t) => {
            const x = xFor(t)
            return (
              <g key={`${uid}-xt-${t}`}>
                <line
                  x1={x}
                  y1={PAD.top}
                  x2={x}
                  y2={PAD.top + PLOT_H}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={PAD.top + PLOT_H + 20}
                  textAnchor="middle"
                  className="fill-white/35"
                  style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmt(t)}
                </text>
              </g>
            )
          })}

          {/* Axis titles. */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={VBH - 8}
            textAnchor="middle"
            className="fill-white/55"
            style={{ fontSize: 13, letterSpacing: '0.02em' }}
          >
            {xLabel}
          </text>
          <text
            transform={`translate(14 ${PAD.top + PLOT_H / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-white/55"
            style={{ fontSize: 13, letterSpacing: '0.02em' }}
          >
            {yLabel}
          </text>

          {/* The least-squares trend line, drawn after the cloud has landed.
              pathLength animates 0→1 so it draws itself left-to-right. */}
          {drawTrend && trend && (
            <motion.line
              x1={trend.x1}
              y1={trend.y1}
              x2={trend.x2}
              y2={trend.y2}
              stroke="#DCF87C"
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeLinecap="round"
              style={{ opacity: 0.55 }}
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              whileInView={reduce ? undefined : { pathLength: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: reduce ? 0 : 0.5, ease: 'easeInOut' }}
            />
          )}

          {/* The cloud. Each point scales in from its own centre, staggered by
              index so the plot dusts itself in rather than snapping on. */}
          {points.map((p, i) => {
            const isActive = active === i
            const dim = active != null && !isActive
            return (
              <motion.g
                key={`${uid}-p-${i}`}
                initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                whileInView={reduce ? undefined : { scale: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.4,
                  delay: reduce ? 0 : Math.min(i * 0.03, 0.5),
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ transformOrigin: `${p.px}px ${p.py}px` }}
              >
                {isActive && (
                  <circle
                    cx={p.px}
                    cy={p.py}
                    r={9}
                    fill="none"
                    stroke="#DCF87C"
                    strokeWidth={1.5}
                    style={{ opacity: 0.6 }}
                  />
                )}
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={isActive ? 5.5 : 4.5}
                  fill={isActive ? '#EAFCA0' : '#DCF87C'}
                  style={{
                    opacity: dim ? 0.3 : isActive ? 1 : 0.85,
                    transition: 'opacity 0.15s ease, r 0.15s ease',
                  }}
                />
                {/* Wider transparent hit target so a small point is easy to reach
                    by pointer or keyboard. */}
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={12}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.label ? `${p.label}: ` : ''}${xLabel} ${fmt(p.x)}${
                    xUnit ? ` ${xUnit}` : ''
                  }, ${yLabel} ${fmt(p.y)}${yUnit ? ` ${yUnit}` : ''}`}
                  className="cursor-pointer focus:outline-none"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                />
              </motion.g>
            )
          })}
        </svg>

        {/* Floating readout — an HTML overlay beside the hovered point naming its
            label and both coordinates. aria-hidden: the hit circles announce them.
            It flips to the left of a point in the right third so it never clips. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-y-1/2"
            style={{
              left: `${(shown.px / VBW) * 100}%`,
              top: `${(shown.py / VBH) * 100}%`,
              transform: `translate(${shown.px > PAD.left + PLOT_W * 0.66 ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-2 shadow-lg backdrop-blur-sm">
              {shown.label && (
                <div className="mb-1 font-display text-sm font-bold leading-none tracking-tight text-[#DCF87C]">
                  {shown.label}
                </div>
              )}
              <div className="flex items-baseline gap-3 tabular-nums">
                <div>
                  <span className="text-[9px] uppercase leading-none tracking-[0.1em] text-white/35">
                    {xLabel}
                  </span>
                  <div className="mt-0.5 text-[12px] font-semibold leading-none text-white/85">
                    {fmt(shown.x)}
                    {xUnit ? ` ${xUnit}` : ''}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase leading-none tracking-[0.1em] text-white/35">
                    {yLabel}
                  </span>
                  <div className="mt-0.5 text-[12px] font-semibold leading-none text-white/85">
                    {fmt(shown.y)}
                    {yUnit ? ` ${yUnit}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The reading a scatter exists to give — the fit, in plain words and a
          number, computed from the cloud on screen. Only shown when a line is
          drawn (two-plus points with real x-spread). */}
      {drawTrend && (
        <p className="mt-5 text-sm text-white/55">
          <span className="text-white/80">The trend line shows {strength(r2, slope)}</span> — r²{' '}
          <span className="font-display font-bold tabular-nums text-[#DCF87C]">{r2.toFixed(2)}</span>,
          how tightly the cloud hugs the line from 0 to 1.
        </p>
      )}

      {/* The accessible, always-there face of the cloud — every point's two values
          as a plain list, so the numbers never live only in the picture. */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {points.map((p, i) => {
          const isActive = active === i
          return (
            <li key={`${uid}-key-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full bg-[#DCF87C]"
                  style={{ opacity: isActive ? 1 : 0.7 }}
                  aria-hidden
                />
                {p.label && (
                  <span className="text-xs uppercase tracking-[0.12em] text-white/40">{p.label}</span>
                )}
                <span className="font-display text-sm font-bold tabular-nums text-white/85">
                  {fmt(p.x)}
                  <span className="text-white/40">,</span> {fmt(p.y)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
