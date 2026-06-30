import { useRef } from 'react'
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion'

export interface TimelineItem {
  /** Short time marker, e.g. a year or "Now". */
  when: string
  /** The headline for this step. */
  what: string
  /** A short honest note. */
  note: string
}

// A single timeline entry. Its node and text warm from muted to lime as the
// drawing spine's progress crosses this entry's slice of the list, so the eye
// is led down the path one step at a time.
function Entry({
  item,
  i,
  n,
  progress,
}: {
  item: TimelineItem
  i: number
  n: number
  progress: MotionValue<number>
}) {
  // The spine "reaches" this node a little before its centre, so the node lights
  // up just as the line arrives rather than after it has passed.
  const at = (i + 0.35) / n
  const span: [number, number] = [Math.max(0, at - 0.12), at]

  const dotScale = useTransform(progress, span, [0.55, 1])
  const dotColor = useTransform(progress, span, ['#3a3a3a', '#DCF87C'])
  const glow = useTransform(progress, span, [0, 0.55])
  const ringOpacity = useTransform(progress, span, [0.12, 0.4])
  const textOpacity = useTransform(progress, span, [0.4, 1])
  const x = useTransform(progress, span, [10, 0])

  return (
    <li className="relative pb-12 pl-12 last:pb-0">
      {/* node */}
      <span className="absolute left-0 top-1 flex h-7 w-7 -translate-x-1/2 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full bg-[#DCF87C] blur-md"
          style={{ opacity: glow, scale: dotScale }}
        />
        <motion.span
          className="absolute inset-0 rounded-full border border-[#DCF87C]"
          style={{ opacity: ringOpacity, scale: dotScale }}
        />
        <motion.span
          className="relative h-3 w-3 rounded-full"
          style={{ backgroundColor: dotColor, scale: dotScale }}
        />
      </span>

      <motion.div style={{ opacity: textOpacity, x }}>
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">
          {item.when}
        </span>
        <h3 className="mt-1.5 font-display text-2xl font-bold leading-tight sm:text-[1.7rem]">
          {item.what}
        </h3>
        <p className="mt-2 max-w-xl leading-relaxed text-white/55">{item.note}</p>
      </motion.div>
    </li>
  )
}

/**
 * A scroll-linked vertical timeline. A faint spine runs down the left edge; a
 * lime gradient line draws itself down the spine as the list scrolls through the
 * viewport, with a glowing head travelling at the tip, and each node warms from
 * grey to lime the moment the line reaches it.
 *
 * Honest, content-first: it just animates whatever `items` it is handed. Under
 * reduced motion it renders a calm, fully drawn static timeline with no scroll
 * listeners.
 */
export function Timeline({
  items,
  className = '',
}: {
  items: readonly TimelineItem[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLOListElement>(null)
  const n = items.length

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.82', 'end 0.55'],
  })
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })
  const headTop = useTransform(progress, [0, 1], ['4px', '100%'])

  if (reduce) {
    return (
      <ol className={`relative border-l border-white/15 ${className}`}>
        {items.map((item) => (
          <li key={item.what} className="relative pb-10 pl-8 last:pb-0">
            <span className="absolute -left-[6px] top-1.5 h-3 w-3 rounded-full bg-[#DCF87C]" />
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">
              {item.when}
            </span>
            <h3 className="mt-1.5 font-display text-2xl font-bold leading-tight">{item.what}</h3>
            <p className="mt-2 max-w-xl leading-relaxed text-white/55">{item.note}</p>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <ol ref={ref} className={`relative ${className}`}>
      {/* faint full-height spine */}
      <span aria-hidden className="absolute bottom-1 left-0 top-1 w-px bg-white/10" />
      {/* lime gradient line that draws down as you scroll */}
      <motion.span
        aria-hidden
        className="absolute bottom-1 left-0 top-1 w-px origin-top bg-gradient-to-b from-[#DCF87C] via-[#DCF87C]/70 to-[#DCF87C]/0"
        style={{ scaleY: progress }}
      />
      {/* glowing head travelling at the tip of the drawn line */}
      <motion.span
        aria-hidden
        className="absolute left-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[#DCF87C] shadow-[0_0_12px_4px_rgba(220,248,124,0.55)]"
        style={{ top: headTop }}
      />
      {items.map((item, i) => (
        <Entry key={item.what} item={item} i={i} n={n} progress={progress} />
      ))}
    </ol>
  )
}
