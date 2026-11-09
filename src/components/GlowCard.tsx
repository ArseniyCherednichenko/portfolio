import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// GlowCard — a card whose border lights up on the arc that faces the cursor,
// and fades as the cursor moves away. In the spirit of 21st.dev / Aceternity's
// "glowing effect", rebuilt by hand.
//
// It is the deliberate cursor-driven counterpart to the two border effects it
// sits beside. BorderBeam runs a comet around the ring on a *timer* and never
// sees the pointer; ElectricBorder jitters the whole frame on a *timer* too.
// This ring is handed to the cursor: a conic gradient whose bright wedge always
// points at the pointer, so only the stretch of border nearest it glows, with
// an intensity that ramps up as the cursor nears and drops off with distance.
//
// Two things make the demo sing on a grid rather than one card. First, each
// card tracks the *global* pointer (a single window listener), so it does not
// need to be hovered — sweep the cursor through the gaps between cards and the
// edges facing it all light at once, like a torch passing framed glass. Second,
// the lift is proximity, not a hover flag, so the glow crosses the gutters
// smoothly instead of snapping on and off per card.
//
// The glow lives entirely on the border: the conic gradient is masked to a thin
// ring with the padding-box exclude trick (as BorderBeam does), with a second,
// thicker, blurred copy underneath for the bloom. Nothing washes the surface —
// that is SpotlightCard's job, and keeping this to the frame is what makes it a
// distinct piece rather than a restyle. Pure CSS gradients on a couple of
// springs; no canvas.
//
// Reduced motion never wires the pointer: the card rests with a calm, even,
// faint ring all the way round, so it still reads as "framed" without any
// motion — a still photograph of the glow.
export function GlowCard({
  children,
  className = '',
  /** The glow colour (defaults to the site lime). */
  color = '#DCF87C',
  /** How far from the card, in px, the cursor begins to light it. */
  proximity = 240,
  /** Thickness of the crisp border ring, in px. */
  width = 1.5,
}: {
  children: ReactNode
  className?: string
  color?: string
  proximity?: number
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // The direction from the card's centre to the pointer, in degrees, and how
  // strongly the card is lit (0 far away, 1 under the cursor). The intensity is
  // spring-smoothed so the glow fades rather than flickers; the angle tracks the
  // pointer directly, since a continuous cursor already moves it smoothly.
  const angle = useMotionValue(135)
  const intensity = useMotionValue(0)
  const glow = useSpring(intensity, { stiffness: 170, damping: 28, mass: 0.4 })
  const bloom = useTransform(glow, (v) => v * 0.55)

  useEffect(() => {
    if (reduce) return
    function onMove(e: PointerEvent) {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      angle.set((Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI)
      // Distance from the pointer to the nearest point on the card's box — 0
      // while inside it, growing once outside — so proximity is honest about
      // the gutters between cards rather than measuring to the centre.
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
      const dist = Math.hypot(dx, dy)
      intensity.set(Math.max(0, 1 - dist / proximity))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduce, angle, intensity, proximity])

  // Mask any layer down to just its border ring: the full box minus its content
  // box (inset by its padding) leaves a frame of exactly that thickness.
  function ringMask(pad: number): CSSProperties {
    return {
      padding: `${pad}px`,
      WebkitMask:
        'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      WebkitMaskComposite: 'xor',
      mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      maskComposite: 'exclude',
    }
  }

  // Centre the conic's bright wedge on the pointer direction. atan2's 0deg is
  // +x (3 o'clock) while a conic's 0deg is the top, so +90 aligns them; the
  // extra -55 lands the wedge's 55deg peak exactly on the pointer.
  const start = useTransform(angle, (a) => a + 35)
  const background = useMotionTemplate`conic-gradient(from ${start}deg at 50% 50%, transparent 0deg, ${color} 55deg, transparent 110deg)`

  return (
    <div
      ref={ref}
      className={`relative rounded-3xl border border-white/10 bg-white/[0.03] ${className}`}
    >
      {reduce ? (
        // Calm static frame — a faint, even ring, no motion, no pointer.
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            ...ringMask(width),
            background: `linear-gradient(0deg, ${color}, ${color})`,
            opacity: 0.18,
          }}
        />
      ) : (
        <>
          {/* Soft bloom: a thicker ring of the same wedge, blurred, so the glow
              reads as light rather than a hairline. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              ...ringMask(width * 5),
              background,
              opacity: bloom,
              filter: 'blur(6px)',
            }}
          />
          {/* Crisp edge: the sharp line that reads as the lit border itself. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ ...ringMask(width), background, opacity: glow }}
          />
        </>
      )}
      <div className="relative rounded-[inherit]">{children}</div>
    </div>
  )
}
