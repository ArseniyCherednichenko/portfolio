import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

const EASE = [0.16, 1, 0.3, 1] as const

// The minimal shape a project needs to render as a link here. Kept local so the
// component stays a dumb, reusable presenter — the caller passes whichever real
// projects (from data/projects.ts) exercise the discipline on the page.
export interface ProjectLinkItem {
  slug: string
  title: string
  /** An optional muted meta tail, e.g. the year or a one-word status. */
  meta?: string
}

/**
 * A row of project pills, each a link through to its /work/:slug case study.
 * This is the Range -> Work thread in its compact form: a discipline names the
 * real projects that exercise it, so the "more than one project" claim is proven
 * inline — the exact mirror of {@link DisciplineLinks}, which runs Work -> Range.
 *
 * The pills are tinted with a single `accent` passed by the caller — the
 * discipline's own accent hex — so a discipline's evidence reads in that
 * discipline's colour rather than the house lime. On hover the dot and border
 * lift toward the accent and the pill eases up a hair. Fully keyboard-reachable
 * (real links, visible focus ring) and calm under prefers-reduced-motion: the
 * lift is dropped, the colour cues stay.
 */
export function ProjectLinks({
  projects,
  accent,
  className = '',
  stagger = true,
}: {
  projects: readonly ProjectLinkItem[]
  /** The discipline's accent hex — tints the dot, the hover border, the arrow. */
  accent: string
  className?: string
  /** Stagger the pills in on view. Off for already-animated containers. */
  stagger?: boolean
}) {
  const reduce = useReducedMotion()
  if (projects.length === 0) return null
  return (
    <ul className={`flex flex-wrap gap-2.5 ${className}`}>
      {projects.map((p, i) => (
        <motion.li
          key={p.slug}
          initial={reduce || !stagger ? false : { opacity: 0, y: 10 }}
          whileInView={reduce || !stagger ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, ease: EASE, delay: Math.min(i * 0.06, 0.3) }}
        >
          <Link
            to={`/work/${p.slug}`}
            style={{ ['--accent' as string]: accent }}
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.03] py-2 pl-3 pr-4 text-sm font-medium text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/50 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transform-none motion-reduce:transition-colors"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-125"
              style={{ backgroundColor: accent }}
            />
            {p.title}
            {p.meta && (
              <span aria-hidden className="text-xs font-normal text-white/30">
                {p.meta}
              </span>
            )}
            <span
              aria-hidden
              className="-mr-1 translate-x-0 text-xs opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
              style={{ color: accent }}
            >
              -&gt;
            </span>
          </Link>
        </motion.li>
      ))}
    </ul>
  )
}
