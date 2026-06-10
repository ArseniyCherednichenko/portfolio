import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

// A thin lime bar that sweeps across the top of the viewport on every route
// change. Client-side navigation is instant, so this is a deliberate, decorative
// "you moved" cue rather than a real loading indicator — it gives the multi-page
// site the same tactile feedback a server-rendered app gets for free. The bar
// fills, holds for a beat, then fades. Suppressed under prefers-reduced-motion.
export function RouteProgress() {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const [active, setActive] = useState(false)
  const [first, setFirst] = useState(true)

  useEffect(() => {
    // Skip the very first render — there is no navigation to announce on load.
    if (first) {
      setFirst(false)
      return
    }
    if (reduce) return
    setActive(true)
    const id = window.setTimeout(() => setActive(false), 620)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" aria-hidden>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              scaleX: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.25, delay: 0.35 },
            }}
            className="h-full origin-left bg-gradient-to-r from-transparent via-[#DCF87C] to-[#DCF87C]"
            style={{ boxShadow: '0 0 12px rgba(220, 248, 124, 0.6)' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
