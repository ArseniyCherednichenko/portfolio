import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A word that tears into a digital glitch: two colour-split ghost copies of the
// text sit exactly over a clean base and, during a burst, snap to sliced
// horizontal offsets under a `screen` blend — the classic chromatic-aberration
// signal-corruption look. Deliberately distinct from its text-family
// neighbours: FuzzyText shears clean grayscale scanlines sideways, LetterGlitch
// flickers a whole canvas glyph field, DecryptedText scrambles glyphs into
// place — this one keeps the word crisp and readable and rips coloured channels
// off it in slices. The base layer is untouched real text (always legible,
// selectable, spoken once via `aria-label`); the two ghosts are `aria-hidden`
// decoration that only appear while glitching. The slice animation lives in CSS
// keyframes (`glitch-a`/`glitch-b`, snapped with `steps(1)` so it cuts rather
// than slides) so nothing renders per frame; React only toggles the burst
// class. Under reduced motion the ghosts are dropped entirely — just the clean
// word, no timers, no listeners.
type Trigger = 'auto' | 'hover' | 'always'

export function GlitchText({
  text,
  trigger = 'auto',
  intensity = 4,
  colors = ['#5AE9FF', '#DCF87C'],
  interval = 2800,
  burst = 450,
  className = '',
}: {
  text: string
  /** 'auto' bursts on an interval, 'hover' glitches while hovered/focused, 'always' runs continuously. */
  trigger?: Trigger
  /** Peak horizontal slice offset, in px. */
  intensity?: number
  /** The two channel-ghost colours [cyan-ish, lime]. */
  colors?: [string, string]
  /** Gap between auto bursts, in ms. */
  interval?: number
  /** How long one auto burst runs, in ms. */
  burst?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [glitching, setGlitching] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (reduce || trigger !== 'auto') return
    let cancelled = false
    const clearAll = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    const schedule = () => {
      if (cancelled) return
      // a burst, then rest, then round again — the whole cycle is one gap
      setGlitching(true)
      timers.current.push(
        window.setTimeout(() => {
          if (cancelled) return
          setGlitching(false)
          timers.current.push(window.setTimeout(schedule, Math.max(0, interval - burst)))
        }, burst),
      )
    }
    // a small initial offset so several instances on a page don't strobe in lockstep
    timers.current.push(window.setTimeout(schedule, 600))
    return () => {
      cancelled = true
      clearAll()
    }
  }, [reduce, trigger, interval, burst])

  // Reduced motion (or a bare string with no effect wanted): clean text only.
  if (reduce) {
    return (
      <span className={className} aria-label={text}>
        {text}
      </span>
    )
  }

  const active = trigger === 'always' || (trigger === 'auto' && glitching)
  const hoverProps =
    trigger === 'hover'
      ? {
          onPointerEnter: () => setGlitching(true),
          onPointerLeave: () => setGlitching(false),
          onFocus: () => setGlitching(true),
          onBlur: () => setGlitching(false),
          tabIndex: 0,
        }
      : {}
  const on = active || (trigger === 'hover' && glitching)

  return (
    <span
      className={`glitch relative inline-block ${on ? 'is-glitching' : ''} ${className}`}
      style={{ ['--glitch-x' as string]: `${intensity}px` }}
      data-text={text}
      aria-label={text}
      {...hoverProps}
    >
      <span aria-hidden className="glitch-layer glitch-layer--a" style={{ color: colors[0] }}>
        {text}
      </span>
      <span aria-hidden className="glitch-layer glitch-layer--b" style={{ color: colors[1] }}>
        {text}
      </span>
      <span className="relative">{text}</span>
    </span>
  )
}
