import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// BarChart — the site's third piece of data-viz, and the sibling the chart
// family was missing. The DonutChart answers "how does a whole split up?" at a
// single instant; the AreaChart answers "how does one quantity move across an
// ordered axis?"; this answers the plainest question of all — "which of these
// discrete things is bigger?" — by standing them up as columns side by side and
// letting the eye compare heights directly.
//
// It keeps the family's rules. No plotting library: just SVG rects, a computed
// axis, and one Framer Motion move. And it stays in a SINGLE hue — the columns
// carry one lime, stepped darker by rank so the tallest reads brightest, which
// means colour only ever encodes "how big", never identity. Each column is
// named by its own axis label and its own readout, so nothing rests on the
// ramp alone.
//
// The reveal is a grow-up: every column scales from its baseline to full height
// (transform-origin pinned to the bottom edge), staggered left-to-right so the
// bars rise like a small wave being plotted. Under reduced motion they are
// simply present at full height from the first frame — the finished chart, no
// growth. It is quietly interactive: hover or focus a column (each is a real
// button, so the whole set is keyboard-reachable) and a readout floats above it
// while the rest dim. The SVG carries a full text summary for a screen reader,
// and a visible readout list sits beneath so the numbers never live only in the
// picture.

export interface BarDatum {
  label: string
  value: number
}

// The drawing surface, in viewBox units. A 2:1 field so a handful of columns
// breathe, with padding for the y-axis value labels (left), the x-axis category
// labels (bottom), and the readout that floats above the tallest column (top).
const VBW = 720
const VBH = 360
const PAD = { top: 30, right: 12, bottom: 34, left: 38 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

/**
 * One lime, stepped by rank — the same sequential ramp the DonutChart uses, so
 * the two charts read as one family. Rank 0 (the tallest column) is full lime;
 * each shorter column steps down in opacity over the dark ground. A single-hue
 * ramp, never a rainbow: height already carries the magnitude, colour only
 * reinforces it.
 */
function limeFor(rank: number, count: number): string {
  if (count <= 1) return 'rgba(220, 248, 124, 1)'
  const t = rank / (count - 1)
  const alpha = 1 - t * 0.55 // 1.0 down to 0.45
  return `rgba(220, 248, 124, ${alpha.toFixed(3)})`
}

/**
 * Round a raw maximum up to a friendly axis top and hand back the tick values
 * that divide it evenly, so the gridlines land on round numbers a reader can
 * actually count by (5s, 10s, 25s) instead of whatever the data happened to
 * peak at. Aims for roughly four steps.
 */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] }
  const rough = max / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = mag * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v))
  return { top, ticks }
}

interface Bar extends BarDatum {
  /** Grid index (left-to-right), preserving the caller's order. */
  index: number
  /** Rank by value (0 = tallest), driving the lime ramp. */
  rank: number
  x: number
  w: number
  /** Full-height top edge, once grown in. */
  y: number
  h: number
  /** Centre of the column as a fraction of viewBox width, for the readout. */
  cx: number
  color: string
}

export function BarChart({
  data,
  unit,
  valuePrefix = '',
  className = '',
  ariaLabel,
}: {
  data: BarDatum[]
  /** Optional short noun shown after a value in the readout, e.g. "entries". */
  unit?: string
  /** Optional string shown before a value, e.g. "+". */
  valuePrefix?: string
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { bars, ticks, baseline } = useMemo(() => {
    const base = PAD.top + PLOT_H
    if (data.length === 0) {
      return { bars: [] as Bar[], ticks: [0], baseline: base }
    }
    const max = Math.max(...data.map((d) => d.value), 0)
    const { top, ticks: tk } = niceScale(max)
    const n = data.length
    const band = PLOT_W / n
    // Columns take a little over half their band, so the gaps between them are
    // clear but the bars still feel substantial. Capped so a two-bar chart does
    // not grow slabs.
    const w = Math.min(band * 0.58, 96)
    // Rank order (tallest first) for the ramp, mapped back onto grid position.
    const order = data
      .map((d, i) => ({ i, v: d.value }))
      .sort((a, b) => b.v - a.v)
    const rankOf = new Map<number, number>()
    order.forEach((o, r) => rankOf.set(o.i, r))
    const list: Bar[] = data.map((d, i) => {
      const h = top > 0 ? (d.value / top) * PLOT_H : 0
      const x = PAD.left + band * i + (band - w) / 2
      const rank = rankOf.get(i) ?? 0
      return {
        ...d,
        index: i,
        rank,
        x,
        w,
        y: base - h,
        h,
        cx: (x + w / 2) / VBW,
        color: limeFor(rank, n),
      }
    })
    return { bars: list, ticks: tk, baseline: base }
  }, [data])

  const top = ticks[ticks.length - 1] ?? 1
  const shown = active != null ? bars[active] : null

  const summary =
    ariaLabel ??
    `Bar chart comparing ${bars.length} categories${unit ? ` by ${unit}` : ''}: ` +
      bars.map((b) => `${b.label}, ${valuePrefix}${b.value}`).join('; ') +
      '.'

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Gridlines + y-axis value labels — round ticks the reader can count
              by. The zero line is a touch brighter so the floor reads as solid;
              the rest are hairlines the columns rise past. */}
          {ticks.map((t) => {
            const y = baseline - (top > 0 ? (t / top) * PLOT_H : 0)
            const isZero = t === 0
            return (
              <g key={`${uid}-grid-${t}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={VBW - PAD.right}
                  y2={y}
                  stroke={isZero ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-white/35"
                  style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                >
                  {t}
                </text>
              </g>
            )
          })}

          {/* The columns. Each scales up from its own bottom edge
              (transform-box: fill-box pins the origin to the rect), staggered by
              grid index so they rise in sequence. */}
          {bars.map((b, i) => {
            const isActive = active === i
            const dim = active != null && !isActive
            return (
              <g key={`${uid}-bar-${b.label}`}>
                <motion.rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={Math.max(b.h, 0.01)}
                  rx={6}
                  fill={b.color}
                  initial={reduce ? { scaleY: 1 } : { scaleY: 0 }}
                  whileInView={reduce ? undefined : { scaleY: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{
                    duration: 0.85,
                    ease: [0.16, 1, 0.3, 1],
                    delay: reduce ? 0 : 0.12 + i * 0.08,
                  }}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'bottom',
                    opacity: dim ? 0.3 : 1,
                    transition: 'opacity 0.25s ease',
                  }}
                />
                {/* A bright cap on the active column's top edge, so the hovered
                    bar lifts out of the set. */}
                {isActive && b.h > 3 && (
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={3}
                    rx={1.5}
                    fill="#ffffff"
                    opacity={0.85}
                  />
                )}
                {/* Full-band transparent hit target, so the whole column slot is
                    hoverable/focusable, not just the painted rect. */}
                <rect
                  x={b.x - (PLOT_W / bars.length - b.w) / 2}
                  y={PAD.top}
                  width={PLOT_W / bars.length}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${b.label}: ${valuePrefix}${b.value}${unit ? ` ${unit}` : ''}`}
                  className="cursor-pointer focus:outline-none"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                />
                {/* X-axis category label under each column. */}
                <text
                  x={b.x + b.w / 2}
                  y={baseline + 22}
                  textAnchor="middle"
                  className={isActive ? 'fill-white/80' : 'fill-white/45'}
                  style={{ fontSize: 15, transition: 'fill 0.2s ease' }}
                >
                  {b.label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Floating readout — an HTML overlay above the active column, so it can
            be styled richly and sit over the SVG. aria-hidden: the column hit
            targets already announce label and value. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${shown.cx * 100}%`,
              top: `${(shown.y / VBH) * 100}%`,
              marginTop: -10,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-1.5 text-center shadow-lg backdrop-blur-sm">
              <div className="font-display text-base font-bold leading-none tracking-tight text-[#DCF87C]">
                {valuePrefix}
                {shown.value}
                {unit && <span className="ml-1 text-[11px] font-medium text-white/40">{unit}</span>}
              </div>
              <div className="mt-1 text-[11px] leading-none text-white/55">{shown.label}</div>
            </div>
          </div>
        )}
      </div>

      {/* The accessible, always-there face of the set — a plain readout of every
          column, so the numbers never rest on the picture alone. */}
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {bars.map((b, i) => {
          const isActive = active === i
          return (
            <li key={`${uid}-key-${b.label}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                className={`flex items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/10 transition-transform"
                  style={{
                    background: b.color,
                    transform: isActive ? 'scale(1.35)' : 'scale(1)',
                  }}
                />
                <span
                  className={`text-xs uppercase tracking-[0.12em] transition-colors ${
                    isActive ? 'text-white/80' : 'text-white/45'
                  }`}
                >
                  {b.label}
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-white/85">
                  {valuePrefix}
                  {b.value}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
