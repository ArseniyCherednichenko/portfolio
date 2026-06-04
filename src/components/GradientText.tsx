import { type ReactNode } from 'react'

// Animated shine: a moving white→lime→white gradient clipped to the text.
export function GradientText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`bg-[linear-gradient(90deg,#ffffff,#DCF87C,#ffffff)] bg-[length:200%_auto] bg-clip-text text-transparent animate-[shine_6s_linear_infinite] ${className}`}
    >
      {children}
    </span>
  )
}
