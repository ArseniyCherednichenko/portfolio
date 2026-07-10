import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion'
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

export interface StepperStep {
  /** Short rail label, e.g. "Write". */
  label: string
  /** Panel heading. */
  title: string
  /** Panel body copy. ReactNode so it can carry links or emphasis. */
  body: ReactNode
}

/**
 * An accessible, animated step-through. A numbered rail marks each stage; a
 * lime fill sweeps the connector up to the active node. The active node's panel
 * slides in from the direction of travel (right when advancing, left when going
 * back) so the motion mirrors the intent. Prev/Next controls, direct clicks on
 * any node, left/right arrow keys, and a drag/swipe on the panel all move
 * between steps.
 *
 * Honest to assistive tech: the rail is an ordered list of buttons carrying
 * aria-current, the panel is a labelled live region, and the controls disable
 * at the ends. Under reduced motion the panel cross-fades in place with no
 * directional travel and the connector fills without animation.
 */
export function Stepper({
  steps,
  /** Step index active on mount. */
  defaultStep = 0,
  className = '',
}: {
  steps: StepperStep[]
  defaultStep?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const baseId = useId()
  const [[active, dir], setActive] = useState<[number, number]>([defaultStep, 0])
  const railRef = useRef<HTMLOListElement>(null)

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(steps.length - 1, next))
      setActive(([cur]) => [clamped, Math.sign(clamped - cur) || 0])
    },
    [steps.length],
  )

  const onRailKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      go(active + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      go(active - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      go(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      go(steps.length - 1)
    }
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(active + 1)
    else if (info.offset.x > 60 || info.velocity.x > 400) go(active - 1)
  }

  const step = steps[active]
  const atStart = active === 0
  const atEnd = active === steps.length - 1
  // Connector fill: the rail has (n - 1) gaps; fill up to the active node.
  const fillPct = steps.length > 1 ? (active / (steps.length - 1)) * 100 : 0

  const slide = 40

  return (
    <div className={className}>
      {/* Rail */}
      <ol
        ref={railRef}
        tabIndex={0}
        onKeyDown={onRailKey}
        aria-label="Steps"
        className="relative flex items-start justify-between rounded-2xl outline-none ring-[#DCF87C]/40 focus-visible:ring-2"
      >
        {/* track */}
        <span
          aria-hidden
          className="absolute left-[7%] right-[7%] top-4 h-[2px] -translate-y-1/2 rounded-full bg-white/12"
        />
        <motion.span
          aria-hidden
          className="absolute left-[7%] top-4 h-[2px] -translate-y-1/2 rounded-full bg-[#DCF87C]"
          style={{ right: `calc(100% - 7% - (100% - 14%) * ${fillPct / 100})` }}
          initial={false}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
        />

        {steps.map((s, i) => {
          const done = i < active
          const current = i === active
          return (
            <li
              key={s.label}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2.5"
            >
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${s.label}`}
                className="grid h-8 w-8 place-items-center rounded-full text-sm font-semibold outline-none ring-[#DCF87C]/50 transition-colors focus-visible:ring-2"
                style={{
                  backgroundColor: current
                    ? '#DCF87C'
                    : done
                      ? 'rgba(220,248,124,0.15)'
                      : 'rgba(255,255,255,0.05)',
                  color: current ? '#000' : done ? '#DCF87C' : 'rgba(255,255,255,0.5)',
                  border: current
                    ? '1px solid #DCF87C'
                    : done
                      ? '1px solid rgba(220,248,124,0.4)'
                      : '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {done ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path d="M5 12.5l4 4 10-10" />
                  </svg>
                ) : (
                  i + 1
                )}
              </button>
              <span
                className={`px-1 text-center text-xs font-medium transition-colors sm:text-sm ${
                  current ? 'text-white' : 'text-white/45'
                }`}
              >
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Panel */}
      <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        <AnimatePresence initial={false} mode="wait" custom={dir}>
          <motion.div
            key={active}
            role="region"
            aria-live="polite"
            aria-label={`Step ${active + 1} of ${steps.length}: ${step.label}`}
            custom={dir}
            drag={reduce ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            onDragEnd={reduce ? undefined : onDragEnd}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, x: dir >= 0 ? slide : -slide }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, x: dir >= 0 ? -slide : slide }
            }
            transition={{ duration: reduce ? 0.18 : 0.42, ease: EASE }}
            className="cursor-grab p-8 active:cursor-grabbing sm:p-10"
          >
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">
              {String(active + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </span>
            <h3 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {step.title}
            </h3>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/60">{step.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => go(active - 1)}
          disabled={atStart}
          aria-controls={baseId}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>

        <div className="flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.label}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === active ? 22 : 6,
                backgroundColor: i === active ? '#DCF87C' : 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(active + 1)}
          disabled={atEnd}
          className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
