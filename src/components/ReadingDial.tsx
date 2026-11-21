import { useState, type RefObject } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as const

// Ring geometry. r = 20 inside a 48px button; the circumference is the length
// the progress stroke rides around, revealed by shrinking its dash offset.
const R = 20
const CIRC = 2 * Math.PI * R

interface ReadingDialProps {
  /** The article column whose scroll progress the dial reports. */
  targetRef: RefObject<HTMLElement>
  className?: string
}

/**
 * A corner reading dial for a long piece — the article-scoped companion to the
 * site-wide top-edge ScrollProgress bar. Where that thin line measures the whole
 * page (header, footer and all), this reports how far you are through the essay
 * *column itself*: a lime ring that closes as you read, with the live percentage
 * at its centre. It sits bottom-left so it never crowds the global back-to-top
 * control on the right, and it is itself a control — click or press it to return
 * to the top of the piece, so a reader who has reached the end has the way back
 * exactly where their eye already is.
 *
 * The ring is driven straight from `useScroll` over the target column (start of
 * the column at the top of the viewport to its end at the bottom), smoothed with
 * a light spring so it tracks the scrollbar rather than playing once. The dial
 * stays hidden until the reader is a little way in and fades out again at the
 * very top, so a piece sitting untouched shows nothing. Under reduced motion the
 * spring is stiffened to a near-instant follow and the scroll-to-top is a jump,
 * not a glide — the surface and the number are identical, only the easing goes.
 */
export function ReadingDial({ targetRef, className }: ReadingDialProps) {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  })
  const progress = useSpring(scrollYProgress, {
    stiffness: reduce ? 1000 : 120,
    damping: reduce ? 60 : 30,
    mass: 0.4,
    restDelta: 0.001,
  })
  // The stroke is a full-circumference dash whose offset shrinks to zero as the
  // ring closes, so no per-frame string is built — just one animated number.
  const dashOffset = useTransform(progress, [0, 1], [CIRC, 0])

  const [pct, setPct] = useState(0)
  const [shown, setShown] = useState(false)
  // Read the raw (unspringed) progress for the label and visibility so the
  // number is honest to the scrollbar and the dial appears without lag.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.round(v * 100)
    setPct((prev) => (prev === next ? prev : next))
    setShown(v > 0.03)
  })

  const toTop = () =>
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })

  return (
    <AnimatePresence>
      {shown && (
        <motion.button
          type="button"
          onClick={toTop}
          aria-label={`${pct} percent read. Back to the top of this piece.`}
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: 0.3, ease: EASE }}
          whileHover={reduce ? undefined : { y: -3 }}
          whileTap={{ scale: 0.92 }}
          className={`group fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur-md transition-colors hover:border-[#DCF87C]/40 ${className ?? ''}`}
        >
          {/* The ring. Rotated so the stroke starts at twelve o'clock and closes
              clockwise as the reader descends the column. */}
          <svg
            aria-hidden
            viewBox="0 0 48 48"
            className="absolute inset-0 h-full w-full -rotate-90"
          >
            <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
            <motion.circle
              cx="24"
              cy="24"
              r={R}
              fill="none"
              stroke="#DCF87C"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              style={{ strokeDashoffset: dashOffset }}
            />
          </svg>
          {/* The live percentage, swapped for an up-arrow on hover/focus so the
              dial reads as the control it is the moment a reader reaches for it. */}
          <span className="relative block text-[10px] font-semibold tabular-nums leading-none text-white/70 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">
            {pct}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute text-base leading-none text-[#DCF87C] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            &uarr;
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
