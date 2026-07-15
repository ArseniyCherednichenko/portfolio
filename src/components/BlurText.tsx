import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { type ElementType, useMemo } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

type Trigger = 'inView' | 'mount'

interface BlurTextProps {
  /** The real string. Carried as the accessible label; the visual split is hidden from AT. */
  text: string
  className?: string
  /** Element the visible line renders as (block-level recommended for headings). */
  as?: ElementType
  /** Seconds before the first word begins resolving. */
  delay?: number
  /** Seconds between consecutive words landing. */
  stagger?: number
  /** How heavy the initial blur is, in px. Higher reads as further out of focus. */
  blur?: number
  /** How far each word rises as it sharpens, in px. */
  distance?: number
  /** 'inView' plays once when scrolled into view; 'mount' plays immediately (above-the-fold heroes). */
  trigger?: Trigger
}

/**
 * BlurText — a per-word focus-in reveal, in the spirit of React Bits' BlurText.
 * Each word starts heavily gaussian-blurred, dim, and a touch low, then resolves
 * into sharp focus one after the next, so a headline racks into clarity like a
 * lens finding it. Deliberately distinct from the other text motions in the set:
 * SplitText slides whole glyphs in, ScrollReveal brightens words along the scroll,
 * DecryptedText scrambles glyphs — this one plays only with depth of field.
 *
 * Honest to assistive tech: the full string is the container's accessible label
 * and every visual word is aria-hidden, so a screen reader hears the sentence
 * once, cleanly, never the per-word split. Whole words stay unbreakable
 * (inline-block), so a line still wraps only between words.
 *
 * Under reduced motion it renders the finished, fully sharp line with no blur and
 * no movement — the `filter: blur()` animation is exactly the kind of thing that
 * should never run for a reader who asked for stillness.
 */
export function BlurText({
  text,
  className = '',
  as = 'span',
  delay = 0,
  stagger = 0.09,
  blur = 12,
  distance = 14,
  trigger = 'inView',
}: BlurTextProps) {
  const reduce = useReducedMotion()
  const words = useMemo(() => text.split(' '), [text])

  const container: Variants = {
    hidden: {},
    visible: { transition: { delayChildren: delay, staggerChildren: stagger } },
  }

  const word: Variants = {
    hidden: { opacity: 0, filter: `blur(${blur}px)`, y: distance },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: { duration: 0.72, ease: EASE },
    },
  }

  const Tag = motion(as as ElementType)

  // Reduced motion: emit the plain, finished line. No variants, no blur.
  if (reduce) {
    return (
      <Tag className={className} aria-label={text}>
        {text}
      </Tag>
    )
  }

  const activate =
    trigger === 'mount'
      ? { animate: 'visible' as const }
      : { whileInView: 'visible' as const, viewport: { once: true, amount: 0.4 } }

  return (
    <Tag
      className={className}
      aria-label={text}
      variants={container}
      initial="hidden"
      {...activate}
    >
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden>
          <motion.span variants={word} className="inline-block will-change-[filter,transform]">
            {w}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  )
}

export default BlurText
