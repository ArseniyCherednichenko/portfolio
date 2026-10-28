import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'

interface TracingBeamProps {
  children: ReactNode
  className?: string
}

/**
 * A reading beam that runs down the left margin of a long column and draws
 * itself as the content scrolls through the reading zone — the margin-rule
 * cousin of the top-edge ScrollProgress bar and the page-length JourneyPath
 * spine. A faint hairline marks the whole column; a lime fill grows down it
 * tied to the column's own scroll progress, brightest at the growing tip, and
 * a glowing head rides the leading edge so the dot the reader tracks sits
 * exactly where their eye is on the page. An origin ring caps the top.
 *
 * The fill and the head are scrubbed from `useScroll` over the column's pass
 * and smoothed with a light spring, so the beam tracks the scrollbar rather
 * than playing once; the head's position is expressed as a percentage of the
 * track, so no pixel measurement of the content height is ever needed and the
 * beam stays correct as the column reflows. Everything in the beam is
 * decorative and aria-hidden — the content keeps its normal flow and focus
 * order, only shifted right by a reading margin. Under reduced motion the
 * whole scroll binding is dropped: the rule renders fully drawn and lit, the
 * head is gone, and the words read identically.
 */
export function TracingBeam({ children, className }: TracingBeamProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  // The beam fills as the column travels from entering the lower viewport to
  // nearly leaving the top — the span a reader actually moves through it.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 85%', 'end 15%'],
  })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  // The head rides the leading edge, expressed as a share of the track height
  // so it needs no measured pixel height to stay aligned as the column reflows.
  const headTop = useTransform(progress, [0, 1], ['0%', '100%'])
  // The origin ring and head fade up as the beam leaves its resting start, so a
  // column sitting untouched at the top of its pass doesn't glow unprompted.
  const capOpacity = useTransform(progress, [0, 0.03, 1], [0.25, 1, 1])

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      {/* The margin rule — a decorative gutter the reader's eye tracks. */}
      <div aria-hidden className="pointer-events-none absolute bottom-1 left-0 top-1 w-px sm:left-1">
        {/* Faint full-height hairline marking the whole column. */}
        <div className="absolute inset-0 bg-white/[0.08]" />
        {/* Origin ring capping the top of the rule. */}
        <motion.span
          style={reduce ? undefined : { opacity: capOpacity }}
          className="absolute -left-[3px] -top-1.5 h-[7px] w-[7px] rounded-full border border-[#DCF87C]/70 bg-[#0A0A0A]"
        />
        {reduce ? (
          // Still state: the rule is simply drawn and lit, no moving head.
          <div className="absolute inset-0 bg-gradient-to-b from-[#DCF87C]/40 to-[#DCF87C]/70" />
        ) : (
          <>
            {/* The lime fill, growing down the rule, brightest at the tip. */}
            <motion.div
              style={{ scaleY: progress, transformOrigin: 'top' }}
              className="absolute inset-0 origin-top bg-gradient-to-b from-[#DCF87C]/30 to-[#DCF87C] will-change-transform"
            />
            {/* The head riding the leading edge — a lit dot over a soft halo. */}
            <motion.div style={{ top: headTop, opacity: capOpacity }} className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C]/30 blur-md" />
              <span className="relative block h-2.5 w-2.5 rounded-full bg-[#DCF87C] shadow-[0_0_12px_2px_rgba(220,248,124,0.6)]" />
            </motion.div>
          </>
        )}
      </div>

      {/* The content, shifted off the rule by a reading margin. */}
      <div className="pl-7 sm:pl-10">{children}</div>
    </div>
  )
}
