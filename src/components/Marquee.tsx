import { type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

// Seamless infinite horizontal scroll (duplicates its children). Pauses on hover.
// For reduced-motion users it becomes a static wrapped row (no auto-scroll).
export function Marquee({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={`flex flex-wrap items-center justify-center gap-3 px-6 ${className}`}>{children}</div>
  }

  return (
    <div className={`group flex overflow-hidden ${className}`}>
      <div className="flex shrink-0 animate-[marquee_30s_linear_infinite] items-center gap-3 pr-3 group-hover:[animation-play-state:paused]">
        {children}
      </div>
      <div
        aria-hidden
        className="flex shrink-0 animate-[marquee_30s_linear_infinite] items-center gap-3 pr-3 group-hover:[animation-play-state:paused]"
      >
        {children}
      </div>
    </div>
  )
}
