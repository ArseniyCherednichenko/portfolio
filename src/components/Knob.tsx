import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// The knob sweeps across a 270° arc, leaving a 90° dead zone at the bottom so
// the pointer has a clear "floor" and the min/max ends read as distinct.
const SWEEP = 270
const START = -135 // degrees from vertical for the minimum value
// Pixels of vertical drag that traverse the full range. Dragging up raises the
// value, down lowers it — the same gesture a hardware knob invites.
const DRAG_RANGE = 200

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function snap(value: number, min: number, step: number) {
  if (step <= 0) return value
  return Math.round((value - min) / step) * step + min
}

// Point on the arc for a 0..1 fraction, in the knob's local SVG space (viewBox
// 0 0 100 100, centre 50,50, radius r). Angles run clockwise from START.
function pointOnArc(frac: number, r: number) {
  const angle = ((START + frac * SWEEP) * Math.PI) / 180
  return {
    x: 50 + r * Math.sin(angle),
    y: 50 - r * Math.cos(angle),
  }
}

// SVG arc path from fraction a to fraction b along the value ring.
function arcPath(a: number, b: number, r: number) {
  const p0 = pointOnArc(a, r)
  const p1 = pointOnArc(b, r)
  const large = (b - a) * SWEEP > 180 ? 1 : 0
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`
}

/**
 * A tactile rotary control — a knob you turn the way you would a hardware dial.
 * Drag up or down to sweep the pointer around a 270° arc, spin the mouse wheel
 * for fine steps, or focus it and use the arrow / Page / Home / End keys. A lit
 * ring tracks the value and the indicator swells while it is held.
 *
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). It is a
 * real `role="slider"` carrying aria-valuemin/max/now/text and is fully
 * keyboard-driven. Under prefers-reduced-motion the spin and swell come off; it
 * stays a plain, usable dial that still reads and responds.
 */
export function Knob({
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  value: controlledValue,
  onChange,
  label = 'Value',
  format = (v: number) => String(Math.round(v)),
  size = 96,
  className = '',
}: {
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  /** Controlled value. When set, changes are reported via onChange only. */
  value?: number
  onChange?: (value: number) => void
  /** Accessible name for the dial. */
  label?: string
  /** Formats the value for the readout and aria-valuetext. */
  format?: (value: number) => string
  /** Diameter in px. */
  size?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const id = useId()
  const [dragging, setDragging] = useState(false)

  const [uncontrolled, setUncontrolled] = useState(() =>
    clamp(snap(defaultValue ?? min, min, step), min, max),
  )
  const value = clamp(controlledValue ?? uncontrolled, min, max)

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(snap(next, min, step), min, max)
      if (controlledValue === undefined) setUncontrolled(clamped)
      onChange?.(clamped)
    },
    [controlledValue, max, min, onChange, step],
  )

  // Where the drag began: the pointer Y and the value at that moment. Movement
  // is measured against this anchor so the knob never jumps to the cursor.
  const anchor = useRef<{ y: number; value: number } | null>(null)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      setDragging(true)
      anchor.current = { y: e.clientY, value }
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!anchor.current) return
      // Up is positive. Convert pixel travel to a fraction of the full range.
      const dy = anchor.current.y - e.clientY
      const delta = (dy / DRAG_RANGE) * (max - min)
      commit(anchor.current.value + delta)
    },
    [commit, max, min],
  )

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    anchor.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      // Only steal the wheel while focused, so the page still scrolls past it.
      if (document.activeElement !== e.currentTarget) return
      e.preventDefault()
      commit(value + (e.deltaY < 0 ? step : -step))
    },
    [commit, step, value],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const big = Math.max(step, (max - min) / 10)
      let next: number | null = null
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = value - step
          break
        case 'ArrowRight':
        case 'ArrowUp':
          next = value + step
          break
        case 'PageDown':
          next = value - big
          break
        case 'PageUp':
          next = value + big
          break
        case 'Home':
          next = min
          break
        case 'End':
          next = max
          break
        default:
          return
      }
      e.preventDefault()
      commit(next)
    },
    [commit, max, min, step, value],
  )

  const frac = max > min ? (value - min) / (max - min) : 0
  const angle = START + frac * SWEEP

  // A ref-based wheel listener as a non-passive fallback: React's onWheel is
  // passive in some engines, so preventDefault there is a no-op. Attaching
  // directly lets us actually block the page scroll while the knob is focused.
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (document.activeElement !== el) return
      e.preventDefault()
      commit(value + (e.deltaY < 0 ? step : -step))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [commit, step, value])

  return (
    <div className={`flex select-none flex-col items-center gap-3 ${className}`}>
      <div
        ref={wrapRef}
        role="slider"
        aria-labelledby={id}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        style={{ width: size, height: size }}
        className="group relative cursor-grab touch-none rounded-full outline-none active:cursor-grabbing"
      >
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          {/* The full track the value rides on. */}
          <path
            d={arcPath(0, 1, 38)}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={5}
            strokeLinecap="round"
          />
          {/* The lit portion, up to the current value. */}
          {frac > 0 && (
            <path
              d={arcPath(0, frac, 38)}
              fill="none"
              stroke="#DCF87C"
              strokeWidth={5}
              strokeLinecap="round"
            />
          )}
          {/* The dial body. */}
          <circle
            cx={50}
            cy={50}
            r={30}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1}
          />
          {/* The pointer and its tip, drawn pointing straight up and rotated to
              the value. Off reduced motion the rotation rides a spring so it
              settles with a little physical give; on, it snaps exactly. */}
          <motion.g
            style={{ originX: '50px', originY: '50px' }}
            animate={{ rotate: angle }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18 }}
          >
            <line x1={50} y1={50} x2={50} y2={20} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={50} cy={20} r={dragging && !reduce ? 5 : 3.5} fill="#DCF87C" />
          </motion.g>
        </svg>
        {/* Focus ring, drawn outside the SVG so it hugs the round hit area. */}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-[#DCF87C] transition group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-black" />
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span id={id} className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/45">
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-[#DCF87C]">{format(value)}</span>
      </div>
    </div>
  )
}
