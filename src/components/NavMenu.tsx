import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { CONTENTS, ALL_CONTENT_ENTRIES } from '../data/contents'

const EASE = [0.16, 1, 0.3, 1] as const

// The desktop nav's "Explore" affordance: a hover/click popover that unfolds the
// whole site map — every real route, grouped into the same editorial sections the
// /contents page uses (single source of truth: `CONTENTS`). The floating nav only
// ever shows a handful of top-level links; this is how the other two dozen pages
// become reachable in one glance, so the breadth of the work reads at a hover
// instead of hiding behind a search box. Desktop only (`sm:` and up) — the phone
// has its own full-height drawer in MobileMenu.
//
// Interaction, all honest and keyboard-safe:
//  - Opens on pointer hover (with a small intent delay so a passing cursor does
//    not trip it) and on click/focus; a click toggles.
//  - Closes on Escape, on a click outside the wrapper, on route change, and when
//    the pointer leaves the whole trigger+panel region.
//  - A springing lime marker (`layoutId`) tracks the hovered/focused row.
//  - Fully reduced-motion aware: no unfold, no stagger, instant show/hide.

const TOTAL = ALL_CONTENT_ENTRIES.length

export function NavMenu() {
  const reduced = useReducedMotion() ?? false
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelId = useId()
  const { pathname } = useLocation()

  const clearTimers = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = null
    openTimer.current = null
  }, [])

  // Close whenever the route changes, so choosing a destination dismisses the menu.
  useEffect(() => {
    setOpen(false)
    setHovered(null)
  }, [pathname])

  // Escape to close + dismiss on any click outside the trigger/panel region.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointer(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  useEffect(() => () => clearTimers(), [clearTimers])

  // Hover intent: a beat before opening, a slightly longer grace before closing,
  // so the diagonal trip from the trigger down into the panel never dismisses it.
  function hoverOpen() {
    clearTimers()
    openTimer.current = setTimeout(() => setOpen(true), 90)
  }
  function hoverClose() {
    clearTimers()
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      setHovered(null)
    }, 140)
  }

  return (
    <div
      ref={wrapRef}
      className="relative hidden sm:block"
      onMouseEnter={hoverOpen}
      onMouseLeave={hoverClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => {
          clearTimers()
          setOpen((v) => !v)
        }}
        className={`flex items-center gap-1.5 text-sm transition-colors hover:text-white ${
          open ? 'text-[#DCF87C]' : 'text-white/60'
        }`}
      >
        Explore
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            key="nav-menu-panel"
            initial={reduced ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: -8, scale: 0.98 }}
            animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0, x: '-50%' } : { opacity: 0, x: '-50%', y: -8, scale: 0.98 }}
            transition={{ duration: reduced ? 0.12 : 0.28, ease: EASE }}
            style={{ transformOrigin: 'top center' }}
            className="fixed left-1/2 top-[4.9rem] z-50 w-[min(92vw,860px)] overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A]/95 shadow-2xl shadow-black/70 backdrop-blur-2xl"
            role="region"
            aria-label="Explore the site"
            onMouseEnter={clearTimers}
          >
            {/* A faint lime wash at the top edge so the panel reads as a lit surface. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(220,248,124,0.08),transparent)]"
            />
            <div
              className="relative grid gap-x-8 gap-y-7 p-7 sm:grid-cols-2 lg:grid-cols-3"
              onMouseLeave={() => setHovered(null)}
            >
              {CONTENTS.map((section, s) => (
                <motion.div
                  key={section.label}
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: reduced ? 0 : 0.04 + s * 0.05 }}
                >
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">
                    {section.label}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/40">{section.intro}</p>
                  <ul className="mt-3 space-y-0.5">
                    {section.entries.map((entry) => {
                      const isActive = pathname === entry.to
                      const isHot = hovered === entry.to
                      return (
                        <li key={entry.to} className="relative">
                          {isHot && (
                            <motion.span
                              layoutId="nav-menu-marker"
                              transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                              className="absolute inset-0 -z-10 rounded-xl border border-[#DCF87C]/20 bg-white/[0.05]"
                            />
                          )}
                          <Link
                            to={entry.to}
                            onMouseEnter={() => setHovered(entry.to)}
                            onFocus={() => setHovered(entry.to)}
                            className="group flex items-center gap-2 rounded-xl px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40"
                          >
                            <span
                              className={`text-sm font-medium transition-colors ${
                                isActive ? 'text-[#DCF87C]' : 'text-white/85 group-hover:text-white'
                              }`}
                            >
                              {entry.title}
                            </span>
                            {entry.chord && (
                              <kbd className="ml-auto hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-sans text-[0.6rem] uppercase tracking-wide text-white/30 lg:inline">
                                g {entry.chord}
                              </kbd>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </motion.div>
              ))}
            </div>

            {/* Footer rail: a full index link + an honest count of everything reachable. */}
            <div className="relative flex items-center justify-between border-t border-white/[0.06] px-7 py-4">
              <Link
                to="/contents"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
              >
                The full index
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </Link>
              <span className="text-xs text-white/35">
                <span className="tabular-nums text-white/55">{TOTAL}</span> places to go · tap{' '}
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-sans text-[0.6rem] text-white/40">
                  g
                </kbd>{' '}
                then a key
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
