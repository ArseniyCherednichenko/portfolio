import { useEffect, useId, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as const

interface Props {
  /** The resting face — kept in normal flow, so it sizes the card. */
  front: ReactNode
  /** The revealed face — absolutely filled over the front and pre-rotated. */
  back: ReactNode
  /** Which axis the card turns about. 'y' turns left↔right, 'x' tips top↔bottom. */
  axis?: 'x' | 'y'
  /**
   * How the flip is triggered. 'hover' turns on pointer-enter (fine pointers)
   * and still toggles on click/Enter for touch + keyboard; 'click' only turns
   * on click/Enter (better when a hover would feel twitchy). Default 'hover'.
   */
  trigger?: 'hover' | 'click'
  /** Seconds for one turn. */
  duration?: number
  /** Match the faces' corner radius (Tailwind class). */
  rounded?: string
  /** Accessible name for the control (e.g. "Flip: honesty"). */
  label?: string
  className?: string
}

// A true 3D flip card. Two faces share a preserve-3d stage that rotates a half
// turn; backface-visibility hides whichever face points away, so the card turns
// like a real card rather than cross-fading. Distinct from PixelTransition (a
// pixel dissolve), Folder (a fanning pocket), and ScratchReveal (a scratch-off):
// this one physically turns over.
//
// Honest to assistive tech: it is a single `role="button"` with `aria-pressed`,
// the showing face is exposed and the hidden face is `aria-hidden`, so a screen
// reader always reads what is visible and never both at once. Faces should carry
// their own styling but no nested interactive controls (the whole card is the
// control). Under reduced motion the turn is dropped for an instant, legible
// swap — nothing is ever gated behind the animation.
export function FlipCard({
  front,
  back,
  axis = 'y',
  trigger = 'hover',
  duration = 0.6,
  rounded = 'rounded-3xl',
  label,
  className = '',
}: Props) {
  const reduce = useReducedMotion()
  const [flipped, setFlipped] = useState(false)
  const [fine, setFine] = useState(false)
  const backId = useId()

  // Hover-to-flip is a fine-pointer affordance only; touch/keyboard toggle.
  useEffect(() => {
    if (!window.matchMedia) return
    const m = window.matchMedia('(pointer: fine)')
    const on = () => setFine(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])

  const hoverFlips = trigger === 'hover' && fine && !reduce
  const rot = axis === 'y' ? 'rotateY' : 'rotateX'

  const toggle = () => setFlipped((f) => !f)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  const faceBase = `absolute inset-0 [backface-visibility:hidden] [transform-style:preserve-3d] ${rounded} overflow-hidden`

  return (
    <div
      className={`group relative [perspective:1400px] ${className}`}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={label}
      onClick={toggle}
      onKeyDown={onKey}
      onPointerEnter={hoverFlips ? () => setFlipped(true) : undefined}
      onPointerLeave={hoverFlips ? () => setFlipped(false) : undefined}
      data-cursor
    >
      {reduce ? (
        // Reduced motion: no turn. Swap faces instantly; front is the default.
        <div className={`relative ${rounded} overflow-hidden`}>
          <div aria-hidden={flipped} className={flipped ? 'invisible' : undefined}>
            {front}
          </div>
          {flipped && (
            <div id={backId} className="absolute inset-0">
              {back}
            </div>
          )}
        </div>
      ) : (
        <motion.div
          className="relative [transform-style:preserve-3d]"
          initial={false}
          animate={{ [rot]: flipped ? 180 : 0 }}
          transition={{ duration, ease: EASE }}
        >
          {/* Front — in normal flow so it sizes the card. */}
          <div className={`relative [backface-visibility:hidden] ${rounded} overflow-hidden`} aria-hidden={flipped}>
            {front}
          </div>
          {/* Back — filled over the front and pre-turned a half rotation. */}
          <div
            id={backId}
            className={faceBase}
            style={{ transform: `${rot}(180deg)` }}
            aria-hidden={!flipped}
          >
            {back}
          </div>
        </motion.div>
      )}
    </div>
  )
}
