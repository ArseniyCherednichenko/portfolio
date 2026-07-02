import { useReducedMotion } from 'framer-motion'
import type { CSSProperties } from 'react'

// BorderBeam — a small comet of light that travels around a rounded border.
// A conic gradient (a bright arc fading to transparent) is masked to a thin
// ring with the padding-box exclude trick, and its start angle spins via the
// registered `--bb-angle` custom property (see index.css), so the arc glides
// around the edge. In the spirit of 21st.dev / MagicUI border beams.
//
// It is a standalone, `pointer-events-none` overlay: drop it *inside* any
// `relative`, rounded, `overflow-hidden` surface (e.g. a SpotlightCard) and it
// traces that surface's border without touching layout or interaction. Match
// the host's corner radius via `rounded` so the ring follows the corners.
//
// Reduced-motion users never see it move: instead of the spinning comet it
// renders a single calm static ring, so the surface still reads as "framed"
// without any animation.

export function BorderBeam({
  className = '',
  rounded = 'rounded-3xl',
  /** Seconds for one full lap of the border. */
  duration = 6,
  /** Ring thickness, in pixels. */
  width = 1.5,
  /** Arc length of the travelling comet, in degrees (0–360). */
  arc = 62,
  /** Bright colour at the head of the comet. */
  color = '#DCF87C',
  /** Seconds to offset the start, so stacked beams can be phased apart. */
  delay = 0,
}: {
  className?: string
  rounded?: string
  duration?: number
  width?: number
  arc?: number
  color?: string
  delay?: number
}) {
  const reduce = useReducedMotion()

  // Mask the element down to just its border ring: the full box minus its
  // content box (inset by `width`) leaves a `width`-thick frame.
  const ringMask: CSSProperties = {
    padding: `${width}px`,
    WebkitMask:
      'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    maskComposite: 'exclude',
  }

  if (reduce) {
    // Calm static frame: a faint, even ring, no motion, no custom property.
    return (
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${rounded} ${className}`}
        style={{
          ...ringMask,
          background: `linear-gradient(0deg, ${color}, ${color})`,
          opacity: 0.22,
        }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${rounded} ${className}`}
      style={{
        ...ringMask,
        background: `conic-gradient(from var(--bb-angle), transparent 0deg, ${color} ${arc}deg, transparent ${arc * 1.6}deg)`,
        animation: `border-beam-spin ${duration}s linear infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  )
}
