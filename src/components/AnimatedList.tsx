import { Link } from 'react-router-dom'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

export interface AnimatedListItem {
  /** Stable key. */
  id: string
  /** Main label / rich content for the row. */
  content: ReactNode
  /** Small trailing content (a tag chip, a date). Optional. */
  meta?: ReactNode
  /** Internal route — renders a router Link. */
  to?: string
  /** External URL — renders an anchor in a new tab. */
  href?: string
  /** Fired on activate when there is no `to`/`href`. */
  onSelect?: () => void
}

// The lime highlight that slides behind the active row. It is one element
// shared across rows (a layoutId spring), so it glides its own box between
// rows instead of every row animating its own background.
function Highlight({ reduce, layoutId }: { reduce: boolean | null; layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className="absolute inset-0 -z-10 rounded-2xl border border-[#DCF87C]/25 bg-[#DCF87C]/[0.06]"
      transition={
        reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }
      }
    />
  )
}

/**
 * A scroll-revealed navigation list with life. Rows arrive one after the next
 * as the list enters view, and a lime highlight springs between rows as you
 * hover or move focus through them. Each row can be an internal `to`, an
 * external `href`, or a plain `onSelect` action.
 *
 * A11y: this stays an ordinary list of real, individually-focusable
 * links/buttons — no ARIA role games — so it reads and tabs exactly as a list
 * should. The only enhancement is that ArrowUp/Down (Left/Right too) move
 * focus between rows and Home/End jump to the ends; the highlight simply
 * tracks whichever row has focus or hover.
 *
 * Under reduced motion the stagger and the sliding highlight are dropped: rows
 * render in place and the highlight appears on the active row instantly.
 */
export function AnimatedList({
  items,
  className = '',
}: {
  items: AnimatedListItem[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const rowRefs = useRef<(HTMLElement | null)[]>([])
  const highlightId = useId()

  const moveFocus = (i: number) => {
    const next = (i + items.length) % items.length
    rowRefs.current[next]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        moveFocus(active + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        moveFocus(active - 1)
        break
      case 'Home':
        e.preventDefault()
        moveFocus(0)
        break
      case 'End':
        e.preventDefault()
        moveFocus(items.length - 1)
        break
    }
  }

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: 0.04 } },
  }
  const row: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }

  return (
    <motion.ul
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      onKeyDown={onKeyDown}
      className={`flex flex-col ${className}`}
    >
      {items.map((item, i) => {
        const isActive = i === active
        const inner = (
          <>
            {isActive && <Highlight reduce={reduce} layoutId={highlightId} />}
            <span className="min-w-0 flex-1">{item.content}</span>
            {item.meta != null && <span className="ml-4 shrink-0">{item.meta}</span>}
            <span
              aria-hidden
              className={`ml-3 shrink-0 text-[#DCF87C] transition-all duration-300 ${
                isActive ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0'
              }`}
            >
              -&gt;
            </span>
          </>
        )

        const shared = {
          onFocus: () => setActive(i),
          onMouseEnter: () => setActive(i),
          className:
            'group relative z-0 flex w-full items-center rounded-2xl px-4 py-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50',
          ref: (el: HTMLElement | null) => {
            rowRefs.current[i] = el
          },
        }

        return (
          <motion.li key={item.id} variants={row} className="relative">
            {item.to ? (
              <Link {...shared} to={item.to}>
                {inner}
              </Link>
            ) : item.href ? (
              <a {...shared} href={item.href} target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <button {...shared} type="button" onClick={item.onSelect}>
                {inner}
              </button>
            )}
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
