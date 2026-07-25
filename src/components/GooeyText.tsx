import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A word that melts into the next. Two text layers are stacked and wrapped in
// an SVG gooey filter (feGaussianBlur → an alpha-crushing feColorMatrix, the
// same metaball trick GooeyTabs uses on its blobs). During a swap the outgoing
// word blurs and fades while the incoming one sharpens and fades in; because
// both live under the gooey filter, their blurred glyph-halos fuse into a
// single liquid mass at the midpoint before resolving into clean type — so the
// change reads as one word physically morphing into the next, not a crossfade.
//
// Distinct from GooeyTabs (a moving pill) and MetaBalls (drifting blobs): here
// the fusing shapes are letters. Honest to assistive tech — the live word is
// announced via an aria-live region and the visual glyphs are aria-hidden.
//
// Reduced motion drops the morph entirely: the words swap as a plain, instant
// cross-fade with no blur and no gooey filter, fully legible throughout.

export interface GooeyTextProps {
  /** The words to cycle through, in order. */
  words: string[]
  /** Milliseconds each word holds before morphing to the next. */
  interval?: number
  /** Milliseconds the melt itself takes. */
  morph?: number
  /** Peak blur (px) each layer reaches at the midpoint of a swap. */
  blur?: number
  /** Accessible label prefix, e.g. "I build" → announces "I build motion". */
  label?: string
  className?: string
}

// Module-scoped counter keeps every instance on its own filter id without
// reaching for Math.random (kept deterministic) or useId churn.
let gooTextSeq = 0

export function GooeyText({
  words,
  interval = 2600,
  morph = 900,
  blur = 14,
  label,
  className = '',
}: GooeyTextProps) {
  const reduce = useReducedMotion()
  const [filterId] = useState(() => `goo-text-${gooTextSeq++}`)
  const [index, setIndex] = useState(0)
  // `t` runs 0 → 1 across one morph: 0 rests on the current word, 1 has fully
  // arrived at the next (which then becomes current and t resets).
  const [t, setT] = useState(0)
  const rafRef = useRef<number | null>(null)
  const holdRef = useRef<number | null>(null)

  const count = words.length
  const current = words[index % count]
  const next = words[(index + 1) % count]

  useEffect(() => {
    if (reduce || count < 2) return
    let cancelled = false

    const scheduleHold = () => {
      holdRef.current = window.setTimeout(runMorph, interval)
    }

    const runMorph = () => {
      const start = performance.now()
      const tick = (now: number) => {
        if (cancelled) return
        const p = Math.min(1, (now - start) / morph)
        setT(p)
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          // Land on the next word and reset for the following cycle.
          setIndex((i) => (i + 1) % count)
          setT(0)
          scheduleHold()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    scheduleHold()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (holdRef.current) window.clearTimeout(holdRef.current)
    }
    // Re-arm the loop only when the inputs that define it change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, count, interval, morph])

  // Ease the raw progress so the melt lingers at its liquid midpoint.
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x)
  const e = ease(t)
  // Outgoing word: sharp and solid at t=0, blurred and gone by t=1.
  const outOpacity = 1 - e
  const outBlur = blur * e
  // Incoming word: blurred and invisible at t=0, sharp and solid by t=1.
  const inOpacity = e
  const inBlur = blur * (1 - e)

  const announced = [label, current].filter(Boolean).join(' ')

  if (reduce || count < 2) {
    return (
      <span className={className} aria-label={label ? announced : undefined}>
        {reduce ? current : words[0]}
      </span>
    )
  }

  return (
    <span
      className={`relative inline-block ${className}`}
      role="text"
      aria-label={announced}
    >
      {/* Live region so screen readers hear each word as it settles. */}
      <span className="sr-only" aria-live="polite">
        {announced}
      </span>

      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      {/* Both words share one grid cell so they stack exactly and the box sizes
          to the widest word — no layout shift as it cycles. The gooey filter
          on this wrapper fuses their blurred glyph-halos mid-morph. */}
      <span
        aria-hidden
        className="grid"
        style={{ filter: `url(#${filterId})` }}
      >
        <span
          className="block whitespace-nowrap [grid-area:1/1]"
          style={{ opacity: outOpacity, filter: `blur(${outBlur}px)` }}
        >
          {current}
        </span>
        <span
          className="block whitespace-nowrap [grid-area:1/1]"
          style={{ opacity: inOpacity, filter: `blur(${inBlur}px)` }}
        >
          {next}
        </span>
      </span>
    </span>
  )
}
