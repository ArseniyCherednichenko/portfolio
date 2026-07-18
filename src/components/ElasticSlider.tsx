import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

// How far (px) the pointer can drag past an end before the bar reaches its
// maximum stretch. Overflow past this is clamped, so the rubber-band has a firm
// ceiling instead of stretching without bound.
const MAX_OVERFLOW = 70

// The travel-to-stretch ratio: at MAX_OVERFLOW of pointer overflow the whole
// bar grows this fraction wider (and squashes a touch shorter), reading as an
// elastic band pulled taut.
const STRETCH = 0.07

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function snap(value: number, min: number, step: number) {
  if (step <= 0) return value
  return Math.round((value - min) / step) * step + min
}

/**
 * A tactile range control with real give. Drag the thumb — or click anywhere on
 * the track — to set a value; drag past either end and the entire bar stretches
 * against the pull, then springs back the moment you let go, the way an iOS
 * volume slider resists at its limits. A live readout tracks the value, and the
 * thumb swells while it is held.
 *
 * Works as a controlled (`value` + `onChange`) or uncontrolled (`defaultValue`)
 * input. Honest to assistive tech and the keyboard: the thumb is a real
 * `role="slider"` carrying aria-valuemin/max/now/text, focusable, and driven by
 * the arrow, Home/End, and Page keys. Under prefers-reduced-motion the elastic
 * stretch and spring come off entirely — it stays a plain, fully usable slider.
 */
export function ElasticSlider({
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  value: controlledValue,
  onChange,
  label = 'Value',
  format = (v: number) => String(Math.round(v)),
  leading,
  trailing,
  className = '',
}: {
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  /** Controlled value. When set, the component reports changes via onChange. */
  value?: number
  onChange?: (value: number) => void
  /** Accessible name for the slider. */
  label?: string
  /** Formats the value for the readout and aria-valuetext. */
  format?: (value: number) => string
  /** Optional adornment shown at the low end of the track (e.g. a small icon). */
  leading?: ReactNode
  /** Optional adornment shown at the high end of the track. */
  trailing?: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  const id = useId()
  const trackRef = useRef<HTMLDivElement>(null)
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

  // Signed pointer overflow past an end — negative past the low end, positive
  // past the high end — damped and clamped, then springed back to 0 on release.
  const overflow = useMotionValue(0)
  const smooth = useSpring(overflow, { stiffness: 550, damping: 42, mass: 0.7 })
  const scaleX = useTransform(smooth, (o) => 1 + (Math.min(Math.abs(o), MAX_OVERFLOW) / MAX_OVERFLOW) * STRETCH)
  const scaleY = useTransform(smooth, (o) => 1 - (Math.min(Math.abs(o), MAX_OVERFLOW) / MAX_OVERFLOW) * STRETCH * 0.6)
  // Stretch away from the end being pushed: pull past the low end and the bar
  // grows to the left (origin pinned right), and vice versa.
  const originX = useTransform(smooth, (o) => (o < 0 ? '100%' : '0%'))

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      if (rect.width === 0) return
      const ratio = (clientX - rect.left) / rect.width
      commit(min + ratio * (max - min))
      // Damped overflow: half the raw pointer distance past the edge, capped.
      if (clientX < rect.left) {
        overflow.set(Math.max(-MAX_OVERFLOW, (clientX - rect.left) * 0.5))
      } else if (clientX > rect.right) {
        overflow.set(Math.min(MAX_OVERFLOW, (clientX - rect.right) * 0.5))
      } else {
        overflow.set(0)
      }
    },
    [commit, max, min, overflow],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Ignore secondary buttons so a right-click never starts a drag.
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
      setFromClientX(e.clientX)
    },
    [setFromClientX],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      setFromClientX(e.clientX)
    },
    [dragging, setFromClientX],
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      setDragging(false)
      overflow.set(0)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    },
    [dragging, overflow],
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

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  const motionStyle = reduce ? undefined : { scaleX, scaleY, transformOrigin: originX }

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <span id={id} className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-[#DCF87C]">{format(value)}</span>
      </div>

      <motion.div style={motionStyle} className="flex items-center gap-3">
        {leading != null && <span className="shrink-0 text-white/40">{leading}</span>}

        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative h-2.5 flex-1 cursor-pointer touch-none rounded-full bg-white/10"
        >
          {/* The filled portion, from the low end up to the thumb. */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#DCF87C]"
            style={{ width: `${pct}%` }}
          />

          {/* The thumb: a real slider handle, focusable and keyboard-driven. */}
          <div
            role="slider"
            aria-labelledby={id}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={format(value)}
            aria-orientation="horizontal"
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] outline-none ring-[#DCF87C] transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{
              left: `${pct}%`,
              transform: `translate(-50%, -50%) scale(${dragging ? 1.25 : 1})`,
            }}
          />
        </div>

        {trailing != null && <span className="shrink-0 text-white/40">{trailing}</span>}
      </motion.div>
    </div>
  )
}
