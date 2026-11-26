import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// The bank-transfer field the checkout family never had, and the European
// sibling to the card field beside it — where a card ends an online checkout, an
// IBAN is how a SEPA transfer, a salary, a rent standing order is actually paid.
// It is the same caret lesson the money, phone and card fields taught, turned
// onto a value with its own grouping, plus one honest check the card's Luhn has
// a cousin to: the ISO 13616 mod-97 check digits.
//
//  The caret, again. An IBAN is written four characters at a time (DE89 3704
//  0044 0532 0130 00, not a run you count), and the instant the field reinserts
//  a space a naive controlled input throws the cursor to the end — so fixing a
//  wrong character in the middle is impossible. This reformats on every
//  keystroke AND restores the caret to the same logical place: it counts the
//  value-bearing characters (letters and digits) to the left of where you were,
//  then walks the freshly grouped string to the position just past that many, so
//  the cursor stays under your edit while the spaces rearrange around it. The
//  grouping is a plain four, which every country's IBAN is printed in.
//
//  The country, by its real code. An IBAN opens with a two-letter ISO 3166
//  country code and two check digits; the country code is published, so the
//  field names the country from those two letters — and from the country it
//  knows the exact total length that country's IBAN carries (ISO 13616: a
//  German IBAN is 22 characters, a French one 27, a Dutch one 18), which caps
//  the input and tells the field when the number is the right size. No bank is
//  named or guessed — the BBAN's internal structure differs by country and the
//  field does not pretend to decode it; it names only what the standard lets it
//  name for sure, the country.
//
//  The mod-97 check, framed for what it is. The two digits after the country
//  code are a checksum over the rest (ISO 7064 mod-97-10): move the first four
//  characters to the end, turn each letter into two digits (A=10 … Z=35), read
//  the result as one long number, and a correct IBAN leaves remainder 1 on
//  division by 97. A single mistyped or transposed character fails it. So the
//  field runs it and surfaces the result — but as what it actually is, a typo
//  check, NOT a claim the account exists or can receive money. An IBAN can pass
//  mod-97 and name no real account. The cue says "passes the check digits",
//  never "valid". Nothing here leaves the tab: no network, no storage, only
//  formatting and arithmetic.
//
// Reduced motion keeps every behaviour and drops only the movement — the country
// name cross-fades without sliding, the focus underline appears without drawing.

const LIME = '#DCF87C'

/** A country whose IBAN this field is sure how to read: its ISO 3166 code, the
 *  name to show, and the exact IBAN length ISO 13616 assigns it. The set is a
 *  SEPA-leaning one; a code outside it is still grouped and mod-97-checked, the
 *  field simply says the country is unrecognised rather than inventing a name or
 *  a length. */
export interface IbanCountry {
  code: string
  name: string
  length: number
}

// Real lengths from the ISO 13616 / SWIFT IBAN registry. No length is guessed.
export const IBAN_COUNTRIES: readonly IbanCountry[] = [
  { code: 'AD', name: 'Andorra', length: 24 },
  { code: 'AT', name: 'Austria', length: 20 },
  { code: 'BE', name: 'Belgium', length: 16 },
  { code: 'BG', name: 'Bulgaria', length: 22 },
  { code: 'CH', name: 'Switzerland', length: 21 },
  { code: 'CY', name: 'Cyprus', length: 28 },
  { code: 'CZ', name: 'Czechia', length: 24 },
  { code: 'DE', name: 'Germany', length: 22 },
  { code: 'DK', name: 'Denmark', length: 18 },
  { code: 'EE', name: 'Estonia', length: 20 },
  { code: 'ES', name: 'Spain', length: 24 },
  { code: 'FI', name: 'Finland', length: 18 },
  { code: 'FR', name: 'France', length: 27 },
  { code: 'GB', name: 'United Kingdom', length: 22 },
  { code: 'GR', name: 'Greece', length: 27 },
  { code: 'HR', name: 'Croatia', length: 21 },
  { code: 'HU', name: 'Hungary', length: 28 },
  { code: 'IE', name: 'Ireland', length: 22 },
  { code: 'IS', name: 'Iceland', length: 26 },
  { code: 'IT', name: 'Italy', length: 27 },
  { code: 'LI', name: 'Liechtenstein', length: 21 },
  { code: 'LT', name: 'Lithuania', length: 20 },
  { code: 'LU', name: 'Luxembourg', length: 20 },
  { code: 'LV', name: 'Latvia', length: 21 },
  { code: 'MC', name: 'Monaco', length: 27 },
  { code: 'MT', name: 'Malta', length: 31 },
  { code: 'NL', name: 'Netherlands', length: 18 },
  { code: 'NO', name: 'Norway', length: 15 },
  { code: 'PL', name: 'Poland', length: 28 },
  { code: 'PT', name: 'Portugal', length: 25 },
  { code: 'RO', name: 'Romania', length: 24 },
  { code: 'SE', name: 'Sweden', length: 24 },
  { code: 'SI', name: 'Slovenia', length: 19 },
  { code: 'SK', name: 'Slovakia', length: 24 },
  { code: 'SM', name: 'San Marino', length: 27 },
] as const

// The longest registered IBAN is 34 characters; cap unrecognised input there so
// a mistyped country code cannot grow without bound.
const MAX_IBAN = 34

export interface IbanValue {
  /** The IBAN as entered, letters and digits only, no spaces, upper-cased. */
  raw: string
  /** The detected country code, or null when the first two letters name none. */
  country: string | null
  /** Whether the number passes the mod-97 check digits (a typo check, not validity). */
  valid: boolean
  /** Whether it is a recognised country, the right length and mod-97-clean. */
  complete: boolean
}

export interface IbanFieldProps {
  /** The visible label over the input. */
  label?: string
  /** An IBAN filled in initially (spaces and case are ignored). */
  defaultValue?: string
  /** A quiet helper line under the field. */
  hint?: ReactNode
  /** Notified whenever the value changes. */
  onChange?: (value: IbanValue) => void
  className?: string
}

export interface IbanFieldHandle {
  /** The current value, as the onChange payload. */
  value: () => IbanValue
}

/** The country whose code opens the IBAN, or null when the two letters match
 *  none in the known set. */
export function detectIbanCountry(raw: string): IbanCountry | null {
  if (raw.length < 2) return null
  const code = raw.slice(0, 2)
  if (!/^[A-Z]{2}$/.test(code)) return null
  for (const c of IBAN_COUNTRIES) if (c.code === code) return c
  return null
}

/** The ISO 7064 mod-97-10 check: rearrange (first four characters to the end),
 *  expand each letter to two digits (A=10 … Z=35), read the lot as one long
 *  decimal and take it modulo 97; a correct IBAN leaves remainder 1. Computed a
 *  character at a time so the huge number never needs to be held whole. Catches a
 *  single mistyped or transposed character — a typo check, nothing more. */
export function ibanMod97Ok(raw: string): boolean {
  // Needs at least the country code and the two check digits to mean anything,
  // and every character must be a letter or a digit.
  if (raw.length < 4) return false
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(raw)) return false
  const rearranged = raw.slice(4) + raw.slice(0, 4)
  let remainder = 0
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i)
    // A–Z expand to the two-digit numbers 10–35; 0–9 stay as one digit.
    if (code >= 65 && code <= 90) {
      remainder = (remainder * 100 + (code - 55)) % 97
    } else {
      remainder = (remainder * 10 + (code - 48)) % 97
    }
  }
  return remainder === 1
}

/** Keep only IBAN-legal characters (letters and digits), upper-cased. */
function clean(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Break the characters into plain groups of four, joined by single spaces. */
function groupFours(raw: string): string {
  const parts: string[] = []
  for (let i = 0; i < raw.length; i += 4) parts.push(raw.slice(i, i + 4))
  return parts.join(' ')
}

/** Count the value-bearing characters (letters and digits) in a string. */
function countAlnum(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) n++
  }
  return n
}

/** Walk a grouped display to the index just past its Nth value-bearing
 *  character — the caret restore that keeps the cursor under the edit while the
 *  spaces rearrange. */
function caretForAlnum(display: string, n: number): number {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    const c = display.charCodeAt(i)
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
      seen++
      if (seen === n) return i + 1
    }
  }
  return display.length
}

function useCaretRestore(
  ref: React.RefObject<HTMLInputElement>,
  pending: React.MutableRefObject<number | null>,
) {
  useLayoutEffect(() => {
    if (pending.current != null && ref.current) {
      const pos = pending.current
      pending.current = null
      try {
        ref.current.setSelectionRange(pos, pos)
      } catch {
        // some inputs reject setSelectionRange — harmless here
      }
    }
  })
}

/**
 * An IBAN field — the bank-transfer sibling to the card field — that formats as
 * you type with the caret kept under your edit, names the country from its real
 * ISO code (and caps the length the standard assigns it), and runs the ISO 13616
 * mod-97 check digits as an honest typo check (never a claim of validity).
 * Nothing is sent or stored; it is formatting and arithmetic only. Under
 * prefers-reduced-motion every behaviour stays and only the country cross-fade
 * and the focus-underline draw are dropped.
 */
export const IbanField = forwardRef<IbanFieldHandle, IbanFieldProps>(function IbanField(
  { label = 'IBAN', defaultValue = '', hint, onChange, className = '' },
  ref,
) {
  const reduce = useReducedMotion()
  const id = useId()
  const hintId = `${id}-hint`

  const [raw, setRaw] = useState(() => clean(defaultValue).slice(0, MAX_IBAN))
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const caret = useRef<number | null>(null)
  useCaretRestore(inputRef, caret)

  const country = useMemo(() => detectIbanCountry(raw), [raw])
  const display = groupFours(raw)
  const valid = useMemo(() => ibanMod97Ok(raw), [raw])
  const rightLength = country != null && raw.length === country.length
  const complete = country != null && rightLength && valid

  const toValue = useCallback(
    (): IbanValue => ({
      raw,
      country: country?.code ?? null,
      valid,
      complete,
    }),
    [raw, country, valid, complete],
  )

  useImperativeHandle(ref, () => ({ value: toValue }), [toValue])

  const emit = useCallback(
    (next: string) => {
      const c = detectIbanCountry(next)
      const ok = ibanMod97Ok(next)
      onChange?.({
        raw: next,
        country: c?.code ?? null,
        valid: ok,
        complete: c != null && next.length === c.length && ok,
      })
    },
    [onChange],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      const pos = e.target.selectionStart ?? value.length
      const before = countAlnum(value.slice(0, pos))
      const cleaned = clean(value)
      // Cap to the detected country's length, or the 34-character ceiling when
      // the country is not (yet) known, re-detecting on the fresh characters.
      const provisional = detectIbanCountry(cleaned)
      const cap = provisional ? provisional.length : MAX_IBAN
      const next = cleaned.slice(0, cap)
      caret.current = caretForAlnum(groupFours(next), before)
      setRaw(next)
      emit(next)
    },
    [emit],
  )

  // The honest status line: what the field can and cannot say.
  let status: { text: string; tone: 'ok' | 'warn' | 'muted' }
  const wrongLength = country != null && raw.length > 4 && raw.length !== country.length
  const checkFailed = touched && rightLength && !valid
  if (complete) {
    status = { text: 'Passes the mod-97 check digits — a typo test, not a guarantee the account is real.', tone: 'ok' }
  } else if (checkFailed) {
    status = { text: 'Fails the mod-97 check — a character is likely mistyped or transposed.', tone: 'warn' }
  } else if (touched && wrongLength && raw.length > country!.length - 2) {
    status = { text: `A ${country!.name} IBAN is ${country!.length} characters — this is ${raw.length}.`, tone: 'warn' }
  } else if (raw.length >= 2 && country == null && /^[A-Z]{2}/.test(raw)) {
    status = { text: 'That country code is not one this field recognises — it still checks the digits.', tone: 'muted' }
  } else {
    status = { text: 'Nothing is sent or stored — this is formatting and a checksum only.', tone: 'muted' }
  }

  const accent = focused ? LIME : 'rgba(255,255,255,0.4)'
  const flagged = checkFailed || (touched && wrongLength && raw.length > country!.length)
  const countryName = country?.name ?? (raw.length >= 2 && /^[A-Z]{2}/.test(raw) ? 'Unknown country' : '')

  return (
    <div className={`w-full ${className}`}>
      <label htmlFor={id} className="mb-1.5 block pl-1 text-sm font-medium" style={{ color: accent }}>
        {label}
      </label>

      <div
        className="relative rounded-xl border bg-white/[0.035] transition-colors"
        style={{
          borderColor: flagged
            ? 'rgba(248,113,113,0.6)'
            : focused
              ? 'rgba(220,248,124,0.6)'
              : 'rgba(255,255,255,0.12)',
        }}
      >
        <div className="flex items-stretch">
          <input
            id={id}
            ref={inputRef}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={display}
            placeholder="DE00 0000 0000 0000 0000 00"
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              setTouched(true)
            }}
            aria-invalid={flagged || undefined}
            aria-describedby={hintId}
            className="peer block w-full bg-transparent px-3.5 py-3 text-base tabular-nums uppercase tracking-wide text-white outline-none placeholder:text-white/25 placeholder:normal-case"
          />

          {/* COUNTRY — named from the real ISO code, as text, never a flag. */}
          <div className="flex shrink-0 items-center pr-3.5" aria-hidden>
            <AnimatePresence mode="wait" initial={false}>
              {countryName && (
                <motion.span
                  key={countryName}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                  className={`whitespace-nowrap text-xs font-semibold tracking-wide ${
                    country ? 'text-white/70' : 'text-white/30'
                  }`}
                >
                  {countryName}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* The focus underline — a lime bar drawing out from centre, matching the
            money, phone and card fields. Red when the value is flagged. */}
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-3 right-3 h-0.5 origin-center rounded-full"
          style={{ backgroundColor: flagged ? '#f87171' : LIME }}
          initial={false}
          animate={{ scaleX: focused || flagged ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
        />

        {/* The "passes the check" tick, a soft cue at the trailing edge. */}
        <AnimatePresence initial={false}>
          {complete && (
            <motion.span
              key="done"
              aria-hidden
              className="absolute right-3.5 top-3 text-[#DCF87C]"
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
      </div>

      <p
        id={hintId}
        className="mt-2 pl-1 text-xs"
        style={{
          color:
            status.tone === 'ok'
              ? 'rgba(220,248,124,0.75)'
              : status.tone === 'warn'
                ? 'rgba(248,113,113,0.85)'
                : 'rgba(255,255,255,0.4)',
        }}
      >
        {hint ?? status.text}
      </p>

      {/* A polite announcement of the checksum outcome for screen readers. */}
      <span className="sr-only" role="status" aria-live="polite">
        {touched && rightLength ? (valid ? 'IBAN passes the check digits.' : 'IBAN fails the check digits.') : ''}
      </span>
    </div>
  )
})

export default IbanField
