import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

// Cycles through phrases with a vertical swap animation.
export function RotatingWord({ words, interval = 2200 }: { words: string[]; interval?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % words.length), interval)
    return () => clearInterval(id)
  }, [words.length, interval])

  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ y: '0.7em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-0.7em', opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-semibold text-[#DCF87C]"
        >
          {words[i] ?? ''}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
