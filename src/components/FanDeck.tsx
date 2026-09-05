import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export interface FanCard {
  /** Short kicker, e.g. a one-word label. */
  tag: string
  title: string
  body: string
}

const EASE = [0.16, 1, 0.3, 1] as const
const SPRING = { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 } as const

/**
 * A hand of cards held the way a card player holds them: fanned around a pivot
 * below the deck, overlapping at the base and spreading toward the top. It is
 * the tactile counterpart to CardStack — where that recedes into a z-stack, this
 * spreads sideways into an arc. Hover the whole hand and it opens wider; hover
 * (or focus) one card and it lifts out of the fan and straightens, its body
 * unfolding. Click a card to keep it raised. Fully keyboard-driveable via a
 * roving tab stop and the arrow keys. Under reduced motion it drops the fan for
 * a calm, fully readable column of cards.
 */
export function FanDeck({
  cards,
  className = '',
  label = 'A hand of cards',
}: {
  cards: FanCard[]
  className?: string
  label?: string
}) {
  const reduce = useReducedMotion()
  const n = cards.length
  const mid = (n - 1) / 2

  const [open, setOpen] = useState(false)
  const [lifted, setLifted] = useState<number | null>(null)
  const [active, setActive] = useState(Math.round(mid))
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Reduced motion: no fan, no lift, no drift — a plain, honest column that
  // reads top to bottom. Every card is fully open.
  if (reduce) {
    return (
      <div className={`grid gap-4 ${className}`}>
        {cards.map((c) => (
          <div key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{c.tag}</span>
            <h3 className="mt-2 font-display text-2xl font-bold">{c.title}</h3>
            <p className="mt-2 leading-relaxed text-white/60">{c.body}</p>
          </div>
        ))}
      </div>
    )
  }

  const focus = (i: number) => {
    const j = (i + n) % n
    setActive(j)
    btnRefs.current[j]?.focus()
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      focus(i + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      focus(i - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focus(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focus(n - 1)
    }
  }

  return (
    <div className={className}>
      <div
        className="relative mx-auto h-[400px] w-full max-w-xl select-none"
        role="group"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          setOpen(false)
          setLifted(null)
        }}
      >
        {cards.map((c, i) => {
          const offset = i - mid
          const raised = lifted === i
          // Spread wider when the hand is open; a lifted card straightens and
          // rises clear of its neighbours.
          const spread = open ? 9 : 6
          const rotate = raised ? offset * 2.2 : offset * spread
          const y = raised ? -54 : open ? -6 : 0
          const x = raised ? offset * 12 : open ? offset * 4 : 0
          const scale = raised ? 1.06 : 1

          return (
            <div
              key={c.title}
              className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2"
              style={{ zIndex: raised ? 60 : active === i ? 40 : i + 1 }}
            >
              <motion.button
                ref={(el) => {
                  btnRefs.current[i] = el
                }}
                type="button"
                tabIndex={active === i ? 0 : -1}
                aria-label={`${c.tag}: ${c.title}`}
                onMouseEnter={() => setLifted(i)}
                onMouseLeave={() => setLifted((v) => (v === i ? null : v))}
                onFocus={() => {
                  setOpen(true)
                  setLifted(i)
                  setActive(i)
                }}
                onBlur={() => setLifted((v) => (v === i ? null : v))}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKey(e, i)}
                initial={false}
                animate={{ rotate, y, x, scale }}
                transition={SPRING}
                style={{ transformOrigin: '50% 128%' }}
                className={`pointer-events-auto flex h-[280px] w-[186px] flex-col justify-between rounded-[1.4rem] border p-5 text-left shadow-2xl shadow-black/50 backdrop-blur-sm transition-colors focus:outline-none sm:h-[300px] sm:w-[212px] ${
                  raised
                    ? 'border-[#DCF87C]/45 bg-gradient-to-b from-white/[0.09] to-white/[0.02]'
                    : active === i
                      ? 'border-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.015]'
                      : 'border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">
                    {c.tag}
                  </span>
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      active === i ? 'bg-[#DCF87C]' : 'bg-white/20'
                    }`}
                  />
                </div>

                <div>
                  <h3 className="font-display text-2xl font-bold leading-[1.08] tracking-tight sm:text-3xl">
                    {c.title}
                  </h3>
                  <motion.p
                    initial={false}
                    animate={{ opacity: raised ? 1 : 0.5, y: raised ? 0 : 2 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="mt-2 text-sm leading-relaxed text-white/60"
                  >
                    {c.body}
                  </motion.p>
                </div>

                <span
                  aria-hidden
                  className="text-[0.7rem] font-semibold tabular-nums text-white/25"
                >
                  {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
                </span>
              </motion.button>
            </div>
          )
        })}
      </div>

      {/* The active card, named — also the roving-focus target for the dots. */}
      <div className="mt-6 flex items-center justify-center gap-2.5">
        {cards.map((c, i) => (
          <button
            key={c.title}
            type="button"
            tabIndex={-1}
            onClick={() => focus(i)}
            aria-label={`Raise ${c.title}`}
            aria-current={active === i}
            className="group relative h-2.5 w-2.5"
          >
            <span
              className={`absolute inset-0 rounded-full transition-colors ${
                active === i ? 'bg-[#DCF87C]' : 'bg-white/20 group-hover:bg-white/40'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
