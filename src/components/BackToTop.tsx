import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as const

// Floating "back to top" control. Stays hidden until the visitor has scrolled
// a screenful, then springs in at the bottom-right. A faint ring traces the
// button; clicking returns to the top (smoothly unless reduced motion is set).
export function BackToTop() {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.9)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toTop = () =>
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })

  return (
    <AnimatePresence>
      {shown && (
        <motion.button
          type="button"
          onClick={toTop}
          aria-label="Scroll back to top"
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: 0.3, ease: EASE }}
          whileHover={reduce ? undefined : { y: -3 }}
          whileTap={{ scale: 0.92 }}
          className="group fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 backdrop-blur-md transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C]"
        >
          <span aria-hidden className="text-lg leading-none">
            &uarr;
          </span>
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-[#DCF87C]/0 transition group-hover:ring-[#DCF87C]/30" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
