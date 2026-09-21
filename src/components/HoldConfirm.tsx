import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

// The controls family kept turning the browser's ugliest defaults and the
// controls the platform never shipped into product-grade work. This is one of
// the latter, and it exists because of a real product problem: some actions —
// delete the account, wipe the draft, publish to everyone — are one twitchy
// click away from a mistake you cannot take back. A plain button fires the
// instant it is pressed; a confirm dialog is a whole extra screen for a single
// yes. The middle path most products never build properly is the hold: press
// and keep pressing, and the action commits only once you have held long
// enough to prove you meant it. Let go early and nothing happens.
//
// The craft is in the two things a lazy version skips. First, the fill is
// driven by a Framer Motion value animated over real elapsed time, not a CSS
// transition, so the same value drives the sweep and rewinds it — release
// before the end and the progress eases back to zero instead of snapping, so a
// cancelled hold reads as a decision reversed rather than a glitch, and it
// picks up from where it got to if you press again. Second, it is a real hold
// on the keyboard too: Space or Enter held down fills, and the keyup cancels —
// with auto-repeat ignored, since a held key fires keydown over and over and a
// naive version would treat that as a fresh press every frame.
//
// Reduced motion gets a genuine alternative, not a broken animation: with no
// continuous fill to watch, the control becomes a deliberate two-tap confirm
// (press once to arm, press again to commit, and it disarms itself if you look
// away), which keeps the whole point — no single accidental fire — with no
// motion at all.

const EASE = [0.16, 1, 0.3, 1] as const

export interface HoldConfirmProps {
  /** Fired once, when a hold completes (or the two-tap confirm commits). */
  onConfirm: () => void
  /** Resting label. */
  label?: string
  /** Label shown while the button is being held down. */
  holdingLabel?: string
  /** Label shown briefly after a successful confirm. */
  confirmedLabel?: string
  /** Reduced-motion path: label shown once armed, awaiting the second press. */
  armedLabel?: string
  /** How long, in ms, the button must be held to commit. Default 1200. */
  duration?: number
  /** Disable all interaction. */
  disabled?: boolean
  /** Optional leading glyph (an inline SVG icon), shown before the label. */
  icon?: ReactNode
  /** Accessible name, when the visible label is not enough on its own. */
  ariaLabel?: string
  className?: string
}

type Phase = 'idle' | 'holding' | 'armed' | 'confirmed'

/**
 * A press-and-hold-to-confirm button for consequential, one-way actions.
 *
 * Hold to fill; release early to cancel (the fill rewinds). A real `<button>`,
 * driven the same by pointer and by a held Space/Enter, with a polite live
 * region announcing the outcome. Under prefers-reduced-motion it becomes a
 * two-tap confirm instead of an animated hold, so the intent survives with no
 * continuous motion.
 */
export function HoldConfirm({
  onConfirm,
  label = 'Hold to confirm',
  holdingLabel = 'Keep holding',
  confirmedLabel = 'Confirmed',
  armedLabel = 'Press again to confirm',
  duration = 1200,
  disabled = false,
  icon,
  ariaLabel,
  className = '',
}: HoldConfirmProps) {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')

  // The single source of truth for the fill, 0 → 1, driving the sweep width so
  // the visual can never disagree with the timer.
  const progress = useMotionValue(0)
  const fillPct = useTransform(progress, (v) => `${Math.max(0, Math.min(1, v)) * 100}%`)

  // Framer's own animation handle, so a release can stop the fill and rewind it.
  const playRef = useRef<ReturnType<typeof animate> | null>(null)
  // Guards a double-commit if pointerup and onComplete race.
  const committedRef = useRef(false)
  // Timers for the confirmed-state reset and the reduced-motion disarm.
  const resetRef = useRef<number | null>(null)
  const disarmRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (resetRef.current) window.clearTimeout(resetRef.current)
    if (disarmRef.current) window.clearTimeout(disarmRef.current)
    resetRef.current = null
    disarmRef.current = null
  }, [])

  useEffect(
    () => () => {
      playRef.current?.stop()
      clearTimers()
    },
    [clearTimers],
  )

  const commit = useCallback(() => {
    if (committedRef.current) return
    committedRef.current = true
    playRef.current?.stop()
    progress.set(1)
    setPhase('confirmed')
    onConfirm()
    // Return to rest after the confirmed state has been felt.
    resetRef.current = window.setTimeout(() => {
      committedRef.current = false
      progress.set(0)
      setPhase('idle')
    }, 1100)
  }, [onConfirm, progress])

  // Cancel an in-progress hold: rewind the fill and go back to rest.
  const cancelHold = useCallback(() => {
    if (committedRef.current) return
    playRef.current?.stop()
    setPhase('idle')
    const from = progress.get()
    if (from <= 0) return
    // Rewind proportionally to how far it got, so a near-complete cancel takes
    // a beat longer than a barely-started one — it reads as unwinding, not a cut.
    playRef.current = animate(progress, 0, { duration: 0.28 * from + 0.04, ease: EASE })
  }, [progress])

  // Begin a hold (pointer down, or Space/Enter pressed). Resumes from wherever
  // a prior cancel left the fill, so a second press does not start over.
  const startHold = useCallback(() => {
    if (disabled || committedRef.current || phase === 'confirmed') return
    clearTimers()
    playRef.current?.stop()
    setPhase('holding')
    const remaining = duration * (1 - progress.get())
    playRef.current = animate(progress, 1, {
      duration: Math.max(0.12, remaining / 1000),
      ease: 'linear',
      onComplete: commit,
    })
  }, [clearTimers, commit, disabled, duration, phase, progress])

  // The reduced-motion, two-tap path: first press arms, second commits, and it
  // disarms itself after a short window so a stray arm never lingers.
  const tapConfirm = useCallback(() => {
    if (disabled || phase === 'confirmed') return
    clearTimers()
    if (phase === 'armed') {
      commit()
      return
    }
    setPhase('armed')
    disarmRef.current = window.setTimeout(() => setPhase('idle'), 3000)
  }, [clearTimers, commit, disabled, phase])

  // Pointer handlers — hold path only. The reduced-motion path fires on click.
  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (reduce || e.button !== 0) return
    e.preventDefault()
    startHold()
  }
  function endPointer() {
    if (reduce) return
    cancelHold()
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return
    // A held key auto-repeats keydown; treat only the first as the press so the
    // hold is not restarted every frame.
    if (e.repeat) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    if (reduce) {
      tapConfirm()
    } else {
      startHold()
    }
  }
  function onKeyUp(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (reduce) return
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') cancelHold()
  }

  const held = phase === 'holding'
  const done = phase === 'confirmed'
  const armed = phase === 'armed'
  const text = done ? confirmedLabel : armed ? armedLabel : held ? holdingLabel : label
  // The live announcement only speaks the resolved outcome, not every frame.
  const announce = done ? confirmedLabel : armed ? armedLabel : ''

  return (
    <div className={`inline-flex flex-col items-start gap-2 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={endPointer}
        onPointerLeave={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        // Stop a hold from turning into a native context menu / callout on
        // touch — it is a press, not a long-press-to-select.
        onContextMenu={(e) => !reduce && e.preventDefault()}
        className={`relative isolate inline-flex select-none touch-none items-center justify-center gap-2 overflow-hidden rounded-full border px-7 py-3.5 text-sm font-semibold outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          disabled
            ? 'cursor-not-allowed border-white/10 text-white/30'
            : done
              ? 'border-[#DCF87C] text-black'
              : armed
                ? 'border-[#DCF87C]/70 text-white'
                : 'cursor-pointer border-white/15 text-white/85 hover:border-[#DCF87C]/40 hover:text-white'
        }`}
      >
        {/* The fill sweep — a lime layer whose width tracks the hold, behind the
            label. On commit it is full; on cancel it rewinds. Pointer-inert. */}
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 -z-10 bg-[#DCF87C]"
          style={{ width: fillPct }}
        />
        {/* A confirmed flash over the fill so the committed state reads as a
            solid lime pill, not a bar that merely reached the far end. */}
        <motion.span
          aria-hidden
          className="absolute inset-0 -z-10 bg-[#DCF87C]"
          initial={false}
          animate={{ opacity: done ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        />
        {done ? <CheckIcon /> : icon}
        <span>{text}</span>
      </button>

      {/* A calm, honest hint of what the control wants, so the interaction is
          never a guessing game — and in the reduced-motion path it names the
          two-tap contract instead of a hold. */}
      <span aria-hidden className="pl-1 text-xs text-white/35">
        {done
          ? ' '
          : reduce
            ? armed
              ? 'Press again to confirm, or look away to cancel'
              : 'Two presses to confirm'
            : held
              ? 'Release to cancel'
              : 'Press and hold'}
      </span>

      {/* Polite live region — speaks the outcome, not the progress. */}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}

// A check mark that draws itself in on commit (a plain path under reduced
// motion, since the confirmed state appears instantly there anyway).
function CheckIcon() {
  const reduce = useReducedMotion()
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="text-black">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
      />
    </svg>
  )
}
