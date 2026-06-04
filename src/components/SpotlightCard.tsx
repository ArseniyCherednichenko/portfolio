import { useRef, type ReactNode, type MouseEvent } from 'react'
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion'

// Card with a lime radial glow that follows the cursor on hover.
export function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const background = useMotionTemplate`radial-gradient(440px circle at ${x}px ${y}px, rgba(220,248,124,0.12), transparent 60%)`

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    x.set(e.clientX - r.left)
    y.set(e.clientY - r.top)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-colors hover:border-[#DCF87C]/30 ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
