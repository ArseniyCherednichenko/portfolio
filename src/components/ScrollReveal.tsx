import { useRef, type ReactNode } from 'react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion'

interface ScrollRevealProps {
  /** The full statement. Split into words and revealed as it scrolls through. */
  children: string
  /** Words (lowercased, punctuation-stripped) to paint lime as they resolve. */
  highlight?: readonly string[]
  className?: string
}

/**
 * Scroll-linked, word-by-word text reveal in the spirit of React Bits. Each
 * word brightens from dim to full as the paragraph travels through the
 * viewport, so a statement assembles itself under the reader's scroll. Honest
 * to assistive tech: the real string is the accessible label and each visual
 * word is aria-hidden. Under reduced motion it renders the finished line.
 */
export function ScrollReveal({ children, highlight, className }: ScrollRevealProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.45'],
  })

  if (reduce) {
    return (
      <p className={className} aria-label={children}>
        {children}
      </p>
    )
  }

  const words = children.split(' ')
  const accent = new Set((highlight ?? []).map((w) => w.toLowerCase()))

  return (
    <p ref={ref} className={className} aria-label={children}>
      {words.map((word, i) => {
        const start = i / words.length
        const end = (i + 1) / words.length
        const bare = word.replace(/[^a-z0-9]/gi, '').toLowerCase()
        return (
          <Word
            key={`${word}-${i}`}
            progress={scrollYProgress}
            range={[start, end]}
            accent={accent.has(bare)}
          >
            {word}
          </Word>
        )
      })}
    </p>
  )
}

function Word({
  progress,
  range,
  accent,
  children,
}: {
  progress: MotionValue<number>
  range: [number, number]
  accent: boolean
  children: ReactNode
}) {
  const opacity = useTransform(progress, range, [0.12, 1])
  const y = useTransform(progress, range, [6, 0])
  return (
    <>
      <motion.span
        aria-hidden
        className={`inline-block will-change-[opacity,transform] ${accent ? 'text-[#DCF87C]' : ''}`}
        style={{ opacity, y }}
      >
        {children}
      </motion.span>{' '}
    </>
  )
}
