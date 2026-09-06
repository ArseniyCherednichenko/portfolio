import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// RingChart — the chart family's next shape, and the one none of the others is:
// several *independent* proportions read at once as concentric rings. The Gauge
// gives a single proportion a dial; the DonutChart splits one whole into parts
// that must sum to it. This does neither — each ring is its own measure against
// its own max, stacked as nested arcs, so three or four unrelated "how full"
// readings sit in one compact figure (the radial-bar / activity-ring form).
//
// Same "made, not assembled" rules as the rest of the site's data-viz: no
// charting library, just SVG circles whose visible fraction is animated through
// `pathLength` — the exact primitive the DonutChart arcs and the Gauge sweep
// lean on — each rotated to start at twelve o'clock so the eye reads clockwise
// from the top. And the same colour discipline: one lime, stepped by rank so
// the outer ring is brightest, because position (which radius) carries identity
// and the legend names it — colour never has to. A bead rides each arc's
// leading edge where its needle would sit.
//
// Interactive like its siblings: the legend rows are real buttons, and hovering
// or focusing one lifts its ring and swaps the centre readout to that measure,
// while the others dim back. Under reduced motion every arc is simply present
// at its final fraction, the beads sit at rest, and nothing sweeps.

export interface Ring {
  /** Names the measure — shown in the legend and read by assistive tech. */
  label: string
  /** The current amount. The filled fraction is (value - ... )/max, clamped. */
  value: number
  /** Top of this ring's own scale. Independent of the other rings. */
  max?: number
  /** Optional short readout, e.g. "%". Defaults to a percentage of max. */
  unit?: string
  /** Override the stepped-lime tone for this ring (a design token, rare). */
  color?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// Geometry in a 100 x 100 viewBox. Rings step inward from the outer edge; the
// stroke is centred on each radius, so the outermost sits comfortably inside.
const CX = 50
const CY = 50
const R_OUTER = 42
const STEP = 12 // centre-to-centre gap between rings
const THICK = 8

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

// The site's single lime, stepped down by rank so the outer ring reads brightest
// and each inner one a touch quieter — identity by radius, not by hue.
const LIME_STEPS = ['rgba(220,248,124,1)', 'rgba(220,248,124,0.8)', 'rgba(220,248,124,0.62)', 'rgba(220,248,124,0.48)']

/** Point on a ring of radius r at fraction f, measured clockwise from the top. */
function beadAt(r: number, f: number): { x: number; y: number } {
  const a = -Math.PI / 2 + clamp01(f) * Math.PI * 2
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

export function RingChart({
  rings,
  size = 240,
  className = '',
  ariaLabel,
  showLegend = true,
}: {
  rings: Ring[]
  /** Rendered width in pixels; the figure stays square. */
  size?: number
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
  showLegend?: boolean
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const rows = useMemo(
    () =>
      rings.slice(0, 4).map((ring, i) => {
        const max = ring.max ?? 100
        const frac = max > 0 ? clamp01(ring.value / max) : 0
        const r = R_OUTER - i * STEP
        return {
          ...ring,
          max,
          frac,
          r,
          color: ring.color ?? LIME_STEPS[i] ?? LIME_STEPS[LIME_STEPS.length - 1],
          pct: Math.round(frac * 100),
        }
      }),
    [rings],
  )

  const focus = active != null ? rows[active] : rows[0]
  const summary =
    ariaLabel ??
    `Ring chart. ${rows
      .map((row) => `${row.label}, ${row.pct} percent${row.unit ? ` (${row.value} ${row.unit})` : ''}`)
      .join('; ')}.`

  return (
    <div className={`flex flex-col items-center ${className}`} style={{ width: 'min(80vw, ' + size + 'px)' }}>
      <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={summary}>
          {rows.map((row, i) => {
            const dim = active != null && active !== i
            return (
              <g key={i} style={{ opacity: dim ? 0.28 : 1, transition: 'opacity 0.3s ease' }}>
                {/* Track — the empty ring the value rides over. */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={row.r}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={THICK}
                />
                {/* Value arc — draws itself in on scroll to this ring's fraction,
                    starting at twelve o'clock and sweeping clockwise. */}
                <motion.circle
                  cx={CX}
                  cy={CY}
                  r={row.r}
                  fill="none"
                  stroke={row.color}
                  strokeWidth={active === i ? THICK + 1.5 : THICK}
                  strokeLinecap="round"
                  pathLength={1}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  initial={reduce ? { pathLength: row.frac } : { pathLength: 0 }}
                  whileInView={reduce ? undefined : { pathLength: row.frac }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 1.1, ease: EASE, delay: 0.1 + i * 0.12 }}
                  style={{ transition: 'stroke-width 0.3s ease' }}
                />
                {/* Bead on the leading edge — appears once the arc reaches it. */}
                {row.frac > 0.001 && (
                  <motion.circle
                    cx={beadAt(row.r, row.frac).x}
                    cy={beadAt(row.r, row.frac).y}
                    r={2.6}
                    fill={row.color}
                    initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }}
                    whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 1.05 + i * 0.12 }}
                    style={{ transformOrigin: `${beadAt(row.r, row.frac).x}px ${beadAt(row.r, row.frac).y}px` }}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* Centre readout — the focused (hovered/first) ring's share, read large.
            aria-hidden: the svg summary already carries every ring for AT. */}
        {focus && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
          >
            <motion.span
              key={`${uid}-${active ?? 'first'}`}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="font-display text-3xl font-bold leading-none tracking-tight text-[#DCF87C] sm:text-4xl"
            >
              {focus.pct}
              <span className="text-lg text-white/40">%</span>
            </motion.span>
            <span className="mt-1 max-w-[7rem] text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/45">
              {focus.label}
            </span>
          </div>
        )}
      </div>

      {showLegend && (
        <ul className="mt-6 flex w-full flex-col gap-1.5">
          {rows.map((row, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                aria-label={`${row.label}: ${row.pct} percent`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
                <span className="flex-1 text-sm text-white/70">{row.label}</span>
                <span className="text-sm font-semibold tabular-nums text-white/85">{row.pct}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
