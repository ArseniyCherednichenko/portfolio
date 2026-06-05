import { motion, useScroll, useSpring } from 'framer-motion'

// Thin lime progress bar pinned to the top, tracking page scroll.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-[#DCF87C]"
      style={{ scaleX }}
    />
  )
}
