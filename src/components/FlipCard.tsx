import { useEffect, useState } from 'react'
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useFinePointer } from '../hooks/useFinePointer'

// FlipCard — a real 3D flip. The card turns on its vertical axis (rotateY 0 ->
// 180) to swap a front face for a back one, a *kind* of card motion the site did
// not have: TiltCard leans toward the cursor, PixelTransition dissolves, GlareHover
// sweeps light, but none of them actually turn the surface over. The rotation runs
// on a spring; a specular sheen peaks as the card passes edge-on (90 degrees) and a
// slight scale dip gives it weight, so it reads as a physical turn rather than a
// crossfade. On fine pointers it flips on hover; a click (or Enter/Space) *pins* the
// flip so it stays turned after the pointer leaves, and clicking again releases it —
// which is also the whole interaction on touch and for keyboard users. Under reduced
// motion the 3D is dropped entirely and the two faces cross-fade in place.
//
// Sizing: both faces are absolutely filled, so give the card a size via `className`
// (an aspect ratio or a height), exactly like the pixel/tilt demo cards.
export function FlipCard({
  front,
  back,
  className = '',
  rounded = 'rounded-2xl',
  'aria-label': ariaLabel,
}: {
  /** Resting face. */
  front: React.ReactNode
  /** Face shown once the card has turned over. */
  back: React.ReactNode
  className?: string
  /** Tailwind radius utility; matched on both faces so the turn stays clean. */
  rounded?: string
  'aria-label'?: string
}) {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)

  // Hover turns it; a click pins it so it holds after the pointer leaves. On touch
  // (no hover) or keyboard, the pin is the entire control.
  const flipped = (fine && hovered) || pinned

  const rot = useMotionValue(0)
  // The rotation itself drives the sheen and the depth dip, so they always track
  // the real angle rather than a separate timer.
  const sheen = useTransform(rot, [0, 90, 180, 270, 360], [0, 0.55, 0, 0.55, 0])
  const dip = useTransform(rot, [0, 90, 180, 270, 360], [1, 0.93, 1, 0.93, 1])
  const sheenBg = useMotionTemplate`linear-gradient(115deg, transparent 30%, rgba(220,248,124,${sheen}) 50%, transparent 70%)`

  useEffect(() => {
    if (reduce) return
    const controls = animate(rot, flipped ? 180 : 0, {
      type: 'spring',
      stiffness: 260,
      damping: 26,
    })
    return () => controls.stop()
  }, [flipped, reduce, rot])

  const toggle = () => setPinned((p) => !p)

  const face = 'absolute inset-0 h-full w-full overflow-hidden ' + rounded
  const backface = { backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={ariaLabel}
      data-cursor
      className={`group relative cursor-pointer select-none [perspective:1400px] focus:outline-none ${className}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
    >
      {/* Focus ring lives on the wrapper so it frames the whole card cleanly. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -inset-1 ${rounded} opacity-0 ring-2 ring-[#DCF87C]/70 transition-opacity duration-200 group-focus-visible:opacity-100`}
      />

      {reduce ? (
        // No 3D under reduced motion: the faces simply cross-fade.
        <div className="relative h-full w-full">
          <div className={face} style={{ opacity: flipped ? 0 : 1 }} aria-hidden={flipped}>
            {front}
          </div>
          <div className={face} style={{ opacity: flipped ? 1 : 0 }} aria-hidden={!flipped}>
            {back}
          </div>
        </div>
      ) : (
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          style={{ rotateY: rot, scale: dip }}
        >
          <div className={face} style={backface}>
            {front}
          </div>
          <div className={face} style={{ ...backface, transform: 'rotateY(180deg)' }}>
            {back}
          </div>
          {/* Specular band, brightest as the card passes edge-on. */}
          <motion.span
            aria-hidden
            className={`pointer-events-none absolute inset-0 ${rounded}`}
            style={{ background: sheenBg }}
          />
        </motion.div>
      )}
    </div>
  )
}
