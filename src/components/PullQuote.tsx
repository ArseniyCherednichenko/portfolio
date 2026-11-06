import { useRef, type ReactNode } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion'

interface PullQuoteProps {
  /** The statement itself. Split into words and assembled under the scroll. */
  quote: string
  /** Who said it — set in a <cite>, e.g. "Arseniy Cherednichenko". */
  cite?: string
  /** A quiet second line under the cite, e.g. a place or a role. */
  role?: string
  /** Words (lowercased, punctuation-stripped) painted lime as they resolve. */
  highlight?: readonly string[]
  /** Reading alignment — a centred monument or a left-set margin note. */
  align?: 'left' | 'center'
  className?: string
}

/**
 * PullQuote — the editorial pull-quote the type family was missing. The
 * neighbours move a single string (SplitText lifts letters, ScrollReveal
 * brightens words, DecryptedText resolves glyphs); this one composes a whole
 * quotation unit — an oversized serif mark, the statement, an accent rule and a
 * cite — and assembles it as one gesture under the scroll.
 *
 * Everything is tied to the blockquote's own scroll progress: the giant
 * quotation glyph rises and warms to lime first, the statement then brightens
 * word by word, an accent hairline draws across beneath it, and the cite fades
 * up last — so a reader scrolling past watches the quote set itself, top to
 * bottom, the way an editorial page reveals a pulled line.
 *
 * Honest to assistive tech: it is a real <blockquote> carrying the full
 * statement as its accessible label with a real <cite>; every moving visual
 * word and the decorative mark are aria-hidden, so a screen reader hears the
 * quote once, cleanly. Under reduced motion the scroll binding is dropped (a
 * motion value pinned to its finished state stands in) so the quote renders
 * lit, full and still — same markup, nothing moving.
 */
export function PullQuote({
  quote,
  cite,
  role,
  highlight,
  align = 'center',
  className = '',
}: PullQuoteProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLQuoteElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.55'],
  })
  // Under reduced motion, a value pinned to 1 drives every transform to its
  // finished output, so the one render path below serves both cases and the
  // hooks stay unconditional.
  const pinned = useMotionValue(1)
  const progress = reduce ? pinned : scrollYProgress

  const centered = align === 'center'
  const words = quote.split(' ')
  const accent = new Set((highlight ?? []).map((w) => w.toLowerCase()))

  return (
    <figure className={`${centered ? 'text-center' : 'text-left'} ${className}`}>
      <blockquote ref={ref} aria-label={quote} className="relative">
        <QuoteMark centered={centered} progress={progress} />
        <p className="relative font-display text-3xl font-medium leading-[1.22] tracking-tight text-white/90 sm:text-5xl sm:leading-[1.18]">
          {words.map((word, i) => {
            // The statement assembles across the first ~75% of the pass, so the
            // rule and cite still have room to land after the last word lights.
            const span = 0.75
            const start = (i / words.length) * span
            const end = ((i + 1) / words.length) * span
            const bare = word.replace(/[^a-z0-9]/gi, '').toLowerCase()
            return (
              <Word
                key={`${word}-${i}`}
                progress={progress}
                range={[start, end]}
                accent={accent.has(bare)}
              >
                {word}
              </Word>
            )
          })}
        </p>
        <Rule centered={centered} progress={progress} />
      </blockquote>
      {cite && <Attribution cite={cite} role={role} centered={centered} progress={progress} />}
    </figure>
  )
}

// The oversized opening quotation mark — set in the display serif so it reads
// as editorial type, not an icon. Rises and warms from a faint ghost to full
// lime over the first beat of the scroll.
function QuoteMark({
  centered,
  progress,
}: {
  centered: boolean
  progress: MotionValue<number>
}) {
  const opacity = useTransform(progress, [0, 0.14], [0.14, 1])
  const y = useTransform(progress, [0, 0.14], [18, 0])
  return (
    <motion.span
      aria-hidden
      className={`block ${centered ? 'text-center' : 'text-left'}`}
      style={{ opacity, y }}
    >
      <span className="pointer-events-none select-none font-display text-[5rem] font-bold leading-[0.6] text-[#DCF87C] sm:text-[8rem]">
        &ldquo;
      </span>
    </motion.span>
  )
}

// One word of the statement: dim-to-full brighten with a small lift, so the
// line resolves under the scroll rather than all at once.
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
  const y = useTransform(progress, range, [8, 0])
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

// The accent hairline that draws across under the quote, origin matching the
// reading alignment, once the words are mostly resolved.
function Rule({
  centered,
  progress,
}: {
  centered: boolean
  progress: MotionValue<number>
}) {
  const scaleX = useTransform(progress, [0.62, 0.85], [0, 1])
  return (
    <motion.span
      aria-hidden
      className={`mt-7 block h-px w-16 bg-[#DCF87C] ${centered ? 'mx-auto origin-center' : 'origin-left'}`}
      style={{ scaleX }}
    />
  )
}

// The cite, set small and quiet with an em-dash — fades up last, after the rule.
function Attribution({
  cite,
  role,
  centered,
  progress,
}: {
  cite: string
  role?: string
  centered: boolean
  progress: MotionValue<number>
}) {
  const opacity = useTransform(progress, [0.78, 0.98], [0, 1])
  const y = useTransform(progress, [0.78, 0.98], [10, 0])
  return (
    <motion.figcaption
      style={{ opacity, y }}
      className={`mt-5 ${centered ? 'text-center' : 'text-left'}`}
    >
      <cite className="text-sm font-semibold not-italic tracking-wide text-white/70">
        <span aria-hidden className="text-[#DCF87C]">
          &mdash;{' '}
        </span>
        {cite}
      </cite>
      {role && <span className="mt-0.5 block text-xs text-white/40">{role}</span>}
    </motion.figcaption>
  )
}
