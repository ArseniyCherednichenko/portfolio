import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// HoloCard — a card finished in holographic foil, the rainbow-stamped surface
// of a collectible trading card, rebuilt by hand.
//
// Thesis / what makes it not another tilt card: the tilt card rotates one plane
// toward the cursor, the parallax card stages a scene in planes and tilts the
// lot, and the wobble card leans and squishes without rotating. All three answer
// the pointer by MOVING the card. This one barely moves — a few degrees of tilt
// is only the vehicle. The thing that answers the pointer is the FOIL: a band of
// rainbow interference and a field of glitter that live inside the surface and
// shift hue and position with the viewing angle, exactly the way a foil-stamped
// card throws a different rainbow at every angle you hold it. None of the other
// cards in this family have anything living in the surface; here the surface is
// the effect.
//
// Mechanics: three stacked, aria-hidden, pointer-events-none layers over the
// content. (1) A smooth holo band — a wide multi-hue linear gradient whose
// position slides and whose hue rotates as the pointer crosses, blended with
// color-dodge so it reads as light caught in the lamination rather than paint.
// (2) A glitter field — the same rainbow seen only through a fine dot mask, so
// it breaks into thousands of sparkles that travel against the band, the detail
// that separates true foil from a plain sheen. (3) A glare — a soft white
// highlight that tracks the pointer across the laminate. Under the lot, a gentle
// rotateX/rotateY on a spring gives the card just enough parallax for the foil
// to feel anchored to a real plane. Left alone, a slow idle drift keeps the
// rainbow breathing so the card is never dead before you touch it.
//
// Honest and cheap: the children are the real, untouched content a screen reader
// reads; every foil layer is decorative and hidden, pure CSS gradients driven by
// a handful of springs with nothing on a canvas or a render path. Under
// prefers-reduced-motion the idle drift never starts and the pointer is never
// wired — the card rests flat with the foil parked at one fixed, fully visible
// angle, so the holographic finish still reads as a still photograph of foil.

const TILT = 9 // deg of tilt at the card edges — the plane the foil sits on
const HUE_SWING = 90 // deg the whole rainbow rotates across the card
const IDLE_SPEED = 0.22 // rad/s the resting foil drifts while untouched

export function HoloCard({
  children,
  className = '',
  intensity = 1,
}: {
  children: ReactNode
  className?: string
  /** Scales the foil's opacity and the tilt. 1 is the tuned default. */
  intensity?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion() ?? false

  // Pointer position over the card, normalised to -0.5..0.5 from the centre.
  // At rest it sits at the conventional upper-left so the foil has a lit angle.
  const px = useMotionValue(-0.32)
  const py = useMotionValue(-0.3)
  const sx = useSpring(px, { stiffness: 150, damping: 20, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 150, damping: 20, mass: 0.6 })

  // The plane: tilt away from the pointer so the near edge dips toward it.
  const rotateX = useTransform(sy, (v) => `${(-v * TILT * intensity).toFixed(2)}deg`)
  const rotateY = useTransform(sx, (v) => `${(v * TILT * intensity).toFixed(2)}deg`)

  // The smooth holo band slides a wide gradient across the card and rotates its
  // hue — two readings of the same pointer, so the rainbow both moves and shifts
  // colour at once, the way a real laminate does.
  const bandX = useTransform(sx, (v) => `${(50 + v * 120).toFixed(1)}%`)
  const bandY = useTransform(sy, (v) => `${(50 + v * 120).toFixed(1)}%`)
  const bandPos = useMotionTemplate`${bandX} ${bandY}`
  const hue = useTransform([sx, sy], ([x, y]) => (x as number) * HUE_SWING + (y as number) * HUE_SWING * 0.5)
  const bandFilter = useMotionTemplate`hue-rotate(${hue}deg) saturate(1.4)`

  // The glitter field travels the opposite way to the band so the sparkles drift
  // against the sheen rather than with it — the parallax that reads as depth in
  // the lamination.
  const glitX = useTransform(sx, (v) => `${(50 - v * 160).toFixed(1)}%`)
  const glitY = useTransform(sy, (v) => `${(50 - v * 160).toFixed(1)}%`)
  const glitPos = useMotionTemplate`${glitX} ${glitY}`

  // The glare rides the pointer directly across the top.
  const glareX = useTransform(sx, (v) => `${(50 + v * 100).toFixed(1)}%`)
  const glareY = useTransform(sy, (v) => `${(50 + v * 100).toFixed(1)}%`)
  const glarePos = useMotionTemplate`${glareX} ${glareY}`

  // Idle drift: while nothing points at the card, trace a slow ellipse so the
  // foil keeps shifting. Paused on hover, never started under reduced motion.
  const hovering = useRef(false)
  useEffect(() => {
    if (reduce) return
    let raf = 0
    let last = performance.now()
    let angle = Math.atan2(-0.3, -0.32)
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!hovering.current) {
        angle += IDLE_SPEED * dt
        px.set(Math.cos(angle) * 0.34)
        py.set(Math.sin(angle) * 0.32)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, px, py])

  function onMove(e: PointerEvent) {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  function onEnter() {
    hovering.current = true
  }
  function onLeave() {
    hovering.current = false
    // ease the foil back toward its resting lit angle
    px.set(-0.32)
    py.set(-0.3)
  }

  const op = Math.max(0, Math.min(1.2, intensity))

  return (
    <div style={{ perspective: 900 }} className={className}>
      <motion.div
        ref={ref}
        onPointerMove={reduce ? undefined : onMove}
        onPointerEnter={reduce ? undefined : onEnter}
        onPointerLeave={reduce ? undefined : onLeave}
        style={{
          rotateX: reduce ? '0deg' : rotateX,
          rotateY: reduce ? '0deg' : rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="relative h-full w-full overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-b from-white/[0.04] to-black/40"
      >
        {/* The real content. Untouched, selectable, read once. */}
        <div className="relative z-10">{children}</div>

        {/* (1) smooth holo band */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-3xl mix-blend-color-dodge"
          style={{
            opacity: 0.5 * op,
            backgroundImage:
              'linear-gradient(115deg, transparent 12%, #ff4db8 24%, #ffd24d 36%, #4dffd2 50%, #4db8ff 64%, #b84dff 76%, transparent 88%)',
            backgroundSize: '240% 240%',
            backgroundPosition: reduce ? '26% 20%' : bandPos,
            filter: reduce ? 'saturate(1.4)' : bandFilter,
          }}
        />

        {/* (2) glitter field — the rainbow seen only through a fine dot mask */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-3xl mix-blend-color-dodge"
          style={{
            opacity: 0.55 * op,
            backgroundImage:
              'linear-gradient(60deg, #ff5db8 0%, #ffe14d 20%, #4dffa6 40%, #4db8ff 60%, #c14dff 80%, #ff5db8 100%)',
            backgroundSize: '320% 320%',
            backgroundPosition: reduce ? '70% 60%' : glitPos,
            WebkitMaskImage:
              'radial-gradient(circle at center, #000 0.6px, transparent 1.1px)',
            maskImage: 'radial-gradient(circle at center, #000 0.6px, transparent 1.1px)',
            WebkitMaskSize: '5px 5px',
            maskSize: '5px 5px',
          }}
        />

        {/* (3) glare — a soft white highlight tracking the pointer, driven as a
            background-position motion value so it follows the cursor live */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-3xl mix-blend-soft-light"
          style={{
            opacity: 0.8 * op,
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0) 45%)',
            backgroundSize: '160% 160%',
            backgroundPosition: reduce ? '28% 22%' : glarePos,
            backgroundRepeat: 'no-repeat',
          }}
        />
        {/* a lime kiss of the site's accent in the sheen, same tracked position */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-3xl mix-blend-screen"
          style={{
            opacity: 0.35 * op,
            backgroundImage:
              'radial-gradient(circle, rgba(220,248,124,0.6), rgba(220,248,124,0) 42%)',
            backgroundSize: '130% 130%',
            backgroundPosition: reduce ? '28% 22%' : glarePos,
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* a hairline inner frame so the laminate reads as an edge, not a fade */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 rounded-3xl ring-1 ring-inset ring-white/10"
        />
      </motion.div>
    </div>
  )
}
