import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { GO_TARGETS } from './Keyboard'
import { useContact } from './ContactDialog'
import { EMAIL, GITHUB_URL } from '../data/contact'

const PANEL_EASE = [0.16, 1, 0.3, 1] as const

// The full destination list for the mobile drawer, drawn from the same source
// of truth the keyboard chords use so the two never drift.
const LINKS = GO_TARGETS

// A two-bar hamburger that morphs into an X while the drawer is open.
function MenuGlyph({ open, reduced }: { open: boolean; reduced: boolean }) {
  const t = reduced ? { duration: 0 } : { duration: 0.3, ease: PANEL_EASE }
  return (
    <span className="relative block h-4 w-5" aria-hidden>
      <motion.span
        className="absolute left-0 block h-[2px] w-full rounded-full bg-current"
        initial={false}
        animate={open ? { top: 7, rotate: 45 } : { top: 2, rotate: 0 }}
        transition={t}
      />
      <motion.span
        className="absolute left-0 block h-[2px] w-full rounded-full bg-current"
        initial={false}
        animate={open ? { top: 7, rotate: -45 } : { top: 12, rotate: 0 }}
        transition={t}
      />
    </span>
  )
}

// Mobile-only navigation. The desktop Nav hides its page links below `sm`, so
// without this there is no way to reach the routes on a phone. Renders its own
// trigger (a hamburger) plus a full-height drawer of large editorial links.
export function MobileMenu() {
  const reduced = useReducedMotion() ?? false
  const [open, setOpen] = useState(false)
  const { open: openContact } = useContact()
  const { pathname } = useLocation()

  // Close on route change so tapping a link dismisses the drawer.
  useEffect(() => setOpen(false), [pathname])

  // Escape to close + lock body scroll while the drawer is up.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const listStagger = reduced
    ? {}
    : { transition: { staggerChildren: 0.05, delayChildren: 0.08 } }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition hover:border-white/20 hover:text-white sm:hidden"
      >
        <MenuGlyph open={open} reduced={reduced} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex flex-col bg-[#0A0A0A]/95 backdrop-blur-xl sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            {/* Header row: brand + an explicit close control, since the drawer
                sits above the floating nav and covers its toggle. */}
            <div className="flex shrink-0 items-center justify-between px-7 pb-2 pt-7">
              <Link to="/" className="text-lg font-bold tracking-tight text-white">
                AC
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition hover:border-white/20 hover:text-white"
              >
                <span aria-hidden className="text-2xl leading-none">
                  &times;
                </span>
              </button>
            </div>
            <div className="h-6 shrink-0" />

            <motion.nav
              className="flex flex-1 flex-col gap-1 overflow-y-auto px-7 pb-8"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: listStagger }}
            >
              {LINKS.map(({ to, label }) => (
                <motion.div
                  key={to}
                  variants={{
                    hidden: reduced ? {} : { opacity: 0, x: -16 },
                    show: { opacity: 1, x: 0 },
                  }}
                  transition={{ duration: 0.4, ease: PANEL_EASE }}
                >
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `group flex items-baseline justify-between border-b border-white/[0.06] py-4 font-display text-4xl tracking-tight transition-colors ${
                        isActive ? 'text-[#DCF87C]' : 'text-white/80 hover:text-white'
                      }`
                    }
                  >
                    {label}
                    <span
                      aria-hidden
                      className="text-base text-white/20 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[#DCF87C]"
                    >
                      &rarr;
                    </span>
                  </NavLink>
                </motion.div>
              ))}
            </motion.nav>

            <motion.div
              className="shrink-0 border-t border-white/[0.06] px-7 py-6"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.4, duration: 0.4, ease: PANEL_EASE }}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  openContact()
                }}
                className="w-full rounded-full bg-[#DCF87C] px-5 py-3 text-center text-sm font-semibold text-black transition hover:brightness-105"
              >
                Get in touch
              </button>
              <div className="mt-5 flex items-center justify-between text-sm text-white/45">
                <a
                  href={`mailto:${EMAIL}`}
                  className="underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
                >
                  {EMAIL}
                </a>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
                >
                  GitHub
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
