import { motion, useReducedMotion } from 'framer-motion'

// Decorative animated orbit for the hero's right side (large screens only):
// a glowing core, a rotating conic ring, and orbiting dots. Fills the width
// and adds motion so the hero doesn't read as empty. Static under reduced motion.
export function HeroOrbit() {
  const reduce = useReducedMotion()
  const spin = (dir: 1 | -1 = 1) => (reduce ? undefined : ({ rotate: 360 * dir } as const))
  const spinT = (duration: number) => ({ duration, repeat: Infinity, ease: 'linear' as const })

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-[-4%] top-1/2 hidden h-[540px] w-[540px] -translate-y-1/2 lg:block"
    >
      {/* glow core */}
      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C]/25 blur-3xl" />

      {/* rotating conic ring (masked to a thin ring) */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent, rgba(220,248,124,0.55), transparent 55%)',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
        }}
        animate={spin()}
        transition={spinT(22)}
      />

      {/* inner ring with a lime dot */}
      <motion.div
        className="absolute inset-[20%] rounded-full border border-white/10"
        animate={spin(-1)}
        transition={spinT(38)}
      >
        <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C]" />
      </motion.div>

      {/* outer orbiting dot */}
      <motion.div className="absolute inset-0" animate={spin()} transition={spinT(16)}>
        <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
      </motion.div>
    </div>
  )
}
