import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface ContainerTextFlipProps {
  /** The words to cycle through. Fed honest copy — never a fabricated claim. */
  words: string[]
  /** Dwell time on each word, in ms. */
  interval?: number
  /** Extra classes for the pill container. */
  className?: string
  /** Extra classes for the type itself (size / weight / family). */
  textClassName?: string
}

// A word that flips over while the container springs its width to fit it — the
// signature is the *container* resizing to each word, with the letters turning
// in on a staggered 3D flip. Deliberately distinct from the type family's other
// word-swappers: RotatingWord slides vertically inside a fixed box, GooeyText
// metaball-morphs one word into the next, and SplitFlap clatters between strings
// on a fixed-width board. Here the pill itself breathes to each word's measured
// width, so the swap reads as the frame reshaping around the word, not the word
// moving inside the frame.
//
// Width is measured off a hidden sizer that mirrors the visible type, so the
// spring lands exactly on the word for any font/weight with no hard-coded
// metrics; `document.fonts.ready` re-measures once Fraunces swaps in. The
// flipping glyphs are `aria-hidden` decoration; an `aria-live` region announces
// the settled word. Under reduced motion the flip and the width spring drop to a
// plain cross-fade and an instant resize — the word still cycles, since it
// carries meaning, it just stops turning.
export function ContainerTextFlip({
  words,
  interval = 2600,
  className = '',
  textClassName = '',
}: ContainerTextFlipProps) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [width, setWidth] = useState<number | null>(null)
  const sizerRef = useRef<HTMLSpanElement>(null)

  const word = words[index] ?? ''

  // Measure the current word in the hidden sizer, then spring the container to
  // that width. Layout effect so the width is set before paint and the pill
  // never flashes at the wrong size.
  useLayoutEffect(() => {
    if (sizerRef.current) setWidth(sizerRef.current.getBoundingClientRect().width)
  }, [word])

  // Re-measure on resize and once the display font loads, so a late Fraunces
  // swap doesn't leave the pill sized to the fallback metrics.
  useEffect(() => {
    function remeasure() {
      if (sizerRef.current) setWidth(sizerRef.current.getBoundingClientRect().width)
    }
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
    fonts?.ready?.then(remeasure).catch(() => {})
    window.addEventListener('resize', remeasure)
    return () => window.removeEventListener('resize', remeasure)
  }, [])

  // Auto-advance. A single word never cycles.
  useEffect(() => {
    if (words.length < 2) return
    const id = window.setInterval(() => setIndex((p) => (p + 1) % words.length), interval)
    return () => window.clearInterval(id)
  }, [words.length, interval])

  const letters = Array.from(word)

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-[#DCF87C]/25 bg-[#DCF87C]/[0.06] px-5 py-2 align-middle ${className}`}
      style={{ perspective: '700px' }}
    >
      {/* Hidden sizer — only ever measured, never shown. Mirrors the visible
          type so the width spring lands exactly on the word. */}
      <span
        ref={sizerRef}
        aria-hidden
        className={`pointer-events-none invisible absolute whitespace-nowrap ${textClassName}`}
      >
        {word}
      </span>

      <motion.span
        className="inline-flex overflow-hidden whitespace-nowrap"
        animate={{ width: width ?? 'auto' }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            aria-hidden
            className={`inline-flex whitespace-nowrap ${textClassName}`}
            initial="enter"
            animate="show"
            exit="leave"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {letters.map((ch, i) => (
              <motion.span
                key={`${index}-${i}`}
                className="inline-block"
                style={{ transformOrigin: '50% 100%' }}
                variants={{
                  enter: { opacity: 0, rotateX: reduce ? 0 : -90, y: reduce ? 0 : '0.3em' },
                  show: { opacity: 1, rotateX: 0, y: 0 },
                  leave: { opacity: 0, rotateX: reduce ? 0 : 60, y: reduce ? 0 : '-0.25em' },
                }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { duration: 0.44, delay: i * 0.032, ease: [0.16, 1, 0.3, 1] }
                }
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            ))}
          </motion.span>
        </AnimatePresence>
      </motion.span>

      {/* Honest to AT: the flipping glyphs are decoration; this announces the
          settled word once. */}
      <span className="sr-only" aria-live="polite">
        {word}
      </span>
    </span>
  )
}
