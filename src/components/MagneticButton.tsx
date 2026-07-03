import { useRef, type ReactNode, type MouseEvent } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

// Link/button that gently pulls toward the cursor (magnetic effect). Renders an
// anchor when given `href`, otherwise a real <button> (for in-app actions like
// opening a dialog or triggering print), so callers get the same feel either
// way without reaching for a bare element.
type MagneticButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}

export function MagneticButton({ children, href, onClick, type = 'button', className = '' }: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 })

  function onMove(e: MouseEvent<HTMLElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    x.set((e.clientX - (r.left + r.width / 2)) * 0.35)
    y.set((e.clientY - (r.top + r.height / 2)) * 0.35)
  }
  function reset() {
    x.set(0)
    y.set(0)
  }

  const shared = {
    onMouseMove: onMove,
    onMouseLeave: reset,
    style: { x: sx, y: sy },
    whileTap: { scale: 0.96 },
    className: `inline-flex items-center justify-center transition-[filter] hover:brightness-105 ${className}`,
  } as const

  if (href) {
    return (
      <motion.a ref={ref as React.RefObject<HTMLAnchorElement>} href={href} {...shared}>
        {children}
      </motion.a>
    )
  }

  return (
    <motion.button ref={ref as React.RefObject<HTMLButtonElement>} type={type} onClick={onClick} {...shared}>
      {children}
    </motion.button>
  )
}
