import { type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

// Card wrapped in a slowly rotating conic-gradient border. The spinning sheen
// sits behind an inset panel so only a thin lime arc shows at the edge.
// Reduced-motion users get a plain static border instead.
export function AnimatedBorder({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <div className={`relative overflow-hidden rounded-3xl p-px ${className}`}>
      {reduce ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl border border-[#DCF87C]/30" />
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[-150%] animate-[spin_7s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(220,248,124,0.75)_50deg,transparent_110deg)]"
        />
      )}
      <div className="relative h-full rounded-[calc(1.5rem-1px)] bg-[#0E0E0E]">{children}</div>
    </div>
  )
}
