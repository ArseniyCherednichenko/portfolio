import { type ReactNode } from 'react'

// Seamless infinite horizontal scroll (duplicates its children). Pauses on hover.
export function Marquee({ children, className = '' }: { children: ReactNode; className?: string }) {
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
