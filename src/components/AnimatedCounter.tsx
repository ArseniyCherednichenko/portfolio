import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

// Counts up from 0 to `value` once it scrolls into view.
export function AnimatedCounter({
  value,
  suffix = '',
  duration = 1.6,
  className = '',
}: {
  value: number
  suffix?: string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (reduce || !inView) {
      if (inView) node.textContent = `${value}${suffix}`
      return
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = `${Math.round(v)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, value, suffix, duration, reduce])

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  )
}
