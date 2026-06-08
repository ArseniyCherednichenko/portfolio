import { useRef, type ReactNode, type MouseEvent } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

// Link/button that gently pulls toward the cursor (magnetic effect). Renders an
// anchor; an optional onClick lets it double as an action trigger while the
// href stays as a graceful fallback (e.g. a mailto behind a dialog opener).
export function MagneticButton({
  children,
  href,
  className = '',
  onClick,
}: {
  children: ReactNode
  href: string
  className?: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 })

  function onMove(e: MouseEvent<HTMLAnchorElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    x.set((e.clientX - (r.left + r.width / 2)) * 0.35)
    y.set((e.clientY - (r.top + r.height / 2)) * 0.35)
  }
  function reset() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.96 }}
      className={`inline-flex items-center justify-center transition-[filter] hover:brightness-105 ${className}`}
    >
      {children}
    </motion.a>
  )
}
