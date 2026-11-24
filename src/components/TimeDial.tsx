import { useCallback, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// TimeDial — a hand-built analog time picker, the honest companion to the
// Calendar (date) in the controls family: a date picker was there, a time
// picker never was. A round face you drag a hand around to set the hour, then
// the minute, with a digital readout whose two segments are real spinbuttons.
//
// Honest about what it is: the face is a pointer convenience and is aria-hidden;
// the accessible control is the readout — two role="spinbutton" segments with
// the full value contract and arrow/Home/End/type-a-digit keyboard, plus a
// meridiem toggle in 12-hour mode — so a keyboard and a screen reader get a
// real, operable time input, not a picture of a clock. One source of truth: the
// hour (0-23) and minute (0-59) live in one place, and the hand, the ticks, the
// readout and the live announcement all read off it, so they can never drift.
//
// Reduced motion: the hand jumps rather than springing, and the picked-tick
// pulse is dropped — the control stays exactly as usable, only still.

export interface TimeValue {
  /** 0-23. */
  hour: number
  /** 0-59. */
  minute: number
}

export interface TimeDialProps {
  value?: TimeValue
  defaultValue?: TimeValue
  onChange?: (value: TimeValue) => void
  /** Lay 24 hours on the face instead of 12 + an AM/PM toggle. */
  hour24?: boolean
  /** Minute granularity for dragging and the arrow keys. Default 1. */
  minuteStep?: number
  /** After the hour is set by dragging, hand editing to the minute (Material
   *  two-step behaviour). Default true; keyboard never auto-advances. */
  autoAdvance?: boolean
  className?: string
}

type Mode = 'hour' | 'minute'

const VIEW = 260
const C = VIEW / 2
const R_TICK = 104 // radius the numbers sit on
const R_HAND = 88 // length of the hand

function clampValue(v: TimeValue): TimeValue {
  const hour = ((Math.round(v.hour) % 24) + 24) % 24
  const minute = ((Math.round(v.minute) % 60) + 60) % 60
  return { hour, minute }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Spoken/shown 12-hour pieces from a 0-23 hour. */
function to12(hour: number): { h12: number; meridiem: 'AM' | 'PM' } {
  const meridiem = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return { h12, meridiem }
}

function announce(v: TimeValue, hour24: boolean): string {
  if (hour24) return `${pad(v.hour)}:${pad(v.minute)}`
  const { h12, meridiem } = to12(v.hour)
  return `${h12}:${pad(v.minute)} ${meridiem}`
}

export function TimeDial({
  value,
  defaultValue,
  onChange,
  hour24 = false,
  minuteStep = 1,
  autoAdvance = true,
  className,
}: TimeDialProps) {
  const reduce = useReducedMotion()
  const controlled = value != null
  const [inner, setInner] = useState<TimeValue>(() =>
    clampValue(value ?? defaultValue ?? { hour: 10, minute: 10 }),
  )
  const current = controlled ? clampValue(value!) : inner
  const [mode, setMode] = useState<Mode>('hour')
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const set = useCallback(
    (next: TimeValue) => {
      const v = clampValue(next)
      if (!controlled) setInner(v)
      onChange?.(v)
    },
    [controlled, onChange],
  )

  const setHour = useCallback((h: number) => set({ ...current, hour: h }), [current, set])
  const setMinute = useCallback((m: number) => set({ ...current, minute: m }), [current, set])

  // --- pointer → value -----------------------------------------------------
  // Angle measured clockwise from the top (12 o'clock), 0-360.
  const angleFromEvent = useCallback((clientX: number, clientY: number): number | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return null
    const x = ((clientX - rect.left) / rect.width) * VIEW
    const y = ((clientY - rect.top) / rect.height) * VIEW
    const a = (Math.atan2(x - C, -(y - C)) * 180) / Math.PI
    return (a + 360) % 360
  }, [])

  const applyAngle = useCallback(
    (angle: number) => {
      if (mode === 'hour') {
        if (hour24) {
          const h = Math.round(angle / 15) % 24
          setHour(h)
        } else {
          // Keep the chosen AM/PM, only move the 12-hour position.
          const pos = Math.round(angle / 30) % 12 // 0 == 12 o'clock
          const isPM = current.hour >= 12
          const h = (pos % 12) + (isPM ? 12 : 0)
          setHour(h)
        }
      } else {
        const raw = Math.round(angle / 6) % 60
        const step = Math.max(1, Math.round(minuteStep))
        const snapped = (Math.round(raw / step) * step) % 60
        setMinute(snapped)
      }
    },
    [mode, hour24, current.hour, minuteStep, setHour, setMinute],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.preventDefault()
      const angle = angleFromEvent(e.clientX, e.clientY)
      if (angle == null) return
      dragging.current = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture unsupported — drag still works via move events */
      }
      applyAngle(angle)
    },
    [angleFromEvent, applyAngle],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging.current) return
      const angle = angleFromEvent(e.clientX, e.clientY)
      if (angle != null) applyAngle(angle)
    },
    [angleFromEvent, applyAngle],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging.current) return
      dragging.current = false
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* nothing captured */
      }
      // Material two-step: picking the hour hands off to the minute.
      if (mode === 'hour' && autoAdvance) setMode('minute')
    },
    [mode, autoAdvance],
  )

  // --- the face ------------------------------------------------------------
  const handAngle = useMemo(() => {
    if (mode === 'hour') return hour24 ? current.hour * 15 : (current.hour % 12) * 30
    return current.minute * 6
  }, [mode, hour24, current.hour, current.minute])

  const ticks = useMemo(() => {
    if (mode === 'minute') {
      // Label every 5 minutes; a short mark on the ones between.
      return Array.from({ length: 60 }, (_, i) => {
        const angle = i * 6
        const rad = (angle * Math.PI) / 180
        const major = i % 5 === 0
        return {
          key: `m${i}`,
          major,
          label: major ? pad(i) : '',
          x: C + Math.sin(rad) * R_TICK,
          y: C - Math.cos(rad) * R_TICK,
          active: current.minute === i,
        }
      })
    }
    const count = hour24 ? 24 : 12
    const span = 360 / count
    return Array.from({ length: count }, (_, i) => {
      const angle = i * span
      const rad = (angle * Math.PI) / 180
      const labelNum = hour24 ? i : i === 0 ? 12 : i
      const activeHour = hour24 ? current.hour === i : current.hour % 12 === i
      return {
        key: `h${i}`,
        major: true,
        label: hour24 ? pad(labelNum) : String(labelNum),
        x: C + Math.sin(rad) * R_TICK,
        y: C - Math.cos(rad) * R_TICK,
        active: activeHour,
      }
    })
  }, [mode, hour24, current.hour, current.minute])

  // --- keyboard on the readout spinbuttons ---------------------------------
  const typeBuffer = useRef<{ field: Mode; digits: string; at: number }>({
    field: 'hour',
    digits: '',
    at: 0,
  })

  const stepHour = (delta: number) => setHour((current.hour + delta + 24) % 24)
  const stepMinute = (delta: number) => {
    const step = Math.max(1, Math.round(minuteStep))
    setMinute((current.minute + delta * step + 60) % 60)
  }

  const onReadoutKey = (field: Mode) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        field === 'hour' ? stepHour(1) : stepMinute(1)
        return
      case 'ArrowDown':
        e.preventDefault()
        field === 'hour' ? stepHour(-1) : stepMinute(-1)
        return
      case 'ArrowRight':
      case 'ArrowLeft':
        e.preventDefault()
        setMode(field === 'hour' ? 'minute' : 'hour')
        return
      case 'Home':
        e.preventDefault()
        field === 'hour' ? setHour(0) : setMinute(0)
        return
      case 'End':
        e.preventDefault()
        field === 'hour' ? setHour(23) : setMinute(59)
        return
      default:
        break
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      const now = performance.now()
      const buf = typeBuffer.current
      const fresh = buf.field !== field || now - buf.at > 1000
      const digits = (fresh ? '' : buf.digits) + e.key
      const n = parseInt(digits.slice(-2), 10)
      if (field === 'hour') {
        const max = hour24 ? 23 : 12
        if (n <= max) {
          const h = hour24 ? n : n === 12 ? (current.hour >= 12 ? 12 : 0) : current.hour >= 12 ? n + 12 : n
          setHour(((h % 24) + 24) % 24)
        }
      } else if (n <= 59) {
        setMinute(n)
      }
      typeBuffer.current = { field, digits: digits.slice(-2), at: now }
    }
  }

  const { h12, meridiem } = to12(current.hour)
  const hourText = hour24 ? pad(current.hour) : String(h12)
  const spoken = announce(current, hour24)

  const segBase =
    'rounded-xl px-2 py-1 font-display text-5xl font-bold tabular-nums leading-none tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] sm:text-6xl'

  return (
    <div
      role="group"
      aria-label={`Time picker, currently ${spoken}`}
      className={`flex w-full max-w-sm flex-col items-center gap-7 ${className ?? ''}`}
    >
      {/* Digital readout — the real, accessible control. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          role="spinbutton"
          aria-label="Hours"
          aria-valuemin={hour24 ? 0 : 1}
          aria-valuemax={hour24 ? 23 : 12}
          aria-valuenow={hour24 ? current.hour : h12}
          aria-valuetext={`${hourText} hours`}
          onKeyDown={onReadoutKey('hour')}
          onClick={() => setMode('hour')}
          className={`${segBase} ${
            mode === 'hour' ? 'bg-[#DCF87C]/15 text-[#DCF87C]' : 'text-white hover:bg-white/5'
          }`}
        >
          {hourText}
        </button>
        <span aria-hidden className="font-display text-5xl font-bold leading-none text-white/35 sm:text-6xl">
          :
        </span>
        <button
          type="button"
          role="spinbutton"
          aria-label="Minutes"
          aria-valuemin={0}
          aria-valuemax={59}
          aria-valuenow={current.minute}
          aria-valuetext={`${pad(current.minute)} minutes`}
          onKeyDown={onReadoutKey('minute')}
          onClick={() => setMode('minute')}
          className={`${segBase} ${
            mode === 'minute' ? 'bg-[#DCF87C]/15 text-[#DCF87C]' : 'text-white hover:bg-white/5'
          }`}
        >
          {pad(current.minute)}
        </button>
        {!hour24 && (
          <div className="ml-3 flex flex-col gap-1">
            {(['AM', 'PM'] as const).map((m) => {
              const on = meridiem === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  aria-label={m === 'AM' ? 'Before noon' : 'Afternoon'}
                  onClick={() => {
                    const base = current.hour % 12
                    setHour(m === 'PM' ? base + 12 : base)
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                    on
                      ? 'bg-[#DCF87C] text-black'
                      : 'border border-white/10 text-white/55 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* The clock face — a pointer convenience, so it is decorative. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        aria-hidden
        className="h-60 w-60 touch-none select-none"
        style={{ cursor: 'pointer' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <circle cx={C} cy={C} r={C - 4} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.10)" />
        {/* Hand */}
        <motion.g
          style={{ originX: `${C}px`, originY: `${C}px` }}
          animate={{ rotate: handAngle }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 28 }}
        >
          <line
            x1={C}
            y1={C}
            x2={C}
            y2={C - R_HAND}
            stroke="#DCF87C"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={C} cy={C - R_HAND} r={16} fill="#DCF87C" />
        </motion.g>
        <circle cx={C} cy={C} r={4} fill="#DCF87C" />
        {/* Ticks / numbers on top, so the active one shows through the knob. */}
        {ticks.map((t) =>
          t.label ? (
            <text
              key={t.key}
              x={t.x}
              y={t.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="tabular-nums"
              fontSize={t.active ? 15 : 13}
              fontWeight={t.active ? 700 : 500}
              fill={t.active ? '#0A0A0A' : 'rgba(255,255,255,0.65)'}
            >
              {t.label}
            </text>
          ) : (
            <circle key={t.key} cx={t.x} cy={t.y} r={1.4} fill="rgba(255,255,255,0.28)" />
          ),
        )}
      </svg>

      {/* Mode hint + a live mirror of the value for assistive tech. */}
      <p className="text-xs text-white/40">
        {mode === 'hour' ? 'Drag the hand to the hour, or type' : 'Drag the hand to the minute, or type'}
      </p>
      <span className="sr-only" aria-live="polite">
        {spoken}
      </span>
    </div>
  )
}

export default TimeDial
