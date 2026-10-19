import { useEffect, useId, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// The plain checkbox — the one form control the library did not have. The
// family had every picker that chooses *between* options (SegmentedControl is
// a radiogroup, Select and Combobox open a list, the Wheel barrels through
// one), but nothing for the other, more common question: a set of independent
// yes/no choices, each on or off on its own. HTML ships `<input type=checkbox>`
// for exactly this, and it carries two things people forget when they reach
// for a styled <div>:
//
//  (1) The third state. A checkbox is not binary — it is tri-state. A parent
//      that governs a list of children is neither checked nor unchecked when
//      only *some* of them are on; it is *indeterminate* (aria "mixed"), the
//      dash every "select all" row shows. The native element models this with
//      a property you can only set from script (`el.indeterminate`), so a
//      hand-rolled checkbox almost always drops it. This keeps it.
//
//  (2) The keyboard and the label. Space toggles, the control takes a tab
//      stop, and a click anywhere on the label toggles it — all free from a
//      real <input>, all broken the moment you fake it with a bare <div>.
//
// So this does not reinvent the control; it keeps the real native input,
// visually hidden but fully focusable and operable, and draws the box beside
// it as the input's peer — the input stays the source of truth for state,
// focus, keyboard, and assistive tech, and the box is pure paint. The mark
// draws itself in (a check for on, a dash for mixed) and the lime fill springs
// up behind it. Under reduced motion the fill snaps and the mark appears
// already drawn; the control is identical to use.

export interface CheckboxProps {
  /** On/off. Controlled — pair it with onChange. */
  checked: boolean
  /**
   * The "mixed" third state, for a parent that governs a partly-checked list.
   * Visual + assistive only (the native `indeterminate` property); the next
   * toggle still reports a concrete boolean through onChange.
   */
  indeterminate?: boolean
  /** Called with the input's next checked value on toggle. */
  onChange?: (checked: boolean) => void
  /** The visible, clickable label. Omit for a bare box (give aria-label then). */
  label?: ReactNode
  /** A quieter second line under the label. */
  description?: ReactNode
  disabled?: boolean
  /** Accessible name when there is no visible label. */
  'aria-label'?: string
  name?: string
  value?: string
  className?: string
}

/**
 * A tri-state checkbox built on a real, visually-hidden native input: on, off,
 * or indeterminate ("mixed"), with a drawn mark and a springing lime fill.
 * Keyboard, focus, and assistive-tech behaviour come from the input itself.
 * Reduced-motion aware.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  description,
  disabled = false,
  'aria-label': ariaLabel,
  name,
  value,
  className = '',
}: CheckboxProps) {
  const reduce = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const descId = `${id}-desc`

  // `indeterminate` is a DOM property, not an attribute — it can only be set
  // from script, so it is wired through a ref on every change. Setting it also
  // exposes aria "mixed" to assistive tech for free.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])

  const active = checked || indeterminate

  return (
    <label
      htmlFor={id}
      className={`group inline-flex items-start gap-3 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${className}`}
    >
      <span className="relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          ref={inputRef}
          id={id}
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={description ? descId : undefined}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-[inherit] opacity-0"
        />
        {/* The box — the input's peer, so it reads the input's real focus and
            hover state without JS. Border eases to lime when active. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 rounded-[6px] border transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[#DCF87C]/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black ${
            active ? 'border-[#DCF87C]' : 'border-white/25 group-hover:border-white/45'
          }`}
        />
        {/* The lime fill springs up from the centre when the box turns on. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[6px] bg-[#DCF87C]"
          initial={false}
          animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 640, damping: 34 }}
          style={{ transformOrigin: 'center' }}
        />
        {/* The mark, drawn in black on the lime. A check for on; a dash for the
            mixed state. pathLength animates the stroke in. */}
        <svg
          aria-hidden
          viewBox="0 0 18 18"
          width="18"
          height="18"
          fill="none"
          className="pointer-events-none relative"
        >
          {indeterminate && !checked ? (
            <motion.path
              key="dash"
              d="M4.5 9h9"
              stroke="#0a0a0a"
              strokeWidth={2.25}
              strokeLinecap="round"
              initial={reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
            />
          ) : checked ? (
            <motion.path
              key="check"
              d="M4 9.5l3.2 3.2L14 5.5"
              stroke="#0a0a0a"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduce ? 0 : 0.26, ease: 'easeOut', delay: reduce ? 0 : 0.04 }}
            />
          ) : null}
        </svg>
      </span>

      {(label || description) && (
        <span className="flex min-w-0 flex-col">
          {label && <span className="text-sm leading-snug text-white/85">{label}</span>}
          {description && (
            <span id={descId} className="mt-0.5 text-xs leading-snug text-white/45">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  )
}
