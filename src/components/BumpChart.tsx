import { useId, useMemo, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

// BumpChart — the chart family's order-over-time shape, and the one none of the
// others can be. Every chart before it answers "how much" or "what share": the
// bar a height, the area a line off a floor, the donut a slice, the candlestick
// four prices, the stream many quantities flowing together. A bump chart throws
// the amounts away and keeps only the ORDER — who is first, who is third, who
// overtakes whom between one period and the next. Its whole subject is the
// crossing: two lines that swap rows are two contenders that traded places, and
// the eye reads the race from the tangle, not from any single value.
//
// It keeps the family's rules. No plotting library — hand-rolled SVG: a row per
// rank, a column per period, and each contender a smooth polyline threading its
// rank at every period, flat at the nodes and curving through the gaps so a swap
// reads as a clean X. And it keeps the single-hue discipline where a bump chart
// usually breaks it: the convention is a colour per line, a dozen hues doing one
// job. Here identity is told by POSITION and LABEL, and the one lime is STEPPED
// by where a line finishes — the leader brightest, each rank below it a step
// dimmer — so the hue encodes standing, never identity, and a reader who cannot
// tell two lines apart still has the end labels, the readout, and the list.
//
// The reveal is a left-to-right draw: every line plots itself across the field
// at once, like a race running, the crossings appearing as they happen. Under
// reduced motion the lines are simply present, drawn full from the first frame.
// It is quietly interactive: hover or focus a contender (its end label and its
// row in the list beneath are real buttons) and that line lifts to full lime and
// thickens while the rest fall back, a readout naming where it started, where it
// ended, and how far it climbed or slid. The SVG carries a full text summary.

export interface BumpSeries {
  label: string
  /** Rank at each period, 1 = top. Length must match the periods array. At any
   * one period the ranks across series should be a permutation of 1..N, so no
   * two lines ever share a row in the same column. */
  ranks: number[]
}

// The drawing surface, in viewBox units. A wide field so a run of periods
// breathes, with room on the left for the rank labels, on the right for the
// contender labels the lines end at, and along the bottom for the period labels.
const VBW = 760
const VBH = 380
const PAD = { top: 26, right: 146, bottom: 34, left: 46 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
const ordinal = (r: number) => ORDINAL[r] ?? `${r}th`

interface Line extends BumpSeries {
  index: number
  /** Points along the line, one per period, in viewBox units. */
  pts: { x: number; y: number; rank: number }[]
  /** Smooth SVG path through the points. */
  d: string
  startRank: number
  endRank: number
  /** Positive = climbed (ended higher than it started). */
  net: number
  /** 0..1 brightness key, 0 = leader (brightest), 1 = last (dimmest). */
  dim: number
}

export function BumpChart({
  series,
  periods,
  className = '',
  ariaLabel,
}: {
  series: BumpSeries[]
  /** Column labels, left to right, e.g. rounds or months. */
  periods: string[]
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // Drive the whole reveal from one in-view trigger, so the lines draw when the
  // chart arrives and — unlike a one-shot whileInView — the opacity stays
  // reactive afterwards, letting a hover dim the rest and lift the active line.
  const inView = useInView(rootRef, { once: true, amount: 0.3 })
  const revealed = reduce || inView

  const n = series.length
  const t = periods.length

  const lines = useMemo<Line[]>(() => {
    if (n === 0 || t === 0) return []
    const xFor = (i: number) => (t === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i / (t - 1)) * PLOT_W)
    // One row per rank; rank 1 sits at the top band's centre.
    const yFor = (rank: number) => PAD.top + ((rank - 0.5) / n) * PLOT_H
    return series.map((s, si) => {
      const pts = s.ranks.map((rank, i) => ({ x: xFor(i), y: yFor(rank), rank }))
      // A smooth path that runs horizontal at each node and curves between, so
      // a rank swap reads as a clean S rather than a sharp zig. Control points
      // sit at the horizontal midpoint of each gap, level with the two ends.
      let d = `M ${pts[0].x} ${pts[0].y}`
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const xm = (a.x + b.x) / 2
        d += ` C ${xm} ${a.y} ${xm} ${b.y} ${b.x} ${b.y}`
      }
      const startRank = s.ranks[0]
      const endRank = s.ranks[s.ranks.length - 1]
      return {
        ...s,
        index: si,
        pts,
        d,
        startRank,
        endRank,
        net: startRank - endRank,
        dim: n === 1 ? 0 : (endRank - 1) / (n - 1),
      }
    })
  }, [series, periods, n, t])

  // Draw dimmer lines first so brighter leaders sit on top of the stack.
  const drawOrder = useMemo(() => [...lines].sort((a, b) => b.dim - a.dim), [lines])

  const shown = active != null ? lines[active] : null

  const rows = Array.from({ length: n }, (_, i) => i + 1)

  const leader = lines.find((l) => l.endRank === 1)
  const climber = lines.reduce<Line | null>((best, l) => (!best || l.net > best.net ? l : best), null)
  const summary =
    ariaLabel ??
    `Bump chart ranking ${n} contenders across ${t} periods, from ${periods[0]} to ${
      periods[t - 1]
    }. ${leader ? `${leader.label} finishes first` : ''}${
      climber && climber.net > 0
        ? `; ${climber.label} climbs the most, from ${ordinal(climber.startRank)} to ${ordinal(
            climber.endRank,
          )}`
        : ''
    }.`

  // Base stroke opacity from finishing rank: leader brightest, last dimmest.
  const strokeOpacity = (l: Line) => 0.9 - l.dim * 0.55

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Rank rows — one faint gridline and an ordinal label per row, so a
              reader can place any node against its standing without a tooltip. */}
          {rows.map((r) => {
            const y = PAD.top + ((r - 0.5) / n) * PLOT_H
            return (
              <g key={`${uid}-row-${r}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + PLOT_W}
                  y2={y}
                  stroke="rgba(255,255,255,0.055)"
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
                  {ordinal(r)}
                </text>
              </g>
            )
          })}

          {/* The contender lines. Dimmer ones drawn first so leaders sit on top;
              each draws itself left-to-right on reveal. */}
          {drawOrder.map((l) => {
            const isActive = active === l.index
            const dimmed = active != null && !isActive
            return (
              <motion.path
                key={`${uid}-line-${l.label}`}
                d={l.d}
                fill="none"
                stroke={isActive ? '#EAFCA0' : '#DCF87C'}
                strokeWidth={isActive ? 3.4 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{
                  pathLength: revealed ? 1 : 0,
                  opacity: !revealed ? 0 : dimmed ? 0.12 : isActive ? 1 : strokeOpacity(l),
                }}
                transition={{
                  pathLength: { duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.1 + l.index * 0.08, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: reduce ? 0 : 0.25 },
                }}
                style={{ transition: 'stroke 0.15s ease, stroke-width 0.15s ease' }}
              />
            )
          })}

          {/* Nodes — a dot at every period for every line, so each stop on the
              journey is markable. The active line's dots grow. */}
          {lines.map((l) => {
            const isActive = active === l.index
            const dimmed = active != null && !isActive
            return (
              <g key={`${uid}-nodes-${l.label}`} style={{ opacity: dimmed ? 0.12 : 1 }}>
                {l.pts.map((p, i) => (
                  <motion.circle
                    key={`${uid}-node-${l.label}-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={isActive ? 4.6 : 3.2}
                    fill={isActive ? '#EAFCA0' : '#0a0a0a'}
                    stroke="#DCF87C"
                    strokeWidth={1.6}
                    initial={false}
                    animate={{ opacity: revealed ? 1 : 0, scale: revealed ? 1 : 0 }}
                    transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.3 + l.index * 0.08 + (i / Math.max(1, t)) * 0.9 }}
                    style={{ transition: 'r 0.15s ease, fill 0.15s ease' }}
                  />
                ))}
              </g>
            )
          })}

          {/* End labels — each line ends in its own name, the single-hue way to
              tell the contenders apart. Real buttons: hover or focus to lift the
              line. Placed at the line's finishing row. */}
          {lines.map((l) => {
            const isActive = active === l.index
            const dimmed = active != null && !isActive
            const last = l.pts[l.pts.length - 1]
            return (
              <g
                key={`${uid}-end-${l.label}`}
                tabIndex={0}
                role="button"
                aria-label={`${l.label}: started ${ordinal(l.startRank)}, finished ${ordinal(l.endRank)}${
                  l.net > 0 ? `, climbed ${l.net}` : l.net < 0 ? `, slid ${-l.net}` : ', held'
                }`}
                className="cursor-pointer focus:outline-none"
                style={{ opacity: dimmed ? 0.3 : 1 }}
                onMouseEnter={() => setActive(l.index)}
                onMouseLeave={() => setActive((cur) => (cur === l.index ? null : cur))}
                onFocus={() => setActive(l.index)}
                onBlur={() => setActive((cur) => (cur === l.index ? null : cur))}
              >
                <line
                  x1={last.x}
                  y1={last.y}
                  x2={last.x + 10}
                  y2={last.y}
                  stroke="#DCF87C"
                  strokeWidth={1.4}
                  strokeOpacity={isActive ? 1 : strokeOpacity(l)}
                />
                <text
                  x={last.x + 15}
                  y={last.y}
                  dominantBaseline="middle"
                  style={{ fontSize: 13, fontWeight: isActive ? 700 : 500 }}
                  className={isActive ? 'fill-[#EAFCA0]' : 'fill-white/70'}
                >
                  {l.label}
                </text>
              </g>
            )
          })}

          {/* Period labels along the bottom. */}
          {periods.map((p, i) => {
            const x = t === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i / (t - 1)) * PLOT_W
            return (
              <text
                key={`${uid}-period-${p}-${i}`}
                x={x}
                y={PAD.top + PLOT_H + 22}
                textAnchor="middle"
                className="fill-white/40"
                style={{ fontSize: 13 }}
              >
                {p}
              </text>
            )
          })}
        </svg>

        {/* Floating readout — anchored above the active line's finishing node,
            naming its journey. aria-hidden: the end-label buttons announce it. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-y-full"
            style={{
              left: `${(shown.pts[shown.pts.length - 1].x / VBW) * 100}%`,
              top: `${(shown.pts[shown.pts.length - 1].y / VBH) * 100}%`,
              transform: 'translate(-100%, -120%)',
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
              <div className="font-display text-sm font-bold leading-none tracking-tight text-[#DCF87C]">
                {shown.label}
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] leading-none text-white/75 tabular-nums">
                <span>{ordinal(shown.startRank)}</span>
                <span className="text-white/35">to</span>
                <span className="font-semibold text-white/90">{ordinal(shown.endRank)}</span>
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${
                    shown.net > 0
                      ? 'bg-[#DCF87C]/20 text-[#DCF87C]'
                      : shown.net < 0
                        ? 'border border-[#DCF87C]/40 text-[#DCF87C]/70'
                        : 'text-white/40'
                  }`}
                >
                  {shown.net > 0 ? `+${shown.net}` : shown.net < 0 ? `${shown.net}` : 'held'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The accessible, always-there face of the race — every contender's start
          and finish as a plain list, so the standings never live only in the
          picture. Each row lifts its line. */}
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {[...lines]
          .sort((a, b) => a.endRank - b.endRank)
          .map((l) => {
            const isActive = active === l.index
            return (
              <li key={`${uid}-key-${l.label}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(l.index)}
                  onMouseLeave={() => setActive((cur) => (cur === l.index ? null : cur))}
                  onFocus={() => setActive(l.index)}
                  onBlur={() => setActive((cur) => (cur === l.index ? null : cur))}
                  className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                    isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="font-display text-sm font-bold tabular-nums text-[#DCF87C]">
                    {ordinal(l.endRank)}
                  </span>
                  <span className="text-sm text-white/85">{l.label}</span>
                  <span className="text-xs tabular-nums text-white/40">
                    {l.net > 0 ? `+${l.net}` : l.net < 0 ? l.net : '—'}
                  </span>
                </button>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
