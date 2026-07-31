import { motion, useReducedMotion } from 'framer-motion'
import { type ReactNode, useId } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

interface HighlighterProps {
  /** The words to emphasise. Kept as real, selectable text — the mark sits behind it. */
  children: ReactNode
  className?: string
  /** The marker colour. Defaults to the site's lime, carried at low alpha so text stays legible. */
  color?: string
  /** How the stroke arrives. 'inView' sweeps once when scrolled into view (default);
   *  'mount' sweeps immediately; 'hover' paints on pointer-enter and wipes on leave. */
  trigger?: 'inView' | 'mount' | 'hover'
  /** Seconds before the stroke begins. */
  delay?: number
  /** Seconds the stroke takes to travel across the words. */
  duration?: number
  /** Band thickness as a fraction of the line — 1 covers the whole line height. */
  thickness?: number
  /** A tiny rotation, in degrees, so the mark reads hand-drawn rather than printed. */
  tilt?: number
  /** Draw a thinner band that sits under the text like an underline, instead of behind it. */
  underline?: boolean
}

// A marker-pen highlight that sweeps in behind (or under) a run of words. The
// signature is the stroke: a translucent band with soft, slightly uneven ends
// that grows left-to-right from nothing, transform-origin left, like a
// highlighter dragged once across the line — a different feel from DrawSVG's
// hand-drawn underline (which traces a real vector path) or SpotlightReveal's
// cursor-driven mask (which uncovers hidden text). In the spirit of Aceternity /
// React Bits' Highlighter. The text stays real, selectable, and on top; the mark
// is aria-hidden decoration painted behind it, so nothing is hidden from
// assistive tech or from copy-paste. Under reduced motion the band renders fully
// painted and still — the emphasis lands, the animation does not.
export function Highlighter({
  children,
  className = '',
  color = 'rgba(220, 248, 124, 0.42)',
  trigger = 'inView',
  delay = 0,
  duration = 0.7,
  thickness = 0.62,
  tilt = -1.4,
  underline = false,
}: HighlighterProps) {
  const reduce = useReducedMotion()
  const gid = useId()

  // The band geometry. Behind-text mode centres a fat band on the line; underline
  // mode drops a thinner band to the baseline. Slightly over-wide so the soft ends
  // clear the first and last glyph.
  const bandHeight = underline ? '0.28em' : `${thickness}em`
  const bandBottom = underline ? '0.02em' : `${(1 - thickness) / 2}em`

  // Rounded, faintly rough ends via an asymmetric radius — a marker doesn't stop
  // in a clean rectangle. A second soft edge on the far side keeps it from reading
  // like a progress bar.
  const band = (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[-0.12em] right-[-0.12em] z-0 origin-left overflow-hidden"
      style={{ bottom: bandBottom, height: bandHeight }}
    >
      {reduce ? (
        <span
          className="block h-full w-full"
          style={{
            background: color,
            borderRadius: '0.45em 0.6em 0.5em 0.4em',
            transform: `rotate(${tilt}deg)`,
          }}
        />
      ) : (
        <motion.span
          className="block h-full w-full will-change-transform"
          style={{
            background: color,
            borderRadius: '0.45em 0.6em 0.5em 0.4em',
            transform: `rotate(${tilt}deg)`,
            transformOrigin: 'left center',
          }}
          variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
          transition={{ duration, ease: EASE, delay }}
        />
      )}
    </span>
  )

  // Shared inner: the mark behind, the real text in front. `align-baseline` and
  // inline layout keep it flowing inside a heading or paragraph.
  const inner = (
    <>
      {band}
      <span className="relative z-10">{children}</span>
    </>
  )

  if (reduce) {
    return (
      <span className={`relative inline align-baseline ${className}`} data-highlighter={gid}>
        {inner}
      </span>
    )
  }

  if (trigger === 'hover') {
    return (
      <motion.span
        className={`relative inline align-baseline ${className}`}
        initial="hidden"
        whileHover="shown"
        data-highlighter={gid}
      >
        {inner}
      </motion.span>
    )
  }

  const anim =
    trigger === 'mount'
      ? { initial: 'hidden' as const, animate: 'shown' as const }
      : {
          initial: 'hidden' as const,
          whileInView: 'shown' as const,
          viewport: { once: true, margin: '-60px' },
        }

  return (
    <motion.span className={`relative inline align-baseline ${className}`} data-highlighter={gid} {...anim}>
      {inner}
    </motion.span>
  )
}
