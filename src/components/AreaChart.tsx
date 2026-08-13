import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// AreaChart — the site's second piece of data-viz, and the sibling to the
// DonutChart: same "made, not assembled" thesis (no plotting library, just SVG
// and one Framer Motion move), pointed at the other basic question a chart can
// answer. Where the donut shows a part-to-whole spread at a single instant,
// this shows a single quantity changing across an ordered axis — a trend, a
// growth curve, a story over time.
//
// It stays in ONE hue for the same reason the donut does: there is only ever
// one series here, so colour never has to tell two things apart. The lime is
// the line; a soft lime-to-transparent wash fills the area beneath it so the
// curve reads as an accumulation and not just a wire.
//
// The reveal is a single left-to-right wipe. Both the line and its fill point
// at one animated mask whose width grows from zero, so the whole curve draws
// itself in as if being plotted, in step, rather than the line and the area
// arriving out of sync. The vertex dots fade in behind the wipe as it passes
// each one. Under reduced motion the mask is simply full width from the first
// frame — the finished curve, no draw.
//
// It is quietly interactive: hover or focus a point (each is a real button, so
// the whole series is keyboard-reachable) and a readout floats above it with
// that point's label and value, while a guide line drops to the axis. The SVG
// carries a full text summary and a visually-hidden data list, so the trend is
// legible to a screen reader without the picture.

export interface AreaDatum {
  label: string
  value: number
}

// The drawing surface, in viewBox units. A wide 18:7 field so a long run of
// points still breathes, with padding for the axis labels and the readout that
// floats above the highest point.
const VBW = 720
const VBH = 280
const PAD = { top: 28, right: 16, bottom: 34, left: 16 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

interface Point extends AreaDatum {
  x: number
  y: number
  /** Fractional position along the x axis, 0..1 — used to place the readout. */
  fx: number
}

/**
 * A Catmull-Rom spline through the points, emitted as cubic beziers, so the
 * curve is smooth without a library. Straight segments would read as a sawtooth
 * on an accumulation; the spline lets it flow the way a growth curve should.
 */
function smoothPath(pts: Point[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
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

export function AreaChart({
  data,
  unit,
  valuePrefix = '',
  className = '',
  ariaLabel,
}: {
  data: AreaDatum[]
  /** Optional short noun shown after a value in the readout, e.g. "components". */
  unit?: string
  /** Optional string shown before a value in the readout, e.g. "+". */
  valuePrefix?: string
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { points, line, area, maxValue } = useMemo(() => {
    if (data.length === 0) {
      return { points: [] as Point[], line: '', area: '', maxValue: 0 }
    }
    const max = Math.max(...data.map((d) => d.value), 1)
    // A little headroom above the peak so the top of the curve never kisses the
    // frame, and the readout above it has room to sit.
    const scaleMax = max * 1.12
    const denom = data.length > 1 ? data.length - 1 : 1
    const pts: Point[] = data.map((d, i) => {
      const fx = i / denom
      const x = PAD.left + fx * PLOT_W
      const y = PAD.top + (1 - d.value / scaleMax) * PLOT_H
      return { ...d, x, y, fx }
    })
    const l = smoothPath(pts)
    const baseline = PAD.top + PLOT_H
    const a = `${l} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`
    return { points: pts, line: l, area: a, maxValue: max }
  }, [data])

  const baseline = PAD.top + PLOT_H
  const shown = active != null ? points[active] : null

  const summary =
    ariaLabel ??
    `Area chart of ${data.length} points${unit ? ` measuring ${unit}` : ''}, ranging from ` +
      `${valuePrefix}${points[0]?.value ?? 0} at ${points[0]?.label ?? 'start'} to ` +
      `${valuePrefix}${points[points.length - 1]?.value ?? 0} at ${
        points[points.length - 1]?.label ?? 'end'
      }. Peak ${valuePrefix}${maxValue}.`

  const maskId = `${uid}-wipe`
  const fillId = `${uid}-fill`

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
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(220,248,124,0.28)" />
              <stop offset="100%" stopColor="rgba(220,248,124,0)" />
            </linearGradient>
            <mask id={maskId}>
              {/* The wipe: a white rect whose width grows from zero. Everything
                  masked by it is revealed left-to-right in one pass. */}
              <motion.rect
                x={0}
                y={0}
                height={VBH}
                fill="#fff"
                initial={reduce ? { width: VBW } : { width: 0 }}
                whileInView={reduce ? undefined : { width: VBW }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
              />
            </mask>
          </defs>

          {/* Baseline — a hairline the area sits on, so a rising curve reads as
              rising from a floor. */}
          <line
            x1={PAD.left}
            y1={baseline}
            x2={VBW - PAD.right}
            y2={baseline}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={1}
          />

          <g mask={`url(#${maskId})`}>
            <path d={area} fill={`url(#${fillId})`} />
            <path
              d={line}
              fill="none"
              stroke="#DCF87C"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Active guide line — drops from the hovered point to the axis. */}
          {shown && (
            <line
              x1={shown.x}
              y1={shown.y}
              x2={shown.x}
              y2={baseline}
              stroke="rgba(220,248,124,0.35)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          )}

          {/* Vertices — each a focusable button. A generous transparent hit
              circle sits under the visible dot so it is easy to reach. */}
          {points.map((p, i) => {
            const isActive = active === i
            return (
              <g key={`${uid}-pt-${p.label}`}>
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 5.5 : 3.5}
                  fill={isActive ? '#DCF87C' : '#0a0a0a'}
                  stroke="#DCF87C"
                  strokeWidth={2}
                  initial={reduce ? { opacity: 1 } : { opacity: 0 }}
                  whileInView={reduce ? undefined : { opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.3, delay: reduce ? 0 : 0.2 + p.fx * 1.05 }}
                  style={{ transition: 'r 0.15s ease, fill 0.15s ease' }}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={22}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.label}: ${valuePrefix}${p.value}${unit ? ` ${unit}` : ''}`}
                  className="cursor-pointer focus:outline-none"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                />
              </g>
            )
          })}

          {/* X-axis labels — the ordered marks under each point. */}
          {points.map((p) => (
            <text
              key={`${uid}-lbl-${p.label}`}
              x={p.x}
              y={baseline + 22}
              textAnchor="middle"
              className="fill-white/40"
              style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}
            >
              {p.label}
            </text>
          ))}
        </svg>

        {/* Floating readout — an HTML overlay so it can be styled richly and sit
            above the SVG. Positioned by the active point's fractional
            coordinates. aria-hidden: the dot buttons already announce values. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(shown.x / VBW) * 100}%`,
              top: `${(shown.y / VBH) * 100}%`,
              marginTop: -12,
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

      {/* The accessible, always-there face of the series — a plain readout of
          every point, so the numbers never rest on the picture alone. */}
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {points.map((p, i) => {
          const isActive = active === i
          return (
            <li key={`${uid}-key-${p.label}`}>
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
                <span className="text-xs uppercase tracking-[0.12em] text-white/40">{p.label}</span>
                <span className="font-display text-sm font-bold tabular-nums text-white/85">
                  {valuePrefix}
                  {p.value}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
