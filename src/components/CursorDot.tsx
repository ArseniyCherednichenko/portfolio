import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'

// A small lime dot that trails the cursor (desktop only). mix-blend-difference
// keeps it visible over any background.
export function CursorDot() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.3 })
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.3 })
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    function move(e: PointerEvent) {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [x, y, reduce])

  if (reduce) return null

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[120] hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C] mix-blend-difference md:block"
      style={{ x: sx, y: sy }}
    />
  )
}
