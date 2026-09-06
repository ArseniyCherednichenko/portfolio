import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useState, type KeyboardEvent } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

export interface Panel {
  /** Stable id, also used as the React key. */
  id: string
  /** The vertical spine label shown while collapsed. */
  label: string
  /** The heading revealed when the panel opens. */
  title: string
  /** A short line of body copy revealed under the title. */
  body: string
}

/**
 * A row of panels where exactly one is open at a time. The open panel grows to
 * take most of the width (flex-grow) and reveals its title and body; the rest
 * collapse to slim spines showing a rotated label and an index. Hovering or
 * focusing a panel opens it, so the whole thing is drivable by pointer and by
 * keyboard alike (Tab through the panels, or arrow between them) — the classic
 * "expanding panels" gallery, hand-built here rather than pulled from a shelf.
 *
 * The look stays in the site's lime-on-ink language: each panel carries a faint
 * generative gradient keyed off its index, and the open one lifts under a lime
 * wash with a hairline accent rule down its leading edge. On small screens the
 * row becomes a column and panels grow in height instead of width, so the spines
 * never crush to nothing.
 *
 * Reduced motion is a real path: the flex reflow still happens (it is layout,
 * not decoration) but instantly, and the content cross-fade collapses to a plain
 * swap with no travel.
 */
export function ExpandingPanels({
  panels,
  defaultIndex = 0,
  className = '',
}: {
  panels: Panel[]
  /** Which panel is open on mount. */
  defaultIndex?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(defaultIndex)
  const baseId = useId()

  function onKey(e: KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i + 1) % panels.length)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i - 1 + panels.length) % panels.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(panels.length - 1)
    }
  }

  // The flex duration is a plain CSS transition on flex-grow so the reflow reads
  // as one continuous motion; reduced motion drops it to zero.
  const flexMs = reduce ? 0 : 620

  return (
    <div
      className={`flex flex-col gap-2 sm:h-[26rem] sm:flex-row ${className}`}
      role="tablist"
      aria-label="Expanding panels"
      aria-orientation="horizontal"
    >
      {panels.map((panel, i) => {
        const isOpen = i === active
        const panelId = `${baseId}-panel-${i}`
        return (
          <button
            key={panel.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={isOpen}
            aria-controls={panelId}
            tabIndex={isOpen ? 0 : -1}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
            style={{
              flexGrow: isOpen ? 6 : 1,
              flexBasis: 0,
              transition: `flex-grow ${flexMs}ms cubic-bezier(0.16,1,0.3,1)`,
            }}
            className={`group relative min-h-[4.5rem] min-w-0 overflow-hidden rounded-2xl border text-left outline-none transition-colors sm:min-h-0 ${
              isOpen
                ? 'border-[#DCF87C]/30'
                : 'border-white/10 hover:border-white/20 focus-visible:border-[#DCF87C]/40'
            }`}
          >
            {/* Generative ground — a faint gradient keyed off the index, lifting
                to a lime wash while open. */}
            <span
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background: `linear-gradient(${140 + i * 38}deg, rgba(220,248,124,${
                  isOpen ? 0.1 : 0.03
                }) 0%, rgba(255,255,255,0.02) 46%, rgba(0,0,0,0.28) 100%)`,
                transition: 'background 500ms ease',
              }}
            />
            {/* Leading-edge accent rule, only while open. */}
            <span
              aria-hidden
              className="absolute left-0 top-0 h-full w-[2px] origin-top bg-[#DCF87C] transition-transform duration-500 ease-out"
              style={{ transform: `scaleY(${isOpen ? 1 : 0})` }}
            />

            {/* COLLAPSED SPINE — index + rotated label. Fades out as the panel
                opens so the two states never overlap awkwardly. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center gap-3 px-5 transition-opacity duration-300 sm:flex-col sm:justify-between sm:px-0 sm:py-6"
              style={{ opacity: isOpen ? 0 : 1 }}
            >
              <span className="font-display text-sm font-bold tabular-nums text-white/40">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-sm font-semibold tracking-tight text-white/70 sm:[writing-mode:vertical-rl] sm:rotate-180">
                {panel.label}
              </span>
              <span className="hidden font-display text-sm font-bold tabular-nums text-white/15 sm:block">
                {String(i + 1).padStart(2, '0')}
              </span>
            </span>

            {/* OPEN CONTENT — title + body, revealed with a small stagger. */}
            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${i}`}
              className="relative flex h-full flex-col justify-end p-6 sm:p-8"
            >
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    key="open"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0.2 : 0.5, ease: EASE, delay: reduce ? 0 : 0.14 }}
                    className="min-w-0"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#DCF87C]">
                      {panel.label}
                    </p>
                    <h3 className="mt-3 font-display text-2xl font-bold leading-[1.1] tracking-tight text-white sm:text-3xl">
                      {panel.title}
                    </h3>
                    <p className="mt-2.5 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
                      {panel.body}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </button>
        )
      })}
    </div>
  )
}
