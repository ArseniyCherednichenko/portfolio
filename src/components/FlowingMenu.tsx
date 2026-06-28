import { useRef } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

export type FlowingItem = {
  label: string
  /** Internal route (react-router). */
  to?: string
  /** External URL. */
  href?: string
  /** Small trailing hint shown on the resting row (e.g. a section count or kind). */
  hint?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// React Bits-style flowing menu. A column of large editorial link rows; on
// hover a lime marquee panel slides in from whichever edge the cursor crossed
// (top or bottom) and slides back out toward the edge it leaves by, with the
// destination label scrolling across it. Internal rows are router <Link>s,
// external rows open in a new tab. Under reduced motion it drops the panel and
// the slide entirely and just warms the row on hover — fully legible, no loop.
export function FlowingMenu({ items }: { items: FlowingItem[] }) {
  return (
    <ul className="divide-y divide-white/10 border-y border-white/10">
      {items.map((item) => (
        <FlowingRow key={item.label} item={item} />
      ))}
    </ul>
  )
}

// Which edge (top/bottom) is the pointer closest to, relative to the row.
function edge(e: React.MouseEvent<HTMLElement>): 'top' | 'bottom' {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY - r.top < r.height / 2 ? 'top' : 'bottom'
}

function FlowingRow({ item }: { item: FlowingItem }) {
  const reduce = useReducedMotion()
  const controls = useAnimationControls()
  const animating = useRef(false)

  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (reduce) return
    animating.current = true
    const from = edge(e) === 'top' ? '-101%' : '101%'
    controls.set({ y: from })
    controls.start({ y: '0%', transition: { duration: 0.5, ease: EASE } })
  }

  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    if (reduce) return
    const to = edge(e) === 'top' ? '-101%' : '101%'
    controls.start({ y: to, transition: { duration: 0.5, ease: EASE } }).then(() => {
      animating.current = false
    })
  }

  const inner = (
    <span
      className="relative flex items-center justify-between gap-4 overflow-hidden px-1 py-7 sm:py-9"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Resting label */}
      <span className="font-display text-4xl font-bold tracking-tight text-white/85 transition-colors duration-300 group-hover:text-white sm:text-6xl">
        {item.label}
      </span>
      <span className="z-10 flex items-center gap-4 text-white/35 transition-colors duration-300 group-hover:text-white/70">
        {item.hint && (
          <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] sm:inline">{item.hint}</span>
        )}
        <span
          aria-hidden
          className="text-2xl transition-transform duration-300 ease-out group-hover:translate-x-1 sm:text-3xl"
        >
          &#8594;
        </span>
      </span>

      {/* Sliding lime marquee panel */}
      {!reduce && (
        <motion.span
          aria-hidden
          initial={{ y: '101%' }}
          animate={controls}
          className="pointer-events-none absolute inset-0 z-20 flex items-center overflow-hidden bg-[#DCF87C] text-black"
        >
          <Strip label={item.label} />
        </motion.span>
      )}
    </span>
  )

  const cls = 'group block'

  return (
    <li>
      {item.to ? (
        <Link to={item.to} className={cls}>
          {inner}
        </Link>
      ) : (
        <a href={item.href} target="_blank" rel="noreferrer" className={cls}>
          {inner}
        </a>
      )}
    </li>
  )
}

// The scrolling label strip inside the lime panel. Two identical tracks make
// the loop seamless; pauses while the row is not hovered is unnecessary since
// the panel is only visible on hover.
function Strip({ label }: { label: string }) {
  const cell = (
    <span className="flex shrink-0 animate-[marquee_14s_linear_infinite] items-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="flex items-center font-display text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="px-6">{label}</span>
          <span className="text-2xl sm:text-3xl">&#9679;</span>
        </span>
      ))}
    </span>
  )
  return (
    <span className="flex whitespace-nowrap">
      {cell}
      {cell}
    </span>
  )
}
