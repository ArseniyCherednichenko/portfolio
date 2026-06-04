import { motion } from 'framer-motion'

// "scroll" hint at the bottom of the hero so visitors know there's more below.
export function ScrollCue() {
  return (
    <motion.a
      href="#about"
      aria-label="Scroll to content"
      className="absolute bottom-8 left-6 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/40 transition-colors hover:text-white/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1, duration: 0.8 }}
    >
      <span>scroll</span>
      <motion.span animate={{ y: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
        &darr;
      </motion.span>
    </motion.a>
  )
}
