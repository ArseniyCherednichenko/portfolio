import type { ReactNode } from 'react'

// GlareHover — a reusable premium "light sweep" overlay. On hover, a soft,
// skewed band of light glides diagonally across the surface, then slides back
// out the way it came. Pure CSS (no JS state, no Framer), so it is cheap and
// composes anywhere; the sweep is clipped to the wrapper's rounded shape.
//
// Two trigger modes:
//   - 'self'  (default): the wrapper is its own hover group, so hovering the
//              surface itself fires the sweep. Use for standalone cards/banners.
//   - 'group': the sweep responds to an ancestor `.group:hover`, so the whole
//              row/card it lives in drives it. Use inside an existing group.
//
// Reduced-motion users never see the band (`motion-reduce:hidden`), and the
// site-wide reduced-motion guard in index.css disables the transition anyway.

export function GlareHover({
  children,
  className = '',
  rounded = 'rounded-3xl',
  trigger = 'self',
  tone = 'rgba(255,255,255,0.22)',
}: {
  children: ReactNode
  className?: string
  rounded?: string
  trigger?: 'self' | 'group'
  /** Colour of the sweep's bright centre. Defaults to a soft white. */
  tone?: string
}) {
  // The translate is what carries the band across; swapping the trigger token
  // chooses whether this element's own hover or an ancestor `.group` drives it.
  const sweep =
    trigger === 'group'
      ? 'group-hover:translate-x-[140%]'
      : 'group-hover/glare:translate-x-[140%]'

  return (
    <div
      className={`relative isolate overflow-hidden ${rounded} ${
        trigger === 'self' ? 'group/glare' : ''
      } ${className}`}
    >
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 -left-1/3 z-20 w-1/2 -translate-x-[140%] -skew-x-[20deg] transition-transform duration-[900ms] ease-out motion-reduce:hidden ${sweep}`}
        style={{
          background: `linear-gradient(90deg, transparent, ${tone}, transparent)`,
        }}
      />
    </div>
  )
}
