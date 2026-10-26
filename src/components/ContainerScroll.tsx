import { useRef, type ReactNode } from 'react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

interface ContainerScrollProps {
  /** Rendered above the frame. Lifts and settles as the section scrolls in. */
  header?: ReactNode
  /** The content held inside the rotating frame. */
  children: ReactNode
  /** Starting back-tilt in degrees before the frame flattens. Default 18. */
  tilt?: number
  className?: string
}

/**
 * A scroll-driven 3D "container scroll" reveal in the spirit of 21st.dev — a
 * framed panel that starts tilted back on the x-axis, as if seen from below,
 * and rotates flat toward the reader while scaling up and its lime rim lights,
 * all tied to the section's own scroll progress. The flatten completes by the
 * time the frame reaches the middle of the viewport and then holds, so it never
 * re-tilts on the way out. The header above it lifts a touch in sympathy.
 *
 * The transform is scrubbed from `useScroll` and smoothed with a light spring,
 * so it tracks the scrollbar rather than playing once. Everything inside the
 * frame stays in normal flow and fully focusable — the rotation is decorative.
 * Under reduced motion the whole scroll binding is dropped: the frame renders
 * flat, lit, and still, and the content reads identically.
 */
export function ContainerScroll({ header, children, tilt = 18, className }: ContainerScrollProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  // A light spring takes the raw scroll fraction off the hard scrollbar so the
  // flatten reads as momentum, not a 1:1 drag.
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 })

  // The flatten runs over the first half of the pass (entering → centered) and
  // then holds at rest for the second half (centered → leaving).
  const rotateX = useTransform(progress, [0, 0.5, 1], [tilt, 0, 0])
  const scale = useTransform(progress, [0, 0.5, 1], [0.86, 1, 1])
  const lift = useTransform(progress, [0, 0.5, 1], [28, 0, 0])
  const glow = useTransform(progress, [0, 0.5, 1], [0, 1, 1])

  if (reduce) {
    return (
      <div className={className}>
        {header}
        <Frame glow={null}>{children}</Frame>
      </div>
    )
  }

  return (
    <div ref={ref} className={className} style={{ perspective: '1100px' }}>
      {header != null && (
        <motion.div style={{ y: lift }} className="will-change-transform">
          {header}
        </motion.div>
      )}
      <motion.div
        style={{ rotateX, scale, transformOrigin: 'center top' }}
        className="will-change-transform [transform-style:preserve-3d]"
      >
        <Frame glow={glow}>{children}</Frame>
      </motion.div>
    </div>
  )
}

// The frame itself: a dark, rounded panel with a top chrome rail of three dots
// and a lime rim that lights as the panel comes level. `glow` is a motion value
// 0→1, or null when motion is off (the rim sits lit and still).
function Frame({ glow, children }: { glow: MotionValue<number> | null; children: ReactNode }) {
  return (
    <div className="relative rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/40 p-2 shadow-2xl shadow-black/60 sm:p-3">
      {/* The rim light — a lime ring that fades up with the flatten. */}
      <motion.div
        aria-hidden
        style={glow ? { opacity: glow } : { opacity: 1 }}
        className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-[#DCF87C]/40 [box-shadow:0_0_60px_-12px_rgba(220,248,124,0.45)]"
      />
      <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#0b0c09]">
        {/* Browser-ish chrome rail — three dots and a hairline. */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#DCF87C]/50" />
        </div>
        {children}
      </div>
    </div>
  )
}
