import { useEffect } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

// Decorative hero constellation for the hero's right side (large screens only):
// a breathing core, a faint starfield, two counter-rotating rings, and orbiting
// dots. It fills the width the headline leaves and gives the hero a sense of
// depth without ever competing with the type.
//
// Two things make it feel crafted rather than a spinning gif. First, the whole
// scene drifts with the cursor — nearer layers travel further than the far
// starfield, so the composition reads as parallax rather than a flat decal.
// Second, and non-negotiable for this site: it honours prefers-reduced-motion.
// Under reduced motion the rotation, the twinkle, the breathing, and the cursor
// parallax are all dropped, and what remains is a still, composed constellation
// that still looks deliberate — calm is a designed state here, not an absence.

// Deterministic faint starfield — fixed positions (percent), sizes, and twinkle
// delays, so the field is stable across renders and never calls Math.random at
// paint time (which would flash a different scatter on every mount).
const STARS: ReadonlyArray<{ x: number; y: number; s: number; d: number }> = [
  { x: 12, y: 18, s: 2, d: 0 },
  { x: 82, y: 12, s: 1.5, d: 0.6 },
  { x: 68, y: 30, s: 2.5, d: 1.2 },
  { x: 24, y: 72, s: 1.5, d: 0.3 },
  { x: 88, y: 64, s: 2, d: 0.9 },
  { x: 46, y: 8, s: 1.5, d: 1.6 },
  { x: 8, y: 46, s: 2, d: 0.5 },
  { x: 92, y: 40, s: 1.5, d: 1.1 },
  { x: 34, y: 90, s: 2, d: 0.2 },
  { x: 60, y: 84, s: 1.5, d: 1.4 },
  { x: 76, y: 88, s: 2.5, d: 0.8 },
  { x: 18, y: 30, s: 1.5, d: 1.9 },
  { x: 52, y: 56, s: 1.5, d: 0.7 },
  { x: 40, y: 40, s: 1.5, d: 1.3 },
]

const CONIC_RING = {
  background: 'conic-gradient(from 0deg, transparent, rgba(220,248,124,0.55), transparent 55%)',
  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
  mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
} as const

export function HeroOrbit() {
  const reduce = useReducedMotion()
  const spin = !reduce

  // Pointer parallax: normalized -1..1 from the viewport centre, springed so the
  // layers glide toward the cursor rather than snapping. Never wired up under
  // reduced motion, so the whole scene stays perfectly still for those who ask.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 0.6 })

  useEffect(() => {
    if (reduce) return
    const onMove = (e: PointerEvent) => {
      px.set(Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1)))
      py.set(Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1)))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduce, px, py])

  // Per-depth parallax offsets — the far starfield barely moves, the orbiting
  // dots travel most, so the layers separate as the cursor crosses the hero.
  const starX = useTransform(sx, [-1, 1], [-6, 6])
  const starY = useTransform(sy, [-1, 1], [-6, 6])
  const coreX = useTransform(sx, [-1, 1], [-11, 11])
  const coreY = useTransform(sy, [-1, 1], [-11, 11])
  const midX = useTransform(sx, [-1, 1], [-18, 18])
  const midY = useTransform(sy, [-1, 1], [-18, 18])
  const outX = useTransform(sx, [-1, 1], [-26, 26])
  const outY = useTransform(sy, [-1, 1], [-26, 26])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-[-4%] top-1/2 hidden h-[540px] w-[540px] -translate-y-1/2 lg:block"
    >
      {/* breathing glow core */}
      <motion.div className="absolute inset-0" style={{ x: coreX, y: coreY }}>
        <motion.div
          className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C]/25 blur-3xl"
          animate={spin ? { scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] } : undefined}
          transition={spin ? { duration: 6, repeat: Infinity, ease: 'easeInOut' } : undefined}
        />
      </motion.div>

      {/* faint starfield — the deepest layer, so it drifts the least */}
      <motion.div className="absolute inset-0" style={{ x: starX, y: starY }}>
        {STARS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white/70"
            style={{ left: `${s.x}%`, top: `${s.y}%`, height: s.s, width: s.s }}
            animate={spin ? { opacity: [0.25, 0.9, 0.25], scale: [1, 1.4, 1] } : { opacity: 0.45 }}
            transition={
              spin ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: s.d } : undefined
            }
          />
        ))}
      </motion.div>

      {/* dashed structural circle — a faint scaffold the rings sit within */}
      <motion.div className="absolute inset-0" style={{ x: outX, y: outY }}>
        <div className="absolute inset-[8%] rounded-full border border-dashed border-white/[0.08]" />
      </motion.div>

      {/* rotating conic ring (masked to a thin ring) */}
      <motion.div className="absolute inset-0" style={{ x: outX, y: outY }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={CONIC_RING}
          animate={spin ? { rotate: 360 } : undefined}
          transition={spin ? { duration: 22, repeat: Infinity, ease: 'linear' } : undefined}
        />
      </motion.div>

      {/* inner ring with a lime dot, counter-rotating */}
      <motion.div className="absolute inset-0" style={{ x: midX, y: midY }}>
        <motion.div
          className="absolute inset-[20%] rounded-full border border-white/10"
          animate={spin ? { rotate: -360 } : undefined}
          transition={spin ? { duration: 38, repeat: Infinity, ease: 'linear' } : undefined}
        >
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C] shadow-[0_0_14px_2px_rgba(220,248,124,0.55)]" />
        </motion.div>
      </motion.div>

      {/* outer orbiting dot */}
      <motion.div className="absolute inset-0" style={{ x: outX, y: outY }}>
        <motion.div
          className="absolute inset-0"
          animate={spin ? { rotate: 360 } : undefined}
          transition={spin ? { duration: 16, repeat: Infinity, ease: 'linear' } : undefined}
        >
          <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
        </motion.div>
      </motion.div>

      {/* a second, tighter orbiting dot — a faster inner satellite for depth */}
      <motion.div className="absolute inset-0" style={{ x: midX, y: midY }}>
        <motion.div
          className="absolute inset-[34%]"
          animate={spin ? { rotate: -360 } : undefined}
          transition={spin ? { duration: 11, repeat: Infinity, ease: 'linear' } : undefined}
        >
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C]/80" />
        </motion.div>
      </motion.div>
    </div>
  )
}
