import { motion, useReducedMotion } from 'framer-motion'

// A hairline that draws in from the left as it scrolls into view.
// Renders statically for reduced-motion users.
export function Divider() {
  const reduce = useReducedMotion()
  return (
    <div className="mx-auto w-full max-w-4xl px-6">
      <motion.div
        className="h-px origin-left bg-white/10"
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={reduce ? undefined : { scaleX: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}
