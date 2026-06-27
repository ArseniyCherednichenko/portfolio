import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'framer-motion'

export interface ScrollStackCard {
  /** Short kicker, e.g. "01" or a label. */
  tag: string
  title: string
  body: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// Where the cards pin, measured from the viewport top. Clears the fixed nav.
const TOP = 116
// Each successive card pins a little lower, so the deck fans into a visible peek.
const PEEK = 16

// A single pinned card. As the section scrolls on past this card's turn, the
// card scales down and dims a touch, so the growing deck reads as depth.
function Card({
  card,
  i,
  n,
  progress,
}: {
  card: ScrollStackCard
  i: number
  n: number
  progress: MotionValue<number>
}) {
  // This card is "covered" once the next card lands on top of it (~ (i+1)/n)
  // and keeps receding until the section is fully scrolled (progress = 1).
  const start = (i + 1) / n
  const depth = n - 1 - i // how many cards end up stacked above this one
  const scale = useTransform(progress, [start, 1], [1, 1 - depth * 0.04])
  const opacity = useTransform(progress, [start, 1], [1, 1 - depth * 0.12])

  return (
    <div className="sticky" style={{ top: TOP + i * PEEK }}>
      <motion.article
        style={{ scale, opacity, transformOrigin: 'center top' }}
        className="flex min-h-[260px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#161616] to-[#0d0d0d] p-8 shadow-2xl shadow-black/50 sm:min-h-[280px] sm:p-10"
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{card.tag}</span>
          <span className="text-xs tabular-nums text-white/30">
            {(i + 1).toString().padStart(2, '0')} / {n.toString().padStart(2, '0')}
          </span>
        </div>
        <div>
          <h3 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{card.title}</h3>
          <p className="mt-3 max-w-xl leading-relaxed text-white/60">{card.body}</p>
        </div>
      </motion.article>
    </div>
  )
}

/**
 * Scroll-driven stacking cards, Apple / React Bits style. Each card pins to the
 * top of the viewport in turn; as you keep scrolling, the next card slides up
 * and lands on top while the ones beneath scale down and dim, so the deck
 * collapses into a fanned stack. Relies on `position: sticky` plus a
 * section-level scroll progress, so it never fights the page scroll.
 *
 * Under reduced motion it renders a calm, fully readable vertical list with no
 * pinning, scaling, or scroll listeners.
 */
export function ScrollStack({
  cards,
  className = '',
}: {
  cards: ScrollStackCard[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const n = cards.length
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  if (reduce) {
    return (
      <div className={`grid gap-4 ${className}`}>
        {cards.map((c, i) => (
          <article key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{c.tag}</span>
              <span className="text-xs tabular-nums text-white/30">
                {(i + 1).toString().padStart(2, '0')} / {n.toString().padStart(2, '0')}
              </span>
            </div>
            <h3 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">{c.title}</h3>
            <p className="mt-3 max-w-xl leading-relaxed text-white/60">{c.body}</p>
          </article>
        ))}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.5, ease: EASE }}
      className={`flex flex-col gap-6 pb-[18vh] ${className}`}
    >
      {cards.map((c, i) => (
        <Card key={c.title} card={c} i={i} n={n} progress={scrollYProgress} />
      ))}
    </motion.div>
  )
}
