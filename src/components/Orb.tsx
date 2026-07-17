import { useEffect, useRef } from 'react'
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

/**
 * Orb — a glowing, cursor-reactive sphere. A designed *presence*, not another
 * ambient field: a single lit orb that reads as "someone is home".
 *
 * How it is built (all DOM/CSS, so it is DPR-independent and crisp at any size):
 * - A dark base sphere shaded from the upper-left by a radial gradient, so it
 *   sits in space with real volume rather than reading as a flat disc.
 * - A slow conic "energy" band rotates inside it (the `orb-spin` keyframe in
 *   index.css) under a circular mask, blurred and screen-blended so it glows
 *   from within instead of drawing a hard edge.
 * - A specular highlight and the whole orb's 3D tilt track the pointer: the
 *   normalized cursor offset feeds spring-smoothed motion values (never React
 *   state on the hot path), so the light slides and the sphere leans toward the
 *   cursor. `listen="window"` tracks the whole viewport (the orb feels alive
 *   across a section); `listen="self"` only reacts within its own box.
 * - A soft outer bloom and an inset rim light finish the read.
 *
 * Reduced motion: no pointer listener, no rotation (the global reduced-motion
 * guard also stills the keyframe), the highlight rests upper-left and the orb
 * renders as a calm, fully-lit sphere.
 */
export interface OrbProps {
  /** Diameter in px. Responsive sizing is better done via `className` on a wrapper. */
  size?: number
  /** Where pointer motion is read from. Default 'window' so it feels alive across a section. */
  listen?: 'window' | 'self'
  /** Max tilt in degrees toward the cursor. */
  tilt?: number
  className?: string
  'aria-hidden'?: boolean
}

const SPRING = { stiffness: 120, damping: 20, mass: 0.6 } as const

export function Orb({
  size = 240,
  listen = 'window',
  tilt = 14,
  className,
  'aria-hidden': ariaHidden = true,
}: OrbProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // Normalized pointer offset from the orb centre, in [-1, 1], spring-smoothed.
  const px = useSpring(0, SPRING)
  const py = useSpring(0, SPRING)

  useEffect(() => {
    if (reduce) return
    const el = ref.current
    if (!el) return

    const source: HTMLElement | Window = listen === 'window' ? window : el

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      // Scale by the orb size (window mode) or its radius (self mode) so motion
      // stays proportional to the sphere, then clamp so it never overshoots.
      const span = listen === 'window' ? Math.max(r.width, r.height) : r.width / 2
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / span))
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / span))
      px.set(nx)
      py.set(ny)
    }
    const onLeave = () => {
      px.set(0)
      py.set(0)
    }

    source.addEventListener('pointermove', onMove as EventListener)
    if (listen === 'self') el.addEventListener('pointerleave', onLeave)
    return () => {
      source.removeEventListener('pointermove', onMove as EventListener)
      if (listen === 'self') el.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, listen, px, py])

  // Tilt the sphere toward the cursor.
  const rotateY = useTransform(px, (v) => v * tilt)
  const rotateX = useTransform(py, (v) => -v * tilt)

  // Specular highlight position — slides with the cursor within the sphere,
  // resting upper-left (34% / 30%) at centre.
  const lightX = useTransform(px, (v) => `${(34 + v * 26).toFixed(2)}%`)
  const lightY = useTransform(py, (v) => `${(30 + v * 26).toFixed(2)}%`)
  const highlight = useMotionTemplate`radial-gradient(circle at ${lightX} ${lightY}, rgba(244,255,214,0.9), rgba(220,248,124,0.28) 18%, transparent 42%)`

  return (
    <div
      ref={ref}
      aria-hidden={ariaHidden}
      className={className}
      style={{ width: size, height: size, perspective: 800 }}
    >
      <motion.div
        className="relative h-full w-full"
        style={
          reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }
        }
      >
        {/* Outer bloom — soft lime halo that bleeds past the sphere. */}
        <div
          className="pointer-events-none absolute -inset-[22%] rounded-full opacity-70 blur-2xl"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(220,248,124,0.34), rgba(220,248,124,0.06) 46%, transparent 68%)',
          }}
        />

        {/* The sphere. */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          {/* Dark base, lit from the upper-left for volume. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 32% 28%, #2a3212 0%, #171a0d 34%, #0c0d08 66%, #060604 100%)',
            }}
          />
          {/* Rotating internal energy band, masked to the circle and screened in. */}
          <div
            className="absolute inset-0 rounded-full mix-blend-screen opacity-80"
            style={{ maskImage: 'radial-gradient(circle at 50% 50%, #000 60%, transparent 74%)' }}
          >
            <div
              className="absolute inset-[-30%] blur-md"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0deg, rgba(220,248,124,0.55) 60deg, rgba(163,230,53,0.15) 120deg, transparent 200deg, rgba(220,248,124,0.4) 300deg, transparent 360deg)',
                animation: 'orb-spin 14s linear infinite',
              }}
            />
          </div>
          {/* Cursor-tracked specular highlight. */}
          <motion.div className="absolute inset-0 rounded-full" style={{ background: highlight }} />
          {/* Fine top gloss so the crown catches light. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(60% 40% at 40% 16%, rgba(255,255,255,0.22), transparent 70%)',
            }}
          />
          {/* Inner shadow / terminator toward the lower-right. */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow:
                'inset -22px -26px 46px rgba(0,0,0,0.7), inset 10px 12px 30px rgba(220,248,124,0.08)',
            }}
          />
          {/* Crisp rim light. */}
          <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-[#DCF87C]/25" />
        </div>
      </motion.div>
    </div>
  )
}
