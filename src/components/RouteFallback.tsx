import { motion, useReducedMotion } from 'framer-motion'

// Shown inside the animated page container while a lazy-loaded route chunk
// streams in. Deliberately calm and brief — a single lime orbit that traces
// itself, echoing the site's HeroOrbit / favicon mark, so a slow network reads
// as the site "assembling" rather than a blank gap. It reserves a screenful of
// height so the footer never jumps up under it, and the incoming page's own
// entrance takes over the moment the chunk resolves.
//
// Honest to assistive tech: a polite live region announces the load; the mark
// itself is decorative. Under reduced motion the orbit sits still (a faint
// static ring + dot) with no spin or pulse — the label still carries meaning.
export function RouteFallback() {
  const reduce = useReducedMotion()
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-6"
    >
      <div className="relative h-14 w-14">
        {/* faint full ring — the orbit path */}
        <span className="absolute inset-0 rounded-full border border-white/10" />
        {/* the tracing arc: a lime-topped ring that rotates */}
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#DCF87C]"
          style={{ filter: 'drop-shadow(0 0 6px rgba(220,248,124,0.5))' }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={
            reduce
              ? undefined
              : { duration: 1.1, ease: 'linear', repeat: Infinity }
          }
        />
        {/* the drifting dot at the centre */}
        <motion.span
          className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C]"
          style={{ boxShadow: '0 0 10px rgba(220,248,124,0.7)' }}
          animate={reduce ? undefined : { scale: [1, 0.6, 1], opacity: [1, 0.5, 1] }}
          transition={
            reduce
              ? undefined
              : { duration: 1.1, ease: 'easeInOut', repeat: Infinity }
          }
        />
      </div>
      <span className="text-xs uppercase tracking-[0.28em] text-white/30">
        Loading
      </span>
    </div>
  )
}
