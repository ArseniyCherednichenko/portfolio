import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

// The segmented, auto-advancing progress bar every "stories" surface grew — the
// thin row of bars across the top of an Instagram, WhatsApp or YouTube story
// that fills the active segment left-to-right, snaps the ones behind it full,
// and ticks on to the next when it brims. It is a different animal from the
// Progress primitive this library already carries: that one reports how far a
// single known task has got; this one *paces a sequence*, driving which slide is
// on show and giving the viewer the thread of where they are in it. It is the
// unglamorous product craft the pattern actually demands, and three details
// carry it.
//
// First, the clock is honest. The active segment's fill is driven by a single
// requestAnimationFrame loop that accumulates *real elapsed time* from the
// frame's own timestamp — not a CSS transition bound to a duration, and not a
// frame counter — so it keeps the same real speed at 60Hz or 120Hz, and a
// pause freezes it exactly where it stood rather than restarting the segment.
// The loop writes transform: scaleX straight to the fill element, so the hot
// path never touches React state until a segment actually completes.
//
// Second, it is pausable the way a real story is: press and hold anywhere on
// the viewport and it holds (so you can read the slide you are on), release and
// it resumes from where it froze. A tap on the left third steps back, the right
// two-thirds steps on — the gesture the pattern taught a billion thumbs.
//
// Third, it is reachable without a thumb at all. The viewport is a labelled
// group with real Previous / Next / Pause buttons beneath it, the arrow keys
// walk the sequence and Space toggles the pause, every slide change is
// announced through a polite live region, and the decorative bar is hidden from
// assistive tech. Under prefers-reduced-motion the loop never starts and
// autoplay is off entirely: the active segment simply shows full, and the
// viewer advances by hand — identical surface, nothing moving on a clock.

export interface StorySlide {
  /** Stable id, also used as the React key. */
  id: string
  /** Short label announced to assistive tech when this slide becomes active. */
  label: string
  /** The slide body. */
  content: ReactNode
}

export interface StoryProgressProps {
  slides: StorySlide[]
  /** Milliseconds each slide holds before advancing. Default 5000. */
  duration?: number
  /** Advance on its own. Default true (forced off under reduced motion). */
  autoplay?: boolean
  /** Return to the first slide after the last. Default true. */
  loop?: boolean
  /** Fires once the final slide finishes, when not looping. */
  onComplete?: () => void
  /** Fires whenever the active index changes. */
  onIndexChange?: (index: number) => void
  className?: string
}

export function StoryProgress({
  slides,
  duration = 5000,
  autoplay = true,
  loop = true,
  onComplete,
  onIndexChange,
  className = '',
}: StoryProgressProps) {
  const reduce = useReducedMotion()
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // Autoplay never runs under reduced motion — the viewer paces it by hand.
  const playing = autoplay && !reduce
  const baseId = useId()

  // One fill element per segment, written to directly by the rAF loop so the
  // active bar's growth never re-renders the component.
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([])
  const elapsedRef = useRef(0) // ms accrued on the current slide
  const rafRef = useRef(0)
  const lastTsRef = useRef<number | null>(null)

  const setFill = (i: number, frac: number) => {
    const el = fillRefs.current[i]
    if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`
  }

  // Paint the bar for a given active index: everything behind it full, the
  // active one empty (the loop grows it), everything ahead empty.
  const paintBars = useCallback(
    (active: number, activeFrac = 0) => {
      for (let i = 0; i < count; i++) {
        setFill(i, i < active ? 1 : i === active ? activeFrac : 0)
      }
    },
    [count],
  )

  const go = useCallback(
    (next: number) => {
      const clamped = ((next % count) + count) % count
      elapsedRef.current = 0
      lastTsRef.current = null
      setIndex(clamped)
    },
    [count],
  )

  const prev = useCallback(() => go(index - 1), [go, index])
  const next = useCallback(() => {
    if (index === count - 1 && !loop) {
      // At the end with no loop: fill the last bar and stop.
      elapsedRef.current = duration
      setFill(count - 1, 1)
      setPaused(true)
      onComplete?.()
      return
    }
    go(index + 1)
  }, [go, index, count, loop, duration, onComplete])

  // Reset the accrued time and repaint whenever the active slide changes, and
  // announce the change to listeners.
  useEffect(() => {
    elapsedRef.current = reduce ? duration : 0
    lastTsRef.current = null
    paintBars(index, reduce ? 1 : 0)
    onIndexChange?.(index)
    // onIndexChange is intentionally outside the dep list so a caller passing an
    // inline function can't retrigger this effect every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reduce, duration, paintBars])

  // The clock. Accumulates real elapsed time while playing and not paused, and
  // ticks to the next slide when the active segment brims. Skipped entirely
  // under reduced motion or when not autoplaying.
  useEffect(() => {
    if (!playing || paused) {
      lastTsRef.current = null
      return
    }
    const tick = (ts: number) => {
      if (lastTsRef.current !== null) {
        elapsedRef.current += ts - lastTsRef.current
      }
      lastTsRef.current = ts
      const frac = elapsedRef.current / duration
      if (frac >= 1) {
        setFill(index, 1)
        next()
        return
      }
      setFill(index, frac)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = null
    }
  }, [playing, paused, index, duration, next])

  // Hold-to-pause: pressing anywhere holds the clock, releasing resumes from
  // exactly where it froze. A quick tap pauses and resumes in the same breath
  // (no visible effect) and still lets the zone button's click navigate.
  const hold = () => playing && setPaused(true)
  const release = () => playing && setPaused(false)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      if (!playing) return
      e.preventDefault()
      setPaused((p) => !p)
    }
  }

  const active = slides[index]

  return (
    <div className={`w-full ${className}`}>
      {/* SEGMENTED BAR — decorative; the live region below carries the state. */}
      <div aria-hidden className="flex gap-1.5">
        {slides.map((s, i) => (
          <span key={s.id} className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <span
              ref={(el) => {
                fillRefs.current[i] = el
              }}
              className="absolute inset-0 origin-left rounded-full bg-[#DCF87C]"
              style={{ transform: 'scaleX(0)' }}
            />
          </span>
        ))}
      </div>

      {/* VIEWPORT — hold to pause, tap the sides to step. A labelled group so a
          keyboard reaches the arrow / space handling without a mouse. */}
      <div
        role="group"
        aria-label="Story"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={hold}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        className="group relative mt-3 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        <div className="relative z-0 min-h-[13rem] p-7 sm:min-h-[14rem] sm:p-9">{active?.content}</div>

        {/* Tap zones — the stories gesture. Real buttons, so they are keyboard-
            and pointer-reachable, but hidden from the reading order (the labelled
            controls below are the announced path). */}
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={prev}
          className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default focus:outline-none"
        />
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={next}
          className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-default focus:outline-none"
        />

        {/* Held-state hint — only while actually paused by a hold. */}
        {playing && paused && (
          <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-white/15 bg-black/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-sm">
            Paused
          </span>
        )}
      </div>

      {/* CONTROLS — the reachable path. Previous / Pause / Next, plus a readout
          of where you are. The pause toggle is absent under reduced motion,
          where there is no clock to pause. */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          >
            <span aria-hidden>&larr; </span>Prev
          </button>
          {playing && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            >
              {paused ? 'Play' : 'Pause'}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          >
            Next<span aria-hidden> &rarr;</span>
          </button>
        </div>
        <span className="font-display text-sm tabular-nums text-white/40">
          <span className="text-[#DCF87C]">{String(index + 1).padStart(2, '0')}</span>
          <span className="px-1 text-white/20">/</span>
          {String(count).padStart(2, '0')}
        </span>
      </div>

      {/* The honest channel to assistive tech: the decorative bar says nothing,
          so the current slide is announced here instead. */}
      <p id={`${baseId}-status`} aria-live="polite" className="sr-only">
        {active ? `Slide ${index + 1} of ${count}: ${active.label}` : ''}
      </p>
    </div>
  )
}
