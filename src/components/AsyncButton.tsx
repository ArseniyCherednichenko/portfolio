import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion'

// The stateful action button — the one control every product ships and almost
// nobody builds with care. A plain <button onClick> fires and forgets: the work
// it kicks off (a save, a deploy, a sign-in) takes real time and can fail, and
// the button says nothing about either. So people wire a separate spinner, a
// toast, a disabled flag, and a success message, four pieces that drift out of
// sync — and in the gap a user double-submits, or never learns the thing failed.
//
// This folds the whole lifecycle into the button itself: idle, running, landed,
// failed, and back to idle, as one object that can never contradict its own
// state. The hard parts a lazy version skips, all present:
//
//  (1) The width never jumps. "Save" → "Saving…" → "Saved" are different
//      lengths, so the button measures each label off a hidden mirror and
//      springs its width, with the label itself cross-fading — the control
//      grows and shrinks around its word instead of snapping or reserving a
//      wide, empty box for the longest state.
//
//  (2) Double-submit is impossible. A click is honoured only from idle; while
//      the work runs the button is genuinely disabled and marked aria-busy, so
//      a second press (or a held Enter) cannot fire the action twice.
//
//  (3) Failure is loud, success is calm. A landed action draws a check and
//      announces politely; a rejected one draws an X, shakes, re-enables itself
//      so the label can read "Try again", and announces assertively — because a
//      silent failure is the one outcome a user must never be left to guess at.
//
// Reduced motion keeps every one of those behaviours and drops only their
// motion: the width snaps, the spinner holds still, the check and X appear
// already drawn, and the shake is gone. The button is identical to use.

type Phase = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncButtonProps {
  /**
   * The action to run on press. May be async; the button follows its promise —
   * resolve for success, reject (or throw) for failure. A synchronous return is
   * treated as an instant success.
   */
  onAction?: () => void | Promise<void>
  /** The resting label, e.g. "Save changes". Also the accessible name. */
  label: string
  /** Label while the action runs. Default: the resting label. */
  loadingLabel?: string
  /** Label on success, before it settles back. Default: "Done". */
  successLabel?: string
  /** Label on failure. Default: "Try again". */
  errorLabel?: string
  /** An optional leading glyph shown in the resting state only. */
  icon?: ReactNode
  /** Solid lime (default) or a dark ghost pill. */
  variant?: 'solid' | 'ghost'
  /** How long success/error hold before returning to idle, in ms. Default 1600. */
  resetMs?: number
  /** Disable the control entirely (distinct from the in-flight disable). */
  disabled?: boolean
  className?: string
}

/**
 * A button that carries its own action's lifecycle: idle → loading → success
 * or error → idle. Width morphs to each label, the work cannot be double-fired,
 * and a failure is announced assertively with a shake. Reduced-motion aware.
 */
export function AsyncButton({
  onAction,
  label,
  loadingLabel,
  successLabel = 'Done',
  errorLabel = 'Try again',
  icon,
  variant = 'solid',
  resetMs = 1600,
  disabled = false,
  className = '',
}: AsyncButtonProps) {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [announce, setAnnounce] = useState('')
  const resetTimer = useRef<number | null>(null)
  // Guards against a resolve/reject landing after the component has unmounted.
  const alive = useRef(true)

  const shake = useAnimationControls()

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    }
  }, [])

  // The label currently shown — drives both the live content and the mirror.
  const labelFor = (p: Phase): string =>
    p === 'loading' ? loadingLabel ?? label : p === 'success' ? successLabel : p === 'error' ? errorLabel : label
  const shownLabel = labelFor(phase)

  // Width is measured off a hidden mirror carrying the same font + the icon
  // slot, so the button is exactly its content wide in every phase and springs
  // between them rather than snapping or reserving the widest box.
  const mirrorRef = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number>()
  // The icon slot is present in every phase except a resting state with no icon.
  const hasIconSlot = phase !== 'idle' || icon != null
  useLayoutEffect(() => {
    const el = mirrorRef.current
    if (!el) return
    setWidth(Math.ceil(el.getBoundingClientRect().width))
  }, [shownLabel, hasIconSlot])

  const run = useCallback(() => {
    if (phase === 'loading' || phase === 'success' || disabled) return
    if (resetTimer.current) window.clearTimeout(resetTimer.current)
    setPhase('loading')
    setAnnounce(`${loadingLabel ?? label}…`)
    Promise.resolve()
      .then(() => onAction?.())
      .then(() => {
        if (!alive.current) return
        setPhase('success')
        setAnnounce(`${label}: ${successLabel}`)
        resetTimer.current = window.setTimeout(() => {
          if (alive.current) setPhase('idle')
        }, resetMs)
      })
      .catch(() => {
        if (!alive.current) return
        setPhase('error')
        setAnnounce(`${label} failed. ${errorLabel}.`)
        if (!reduce) shake.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.42 } })
        resetTimer.current = window.setTimeout(() => {
          if (alive.current) setPhase('idle')
        }, resetMs)
      })
  }, [phase, disabled, onAction, label, loadingLabel, successLabel, errorLabel, resetMs, reduce, shake])

  // Disabled while the work runs and while a success holds (so it cannot be
  // double-fired); an error re-enables at once so the label can read "Try again".
  const inFlightDisabled = phase === 'loading' || phase === 'success'
  const isDisabled = disabled || inFlightDisabled

  const base =
    'relative inline-flex items-center justify-center overflow-hidden rounded-full px-6 py-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black'
  const look =
    phase === 'error'
      ? 'bg-red-500/15 text-red-200 ring-red-400/50 focus-visible:ring-red-400/60'
      : variant === 'solid'
        ? 'bg-[#DCF87C] text-black ring-[#DCF87C]/50 focus-visible:ring-[#DCF87C]/70 hover:bg-[#DCF87C]/90'
        : 'border border-white/15 bg-white/[0.03] text-white/90 ring-[#DCF87C]/40 hover:border-[#DCF87C]/60 hover:text-white'
  const successTint = phase === 'success' ? (variant === 'solid' ? '' : 'border-[#DCF87C]/60 text-[#DCF87C]') : ''

  return (
    <>
      <motion.button
        type="button"
        onClick={run}
        disabled={isDisabled}
        aria-busy={phase === 'loading' || undefined}
        aria-label={label}
        animate={shake}
        whileTap={reduce || isDisabled ? undefined : { scale: 0.97 }}
        className={`${base} ${look} ${successTint} ${
          isDisabled && phase !== 'success' ? 'cursor-default' : 'cursor-pointer'
        } ${disabled ? 'opacity-50' : ''} ${className}`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* The width spring: the content row sizes to the mirror, so the pill
            grows and shrinks around the current word. */}
        <motion.span
          className="relative flex items-center justify-center"
          animate={{ width }}
          transition={reduce || width == null ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
          style={{ width }}
        >
          <span className="flex items-center justify-center gap-2 whitespace-nowrap px-0.5">
            <PhaseIcon phase={phase} icon={icon} reduce={!!reduce} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={phase}
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
                className="inline-block"
              >
                {shownLabel}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.span>
      </motion.button>

      {/* The hidden mirror the width is measured from — same type + the same
          icon slot as the live row, so a measured width matches the rendered one. */}
      <span
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none invisible fixed left-[-9999px] top-[-9999px] flex items-center gap-2 whitespace-nowrap px-0.5 text-sm font-semibold"
      >
        {hasIconSlot && <span style={{ width: 16, height: 16 }} className="inline-block shrink-0" />}
        <span>{shownLabel}</span>
      </span>

      {/* Running and landed states are polite; a failure is assertive, because a
          silent failure is the one outcome a non-sighted user must never miss. */}
      <span className="sr-only" aria-live="polite">
        {phase === 'loading' || phase === 'success' ? announce : ''}
      </span>
      <span className="sr-only" aria-live="assertive">
        {phase === 'error' ? announce : ''}
      </span>
    </>
  )
}

// The leading glyph for the current phase: a spinner while running, a drawn
// check on success, a drawn X on failure, and the caller's own icon at rest.
function PhaseIcon({ phase, icon, reduce }: { phase: Phase; icon?: ReactNode; reduce: boolean }) {
  if (phase === 'loading') return <Spinner reduce={reduce} />
  if (phase === 'success') return <DrawnCheck reduce={reduce} />
  if (phase === 'error') return <DrawnCross reduce={reduce} />
  if (icon != null)
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
        {icon}
      </span>
    )
  return null
}

function Spinner({ reduce }: { reduce: boolean }) {
  // A ring with a bright arc. It spins while running; reduced motion holds it
  // still (the label and aria-busy carry the "working" message instead).
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { repeat: Infinity, ease: 'linear', duration: 0.8 }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2.6} />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </motion.svg>
  )
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
      />
    </svg>
  )
}

function DrawnCross({ reduce }: { reduce: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <motion.path
        d="M7 7l10 10"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
      />
      <motion.path
        d="M17 7L7 17"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.2, delay: reduce ? 0 : 0.12, ease: 'easeOut' }}
      />
    </svg>
  )
}
