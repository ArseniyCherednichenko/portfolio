import { useId, useMemo, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

// BoxPlot — the five-number SKELETON, and the distribution the ridgeline draws
// whole. The ridgeline keeps the entire silhouette of a group; this throws the
// silhouette away and keeps only the five numbers that summarise it: the median,
// the box of the middle half (first quartile to third), the whiskers reaching to
// the furthest ordinary values, and the outliers that fall past the fence. Where
// the scatter plots two numbers per mark and the ridgeline a whole density, the
// box reduces a whole group to Tukey's five-number summary — the oldest honest
// way to compare spreads side by side without drawing every point.
//
// It keeps the family's rules. No plotting library — hand-rolled SVG on a shared
// x-axis, one row per group, each row the same box-whisker-cap construction so
// the eye compares boxes by where they sit and how wide they run. The single
// lime does all the work: the box is a faint lime wash inside a lime border, the
// MEDIAN is the one bright, thick lime stroke (the number the chart is really
// about), the whiskers and caps a dimmer lime, and the outliers small hollow
// lime rings. Identity is the row LABEL on the left, never a second hue.
//
// The reveal is an opening: every box grows out from its own median, left and
// right at once, whiskers unfurling with it — the summary assembling around the
// middle. Under reduced motion the boxes are simply present. Hover or focus a row
// (its box and its row in the list beneath are real targets) and it lifts to full
// lime while the rest fall back, a readout naming the median and the quartile
// range. The SVG carries a text summary and the list beneath holds every group's
// five numbers in plain words, so the distribution never lives only in the paint.

export interface BoxGroup {
  label: string
  /** Raw samples for this group. Summarised to quartiles on a shared axis, so a
   * genuinely wider-spread group draws a visibly wider box. */
  values: number[]
}

// Tukey's five-number summary plus the 1.5·IQR fences and the points past them.
export interface BoxStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  iqr: number
  /** Furthest ordinary value at or inside the low fence (the low whisker end). */
  whiskerLow: number
  /** Furthest ordinary value at or inside the high fence (the high whisker end). */
  whiskerHigh: number
  /** Samples beyond either fence, sorted. */
  outliers: number[]
}

// Linear-interpolated quantile (the type-7 definition most tools use) over an
// already-sorted array.
function quantileSorted(sorted: number[], q: number): number {
  const len = sorted.length
  if (len === 0) return NaN
  if (len === 1) return sorted[0]
  const pos = (len - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base])
}

export function summarise(values: number[]): BoxStats | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantileSorted(sorted, 0.25)
  const median = quantileSorted(sorted, 0.5)
  const q3 = quantileSorted(sorted, 0.75)
  const iqr = q3 - q1
  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr
  let whiskerLow = sorted[0]
  for (const v of sorted) {
    if (v >= lowFence) {
      whiskerLow = v
      break
    }
  }
  let whiskerHigh = sorted[sorted.length - 1]
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] <= highFence) {
      whiskerHigh = sorted[i]
      break
    }
  }
  const outliers = sorted.filter((v) => v < lowFence || v > highFence)
  return {
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1],
    iqr,
    whiskerLow,
    whiskerHigh,
    outliers,
  }
}

// Drawing surface, in viewBox units. Room on the left for the row labels, a hair
// at the bottom for the axis ticks. Height is derived from the group count.
const VBW = 760
const PAD = { top: 20, right: 30, bottom: 34, left: 112 }
const PLOT_W = VBW - PAD.left - PAD.right
const ROW_STEP = 52
const BOX_H = 26
const CAP_H = 16

interface Box extends BoxGroup {
  index: number
  stats: BoxStats
  /** Row centre y in viewBox units. */
  cy: number
}

export function BoxPlot({
  groups,
  className = '',
  formatX,
  xAxisLabel,
  ariaLabel,
}: {
  groups: BoxGroup[]
  className?: string
  /** Formats an axis value into a label (ticks, readout). Defaults to a rounded
   * number. */
  formatX?: (value: number) => string
  /** A short label for what the x-axis measures, shown under the field. */
  xAxisLabel?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { once: true, amount: 0.3 })
  const revealed = reduce || inView

  const fmt = formatX ?? ((v: number) => `${Math.round(v)}`)
  const n = groups.length
  const VBH = PAD.top + n * ROW_STEP + PAD.bottom

  const { boxes, domainMin, domainMax } = useMemo(() => {
    const summarised = groups
      .map((g, index) => {
        const stats = summarise(g.values)
        return stats ? { ...g, index, stats, cy: PAD.top + ROW_STEP / 2 + index * ROW_STEP } : null
      })
      .filter((b): b is Box => b !== null)

    // One shared scale across every group, covering everything drawn — whisker
    // ends and outliers alike — so a wider spread genuinely reads wider.
    let lo = Infinity
    let hi = -Infinity
    for (const b of summarised) {
      lo = Math.min(lo, b.stats.whiskerLow, ...b.stats.outliers)
      hi = Math.max(hi, b.stats.whiskerHigh, ...b.stats.outliers)
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0
      hi = 1
    }
    if (hi === lo) hi = lo + 1
    // A little breathing room on each end so a box never kisses the frame.
    const padSpan = (hi - lo) * 0.06
    return { boxes: summarised, domainMin: lo - padSpan, domainMax: hi + padSpan }
  }, [groups])

  const xFor = (value: number) =>
    PAD.left + ((value - domainMin) / (domainMax - domainMin)) * PLOT_W

  const widest = boxes.reduce<Box | null>(
    (best, b) => (!best || b.stats.iqr > best.stats.iqr ? b : best),
    null,
  )
  const summary =
    ariaLabel ??
    `Box plot comparing ${boxes.length} groups on one axis${
      xAxisLabel ? ` (${xAxisLabel})` : ''
    }.${
      widest
        ? ` The widest spread, ${widest.label}, runs from ${fmt(widest.stats.q1)} to ${fmt(
            widest.stats.q3,
          )} with a median of ${fmt(widest.stats.median)}.`
        : ''
    }`

  // Five evenly spaced axis ticks across the domain.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => domainMin + f * (domainMax - domainMin))

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Faint vertical gridlines at the ticks, behind everything. */}
          {ticks.map((t, i) => (
            <line
              key={`${uid}-grid-${i}`}
              x1={xFor(t)}
              x2={xFor(t)}
              y1={PAD.top}
              y2={VBH - PAD.bottom}
              stroke="#ffffff"
              strokeOpacity={0.05}
              strokeWidth={1}
            />
          ))}

          {boxes.map((b) => {
            const s = b.stats
            const isActive = active === b.index
            const dimmed = active != null && !isActive
            const medianX = xFor(s.median)
            const q1X = xFor(s.q1)
            const q3X = xFor(s.q3)
            const loX = xFor(s.whiskerLow)
            const hiX = xFor(s.whiskerHigh)
            const top = b.cy - BOX_H / 2
            const stroke = isActive ? '#EAFCA0' : '#DCF87C'
            const faint = dimmed ? 0.18 : 1
            return (
              <motion.g
                key={`${uid}-box-${b.label}`}
                tabIndex={0}
                role="button"
                aria-label={`${b.label}: median ${fmt(s.median)}, middle half from ${fmt(
                  s.q1,
                )} to ${fmt(s.q3)}, whiskers ${fmt(s.whiskerLow)} to ${fmt(s.whiskerHigh)}${
                  s.outliers.length
                    ? `, ${s.outliers.length} outlier${s.outliers.length === 1 ? '' : 's'}`
                    : ''
                }`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setActive(b.index)}
                onMouseLeave={() => setActive((cur) => (cur === b.index ? null : cur))}
                onFocus={() => setActive(b.index)}
                onBlur={() => setActive((cur) => (cur === b.index ? null : cur))}
                initial={false}
                animate={{ scaleX: revealed ? 1 : 0, opacity: revealed ? 1 : 0 }}
                transition={{
                  duration: reduce ? 0 : 0.6,
                  delay: reduce ? 0 : 0.06 + b.index * 0.09,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ transformOrigin: `${medianX}px ${b.cy}px`, transformBox: 'view-box' as never }}
              >
                {/* Row label on the left — identity without a second hue. Outside
                    the box scaling so it never slides with the reveal. */}
                <text
                  x={PAD.left - 16}
                  y={b.cy}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, opacity: faint }}
                  className={isActive ? 'fill-[#EAFCA0]' : dimmed ? 'fill-white/35' : 'fill-white/70'}
                >
                  {b.label}
                </text>

                {/* Whisker spine, low cap to high cap. */}
                <line
                  x1={loX}
                  x2={hiX}
                  y1={b.cy}
                  y2={b.cy}
                  stroke={stroke}
                  strokeOpacity={dimmed ? 0.14 : 0.55}
                  strokeWidth={1.4}
                />
                {/* Whisker caps. */}
                {[loX, hiX].map((cx, i) => (
                  <line
                    key={`${uid}-cap-${b.label}-${i}`}
                    x1={cx}
                    x2={cx}
                    y1={b.cy - CAP_H / 2}
                    y2={b.cy + CAP_H / 2}
                    stroke={stroke}
                    strokeOpacity={dimmed ? 0.14 : 0.55}
                    strokeWidth={1.4}
                  />
                ))}

                {/* The box — middle half, a faint lime wash in a lime border. */}
                <rect
                  x={Math.min(q1X, q3X)}
                  y={top}
                  width={Math.max(1, Math.abs(q3X - q1X))}
                  height={BOX_H}
                  rx={3}
                  fill={stroke}
                  fillOpacity={dimmed ? 0.05 : isActive ? 0.2 : 0.12}
                  stroke={stroke}
                  strokeOpacity={dimmed ? 0.18 : isActive ? 1 : 0.8}
                  strokeWidth={isActive ? 2 : 1.4}
                  style={{ transition: 'fill-opacity 0.2s ease, stroke-opacity 0.2s ease' }}
                />
                {/* The median — the one bright, thick lime stroke. */}
                <line
                  x1={medianX}
                  x2={medianX}
                  y1={top}
                  y2={top + BOX_H}
                  stroke={isActive ? '#EAFCA0' : '#DCF87C'}
                  strokeOpacity={dimmed ? 0.3 : 1}
                  strokeWidth={isActive ? 3.4 : 2.6}
                  strokeLinecap="round"
                />
                {/* Outliers — small hollow lime rings past the fence. */}
                {s.outliers.map((v, i) => (
                  <circle
                    key={`${uid}-out-${b.label}-${i}`}
                    cx={xFor(v)}
                    cy={b.cy}
                    r={3}
                    fill="none"
                    stroke={stroke}
                    strokeOpacity={dimmed ? 0.2 : 0.75}
                    strokeWidth={1.3}
                  />
                ))}
              </motion.g>
            )
          })}

          {/* Axis ticks, drawn last so they read over everything. */}
          {ticks.map((t, i) => (
            <text
              key={`${uid}-tick-${i}`}
              x={xFor(t)}
              y={VBH - PAD.bottom + 22}
              textAnchor="middle"
              className="fill-white/40"
              style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(t)}
            </text>
          ))}
        </svg>

        {/* Floating readout — anchored above the active box's median. */}
        {active != null && boxes[active] && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10"
            style={{
              left: `${(xFor(boxes[active].stats.median) / VBW) * 100}%`,
              top: `${((boxes[active].cy - BOX_H / 2) / VBH) * 100}%`,
              transform: 'translate(-50%, -112%)',
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
              <div className="font-display text-sm font-bold leading-none tracking-tight text-[#DCF87C]">
                {boxes[active].label}
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] leading-none text-white/75 tabular-nums">
                <span>median {fmt(boxes[active].stats.median)}</span>
                <span className="text-white/35">·</span>
                <span>
                  {fmt(boxes[active].stats.q1)}–{fmt(boxes[active].stats.q3)}
                </span>
                {boxes[active].stats.outliers.length > 0 && (
                  <>
                    <span className="text-white/35">·</span>
                    <span className="text-white/90">
                      {boxes[active].stats.outliers.length} out
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {xAxisLabel && (
        <p className="mt-1 text-center text-xs uppercase tracking-[0.2em] text-white/35">{xAxisLabel}</p>
      )}

      {/* The accessible, always-there face of the figure — every group's five
          numbers in plain words, each lifting its box. */}
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {boxes.map((b) => {
          const isActive = active === b.index
          return (
            <li key={`${uid}-key-${b.label}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(b.index)}
                onMouseLeave={() => setActive((cur) => (cur === b.index ? null : cur))}
                onFocus={() => setActive(b.index)}
                onBlur={() => setActive((cur) => (cur === b.index ? null : cur))}
                className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span className="text-sm text-white/85">{b.label}</span>
                <span className="text-xs tabular-nums text-[#DCF87C]">{fmt(b.stats.median)}</span>
                <span className="text-xs tabular-nums text-white/40">
                  {fmt(b.stats.q1)}–{fmt(b.stats.q3)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
