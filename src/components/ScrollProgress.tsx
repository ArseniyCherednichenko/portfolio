import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'

// Thin reading-progress bar pinned to the very top of the viewport. Tracks how
// far the page has been scrolled and fills left-to-right in the lime accent.
// Springed for a soft, premium feel; under reduced motion it tracks the raw
// scroll position with no smoothing.
export function ScrollProgress() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: reduce ? 1000 : 140,
    damping: reduce ? 60 : 28,
    restDelta: 0.001,
  })
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-[#DCF87C] via-[#DCF87C] to-[#9bd54a]"
      style={{ scaleX }}
    />
  )
}
