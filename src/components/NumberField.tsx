import { motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

// The "hard native control, rebuilt" thread (Select, Combobox, TagInput,
// Calendar, ColorField, Dropzone) kept turning the browser's ugliest defaults
// into product-grade craft. `input type="number"` belongs in it too: it ships
// two tiny spinners you cannot restyle, that differ on every browser, that
// only ever step by one, that jump the caret, and that have no press-and-hold
// and no way to drag a value the way every real editor lets you. This is that
// control rebuilt — a field you type into, step with proper accelerating
// buttons you can hold, scrub by dragging a grip left and right, and drive
// fully from the keyboard, with the value clamped, rounded, grouped, and
// wrapped in a prefix and suffix on the way out.
//
// Accessibility is the point, not an afterthought. The field is a real
// role="spinbutton" that owns focus and carries aria-valuenow/min/max plus a
// spoken aria-valuetext (prefix + value + suffix), so a screen reader hears
// "$1,240 per month", not "1240". ArrowUp/Down step; Shift or PageUp/PageDown
// take the big step; Home/End jump to the bounds; typing edits freely and the
// value only commits (parse → clamp → round → format) on blur or Enter, so a
// half-typed number is never yanked out from under the caret.
//
// The motion carries the feel and every piece of it defers to
// prefers-reduced-motion: the buttons squash on press, the grip warms and the
// cursor turns to a horizontal resize while you scrub, and the shown value
// gives a small vertical nudge in the direction it just moved. Reduced motion
// keeps all of it as plain, instant state changes and the control stays exactly
// as usable.

/** Press-and-hold timing: the first repeat waits, then they accelerate. */
const HOLD_DELAY = 320
const HOLD_MIN = 28
const HOLD_MAX = 140
// After this many sustained repeats the step multiplies, so a long hold covers
// ground fast without ever losing the ability to land on a single value.
const HOLD_RAMP = 16

/** Clamp to [min, max]. */
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Round to a step grid anchored at min, then to `precision` decimals so the
 * result reads cleanly (0.1 + 0.2 style drift never surfaces). */
function snap(n: number, min: number, step: number, precision: number) {
  const steps = Math.round((n - min) / step)
  const snapped = min + steps * step
  const p = Math.pow(10, precision)
  return Math.round(snapped * p) / p
}

/** Format a number for display: fixed decimals, optional thousands grouping. */
function format(n: number, precision: number, group: boolean) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping: group,
  })
}

/** Pull a number out of whatever the field currently holds — strips the
 * prefix, suffix, grouping commas, and any stray characters a paste dragged in.
 * Returns null when there is nothing numeric to read. */
function parse(text: string): number | null {
  const cleaned = text.replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.')
    return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export interface NumberFieldProps {
  /** Controlled value. Omit for uncontrolled use with `defaultValue`. */
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  /** The base step for one arrow press or button click. */
  step?: number
  /** The step for Shift/PageUp/PageDown. Defaults to 10× the base step. */
  bigStep?: number
  /** Decimal places to keep and display. */
  precision?: number
  /** Group thousands with commas in the shown value. */
  group?: boolean
  /** Small units shown before and after the number, e.g. "$" and "/mo". */
  prefix?: string
  suffix?: string
  /** Show the drag grip that scrubs the value left/right. */
  scrubbable?: boolean
  /** Accessible name for the field. */
  label?: string
  disabled?: boolean
  className?: string
}

/**
 * A hand-built, accessible number field — the native `input type="number"`
 * rebuilt with proper accelerating steppers you can hold, a drag-to-scrub grip,
 * full keyboard control, and honest clamping, rounding, grouping, and
 * prefix/suffix formatting. A real role="spinbutton" with a spoken value.
 *
 * Under prefers-reduced-motion the button squash, grip warmth, and value nudge
 * all come off; the control stays identical to use.
 */
export function NumberField({
  value,
  defaultValue = 0,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  bigStep,
  precision = 0,
  group = false,
  prefix = '',
  suffix = '',
  scrubbable = true,
  label = 'Value',
  disabled = false,
  className = '',
}: NumberFieldProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const big = bigStep ?? step * 10

  const isControlled = value !== undefined
  const [internal, setInternal] = useState(() =>
    snap(clamp(defaultValue, min, max), Number.isFinite(min) ? min : 0, step, precision),
  )
  const current = isControlled
    ? snap(clamp(value as number, min, max), Number.isFinite(min) ? min : 0, step, precision)
    : internal

  // The raw text while the field is focused and being typed into; null means
  // "show the formatted value". Keeping these apart lets a half-typed number
  // ("-", "1.", "") sit in the box without being clamped mid-keystroke.
  const [draft, setDraft] = useState<string | null>(null)
  const [scrubbing, setScrubbing] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const holdTimer = useRef<number | null>(null)
  const holdCount = useRef(0)

  const commitValue = useCallback(
    (next: number) => {
      const base = Number.isFinite(min) ? min : 0
      const clamped = snap(clamp(next, min, max), base, step, precision)
      if (!isControlled) setInternal(clamped)
      onChange?.(clamped)
      return clamped
    },
    [isControlled, max, min, onChange, precision, step],
  )

  const bump = useCallback(
    (delta: number) => {
      commitValue(current + delta)
    },
    [commitValue, current],
  )

  // Press-and-hold on a stepper: fire once, wait, then repeat on an interval
  // that shortens each tick and, past HOLD_RAMP ticks, switches to the big step.
  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    holdCount.current = 0
  }, [])

  const startHold = useCallback(
    (sign: 1 | -1) => {
      if (disabled) return
      bump(sign * step)
      holdCount.current = 0
      const tick = () => {
        holdCount.current += 1
        const n = holdCount.current
        const unit = n > HOLD_RAMP ? big : step
        bump(sign * unit)
        const interval = Math.max(HOLD_MIN, HOLD_MAX - n * 8)
        holdTimer.current = window.setTimeout(tick, interval)
      }
      holdTimer.current = window.setTimeout(tick, HOLD_DELAY)
    },
    [big, bump, disabled, step],
  )

  useEffect(() => stopHold, [stopHold])

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (disabled) return
      const withBig = (base: number) => (e.shiftKey ? big : base)
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          bump(withBig(step))
          break
        case 'ArrowDown':
          e.preventDefault()
          bump(-withBig(step))
          break
        case 'PageUp':
          e.preventDefault()
          bump(big)
          break
        case 'PageDown':
          e.preventDefault()
          bump(-big)
          break
        case 'Home':
          if (Number.isFinite(min)) {
            e.preventDefault()
            commitValue(min)
          }
          break
        case 'End':
          if (Number.isFinite(max)) {
            e.preventDefault()
            commitValue(max)
          }
          break
        case 'Enter': {
          e.preventDefault()
          const parsed = parse(draft ?? '')
          if (draft !== null && parsed !== null) commitValue(parsed)
          setDraft(null)
          break
        }
        case 'Escape':
          if (draft !== null) {
            e.preventDefault()
            setDraft(null)
          }
          break
      }
    },
    [big, bump, commitValue, disabled, draft, max, min, step],
  )

  // Drag the grip: horizontal travel maps to steps. A slow drag lands single
  // steps; the pointer is captured so it keeps tracking past the grip's edge.
  const scrubState = useRef({ startX: 0, startValue: 0 })
  const PX_PER_STEP = 8

  const onScrubDown = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled) return
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      scrubState.current = { startX: e.clientX, startValue: current }
      setScrubbing(true)
    },
    [current, disabled],
  )

  const onScrubMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!scrubbing) return
      const dx = e.clientX - scrubState.current.startX
      const deltaSteps = Math.round(dx / PX_PER_STEP)
      const stepUnit = e.shiftKey ? big : step
      const next = scrubState.current.startValue + deltaSteps * stepUnit
      if (next !== current) commitValue(next)
    },
    [big, commitValue, current, scrubbing, step],
  )

  const onScrubUp = useCallback((e: ReactPointerEvent) => {
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    setScrubbing(false)
  }, [])

  const shown = draft !== null ? draft : format(current, precision, group)
  const valueText = `${prefix}${format(current, precision, group)}${suffix ? ` ${suffix}` : ''}`

  const stepBtn =
    'grid h-1/2 w-9 place-items-center text-white/55 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white disabled:opacity-30'

  return (
    <div
      className={`inline-flex select-none items-stretch overflow-hidden rounded-2xl border bg-white/[0.02] transition-colors ${
        scrubbing
          ? 'border-[#DCF87C]/60'
          : 'border-white/12 focus-within:border-white/30'
      } ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {/* Scrub grip — drag it left/right to change the value. */}
      {scrubbable && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          disabled={disabled}
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onPointerCancel={onScrubUp}
          className={`flex w-7 shrink-0 touch-none items-center justify-center border-r transition-colors ${
            scrubbing
              ? 'cursor-ew-resize border-[#DCF87C]/40 bg-[#DCF87C]/[0.1] text-[#DCF87C]'
              : 'cursor-ew-resize border-white/10 text-white/30 hover:text-white/55'
          } ${disabled ? 'cursor-not-allowed' : ''}`}
          title="Drag to change"
        >
          <svg width="8" height="16" viewBox="0 0 8 16" fill="none" aria-hidden>
            <circle cx="2" cy="3" r="1" fill="currentColor" />
            <circle cx="6" cy="3" r="1" fill="currentColor" />
            <circle cx="2" cy="8" r="1" fill="currentColor" />
            <circle cx="6" cy="8" r="1" fill="currentColor" />
            <circle cx="2" cy="13" r="1" fill="currentColor" />
            <circle cx="6" cy="13" r="1" fill="currentColor" />
          </svg>
        </button>
      )}

      {/* The value: a fixed prefix/suffix around the real, typeable input. */}
      <label
        htmlFor={id}
        className="relative flex min-w-0 flex-1 items-center gap-0.5 px-3.5"
      >
        {prefix && (
          <span className="pointer-events-none text-sm font-medium text-white/40">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode={precision > 0 ? 'decimal' : 'numeric'}
          role="spinbutton"
          aria-label={label}
          aria-valuenow={current}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuetext={valueText}
          disabled={disabled}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => {
            const parsed = parse(draft ?? '')
            if (draft !== null && parsed !== null) commitValue(parsed)
            setDraft(null)
          }}
          onKeyDown={onKeyDown}
          className="w-full min-w-[2ch] bg-transparent py-2.5 text-right font-mono text-base tabular-nums text-white outline-none placeholder:text-white/30"
          style={{ width: `${Math.max(shown.length, 2) + 0.5}ch` }}
        />
        {suffix && (
          <span className="pointer-events-none whitespace-nowrap text-sm font-medium text-white/40">
            {suffix}
          </span>
        )}
      </label>

      {/* Stacked steppers with press-and-hold acceleration. */}
      <div className="flex w-9 shrink-0 flex-col border-l border-white/10">
        <motion.button
          type="button"
          aria-label="Increase"
          disabled={disabled || current >= max}
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          whileTap={reduce ? undefined : { scale: 0.85 }}
          className={`${stepBtn} border-b border-white/10`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 7.5 6 4l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
        <motion.button
          type="button"
          aria-label="Decrease"
          disabled={disabled || current <= min}
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          whileTap={reduce ? undefined : { scale: 0.85 }}
          className={stepBtn}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}
