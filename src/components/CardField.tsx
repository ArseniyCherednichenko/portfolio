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

// The payment-card field the checkout family never had, and the third sibling
// to the money field (an amount) and the phone field (a contact) beside it —
// the piece every checkout ends on. It is the same caret lesson those two
// taught, turned onto the one value a lazy version always mangles, plus two
// honest checks the others did not need.
//
//  The caret, again. A card number is grouped four at a time (4242 4242 4242
//  4242, not a run you count), and the instant the field reinserts a space a
//  naive controlled input throws the cursor to the end — so fixing a wrong
//  digit in the middle is impossible. This reformats on every keystroke AND
//  restores the caret to the same logical place: it counts the digits to the
//  left of where you were, then walks the freshly grouped string to the
//  position just past that many, so the cursor stays under your edit while the
//  spaces rearrange around it. The grouping itself follows the detected brand —
//  most cards break 4-4-4-4, American Express breaks 4-6-5 — so the spacing is
//  the real one, not a single guess applied to every card.
//
//  The brand, by its real prefix. A card's issuer is written into its leading
//  digits (its IIN, the published numbering scheme every terminal reads), so
//  the field names the brand from the digits themselves — Visa starts 4,
//  Mastercard 51-55 or 2221-2720, American Express 34 or 37, Discover 6011 /
//  65 / 644-649 — and nothing is guessed or fabricated. The brand sets the
//  expected length, the grouping and the security-code length (three digits for
//  most, four for Amex). No issuer logo is drawn — the brand's name carries it,
//  which is honest and borrows no mark.
//
//  The Luhn check, framed for what it is. The last digit of a card number is a
//  checksum: run the Luhn algorithm (double every second digit from the right,
//  sum, and the total must be a multiple of ten) and a single mistyped or
//  transposed digit fails it. So the field runs Luhn and surfaces the result —
//  but as what it actually is, a typo check, NOT a claim the card exists or is
//  good for anything. A number can pass Luhn and be entirely made up. The cue
//  says "passes the check", never "valid", because a field has no business
//  pretending it authorised a payment it never sent. Nothing here leaves the
//  tab: there is no network, no storage, only formatting and arithmetic.
//
// Reduced motion keeps every behaviour and drops only the movement — the brand
// name cross-fades without sliding, the focus underline appears without drawing.

const LIME = '#DCF87C'

export interface CardBrand {
  /** Stable id, e.g. 'visa'. */
  id: string
  /** The brand's name, shown as text in the corner. No logo is drawn. */
  name: string
  /** Matches the leading digits (the IIN) this brand is issued under. */
  test: (digits: string) => boolean
  /** The number of digits a card of this brand carries. */
  length: number
  /** Group sizes the number is broken into for display, e.g. [4,4,4,4]. */
  groups: number[]
  /** The length of this brand's security code (CVC/CVV/CID). */
  cvc: number
}

// A small, honest set — the brands this field is sure how to read, by the
// published prefix ranges (IINs) that identify them. The ranges are real; the
// field does not guess an issuer it cannot name from the digits. When no brand
// matches, the field falls back to a plain 4-4-4-4 grouping and a three-digit
// code, and says the brand is unknown rather than inventing one.
export const CARD_BRANDS: readonly CardBrand[] = [
  {
    id: 'visa',
    name: 'Visa',
    test: (d) => /^4/.test(d),
    length: 16,
    groups: [4, 4, 4, 4],
    cvc: 3,
  },
  {
    id: 'mastercard',
    name: 'Mastercard',
    // 51-55, plus the 2221-2720 range Mastercard added.
    test: (d) => /^5[1-5]/.test(d) || /^(222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(d),
    length: 16,
    groups: [4, 4, 4, 4],
    cvc: 3,
  },
  {
    id: 'amex',
    name: 'American Express',
    test: (d) => /^3[47]/.test(d),
    length: 15,
    groups: [4, 6, 5],
    cvc: 4,
  },
  {
    id: 'discover',
    name: 'Discover',
    test: (d) => /^(6011|65|64[4-9])/.test(d),
    length: 16,
    groups: [4, 4, 4, 4],
    cvc: 3,
  },
] as const

// The shape used when the leading digits match no known brand.
const UNKNOWN_BRAND: Omit<CardBrand, 'name' | 'id' | 'test'> = {
  length: 19,
  groups: [4, 4, 4, 4, 3],
  cvc: 3,
}

export interface CardValue {
  /** The card digits only, no spaces. */
  number: string
  /** The detected brand id, or null when the prefix matches none. */
  brand: string | null
  /** The expiry, when both parts are present and the month is 1-12. */
  expiry: { month: number; year: number } | null
  /** The security code digits. */
  cvc: string
  /** Whether the number passes the Luhn checksum (a typo check, not validity). */
  luhn: boolean
  /** Whether every part is present, the right length, Luhn-clean and unexpired. */
  complete: boolean
}

export interface CardFieldProps {
  /** The visible label over the card-number input. */
  label?: string
  /** Card digits filled in initially (digits only; spaces ignored). */
  defaultValue?: string
  /** A quiet helper line under the field. */
  hint?: ReactNode
  /** Notified whenever any part changes. */
  onChange?: (value: CardValue) => void
  className?: string
}

export interface CardFieldHandle {
  /** The current value, as the onChange payload. */
  value: () => CardValue
}

/** The Luhn checksum: double every second digit from the right, sum the digits
 *  of the result, and a valid number's total is a multiple of ten. Catches a
 *  single mistyped or transposed digit — a typo check, nothing more. */
export function luhnOk(digits: string): boolean {
  if (digits.length < 2) return false
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (n < 0 || n > 9) return false
    if (dbl) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    dbl = !dbl
  }
  return sum % 10 === 0
}

/** The brand whose published prefix the digits fall under, or null. */
export function detectBrand(digits: string): CardBrand | null {
  if (!digits) return null
  for (const b of CARD_BRANDS) if (b.test(digits)) return b
  return null
}

/** The effective length / grouping / cvc-length for a (possibly unknown) brand. */
function shapeFor(brand: CardBrand | null): { length: number; groups: number[]; cvc: number } {
  return brand ? { length: brand.length, groups: brand.groups, cvc: brand.cvc } : UNKNOWN_BRAND
}

/** Break the digits into the brand's groups, joined by single spaces, trailing
 *  overflow kept so a longer-than-expected run still shows while typing. */
function groupDigits(digits: string, groups: number[]): string {
  const parts: string[] = []
  let i = 0
  for (const g of groups) {
    if (i >= digits.length) break
    parts.push(digits.slice(i, i + g))
    i += g
  }
  if (i < digits.length) parts.push(digits.slice(i))
  return parts.join(' ')
}

/** Count the digits in a string — all that carries meaning in a card number. */
function countDigits(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 48 && c <= 57) n++
  }
  return n
}

/** Walk a grouped display to the index just past its Nth digit — the caret
 *  restore that keeps the cursor under the edit while spaces rearrange. */
function caretForDigits(display: string, n: number): number {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    const c = display.charCodeAt(i)
    if (c >= 48 && c <= 57) {
      seen++
      if (seen === n) return i + 1
    }
  }
  return display.length
}

/** Lay up to four expiry digits into MM/YY, padding a lone high month (a typed
 *  '4' becomes '04/') and inserting the slash once two digits are in. */
function formatExpiry(digits: string): string {
  let d = digits
  // A first digit of 2-9 can only be a padded month (04..09), so pad it.
  if (d.length === 1 && d > '1') d = `0${d}`
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2, 4)}`
  if (d.length === 2) return `${d}/`
  return d
}

/** Parse MM/YY digits into a month (1-12) and a full year, or null. */
function parseExpiry(digits: string): { month: number; year: number } | null {
  if (digits.length < 4) return null
  const month = Number(digits.slice(0, 2))
  if (month < 1 || month > 12) return null
  const year = 2000 + Number(digits.slice(2, 4))
  return { month, year }
}

/** Whether an expiry is this month or later (so not already past). */
function expiryLive(exp: { month: number; year: number } | null): boolean {
  if (!exp) return false
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  return exp.year > curY || (exp.year === curY && exp.month >= curM)
}

function useCaretRestore(ref: React.RefObject<HTMLInputElement>, pending: React.MutableRefObject<number | null>) {
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
 * A payment-card field — number, expiry and security code — that formats as you
 * type with the caret kept under your edit, names the brand from its real
 * prefix, and runs the Luhn checksum as an honest typo check (never a claim of
 * validity). Nothing is sent or stored; it is formatting and arithmetic only.
 * Under prefers-reduced-motion every behaviour stays and only the brand
 * cross-fade and the focus-underline draw are dropped.
 */
export const CardField = forwardRef<CardFieldHandle, CardFieldProps>(function CardField(
  { label = 'Card number', defaultValue = '', hint, onChange, className = '' },
  ref,
) {
  const reduce = useReducedMotion()
  const id = useId()
  const hintId = `${id}-hint`

  const [number, setNumber] = useState(() => defaultValue.replace(/\D/g, '').slice(0, 19))
  const [expiryDigits, setExpiryDigits] = useState('')
  const [cvc, setCvc] = useState('')
  const [focused, setFocused] = useState<null | 'number' | 'expiry' | 'cvc'>(null)
  const [touched, setTouched] = useState(false)

  const numberRef = useRef<HTMLInputElement | null>(null)
  const expiryRef = useRef<HTMLInputElement | null>(null)
  const numberCaret = useRef<number | null>(null)
  const expiryCaret = useRef<number | null>(null)

  useCaretRestore(numberRef, numberCaret)
  useCaretRestore(expiryRef, expiryCaret)

  const brand = useMemo(() => detectBrand(number), [number])
  const shape = shapeFor(brand)
  const display = groupDigits(number, shape.groups)
  const luhn = useMemo(() => luhnOk(number), [number])
  const expiry = parseExpiry(expiryDigits)
  const numberFull = number.length === shape.length

  const complete =
    brand != null &&
    numberFull &&
    luhn &&
    expiryLive(expiry) &&
    cvc.length === shape.cvc

  const toValue = useCallback(
    (): CardValue => ({
      number,
      brand: brand?.id ?? null,
      expiry: expiryLive(expiry) ? expiry : null,
      cvc,
      luhn,
      complete,
    }),
    [number, brand, expiry, cvc, luhn, complete],
  )

  useImperativeHandle(ref, () => ({ value: toValue }), [toValue])

  const emit = useCallback(
    (next: Partial<{ number: string; expiryDigits: string; cvc: string }>) => {
      const nNum = next.number ?? number
      const nExp = next.expiryDigits ?? expiryDigits
      const nCvc = next.cvc ?? cvc
      const b = detectBrand(nNum)
      const sh = shapeFor(b)
      const exp = parseExpiry(nExp)
      const live = expiryLive(exp)
      const value: CardValue = {
        number: nNum,
        brand: b?.id ?? null,
        expiry: live ? exp : null,
        cvc: nCvc,
        luhn: luhnOk(nNum),
        complete:
          b != null && nNum.length === sh.length && luhnOk(nNum) && live && nCvc.length === sh.cvc,
      }
      onChange?.(value)
    },
    [number, expiryDigits, cvc, onChange],
  )

  const handleNumber = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const caret = e.target.selectionStart ?? raw.length
      const before = countDigits(raw.slice(0, caret))
      // Cap at the detected brand's length (or 19 when unknown), re-detecting
      // on the fresh digits so the cap follows the prefix as it is typed.
      const rawDigits = raw.replace(/\D/g, '')
      const provisional = detectBrand(rawDigits)
      const cap = provisional ? provisional.length : 19
      const next = rawDigits.slice(0, cap)
      const nextDisplay = groupDigits(next, shapeFor(detectBrand(next)).groups)
      numberCaret.current = caretForDigits(nextDisplay, before)
      setNumber(next)
      emit({ number: next })
    },
    [emit],
  )

  const handleExpiry = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const caret = e.target.selectionStart ?? raw.length
      const before = countDigits(raw.slice(0, caret))
      const next = raw.replace(/\D/g, '').slice(0, 4)
      const nextDisplay = formatExpiry(next)
      // Count the slash too when restoring, since it sits between digits 2 and 3.
      let pos = 0
      let seen = 0
      for (let i = 0; i < nextDisplay.length; i++) {
        const c = nextDisplay.charCodeAt(i)
        if (c >= 48 && c <= 57) {
          seen++
          pos = i + 1
          if (seen === before) break
        }
      }
      expiryCaret.current = before === 0 ? 0 : pos
      setExpiryDigits(next)
      emit({ expiryDigits: next })
    },
    [emit],
  )

  const handleCvc = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value.replace(/\D/g, '').slice(0, shape.cvc)
      setCvc(next)
      emit({ cvc: next })
    },
    [emit, shape.cvc],
  )

  const expiryDisplay = formatExpiry(expiryDigits)
  const expiryPast = expiryDigits.length === 4 && !expiryLive(expiry)
  const numberError = touched && number.length > 0 && numberFull && !luhn

  // The honest status line under the field: what the field can and cannot say.
  let status: { text: string; tone: 'ok' | 'warn' | 'muted' }
  if (complete) status = { text: 'Passes the Luhn check — a typo test, not a guarantee the card is real.', tone: 'ok' }
  else if (numberError) status = { text: 'Fails the Luhn check — a digit is likely mistyped or transposed.', tone: 'warn' }
  else if (expiryPast) status = { text: 'That expiry is already past.', tone: 'warn' }
  else status = { text: 'Nothing is sent or stored — this is formatting and a checksum only.', tone: 'muted' }

  const accent = focused ? LIME : 'rgba(255,255,255,0.4)'
  const borderActive = focused != null
  const brandName = brand?.name ?? (number.length >= 2 ? 'Unknown brand' : '')

  return (
    <div className={`w-full ${className}`}>
      <label htmlFor={`${id}-num`} className="mb-1.5 block pl-1 text-sm font-medium" style={{ color: accent }}>
        {label}
      </label>

      <div
        className="relative rounded-xl border bg-white/[0.035] transition-colors"
        style={{
          borderColor: numberError || expiryPast
            ? 'rgba(248,113,113,0.6)'
            : borderActive
              ? 'rgba(220,248,124,0.6)'
              : 'rgba(255,255,255,0.12)',
        }}
      >
        <div className="flex items-stretch">
          <input
            id={`${id}-num`}
            ref={numberRef}
            inputMode="numeric"
            autoComplete="cc-number"
            value={display}
            placeholder="0000 0000 0000 0000"
            onChange={handleNumber}
            onFocus={() => setFocused('number')}
            onBlur={() => {
              setFocused(null)
              setTouched(true)
            }}
            aria-invalid={numberError || undefined}
            aria-describedby={hintId}
            className="peer block w-full bg-transparent px-3.5 py-3 text-base tabular-nums tracking-wide text-white outline-none placeholder:text-white/25"
          />

          {/* BRAND — named from the real prefix, as text, never a borrowed logo. */}
          <div className="flex shrink-0 items-center pr-3.5" aria-hidden>
            <AnimatePresence mode="wait" initial={false}>
              {brandName && (
                <motion.span
                  key={brandName}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                  className={`whitespace-nowrap text-xs font-semibold tracking-wide ${
                    brand ? 'text-white/70' : 'text-white/30'
                  }`}
                >
                  {brandName}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-stretch border-t border-white/10">
          <div className="flex w-1/2 items-stretch border-r border-white/10">
            <label htmlFor={`${id}-exp`} className="sr-only">
              Expiry date, month and year
            </label>
            <input
              id={`${id}-exp`}
              ref={expiryRef}
              inputMode="numeric"
              autoComplete="cc-exp"
              value={expiryDisplay}
              placeholder="MM / YY"
              onChange={handleExpiry}
              onFocus={() => setFocused('expiry')}
              onBlur={() => {
                setFocused(null)
                setTouched(true)
              }}
              aria-invalid={expiryPast || undefined}
              className="block w-full bg-transparent px-3.5 py-3 text-base tabular-nums text-white outline-none placeholder:text-white/25"
            />
          </div>
          <div className="flex w-1/2 items-stretch">
            <label htmlFor={`${id}-cvc`} className="sr-only">
              Security code{brand ? `, ${shape.cvc} digits` : ''}
            </label>
            <input
              id={`${id}-cvc`}
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cvc}
              placeholder={brand?.id === 'amex' ? 'CID' : 'CVC'}
              onChange={handleCvc}
              onFocus={() => setFocused('cvc')}
              onBlur={() => setFocused(null)}
              className="block w-full bg-transparent px-3.5 py-3 text-base tabular-nums text-white outline-none placeholder:text-white/25"
            />
          </div>
        </div>

        {/* The focus underline — a lime bar drawing out from centre, matching
            the money and phone fields. Red when a part is flagged. */}
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-3 right-3 h-0.5 origin-center rounded-full"
          style={{ backgroundColor: numberError || expiryPast ? '#f87171' : LIME }}
          initial={false}
          animate={{ scaleX: borderActive || numberError || expiryPast ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
        />

        {/* The "looks complete" tick, a soft cue at the trailing edge. */}
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
        {touched && numberFull ? (luhn ? 'Card number passes the checksum.' : 'Card number fails the checksum.') : ''}
      </span>
    </div>
  )
})

export default CardField
