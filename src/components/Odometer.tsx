import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

// Odometer — a rolling-digit counter. Each digit is its own vertical reel of
// 0-9 that spins a full turn and settles on its target, higher places landing a
// beat before lower ones, exactly like a mechanical mileage counter or a fuel
// pump ticking over. This is a *kind* of counting the site did not have: the
// text-swap `AnimatedCounter` re-writes a number in place and the `SplitFlap`
// board hinges glyphs; this one physically rolls. Honest and reusable — it just
// renders whatever integer it is handed, with an optional suffix (e.g. "%").
// Reduced-motion users get the final number set instantly, no roll.

const EASE = [0.16, 1, 0.3, 1] as const
// Two stacked 0-9 runs, so every reel travels at least a full loop before it
// settles — even a target of 0 visibly rolls rather than sitting dead.
const STRIP = [...Array(10).keys(), ...Array(10).keys()]

function Reel({ digit, delay, play }: { digit: number; delay: number; play: boolean }) {
  const reduce = useReducedMotion()
  // Land on the digit in the *second* run (index 10 + digit) so the reel always
  // rolls through a whole 0-9 cycle on the way there.
  const target = `-${10 + digit}em`
  return (
    <span className="relative inline-block h-[1em] overflow-hidden tabular-nums">
      {/* Invisible sizing glyph fixes the reel's width to one tabular digit. */}
      <span aria-hidden className="invisible">0</span>
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={reduce ? { y: target } : { y: '0em' }}
        animate={play || reduce ? { y: target } : { y: '0em' }}
        transition={reduce ? { duration: 0 } : { duration: 1.5, ease: EASE, delay }}
      >
        {STRIP.map((d, i) => (
          <span key={i} className="block h-[1em] leading-[1em]">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function Odometer({
  value,
  suffix = '',
  className = '',
}: {
  value: number
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  // Once it scrolls into view the reels roll; the trigger fires a single time.
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const digits = Math.round(value).toString().split('').map(Number)
  return (
    <span
      ref={ref}
      className={`inline-flex items-baseline leading-none ${className}`}
      role="text"
      aria-label={`${Math.round(value)}${suffix}`}
    >
      <span aria-hidden className="inline-flex">
        {digits.map((d, i) => (
          // Left (higher-place) digits settle a touch before the right ones.
          <Reel key={i} digit={d} delay={i * 0.08} play={inView} />
        ))}
      </span>
      {suffix && (
        <span aria-hidden className="ml-[0.04em]">
          {suffix}
        </span>
      )}
    </span>
  )
}
