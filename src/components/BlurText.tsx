import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { type ElementType, useMemo } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

type Direction = 'top' | 'bottom'
type AnimateBy = 'words' | 'chars'

interface BlurTextProps {
  /** The real string. Carried as the accessible label; the visual split is hidden from AT. */
  text: string
  className?: string
  /** Element the visible line renders as (block-level recommended for headings). */
  as?: ElementType
  /** Seconds before the first unit resolves. */
  delay?: number
  /** Seconds between consecutive units. */
  stagger?: number
  /** Reveal one word at a time (default) or one character at a time. */
  animateBy?: AnimateBy
  /** Which edge the units drift in from as they sharpen. */
  direction?: Direction
  /** How much blur to start from, in px. */
  blur?: number
  /** Paint the animated white→lime→white shine, per unit. */
  gradient?: boolean
  /** 'inView' plays once when scrolled into view; 'mount' plays immediately (above-the-fold heroes). */
  trigger?: 'inView' | 'mount'
}

// Text that resolves out of a soft focus, one word (or character) at a time.
// The signature is the blur: each unit begins heavily out of focus and drifts a
// little as it sharpens to nothing, so the line reads like a lens pulling into
// focus — a different feel from SplitText's clean per-letter lift or
// ScrollReveal's scroll-linked word opacity. In the spirit of React Bits'
// BlurText. Whole words stay unbreakable (inline-block wrappers) so lines wrap
// only between words. Honest to assistive tech: the container carries the real
// `text` as its label and every split span is aria-hidden. Under reduced motion
// the finished line renders statically — no blur, no stagger, no loop.
export function BlurText({
  text,
  className = '',
  as,
  delay = 0,
  stagger = 0.08,
  animateBy = 'words',
  direction = 'bottom',
  blur = 10,
  gradient = false,
  trigger = 'inView',
}: BlurTextProps) {
  const reduce = useReducedMotion()
  const Tag = (as ?? 'span') as ElementType
  const MotionTag = useMemo(() => motion(Tag), [Tag])

  // Split into words (kept whole) so wrapping never tears a word.
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

  const y = direction === 'top' ? '-0.4em' : '0.4em'

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }
  const unitVar: Variants = {
    hidden: { opacity: 0, y, filter: `blur(${blur}px)` },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE } },
  }

  const anim =
    trigger === 'mount'
      ? { initial: 'hidden' as const, animate: 'show' as const }
      : {
          initial: 'hidden' as const,
          whileInView: 'show' as const,
          viewport: { once: true, margin: '-80px' },
        }

  // One motion unit — a whole word, or (in char mode) a single glyph.
  const Unit = ({ children }: { children: string }) => (
    <motion.span variants={unitVar} className={`inline-block will-change-[transform,filter] ${gradientClass}`}>
      {children}
    </motion.span>
  )

  return (
    <MotionTag className={className} aria-label={text} variants={container} {...anim}>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap" aria-hidden>
          {animateBy === 'chars'
            ? Array.from(word).map((ch, ci) => <Unit key={ci}>{ch}</Unit>)
            : <Unit>{word}</Unit>}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </MotionTag>
  )
}
