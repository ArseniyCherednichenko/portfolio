import { useRef } from 'react'
import { motion, useMotionValue, useMotionTemplate, useSpring, useReducedMotion } from 'framer-motion'
import { useFinePointer } from '../hooks/useFinePointer'

interface Props {
  /** The full statement. Read once by assistive tech; split into words visually. */
  text: string
  /** Words to paint lime in the lit layer (matched case- and punctuation-insensitively). */
  highlight?: string[]
  /** Radius of the torch, in px. */
  radius?: number
  /** Optional small prompt shown under the text — only on fine pointers with motion allowed. */
  hint?: string
  className?: string
}

function words(text: string, highlight: string[], lit: boolean) {
  const set = new Set(highlight.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')))
  return text.split(' ').map((word, i) => {
    const bare = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
    const on = lit && set.has(bare)
    return (
      <span key={i} className={on ? 'text-[#DCF87C]' : undefined}>
        {word}
        {i < text.split(' ').length - 1 ? ' ' : ''}
      </span>
    )
  })
}

// A statement that sits nearly dark until you sweep a torch of light across it
// with the cursor — the lit words (and a few lime highlights) resolve out of the
// gloom under the pointer, then fade back as it leaves. Bring your own light.
// Under reduced motion or on touch it renders fully lit and legible; the whole
// string is exposed to assistive tech once via a visually-hidden copy.
export function SpotlightReveal({ text, highlight = [], radius = 180, hint, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const enabled = fine && !reduce

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 350, damping: 32, mass: 0.4 })
  const y = useSpring(my, { stiffness: 350, damping: 32, mass: 0.4 })
  const raw = useMotionValue(0)
  const opacity = useSpring(raw, { stiffness: 200, damping: 30 })
  const mask = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, #000 0%, #000 26%, transparent 72%)`

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    mx.set(e.clientX - r.left)
    my.set(e.clientY - r.top)
  }

  if (!enabled) {
    return (
      <div className={className}>
        {words(text, highlight, true)}
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseEnter={() => raw.set(1)}
        onMouseLeave={() => raw.set(0)}
        className="relative"
      >
        {/* Dim base — the statement waiting in the dark. */}
        <div aria-hidden className="text-white/[0.1]">
          {words(text, highlight, false)}
        </div>
        {/* Lit layer, clipped to the torch and faded in while the pointer is over it. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 text-white"
          style={{ opacity, maskImage: mask, WebkitMaskImage: mask }}
        >
          {words(text, highlight, true)}
        </motion.div>
        <span className="sr-only">{text}</span>
      </div>
      {hint && (
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-white/30">{hint}</p>
      )}
    </div>
  )
}
