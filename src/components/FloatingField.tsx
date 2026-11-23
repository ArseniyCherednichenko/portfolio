import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type ReactNode,
} from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'

// The one text input the controls family never actually had. It is full of
// pickers that hide their options (Select, Combobox, Wheel), fields that take a
// shaped value (CodeInput's digits, TagInput's chips, NumberField's number),
// and the InlineEdit that turns text into a field only on a click — but never
// the plainest, most-built control on the web: a labelled line of text you type
// into, the thing every sign-up, contact form, and settings screen is made of.
// Products rebuild it constantly, and the lazy version gets three things wrong.
//
//  (1) The label. A placeholder is not a label: it vanishes the moment you
//      start typing, so a half-filled form becomes a grid of anonymous boxes,
//      and screen readers get nothing stable to announce. The floating label
//      fixes both — it rests inside the field like a placeholder when the field
//      is empty and unfocused, then lifts to a small caption above the text the
//      instant you focus or fill it, so the field is always named, on screen and
//      to assistive tech, without stealing a line of vertical space when idle.
//
//  (2) The validation moment. Validating on every keystroke scolds you for an
//      email you have not finished typing; never validating lets a broken value
//      through to submit. So this validates on blur (and on demand), the moment
//      you leave a field having had your say — turning the border and label red,
//      shaking once, naming the problem assertively — and then clears the error
//      live as you fix it, rather than making you blur again to be forgiven.
//
//  (3) The affordances people quietly need. A password you cannot reveal is a
//      typo you cannot catch, so the password variant carries a real show/hide
//      toggle; a field with a limit that only rejects the 101st character is a
//      field that surprised you, so a maxLength shows a live counter that warms
//      amber as you approach the cap. Neither is decoration.
//
// Reduced motion keeps every behaviour and drops only the movement: the label
// snaps between its two positions, the focus underline appears without drawing,
// and the error does not shake — the colour, the message, and the announcement
// carry it instead.

const LIME = '#DCF87C'

export type FloatingFieldType = 'text' | 'email' | 'password' | 'url' | 'tel' | 'search'

export interface FloatingFieldProps {
  /** The visible, floating label and the input's accessible name. */
  label: string
  /** HTML input type. `password` adds a reveal toggle. Ignored when multiline. */
  type?: FloatingFieldType
  /** Render a growing textarea instead of a single-line input. */
  multiline?: boolean
  /** Uncontrolled initial value. */
  defaultValue?: string
  /** A quiet helper line under the field, shown while the field is valid. */
  hint?: ReactNode
  /** Cap the length and show a live counter that warms as it fills. */
  maxLength?: number
  /** Mark the field required (adds the native attribute and an aria hint). */
  required?: boolean
  autoComplete?: string
  /**
   * Validate the current value when the field is left (or on demand). Return a
   * message string to show an error, or `null` when the value is acceptable.
   */
  validate?: (value: string) => string | null
  /** Notified on every edit with the live value. */
  onValueChange?: (value: string) => void
  className?: string
}

export interface FloatingFieldHandle {
  /** Run validation now (e.g. from a form submit). Returns true when valid. */
  check: () => boolean
  value: () => string
}

/**
 * A floating-label text field with on-blur validation.
 *
 * The label rests inside the empty field and lifts to a caption on focus or
 * fill; a lime underline draws in under focus; validation runs on blur, paints
 * the field red with an assertive message, and clears live as you fix it. The
 * password variant reveals, and a `maxLength` shows a warming counter. A real
 * `<label>`/`<input>` pair with `aria-invalid` and `aria-describedby`. Under
 * prefers-reduced-motion the label snaps, the underline appears without
 * drawing, and the error does not shake.
 */
export const FloatingField = forwardRef<FloatingFieldHandle, FloatingFieldProps>(function FloatingField(
  {
    label,
    type = 'text',
    multiline = false,
    defaultValue = '',
    hint,
    maxLength,
    required = false,
    autoComplete,
    validate,
    onValueChange,
    className = '',
  },
  ref,
) {
  const reduce = useReducedMotion()
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`

  const [value, setValue] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only reveal errors once the field has been left at least once, so a pristine
  // form is not pre-scolded, but a corrected field re-validates on every key.
  const [touched, setTouched] = useState(false)
  const [reveal, setReveal] = useState(false)

  const shake = useAnimationControls()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const runValidate = useCallback(
    (next: string): string | null => {
      if (!validate) return null
      return validate(next)
    },
    [validate],
  )

  const floated = focused || value.length > 0
  const hasError = touched && error != null

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value
      setValue(next)
      onValueChange?.(next)
      // Once the user has been told about a problem, forgive it the moment it is
      // gone — re-run validation live while an error is showing.
      if (touched) setError(runValidate(next))
    },
    [onValueChange, runValidate, touched],
  )

  const handleBlur = useCallback(
    (_e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFocused(false)
      setTouched(true)
      const result = runValidate(value)
      setError(result)
      if (result && !reduce) {
        shake.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } })
      }
    },
    [reduce, runValidate, shake, value],
  )

  // Imperative validation for a form submit: mark the field touched, show any
  // error (and shake it), and report whether it passed — so a parent form can
  // gate on every field at once, not only the ones the user happened to blur.
  const check = useCallback((): boolean => {
    setTouched(true)
    const result = runValidate(value)
    setError(result)
    if (result && !reduce) {
      shake.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } })
    }
    return result == null
  }, [reduce, runValidate, shake, value])

  useImperativeHandle(ref, () => ({ check, value: () => value }), [check, value])

  const count = value.length
  const nearCap = maxLength != null && count >= Math.ceil(maxLength * 0.9)
  const atCap = maxLength != null && count >= maxLength
  const showValidTick = touched && !error && value.trim().length > 0 && validate != null

  // Border + label colour resolve from one of three states, in priority order:
  // error, then focus, then rest.
  const accent = hasError ? '#F87171' : floated || focused ? LIME : 'rgba(255,255,255,0.4)'

  const sharedInputProps = {
    id,
    value,
    maxLength,
    required,
    autoComplete,
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? `${errId} ${hintId}` : hintId,
    onChange: handleChange,
    onFocus: () => setFocused(true),
    onBlur: handleBlur,
  }

  const inputType = type === 'password' && reveal ? 'text' : type

  return (
    <div className={`w-full ${className}`}>
      <motion.div animate={shake} className="relative">
        {/* The field frame. Border colour tracks state; a focus ring is added
            for keyboard users via the input's own focus-visible outline below. */}
        <div
          className="relative rounded-xl border bg-white/[0.035] transition-colors"
          style={{
            borderColor: hasError
              ? 'rgba(248,113,113,0.7)'
              : focused
                ? 'rgba(220,248,124,0.6)'
                : 'rgba(255,255,255,0.12)',
          }}
        >
          {multiline ? (
            <textarea
              {...sharedInputProps}
              rows={3}
              className="peer block w-full resize-y rounded-xl bg-transparent px-3.5 pb-2.5 pt-7 text-base text-white outline-none placeholder:text-transparent"
            />
          ) : (
            <input
              {...sharedInputProps}
              ref={inputRef}
              type={inputType}
              className="peer block w-full rounded-xl bg-transparent px-3.5 pb-2.5 pt-7 text-base text-white outline-none placeholder:text-transparent"
              style={{
                // Keep room for the reveal toggle / status glyph on the right.
                paddingRight:
                  type === 'password' ? '3rem' : showValidTick || hasError ? '2.75rem' : undefined,
              }}
            />
          )}

          {/* The floating label. Rests vertically centred over the input's text
              row when idle; lifts to a caption when floated. transformOrigin is
              the left edge so it shrinks in place without drifting right. */}
          <motion.label
            htmlFor={id}
            className="pointer-events-none absolute left-3.5 top-0 origin-left select-none font-medium"
            initial={false}
            animate={{
              y: floated ? 14 : 26,
              scale: floated ? 0.78 : 1,
              color: accent,
            }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
          >
            {label}
            {required && (
              <span aria-hidden className="ml-0.5 opacity-70">
                *
              </span>
            )}
          </motion.label>

          {/* Password reveal — a real toggle button, labelled and pressed-state
              wired, never a bare icon. */}
          {type === 'password' && !multiline && (
            <button
              type="button"
              onClick={() => {
                setReveal((r) => !r)
                inputRef.current?.focus()
              }}
              aria-pressed={reveal}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/40 outline-none transition-colors hover:text-white/80 focus-visible:text-[#DCF87C] focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40"
            >
              <EyeIcon off={reveal} />
            </button>
          )}

          {/* A valid tick / error mark, sitting where no toggle does. */}
          {type !== 'password' && !multiline && (showValidTick || hasError) && (
            <span
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: hasError ? '#F87171' : LIME }}
            >
              {hasError ? <AlertIcon /> : <CheckIcon reduce={!!reduce} />}
            </span>
          )}

          {/* The focus underline — a lime (or red) bar that draws out from the
              centre under focus, tucked just inside the rounded corners. */}
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-3 right-3 h-0.5 origin-center rounded-full"
            style={{ backgroundColor: hasError ? '#F87171' : LIME }}
            initial={false}
            animate={{ scaleX: focused || hasError ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
          />
        </div>
      </motion.div>

      {/* The hint / error / counter row. The hint and error share the line so
          the field never reflows; the counter sits at the right when capped. */}
      <div className="mt-1.5 flex items-start justify-between gap-3 pl-1 pr-1">
        <span
          id={hasError ? errId : hintId}
          className="text-xs leading-snug"
          style={{ color: hasError ? 'rgba(252,165,165,0.95)' : 'rgba(255,255,255,0.4)' }}
        >
          {hasError ? error : hint}
        </span>
        {maxLength != null && (
          <span
            className="shrink-0 text-xs tabular-nums"
            style={{
              color: atCap
                ? '#F87171'
                : nearCap
                  ? '#FBBF24'
                  : 'rgba(255,255,255,0.3)',
            }}
          >
            {count}/{maxLength}
          </span>
        )}
      </div>

      {/* Errors are announced assertively — a value turning invalid is exactly
          the thing a non-sighted user must not have to discover by submitting. */}
      <span className="sr-only" aria-live="assertive">
        {hasError ? `${label}: ${error}` : ''}
      </span>
    </div>
  )
})

/** A ready-made email validator for the common case. */
export function emailValidator(value: string): string | null {
  const v = value.trim()
  if (v === '') return 'Enter an email address'
  // Deliberately loose — enough to catch a fat-fingered address, not to litigate
  // the RFC. A real backend confirms deliverability; the field only catches the
  // obvious slip before a submit wastes a round trip.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'That does not look like an email'
  return null
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth={1.7} />
      {off && (
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      )}
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.8} />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx="12" cy="16.3" r="1.1" fill="currentColor" />
    </svg>
  )
}

function CheckIcon({ reduce }: { reduce: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.32, ease: 'easeOut' }}
      />
    </svg>
  )
}
