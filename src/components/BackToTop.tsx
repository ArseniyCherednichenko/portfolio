import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Floating button that appears after scrolling and returns to the top.
export function BackToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 600)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-[55] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-lg text-white/70 backdrop-blur transition-colors hover:border-white/40 hover:text-white"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          whileTap={{ scale: 0.9 }}
        >
          <span aria-hidden>&uarr;</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
