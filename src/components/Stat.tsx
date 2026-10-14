import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'

// Stat — the data-viz family's compact member, and the one none of the others
// is. Every chart before it is a full-width figure that owns its section: the
// area chart draws a trend across a wide field, the donut spreads a whole into
// a ring, the candlestick strings four prices along a time axis. A Stat is the
// opposite shape of thing — the KPI tile a real dashboard lays a dozen of in a
// row: a label, one big number read at a glance, a trend chip, and a sparkline
// small enough to sit *inside* the card rather than carry a section of its own.
// It answers "where does this number stand, and which way is it going" in the
// footprint of a button.
//
// It keeps every family rule. No plotting library — the sparkline is a
// hand-rolled Catmull-Rom spline through the series, the same smoother the area
// chart uses, emitted as SVG beziers. One hue — the site's lime does both jobs
// a KPI tile usually splits across red/green: direction is told not by colour
// but by an ARROW glyph and the trend chip's fill, so the sparkline stays a
// single calm lime whether the number rose or fell (the candlestick's trick,
// moved to a tile). One Framer Motion move — the big number counts up while the
// sparkline draws itself left-to-right behind a wipe mask, in step, and the
// final point pops on once the wipe reaches it.
//
// Honesty: a Stat makes no claim of its own. It renders exactly the `series`
// and `value` it is handed, derives the trend purely from that series (last vs
// first), and the demo that shows it off is clearly illustrative. It never
// invents a metric.
//
// Accessibility: the tile is a labelled group whose number, unit and trend are
// real text; the sparkline is decorative and aria-hidden, so a reader hears the
// figure and its direction, never a description of a line. Under reduced motion
// the number is final from the first frame and the sparkline is drawn whole.

export type DeltaMode = 'absolute' | 'percent' | 'none'

export interface StatProps {
  /** The small label above the figure, e.g. "Monthly active". */
  label: string
  /** The trend series, oldest → newest. The last point is the current value
   *  unless `value` overrides it. Two or more points draw a sparkline. */
  series: number[]
  /** Override the displayed figure; defaults to the last point of `series`. */
  value?: number
  /** Short noun shown faintly after the number, e.g. "k" or "ms". */
  unit?: string
  /** String shown before the number, e.g. "$". */
  prefix?: string
  /** Decimal places for the figure and the trend. Default 0. */
  decimals?: number
  /** How to render the change from the first to the last point. Default 'percent'. */
  deltaMode?: DeltaMode
  /** One honest line under the tile. */
  caption?: string
  className?: string
  /** Overrides the generated screen-reader summary of the tile. */
  ariaLabel?: string
}

// The sparkline surface, in viewBox units. A wide, short field so a run of
// points reads as a trend at tile scale without ever looking like a full chart.
const VBW = 240
const VBH = 72
const PAD = { top: 10, right: 6, bottom: 10, left: 6 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

const EASE = [0.16, 1, 0.3, 1] as const

interface SparkPoint {
  x: number
  y: number
}

/** A Catmull-Rom spline through the points as cubic beziers — the same smoother
 *  the area chart uses, so a sparkline flows rather than zig-zags. */
function smoothPath(pts: SparkPoint[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
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

function fmt(n: number, decimals: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// The count-up, formatted with prefix/unit/decimals. Kept inside Stat (rather
// than reusing AnimatedCounter, which rounds to a bare integer) so a tile can
// carry decimals and a currency prefix. Mirrors AnimatedCounter's behaviour:
// counts once on first scroll-in, and under reduced motion simply sets the
// final value.
function CountUp({
  value,
  decimals,
  prefix,
  unit,
  inView,
}: {
  value: number
  decimals: number
  prefix: string
  unit?: string
  inView: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const paint = (v: number) => {
      node.textContent = `${prefix}${fmt(v, decimals)}`
    }
    if (reduce || !inView) {
      if (inView) paint(value)
      return
    }
    const controls = animate(0, value, {
      duration: 1.5,
      ease: EASE,
      onUpdate: paint,
    })
    return () => controls.stop()
  }, [inView, value, decimals, prefix, reduce])

  return (
    <span className="font-display text-4xl font-bold leading-none tracking-tight text-white sm:text-5xl">
      <span ref={ref}>
        {prefix}
        {fmt(reduce ? value : 0, decimals)}
      </span>
      {unit && <span className="ml-1.5 align-baseline text-base font-semibold text-white/35">{unit}</span>}
    </span>
  )
}

export function Stat({
  label,
  series,
  value,
  unit,
  prefix = '',
  decimals = 0,
  deltaMode = 'percent',
  caption,
  className = '',
  ariaLabel,
}: StatProps) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, margin: '-60px' })
  const [drawn, setDrawn] = useState(reduce)

  const current = value ?? series[series.length - 1] ?? 0

  const { line, area, points, last } = useMemo(() => {
    if (series.length === 0) {
      return { line: '', area: '', points: [] as SparkPoint[], last: null as SparkPoint | null }
    }
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    const denom = series.length > 1 ? series.length - 1 : 1
    const pts: SparkPoint[] = series.map((v, i) => {
      const x = PAD.left + (i / denom) * PLOT_W
      // A touch of headroom top and bottom so the curve never kisses the frame.
      const y = PAD.top + (1 - (v - min) / span) * PLOT_H
      return { x, y }
    })
    const l = smoothPath(pts)
    const baseline = PAD.top + PLOT_H
    const a = `${l} L ${pts[pts.length - 1].x.toFixed(2)} ${baseline} L ${pts[0].x.toFixed(2)} ${baseline} Z`
    return { line: l, area: a, points: pts, last: pts[pts.length - 1] }
  }, [series])

  // The trend, derived purely from the series — first point to last.
  const trend = useMemo(() => {
    if (series.length < 2) return null
    const a = series[0]
    const b = series[series.length - 1]
    const diff = b - a
    const dir: 'up' | 'down' | 'flat' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
    const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'
    let text = ''
    if (deltaMode === 'percent') {
      const pct = a !== 0 ? (diff / Math.abs(a)) * 100 : 0
      text = `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmt(Math.abs(pct), pct % 1 === 0 ? 0 : 1)}%`
    } else if (deltaMode === 'absolute') {
      text = `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${prefix}${fmt(Math.abs(diff), decimals)}${unit ? ` ${unit}` : ''}`
    }
    return { dir, arrow, text }
  }, [series, deltaMode, decimals, prefix, unit])

  const summary =
    ariaLabel ??
    `${label}: ${prefix}${fmt(current, decimals)}${unit ? ` ${unit}` : ''}` +
      (trend && deltaMode !== 'none'
        ? `, ${trend.dir === 'up' ? 'up' : trend.dir === 'down' ? 'down' : 'unchanged'} ${trend.text.replace('−', 'minus ')} over the period`
        : '') +
      (caption ? `. ${caption}` : '')

  const maskId = `${uid}-wipe`
  const fillId = `${uid}-fill`
  const baseline = PAD.top + PLOT_H

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={summary}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-[#DCF87C]/25 hover:bg-white/[0.035] sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">{label}</p>
        {trend && deltaMode !== 'none' && (
          <span
            aria-hidden
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              trend.dir === 'up'
                ? 'border-[#DCF87C]/30 bg-[#DCF87C]/10 text-[#DCF87C]'
                : 'border-white/15 bg-white/[0.04] text-white/55'
            }`}
          >
            <span className="text-xs leading-none">{trend.arrow}</span>
            {trend.text}
          </span>
        )}
      </div>

      <div className="mt-4">
        <CountUp value={current} decimals={decimals} prefix={prefix} unit={unit} inView={inView} />
      </div>

      {/* Sparkline — decorative, so aria-hidden; the figure and trend above are
          the real, read-aloud content. */}
      {points.length >= 2 && (
        <div aria-hidden className="mt-4" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
          <svg viewBox={`0 0 ${VBW} ${VBH}`} className="h-full w-full overflow-visible" role="presentation">
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(220,248,124,0.22)" />
                <stop offset="100%" stopColor="rgba(220,248,124,0)" />
              </linearGradient>
              <mask id={maskId}>
                <motion.rect
                  x={0}
                  y={0}
                  height={VBH}
                  fill="#fff"
                  initial={reduce ? { width: VBW } : { width: 0 }}
                  animate={inView || reduce ? { width: VBW } : { width: 0 }}
                  transition={{ duration: 1.2, ease: EASE }}
                  onAnimationComplete={() => setDrawn(true)}
                />
              </mask>
            </defs>

            <line
              x1={PAD.left}
              y1={baseline}
              x2={VBW - PAD.right}
              y2={baseline}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />

            <g mask={`url(#${maskId})`}>
              <path d={area} fill={`url(#${fillId})`} />
              <path
                d={line}
                fill="none"
                stroke="#DCF87C"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* The final point — the "you are here" dot, popped on once the wipe
                has reached it. */}
            {last && (
              <motion.circle
                cx={last.x}
                cy={last.y}
                r={3}
                fill="#DCF87C"
                stroke="#0a0a0a"
                strokeWidth={1.5}
                initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                animate={drawn ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                style={{ transformOrigin: `${last.x}px ${last.y}px` }}
              />
            )}
          </svg>
        </div>
      )}

      {caption && <p className="mt-3 text-xs leading-relaxed text-white/45">{caption}</p>}
    </div>
  )
}
