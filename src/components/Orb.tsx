import { useEffect, useRef } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// Orb — a living gradient sphere, built entirely from stacked CSS gradients and
// Framer Motion springs. No WebGL, no canvas, no per-frame React state: the
// volume is sold by layering. A bottom-lit base reads as a solid ball, two
// plasma fields drift in opposite directions behind a circular mask so the
// interior churns like something molten, an inset rim catches the light, and a
// soft bloom leaks past the edge. The specular highlight slides toward the
// pointer and the whole ball tilts a few degrees after it in perspective, so it
// feels aware of the cursor without ever leaving its orbit. Left alone it just
// breathes. Reduced motion gets one calm, centred frame with no listeners at all.

export function Orb({ className = '', size = 320 }: { className?: string; size?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // Pointer offset from the orb's centre, normalised to roughly [-1, 1].
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 0.6 })

  useEffect(() => {
    if (reduce) return
    function onMove(e: PointerEvent) {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      // Divide by a generous radius so movement well outside the ball still
      // nudges it — the orb should feel the room, not just its own footprint.
      const nx = (e.clientX - cx) / (r.width * 1.5)
      const ny = (e.clientY - cy) / (r.height * 1.5)
      px.set(Math.max(-1, Math.min(1, nx)))
      py.set(Math.max(-1, Math.min(1, ny)))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduce, px, py])

  // The ball tilts a few degrees after the pointer; the highlight slides further.
  const rotateX = useTransform(sy, [-1, 1], [9, -9])
  const rotateY = useTransform(sx, [-1, 1], [-11, 11])
  const hx = useTransform(sx, [-1, 1], [30, 66])
  const hy = useTransform(sy, [-1, 1], [28, 62])
  const highlight = useMotionTemplate`radial-gradient(circle at ${hx}% ${hy}%, rgba(255,255,255,0.92), rgba(220,248,124,0.4) 20%, transparent 52%)`

  // A single frozen frame for reduced motion — every layer, none of the motion.
  if (reduce) {
    return (
      <div
        ref={ref}
        className={`pointer-events-none relative ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <div className="absolute -inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(220,248,124,0.28),transparent_66%)] blur-2xl" />
        <div className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_115%,#1a1f0e_0%,#0a0b06_58%)]">
          <div className="absolute inset-[-30%] rounded-full bg-[conic-gradient(from_20deg,#dcf87c,#7bdcb5,#26301a,#dcf87c)] opacity-45 blur-2xl" />
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_38%_32%,rgba(255,255,255,0.85),rgba(220,248,124,0.35)_20%,transparent_52%)]" />
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_42%,transparent_38%,rgba(0,0,0,0.62)_100%)]" />
        </div>
        <div className="absolute inset-0 rounded-full shadow-[inset_9px_11px_34px_rgba(220,248,124,0.22),inset_-6px_-10px_40px_rgba(0,0,0,0.7)]" />
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`pointer-events-none relative ${className}`}
      style={{ width: size, height: size, perspective: 900 }}
      aria-hidden
    >
      {/* Bloom leaking past the edge — breathes slightly out of phase with the ball. */}
      <motion.div
        className="absolute -inset-[20%] rounded-full bg-[radial-gradient(circle,rgba(220,248,124,0.3),transparent_66%)] blur-2xl"
        animate={{ opacity: [0.5, 0.78, 0.5], scale: [1, 1.06, 1] }}
        transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* The ball itself — tilts after the pointer, breathes when left alone. */}
      <motion.div
        className="absolute inset-0"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        animate={{ scale: [1, 1.028, 1] }}
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_115%,#1a1f0e_0%,#0a0b06_58%)]">
          {/* Two plasma fields drifting opposite ways, blurred into a churn. */}
          <motion.div
            className="absolute inset-[-30%] rounded-full bg-[conic-gradient(from_0deg,#dcf87c,#7bdcb5,#26301a,#dcf87c)] opacity-55 blur-2xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 17, ease: 'linear', repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-[-24%] rounded-full bg-[conic-gradient(from_140deg,transparent,#dcf87c66,transparent_55%)] opacity-70 blur-xl mix-blend-screen"
            animate={{ rotate: -360 }}
            transition={{ duration: 23, ease: 'linear', repeat: Infinity }}
          />
          {/* Pointer-driven specular highlight, added over the surface. */}
          <motion.div
            className="absolute inset-0 rounded-full mix-blend-screen"
            style={{ background: highlight }}
          />
          {/* Roundness — a vignette that curves the flat gradients into a sphere. */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_42%,transparent_36%,rgba(0,0,0,0.64)_100%)]" />
        </div>
        {/* Rim light and inner shadow, sitting above the mask so they read as glass. */}
        <div className="absolute inset-0 rounded-full shadow-[inset_9px_11px_34px_rgba(220,248,124,0.24),inset_-6px_-10px_44px_rgba(0,0,0,0.72)]" />
      </motion.div>
    </div>
  )
}
