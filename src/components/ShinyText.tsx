import { type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

// ShinyText — a soft highlight that sweeps once across otherwise-muted text, on
// a loop. Where GradientText is a bold, editorial white↔lime wash for
// headlines, this is the quiet cousin: the copy sits dim and legible, and a
// single band of light drifts through it now and then, the way a label catches
// the light. Built for small runs — eyebrows, status lines, datelines — not
// display type.
//
// Mechanics: the muted base colour and the brighter highlight are two stops of
// one horizontal gradient that is background-clipped to the glyphs; a long,
// mostly-flat ramp keeps the text at its base tone with a tight bright notch
// that the `shine` keyframe slides across (reusing the same keyframe Gradient
// Text does, so there is one source of that motion). Under reduced motion the
// sweep is dropped entirely and the text simply rests at its base colour —
// fully legible, no clip trickery — rather than freezing mid-sweep.

type Tone = 'mono' | 'lime'

const TONES: Record<Tone, { base: string; hi: string }> = {
  // A dim white that brightens toward full white as the band passes.
  mono: { base: 'rgba(255,255,255,0.42)', hi: 'rgba(255,255,255,0.95)' },
  // The muted state stays neutral; the highlight is the site's lime.
  lime: { base: 'rgba(255,255,255,0.42)', hi: '#DCF87C' },
}

export function ShinyText({
  children,
  className = '',
  tone = 'mono',
  /** Seconds for one full sweep. Slower reads calmer. */
  speed = 5,
}: {
  children: ReactNode
  className?: string
  tone?: Tone
  speed?: number
}) {
  const reduce = useReducedMotion()
  const { base, hi } = TONES[tone]

  // Reduced motion (and SSR-safe default): plain muted text, no gradient sweep.
  if (reduce) {
    return (
      <span className={className} style={{ color: base }}>
        {children}
      </span>
    )
  }

  return (
    <span
      className={`bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(110deg, ${base} 0%, ${base} 40%, ${hi} 50%, ${base} 60%, ${base} 100%)`,
        backgroundSize: '220% auto',
        WebkitBackgroundClip: 'text',
        animation: `shine ${speed}s linear infinite`,
      }}
    >
      {children}
    </span>
  )
}
