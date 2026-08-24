import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Gauge — a single number given a dial. Where the DonutChart holds a whole set
// of categories in one ring, this is the counterpart for one proportion: a
// half-circle meter that sweeps a lime arc from empty to its value and settles,
// with the figure read large in the well beneath it.
//
// Same "made, not assembled" thesis as the rest of the site's data-viz: no
// charting library, just an SVG semicircle whose visible fraction is animated
// through `pathLength` — the same primitive the DonutChart and DrawSVG lean on.
// A small bead rides the arc's leading edge so the reader's eye lands on where
// the needle would be, without the clutter of a full dial face.
//
// It stays in one hue on purpose: colour only ever encodes "how full", never
// identity, so the meter reads the way a fuel gauge does — position is the
// message. Under reduced motion the arc is simply present at its final sweep,
// the bead sits at rest, and the centre figure is set outright, no count-up.

// Geometry, in a 100 x 56 viewBox. A half-circle: the arc rides the top of a
// circle of radius R centred low, leaving the well below it for the readout.
const R = 42
const CX = 50
const CY = 50
// The two ends of the semicircle, left (empty) to right (full).
const START = { x: CX - R, y: CY } // 180deg
const END = { x: CX + R, y: CY } //   0deg
// The upper semicircle as one SVG arc command, drawn left-to-right over the top.
const ARC_PATH = `M ${START.x} ${START.y} A ${R} ${R} 0 0 1 ${END.x} ${END.y}`
const STROKE = 9

/** Point on the upper semicircle at fraction f (0 = left/empty, 1 = right/full). */
function pointAt(f: number): { x: number; y: number } {
  const a = Math.PI * (1 - clamp01(f)) // pi -> 0 as f goes 0 -> 1
  return { x: CX + R * Math.cos(a), y: CY - R * Math.sin(a) }
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

export function Gauge({
  value,
  max = 100,
  min = 0,
  label,
  caption,
  unit,
  format,
  size = 260,
  className = '',
  ariaLabel,
}: {
  value: number
  /** Top of the scale. The sweep is (value - min) / (max - min). */
  max?: number
  /** Bottom of the scale. */
  min?: number
  /** The big figure shown in the well. Defaults to the value, via `format`. */
  label?: string
  /** Small line under the figure. */
  caption?: string
  /** Short noun shown beside the figure, e.g. "percent". Hidden if `label` is set. */
  unit?: string
  /** Formats the numeric value into the big figure. Ignored when `label` is given. */
  format?: (v: number) => string
  /** Rendered width in pixels; the meter keeps its aspect. */
  size?: number
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()

  const frac = useMemo(() => {
    const span = max - min
    return span > 0 ? clamp01((value - min) / span) : 0
  }, [value, min, max])

  const bead = pointAt(frac)
  const figure = label ?? (format ? format(value) : String(value))
  const summary =
    ariaLabel ??
    `Gauge: ${figure}${unit ? ` ${unit}` : ''}${caption ? `, ${caption}` : ''}, ` +
      `${Math.round(frac * 100)} percent of full.`

  const gradId = `${uid}-fill`
  const EASE = [0.16, 1, 0.3, 1] as const

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      style={{ width: 'min(80vw, ' + size + 'px)' }}
    >
      <div className="relative w-full" style={{ aspectRatio: '100 / 56' }}>
        <svg viewBox="0 0 100 56" className="h-full w-full" role="img" aria-label={summary}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(220,248,124,0.5)" />
              <stop offset="100%" stopColor="rgba(220,248,124,1)" />
            </linearGradient>
          </defs>

          {/* Track — the empty dial the value rides over. */}
          <path
            d={ARC_PATH}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {/* Value arc — draws itself in on scroll to the current fraction. */}
          <motion.path
            d={ARC_PATH}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={1}
            initial={reduce ? { pathLength: frac } : { pathLength: 0 }}
            whileInView={reduce ? undefined : { pathLength: frac }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
          />

          {/* The bead riding the leading edge — appears once the arc has swept
              out to meet it. A soft halo sits under a solid lime dot. */}
          <motion.g
            initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
            whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 1.05 }}
            style={{ transformOrigin: `${bead.x}px ${bead.y}px` }}
          >
            <circle cx={bead.x} cy={bead.y} r={6} fill="rgba(220,248,124,0.22)" />
            <circle cx={bead.x} cy={bead.y} r={3.1} fill="#DCF87C" />
          </motion.g>
        </svg>

        {/* The figure, seated in the well of the dial. aria-hidden — the arc's
            aria-label already carries the reading for assistive tech. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center"
        >
          <div className="flex items-baseline gap-1">
            <motion.span
              initial={reduce ? false : { opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 0.5 }}
              className="font-display text-4xl font-bold leading-none tracking-tight text-[#DCF87C] sm:text-5xl"
            >
              {figure}
            </motion.span>
            {unit && !label && (
              <span className="text-sm font-medium uppercase tracking-[0.18em] text-white/40">
                {unit}
              </span>
            )}
          </div>
          {caption && (
            <span className="mt-1.5 max-w-[12rem] text-xs leading-tight text-white/55">
              {caption}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
