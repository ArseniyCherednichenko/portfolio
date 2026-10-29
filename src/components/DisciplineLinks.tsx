import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

const EASE = [0.16, 1, 0.3, 1] as const

// The minimal shape a discipline needs to render as a link here. Kept local so
// this component stays a dumb, reusable presenter — the caller passes whichever
// disciplines (from data/disciplines.ts) belong on the page.
export interface DisciplineLinkItem {
  id: string
  tag: string
  /** The discipline's own accent hex — tints the dot and the hover border. */
  accent: string
}

/**
 * A row of discipline pills, each a link through to its /range/:id detail page.
 * This is the Work -> Range thread: a project states which disciplines it
 * exercises, and each one is a door into the range rather than a flat label.
 *
 * Each pill carries a dot in the discipline's own accent, so the five read as
 * distinct at a glance; the lime house accent is left for the site chrome. On
 * hover the border and dot lift toward the accent and the pill eases up a hair.
 * Fully keyboard-reachable (real links, visible focus ring) and calm under
 * prefers-reduced-motion — the lift is dropped, the colour cues stay.
 */
export function DisciplineLinks({
  disciplines,
  className = '',
  stagger = true,
}: {
  disciplines: readonly DisciplineLinkItem[]
  className?: string
  /** Stagger the pills in on view. Off for already-animated containers. */
  stagger?: boolean
}) {
  const reduce = useReducedMotion()
  if (disciplines.length === 0) return null
  return (
    <ul className={`flex flex-wrap gap-2.5 ${className}`}>
      {disciplines.map((d, i) => (
        <motion.li
          key={d.id}
          initial={reduce || !stagger ? false : { opacity: 0, y: 10 }}
          whileInView={reduce || !stagger ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, ease: EASE, delay: Math.min(i * 0.06, 0.3) }}
        >
          <Link
            to={`/range/${d.id}`}
            style={{ ['--accent' as string]: d.accent }}
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.03] py-2 pl-3 pr-4 text-sm font-medium text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transform-none motion-reduce:transition-colors"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-125"
              style={{ backgroundColor: d.accent }}
            />
            {d.tag}
            <span
              aria-hidden
              className="-mr-1 translate-x-0 text-xs text-white/30 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
              style={{ color: d.accent }}
            >
              -&gt;
            </span>
          </Link>
        </motion.li>
      ))}
    </ul>
  )
}
