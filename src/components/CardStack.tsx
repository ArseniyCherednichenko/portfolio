import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export interface StackCard {
  /** Short kicker, e.g. "01" or a label. */
  tag: string
  title: string
  body: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// Depth styling for the cards sitting behind the front one.
function pose(pos: number) {
  return {
    y: pos * -18,
    scale: 1 - pos * 0.05,
    opacity: pos < 4 ? 1 - pos * 0.18 : 0,
    rotate: pos === 0 ? 0 : (pos % 2 === 0 ? 1 : -1) * Math.min(pos, 3) * 1.4,
    zIndex: 100 - pos,
  }
}

/**
 * An auto-advancing 3D deck of cards. The front card recedes to the back of
 * the stack on a timer or on click; the cards behind peek above it for depth.
 * Pauses while hovered or focused. Under reduced motion it renders a calm
 * static list instead, and never auto-advances.
 */
export function CardStack({
  cards,
  interval = 3600,
  className = '',
}: {
  cards: StackCard[]
  interval?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [front, setFront] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = cards.length
  const timer = useRef<ReturnType<typeof setInterval>>()

  const advance = () => setFront((f) => (f + 1) % n)

  useEffect(() => {
    if (reduce || paused || n < 2) return
    timer.current = setInterval(advance, interval)
    return () => clearInterval(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, paused, n, interval])

  // Reduced motion: a plain, honest, fully readable list. No deck, no timer.
  if (reduce) {
    return (
      <div className={`grid gap-4 ${className}`}>
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-7"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{c.tag}</span>
            <h3 className="mt-3 text-2xl font-bold">{c.title}</h3>
            <p className="mt-3 leading-relaxed text-white/60">{c.body}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        className="relative mx-auto h-[260px] w-full max-w-md select-none [perspective:1200px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-roledescription="card deck"
      >
        {cards.map((c, i) => {
          const pos = (i - front + n) % n
          return (
            <motion.button
              key={c.title}
              type="button"
              onClick={advance}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              aria-hidden={pos !== 0}
              tabIndex={pos === 0 ? 0 : -1}
              initial={false}
              animate={pose(pos)}
              transition={{ duration: 0.7, ease: EASE }}
              style={{ pointerEvents: pos === 0 ? 'auto' : 'none' }}
              className="absolute inset-x-0 top-0 flex h-full w-full flex-col justify-between rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 text-left shadow-2xl shadow-black/40 backdrop-blur-sm transition-colors hover:border-[#DCF87C]/30 focus-visible:border-[#DCF87C]/50 focus-visible:outline-none"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{c.tag}</span>
                <span className="text-xs text-white/30">
                  {((i % n) + 1).toString().padStart(2, '0')} / {n.toString().padStart(2, '0')}
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold sm:text-3xl">{c.title}</h3>
                <p className="mt-3 leading-relaxed text-white/60">{c.body}</p>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Progress dots — also let you jump straight to a card. */}
      <div className="mt-7 flex items-center justify-center gap-2.5">
        {cards.map((c, i) => (
          <button
            key={c.title}
            type="button"
            onClick={() => setFront(i)}
            aria-label={`Show ${c.title}`}
            aria-current={i === front}
            className="group relative h-2.5 w-2.5"
          >
            <span
              className={`absolute inset-0 rounded-full transition-colors ${
                i === front ? 'bg-[#DCF87C]' : 'bg-white/20 group-hover:bg-white/40'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
