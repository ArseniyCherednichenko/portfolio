import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Candlestick — the chart family's thirteenth shape, and the one none of the
// others can be: the four-values-at-once one. Every chart before it reads a
// single number per mark — the bar a height, the area a point on a curve, the
// donut a share, the gauge a proportion. A candlestick reads four at every
// mark: where a period opened, where it closed, and the high and low it touched
// in between. That is its whole reason to exist — no other shape here can carry
// an open, a high, a low, and a close in one glyph and still be read at a
// glance.
//
// It keeps the family's rules. No plotting library: SVG rects and hairlines, a
// computed round-number axis, and one Framer Motion move. And it keeps the
// SINGLE-hue discipline in the one place a candlestick usually breaks it. The
// convention is red-down / green-up — two colours doing one job. Here direction
// is told by FILL, not hue: a period that closed up is a solid lime body, a
// period that closed down is a hollow body — a lime outline over the dark
// ground. So the site's one lime carries both the "up or down" and the "how
// far", and colour never has to mean two things at once. A reader who cannot
// tell the two apart still has the per-candle readout and the axis.
//
// The reveal is a grow-out: each candle's wick and body scale from its own
// centre-price to full extent, staggered left-to-right so the series plots
// itself like a tape printing. Under reduced motion every candle is simply
// present at full extent from the first frame. It is quietly interactive: hover
// or focus a candle (each is a real button over its whole column) and a readout
// floats above it naming all four prices while a guide drops to the axis. The
// SVG carries a full text summary and a visible O/H/L/C list sits beneath, so
// the numbers never rest on the picture alone.

export interface Candle {
  label: string
  open: number
  high: number
  low: number
  close: number
}

// The drawing surface, in viewBox units. A wide 2:1 field so a run of candles
// breathes, with padding for the y-axis price labels (left), the x-axis period
// labels (bottom), and the readout that floats above the tallest wick (top).
const VBW = 720
const VBH = 360
const PAD = { top: 34, right: 12, bottom: 34, left: 42 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

/**
 * Round a raw [min, max] price span out to friendly axis bounds and hand back
 * the tick values that divide it evenly, so the gridlines land on round numbers
 * a reader can count by instead of wherever the data happened to run. Unlike a
 * bar axis this does NOT force zero — prices float, so the frame hugs the data
 * with a little headroom on each side. Aims for roughly four steps.
 */
function niceRange(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  if (max <= min) return { lo: min - 1, hi: max + 1, ticks: [min - 1, max + 1] }
  const span = max - min
  const rough = span / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = mag * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v))
  return { lo, hi, ticks }
}

interface Bar extends Candle {
  /** Grid index (left-to-right), preserving the caller's order. */
  index: number
  /** True when the period closed at or above its open — a solid body. */
  up: boolean
  /** Centre of the column, in viewBox units. */
  cx: number
  /** Half the body width. */
  hw: number
  /** Pixel y of each price. */
  yOpen: number
  yClose: number
  yHigh: number
  yLow: number
  /** Body top edge and height (always positive). */
  bodyY: number
  bodyH: number
  /** Fraction of viewBox width, for the readout. */
  fx: number
}

export function Candlestick({
  data,
  unit,
  valuePrefix = '',
  className = '',
  ariaLabel,
}: {
  data: Candle[]
  /** Optional short noun shown after a price in the readout, e.g. "index". */
  unit?: string
  /** Optional string shown before a price, e.g. "$". */
  valuePrefix?: string
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { bars, ticks, lo, hi } = useMemo(() => {
    if (data.length === 0) {
      return { bars: [] as Bar[], ticks: [0], lo: 0, hi: 1 }
    }
    const min = Math.min(...data.map((d) => d.low))
    const max = Math.max(...data.map((d) => d.high))
    const { lo: rLo, hi: rHi, ticks: tk } = niceRange(min, max)
    const span = rHi - rLo || 1
    const yFor = (v: number) => PAD.top + (1 - (v - rLo) / span) * PLOT_H
    const n = data.length
    const band = PLOT_W / n
    // The body takes a little under half its band, so the gap between candles is
    // clear but each still reads as a substantial block. Capped so a short run
    // does not grow slabs.
    const hw = Math.min(band * 0.28, 22)
    const rows: Bar[] = data.map((d, i) => {
      const cx = PAD.left + band * (i + 0.5)
      const yOpen = yFor(d.open)
      const yClose = yFor(d.close)
      const up = d.close >= d.open
      const bodyTop = Math.min(yOpen, yClose)
      // A doji (open == close) would be a zero-height body; give it a hairline
      // so the mark never vanishes.
      const bodyH = Math.max(Math.abs(yClose - yOpen), 1.5)
      return {
        ...d,
        index: i,
        up,
        cx,
        hw,
        yOpen,
        yClose,
        yHigh: yFor(d.high),
        yLow: yFor(d.low),
        bodyY: bodyTop,
        bodyH,
        fx: (cx - PAD.left) / PLOT_W,
      }
    })
    return { bars: rows, ticks: tk, lo: rLo, hi: rHi }
  }, [data])

  const yFor = (v: number) => {
    const span = hi - lo || 1
    return PAD.top + (1 - (v - lo) / span) * PLOT_H
  }
  const shown = active != null ? bars[active] : null

  const first = data[0]
  const last = data[data.length - 1]
  const net = first && last ? last.close - first.open : 0
  const summary =
    ariaLabel ??
    `Candlestick chart of ${data.length} periods${unit ? ` of ${unit}` : ''}. ` +
      `Opened at ${valuePrefix}${first?.open ?? 0} on ${first?.label ?? 'start'}, ` +
      `closed at ${valuePrefix}${last?.close ?? 0} on ${last?.label ?? 'end'} — ` +
      `a net ${net >= 0 ? 'gain' : 'loss'} of ${valuePrefix}${Math.abs(net).toFixed(2)}.`

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Gridlines and price labels — round numbers off the nice range, so a
              reader can place any candle against a value without a tooltip. */}
          {ticks.map((t) => {
            const y = yFor(t)
            return (
              <g key={`${uid}-tick-${t}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={VBW - PAD.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
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
                  {valuePrefix}
                  {t}
                </text>
              </g>
            )
          })}

          {/* The candles. Each is one <g> scaled from its centre-price so the
              wick and body grow out together on reveal. */}
          {bars.map((b, i) => {
            const isActive = active === i
            const origin = (b.yHigh + b.yLow) / 2
            return (
              <motion.g
                key={`${uid}-c-${b.label}`}
                initial={reduce ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
                whileInView={reduce ? undefined : { scaleY: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.5,
                  delay: reduce ? 0 : 0.15 + b.fx * 0.9,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ transformOrigin: `${b.cx}px ${origin}px` }}
              >
                {/* Wick: high to low, one hairline through the centre. */}
                <line
                  x1={b.cx}
                  y1={b.yHigh}
                  x2={b.cx}
                  y2={b.yLow}
                  stroke="#DCF87C"
                  strokeWidth={isActive ? 2 : 1.4}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-width 0.15s ease' }}
                />
                {/* Body: open to close. Up closes solid; down stays hollow — the
                    single-hue way to tell direction without a second colour. */}
                <rect
                  x={b.cx - b.hw}
                  y={b.bodyY}
                  width={b.hw * 2}
                  height={b.bodyH}
                  rx={1.5}
                  fill={b.up ? (isActive ? '#EAFCA0' : '#DCF87C') : '#0a0a0a'}
                  stroke="#DCF87C"
                  strokeWidth={b.up ? 0 : 1.6}
                  style={{ transition: 'fill 0.15s ease' }}
                />
              </motion.g>
            )
          })}

          {/* Hit targets and guide — a transparent rect over each whole column so
              the candle is easy to reach by pointer or keyboard. Drawn last so it
              sits above the marks. */}
          {shown && (
            <line
              x1={shown.cx}
              y1={PAD.top}
              x2={shown.cx}
              y2={PAD.top + PLOT_H}
              stroke="rgba(220,248,124,0.28)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          )}
          {bars.map((b, i) => {
            const band = PLOT_W / bars.length
            return (
              <rect
                key={`${uid}-hit-${b.label}`}
                x={b.cx - band / 2}
                y={PAD.top}
                width={band}
                height={PLOT_H}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${b.label}: open ${valuePrefix}${b.open}, high ${valuePrefix}${b.high}, low ${valuePrefix}${b.low}, close ${valuePrefix}${b.close}${
                  unit ? ` ${unit}` : ''
                } — ${b.up ? 'up' : 'down'}`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
              />
            )
          })}

          {/* X-axis period labels. */}
          {bars.map((b) => (
            <text
              key={`${uid}-lbl-${b.label}`}
              x={b.cx}
              y={PAD.top + PLOT_H + 22}
              textAnchor="middle"
              className="fill-white/40"
              style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}
            >
              {b.label}
            </text>
          ))}
        </svg>

        {/* Floating readout — an HTML overlay above the hovered candle's high,
            listing all four prices. aria-hidden: the hit rects announce them. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(shown.cx / VBW) * 100}%`,
              top: `${(shown.yHigh / VBH) * 100}%`,
              marginTop: -10,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <span className="font-display text-sm font-bold leading-none tracking-tight text-[#DCF87C]">
                  {shown.label}
                </span>
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.1em] ${
                    shown.up ? 'bg-[#DCF87C]/20 text-[#DCF87C]' : 'border border-[#DCF87C]/40 text-[#DCF87C]/70'
                  }`}
                >
                  {shown.up ? 'Up' : 'Down'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-x-2.5 tabular-nums">
                {(
                  [
                    ['O', shown.open],
                    ['H', shown.high],
                    ['L', shown.low],
                    ['C', shown.close],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[9px] uppercase leading-none tracking-[0.1em] text-white/35">{k}</div>
                    <div className="mt-0.5 text-[11px] font-semibold leading-none text-white/85">
                      {valuePrefix}
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The accessible, always-there face of the series — every period's four
          prices as a plain list, so the numbers never live only in the picture. */}
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
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
                className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span className="text-xs uppercase tracking-[0.12em] text-white/40">{b.label}</span>
                <span
                  className={`inline-block h-2 w-2 rounded-[2px] ${
                    b.up ? 'bg-[#DCF87C]' : 'border border-[#DCF87C]'
                  }`}
                  aria-hidden
                />
                <span className="font-display text-sm font-bold tabular-nums text-white/85">
                  {valuePrefix}
                  {b.close}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
