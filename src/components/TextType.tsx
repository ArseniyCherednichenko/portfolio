import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A typewriter that types a phrase out character by character, holds, deletes
// it, and moves on to the next — a blinking caret riding the end the whole
// time. It is a genuinely different *kind* of text motion from the rest of the
// library: DecryptedText resolves glyphs out of noise, GooeyText melts one word
// into the next, SplitFlap hinges a whole glyph, SplitText lifts letters into
// place. This one is the classic terminal cadence — keystrokes appearing and
// erasing — so it earns its home on the /terminal page.
//
// Honest to the machine underneath: there is no per-frame React state on a hot
// path, just a single self-rescheduling timeout that advances one character at
// a time (typing, holding, deleting, gapping), and it clears itself on unmount.
// The caret blink is a CSS keyframe (`text-type-blink` in index.css), so the
// site-wide reduced-motion guard stills it automatically.
//
// Honest to assistive tech: the container carries the full set of phrases as
// its `aria-label` (or a caller-supplied one) and every visual span is
// aria-hidden, so a screen reader is never fed a half-typed word.
//
// Reduced motion drops the whole machine: it renders the first phrase in full
// with a steady (non-blinking) caret — nothing is gated behind the animation.

type CaretShape = 'bar' | 'block' | 'underscore'

export interface TextTypeProps {
  /** The phrases to type, in order. With one phrase and `loop={false}` it types once and stops. */
  phrases: string[]
  /** Milliseconds per character while typing. */
  typingSpeed?: number
  /** Milliseconds per character while deleting. */
  deletingSpeed?: number
  /** Milliseconds a fully-typed phrase holds before it starts erasing. */
  holdMs?: number
  /** Milliseconds to wait, empty, before the next phrase begins. */
  gapMs?: number
  /** Milliseconds before the very first character appears. */
  startDelay?: number
  /** Cycle forever (default). When false it types the last phrase and rests. */
  loop?: boolean
  /** Show the trailing caret. */
  showCaret?: boolean
  /** Caret geometry — a thin bar, a solid terminal block, or an underscore. */
  caret?: CaretShape
  /** Classes for the caret (colour etc). Defaults to the lime accent. */
  caretClassName?: string
  /** The element the line renders as. */
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3'
  className?: string
  /** Overrides the derived aria-label (defaults to the phrases joined). */
  'aria-label'?: string
}

interface Cursor {
  /** Index of the current phrase. */
  i: number
  /** How many characters are currently shown. */
  n: number
  /** True while erasing back toward empty. */
  del: boolean
}

const CARET_SHAPE: Record<CaretShape, string> = {
  bar: 'w-[0.09em] h-[1.05em] rounded-[1px]',
  block: 'w-[0.58em] h-[1.05em] rounded-[1px]',
  underscore: 'w-[0.62em] h-[0.12em] self-end mb-[0.12em] rounded-[1px]',
}

export function TextType({
  phrases,
  typingSpeed = 62,
  deletingSpeed = 34,
  holdMs = 1500,
  gapMs = 420,
  startDelay = 260,
  loop = true,
  showCaret = true,
  caret = 'bar',
  caretClassName = 'bg-[#DCF87C]',
  as: Tag = 'span',
  className = '',
  'aria-label': ariaLabel,
}: TextTypeProps) {
  const reduce = useReducedMotion()
  const [{ i, n, del }, setCursor] = useState<Cursor>({ i: 0, n: 0, del: false })

  // Keep the latest phrases without making them a dep (an inline array would
  // otherwise reset the machine on every parent render).
  const phrasesRef = useRef(phrases)
  phrasesRef.current = phrases
  const key = phrases.join('␞')

  // Applied exactly once, before the first character.
  const startedRef = useRef(false)

  useEffect(() => {
    if (reduce) return
    const list = phrasesRef.current
    if (list.length === 0) return
    const phrase = list[i] ?? ''

    let delay: number
    let next: Cursor

    if (!del && n < phrase.length) {
      // Still typing this phrase.
      delay = typingSpeed
      next = { i, n: n + 1, del: false }
    } else if (!del && n >= phrase.length) {
      // Fully typed. Stop here if we are not looping and this is the last one.
      if (!loop && i === list.length - 1) return
      delay = holdMs
      next = { i, n, del: true }
    } else if (del && n > 0) {
      // Erasing.
      delay = deletingSpeed
      next = { i, n: n - 1, del: true }
    } else {
      // Empty — advance to the next phrase.
      delay = gapMs
      next = { i: (i + 1) % list.length, n: 0, del: false }
    }

    const extra = startedRef.current ? 0 : startDelay
    const id = window.setTimeout(() => {
      startedRef.current = true
      setCursor(next)
    }, delay + extra)
    return () => window.clearTimeout(id)
    // key stands in for the phrases array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n, del, reduce, key, typingSpeed, deletingSpeed, holdMs, gapMs, startDelay, loop])

  const full = phrases[reduce ? 0 : i] ?? ''
  const shown = reduce ? full : full.slice(0, n)

  return (
    <Tag
      className={`inline-flex items-baseline ${className}`}
      aria-label={ariaLabel ?? phrases.join('. ')}
      role="text"
    >
      <span aria-hidden="true" className="whitespace-pre-wrap">
        {shown}
      </span>
      {showCaret && (
        <span
          aria-hidden="true"
          className={`ml-[0.06em] inline-block translate-y-[0.06em] align-baseline ${
            reduce ? '' : 'text-type-caret'
          } ${CARET_SHAPE[caret]} ${caretClassName}`}
        />
      )}
    </Tag>
  )
}

export default TextType
