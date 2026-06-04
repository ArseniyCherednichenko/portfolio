import { motion } from 'framer-motion'

// Ambient animated background: slow-drifting blurred colour fields behind everything.
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-1/3 left-1/4 h-[60vmax] w-[60vmax] rounded-full bg-[#DCF87C]/18 blur-[140px]"
        animate={{ x: [0, 80, -40, 0], y: [0, 60, 20, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 right-1/5 h-[50vmax] w-[50vmax] rounded-full bg-emerald-400/12 blur-[140px]"
        animate={{ x: [0, -60, 30, 0], y: [0, -40, 10, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[45vmax] w-[45vmax] rounded-full bg-sky-500/10 blur-[150px]"
        animate={{ x: [0, 40, -30, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
