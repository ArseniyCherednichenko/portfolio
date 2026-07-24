import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useMemo, useRef } from 'react'

// Odometer — a mechanical rolling-digit counter. Each place is a vertical reel
// of 0-9; when the value settles, every reel travels UP from zero to its final
// digit, passing through the numbers in between exactly like the trip meter in
// a car. Higher places roll a little later, so a big number "lands" from the
// right, the way a real odometer catches up.
//
// This is deliberately a *different kind* of count than the two the site
// already has: AnimatedCounter tweens the text of a single number, and SplitFlap
// hinges a whole glyph over. The Odometer instead slides a continuous strip of
// digits behind a slot — no hinge, no text-swap, a physical roll. Reduced-motion
// users get the final figure set instantly with every reel already parked.

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

// One reel: a strip of 0-9 stacked vertically, clipped to a single-digit slot,
// translated up so the target digit sits in the window. Height is in `em`, so
// the reel scales with whatever font-size the caller sets.
function Reel({
  digit,
  delay,
  duration,
  reduce,
  play,
}: {
  digit: number
  delay: number
  duration: number
  reduce: boolean
  play: boolean
}) {
  // Each glyph occupies exactly 1em of height (leading-none + fixed height),
  // so parking digit `d` means shifting the strip up by `d` em.
  const parked = { y: `-${digit}em` }
  return (
    <span
      aria-hidden
      className="relative inline-block overflow-hidden align-baseline"
      style={{ height: '1em', width: '0.62em' }}
    >
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center tabular-nums"
        initial={reduce ? parked : { y: '0em' }}
        animate={play || reduce ? parked : { y: '0em' }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration, delay, ease: [0.16, 1, 0.3, 1] }
        }
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function Odometer({
  value,
  duration = 1.5,
  prefix = '',
  suffix = '',
  minDigits = 1,
  className = '',
}: {
  value: number
  /** Roll time for the units reel, in seconds. */
  duration?: number
  prefix?: string
  suffix?: string
  /** Pad the number to at least this many digits, e.g. 3 -> "007". */
  minDigits?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduce = useReducedMotion() ?? false

  const digits = useMemo(() => {
    const rounded = Math.max(0, Math.round(value))
    return String(rounded)
      .padStart(minDigits, '0')
      .split('')
      .map((c) => Number(c))
  }, [value, minDigits])

  const play = inView

  return (
    <span
      ref={ref}
      className={`inline-flex items-baseline leading-none ${className}`}
      role="img"
      aria-label={`${prefix}${Math.max(0, Math.round(value))}${suffix}`}
    >
      {prefix && <span aria-hidden>{prefix}</span>}
      {digits.map((d, i) => (
        <Reel
          // Reels are positional, and the digit set is fixed per value, so index
          // is a stable key here.
          key={i}
          digit={d}
          // Right-most place rolls first; each place to the left starts a beat
          // later, so the figure lands from the right like a real odometer.
          delay={(digits.length - 1 - i) * 0.12}
          duration={duration}
          reduce={reduce}
          play={play}
        />
      ))}
      {suffix && <span aria-hidden>{suffix}</span>}
    </span>
  )
}
