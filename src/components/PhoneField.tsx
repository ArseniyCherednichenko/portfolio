import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// The phone field the controls family never had, and the honest sibling to the
// CurrencyField beside it. The money input taught the one lesson a phone input
// needs — a field that groups its value as you type has to keep the caret under
// your edit or it is unusable for fixing a wrong digit — so this reuses exactly
// that discipline on a different value.
//
//  Two things a lazy phone input gets wrong.
//
//  The caret. A phone number is grouped for legibility — (030) 123-4567, not a
//  run you have to count — and the instant the field reinserts a bracket or a
//  dash, a naive controlled input throws the cursor to the end. Type a digit
//  into the middle to fix it and the caret leaps away. So this reformats on
//  every keystroke AND restores the caret to the same logical place: it counts
//  the digits to the left of where you were, then walks the freshly grouped
//  string to the position after that many of them, so the cursor stays put
//  under your edit while the separators rearrange around it. Only digits carry
//  meaning here, so the count is simpler than the money field's — but the trick
//  is the same one, and it is the whole reason the field is worth building.
//
//  The honesty about what it does and does not know. Real numbering plans are a
//  tangle, and a field that silently claims to validate every one of them is
//  lying. So this is honest: it formats using each country's common readable
//  grouping and reports the digits exactly as typed in E.164 form (a leading +,
//  the country's dial code, then the national digits), which is the one shape
//  every backend and SMS gateway actually wants. The only check it makes is a
//  soft length one — has the number reached the digit count its country's
//  format expects — surfaced as a quiet "looks complete" cue, never a hard
//  gate, because a field has no business rejecting a number it cannot be sure
//  is wrong. What it shows is always a formatting of the digits it holds, and
//  what it reports is always those same digits, so the two can never drift.
//
// The country is a real control of its own: a button that opens an accessible
// listbox of countries (dial code shown, no flag emoji — the ISO letters carry
// it), arrow-key navigable, Escape to close, focus returned to the button on
// pick. Changing country re-groups the digits already typed under the new
// country's format and re-reports the E.164 with the new dial code.
//
// Reduced motion keeps every behaviour and drops only the movement: the focus
// underline appears without drawing and the country list opens without its
// spring — the field is exactly as operable, only still.

const LIME = '#DCF87C'

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 code, e.g. 'DE'. Shown as the badge, no flag emoji. */
  iso: string
  /** The country's name, for the listbox and the accessible label. */
  name: string
  /** International dialling code with its plus, e.g. '+49'. */
  dial: string
  /** Readable national grouping: '#' marks a digit slot, everything else is a
   *  literal separator shown only between typed digits. The count of '#' is the
   *  number of national digits this country's common format expects. */
  template: string
}

// A small, honest set — the countries this field is sure how to group, Germany
// first because that is where the work is made. The groupings are each a common
// way the national number is written; real plans vary, which the field is
// honest about (the length check is soft, never a hard reject). No flag emoji,
// per the site's no-emoji rule: the ISO letters and the dial code carry it.
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: 'DE', name: 'Germany', dial: '+49', template: '### ### ####' },
  { iso: 'US', name: 'United States', dial: '+1', template: '(###) ###-####' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44', template: '#### ######' },
  { iso: 'FR', name: 'France', dial: '+33', template: '# ## ## ## ##' },
  { iso: 'ES', name: 'Spain', dial: '+34', template: '### ## ## ##' },
] as const

export interface PhoneValue {
  /** E.164: a '+', the dial code, then the national digits. '' when empty. */
  e164: string
  /** The national digits only, no separators. */
  national: string
  /** The selected country's ISO code. */
  country: string
  /** True once the national digit count matches the country's expected length. */
  complete: boolean
}

export interface PhoneFieldProps {
  /** The visible label and the input's accessible name. */
  label: string
  /** ISO code of the country selected initially. Defaults to the first. */
  defaultCountry?: string
  /** National digits selected initially (digits only; separators are ignored). */
  defaultValue?: string
  /** A quiet helper line under the field. */
  hint?: ReactNode
  /** Notified whenever the number or country changes. */
  onChange?: (value: PhoneValue) => void
  className?: string
}

export interface PhoneFieldHandle {
  /** The current value, as the onChange payload. */
  value: () => PhoneValue
}

/** The number of digit slots a template defines — the national length it expects. */
function slotCount(template: string): number {
  let n = 0
  for (const ch of template) if (ch === '#') n++
  return n
}

/** Lay the digits into the template, showing a literal separator only when more
 *  digits remain to place — so a leading '(' or a trailing '-' never appears
 *  stranded ahead of the digits it belongs between. */
function applyTemplate(digits: string, template: string): string {
  let out = ''
  let di = 0
  for (let i = 0; i < template.length; i++) {
    const ch = template[i]
    if (ch === '#') {
      if (di < digits.length) out += digits[di++]
      else break
    } else if (di < digits.length) {
      out += ch
    } else {
      break
    }
  }
  return out
}

/** Count the digits in a string — all that carries meaning in a phone number. */
function countDigits(s: string): number {
  let n = 0
  for (const ch of s) if (ch >= '0' && ch <= '9') n++
  return n
}

/** Walk the grouped display to the index just past its Nth digit — the caret
 *  restore that keeps the cursor under the edit while separators rearrange. */
function caretForDigits(display: string, n: number): number {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    if (display[i] >= '0' && display[i] <= '9') {
      seen++
      if (seen === n) return i + 1
    }
  }
  return display.length
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 6"
      className="h-1.5 w-2.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  )
}

/**
 * An international phone input with country-aware format-as-you-type and a caret
 * that stays under the edit. Shows the number grouped the way its country is
 * commonly written and reports it through onChange in E.164 (a '+', the dial
 * code, the national digits). The only check is a soft length one, surfaced as
 * a quiet cue, never a hard gate. Under prefers-reduced-motion the focus
 * underline appears without drawing and the country list opens without a spring.
 */
export const PhoneField = forwardRef<PhoneFieldHandle, PhoneFieldProps>(function PhoneField(
  { label, defaultCountry, defaultValue = '', hint, onChange, className = '' },
  ref,
) {
  const reduce = useReducedMotion()
  const id = useId()
  const hintId = `${id}-hint`
  const listId = `${id}-countries`

  const initialCountry = useMemo(() => {
    const found = PHONE_COUNTRIES.find((c) => c.iso === defaultCountry)
    return found ?? PHONE_COUNTRIES[0]
  }, [defaultCountry])

  const [country, setCountry] = useState<PhoneCountry>(initialCountry)
  const slots = slotCount(country.template)
  const [digits, setDigits] = useState(() => defaultValue.replace(/\D/g, '').slice(0, slots))
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  // React resets a controlled input's caret to the end on re-render, so the
  // desired index is stashed here and reapplied in a layout effect before paint.
  const caretRef = useRef<number | null>(null)

  const display = applyTemplate(digits, country.template)
  const complete = digits.length === slots
  const national = digits

  const toValue = useCallback(
    (nat: string, c: PhoneCountry): PhoneValue => ({
      e164: nat === '' ? '' : `${c.dial}${nat}`,
      national: nat,
      country: c.iso,
      complete: nat.length === slotCount(c.template),
    }),
    [],
  )

  // Restore the caret after the controlled value repaints.
  useLayoutEffect(() => {
    if (caretRef.current != null && inputRef.current) {
      const pos = caretRef.current
      caretRef.current = null
      try {
        inputRef.current.setSelectionRange(pos, pos)
      } catch {
        // some input types reject setSelectionRange — harmless here
      }
    }
  })

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const caret = e.target.selectionStart ?? raw.length
      const digitsBeforeCaret = countDigits(raw.slice(0, caret))
      const next = raw.replace(/\D/g, '').slice(0, slots)
      const nextDisplay = applyTemplate(next, country.template)
      caretRef.current = caretForDigits(nextDisplay, digitsBeforeCaret)
      setDigits(next)
      onChange?.(toValue(next, country))
    },
    [country, onChange, slots, toValue],
  )

  const pickCountry = useCallback(
    (c: PhoneCountry) => {
      // Keep the digits already typed, re-grouped under the new country's format
      // (truncated if the new country expects fewer). The caret goes to the end,
      // since the whole grouping may have shifted.
      const trimmed = digits.slice(0, slotCount(c.template))
      caretRef.current = null
      setCountry(c)
      setDigits(trimmed)
      setOpen(false)
      onChange?.(toValue(trimmed, c))
      // Return focus to the trigger, the accessible place to land after a pick.
      requestAnimationFrame(() => btnRef.current?.focus())
    },
    [digits, onChange, toValue],
  )

  // Open the list positioned on the current country, focus moved onto it.
  const openList = useCallback(() => {
    const idx = PHONE_COUNTRIES.findIndex((c) => c.iso === country.iso)
    setActiveIndex(idx === -1 ? 0 : idx)
    setOpen(true)
  }, [country.iso])

  useEffect(() => {
    if (open) {
      // Move focus onto the active option once the list has painted.
      const raf = requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus())
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // Only when `open` flips — re-focusing on every activeIndex change would
    // fight the roving focus the list manages itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close the list on a pointer down outside it (and its trigger).
  useEffect(() => {
    if (!open) return undefined
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const moveActive = useCallback((delta: number) => {
    setActiveIndex((i) => {
      const n = PHONE_COUNTRIES.length
      const next = (i + delta + n) % n
      optionRefs.current[next]?.focus()
      return next
    })
  }, [])

  const handleListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveActive(1)
          break
        case 'ArrowUp':
          e.preventDefault()
          moveActive(-1)
          break
        case 'Home':
          e.preventDefault()
          setActiveIndex(0)
          optionRefs.current[0]?.focus()
          break
        case 'End': {
          e.preventDefault()
          const last = PHONE_COUNTRIES.length - 1
          setActiveIndex(last)
          optionRefs.current[last]?.focus()
          break
        }
        case 'Enter':
        case ' ':
          e.preventDefault()
          pickCountry(PHONE_COUNTRIES[activeIndex])
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          btnRef.current?.focus()
          break
        case 'Tab':
          // Leaving the list with Tab closes it rather than tabbing through 5
          // hidden options — the expected disclosure behaviour.
          setOpen(false)
          break
        default:
          break
      }
    },
    [activeIndex, moveActive, pickCountry],
  )

  useImperativeHandle(ref, () => ({ value: () => toValue(national, country) }), [country, national, toValue])

  const spoken = complete
    ? `${label}: ${country.name} ${country.dial} ${display}`
    : ''

  const accent = focused ? LIME : 'rgba(255,255,255,0.4)'

  return (
    <div className={`w-full ${className}`}>
      <label htmlFor={id} className="mb-1.5 block pl-1 text-sm font-medium" style={{ color: accent }}>
        {label}
      </label>

      <div
        className="relative flex items-stretch rounded-xl border bg-white/[0.035] transition-colors"
        style={{
          borderColor: focused ? 'rgba(220,248,124,0.6)' : 'rgba(255,255,255,0.12)',
        }}
      >
        {/* COUNTRY SELECTOR — a real disclosure button opening an accessible
            listbox. The ISO letters and dial code carry the identity; no flag. */}
        <button
          ref={btnRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openList())}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`Country: ${country.name}, ${country.dial}. Change.`}
          className="flex shrink-0 items-center gap-1.5 rounded-l-xl border-r border-white/10 px-3 text-sm text-white/80 outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#DCF87C]/60"
        >
          <span className="font-semibold tracking-wide tabular-nums">{country.iso}</span>
          <span className="text-white/45 tabular-nums">{country.dial}</span>
          <span className="text-white/35" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
            <ChevronIcon />
          </span>
        </button>

        <input
          id={id}
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={display}
          placeholder={country.template.replace(/#/g, '0')}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-describedby={hintId}
          className="peer block w-full bg-transparent px-3.5 py-3 text-base tabular-nums text-white outline-none placeholder:text-white/25"
        />

        {/* A small "looks complete" cue at the trailing edge — a soft length
            check, never a gate. A drawn tick when the digit count is reached. */}
        <AnimatePresence initial={false}>
          {complete && (
            <motion.span
              key="done"
              aria-hidden
              className="flex shrink-0 items-center pr-3.5 text-[#DCF87C]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5l3.2 3.2L13 5" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>

        {/* The focus underline — a lime bar that draws out from the centre,
            matching the FloatingField and CurrencyField affordance. */}
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-3 right-3 h-0.5 origin-center rounded-full"
          style={{ backgroundColor: LIME }}
          initial={false}
          animate={{ scaleX: focused ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
        />

        {/* THE LISTBOX */}
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popRef}
              id={listId}
              role="listbox"
              aria-label="Choose a country"
              aria-activedescendant={`${id}-opt-${activeIndex}`}
              onKeyDown={handleListKeyDown}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 34 }}
              className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 origin-top overflow-hidden rounded-xl border border-white/12 bg-[#121212] p-1.5 shadow-2xl shadow-black/60"
            >
              {PHONE_COUNTRIES.map((c, i) => {
                const selected = c.iso === country.iso
                const active = i === activeIndex
                return (
                  <button
                    key={c.iso}
                    ref={(el) => {
                      optionRefs.current[i] = el
                    }}
                    id={`${id}-opt-${i}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={active ? 0 : -1}
                    onClick={() => pickCountry(c)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors ${
                      active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="w-7 shrink-0 font-semibold tracking-wide tabular-nums text-white/85">
                      {c.iso}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-white/70">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-white/40">{c.dial}</span>
                    {selected && (
                      <span aria-hidden className="shrink-0 text-[#DCF87C]">
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8.5l3.2 3.2L13 5" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-3 pl-1 pr-1">
        <span id={hintId} className="text-xs leading-snug text-white/40">
          {hint}
        </span>
        {digits.length > 0 && (
          <span
            className="shrink-0 text-xs tabular-nums"
            style={{ color: complete ? 'rgba(220,248,124,0.85)' : 'rgba(255,255,255,0.35)' }}
          >
            {complete ? 'Looks complete' : `${digits.length}/${slots}`}
          </span>
        )}
      </div>

      {/* The complete number, announced politely when it is reached — a
          non-sighted user hears the real number the grouping was for. */}
      <span className="sr-only" aria-live="polite">
        {!focused && spoken ? spoken : ''}
      </span>
    </div>
  )
})
