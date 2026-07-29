import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// A precision reticle: two hairlines that span a section and track the pointer,
// meeting at a lit node, with live X/Y readouts and a measured tick scale along
// the edges. Not another cursor (the site's Cursor is a global dot-and-ring) and
// not a canvas field — this is a DOM overlay of guide-lines that reads as
// alignment and measurement, the language of someone who builds things carefully.
//
// It listens on the window and positions from its own bounding rect, so the lines
// ease toward the pointer as it crosses the whole surface and rest at centre when
// it leaves. Springs move percentage-based motion values (no width measurement,
// no React state on the hot path); the numeric readouts are written straight to
// the DOM from a spring subscription rather than re-rendering. Decorative and
// `pointer-events-none`, so it never intercepts a click. Under reduced motion or a
// coarse pointer it paints a single still, centred crosshair — no listeners.
export function Crosshair({
  className = '',
  accent = '#DCF87C',
}: {
  className?: string
  /** Line and node colour. */
  accent?: string
}) {
  const reduce = useReducedMotion()
  const [fine, setFine] = useState(false)
  const [active, setActive] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const xLabel = useRef<HTMLSpanElement>(null)
  const yLabel = useRef<HTMLSpanElement>(null)

  // Normalised pointer position across the wrapper, 0..1, spring-smoothed so the
  // reticle glides toward the cursor rather than snapping to it.
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const sx = useSpring(mx, { stiffness: 320, damping: 40, mass: 0.6 })
  const sy = useSpring(my, { stiffness: 320, damping: 40, mass: 0.6 })
  const left = useMotionTemplate`${useTransform(sx, (v) => v * 100)}%`
  const top = useMotionTemplate`${useTransform(sy, (v) => v * 100)}%`

  useEffect(() => {
    setFine(window.matchMedia('(pointer: fine)').matches)
  }, [])

  useEffect(() => {
    if (reduce || !fine) return
    const el = wrapRef.current
    if (!el) return

    function onMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width
      const ny = (e.clientY - rect.top) / rect.height
      const inside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1
      setActive(inside)
      if (inside) {
        mx.set(nx)
        my.set(ny)
      }
    }
    function onLeave() {
      setActive(false)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, fine, mx, my])

  // Write the numeric readouts straight to the DOM off the springs, so a moving
  // cursor never triggers a React render.
  useEffect(() => {
    if (reduce || !fine) return
    const write = () => {
      if (xLabel.current) xLabel.current.textContent = String(Math.round(sx.get() * 100)).padStart(2, '0')
      if (yLabel.current) yLabel.current.textContent = String(Math.round(sy.get() * 100)).padStart(2, '0')
    }
    write()
    const ux = sx.on('change', write)
    const uy = sy.on('change', write)
    return () => {
      ux()
      uy()
    }
  }, [reduce, fine, sx, sy])

  const still = reduce || !fine
  const lit = active && !still

  // Static, centred reticle for reduced motion / coarse pointers.
  if (still) {
    return (
      <div ref={wrapRef} aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
        <Ticks accent={accent} />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10" />
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        <div
          className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ borderColor: accent, opacity: 0.5 }}
        />
      </div>
    )
  }

  return (
    <div ref={wrapRef} aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <Ticks accent={accent} dim={!lit} />

      {/* Vertical hairline */}
      <motion.div
        className="absolute inset-y-0 w-px"
        style={{
          left,
          x: '-0.5px',
          background: `linear-gradient(to bottom, transparent, ${accent}, transparent)`,
          opacity: lit ? 0.55 : 0.14,
        }}
        animate={{ opacity: lit ? 0.55 : 0.14 }}
        transition={{ duration: 0.4 }}
      />
      {/* Horizontal hairline */}
      <motion.div
        className="absolute inset-x-0 h-px"
        style={{
          top,
          y: '-0.5px',
          background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          opacity: lit ? 0.55 : 0.14,
        }}
        animate={{ opacity: lit ? 0.55 : 0.14 }}
        transition={{ duration: 0.4 }}
      />

      {/* Intersection node — a lit ring with a soft bloom and a bright core */}
      <motion.div className="absolute" style={{ left, top, x: '-50%', y: '-50%' }}>
        <motion.div
          className="relative grid place-items-center"
          animate={{ scale: lit ? 1 : 0.7, opacity: lit ? 1 : 0.35 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <span
            className="absolute h-8 w-8 rounded-full blur-md"
            style={{ background: accent, opacity: lit ? 0.22 : 0 }}
          />
          <span className="h-4 w-4 rounded-full border" style={{ borderColor: accent }} />
          <span className="absolute h-1 w-1 rounded-full" style={{ background: accent }} />
        </motion.div>
      </motion.div>

      {/* Live readouts — X rides the bottom edge, Y the right edge */}
      <motion.div
        className="absolute bottom-3 flex -translate-x-1/2 items-center gap-1 font-mono text-[10px] tracking-widest"
        style={{ left }}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-white/40">X</span>
        <span ref={xLabel} className="tabular-nums" style={{ color: accent }}>
          50
        </span>
      </motion.div>
      <motion.div
        className="absolute right-3 flex -translate-y-1/2 items-center gap-1 font-mono text-[10px] tracking-widest"
        style={{ top }}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-white/40">Y</span>
        <span ref={yLabel} className="tabular-nums" style={{ color: accent }}>
          50
        </span>
      </motion.div>
    </div>
  )
}

// A measured scale along the top and left edges — short static ticks with every
// fifth one longer, so the surface reads as calibrated.
function Ticks({ accent, dim = false }: { accent: string; dim?: boolean }) {
  const marks = Array.from({ length: 41 }, (_, i) => i)
  return (
    <div aria-hidden className="absolute inset-0" style={{ opacity: dim ? 0.5 : 1 }}>
      <div className="absolute inset-x-0 top-0 flex justify-between px-1">
        {marks.map((i) => (
          <span
            key={i}
            className="w-px"
            style={{ height: i % 5 === 0 ? 7 : 3, background: i % 5 === 0 ? accent : 'rgba(255,255,255,0.18)', opacity: i % 5 === 0 ? 0.35 : 1 }}
          />
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 flex flex-col justify-between py-1">
        {marks.map((i) => (
          <span
            key={i}
            className="h-px"
            style={{ width: i % 5 === 0 ? 7 : 3, background: i % 5 === 0 ? accent : 'rgba(255,255,255,0.18)', opacity: i % 5 === 0 ? 0.35 : 1 }}
          />
        ))}
      </div>
    </div>
  )
}
