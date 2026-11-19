import { useId, useMemo, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

// Beeswarm — the chart that keeps EVERY point. It is the third answer in this
// family to the same question, what does a group of numbers look like. The box
// plot keeps five numbers and throws the rest away; the ridgeline keeps the
// whole smoothed shape and throws the individual readings away; the beeswarm
// throws nothing away — every sample is a dot, and the dots are nudged just far
// enough off the line that none of them overlap, so the cloud they settle into
// IS the distribution. Where a plain strip plot would pile every point on one
// axis and hide the crowd behind a blob, the swarm spreads that crowd sideways
// and the density draws itself: a fat band is where the readings bunch, a lone
// dot out on its own is the outlier the box plot would ring.
//
// It keeps the family's rules. No plotting library — hand-rolled SVG on one
// shared x-axis, one row per group, each row the same swarm so the eye compares
// groups by where their clouds sit and how tall they pile. The single lime does
// all the work: every dot is a soft lime fill, the group MEDIAN a dim lime tick
// behind the cloud (the one line that ties this chart to the box beside it), and
// identity is the row LABEL on the left, never a second hue. Hover or focus a
// dot and it brightens and lifts a readout of its value; hover a row and the
// rest fall back.
//
// The pack is honest: points are sorted along the axis, then each is placed as
// close to its row's centreline as it can go without touching a dot already
// down — the standard beeswarm rule, computed here by hand, so the vertical
// offset carries no meaning of its own beyond keeping the crowd legible. The
// reveal settles the swarm in: every dot springs out from the centreline on a
// stagger. Under reduced motion the swarm is simply present. The SVG carries a
// text summary and the list beneath holds every group's count and median in
// plain words, so the distribution never lives only in the paint.

export interface BeeswarmGroup {
  label: string
  /** Raw samples for this group. Every one is drawn as a dot. */
  values: number[]
}

// A placed dot: its value, its x on the shared axis, and the vertical offset the
// pack gave it (0 is the row centreline, in viewBox units).
interface Dot {
  value: number
  x: number
  dy: number
}

// Linear-interpolated median (type-7) over an already-sorted array — the one
// summary the swarm shares with the box plot.
function medianSorted(sorted: number[]): number {
  const len = sorted.length
  if (len === 0) return NaN
  if (len === 1) return sorted[0]
  const pos = (len - 1) * 0.5
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base])
}

// Drawing surface, in viewBox units. Room on the left for row labels, a hair at
// the bottom for the axis ticks. Height is derived from the group count so the
// swarms never crowd each other.
const VBW = 760
const PAD = { top: 22, right: 30, bottom: 34, left: 112 }
const PLOT_W = VBW - PAD.left - PAD.right
const ROW_STEP = 104
const DOT_R = 3.4
// A hair more than a diameter, so settled dots read as just-touching, never
// fused — the gap the eye needs to count a crowd.
const SPACING = DOT_R * 2 + 0.7

// The honest beeswarm pack. Points are sorted along the axis; each is then
// placed as near its centreline (dy = 0) as it can go without overlapping a dot
// already down. For a new point at x, any settled point within SPACING in x
// forbids a band of dy around its own dy (half-height from the circle-overlap
// test); the candidate dys are 0 and the top and bottom edge of every such band,
// and the one with the smallest |dy| that sits clear of all bands wins. Signs
// alternate naturally because an edge above a cluster and an edge below it are
// both candidates, so the crowd grows symmetrically off the line.
function packSwarm(xs: { value: number; x: number }[]): Dot[] {
  const order = xs.map((p, i) => ({ ...p, i })).sort((a, b) => a.x - b.x)
  const placed: Dot[] = []
  for (const p of order) {
    // Only dots near enough in x can collide.
    const near = placed.filter((q) => Math.abs(q.x - p.x) < SPACING)
    if (near.length === 0) {
      placed.push({ value: p.value, x: p.x, dy: 0 })
      continue
    }
    // Candidate offsets: the line itself, plus the clear edge of each neighbour.
    const candidates = [0]
    for (const q of near) {
      const dx = q.x - p.x
      const half = Math.sqrt(Math.max(0, SPACING * SPACING - dx * dx))
      candidates.push(q.dy + half, q.dy - half)
    }
    let best = Infinity
    let bestDy = 0
    for (const c of candidates) {
      const clear = near.every((q) => {
        const dx = q.x - p.x
        const dy = q.dy - c
        return dx * dx + dy * dy >= SPACING * SPACING - 1e-6
      })
      if (clear && Math.abs(c) < Math.abs(best)) {
        best = c
        bestDy = c
      }
    }
    placed.push({ value: p.value, x: p.x, dy: bestDy })
  }
  return placed
}

interface Row {
  label: string
  index: number
  cy: number
  dots: Dot[]
  median: number
  count: number
  min: number
  max: number
}

export function Beeswarm({
  groups,
  className = '',
  formatX,
  xAxisLabel,
  ariaLabel,
}: {
  groups: BeeswarmGroup[]
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
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [hoverDot, setHoverDot] = useState<{ row: number; i: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { once: true, amount: 0.25 })
  const revealed = reduce || inView

  const fmt = formatX ?? ((v: number) => `${Math.round(v)}`)
  const n = groups.length
  const VBH = PAD.top + n * ROW_STEP + PAD.bottom

  const { rows, domainMin, domainMax, total } = useMemo(() => {
    // One shared scale across every group and every point, so a group whose
    // readings run wider genuinely spreads wider.
    let lo = Infinity
    let hi = -Infinity
    for (const g of groups) {
      for (const v of g.values) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0
      hi = 1
    }
    if (hi === lo) hi = lo + 1
    const padSpan = (hi - lo) * 0.06
    const dMin = lo - padSpan
    const dMax = hi + padSpan
    const xFor = (value: number) => PAD.left + ((value - dMin) / (dMax - dMin)) * PLOT_W

    let count = 0
    const built: Row[] = groups.map((g, index) => {
      const sorted = [...g.values].sort((a, b) => a - b)
      const dots = packSwarm(g.values.map((value) => ({ value, x: xFor(value) })))
      count += g.values.length
      return {
        label: g.label,
        index,
        cy: PAD.top + ROW_STEP / 2 + index * ROW_STEP,
        dots,
        median: medianSorted(sorted),
        count: g.values.length,
        min: sorted[0] ?? NaN,
        max: sorted[sorted.length - 1] ?? NaN,
      }
    })
    return { rows: built, domainMin: dMin, domainMax: dMax, total: count }
  }, [groups])

  const xFor = (value: number) =>
    PAD.left + ((value - domainMin) / (domainMax - domainMin)) * PLOT_W

  const summary =
    ariaLabel ??
    `Beeswarm plot of ${total} points across ${rows.length} groups on one shared axis${
      xAxisLabel ? ` (${xAxisLabel})` : ''
    } — every sample drawn as one dot, nudged clear of its neighbours so the crowd shows the distribution.`

  // Five evenly spaced axis ticks across the domain.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => domainMin + f * (domainMax - domainMin))

  const hovered = hoverDot ? rows[hoverDot.row]?.dots[hoverDot.i] : null

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

          {rows.map((row) => {
            const isActive = activeRow === row.index
            const dimmed = activeRow != null && !isActive
            const medianX = xFor(row.median)
            return (
              <g
                key={`${uid}-row-${row.label}`}
                tabIndex={0}
                role="button"
                aria-label={`${row.label}: ${row.count} points, median ${fmt(
                  row.median,
                )}, from ${fmt(row.min)} to ${fmt(row.max)}`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setActiveRow(row.index)}
                onMouseLeave={() => setActiveRow((cur) => (cur === row.index ? null : cur))}
                onFocus={() => setActiveRow(row.index)}
                onBlur={() => setActiveRow((cur) => (cur === row.index ? null : cur))}
              >
                {/* Row label on the left — identity without a second hue. */}
                <text
                  x={PAD.left - 16}
                  y={row.cy}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ fontSize: 13, fontWeight: isActive ? 700 : 500 }}
                  className={isActive ? 'fill-[#EAFCA0]' : dimmed ? 'fill-white/35' : 'fill-white/70'}
                >
                  {row.label}
                </text>

                {/* The median — a dim lime tick behind the cloud, the one line
                    that ties this chart to the box plot beside it. */}
                <line
                  x1={medianX}
                  x2={medianX}
                  y1={row.cy - 30}
                  y2={row.cy + 30}
                  stroke={isActive ? '#EAFCA0' : '#DCF87C'}
                  strokeOpacity={dimmed ? 0.1 : isActive ? 0.5 : 0.3}
                  strokeWidth={isActive ? 1.8 : 1.4}
                  strokeDasharray="2 3"
                  style={{ transition: 'stroke-opacity 0.2s ease' }}
                />

                {/* The swarm — every sample, one dot, packed clear of its
                    neighbours. */}
                {row.dots.map((d, i) => {
                  const isHot = hoverDot?.row === row.index && hoverDot?.i === i
                  return (
                    <motion.circle
                      key={`${uid}-dot-${row.label}-${i}`}
                      cx={d.x}
                      r={isHot ? DOT_R + 1.4 : DOT_R}
                      fill={isHot || isActive ? '#EAFCA0' : '#DCF87C'}
                      fillOpacity={dimmed ? 0.16 : isHot ? 1 : 0.62}
                      stroke={isHot ? '#EAFCA0' : 'none'}
                      strokeOpacity={isHot ? 0.5 : 0}
                      strokeWidth={isHot ? 5 : 0}
                      onMouseEnter={() => setHoverDot({ row: row.index, i })}
                      onMouseLeave={() =>
                        setHoverDot((cur) =>
                          cur && cur.row === row.index && cur.i === i ? null : cur,
                        )
                      }
                      initial={false}
                      animate={{
                        cy: revealed ? row.cy + d.dy : row.cy,
                        opacity: revealed ? 1 : 0,
                        scale: revealed ? 1 : 0,
                      }}
                      transition={{
                        duration: reduce ? 0 : 0.5,
                        delay: reduce ? 0 : 0.08 + row.index * 0.06 + Math.min(i, 40) * 0.006,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{
                        transformBox: 'fill-box' as never,
                        transformOrigin: 'center',
                        transition: 'fill-opacity 0.15s ease, r 0.12s ease',
                      }}
                    />
                  )
                })}
              </g>
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

        {/* Floating readout — anchored above the hovered dot. */}
        {hovered && hoverDot && rows[hoverDot.row] && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10"
            style={{
              left: `${(hovered.x / VBW) * 100}%`,
              top: `${((rows[hoverDot.row].cy + hovered.dy - DOT_R) / VBH) * 100}%`,
              transform: 'translate(-50%, -112%)',
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
              <div className="font-display text-sm font-bold leading-none tracking-tight text-[#DCF87C]">
                {fmt(hovered.value)}
              </div>
              <div className="mt-1.5 text-[11px] leading-none text-white/60">
                {rows[hoverDot.row].label}
              </div>
            </div>
          </div>
        )}
      </div>

      {xAxisLabel && (
        <p className="mt-1 text-center text-xs uppercase tracking-[0.2em] text-white/35">{xAxisLabel}</p>
      )}

      {/* The accessible, always-there face of the figure — every group's count
          and median in plain words, each lifting its swarm. */}
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {rows.map((row) => {
          const isActive = activeRow === row.index
          return (
            <li key={`${uid}-key-${row.label}`}>
              <button
                type="button"
                onMouseEnter={() => setActiveRow(row.index)}
                onMouseLeave={() => setActiveRow((cur) => (cur === row.index ? null : cur))}
                onFocus={() => setActiveRow(row.index)}
                onBlur={() => setActiveRow((cur) => (cur === row.index ? null : cur))}
                className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span className="text-sm text-white/85">{row.label}</span>
                <span className="text-xs tabular-nums text-[#DCF87C]">{fmt(row.median)}</span>
                <span className="text-xs tabular-nums text-white/40">n&thinsp;=&thinsp;{row.count}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
