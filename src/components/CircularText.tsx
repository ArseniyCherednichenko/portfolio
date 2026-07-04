import { motion, useReducedMotion } from 'framer-motion'
import { type ReactNode, useMemo } from 'react'

interface CircularTextProps {
  /** The string laid out around the ring. A separator (e.g. " · ") reads best. */
  text: string
  /** Radius of the text ring in px. */
  radius?: number
  /** Seconds for one full rotation. */
  spin?: number
  /** Rotate counter-clockwise instead of clockwise. */
  reverse?: boolean
  /** Optional content pinned in the centre (an arrow, a dot, a mark). */
  children?: ReactNode
  /** If set, the whole seal becomes an anchor (in-page or external). */
  href?: string
  /** Accessible label for the link/seal. */
  label?: string
  className?: string
}

// A rotating circular text "seal", in the spirit of React Bits' CircularText.
// Each character is placed around a circle (absolute + per-char rotation), and
// the whole ring rotates at a constant linear rate. The real string is exposed
// once via an accessible label while every glyph is aria-hidden, so it reads
// cleanly to assistive tech. Under reduced motion the ring sits still (no loop),
// and hovering nudges the spin a touch faster for a hint of life.
export function CircularText({
  text,
  radius = 62,
  spin = 20,
  reverse = false,
  children,
  href,
  label,
  className = '',
}: CircularTextProps) {
  const reduce = useReducedMotion()
  const chars = useMemo(() => Array.from(text), [text])
  const step = 360 / chars.length
  const size = radius * 2 + 44

  const ring = (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role={href ? undefined : 'img'}
      aria-label={href ? undefined : label ?? text}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0"
        animate={reduce ? undefined : { rotate: reverse ? -360 : 360 }}
        transition={reduce ? undefined : { duration: spin, ease: 'linear', repeat: Infinity }}
        whileHover={reduce ? undefined : { scale: 1.04 }}
      >
        {chars.map((ch, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 origin-top text-[11px] font-semibold uppercase tracking-[0.35em] text-white/55"
            style={{
              transform: `translate(-50%, -50%) rotate(${i * step}deg) translateY(-${radius}px)`,
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </motion.div>
      {children && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#DCF87C]">
          {children}
        </span>
      )}
    </div>
  )

  if (!href) return <div className={className}>{ring}</div>

  const external = /^https?:/.test(href)
  return (
    <a
      href={href}
      aria-label={label ?? text}
      className={`group inline-flex transition-transform duration-300 hover:scale-[1.03] ${className}`}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {ring}
    </a>
  )
}
