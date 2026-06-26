import { useRef, type ReactNode, type MouseEvent } from 'react'
import { motion, useMotionValue, useMotionTemplate, useReducedMotion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as const

// Container variants drive a staggered scroll-reveal of the cells.
const gridVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const cellVariants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

/**
 * Responsive bento layout: a dense, asymmetric grid of cards that reveals in a
 * stagger as it scrolls into view. Children should be <BentoCell>s; each cell
 * controls its own span via className (e.g. "sm:col-span-2 sm:row-span-2").
 */
export function BentoGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      variants={reduce ? undefined : gridVariants}
      initial={reduce ? undefined : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, margin: '-10% 0px' }}
      className={`grid grid-cols-2 gap-3 sm:auto-rows-[150px] sm:grid-cols-4 sm:gap-4 ${className}`}
    >
      {children}
    </motion.div>
  )
}

/**
 * A single bento card. A faint lime spotlight tracks the cursor and the border
 * warms on hover; the whole cell lifts a touch. Pass span utilities via
 * className. Reduced-motion users get a calm static card with no listeners.
 */
export function BentoCell({
  children,
  className = '',
  interactive = true,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const background = useMotionTemplate`radial-gradient(360px circle at ${x}px ${y}px, rgba(220,248,124,0.14), transparent 60%)`

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    x.set(e.clientX - r.left)
    y.set(e.clientY - r.top)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={reduce ? undefined : onMove}
      variants={reduce ? undefined : cellVariants}
      whileHover={reduce || !interactive ? undefined : { y: -4 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-[#DCF87C]/30 ${className}`}
    >
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background }}
        />
      )}
      <div className="relative flex h-full flex-col">{children}</div>
    </motion.div>
  )
}
