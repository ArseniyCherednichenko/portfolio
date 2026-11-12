import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import { Link } from 'react-router-dom'

// A living "right now" spotlight: one current focus at a time, auto-advancing
// on a gentle timer with a progress ring that fills as it goes, then crossfading
// to the next. It is the Now page's answer to "what is the single thing today",
// where the grid below it is the whole stretch at once — so the page opens with
// a sense of a pulse rather than a static list.
//
// It is deliberately honest about de-centering any one project: Guided is just
// one frame in the reel, given exactly as much room as the motion practice, the
// SwiftUI learning, or the studying. Nothing here invents a claim — it reads the
// same real NOW_ITEMS the rest of the page does.
//
// Everything bows to prefers-reduced-motion: the auto-advance and the ring fill
// both switch off, the crossfade becomes an instant swap, and the reel is driven
// entirely by the manual controls, which stay fully keyboard-reachable either
// way (left/right arrows on the reel, a dot per focus, and a play/pause toggle).

const EASE = [0.16, 1, 0.3, 1] as const

export interface FocusRotatorItem {
  label: string
  title: string
  body: string
  to?: string
  toLabel?: string
}

// Geometry for the progress ring drawn around the step index.
const RING = 48
const STROKE = 2.5
const R = (RING - STROKE) / 2
const CIRC = 2 * Math.PI * R

export function FocusRotator({
  items,
  intervalMs = 6000,
  className = '',
}: {
  items: readonly FocusRotatorItem[]
  intervalMs?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = items.length

  // Elapsed time within the current frame's dwell, tracked in a ref so the RAF
  // loop never has to re-render to accumulate. `progress` (0..1) is the motion
  // value the ring reads; it is set at most once per frame.
  const elapsedRef = useRef(0)
  const progress = useMotionValue(0)
  const dashOffset = useTransform(progress, [0, 1], [CIRC, 0])

  const canAuto = !reduce && !paused && count > 1

  const reset = useCallback(() => {
    elapsedRef.current = 0
    progress.set(0)
  }, [progress])

  const go = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count)
      reset()
    },
    [count, reset],
  )

  // Single RAF loop drives both the ring fill and the advance, so pausing truly
  // pauses (the ring holds where it is) rather than drifting out of step.
  useAnimationFrame((_t, delta) => {
    if (!canAuto) return
    elapsedRef.current += delta
    const p = elapsedRef.current / intervalMs
    if (p >= 1) {
      setIndex((i) => (i + 1) % count)
      reset()
    } else {
      progress.set(p)
    }
  })

  // If the active item ever falls out of range (items shrink), clamp it.
  useEffect(() => {
    if (index > count - 1) go(0)
  }, [count, index, go])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(index - 1)
    }
  }

  if (count === 0) return null
  const item = items[Math.min(index, count - 1)]
  const multi = count > 1

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] ${className}`}
      // The reel pauses while the pointer is over it or focus is inside it, so a
      // reader is never raced off a focus they are in the middle of.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false)
      }}
    >
      {/* Soft lime wash in the top-left, the same accent the dateline uses. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#DCF87C]/10 blur-3xl"
      />

      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="What I am focused on right now"
        tabIndex={multi ? 0 : -1}
        onKeyDown={multi ? onKeyDown : undefined}
        className="relative flex flex-col gap-6 p-7 outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40 focus-visible:ring-inset sm:p-9 lg:flex-row lg:items-stretch lg:gap-9"
      >
        {/* INDEX + RING — the step marker, wrapped in a timer ring that fills as
            the dwell runs down. Under reduced motion the ring is a calm static
            band and the number simply changes. */}
        <div className="flex shrink-0 items-center gap-4 lg:flex-col lg:items-start lg:justify-between">
          <div className="relative" style={{ width: RING, height: RING }}>
            <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 -rotate-90">
              <circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE}
                className="text-white/10"
              />
              {!reduce && multi && (
                <motion.circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={R}
                  fill="none"
                  stroke="#DCF87C"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  style={{ strokeDashoffset: dashOffset }}
                />
              )}
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold tabular-nums text-[#DCF87C]">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          {multi && (
            <span className="font-display text-sm tabular-nums text-white/25 lg:mt-auto">
              / {String(count).padStart(2, '0')}
            </span>
          )}
        </div>

        {/* CONTENT — crossfades between focuses. aria-live keeps a screen reader
            in step as the active focus changes under the timer. */}
        <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: reduce ? 0.2 : 0.45, ease: EASE }}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">
                {item.label}
              </span>
              <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {item.title}
              </h3>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/60">{item.body}</p>
              {item.to && (
                <Link
                  to={item.to}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 transition-colors hover:text-[#DCF87C]"
                >
                  {item.toLabel ?? 'See more'}
                  <span aria-hidden>&rarr;</span>
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* CONTROLS — a dot per focus, prev/next, and a play/pause toggle. Hidden
          entirely when there is only one focus to show. */}
      {multi && (
        <div className="relative flex items-center justify-between gap-4 border-t border-white/[0.07] px-7 py-4 sm:px-9">
          <div className="flex items-center gap-2.5" role="tablist" aria-label="Focuses">
            {items.map((it, i) => {
              const on = i === index
              return (
                <button
                  key={it.label}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={`Focus ${i + 1}: ${it.title}`}
                  onClick={() => go(i)}
                  className="group/dot relative flex h-5 items-center"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      on ? 'w-6 bg-[#DCF87C]' : 'w-1.5 bg-white/25 group-hover/dot:bg-white/45'
                    }`}
                  />
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            {!reduce && (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                aria-label={paused ? 'Resume the reel' : 'Pause the reel'}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
              >
                {paused ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                    <path d="M2.5 1.5v9l7-4.5z" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                    <rect x="2.5" y="1.5" width="2.5" height="9" rx="0.5" />
                    <rect x="7" y="1.5" width="2.5" height="9" rx="0.5" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous focus"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M8.5 3.5L5 7l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next focus"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M5.5 3.5L9 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
