import { type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

// RollingLink — a text link whose label rolls over on hover and keyboard focus.
//
// The classic award-site micro-interaction, built honestly from two stacked
// copies of the same word: the one on show lifts up and out while a second
// rises from below to take its place, each letter staggered a few milliseconds
// after the last so the label reads as a wave rolling across rather than a
// block sliding up. The travel is exactly one line-height and the frame clips,
// so nothing bleeds past the row — it works at any size because the motion is a
// full-height turn, not a pixel count.
//
// Honest about accessibility: the rolling structure is `aria-hidden` and the
// link carries a plain `aria-label`, so a screen reader hears the word once,
// not letter-by-letter and never doubled. It drives off CSS `group-hover` and
// `group-focus-visible`, so the Tab key triggers the exact same roll as the
// pointer. Under `prefers-reduced-motion` the roll is dropped entirely (checked
// in JS, the way the rest of the site does it) and the link gives its feedback
// as a calm colour change instead — no transform, no second copy.
//
// Distinct from FlowingMenu (a full image-reveal menu) and from the footer's
// hairline hover: this is a reusable inline link primitive, the premium default
// for a navigation map or an index.

// Per-letter stagger, in milliseconds. Small enough to feel like one gesture,
// large enough that the wave across the word is legible.
const STEP_MS = 22

export interface RollingLinkProps {
  /** The visible label. A string, because the effect splits it per character. */
  children: string
  /** Internal route (react-router). Takes precedence over `href`. */
  to?: string
  /** External URL. Rendered as a plain anchor, opened in a new tab. */
  href?: string
  /** Classes for the link box — set the base colour, size, and weight here. */
  className?: string
  /** Colour the incoming (rolled-in) copy lands in. Defaults to a brighter
   * white; `accent` lands it in the house lime for a louder reveal. */
  tone?: 'white' | 'accent' | 'inherit'
  /** Called on activation — e.g. to close a menu the link lives in. */
  onClick?: () => void
}

const TONE_CLASS: Record<NonNullable<RollingLinkProps['tone']>, string> = {
  white: 'text-white',
  accent: 'text-[#DCF87C]',
  inherit: '',
}

const EASE = 'cubic-bezier(0.16,1,0.3,1)'

// One row of letters. `incoming` rows start a line below and rise to home on
// hover/focus; outgoing rows start at home and lift a line up. Each letter is
// an inline-block so it can transform on its own, delayed by its index, so the
// turn reads as a wave left-to-right.
function Row({ text, incoming }: { text: string; incoming: boolean }) {
  const move = incoming
    ? 'translate-y-full group-hover:translate-y-0 group-focus-visible:translate-y-0'
    : 'translate-y-0 group-hover:-translate-y-full group-focus-visible:-translate-y-full'
  return (
    <span className="flex">
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          style={{ transitionDelay: `${i * STEP_MS}ms`, transitionTimingFunction: EASE }}
          className={`inline-block transition-transform duration-[450ms] will-change-transform ${move}`}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

export function RollingLink({ children, to, href, className = '', tone = 'white', onClick }: RollingLinkProps) {
  const reduce = useReducedMotion()
  const label = children

  // With motion, two stacked copies roll past each other inside a clipped,
  // single-line frame. Under reduced motion there is just the one copy and the
  // link leans on `className`'s own hover colour for feedback.
  const inner: ReactNode = reduce ? (
    <span>{label}</span>
  ) : (
    <span aria-hidden className="relative block overflow-hidden">
      <Row text={label} incoming={false} />
      <span className={`absolute inset-0 ${TONE_CLASS[tone]}`}>
        <Row text={label} incoming />
      </span>
    </span>
  )

  const cls = `group relative inline-flex outline-none ${className}`

  if (to) {
    return (
      <Link to={to} aria-label={reduce ? undefined : label} onClick={onClick} className={cls}>
        {inner}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={reduce ? undefined : label} onClick={onClick} className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" aria-label={reduce ? undefined : label} onClick={onClick} className={`${cls} text-left`}>
      {inner}
    </button>
  )
}
