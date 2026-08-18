import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

// The controls family had a select, a slider, a knob, a stepper, a toggle — but
// not the control that is famously the hardest of all to build well: a date
// picker. The native one can't be styled, and every design system ends up
// rebuilding it, because a calendar is not a menu — it is a two-dimensional grid
// you navigate like a spreadsheet, with a month that has to slide out from under
// you when you cross its edge. This is that control, hand-built to the WAI-ARIA
// date-grid contract: a real role="grid" of weeks and gridcells, a single roving
// tabindex so Tab lands on the grid once and the arrow keys drive the rest —
// Left/Right a day, Up/Down a week, Home/End the week's ends, PageUp/PageDown a
// month, Shift+PageUp/Down a year — and crossing a month boundary flips the view
// so you can walk from March into April without lifting your hands. On top of
// that honest foundation sits the motion the native control can never have: the
// month grid slides in the direction you travelled, and the lime selection pill
// *glides* from the old day to the new one on a shared layoutId instead of
// blinking. Today wears a ring, the selected day the lime pill. Under
// prefers-reduced-motion the slide and the glide both come off for a plain,
// instant grid that is exactly as usable.

const EASE = [0.16, 1, 0.3, 1] as const

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// A day identity, indifferent to the time of day.
type Ymd = { y: number; m: number; d: number }

function toYmd(date: Date): Ymd {
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() }
}
function ymdToDate({ y, m, d }: Ymd): Date {
  return new Date(y, m, d)
}
function sameYmd(a: Ymd | null, b: Ymd | null): boolean {
  return !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d
}
function addDays(ymd: Ymd, n: number): Ymd {
  const d = ymdToDate(ymd)
  d.setDate(d.getDate() + n)
  return toYmd(d)
}
function addMonths(ymd: Ymd, n: number): Ymd {
  // Clamp the day so 31 Jan + 1 month lands on the last day of February, not
  // spilling into March — the behaviour a person expects from a calendar.
  const y = ymd.y
  const m = ymd.m + n
  const first = new Date(y, m, 1)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return { y: first.getFullYear(), m: first.getMonth(), d: Math.min(ymd.d, daysInMonth) }
}

// The Monday-based column for a JS weekday (0=Sun..6=Sat) → (0=Mon..6=Sun).
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7
}

// Build the 6×7 grid of days for a month view, padded with the tail of the
// previous month and the head of the next so every row is full.
function monthMatrix(year: number, month: number): Ymd[] {
  const first = new Date(year, month, 1)
  const lead = mondayIndex(first.getDay())
  const start = new Date(year, month, 1 - lead)
  const cells: Ymd[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push(toYmd(d))
  }
  return cells
}

/**
 * A hand-built, accessible date picker. Controlled (`value` + `onChange`) or
 * uncontrolled (`defaultValue`). The grid takes a single tab stop; arrows,
 * Home/End, and PageUp/Down drive it, Enter/Space selects. Under
 * prefers-reduced-motion the month slide and the gliding pill come off.
 */
export function Calendar({
  value: controlledValue,
  defaultValue,
  onChange,
  className = '',
}: {
  value?: Date | null
  defaultValue?: Date | null
  onChange?: (date: Date) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const gridId = useId()
  const titleId = useId()

  // "Today" is read once on mount, so the ring is stable for the session.
  const today = useMemo<Ymd>(() => toYmd(new Date()), [])

  const isControlled = controlledValue !== undefined
  const [innerValue, setInnerValue] = useState<Ymd | null>(
    defaultValue ? toYmd(defaultValue) : null,
  )
  const selected: Ymd | null = isControlled
    ? controlledValue
      ? toYmd(controlledValue)
      : null
    : innerValue

  // The month currently on show, and the day that owns the roving tabindex.
  const seed = selected ?? today
  const [view, setView] = useState<{ y: number; m: number }>({ y: seed.y, m: seed.m })
  const [focused, setFocused] = useState<Ymd>(seed)
  // +1 travelled forward in time, -1 back — drives the slide direction.
  const [dir, setDir] = useState(0)
  // Whether a keypress (not a mount) moved focus, so we only steal focus then.
  const shouldFocusRef = useRef(false)

  const cells = useMemo(() => monthMatrix(view.y, view.m), [view.y, view.m])

  const gridRef = useRef<HTMLDivElement>(null)

  // After a keyboard move, pull DOM focus onto the newly focused day so the
  // roving tabindex and the actual focus ring stay in lockstep.
  useEffect(() => {
    if (!shouldFocusRef.current) return
    shouldFocusRef.current = false
    const el = gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')
    el?.focus()
  }, [focused, view])

  const moveTo = useCallback(
    (next: Ymd, travelled: number) => {
      shouldFocusRef.current = true
      setDir(travelled)
      setFocused(next)
      if (next.y !== view.y || next.m !== view.m) setView({ y: next.y, m: next.m })
    },
    [view.y, view.m],
  )

  const commit = useCallback(
    (ymd: Ymd) => {
      if (!isControlled) setInnerValue(ymd)
      onChange?.(ymdToDate(ymd))
    },
    [isControlled, onChange],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: Ymd | null = null
      let travelled = 0
      switch (e.key) {
        case 'ArrowLeft':
          next = addDays(focused, -1)
          travelled = -1
          break
        case 'ArrowRight':
          next = addDays(focused, 1)
          travelled = 1
          break
        case 'ArrowUp':
          next = addDays(focused, -7)
          travelled = -1
          break
        case 'ArrowDown':
          next = addDays(focused, 7)
          travelled = 1
          break
        case 'Home':
          next = addDays(focused, -mondayIndex(ymdToDate(focused).getDay()))
          travelled = -1
          break
        case 'End':
          next = addDays(focused, 6 - mondayIndex(ymdToDate(focused).getDay()))
          travelled = 1
          break
        case 'PageUp':
          next = addMonths(focused, e.shiftKey ? -12 : -1)
          travelled = -1
          break
        case 'PageDown':
          next = addMonths(focused, e.shiftKey ? 12 : 1)
          travelled = 1
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          commit(focused)
          return
        default:
          return
      }
      e.preventDefault()
      if (next) moveTo(next, travelled)
    },
    [focused, moveTo, commit],
  )

  function stepMonth(travelled: number) {
    const nextView = addMonths({ y: view.y, m: view.m, d: 1 }, travelled)
    setDir(travelled)
    setView({ y: nextView.y, m: nextView.m })
    // Keep the focused day in the visible month so the roving stop stays valid.
    setFocused((f) => {
      const daysInMonth = new Date(nextView.y, nextView.m + 1, 0).getDate()
      return { y: nextView.y, m: nextView.m, d: Math.min(f.d, daysInMonth) }
    })
  }

  const slide = reduce ? {} : {
    initial: { opacity: 0, x: dir >= 0 ? 26 : -26 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: dir >= 0 ? -26 : 26 },
    transition: { duration: 0.32, ease: EASE },
  }

  return (
    <div
      className={`w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}
    >
      {/* Header: month title and the two steppers. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="relative h-6 flex-1 overflow-hidden text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h3
              key={`${view.y}-${view.m}`}
              id={titleId}
              aria-live="polite"
              className="font-display text-base font-semibold tracking-tight text-white"
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: dir >= 0 ? 10 : -10 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, y: dir >= 0 ? -10 : 10 },
                    transition: { duration: 0.28, ease: EASE },
                  })}
            >
              {MONTHS[view.m]} {view.y}
            </motion.h3>
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Weekday column headers. */}
      <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden>
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-white/35">
            {w.slice(0, 2)}
          </div>
        ))}
      </div>

      {/* The day grid. One tab stop; the arrows do the rest. */}
      <div
        ref={gridRef}
        role="grid"
        aria-labelledby={titleId}
        id={gridId}
        onKeyDown={onKeyDown}
        className="relative overflow-hidden"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={`${view.y}-${view.m}`} className="grid grid-cols-7 gap-1" role="presentation" {...slide}>
            {cells.map((cell) => {
              const inMonth = cell.m === view.m
              const isSelected = sameYmd(cell, selected)
              const isToday = sameYmd(cell, today)
              const isFocused = sameYmd(cell, focused)
              return (
                <div key={`${cell.y}-${cell.m}-${cell.d}`} role="gridcell" className="relative">
                  <button
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused || undefined}
                    aria-selected={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${cell.d} ${MONTHS[cell.m]} ${cell.y}`}
                    onClick={() => {
                      setFocused(cell)
                      if (cell.m !== view.m || cell.y !== view.y) setView({ y: cell.y, m: cell.m })
                      commit(cell)
                    }}
                    className={`relative z-10 grid h-9 w-full place-items-center rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C] ${
                      isSelected
                        ? 'font-semibold text-black'
                        : inMonth
                          ? 'text-white/85 hover:bg-white/10'
                          : 'text-white/25 hover:bg-white/5'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId={reduce ? undefined : `cal-selected-${view.y}-${view.m}`}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="absolute inset-0 -z-10 rounded-lg bg-[#DCF87C]"
                      />
                    )}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#DCF87C]" aria-hidden />
                    )}
                    {cell.d}
                  </button>
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
