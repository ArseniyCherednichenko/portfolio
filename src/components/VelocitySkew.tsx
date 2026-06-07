import { type ReactNode } from 'react'
import { motion, useScroll, useVelocity, useSpring, useTransform, useReducedMotion } from 'framer-motion'

// Subtly skews its children in response to scroll velocity, so fast scrolling
// gives the content a brief lean before it springs back. Renders flat (no
// transform) for reduced-motion users.
export function VelocitySkew({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  const smooth = useSpring(velocity, { stiffness: 200, damping: 40 })
  const skew = useTransform(smooth, [-2500, 0, 2500], [-5, 0, 5], { clamp: true })

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div style={{ skewX: skew }} className={className}>
      {children}
    </motion.div>
  )
}
