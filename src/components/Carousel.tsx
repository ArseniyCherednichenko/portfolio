import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

// A stories-style carousel — the auto-advancing "tap through" pattern the
// library never had. Deliberately distinct from its nearest neighbours:
// CircularGallery fans cards into a draggable 3D coverflow you scrub by hand,
// CardStack quietly cycles a passive 3D deck on a timer, InfiniteScroll loops a
// column that never re-orders — this one runs a *timed sequence* of full panels
// with a row of segmented progress bars filling across the top, the way an
// Instagram / stories viewer does. The bar is the clock: the active segment
// fills over `interval`, and when it tops out the panel advances. You can hold
// to pause, click the edges (or the arrows) to step, swipe on touch, jump by
// tapping a segment, and drive it all from the keyboard. Honest to AT: a polite
// live region names the current panel, the controls are real buttons, and under
// reduced motion the auto-run and fill are dropped — it becomes a plain,
// manually-stepped, fully-legible sequence.

export interface CarouselSlide {
  id: string
  /** The panel body. Keep it non-interactive — the edges are click targets. */
  content: React.ReactNode
  /** Short label read into the live region as each panel becomes active. */
  label?: string
}

interface CarouselProps {
  slides: CarouselSlide[]
  /** Milliseconds each panel holds before advancing. */
  interval?: number
  className?: string
  /** Names the whole widget for assistive tech. */
  label?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

export function Carousel({ slides, interval = 5200, className = '', label = 'Highlights' }: CarouselProps) {
  const reduce = useReducedMotion()
  const count = slides.length
  const [active, setActive] = useState(0)
  // 1 = moving forward, -1 = back — the enter/exit drift reads the direction.
  const [dir, setDir] = useState(1)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)

  // Elapsed time on the current panel (ms), kept in a ref so the frame loop can
  // drive the fill straight onto the DOM with no React render per frame.
  const elapsed = useRef(0)
  const fillRef = useRef<HTMLSpanElement | null>(null)

  const go = useCallback(
    (next: number, d: number) => {
      elapsed.current = 0
      setDir(d)
      setActive(((next % count) + count) % count)
    },
    [count],
  )
  const next = useCallback(() => go(active + 1, 1), [active, go])
  const prev = useCallback(() => go(active - 1, -1), [active, go])

  // Reset the clock (and the fill) whenever the active panel changes for any
  // reason — auto-advance, a click, a swipe, or the keyboard.
  useEffect(() => {
    elapsed.current = 0
    if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)'
  }, [active])

  useAnimationFrame((_, delta) => {
    if (reduce || paused || held || count < 2) return
    // Clamp so a backgrounded tab can't jump several panels at once on return.
    const dt = Math.min(delta, 64)
    elapsed.current += dt
    const p = elapsed.current / interval
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${p < 1 ? p : 1})`
    if (p >= 1) go(active + 1, 1)
  })

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    },
    [next, prev],
  )

  const slide = slides[active]

  // Enter/exit drift — a small horizontal slide with a soft blur, direction-aware.
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 44, filter: reduce ? 'none' : 'blur(6px)' }),
    center: { opacity: 1, x: 0, filter: 'blur(0px)' },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -44, filter: reduce ? 'none' : 'blur(6px)' }),
  }

  return (
    <div
      className={`relative w-full max-w-xl select-none ${className}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => {
        setPaused(false)
        setHeld(false)
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false)
      }}
    >
      {/* Segmented progress — completed panels sit full, the active one fills. */}
      <div className="mb-5 flex gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i, i > active ? 1 : -1)}
            className="group relative h-1 flex-1 overflow-hidden rounded-full bg-white/12 outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
            aria-label={`Go to panel ${i + 1} of ${count}`}
            aria-current={i === active ? 'true' : undefined}
          >
            {/* A larger invisible hit area so the thin bar is easy to tap. */}
            <span aria-hidden className="absolute -inset-y-2 inset-x-0" />
            {i < active && <span aria-hidden className="absolute inset-0 bg-[#DCF87C]" />}
            {i === active && (
              <span
                ref={fillRef}
                aria-hidden
                className="absolute inset-0 origin-left bg-[#DCF87C]"
                style={{ transform: reduce ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* The stage. Edges step; a swipe throws to the next panel on touch. */}
      <div className="relative min-h-[13rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={slide.id}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
            drag={reduce || count < 2 ? false : 'x'}
            dragElastic={0.16}
            dragConstraints={{ left: 0, right: 0 }}
            onDragStart={() => setHeld(true)}
            onDragEnd={(_, info) => {
              setHeld(false)
              if (info.offset.x < -70 || info.velocity.x < -450) next()
              else if (info.offset.x > 70 || info.velocity.x > 450) prev()
            }}
            className="absolute inset-0 flex items-center justify-center px-8 py-10"
            style={{ touchAction: 'pan-y' }}
          >
            {slide.content}
          </motion.div>
        </AnimatePresence>

        {/* Press-and-hold anywhere pauses, stories-style; a plain click on an
            edge steps. Kept aria-hidden — the real controls are the arrows and
            the segment buttons below. */}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
              onPointerDown={() => setHeld(true)}
              onPointerUp={() => setHeld(false)}
              onClick={prev}
            />
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize"
              onPointerDown={() => setHeld(true)}
              onPointerUp={() => setHeld(false)}
              onClick={next}
            />
          </>
        )}
      </div>

      {/* Explicit, labelled controls — the accessible path through the panels. */}
      {count > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous panel"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-white/70 outline-none transition-colors hover:border-[#DCF87C]/50 hover:text-white focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-xs tabular-nums tracking-[0.2em] text-white/40">
            {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={next}
            aria-label="Next panel"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-white/70 outline-none transition-colors hover:border-[#DCF87C]/50 hover:text-white focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {`Panel ${active + 1} of ${count}${slide.label ? `: ${slide.label}` : ''}`}
      </span>
    </div>
  )
}
