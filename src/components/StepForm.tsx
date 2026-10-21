import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// The multi-step form — the onboarding wizard, the checkout, the setup flow —
// the shape every real product ships and almost nobody builds with care. The
// lazy version is a stack of <div>s toggled by an index, and it drops every
// part that makes the pattern humane: the direction a step arrives from, the
// validation that has to stop you before you leave a half-filled step, the
// focus that must land *inside* the new step so a keyboard never falls to the
// body, and the height that should glide between steps instead of snapping the
// whole card taller the moment a longer one mounts.
//
// This is the shell done properly, and only the shell: the caller owns the
// fields and their state, so this stays a reusable flow rather than one bound
// to a single form. The hard parts a lazy version skips, all present:
//
//  (1) Steps arrive from the direction you are travelling. Next slides the new
//      step in from the right and the old one out to the left; Back reverses
//      it, so motion carries a sense of place rather than a generic fade.
//
//  (2) A step cannot be left half-done. Next runs the step's own validate(); a
//      returned message blocks the advance, shows inline, shakes the card, and
//      is announced assertively — a blocked advance is the one thing a user
//      must never be left to guess at.
//
//  (3) Focus follows the flow. On every step change focus moves to the new
//      step's heading (a -1 tabindex target), so the next Tab lands on that
//      step's first field and a screen reader hears the step it is now on,
//      spoken as "Step 2 of 3".
//
//  (4) The card's height glides. Each step is a different height, so the panel
//      measures the mounted step and springs its own height to match — the
//      card grows and shrinks around its content instead of snapping or
//      reserving the tallest step's box for all of them.
//
// Reduced motion keeps every one of those behaviours and drops only their
// movement: steps cross-fade in place with no slide, the height snaps, the
// spinner holds still, and the completion check appears already drawn.

export interface WizardStep {
  /** Stable id for the step. */
  id: string
  /** The step's heading — also the focus target on arrival. */
  title: string
  /** An optional line under the heading. */
  hint?: string
  /** The step's own fields. The caller renders and owns these. */
  body: ReactNode
  /**
   * Run when the user tries to advance *past* this step. Return a message to
   * block the advance (shown inline, announced, shakes the card), or
   * null/undefined to allow it. Closes over the caller's own field state.
   */
  validate?: () => string | null | undefined
}

export interface StepFormProps {
  /** The ordered steps. The caller may pass a fresh array each render. */
  steps: WizardStep[]
  /**
   * Run when the final step is confirmed. May be async; the flow follows its
   * promise — resolve lands on the done panel, reject returns to the step and
   * announces the failure.
   */
  onComplete?: () => void | Promise<void>
  /** Label for the final confirm button. Default "Finish". */
  finishLabel?: string
  /** What to show once onComplete resolves. */
  done?: ReactNode
  /** Called when the done panel's "Start over" is pressed. */
  onReset?: () => void
  className?: string
}

type Status = 'editing' | 'submitting' | 'done'

/**
 * A multi-step form shell: directional step transitions, per-step validation
 * that gates Next, focus that follows the flow into each step, a height that
 * glides to the mounted step, and a submit → success landing. Reduced-motion
 * aware. The caller owns the fields; this owns the choreography.
 */
export function StepForm({
  steps,
  onComplete,
  finishLabel = 'Finish',
  done,
  onReset,
  className = '',
}: StepFormProps) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  // +1 travelling forward, -1 back — drives which side a step enters from.
  const [dir, setDir] = useState<1 | -1>(1)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('editing')
  const [announce, setAnnounce] = useState('')
  const [fault, setFault] = useState('')

  const count = steps.length
  const step = steps[Math.min(index, count - 1)]
  const isLast = index === count - 1

  const headingRef = useRef<HTMLHeadingElement>(null)
  const alive = useRef(true)
  // Skip the focus move on the very first mount — no step change happened yet,
  // so stealing focus into the card on load would be hostile.
  const mounted = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // On every step change, move focus to the new step's heading and speak the
  // step out. The heading is a -1 tabindex target, so the next Tab lands on the
  // step's first real field rather than the body.
  useEffect(() => {
    if (status !== 'editing') return
    if (!mounted.current) {
      mounted.current = true
      return
    }
    headingRef.current?.focus()
    setAnnounce(`Step ${index + 1} of ${count}: ${step?.title ?? ''}`)
  }, [index, count, step?.title, status])

  const goNext = useCallback(() => {
    const msg = step?.validate?.()
    if (msg) {
      setError(msg)
      setFault(msg)
      return
    }
    setError(null)
    if (isLast) {
      setStatus('submitting')
      setAnnounce('Submitting')
      Promise.resolve()
        .then(() => onComplete?.())
        .then(() => {
          if (!alive.current) return
          setStatus('done')
          setAnnounce('Done')
        })
        .catch(() => {
          if (!alive.current) return
          setStatus('editing')
          setFault('Something went wrong. Please try again.')
        })
      return
    }
    setDir(1)
    setIndex((i) => Math.min(i + 1, count - 1))
  }, [step, isLast, onComplete, count])

  const goBack = useCallback(() => {
    setError(null)
    setDir(-1)
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  // Jump straight to an already-visited step by clicking its marker. Only
  // backward jumps are allowed — you cannot skip past a step you have not
  // cleared — so this never bypasses validation.
  const goTo = useCallback(
    (to: number) => {
      if (to >= index || status !== 'editing') return
      setError(null)
      setDir(-1)
      setIndex(to)
    },
    [index, status],
  )

  const reset = useCallback(() => {
    setStatus('editing')
    setError(null)
    setDir(-1)
    setIndex(0)
    mounted.current = false
    onReset?.()
  }, [onReset])

  const slide = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d > 0 ? 36 : -36 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d > 0 ? -36 : 36 }),
  }

  return (
    <div className={`w-full max-w-md ${className}`}>
      {/* Progress rail — one marker per step, the cleared ones checked and
          clickable to step back, the current one lit, the rest dim. */}
      <ol className="mb-8 flex items-center" aria-hidden={status === 'done'}>
        {steps.map((s, i) => {
          const state = status === 'done' || i < index ? 'done' : i === index ? 'current' : 'todo'
          const canJump = i < index && status === 'editing'
          return (
            <li key={s.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => goTo(i)}
                disabled={!canJump}
                aria-label={`Step ${i + 1}: ${s.title}${state === 'done' ? ' (completed)' : ''}`}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  state === 'done'
                    ? 'border-[#DCF87C] bg-[#DCF87C] text-black'
                    : state === 'current'
                      ? 'border-[#DCF87C] text-[#DCF87C]'
                      : 'border-white/15 text-white/35'
                } ${canJump ? 'cursor-pointer hover:brightness-110' : 'cursor-default'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
              >
                {state === 'done' ? <TickMark reduce={!!reduce} /> : i + 1}
                {state === 'current' && (
                  <motion.span
                    layoutId={reduce ? undefined : 'stepform-ring'}
                    className="pointer-events-none absolute -inset-[3px] rounded-full ring-2 ring-[#DCF87C]/40"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
              </button>
              {i < count - 1 && (
                <span className="mx-2 h-px flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.span
                    className="block h-full bg-[#DCF87C]"
                    initial={false}
                    animate={{ scaleX: i < index || status === 'done' ? 1 : 0 }}
                    style={{ transformOrigin: 'left' }}
                    transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <AutoHeight reduce={!!reduce} dep={status === 'done' ? 'done' : index}>
        {status === 'done' ? (
          <motion.div
            key="done"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
            className="text-center"
          >
            <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#DCF87C] text-black">
              <TickMark reduce={!!reduce} large />
            </span>
            {done ?? <p className="text-lg font-medium text-white/90">All set.</p>}
            {onReset && (
              <button
                type="button"
                onClick={reset}
                className="mt-7 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Start over
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step?.id ?? index}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-xl font-semibold tracking-tight text-white focus:outline-none sm:text-2xl"
              >
                {step?.title}
              </h3>
              {step?.hint && <p className="mt-1.5 text-sm leading-relaxed text-white/50">{step.hint}</p>}
              <div className="mt-6">{step?.body}</div>
            </motion.div>
          </AnimatePresence>
        )}
      </AutoHeight>

      {status !== 'done' && (
        <>
          {/* The inline block, reserved so its appearance never nudges the
              buttons — a blocked advance should feel firm, not jumpy. */}
          <div className="min-h-[1.5rem] pt-3" aria-hidden={!error}>
            <AnimatePresence>
              {error && (
                <motion.p
                  key={error}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 0 }}
                  animate={
                    reduce
                      ? { opacity: 1 }
                      : { opacity: 1, x: [0, -6, 6, -4, 4, 0] }
                  }
                  exit={{ opacity: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.4 }}
                  className="text-sm font-medium text-red-300"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={index === 0 || status === 'submitting'}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-white/60 transition-colors enabled:hover:text-white disabled:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Back
            </button>
            <motion.button
              type="button"
              onClick={goNext}
              disabled={status === 'submitting'}
              aria-busy={status === 'submitting' || undefined}
              whileTap={reduce || status === 'submitting' ? undefined : { scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#DCF87C]/90 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {status === 'submitting' && <Spinner reduce={!!reduce} />}
              {status === 'submitting' ? 'Submitting' : isLast ? finishLabel : 'Next'}
            </motion.button>
          </div>
        </>
      )}

      {/* The step and its completion are polite; a blocked advance or a failed
          submit is assertive, because a stop the user did not expect is the one
          outcome a non-sighted user must never miss. */}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      <span className="sr-only" aria-live="assertive">
        {fault}
      </span>
    </div>
  )
}

// A wrapper that springs its own height to the measured height of its single
// child, so the card glides between steps of different sizes instead of
// snapping. Under reduced motion it holds a plain auto height and never
// animates. `dep` forces a re-measure when the active step changes even if the
// outer box dimensions happen to match.
function AutoHeight({
  children,
  reduce,
  dep,
}: {
  children: ReactNode
  reduce: boolean
  dep: number | string
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')

  const measure = useCallback(() => {
    const el = innerRef.current
    if (el) setHeight(el.offsetHeight)
  }, [])

  // Measure synchronously after layout so the first paint already carries the
  // right height, and re-measure whenever the active step changes.
  useLayoutEffect(measure, [measure, dep])

  // Keep tracking while content inside a step grows or shrinks (an error line
  // appearing, a field expanding), so the card never clips its own content.
  useEffect(() => {
    const el = innerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  if (reduce) {
    return (
      <div className="relative overflow-hidden">
        <div ref={innerRef}>{children}</div>
      </div>
    )
  }

  return (
    <motion.div
      className="relative overflow-hidden"
      animate={{ height }}
      initial={false}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  )
}

function TickMark({ reduce, large = false }: { reduce: boolean; large?: boolean }) {
  const s = large ? 22 : 15
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth={large ? 2.6 : 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
      />
    </svg>
  )
}

function Spinner({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { repeat: Infinity, ease: 'linear', duration: 0.8 }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2.6} />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </motion.svg>
  )
}
