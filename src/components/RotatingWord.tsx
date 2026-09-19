import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

// Cycles through phrases with a vertical swap animation. Under reduced motion it
// still cycles — the rotating word carries real meaning here, not decoration —
// but the vertical swap collapses to a plain cross-fade so nothing slides.
export function RotatingWord({ words, interval = 2200 }: { words: string[]; interval?: number }) {
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % words.length), interval)
    return () => clearInterval(id)
  }, [words.length, interval])

  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ y: reduce ? 0 : '0.7em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduce ? 0 : '-0.7em', opacity: 0 }}
          transition={{ duration: reduce ? 0.25 : 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-semibold text-[#DCF87C]"
        >
          {words[i] ?? ''}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
