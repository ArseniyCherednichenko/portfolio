import { motion, useReducedMotion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'

const EASE = [0.16, 1, 0.3, 1] as const

// Animated wrapper around the router Outlet. Re-keying on pathname remounts the
// page subtree on every navigation, so the incoming view fades and lifts into
// place instead of hard-cutting — the multi-page site reads as one continuous
// surface. Entrance-only (no exit) keeps the new page in the DOM immediately,
// which is what ScrollManager's scroll-to-top and /#section anchor jumps rely
// on. In-page hash links on the same route do not change the pathname, so they
// never replay the entrance. Honors prefers-reduced-motion via `initial={false}`.
export function PageTransition() {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()

  return (
    <motion.div
      key={pathname}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Outlet />
    </motion.div>
  )
}
