import { motion, useReducedMotion } from 'framer-motion'

// Reveals a heading word-by-word, each word sliding up from a clipped line.
export function TextReveal({ text, className = '' }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <span className={className}>{text}</span>
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
          >
            {w}
            {' '}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
