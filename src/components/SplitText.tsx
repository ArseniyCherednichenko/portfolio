import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { type ElementType, useMemo } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

type Direction = 'up' | 'down'

interface SplitTextProps {
  /** The real string. Carried as the accessible label; the visual split is hidden from AT. */
  text: string
  className?: string
  /** Element the visible line renders as (block-level recommended for headings). */
  as?: ElementType
  /** Seconds before the first character moves. */
  delay?: number
  /** Seconds between consecutive characters. */
  stagger?: number
  /** Which way each character travels in from. */
  direction?: Direction
  /** Paint the animated white→lime→white shine, clipped across the whole line. */
  gradient?: boolean
  /** 'inView' plays once when scrolled into view; 'mount' plays immediately (above-the-fold heroes). */
  trigger?: 'inView' | 'mount'
}

// A per-character staggered entrance reveal, in the spirit of React Bits' SplitText.
// Each glyph lifts and fades into place one after the next; whole words stay
// unbreakable (inline-block wrappers) so lines wrap only between words. When
// `gradient` is set, the shine background lives on the container and shows
// through every (transparent) glyph, so the sweep is continuous across the line
// instead of repeating per letter. Honest to assistive tech: the container
// carries the real `text` as its label and every split span is aria-hidden.
// Under reduced motion the finished line renders statically — no stagger, no loop.
export function SplitText({
  text,
  className = '',
  as,
  delay = 0,
  stagger = 0.03,
  direction = 'up',
  gradient = false,
  trigger = 'inView',
}: SplitTextProps) {
  const reduce = useReducedMotion()
  const Tag = (as ?? 'span') as ElementType
  const MotionTag = useMemo(() => motion(Tag), [Tag])

  // Split into words (kept whole) then characters, so wrapping never tears a word.
  const words = useMemo(() => text.split(' '), [text])

  const gradientClass = gradient
    ? 'bg-[linear-gradient(90deg,#ffffff,#DCF87C,#ffffff)] bg-[length:200%_auto] bg-clip-text text-transparent animate-[shine_6s_linear_infinite]'
    : ''

  if (reduce) {
    return (
      <Tag className={`${gradientClass} ${className}`} aria-label={text}>
        {text}
      </Tag>
    )
  }

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }
  const charVar: Variants = {
    hidden: { opacity: 0, y: direction === 'up' ? '0.5em' : '-0.5em' },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  }

  const anim =
    trigger === 'mount'
      ? { initial: 'hidden' as const, animate: 'show' as const }
      : {
          initial: 'hidden' as const,
          whileInView: 'show' as const,
          viewport: { once: true, margin: '-80px' },
        }

  // The shine background is clipped to text glyphs, which does not show through
  // nested transformed spans — so paint it per character instead of on the line.
  let index = 0
  return (
    <MotionTag className={className} aria-label={text} variants={container} {...anim}>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap" aria-hidden>
          {Array.from(word).map((ch) => (
            <motion.span
              key={index++}
              variants={charVar}
              className={`inline-block will-change-transform ${gradientClass}`}
            >
              {ch}
            </motion.span>
          ))}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </MotionTag>
  )
}
