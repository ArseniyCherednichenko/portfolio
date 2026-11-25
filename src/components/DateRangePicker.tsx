import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// The controls family has a single-date Calendar and a TimeDial, but the date
// control people actually fight with most is the *range*: a check-in and a
// check-out, a from and a to. It is the Calendar's harder sibling, because a
// range is not one selected cell but a span, and the span is the whole point —
// you have to feel it fill as you reach for the far end, and the band that fills
// it has to read as one continuous bar across a grid built from gapped cells,
// which is the detail every lazy version gets wrong (it tints each day as an
// island and the eye never joins them). This is that control, hand-built on the
// same WAI-ARIA date-grid contract as the Calendar: a real role="grid", a single
// roving tabindex so Tab lands once and the arrow keys drive the rest
// (Left/Right a day, Up/Down a week, Home/End the week's ends, PageUp/Down a
// month, Shift for a year), and crossing a month edge flips the view so you can
// drag a range from March into April without lifting your hands. On top of that
// honest grid sits the motion the native control can never have: the month
// slides in the direction you travelled, the two endpoints pop as lime pills,
// and — the part that makes it feel alive — the moment a start is set the whole
// span between it and wherever your pointer or focus now rests tints as a live
// preview, so you watch the stay grow night by night before you commit the far
// end. Under prefers-reduced-motion the slide and the pops come off for a plain,
// instant grid that is exactly as usable.

const EASE = [0.16, 1, 0.3, 1] as const

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// A day identity, indifferent to the time of day.
type Ymd = { y: number; m: number; d: number }

export interface DateRange {
  start: Date
  end: Date
}

function toYmd(date: Date): Ymd {
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() }
}
function ymdToDate({ y, m, d }: Ymd): Date {
  return new Date(y, m, d)
}
function sameYmd(a: Ymd | null, b: Ymd | null): boolean {
  return !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d
}
// Negative if a is before b, 0 if the same day, positive if after.
function cmpYmd(a: Ymd, b: Ymd): number {
  return ymdToDate(a).getTime() - ymdToDate(b).getTime()
}
function addDays(ymd: Ymd, n: number): Ymd {
  const d = ymdToDate(ymd)
  d.setDate(d.getDate() + n)
  return toYmd(d)
}
function addMonths(ymd: Ymd, n: number): Ymd {
  const first = new Date(ymd.y, ymd.m + n, 1)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return { y: first.getFullYear(), m: first.getMonth(), d: Math.min(ymd.d, daysInMonth) }
}
// Whole nights between two ordered days.
function nightsBetween(a: Ymd, b: Ymd): number {
  return Math.round((ymdToDate(b).getTime() - ymdToDate(a).getTime()) / 86_400_000)
}

// The Monday-based column for a JS weekday (0=Sun..6=Sat) → (0=Mon..6=Sun).
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7
}

// Build the 6×7 grid of days for a month view, padded with the tail of the
// previous month and the head of the next so every row is full.
function monthMatrix(year: number, month: number): Ymd[] {
  const lead = mondayIndex(new Date(year, month, 1).getDay())
  const start = new Date(year, month, 1 - lead)
  const cells: Ymd[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push(toYmd(d))
  }
  return cells
}

// Order two day identities low→high, shielding the rest of the component from
// having to care which endpoint was clicked first.
function order(a: Ymd, b: Ymd): { lo: Ymd; hi: Ymd } {
  return cmpYmd(a, b) <= 0 ? { lo: a, hi: b } : { lo: b, hi: a }
}

type Internal = { start: Ymd | null; end: Ymd | null }

function fmt(ymd: Ymd): string {
  return `${ymd.d} ${MONTHS[ymd.m].slice(0, 3)} ${ymd.y}`
}

/**
 * A hand-built, accessible date-range picker. Controlled (`value` + `onChange`)
 * or uncontrolled (`defaultValue`). The grid takes a single tab stop; arrows,
 * Home/End and PageUp/Down drive it, Enter/Space sets an endpoint. The first
 * commit sets the start, the second the end (ordered automatically); a third
 * starts a fresh range. While only a start is set, the span to the hovered or
 * focused day previews live. Under prefers-reduced-motion the month slide and
 * the endpoint pops come off.
 */
export function DateRangePicker({
  value: controlledValue,
  defaultValue,
  onChange,
  className = '',
}: {
  value?: DateRange | null
  defaultValue?: DateRange | null
  onChange?: (range: DateRange) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const gridId = useId()
  const titleId = useId()

  const today = useMemo<Ymd>(() => toYmd(new Date()), [])

  const isControlled = controlledValue !== undefined
  const [inner, setInner] = useState<Internal>(() =>
    defaultValue
      ? { start: toYmd(defaultValue.start), end: toYmd(defaultValue.end) }
      : { start: null, end: null },
  )
  const range: Internal = isControlled
    ? controlledValue
      ? { start: toYmd(controlledValue.start), end: toYmd(controlledValue.end) }
      : { start: null, end: null }
    : inner

  // The month on show and the day holding the roving tabindex.
  const seed = range.start ?? today
  const [view, setView] = useState<{ y: number; m: number }>({ y: seed.y, m: seed.m })
  const [focused, setFocused] = useState<Ymd>(seed)
  const [hovered, setHovered] = useState<Ymd | null>(null)
  const [dir, setDir] = useState(0)
  const shouldFocusRef = useRef(false)

  const cells = useMemo(() => monthMatrix(view.y, view.m), [view.y, view.m])
  const gridRef = useRef<HTMLDivElement>(null)

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

  // Push a committed range outward, honouring controlled vs uncontrolled.
  const emit = useCallback(
    (next: Internal) => {
      if (!isControlled) setInner(next)
      if (next.start && next.end) {
        const { lo, hi } = order(next.start, next.end)
        onChange?.({ start: ymdToDate(lo), end: ymdToDate(hi) })
      }
    },
    [isControlled, onChange],
  )

  // The selection state machine: open a range, close it, or start a fresh one.
  const commit = useCallback(
    (ymd: Ymd) => {
      if (!range.start || (range.start && range.end)) {
        emit({ start: ymd, end: null })
      } else {
        const { lo, hi } = order(range.start, ymd)
        emit({ start: lo, end: hi })
      }
    },
    [range.start, range.end, emit],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: Ymd | null = null
      let travelled = 0
      switch (e.key) {
        case 'ArrowLeft':
          next = addDays(focused, -1); travelled = -1; break
        case 'ArrowRight':
          next = addDays(focused, 1); travelled = 1; break
        case 'ArrowUp':
          next = addDays(focused, -7); travelled = -1; break
        case 'ArrowDown':
          next = addDays(focused, 7); travelled = 1; break
        case 'Home':
          next = addDays(focused, -mondayIndex(ymdToDate(focused).getDay())); travelled = -1; break
        case 'End':
          next = addDays(focused, 6 - mondayIndex(ymdToDate(focused).getDay())); travelled = 1; break
        case 'PageUp':
          next = addMonths(focused, e.shiftKey ? -12 : -1); travelled = -1; break
        case 'PageDown':
          next = addMonths(focused, e.shiftKey ? 12 : 1); travelled = 1; break
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
    setFocused((f) => {
      const daysInMonth = new Date(nextView.y, nextView.m + 1, 0).getDate()
      return { y: nextView.y, m: nextView.m, d: Math.min(f.d, daysInMonth) }
    })
  }

  // The span to paint right now. A closed range paints itself; an open range
  // (start set, no end) previews to wherever the pointer or focus rests, so the
  // stay visibly grows before the far end is committed.
  const span: { lo: Ymd; hi: Ymd } | null = useMemo(() => {
    if (range.start && range.end) return order(range.start, range.end)
    if (range.start) {
      const far = hovered ?? focused
      return order(range.start, far)
    }
    return null
  }, [range.start, range.end, hovered, focused])

  const isOpen = !!range.start && !range.end
  const nights = span ? nightsBetween(span.lo, span.hi) : 0

  const slide = reduce ? {} : {
    initial: { opacity: 0, x: dir >= 0 ? 26 : -26 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: dir >= 0 ? -26 : 26 },
    transition: { duration: 0.32, ease: EASE },
  }

  return (
    <div className={`w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
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
        aria-multiselectable
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHovered(null)}
        className="relative overflow-hidden"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={`${view.y}-${view.m}`} className="grid grid-cols-7 gap-1" role="presentation" {...slide}>
            {cells.map((cell, i) => {
              const inMonth = cell.m === view.m
              const isToday = sameYmd(cell, today)
              const isFocused = sameYmd(cell, focused)
              const isStart = !!span && sameYmd(cell, span.lo)
              const isEnd = !!span && sameYmd(cell, span.hi)
              const isEndpoint = isStart || isEnd
              const inSpan = !!span && cmpYmd(cell, span.lo) >= 0 && cmpYmd(cell, span.hi) <= 0
              const single = !!span && sameYmd(span.lo, span.hi)
              const col = i % 7
              // The band fills the whole cell and bridges the 4px gap toward its
              // neighbours in-span, except at a true endpoint or a row edge, so a
              // multi-day span reads as one continuous bar rather than islands.
              const bandSides =
                !inSpan || single
                  ? ''
                  : [
                      isStart || col === 0 ? 'left-0 rounded-l-lg' : '-left-[3px]',
                      isEnd || col === 6 ? 'right-0 rounded-r-lg' : '-right-[3px]',
                    ].join(' ')
              return (
                <div key={`${cell.y}-${cell.m}-${cell.d}`} role="gridcell" className="relative">
                  {/* The connective tissue of the range: a tint under the whole
                      span, rounded only at its real ends. */}
                  {inSpan && !single && !isEndpoint && (
                    <span className={`absolute inset-y-[3px] z-0 bg-[#DCF87C]/15 ${bandSides}`} aria-hidden />
                  )}
                  {/* The faint shoulders either side of an endpoint, so the pill
                      sits on a continuous bar rather than floating off it. */}
                  {inSpan && !single && isStart && (
                    <span className="absolute inset-y-[3px] left-1/2 -right-[3px] z-0 bg-[#DCF87C]/15" aria-hidden />
                  )}
                  {inSpan && !single && isEnd && (
                    <span className="absolute inset-y-[3px] -left-[3px] right-1/2 z-0 bg-[#DCF87C]/15" aria-hidden />
                  )}
                  <button
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused || undefined}
                    aria-selected={isEndpoint || undefined}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${cell.d} ${MONTHS[cell.m]} ${cell.y}${
                      isStart && isEnd ? ', selected date' : isStart ? ', range start' : isEnd ? ', range end' : ''
                    }`}
                    onClick={() => {
                      setFocused(cell)
                      if (cell.m !== view.m || cell.y !== view.y) setView({ y: cell.y, m: cell.m })
                      commit(cell)
                    }}
                    onPointerEnter={() => isOpen && setHovered(cell)}
                    onFocus={() => isOpen && setHovered(cell)}
                    className={`relative z-10 grid h-9 w-full place-items-center rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C] ${
                      isEndpoint
                        ? 'font-semibold text-black'
                        : inSpan
                          ? 'text-white'
                          : inMonth
                            ? 'text-white/85 hover:bg-white/10'
                            : 'text-white/25 hover:bg-white/5'
                    }`}
                  >
                    {isEndpoint && (
                      <motion.span
                        {...(reduce
                          ? {}
                          : { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.22, ease: EASE } })}
                        className="absolute inset-0 -z-10 rounded-lg bg-[#DCF87C]"
                        aria-hidden
                      />
                    )}
                    {isToday && !isEndpoint && (
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

      {/* The readout: the chosen stay, stated in plain words, and a live night
          count so the span means something as it grows. */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs" aria-live="polite">
        <span className="text-white/60">
          {span ? (
            <>
              <span className="tabular-nums text-white/85">{fmt(span.lo)}</span>
              <span className="mx-1.5 text-white/30">&ndash;</span>
              <span className="tabular-nums text-white/85">{fmt(span.hi)}</span>
            </>
          ) : (
            <span className="text-white/40">Pick a start date, then an end</span>
          )}
        </span>
        {span && (
          <span className="shrink-0 rounded-full border border-[#DCF87C]/30 px-2 py-0.5 font-medium text-[#DCF87C]">
            {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
        )}
      </div>
    </div>
  )
}
