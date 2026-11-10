import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { DisciplineDemo } from './DisciplineDemo'
import { DISCIPLINES } from '../data/disciplines'

// RangeShowcase — a self-contained, accessible segmented switcher over the five
// live discipline demonstrations. It is the landing-page counterweight to a
// Guided-only reading of the site: rather than only *telling* a visitor that the
// craft spans frontend, native iOS, backend, applied AI, and motion, it *shows*
// each one as a live, honest piece of interface they can poke at without ever
// leaving the page.
//
// It reuses the exact DisciplineDemo component the /range pages use (no second
// copy of the truth), so every demo stays accurate and reduced-motion-safe by
// construction. The accent follows the active discipline — the house lime stays
// the site accent, these only tint their own panel — and the whole thing is
// deliberately import-light so it can be React.lazy'd into the eager home chunk
// without weighing down first paint.

const EASE = [0.16, 1, 0.3, 1] as const

export function RangeShowcase({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const d = DISCIPLINES[active]

  // Left/right (or up/down) walk the segmented control, so the whole switcher is
  // drivable from the keyboard, not just clickable.
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % DISCIPLINES.length)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + DISCIPLINES.length) % DISCIPLINES.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(DISCIPLINES.length - 1)
    }
  }

  return (
    <div
      className={`rounded-[2rem] border border-white/10 bg-white/[0.02] p-5 sm:p-8 ${className}`}
      style={{ ['--accent' as string]: d.accent }}
    >
      {/* Segmented control — the five disciplines, with a springing marker that
          travels to the active one (layoutId), tinted in that discipline's hue. */}
      <div
        role="tablist"
        aria-label="Disciplines, live"
        onKeyDown={onKey}
        className="flex flex-wrap gap-1.5"
      >
        {DISCIPLINES.map((item, i) => {
          const on = i === active
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className="relative rounded-full px-3.5 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/60 sm:text-sm"
              style={{ color: on ? '#0A0A0A' : 'rgba(255,255,255,0.65)' }}
            >
              {on && (
                <motion.span
                  layoutId="range-showcase-pill"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 -z-10 rounded-full"
                  style={{ backgroundColor: item.accent }}
                />
              )}
              {item.tag}
            </button>
          )
        })}
      </div>

      {/* The live panel. Cross-fades and lifts as the discipline changes; the
          DisciplineDemo is keyed so it re-mounts and re-plays its intro. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={d.id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              {d.title}
            </h3>
            <Link
              to={`/range/${d.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: d.accent }}
            >
              Open {d.tag.toLowerCase()}
              <span aria-hidden>-&gt;</span>
            </Link>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">{d.lede}</p>

          <div className="mt-6">
            <DisciplineDemo id={d.id} accent={d.accent} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default RangeShowcase
