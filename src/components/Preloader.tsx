import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { GradientText } from './GradientText'

// A once-per-session intro curtain. On the first load of a tab, a dark overlay
// counts a lime progress line from 0 to 100 under the name, then a row of
// panels wipes upward in sequence to reveal the site. It plays exactly once
// (a sessionStorage flag), locks scroll while up, and — critically — is skipped
// entirely for reduced-motion users, who never see a blocking overlay.

const KEY = 'intro-played'
const PANELS = 6
const COUNT_MS = 1000
const EASE = [0.16, 1, 0.3, 1] as const

export function Preloader() {
  const reduce = useReducedMotion()
  // Decide once, synchronously, so reduced-motion users never see a flash.
  const [show, setShow] = useState(() => {
    if (reduce) return false
    try {
      return sessionStorage.getItem(KEY) == null
    } catch {
      return false
    }
  })
  const [count, setCount] = useState(0)
  const [leaving, setLeaving] = useState(false)

  // Mark played immediately, so a mid-intro navigation can never re-trigger it.
  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* private mode — the intro simply won't persist, which is fine */
    }
  }, [show])

  // Lock the page scroll while the curtain is up.
  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [show])

  // Ease the counter 0 -> 100 off the rAF clock, then start the reveal.
  useEffect(() => {
    if (!show) return
    let raf = 0
    let start = 0
    const step = (t: number) => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / COUNT_MS)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(eased * 100))
      if (p < 1) raf = requestAnimationFrame(step)
      else setLeaving(true)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="preloader"
          aria-hidden
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
        >
          {/* Vertical panels that wipe upward, one after another, on reveal. */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: PANELS }).map((_, i) => (
              <motion.div
                key={i}
                className="h-full flex-1 bg-[#0A0A0A]"
                initial={{ y: 0 }}
                animate={leaving ? { y: '-101%' } : { y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: leaving ? i * 0.06 : 0 }}
                onAnimationComplete={() => {
                  if (leaving && i === PANELS - 1) setShow(false)
                }}
              />
            ))}
          </div>

          {/* Name, counter, and a filling lime line — lifts away as panels go. */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
            animate={leaving ? { opacity: 0, y: -18 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.42em] text-white/45">
              Arseniy Cherednichenko
            </span>
            <div className="font-display text-7xl font-bold leading-none tabular-nums sm:text-8xl">
              <GradientText>{count}</GradientText>
              <span className="text-white/25">%</span>
            </div>
            <div className="h-px w-52 overflow-hidden rounded-full bg-white/10 sm:w-64">
              <div
                className="h-full rounded-full bg-[#DCF87C]"
                style={{ width: `${count}%` }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
