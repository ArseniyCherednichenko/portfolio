import { useId, useMemo, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

// Ridgeline — the chart family's distribution-SHAPE shape, and the one none of
// the others are. Every chart before it reduces a group to a single number per
// mark: the bar a height, the donut a share, the candlestick four prices, the
// bump chart an order, the scatter a point. A ridgeline keeps the whole SHAPE —
// a full distribution per row, several of them stacked and deliberately
// OVERLAPPING so the eye compares one profile against the next: where each one
// peaks, how wide it spreads, whether it runs to one hump or two. It is the
// Joy Division "Unknown Pleasures" figure, and its subject is the silhouette,
// not any single value.
//
// It keeps the family's rules. No plotting library — hand-rolled SVG: a shared
// x-axis, one smooth Catmull-Rom area per row, the rows marching down the field
// a fixed step apart while each crest rises tall enough to break into the row
// above. The overlap is the whole point, so each ridge is filled OPAQUE with the
// page's own dark so it cleanly occludes the one behind — exactly how the
// original figure reads — and the one lime lives in the crest line. It keeps the
// single-hue discipline where a ridgeline usually breaks it (the temptation is a
// colour per row): identity is told by the row LABEL on the left, and the lime
// is STEPPED only by DEPTH — the front ridge brightest, each one behind a touch
// dimmer — so hue encodes nothing but which sits in front.
//
// The reveal is a rise: every ridge grows up out of its own baseline, back to
// front, like a signal coming in. Under reduced motion the ridges are simply
// present at full height. It is quietly interactive: hover or focus a row (its
// crest and its row in the list beneath are real targets) and that ridge lifts
// to full lime, thickens, and warms with a faint fill while the rest fall back,
// a readout naming where its peak falls and how tall it stands. The SVG carries
// a full text summary, and the list beneath holds the same facts in plain words.

export interface RidgeRow {
  label: string
  /** Non-negative samples at equal x positions, left to right. All rows should
   * share the same length (the same x-axis). Compared on one shared scale, so a
   * genuinely busier row rises visibly higher. */
  density: number[]
}

// The drawing surface, in viewBox units. Room on the left for the row labels,
// headroom at the top for the back ridge's crest, a hair at the bottom for the
// axis ticks. VBH is derived from the row count so the field always fits.
const VBW = 760
const PAD = { top: 20, right: 28, bottom: 30, left: 96 }
const PLOT_W = VBW - PAD.left - PAD.right
// Vertical rhythm: ROW_STEP between adjacent baselines, AMP the full crest
// height. AMP > 2·ROW_STEP so a tall ridge breaks past two rows above it.
const ROW_STEP = 34
const AMP = 88

interface Ridge extends RidgeRow {
  index: number
  /** Baseline y in viewBox units (front rows sit lower / later). */
  baseline: number
  /** Points along the crest, in viewBox units. */
  pts: { x: number; y: number }[]
  /** Smooth path of the crest line only (no close). */
  crest: string
  /** Closed area path: crest, down to baseline, back, closed. */
  area: string
  /** Index of the peak sample. */
  peakIndex: number
  /** 0..1 position of the peak along the axis. */
  peakFrac: number
  /** This row's max relative to the tallest row, 0..1. */
  rel: number
  /** 0 = frontmost (brightest), 1 = backmost (dimmest). */
  depth: number
}

// Catmull-Rom through the points as cubic beziers — a crest that flows rather
// than folds, the same smoothing the area chart uses.
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return d
}

export function Ridgeline({
  rows,
  className = '',
  formatX,
  xAxisLabel,
  ariaLabel,
}: {
  rows: RidgeRow[]
  className?: string
  /** Formats a 0..1 position along the axis into a label (ticks + the peak
   * readout). Defaults to a percentage. */
  formatX?: (frac: number) => string
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

  const fmt = formatX ?? ((f: number) => `${Math.round(f * 100)}%`)
  const n = rows.length

  const VBH = PAD.top + AMP + (n - 1) * ROW_STEP + PAD.bottom

  const ridges = useMemo<Ridge[]>(() => {
    if (n === 0) return []
    // One shared scale across every row: divide by the single tallest sample so
    // a busier row genuinely rises higher — the two axes tell one truth.
    let globalMax = 0
    for (const r of rows) for (const v of r.density) if (v > globalMax) globalMax = v
    if (globalMax <= 0) globalMax = 1

    const xFor = (i: number, len: number) =>
      len <= 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i / (len - 1)) * PLOT_W

    return rows.map((r, ri) => {
      const baseline = PAD.top + AMP + ri * ROW_STEP
      const len = r.density.length
      let peakIndex = 0
      for (let i = 1; i < len; i++) if (r.density[i] > r.density[peakIndex]) peakIndex = i
      const rowMax = len ? r.density[peakIndex] : 0
      const pts = r.density.map((v, i) => ({
        x: xFor(i, len),
        y: baseline - Math.max(0, v / globalMax) * AMP,
      }))
      const crest = smooth(pts)
      const last = pts[pts.length - 1]
      const first = pts[0]
      const area = `${crest} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
      return {
        ...r,
        index: ri,
        baseline,
        pts,
        crest,
        area,
        peakIndex,
        peakFrac: len <= 1 ? 0.5 : peakIndex / (len - 1),
        rel: rowMax / globalMax,
        depth: n === 1 ? 0 : (n - 1 - ri) / (n - 1),
      }
    })
  }, [rows, n])

  const shown = active != null ? ridges[active] : null

  const tallest = ridges.reduce<Ridge | null>((best, r) => (!best || r.rel > best.rel ? r : best), null)
  const summary =
    ariaLabel ??
    `Ridgeline chart of ${n} distributions sharing one axis${
      xAxisLabel ? ` (${xAxisLabel})` : ''
    }.${tallest ? ` The tallest, ${tallest.label}, peaks around ${fmt(tallest.peakFrac)}.` : ''}`

  // Depth stroke opacity: frontmost brightest, each one behind a step dimmer.
  const crestOpacity = (r: Ridge) => 0.9 - r.depth * 0.5

  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          <defs>
            <linearGradient id={`${uid}-wash`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DCF87C" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#DCF87C" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* The ridges, back to front, so a front ridge's opaque fill cleanly
              occludes the crest behind it — the whole point of the figure. */}
          {ridges.map((r) => {
            const isActive = active === r.index
            const dimmed = active != null && !isActive
            return (
              <motion.g
                key={`${uid}-ridge-${r.label}`}
                tabIndex={0}
                role="button"
                aria-label={`${r.label}: peaks around ${fmt(r.peakFrac)}, ${Math.round(
                  r.rel * 100,
                )} percent of the tallest`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setActive(r.index)}
                onMouseLeave={() => setActive((cur) => (cur === r.index ? null : cur))}
                onFocus={() => setActive(r.index)}
                onBlur={() => setActive((cur) => (cur === r.index ? null : cur))}
                initial={false}
                animate={{ scaleY: revealed ? 1 : 0 }}
                transition={{
                  duration: reduce ? 0 : 0.7,
                  delay: reduce ? 0 : 0.08 + r.depth * 0.55,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ transformOrigin: `0 ${r.baseline}px`, transformBox: 'view-box' as never }}
              >
                {/* Opaque fill: the occluder. Catches the pointer. */}
                <path d={r.area} fill="#0a0a0b" stroke="none" style={{ pointerEvents: 'auto' }} />
                {/* Warm wash, only on the lifted ridge. */}
                <path
                  d={r.area}
                  fill={`url(#${uid}-wash)`}
                  stroke="none"
                  style={{ pointerEvents: 'none', opacity: isActive ? 1 : 0, transition: 'opacity 0.2s ease' }}
                />
                {/* The crest line — where the one lime lives. */}
                <path
                  d={r.crest}
                  fill="none"
                  stroke={isActive ? '#EAFCA0' : '#DCF87C'}
                  strokeWidth={isActive ? 2.6 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={dimmed ? 0.14 : isActive ? 1 : crestOpacity(r)}
                  style={{
                    pointerEvents: 'none',
                    transition: 'stroke 0.15s ease, stroke-width 0.15s ease, stroke-opacity 0.2s ease',
                  }}
                />
                {/* Row label on the left — identity without a second hue. Sits
                    left of the plot, so a front ridge never covers it. */}
                <text
                  x={PAD.left - 14}
                  y={r.baseline}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ fontSize: 13, fontWeight: isActive ? 700 : 500 }}
                  className={isActive ? 'fill-[#EAFCA0]' : dimmed ? 'fill-white/35' : 'fill-white/70'}
                >
                  {r.label}
                </text>
              </motion.g>
            )
          })}

          {/* Axis ticks, drawn last so they read over the front ridge's fill. */}
          {ticks.map((f) => {
            const x = PAD.left + f * PLOT_W
            return (
              <text
                key={`${uid}-tick-${f}`}
                x={x}
                y={VBH - PAD.bottom + 20}
                textAnchor="middle"
                className="fill-white/40"
                style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
              >
                {fmt(f)}
              </text>
            )
          })}
        </svg>

        {/* Floating readout — anchored above the active ridge's peak. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10"
            style={{
              left: `${(shown.pts[shown.peakIndex].x / VBW) * 100}%`,
              top: `${(shown.pts[shown.peakIndex].y / VBH) * 100}%`,
              transform: 'translate(-50%, -112%)',
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
              <div className="font-display text-sm font-bold leading-none tracking-tight text-[#DCF87C]">
                {shown.label}
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] leading-none text-white/75 tabular-nums">
                <span>peak {fmt(shown.peakFrac)}</span>
                <span className="text-white/35">·</span>
                <span className="font-semibold text-white/90">{Math.round(shown.rel * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {xAxisLabel && (
        <p className="mt-1 text-center text-xs uppercase tracking-[0.2em] text-white/35">{xAxisLabel}</p>
      )}

      {/* The accessible, always-there face of the figure — every row's peak and
          relative height as plain words, sorted tallest first, each lifting its
          ridge. The distribution never lives only in the picture. */}
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {[...ridges]
          .sort((a, b) => b.rel - a.rel)
          .map((r) => {
            const isActive = active === r.index
            return (
              <li key={`${uid}-key-${r.label}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(r.index)}
                  onMouseLeave={() => setActive((cur) => (cur === r.index ? null : cur))}
                  onFocus={() => setActive(r.index)}
                  onBlur={() => setActive((cur) => (cur === r.index ? null : cur))}
                  className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                    isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="text-sm text-white/85">{r.label}</span>
                  <span className="text-xs tabular-nums text-[#DCF87C]">{fmt(r.peakFrac)}</span>
                  <span className="text-xs tabular-nums text-white/40">{Math.round(r.rel * 100)}%</span>
                </button>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
