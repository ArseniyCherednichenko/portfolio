import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// The controls family had sliders, a rotary dial, a binary switch, and a
// discrete stepper — but no segmented entry field: the one-time-code / passcode
// box every verification screen leans on. This fills that gap, and it is where
// the "give it real physics" language the other controls speak meets the
// unglamorous product-engineering craft the pattern actually demands: focus that
// hands itself forward as you type and back as you delete, a paste that scatters
// its characters across the empty cells, full keyboard travel (arrows, Home/End,
// Backspace), and per-cell inputs a screen reader can name and drive.
//
// The feel: each character springs in — scaling and lifting out of nothing —
// rather than blinking on; the focused cell wears a lime ring and a blinking
// caret when it is empty; and the moment every cell is filled the whole row
// lifts in a short lime-lit stagger to mark completion. Under prefers-reduced
// -motion the pop, the caret blink, and the completion lift all come off, and it
// stays a plain, fully usable field that still reads and responds to assistive
// tech.

const CARET_STYLE_ID = 'code-input-caret-keyframes'

// A single shared stylesheet for the blinking caret — a steps() blink so it
// snaps on and off like a terminal cursor rather than fading. Injected once,
// module-wide, the first time any CodeInput mounts.
function ensureCaretKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(CARET_STYLE_ID)) return
  const el = document.createElement('style')
  el.id = CARET_STYLE_ID
  el.textContent =
    '@keyframes code-input-caret{0%,49%{opacity:1}50%,100%{opacity:0}}'
  document.head.appendChild(el)
}

/**
 * A segmented one-time-code / passcode input. Type to fill and auto-advance,
 * Backspace to clear and step back, arrows/Home/End to move, and paste to
 * scatter a whole code across the cells. Each landing character springs in, the
 * focused cell carries a blinking caret while empty, and a full code lifts the
 * row in a brief lime-lit stagger.
 *
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). `onComplete`
 * fires with the code the moment the last cell fills. Every cell is a real
 * `<input>` with its own accessible name, grouped under `aria-label`. Under
 * prefers-reduced-motion the pop, caret blink, and completion lift come off and
 * it stays a plain, legible field.
 */
export function CodeInput({
  length = 6,
  value: controlledValue,
  defaultValue = '',
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  type = 'numeric',
  label = 'Verification code',
  size = 56,
  className = '',
}: {
  /** Number of cells. */
  length?: number
  /** Controlled value; changes are reported via onChange only. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  onChange?: (value: string) => void
  /** Fired once, with the full code, when the final cell fills. */
  onComplete?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  /** 'numeric' allows 0-9; 'alphanumeric' also allows A-Z (upper-cased). */
  type?: 'numeric' | 'alphanumeric'
  /** Accessible group name, and the base for each cell's per-index label. */
  label?: string
  /** Cell size in px; the box, type, and caret scale from it. */
  size?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  const isControlled = controlledValue !== undefined
  const [uncontrolled, setUncontrolled] = useState(() =>
    defaultValue.slice(0, length),
  )
  const raw = isControlled ? controlledValue ?? '' : uncontrolled

  const allowed = useMemo(
    () => (type === 'numeric' ? /[0-9]/ : /[0-9A-Z]/),
    [type],
  )

  // A fixed-length array of single characters — the source of truth the cells
  // render from, padded with empties so index math is always in range.
  const cells = useMemo(() => {
    const out: string[] = []
    for (let i = 0; i < length; i++) out.push(raw[i] ?? '')
    return out
  }, [raw, length])

  const filled = cells.filter(Boolean).length
  const complete = filled === length
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  useEffect(() => ensureCaretKeyframes(), [])

  useEffect(() => {
    if (autoFocus && !disabled) inputs.current[0]?.focus()
    // Run once on mount for the initial focus only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // onComplete should fire exactly on the transition into a full code, not on
  // every keystroke while it stays full — a ref remembers the last state.
  const wasComplete = useRef(false)
  useEffect(() => {
    if (complete && !wasComplete.current) onComplete?.(cells.join(''))
    wasComplete.current = complete
  }, [complete, cells, onComplete])

  function commit(next: string[]) {
    const joined = next.join('')
    if (!isControlled) setUncontrolled(joined)
    onChange?.(joined)
  }

  function focusCell(index: number) {
    const clamped = Math.max(0, Math.min(length - 1, index))
    inputs.current[clamped]?.focus()
    inputs.current[clamped]?.select()
  }

  function normalise(char: string) {
    const upper = type === 'alphanumeric' ? char.toUpperCase() : char
    return allowed.test(upper) ? upper : ''
  }

  function handleChange(index: number, rawInput: string) {
    if (disabled) return
    // An input event can carry more than one character (autofill, IME, a fast
    // paste into a single box). Take the trailing run of allowed characters and
    // lay them out from this cell forward.
    const chars = rawInput.split('').map(normalise).filter(Boolean)
    if (!chars.length) return
    const next = [...cells]
    let i = index
    for (const c of chars) {
      if (i >= length) break
      next[i] = c
      i++
    }
    commit(next)
    focusCell(i >= length ? length - 1 : i)
  }

  function handleKeyDown(index: number, e: ReactKeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    switch (e.key) {
      case 'Backspace': {
        e.preventDefault()
        const next = [...cells]
        if (next[index]) {
          // Clear the current cell, stay put.
          next[index] = ''
          commit(next)
        } else if (index > 0) {
          // Already empty — step back and clear the previous.
          next[index - 1] = ''
          commit(next)
          focusCell(index - 1)
        }
        break
      }
      case 'Delete': {
        e.preventDefault()
        const next = [...cells]
        next[index] = ''
        commit(next)
        break
      }
      case 'ArrowLeft':
        e.preventDefault()
        focusCell(index - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusCell(index + 1)
        break
      case 'Home':
        e.preventDefault()
        focusCell(0)
        break
      case 'End':
        e.preventDefault()
        focusCell(length - 1)
        break
      default:
        break
    }
  }

  function handlePaste(index: number, e: ReactClipboardEvent<HTMLInputElement>) {
    if (disabled) return
    e.preventDefault()
    const chars = e.clipboardData
      .getData('text')
      .split('')
      .map(normalise)
      .filter(Boolean)
    if (!chars.length) return
    const next = [...cells]
    let i = index
    for (const c of chars) {
      if (i >= length) break
      next[i] = c
      i++
    }
    commit(next)
    focusCell(i >= length ? length - 1 : i)
  }

  const gap = Math.max(6, Math.round(size * 0.16))

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex ${className}`}
      style={{ gap }}
    >
      {cells.map((char, i) => {
        const isFocused = focusedIndex === i
        const showCaret = isFocused && !char && !disabled
        return (
          <motion.div
            key={i}
            className="relative"
            // On completion the whole row lifts in a stagger, then settles —
            // a small, once-only celebration. Silent under reduced motion.
            animate={
              complete && !reduce
                ? { y: [0, -8, 0] }
                : { y: 0 }
            }
            transition={
              complete && !reduce
                ? { duration: 0.42, delay: i * 0.05, ease: [0.34, 1.56, 0.64, 1] }
                : { duration: 0.2 }
            }
          >
            <input
              ref={(el) => {
                inputs.current[i] = el
              }}
              // A real text input, but constrained: one char, numeric keypad on
              // touch, and the OS one-time-code affordance on the first cell so
              // an SMS code can autofill straight in.
              type="text"
              inputMode={type === 'numeric' ? 'numeric' : 'text'}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              pattern={type === 'numeric' ? '[0-9]*' : '[0-9A-Za-z]*'}
              maxLength={1}
              disabled={disabled}
              value={char}
              aria-label={`${label}, digit ${i + 1} of ${length}`}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => {
                setFocusedIndex(i)
                e.target.select()
              }}
              onBlur={() => setFocusedIndex((cur) => (cur === i ? null : cur))}
              style={{ width: size, height: Math.round(size * 1.15) }}
              className={`peer w-full rounded-2xl border bg-white/[0.03] text-center font-display font-semibold tabular-nums text-white caret-transparent outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                isFocused
                  ? 'border-[#DCF87C]/70 bg-[#DCF87C]/[0.06] shadow-[0_0_0_3px_rgba(220,248,124,0.12)]'
                  : char
                    ? 'border-white/25'
                    : 'border-white/10 hover:border-white/25'
              }`}
            />

            {/* The character, springing in each time it lands. aria-hidden — the
                real value lives on the input for assistive tech. */}
            <div
              className="pointer-events-none absolute inset-0 grid place-items-center"
              style={{ fontSize: Math.round(size * 0.44) }}
              aria-hidden
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {char && (
                  <motion.span
                    key={char + i}
                    className="font-display font-semibold tabular-nums leading-none text-white"
                    initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.4, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: -6 }}
                    transition={
                      reduce
                        ? { duration: 0.12 }
                        : { type: 'spring', stiffness: 620, damping: 26, mass: 0.6 }
                    }
                  >
                    {char}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* The blinking caret, shown only in the focused, empty cell. */}
            {showCaret && (
              <span
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C]"
                style={{
                  width: 2,
                  height: Math.round(size * 0.5),
                  animation: reduce ? undefined : 'code-input-caret 1s steps(1) infinite',
                }}
                aria-hidden
              />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
