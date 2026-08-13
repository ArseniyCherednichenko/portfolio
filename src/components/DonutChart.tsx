import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// DonutChart — the site's first piece of data-viz, and the same "made, not
// assembled" thesis applied to a chart: no charting library, just SVG arcs and
// one Framer Motion draw.
//
// It is a magnitude chart, so it stays in a single hue: the segments carry ONE
// lime, stepped darker by rank, largest slice brightest. Colour never has to
// tell two categories apart on its own — the legend names every slice with its
// own swatch, and hovering (or focusing) a legend row lifts its arc and pulls
// the label into the middle. So identity lives in text, and the lime ramp only
// encodes "how big", which is exactly what a reader should be able to feel.
//
// The arcs draw themselves in on scroll, one after the next, each an SVG circle
// whose visible fraction is animated through `pathLength` — the same primitive
// the DrawSVG component uses. Under reduced motion every arc is simply present
// at full sweep, no draw, and the count in the centre is set outright.

export interface DonutDatum {
  label: string
  value: number
}

// Geometry, in the 100x100 viewBox. A donut, so a fat stroke on a hairline-thin
// circle rather than a filled pie — it leaves room for a live figure in the eye.
const R = 38
const STROKE = 13
const STROKE_ACTIVE = 16
// A whisper of a gap between slices so neighbouring arcs read as separate marks,
// not one continuous ring. Expressed as a fraction of the full turn (~1.5deg).
const GAP = 1.5 / 360

/**
 * One lime, stepped by rank. Rank 0 (the largest slice) is full-strength lime;
 * each subsequent slice steps down in opacity over the dark ground, so the ring
 * reads lightest-where-largest. A single-hue sequential ramp — never a rainbow.
 */
function limeFor(rank: number, count: number): string {
  if (count <= 1) return 'rgba(220, 248, 124, 1)'
  const t = rank / (count - 1)
  const alpha = 1 - t * 0.6 // 1.0 down to 0.4
  return `rgba(220, 248, 124, ${alpha.toFixed(3)})`
}

interface Segment extends DonutDatum {
  frac: number
  start: number
  rank: number
  color: string
  pct: number
}

export function DonutChart({
  data,
  unit,
  centerLabel = 'total',
  className = '',
  ariaLabel,
}: {
  data: DonutDatum[]
  /** Optional short noun for the centre figure, e.g. "components". */
  unit?: string
  /** Small caption under the centre total when nothing is highlighted. */
  centerLabel?: string
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { segments, total } = useMemo(() => {
    const positive = data.filter((d) => d.value > 0)
    const sum = positive.reduce((a, d) => a + d.value, 0)
    // Largest first, so the ramp runs bright-to-dim around the ring.
    const ranked = [...positive].sort((a, b) => b.value - a.value)
    let acc = 0
    const segs: Segment[] = ranked.map((d, i) => {
      const frac = sum > 0 ? d.value / sum : 0
      const seg: Segment = {
        ...d,
        frac,
        start: acc,
        rank: i,
        color: limeFor(i, ranked.length),
        pct: Math.round(frac * 100),
      }
      acc += frac
      return seg
    })
    return { segments: segs, total: sum }
  }, [data])

  const shown = active != null ? segments[active] : null
  const centerValue = shown ? shown.value : total
  const centerCaption = shown ? shown.label : centerLabel

  const summary =
    ariaLabel ??
    `Donut chart of ${total} ${unit ?? 'items'} across ${segments.length} categories: ` +
      segments.map((s) => `${s.label}, ${s.value} (${s.pct}%)`).join('; ') +
      '.'

  return (
    <div
      className={`flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10 ${className}`}
    >
      {/* THE RING */}
      <div className="relative shrink-0" style={{ width: 'min(72vw, 260px)', aspectRatio: '1' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-0" role="img" aria-label={summary}>
          {/* Track — a faint full ring the slices sit on, so a partial total
              still reads as a whole. */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={STROKE}
          />
          {segments.map((seg, i) => {
            const isActive = active === i
            const dim = active != null && !isActive
            // Rotate each arc to its start angle (12 o'clock origin), nudged in
            // by half the gap so the seam sits centred between slices.
            const rot = -90 + (seg.start + GAP / 2) * 360
            const draw = Math.max(0, seg.frac - GAP)
            return (
              <g key={`${uid}-${seg.label}`} transform={`rotate(${rot} 50 50)`}>
                <motion.circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isActive ? STROKE_ACTIVE : STROKE}
                  strokeLinecap="butt"
                  pathLength={1}
                  initial={reduce ? { pathLength: draw } : { pathLength: 0 }}
                  whileInView={reduce ? undefined : { pathLength: draw }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{
                    duration: 0.9,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.1 + i * 0.09,
                  }}
                  style={{
                    opacity: dim ? 0.28 : 1,
                    transition: 'opacity 0.25s ease, stroke-width 0.25s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                />
              </g>
            )
          })}
        </svg>

        {/* Live centre figure. aria-hidden — the ring's aria-label and the
            legend already carry the numbers for assistive tech. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <motion.span
            key={centerValue}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="font-display text-4xl font-bold leading-none tracking-tight text-[#DCF87C] sm:text-5xl"
          >
            {centerValue}
          </motion.span>
          {unit && !shown && (
            <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
              {unit}
            </span>
          )}
          <span className="mt-1.5 max-w-[9rem] text-xs leading-tight text-white/55">
            {shown ? `${shown.label} · ${shown.pct}%` : centerCaption}
          </span>
        </div>
      </div>

      {/* THE LEGEND — the accessible face of the chart. Every slice is named
          with its own swatch, so identity never rests on the lime ramp alone.
          Hovering or focusing a row lifts its arc and updates the centre. */}
      <ul className="flex w-full flex-col gap-1">
        {segments.map((seg, i) => {
          const isActive = active === i
          return (
            <li key={`${uid}-row-${seg.label}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-white/10 transition-transform"
                  style={{
                    background: seg.color,
                    transform: isActive ? 'scale(1.35)' : 'scale(1)',
                  }}
                />
                <span
                  className={`flex-1 text-sm transition-colors ${
                    isActive ? 'text-white' : 'text-white/70'
                  }`}
                >
                  {seg.label}
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-white/80">
                  {seg.value}
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-white/40">
                  {seg.pct}%
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
