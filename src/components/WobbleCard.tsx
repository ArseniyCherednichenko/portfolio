import { useRef, type PointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

// WobbleCard — a surface that leans and squishes toward the pointer, then
// springs back with a soft elastic wobble when you let go.
//
// Thesis / what makes it not another tilt card: both TiltCard and ParallaxCard
// answer the cursor by ROTATING a plane in 3D — a perspective lean. WobbleCard
// never rotates and never leaves the plane. It stays flat and answers with
// TRANSLATION on an under-damped spring, so the whole card nudges a few pixels
// toward the pointer while the content inside it trails a beat behind on a
// softer spring. That gap between the body and its contents is the squish; the
// under-damped body spring is the wobble — release the pointer and the card
// over-shoots home and settles like jelly rather than snapping. It is the
// playful, tactile cousin of the two leaning cards, built for a feature tile or
// a call-to-action you want to feel springy under the hand.
//
// All honest: the moving layers are decorative, the children are the real
// content and stay a normal part of the flow. Under reduced motion the pointer
// is never wired and nothing translates — the card rests flat and keeps its own
// hover border, fully usable with zero travel.
export function WobbleCard({
  children,
  className = '',
  /** Pixels the card body leans toward the pointer at the edge of the surface. */
  strength = 18,
  /** Scale the body lifts to while the pointer is over it (1 = none). */
  scale = 1.025,
  /** Show the cursor-tracking lime sheen. */
  sheen = true,
}: {
  children: ReactNode
  className?: string
  strength?: number
  scale?: number
  sheen?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion() ?? false

  // Raw pointer offset from centre, in [-0.5, 0.5] on each axis.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  // Hover amount (0..1) so the lift and sheen ease in rather than snapping.
  const hover = useMotionValue(0)

  // The body spring is deliberately under-damped: on release it over-shoots 0
  // and settles with a visible wobble. The content spring is softer and slower,
  // so the inner layer trails the body — that lag is the squish.
  const bodyX = useSpring(px, { stiffness: 300, damping: 13, mass: 1.1 })
  const bodyY = useSpring(py, { stiffness: 300, damping: 13, mass: 1.1 })
  const inX = useSpring(px, { stiffness: 170, damping: 18, mass: 1 })
  const inY = useSpring(py, { stiffness: 170, damping: 18, mass: 1 })
  const lift = useSpring(hover, { stiffness: 260, damping: 26 })

  const tx = useTransform(bodyX, (v) => v * strength)
  const ty = useTransform(bodyY, (v) => v * strength)
  // The content trails: it answers the SAME pointer but at a lower rate and on a
  // slower spring, so it drags behind the body as the card leans and recovers.
  const cx = useTransform(inX, (v) => v * strength * 0.5)
  const cy = useTransform(inY, (v) => v * strength * 0.5)
  const sc = useTransform(lift, [0, 1], [1, scale])

  const sheenX = useTransform(px, [-0.5, 0.5], ['0%', '100%'])
  const sheenY = useTransform(py, [-0.5, 0.5], ['0%', '100%'])
  const sheenOpacity = useTransform(lift, [0, 1], [0, 1])
  const sheenBg = useTransform(
    [sheenX, sheenY],
    ([sx, sy]) => `radial-gradient(360px circle at ${sx} ${sy}, rgba(220,248,124,0.16), transparent 60%)`,
  )

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
    hover.set(1)
  }
  function onEnter() {
    if (!reduce) hover.set(1)
  }
  function reset() {
    px.set(0)
    py.set(0)
    hover.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={reset}
      style={reduce ? undefined : { x: tx, y: ty, scale: sc }}
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-colors hover:border-[#DCF87C]/30 ${className}`}
    >
      {/* Content trails the body a beat behind — the squish. It carries the real
          children, so a reader hears a normal card, not an effect. */}
      <motion.div className="relative z-10" style={reduce ? undefined : { x: cx, y: cy }}>
        {children}
      </motion.div>
      {sheen && !reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20"
          style={{ background: sheenBg, opacity: sheenOpacity }}
        />
      )}
    </motion.div>
  )
}
