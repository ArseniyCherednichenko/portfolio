import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

// Scroll-into-view reveal. Fades + lifts its children once. An optional `id`
// passes straight through to the wrapper so a reveal can double as an anchor
// target (e.g. for a scroll-spy contents rail) without an extra element.
export function Reveal({
  children,
  className = '',
  delay = 0,
  id,
}: {
  children: ReactNode
  className?: string
  delay?: number
  id?: string
}) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
