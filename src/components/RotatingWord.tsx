import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

// Cycles through phrases in place. The incoming word rises and sharpens as the
// outgoing one lifts away and blurs out, so the line is never blank between
// words — the old `mode="wait"` swap left a visible empty frame, which read as a
// flicker on the hero where this carries real meaning. An invisible sizer holds
// the box to the widest phrase, so swapping never reflows the line around it,
// and the live word is mirrored into an `aria-live` region for screen readers.
//
// Reduced motion is honoured: the rise-and-blur collapses to a plain cross-fade
// (still gap-free), so nothing slides or defocuses for those who ask for calm.
export function RotatingWord({
  words,
  interval = 2200,
  className = '',
}: {
  words: string[]
  interval?: number
  className?: string
}) {
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (words.length <= 1) return
    const id = setInterval(() => setI((p) => (p + 1) % words.length), interval)
    return () => clearInterval(id)
  }, [words.length, interval])

  // The longest phrase holds the box's width and height and anchors the
  // baseline, so the surrounding line never jumps as words swap. Character count
  // is a close-enough proxy for render width across these short phrases.
  const longest = useMemo(
    () => words.reduce((a, b) => (b.length > a.length ? b : a), words[0] ?? ''),
    [words],
  )

  const word = words[i] ?? ''

  return (
    <span className={`relative inline-grid align-baseline ${className}`}>
      {/* Invisible sizer — reserves width/height for the widest phrase and sets
          the baseline, so the overlapping swap below never shifts layout. */}
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap font-semibold">
        {longest}
      </span>
      {/* Announce the current word to assistive tech without the animation. */}
      <span className="sr-only" aria-live="polite">
        {word}
      </span>
      {/* The animated words overlap absolutely inside this clipped cell, so the
          enter and exit coexist (no blank frame) without affecting the box. */}
      <span aria-hidden className="relative col-start-1 row-start-1 block overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.span
            key={i}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: '0.72em', filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: '-0.72em', filter: 'blur(6px)' }}
            transition={{ duration: reduce ? 0.28 : 0.42, ease: EASE }}
            className="absolute inset-0 inline-block whitespace-nowrap font-semibold text-[#DCF87C]"
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  )
}
