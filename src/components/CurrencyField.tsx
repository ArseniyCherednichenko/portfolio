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
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// The money field the controls family never had. Its entry-field siblings each
// take a shape — the FloatingField a line of text, the CodeInput a run of
// digits, the TagInput a set of chips, the NumberField a bare count — but none
// of them handles the one value a product most often asks a person to type: an
// amount of money. It reads trivially ("just a number input with a currency
// sign") and it is not, because of one thing a lazy version always gets wrong.
//
//  The caret. A money field has to group its digits as you type — 1,234,567,
//  not a 1234567 you have to count — and the instant it reinserts a separator,
//  a naive controlled input throws your caret to the end of the string. Type a
//  digit in the middle of a figure and the cursor leaps away; the field becomes
//  unusable for exactly the edit people make most (fixing a wrong digit). So
//  this reformats on every keystroke AND restores the caret to the same logical
//  place afterwards — it counts the value-bearing characters (digits, the
//  decimal mark, a leading minus) to the left of where you were, then walks the
//  freshly grouped string to the position after that many of them, so the
//  cursor stays put under your edit while the separators rearrange around it.
//
// The rest follows from being honest about the two values in play. What a
// person types is a formatted string — "1,234.50" — but what a form needs is a
// clean number — 1234.5 — so the field keeps those separate: it displays the
// grouped text and reports the parsed number through onValueChange, and the two
// can never drift because the display is always a formatting of the parse.
// Grouping and both separators are read from the locale (Intl), the symbol from
// the currency, so a EUR field in a German locale reads "1.234,50 €" and a USD
// one "$1,234.50" without a hand-rolled table. Arrow Up/Down step the amount
// (Shift for a larger step, honouring any max), the way a number control
// should. A real label/input pair with inputMode=decimal and a polite live
// region that states the parsed amount on blur.
//
// Reduced motion keeps every behaviour and drops only the movement: the focus
// underline appears without drawing and the amount does not settle — the field
// is exactly as operable, only still.

const LIME = '#DCF87C'

export interface CurrencyFieldProps {
  /** The visible label and the input's accessible name. */
  label: string
  /** ISO 4217 code, e.g. 'EUR', 'USD', 'GBP'. Drives the symbol and decimals. */
  currency?: string
  /** BCP-47 locale for grouping and the symbol's placement. */
  locale?: string
  /** Uncontrolled initial amount. */
  defaultValue?: number | null
  /** A quiet helper line under the field. */
  hint?: ReactNode
  /** Clamp the amount; typing past it is held at the cap and flagged. */
  max?: number
  /** Allow a negative amount (a refund, a balance). Off by default. */
  allowNegative?: boolean
  /** Step applied by the Up/Down arrows (Shift multiplies by 10). */
  step?: number
  /** Notified with the parsed amount (or null when the field is empty). */
  onValueChange?: (value: number | null) => void
  className?: string
}

export interface CurrencyFieldHandle {
  /** The current parsed amount, or null when empty. */
  value: () => number | null
}

interface Locale {
  group: string
  decimal: string
  decimals: number
  symbol: string
  /** Whether the currency symbol sits before the number in this locale. */
  symbolFirst: boolean
}

// Read every locale-dependent fact from one formatted sample, so a EUR field in
// a de-DE locale and a USD one in en-US are the same code with different parts,
// never a hand-kept table of separators and symbols that falls out of date.
function readLocale(locale: string, currency: string): Locale {
  try {
    const nf = new Intl.NumberFormat(locale, { style: 'currency', currency })
    const parts = nf.formatToParts(-1234567.89)
    let group = ','
    let decimal = '.'
    let symbol = currency
    for (const p of parts) {
      if (p.type === 'group') group = p.value
      else if (p.type === 'decimal') decimal = p.value
      else if (p.type === 'currency') symbol = p.value
    }
    // symbolFirst: does a currency part appear before the first digit?
    const firstNum = parts.findIndex((p) => p.type === 'integer')
    const firstCur = parts.findIndex((p) => p.type === 'currency')
    const symbolFirst = firstCur !== -1 && (firstNum === -1 || firstCur < firstNum)
    const decimals = nf.resolvedOptions().maximumFractionDigits ?? 2
    return { group, decimal, symbol, symbolFirst, decimals }
  } catch {
    return { group: ',', decimal: '.', symbol: currency, symbolFirst: true, decimals: 2 }
  }
}

// Turn whatever is in the box into a canonical string: an optional leading
// minus, grouped integer digits, and at most `decimals` fraction digits after a
// single decimal mark — keeping a bare trailing mark ("12.") so a half-typed
// decimal does not vanish under the person's caret. Returns both the display
// text and the count of value-bearing chars before the caret, which is all the
// caret restore downstream needs.
function sanitise(
  raw: string,
  caret: number,
  loc: Locale,
  allowNegative: boolean,
): { text: string; keptBeforeCaret: number; numeric: number | null } {
  const negative = allowNegative && raw.trimStart().startsWith('-')
  let intPart = ''
  let fracPart = ''
  let hasMark = false
  let keptBeforeCaret = 0

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const isDigit = ch >= '0' && ch <= '9'
    const isMark = ch === loc.decimal || ch === '.' || ch === ','
    // The locale's own group char is a separator to skip, never a decimal mark.
    const isMarkReal = isMark && ch !== loc.group
    let keepThis = false
    if (isDigit) {
      if (!hasMark) {
        intPart += ch
        keepThis = true
      } else if (fracPart.length < loc.decimals) {
        fracPart += ch
        keepThis = true
      }
      // a digit past the allowed fraction length is dropped and not counted
    } else if (isMarkReal && !hasMark && loc.decimals > 0) {
      hasMark = true
      keepThis = true
    }
    if (keepThis && i < caret) keptBeforeCaret++
  }

  // Strip leading zeros from the integer part, but leave a single 0 when that is
  // all there is (so "0.5" survives and "007" becomes "7").
  intPart = intPart.replace(/^0+(?=\d)/, '')

  const grouped = groupInteger(intPart === '' ? (hasMark ? '0' : '') : intPart, loc.group)
  let text = grouped
  if (hasMark) text += loc.decimal + fracPart
  if (negative) text = '-' + text

  // Account for the minus and any dropped leading zeros when counting kept chars
  // against the rebuilt string: keptBeforeCaret counts raw kept chars, and the
  // restore walks the SAME class of chars in `text`, so grouping separators are
  // naturally skipped on both sides. A leading minus is one extra kept char.
  if (negative) keptBeforeCaret += 1

  const numericStr = (negative ? '-' : '') + (intPart === '' ? '0' : intPart) + (hasMark ? '.' + fracPart : '')
  const numeric = text === '' || text === '-' ? null : Number.isNaN(Number(numericStr)) ? null : Number(numericStr)

  return { text, keptBeforeCaret, numeric }
}

function groupInteger(digits: string, group: string): string {
  if (digits === '') return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, group)
}

// Count value-bearing chars (digits, the decimal mark, a leading minus) so the
// caret can be dropped back after the same number of them in the regrouped
// string — the whole trick to a caret that stays under the edit.
function isKept(ch: string, loc: Locale): boolean {
  return (ch >= '0' && ch <= '9') || ch === loc.decimal || ch === '-'
}

function caretForKept(text: string, keptTarget: number, loc: Locale): number {
  if (keptTarget <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (isKept(text[i], loc)) {
      seen++
      if (seen === keptTarget) return i + 1
    }
  }
  return text.length
}

function format(n: number, loc: Locale): string {
  const negative = n < 0
  const abs = Math.abs(n)
  const fixed = abs.toFixed(loc.decimals)
  const [intP, fracP] = fixed.split('.')
  let text = groupInteger(intP, loc.group)
  if (fracP != null && loc.decimals > 0) text += loc.decimal + fracP
  return (negative ? '-' : '') + text
}

/**
 * A money input with live thousands-grouping and a caret that stays under the
 * edit. Displays a locale-grouped, currency-prefixed amount and reports the
 * parsed number through onValueChange; Up/Down step the value; a `max` clamps
 * and flags. Under prefers-reduced-motion the focus underline appears without
 * drawing and the amount does not settle.
 */
export const CurrencyField = forwardRef<CurrencyFieldHandle, CurrencyFieldProps>(function CurrencyField(
  {
    label,
    currency = 'EUR',
    locale = 'en-US',
    defaultValue = null,
    hint,
    max,
    allowNegative = false,
    step = 1,
    onValueChange,
    className = '',
  },
  ref,
) {
  const reduce = useReducedMotion()
  const id = useId()
  const hintId = `${id}-hint`

  const loc = useMemo(() => readLocale(locale, currency), [locale, currency])

  const [text, setText] = useState(() => (defaultValue == null ? '' : format(defaultValue, loc)))
  const [numeric, setNumeric] = useState<number | null>(defaultValue)
  const [focused, setFocused] = useState(false)
  const [clamped, setClamped] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  // The caret position to restore after the controlled value updates. React
  // resets a controlled input's caret to the end on re-render, so the desired
  // index is stashed here and reapplied in a layout effect before paint.
  const caretRef = useRef<number | null>(null)

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

  const commit = useCallback(
    (next: number | null, nextText: string) => {
      setNumeric(next)
      setText(nextText)
      onValueChange?.(next)
    },
    [onValueChange],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const caret = e.target.selectionStart ?? raw.length
      const { text: cleaned, keptBeforeCaret, numeric: parsed } = sanitise(raw, caret, loc, allowNegative)

      let finalText = cleaned
      let finalNum = parsed
      let didClamp = false
      if (parsed != null && max != null && parsed > max) {
        finalNum = max
        finalText = format(max, loc)
        didClamp = true
      }
      setClamped(didClamp)
      caretRef.current = didClamp ? finalText.length : caretForKept(finalText, keptBeforeCaret, loc)
      commit(finalNum, finalText)
    },
    [allowNegative, commit, loc, max],
  )

  const stepBy = useCallback(
    (delta: number) => {
      const base = numeric ?? 0
      let next = base + delta
      if (!allowNegative && next < 0) next = 0
      if (max != null && next > max) {
        next = max
        setClamped(true)
      } else {
        setClamped(false)
      }
      const rounded = Number(next.toFixed(loc.decimals))
      const nextText = format(rounded, loc)
      caretRef.current = nextText.length
      commit(rounded, nextText)
    },
    [allowNegative, commit, loc, max, numeric],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        stepBy(step * (e.shiftKey ? 10 : 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        stepBy(-step * (e.shiftKey ? 10 : 1))
      }
    },
    [step, stepBy],
  )

  const handleBlur = useCallback(() => {
    setFocused(false)
    // Settle a half-typed value into its canonical form on leaving: a trailing
    // mark ("12.") or a lone minus becomes the real figure or empty.
    if (numeric == null) {
      if (text !== '') commit(null, '')
      return
    }
    const settled = format(numeric, loc)
    if (settled !== text) {
      caretRef.current = null
      setText(settled)
    }
  }, [commit, loc, numeric, text])

  useImperativeHandle(ref, () => ({ value: () => numeric }), [numeric])

  const spoken =
    numeric == null
      ? ''
      : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(numeric)

  const accent = clamped ? '#F87171' : focused ? LIME : 'rgba(255,255,255,0.4)'

  return (
    <div className={`w-full ${className}`}>
      <label htmlFor={id} className="mb-1.5 block pl-1 text-sm font-medium" style={{ color: accent }}>
        {label}
      </label>
      <div
        className="relative flex items-center rounded-xl border bg-white/[0.035] transition-colors"
        style={{
          borderColor: clamped
            ? 'rgba(248,113,113,0.7)'
            : focused
              ? 'rgba(220,248,124,0.6)'
              : 'rgba(255,255,255,0.12)',
        }}
      >
        {loc.symbolFirst && (
          <span aria-hidden className="pl-3.5 pr-1 text-base text-white/45 tabular-nums">
            {loc.symbol}
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={format(0, loc)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          aria-describedby={hintId}
          className={`peer block w-full bg-transparent py-3 text-base tabular-nums text-white outline-none placeholder:text-white/25 ${
            loc.symbolFirst ? 'pl-1 pr-3.5' : 'px-3.5'
          }`}
        />
        {!loc.symbolFirst && (
          <span aria-hidden className="pl-1 pr-3.5 text-base text-white/45 tabular-nums">
            {loc.symbol}
          </span>
        )}

        {/* The focus underline — a lime (or red, when clamped) bar that draws
            out from the centre, matching the FloatingField's affordance. */}
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-3 right-3 h-0.5 origin-center rounded-full"
          style={{ backgroundColor: clamped ? '#F87171' : LIME }}
          initial={false}
          animate={{ scaleX: focused || clamped ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
        />
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-3 pl-1 pr-1">
        <span
          id={hintId}
          className="text-xs leading-snug"
          style={{ color: clamped ? 'rgba(252,165,165,0.95)' : 'rgba(255,255,255,0.4)' }}
        >
          {clamped && max != null ? `Held at the maximum of ${format(max, loc)}.` : hint}
        </span>
      </div>

      {/* The parsed amount, announced politely on blur — a non-sighted user
          hears the real figure the grouping was for, not the raw digits. */}
      <span className="sr-only" aria-live="polite">
        {!focused && spoken ? `${label}: ${spoken}` : ''}
      </span>
    </div>
  )
})
