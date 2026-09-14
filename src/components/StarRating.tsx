import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// The controls family had the pickers the platform ships badly (Select,
// Combobox, NumberField, the file Dropzone) and the ones it never shipped at
// all. This is one of the latter: a star rating. HTML has no rating input, so
// every product hand-rolls one, and most stop at "click a star" — no half
// steps, no keyboard, no hover preview, no reward for the tap. This is the
// control done properly.
//
// It is a real WAI-ARIA slider: the whole strip is one focusable
// role="slider" (a single tab stop, not five), the arrows nudge the value by
// the step (half a star when half steps are on), Home/End jump to the bounds,
// PageUp/Down move a whole star, and 0 or Backspace clears it — and it carries
// a spoken aria-valuetext ("3.5 out of 5 — Great"), so a screen reader hears
// the meaning, not a bare number. The pointer previews as it moves (the fill
// follows the cursor, snapping to the near or far half of the star under it)
// and commits on click.
//
// The reward is the point of the piece: on commit the filled stars pop on a
// staggered spring and a small ring of lime sparks bursts from the last one —
// the tiny moment of delight a real rating earns. Under prefers-reduced-motion
// none of that plays: the fill just lands, and the control stays exactly as
// usable, keyboard and all.

export interface StarRatingProps {
  /** Controlled value, in stars (supports halves when `allowHalf`). */
  value?: number
  /** Initial value when uncontrolled. Defaults to 0. */
  defaultValue?: number
  onChange?: (value: number) => void
  /** How many stars. Default 5. */
  count?: number
  /** Allow half-star precision (pointer and keyboard). Default true. */
  allowHalf?: boolean
  /** Show the value, take no input, expose as an image. Default false. */
  readOnly?: boolean
  /** Fully disable interaction (still shows the value). */
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** Accessible name for the control. */
  label?: string
  /**
   * Optional word per whole-star value, index 0 = 1 star … up to `count`
   * stars. When given, the matching word is read aloud (aria-valuetext) and
   * shown beside the stars. Purely descriptive labels of a rating value — no
   * claim about anyone.
   */
  labels?: readonly string[]
  className?: string
}

const SIZES = {
  sm: { star: 18, gap: 3, text: 'text-xs' },
  md: { star: 28, gap: 5, text: 'text-sm' },
  lg: { star: 40, gap: 7, text: 'text-base' },
} as const

// A five-point star path on a 24×24 grid, drawn once and reused per star.
const STAR_D =
  'M12 2.4l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.7l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.94z'

// Deterministic spark directions around the star (no Math.random on the hot
// path, so the burst reads the same each time and never re-seeds on rerender).
const SPARKS = Array.from({ length: 7 }, (_, i) => {
  const a = (-90 + (i / 7) * 360) * (Math.PI / 180)
  return { x: Math.cos(a), y: Math.sin(a) }
})

/**
 * A star rating control.
 *
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). A real
 * `role="slider"` — one tab stop, arrow/Home/End/Page navigable, 0 to clear —
 * with half-star pointer and keyboard precision. On commit the fill pops and a
 * small spark burst fires; under prefers-reduced-motion the value simply lands.
 */
export function StarRating({
  value: controlledValue,
  defaultValue = 0,
  onChange,
  count = 5,
  allowHalf = true,
  readOnly = false,
  disabled = false,
  size = 'md',
  label = 'Rating',
  labels,
  className = '',
}: StarRatingProps) {
  const reduce = useReducedMotion()
  const isControlled = controlledValue !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const value = clampStep(isControlled ? (controlledValue as number) : uncontrolled, count, allowHalf)

  const step = allowHalf ? 0.5 : 1
  const interactive = !readOnly && !disabled

  // The value the pointer is previewing, or null when the cursor is away.
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value

  // A commit token: bumps on every value change so the pop/burst replays even
  // when the same star count is chosen twice. Held null until the first commit
  // so the control does not flourish on mount.
  const [commit, setCommit] = useState<{ token: number; value: number } | null>(null)
  const tokenRef = useRef(0)

  const rowRef = useRef<HTMLDivElement>(null)

  const setValue = useCallback(
    (next: number) => {
      const v = clampStep(next, count, allowHalf)
      if (v !== value) {
        if (!isControlled) setUncontrolled(v)
        onChange?.(v)
      }
      // Flourish on any deliberate commit (even a repeat of the same value),
      // but never for clearing to zero.
      if (v > 0) setCommit({ token: ++tokenRef.current, value: v })
    },
    [allowHalf, count, isControlled, onChange, value],
  )

  const geom = SIZES[size]

  // Map a pointer x within a star to the near (half) or far (whole) value.
  function valueAt(e: ReactPointerEvent, index: number) {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    if (allowHalf && frac <= 0.5) return index + 0.5
    return index + 1
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!interactive) return
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        setValue(value + step)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        setValue(value - step)
        break
      case 'PageUp':
        e.preventDefault()
        setValue(value + 1)
        break
      case 'PageDown':
        e.preventDefault()
        setValue(value - 1)
        break
      case 'Home':
        e.preventDefault()
        setValue(0)
        break
      case 'End':
        e.preventDefault()
        setValue(count)
        break
      case '0':
      case 'Backspace':
      case 'Delete':
        e.preventDefault()
        if (!isControlled) setUncontrolled(0)
        onChange?.(0)
        break
      default: {
        // Number keys 1..9 set that many whole stars.
        const n = Number(e.key)
        if (Number.isInteger(n) && n >= 1 && n <= count) {
          e.preventDefault()
          setValue(n)
        }
      }
    }
  }

  const word = wordFor(display, labels)
  const valueText = `${format(display)} out of ${count}${word ? ` — ${word}` : ''}`

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        ref={rowRef}
        role={readOnly ? 'img' : 'slider'}
        aria-label={label}
        aria-readonly={readOnly || undefined}
        aria-disabled={disabled || undefined}
        aria-valuemin={readOnly ? undefined : 0}
        aria-valuemax={readOnly ? undefined : count}
        aria-valuenow={readOnly ? undefined : value}
        aria-valuetext={valueText}
        aria-roledescription={readOnly ? undefined : 'star rating'}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerLeave={() => interactive && setHover(null)}
        className={`relative inline-flex outline-none ${
          interactive ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black' : ''
        } rounded-lg`}
        style={{ gap: geom.gap }}
      >
        {Array.from({ length: count }, (_, i) => {
          const fill = Math.max(0, Math.min(1, display - i))
          const filled = fill > 0
          // Newly-lit stars pop on commit; only when this commit's value covers
          // the star and motion is allowed.
          const popping =
            !reduce && commit !== null && commit.value >= i + (allowHalf ? 0.5 : 1)
          const isLast = commit !== null && Math.ceil(commit.value) === i + 1
          return (
            <motion.span
              key={i}
              onPointerMove={interactive ? (e) => setHover(valueAt(e, i)) : undefined}
              onPointerDown={
                interactive
                  ? (e) => {
                      e.preventDefault()
                      setValue(valueAt(e, i))
                    }
                  : undefined
              }
              className="relative inline-flex"
              style={{ width: geom.star, height: geom.star, transformOrigin: '50% 50%' }}
              animate={popping ? { scale: [1, 1.3, 0.96, 1] } : { scale: 1 }}
              transition={
                popping
                  ? { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.05, 0.25) }
                  : { duration: 0 }
              }
            >
              {/* Empty base. */}
              <svg
                viewBox="0 0 24 24"
                width={geom.star}
                height={geom.star}
                aria-hidden
                className="absolute inset-0 text-white/20"
              >
                <path
                  d={STAR_D}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                />
              </svg>
              {/* Filled overlay, clipped to the fill fraction by an overflow
                  box whose width tracks `fill` — reliable everywhere, no SVG
                  clip-path quirks. The inner svg keeps the full star width so
                  it is only ever cropped, never squashed. */}
              {filled && (
                <span
                  aria-hidden
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={geom.star}
                    height={geom.star}
                    className="block max-w-none"
                    style={{ filter: 'drop-shadow(0 1px 5px rgba(220,248,124,0.45))' }}
                  >
                    <path
                      d={STAR_D}
                      fill="#DCF87C"
                      stroke="#DCF87C"
                      strokeWidth={1.2}
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}

              {/* Spark burst from the last-lit star on commit. */}
              {!reduce && (
                <AnimatePresence>
                  {isLast && commit && (
                    <span
                      key={commit.token}
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2"
                    >
                      {SPARKS.map((s, k) => (
                        <motion.span
                          key={k}
                          className="absolute h-1 w-1 rounded-full bg-[#DCF87C]"
                          initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
                          animate={{
                            opacity: 0,
                            x: s.x * geom.star * 0.95,
                            y: s.y * geom.star * 0.95,
                            scale: 0.3,
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      ))}
                    </span>
                  )}
                </AnimatePresence>
              )}
            </motion.span>
          )
        })}
      </div>

      {/* Live numeric + word readout. On the interactive control it doubles as
          the polite announcement region. */}
      <span
        className={`min-w-[2.5rem] tabular-nums text-white/70 ${geom.text}`}
        aria-live={interactive ? 'polite' : undefined}
      >
        <span className="font-semibold text-white/90">{format(display)}</span>
        {word && <span className="ml-2 text-white/50">{word}</span>}
      </span>
    </div>
  )
}

/** Clamp to [0, count] and snap to the step grid. */
function clampStep(v: number, count: number, allowHalf: boolean): number {
  if (!Number.isFinite(v)) return 0
  const clamped = Math.max(0, Math.min(count, v))
  const grid = allowHalf ? Math.round(clamped * 2) / 2 : Math.round(clamped)
  return grid
}

/** A tidy string: whole numbers show no decimal, halves show ".5". */
function format(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** The label for a value: round up so 3.5 reads as the 4-star word. */
function wordFor(v: number, labels?: readonly string[]): string | undefined {
  if (!labels || v <= 0) return undefined
  const i = Math.ceil(v) - 1
  return labels[Math.min(i, labels.length - 1)]
}
