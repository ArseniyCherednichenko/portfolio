import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

// Breadcrumbs — the wayfinding trail the site's deep routes were missing.
//
// The detail pages (/range/:id, /work/:slug, /writing/:slug) each hand-rolled a
// one-off "section / page" line or a lone "<- All work" back link; none gave a
// full, semantic path back to the root. This is that path, built once and
// properly: a real <nav aria-label="Breadcrumb"> wrapping an ordered list, each
// crumb before the last a router Link, the last the current page marked
// aria-current="page". It is pure navigation infrastructure — about the whole
// site, never a single project — so wiring it in de-centres any one page.
//
// The house signature, applied to a trail: linked crumbs carry a lime hairline
// that draws in from the left on hover/focus (the same underline language the
// footer's FooterLink speaks), the whole trail staggers in from the left on
// mount, and the current crumb is tinted with the page's own accent (a
// discipline colour on /range/:id, lime everywhere else) so the eye lands on
// where it is. Reduced motion drops the stagger and the underline draw — the
// trail is present at once and hover is a plain colour change — because
// wayfinding is information, not decoration.

export interface Crumb {
  /** The visible label, e.g. "Range" or "Motion". */
  label: string
  /** An internal route. Omit on the final (current) crumb. */
  to?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// A right-pointing chevron between crumbs. Decorative — the list order and the
// separators-as-list-structure carry the meaning for assistive tech.
function Separator() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className="h-3.5 w-3.5 shrink-0 text-white/20"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Breadcrumbs({
  items,
  accent = '#DCF87C',
  includeHome = true,
  className = '',
}: {
  /** The trail after the root, nearest-the-root first; the last is the current page. */
  items: Crumb[]
  /** Accent for the current crumb and the hover hairline (default lime). */
  accent?: string
  /** Prepend a "Home" crumb linking to "/" (default true). */
  includeHome?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const trail: Crumb[] = includeHome ? [{ label: 'Home', to: '/' }, ...items] : items
  if (trail.length === 0) return null

  const container: Variants = {
    hidden: {},
    show: {
      transition: reduce ? {} : { staggerChildren: 0.05, delayChildren: 0.02 },
    },
  }
  const crumb: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, x: -6 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: reduce ? 0.2 : 0.4, ease: EASE },
    },
  }

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <motion.ol
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm"
      >
        {trail.map((c, i) => {
          const isCurrent = i === trail.length - 1
          return (
            <Fragment key={`${c.label}-${i}`}>
              <motion.li variants={crumb} className="flex items-center">
                {isCurrent || !c.to ? (
                  <span
                    aria-current={isCurrent ? 'page' : undefined}
                    className="font-semibold"
                    style={isCurrent ? { color: accent } : { color: 'rgba(255,255,255,0.7)' }}
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    to={c.to}
                    className="group relative inline-flex rounded-sm text-white/45 outline-none transition-colors duration-200 hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                  >
                    {c.label}
                    {/* lime hairline that draws in from the left on hover/focus */}
                    <span
                      aria-hidden
                      className={`absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-[#DCF87C] group-hover:scale-x-100 group-focus-visible:scale-x-100 ${
                        reduce ? '' : 'transition-transform duration-300 ease-out'
                      }`}
                    />
                  </Link>
                )}
              </motion.li>
              {!isCurrent && (
                <li aria-hidden className="flex items-center">
                  <Separator />
                </li>
              )}
            </Fragment>
          )
        })}
      </motion.ol>
    </nav>
  )
}
