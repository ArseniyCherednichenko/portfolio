import { animate, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

// The progress indicator the foundations were missing — the quiet primitive
// that sits under every upload, export, sync, and long save. The library had
// the *skeleton* (space held while a screen loads) and the *spinner-in-a-button*
// (AsyncButton, one action resolving), but not the plain, reusable bar and ring
// that report *how far along* a known piece of work is, and the indeterminate
// pair for when the far end is unknown. That is the gap this fills, and it fills
// it the honest way most teams skip.
//
// Two things usually go wrong with a hand-rolled progress bar. First, it lies to
// assistive tech: a bare <div> with an animated width says nothing to a screen
// reader, where the native contract is role="progressbar" with aria-valuenow /
// valuemin / valuemax announced, or aria-busy when the value is unknown. This
// keeps that contract on both the linear and the circular forms. Second, the
// fill *snaps* — the number jumps and the bar teleports — because the width is
// bound straight to a prop. Here the fill is a spring: when the value changes the
// bar eases to it, and the readout *counts* to the new figure rather than
// flicking, so a jump from 20 to 80 reads as motion with a direction, not a
// cut.
//
// The indeterminate forms carry the one bit they must — "still working, end
// unknown" — with a sweep that travels the track (linear) or an arc that orbits
// the ring (circular). Under prefers-reduced-motion the travelling sweep is
// replaced by a slow, in-place opacity pulse (no translation, no spin — the
// vestibular-safe way to say "busy"), the determinate fill snaps instead of
// springing, and the readout lands on its figure at once. The pattern is
// identical to use in either mode.

const EASE = [0.16, 1, 0.3, 1] as const
const LIME = '#DCF87C'

type Variant = 'linear' | 'circular'

export interface ProgressProps {
  /** 0..max. Omit (or pass indeterminate) for the unknown-length state. */
  value?: number
  max?: number
  /** The unknown-length state: a sweep/orbit rather than a measured fill. */
  indeterminate?: boolean
  /** 'linear' is a track + fill; 'circular' is a ring. */
  variant?: Variant
  /** Linear: track height in px. Circular: ring diameter in px. */
  size?: number
  /** Stroke/track thickness in px. */
  thickness?: number
  /** Show the percentage (linear: trailing label; circular: centred readout). */
  showValue?: boolean
  /** Render the centre/well value yourself — gets the clamped percentage. */
  format?: (pct: number) => ReactNode
  /** Accessible name for the bar. */
  'aria-label'?: string
  /** A visible label rendered above a linear bar and used as its name. */
  label?: ReactNode
  className?: string
}

function clampPct(value: number, max: number) {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

/**
 * A progress indicator — linear bar or circular ring, determinate or
 * indeterminate. The determinate fill springs to its value and the readout
 * counts; the indeterminate form sweeps. role="progressbar" with the aria value
 * trio, or aria-busy when the length is unknown. Reduced-motion aware: the sweep
 * becomes an in-place pulse, the fill snaps, the readout lands at once.
 */
export function Progress({
  value = 0,
  max = 100,
  indeterminate = false,
  variant = 'linear',
  size,
  thickness,
  showValue = false,
  format,
  'aria-label': ariaLabel,
  label,
  className = '',
}: ProgressProps) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const pct = clampPct(value, max)

  // The counted readout: a number that eases to `pct` so a jump reads as motion.
  const [display, setDisplay] = useState(pct)
  const prev = useRef(pct)
  useEffect(() => {
    if (indeterminate) return
    if (reduce) {
      setDisplay(pct)
      prev.current = pct
      return
    }
    const controls = animate(prev.current, pct, {
      duration: 0.6,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    })
    prev.current = pct
    return () => controls.stop()
  }, [pct, indeterminate, reduce])

  const shownPct = indeterminate ? 0 : Math.round(display)
  const readout = format ? format(shownPct) : `${shownPct}%`

  const ariaProps = indeterminate
    ? { 'aria-busy': true as const }
    : {
        'aria-valuenow': Math.round(pct),
        'aria-valuemin': 0,
        'aria-valuemax': 100,
      }
  const nameProps = label
    ? { 'aria-labelledby': labelId }
    : { 'aria-label': ariaLabel ?? 'Progress' }

  // ---- Circular ------------------------------------------------------------
  if (variant === 'circular') {
    const d = size ?? 72
    const stroke = thickness ?? 6
    const r = (d - stroke) / 2
    const c = 2 * Math.PI * r
    // Determinate: the dash gap shrinks as the arc fills. Indeterminate: a short
    // arc (a quarter of the ring) that orbits, or pulses under reduced motion.
    const arc = indeterminate ? c * 0.25 : c * (clampPct(display, 100) / 100)
    return (
      <div
        className={`relative inline-flex items-center justify-center ${className}`}
        style={{ width: d, height: d }}
        role="progressbar"
        {...ariaProps}
        {...nameProps}
      >
        <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} className="-rotate-90">
          <circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-white/10"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            fill="none"
            stroke={LIME}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            // Determinate: the dash gap tracks the eased value. Indeterminate: a
            // fixed short arc that the nested SMIL transform orbits (active), or
            // a pulsing stub (reduced motion).
            strokeDashoffset={c - arc}
            initial={false}
            animate={indeterminate && reduce ? { opacity: [0.35, 1, 0.35] } : { opacity: 1 }}
            transition={
              indeterminate && reduce
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0 }
            }
          >
            {/* The orbiting arc for the active indeterminate state: a SMIL
                rotate about the ring's centre, spinning the short dash around. */}
            {indeterminate && !reduce && (
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from={`0 ${d / 2} ${d / 2}`}
                to={`360 ${d / 2} ${d / 2}`}
                dur="0.9s"
                repeatCount="indefinite"
              />
            )}
          </motion.circle>
        </svg>
        {(showValue || format) && !indeterminate && (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-white/85">
            {readout}
          </span>
        )}
      </div>
    )
  }

  // ---- Linear --------------------------------------------------------------
  const h = size ?? 8
  return (
    <div className={className}>
      {(label || (showValue && !indeterminate)) && (
        <div className="mb-2 flex items-baseline justify-between gap-4">
          {label ? (
            <span id={labelId} className="text-sm font-medium text-white/80">
              {label}
            </span>
          ) : (
            <span />
          )}
          {showValue && !indeterminate && (
            <span className="text-sm font-semibold tabular-nums text-[#DCF87C]">{readout}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        {...ariaProps}
        {...nameProps}
        className="relative w-full overflow-hidden rounded-full bg-white/10"
        style={{ height: h }}
      >
        {indeterminate ? (
          reduce ? (
            <motion.div
              className="absolute inset-0 rounded-full bg-[#DCF87C]/70"
              animate={{ opacity: [0.25, 0.8, 0.25] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <motion.div
              className="absolute inset-y-0 rounded-full bg-[#DCF87C]"
              style={{ width: '40%' }}
              animate={{ left: ['-40%', '100%'] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          )
        ) : (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-[#DCF87C]"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 26 }}
          />
        )}
      </div>
    </div>
  )
}
