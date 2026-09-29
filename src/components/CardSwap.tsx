import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export interface SwapCard {
  /** Short kicker, e.g. "01" or a label. */
  tag: string
  title: string
  body: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// The stack geometry. Each card sitting `pos` places behind the front is
// nudged up and to the right, scaled back, tilted, and dimmed, so the deck
// reads as a real perspective stack rather than a flat pile. Cards past
// `VISIBLE` fade out entirely — they exist only to catch the wrapping card.
const GAP_X = 26
const GAP_Y = 30
const VISIBLE = 3

function pose(pos: number) {
  return {
    x: pos * GAP_X,
    y: pos * -GAP_Y,
    scale: 1 - pos * 0.06,
    rotate: pos * -2.4,
    opacity: pos <= VISIBLE ? Math.max(0, 1 - pos * 0.16) : 0,
    filter: `brightness(${Math.max(0.5, 1 - pos * 0.14)})`,
    zIndex: 100 - pos,
  }
}

/**
 * CardSwap — a 3D deck where the front card periodically drops away along an
 * arc and tucks in at the back while every card behind promotes one place
 * forward. Unlike {@link CardStack}, which recedes straight up on a timer,
 * this one swings the leaving card down-and-out first, so the swap reads as a
 * dealt hand rather than a shuffle in place.
 *
 * The only state is `front` (the index of the top card); every card's pose is
 * derived from its distance behind it, so there is a single source of truth
 * and no per-card bookkeeping. The card that is wrapping from front to back on
 * a given advance gets a keyframed path (down, out, then home) instead of the
 * spring the promoting cards use, which is what sells the deal.
 *
 * Auto-advances on `interval`, pausing while hovered or focused. Clicking the
 * front card (or pressing Enter/Space on it) advances by hand. Under reduced
 * motion it renders a calm, static fanned stack with no timer and no motion.
 */
export function CardSwap({
  cards,
  interval = 3200,
  className = '',
}: {
  cards: SwapCard[]
  interval?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [front, setFront] = useState(0)
  // The card index that is wrapping front -> back on the current advance. Only
  // this card takes the arc path; it is cleared once consumed by a render so a
  // later spring-driven change never inherits the drop.
  const [leaving, setLeaving] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const n = cards.length

  // Mirror `front` into a ref so the interval closure always advances from the
  // live top card without re-subscribing on every change.
  const frontRef = useRef(front)
  frontRef.current = front

  const advance = () => {
    const f = frontRef.current
    setLeaving(f)
    setFront((f + 1) % n)
  }

  // Auto-advance timer. Skipped entirely under reduced motion, and while the
  // deck is paused (hover/focus) so a reader can dwell on the top card.
  useEffect(() => {
    if (reduce || paused || n < 2) return
    const id = window.setInterval(() => {
      const f = frontRef.current
      setLeaving(f)
      setFront((f + 1) % n)
    }, interval)
    return () => window.clearInterval(id)
  }, [reduce, paused, n, interval])

  // Clear the leaving marker shortly after it is set so its keyframed
  // transition runs once and promoting cards fall back to the spring afterwards.
  useEffect(() => {
    if (leaving === null) return
    // Just past the arc's own duration (0.72s), so the keyframed path plays out
    // in full before the card reverts to the plain spring at its resting pose.
    const id = window.setTimeout(() => setLeaving(null), 760)
    return () => window.clearTimeout(id)
  }, [leaving])

  // Reduced motion: a still, honest fan of the whole deck, no timer, no swap.
  if (reduce) {
    return (
      <div className={`relative mx-auto ${className}`} style={{ maxWidth: 340 }}>
        <ul className="flex flex-col gap-3">
          {cards.map((card, i) => (
            <li
              key={i}
              className="rounded-3xl border border-white/12 bg-white/[0.03] p-6"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                {card.tag}
              </span>
              <h4 className="mt-2 font-display text-xl font-semibold leading-tight tracking-tight text-white">
                {card.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{card.body}</p>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div
      className={`relative mx-auto ${className}`}
      style={{ perspective: 1400, width: 300, height: 300 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* The stack is anchored to the lower-left; cards climb up and to the
          right. Sized to hold the fanned deck plus the drop travel. */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        {cards.map((card, i) => {
          const pos = (i - front + n) % n
          const target = pose(pos)
          const isFront = pos === 0
          const isLeaving = i === leaving
          return (
            <motion.div
              key={i}
              role={isFront ? 'button' : undefined}
              tabIndex={isFront ? 0 : -1}
              aria-hidden={!isFront}
              aria-label={isFront ? `${card.tag}: ${card.title}. Advance the deck.` : undefined}
              onClick={isFront ? advance : undefined}
              onKeyDown={
                isFront
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        advance()
                      }
                    }
                  : undefined
              }
              className={`absolute bottom-0 left-0 h-[190px] w-[272px] -translate-x-1/2 select-none rounded-3xl border p-6 backdrop-blur-sm ${
                isFront
                  ? 'cursor-pointer border-white/15 bg-white/[0.055] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
              style={{ transformStyle: 'preserve-3d' }}
              animate={
                isLeaving
                  ? {
                      // The dealt-away arc: drop down and out, then tuck to the
                      // back of the stack. Keyframes so it travels rather than
                      // sliding straight through the pile.
                      x: [0, GAP_X * 0.6, target.x],
                      y: [0, 150, target.y],
                      scale: [1, 0.92, target.scale],
                      rotate: [0, 7, target.rotate],
                      opacity: [1, 0.7, target.opacity],
                      filter: ['brightness(1)', 'brightness(0.85)', target.filter],
                      zIndex: target.zIndex,
                    }
                  : {
                      x: target.x,
                      y: target.y,
                      scale: target.scale,
                      rotate: target.rotate,
                      opacity: target.opacity,
                      filter: target.filter,
                      zIndex: target.zIndex,
                    }
              }
              transition={
                isLeaving
                  ? { duration: 0.72, ease: EASE, times: [0, 0.5, 1] }
                  : { type: 'spring', stiffness: 260, damping: 30 }
              }
            >
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                {card.tag}
              </span>
              <h4 className="mt-2 font-display text-xl font-semibold leading-tight tracking-tight text-white">
                {card.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{card.body}</p>
              {isFront && (
                <span className="pointer-events-none absolute bottom-5 right-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                  Tap to deal
                </span>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
