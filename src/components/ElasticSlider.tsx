import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'framer-motion'

// ElasticSlider — a value control with physical give. Drag along the track and
// the bar fattens under your finger; pull past either end and the whole track
// stretches on a decaying curve, then springs back the instant you let go, the
// way a rubber band would. This is the tactile "controls with feel" piece the
// bench was missing: not a native <input type="range"> restyled, but a
// hand-built interaction where the overshoot is real motion, not a hard stop.
// It is a proper ARIA slider too — tab to it and drive it with the arrow keys,
// Home/End, and Page Up/Down — and under prefers-reduced-motion the elastic
// give and the fatten come off, leaving a plain, precise, fully usable control.

// How far, in pixels, the pointer can drag past an edge before the stretch
// fully saturates. The decay below maps raw overshoot onto this ceiling.
const MAX_OVERFLOW = 50

// Squash raw over-drag onto a bounded, ever-softening curve: the first pixels
// past the edge move the track a lot, later ones barely at all, so the pull
// feels like tension building against a band rather than a linear slide.
function decay(value: number, max: number) {
  if (max === 0) return 0
  const entry = value / max
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5)
  return sigmoid * max
}

export interface ElasticSliderProps {
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  /** Small mark shown at the low end (e.g. a short bar). No emoji. */
  leftIcon?: ReactNode
  /** Small mark shown at the high end (e.g. a taller bar). No emoji. */
  rightIcon?: ReactNode
  /** Formats the live readout; defaults to the rounded number. */
  format?: (value: number) => string
  /** Accessible name for the slider. */
  label?: string
  className?: string
  onChange?: (value: number) => void
}

export function ElasticSlider({
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  leftIcon,
  rightIcon,
  format,
  label = 'Value',
  className = '',
  onChange,
}: ElasticSliderProps) {
  const reduce = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [value, setValue] = useState(defaultValue ?? (min + max) / 2)

  // Live pointer x and the current over-drag, both driven imperatively so the
  // stretch tracks the finger without re-rendering on every move.
  const clientX = useMotionValue(0)
  const overflow = useMotionValue(0)
  const scale = useMotionValue(1)

  const range = max - min
  const pct = range === 0 ? 0 : ((value - min) / range) * 100

  // Recompute the over-drag whenever the pointer moves past an edge. Kept out
  // of React state so it stays at 60fps; skipped entirely under reduced motion.
  useMotionValueEvent(clientX, 'change', (latest) => {
    const el = trackRef.current
    if (!el || reduce) return
    const { left, right } = el.getBoundingClientRect()
    let past = 0
    if (latest < left) past = left - latest
    else if (latest > right) past = latest - right
    overflow.jump(decay(past, MAX_OVERFLOW))
  })

  // Stretch the whole track by the decayed overshoot, from whichever side is
  // being pulled, and squash it a touch vertically as it stretches.
  const scaleX = useTransform(() => {
    const el = trackRef.current
    if (!el) return 1
    const width = el.getBoundingClientRect().width
    return width === 0 ? 1 : 1 + overflow.get() / width
  })
  const scaleY = useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.75])
  const transformOrigin = useTransform(() => {
    const el = trackRef.current
    if (!el) return 'center'
    const { left, width } = el.getBoundingClientRect()
    return clientX.get() < left + width / 2 ? 'right' : 'left'
  })
  // The fatten: the bar grows from 6px to 12px while you interact with it.
  const height = useTransform(scale, [1, 1.15], [6, 12])
  const marginY = useTransform(scale, [1, 1.15], [0, -3])

  function commit(next: number) {
    const stepped = Math.round(next / step) * step
    const clamped = Math.min(Math.max(stepped, min), max)
    // Guard against -0 and floating dust from the division above.
    const clean = Math.abs(clamped) < 1e-9 ? 0 : clamped
    setValue(clean)
    onChange?.(clean)
  }

  function valueFromClientX(x: number) {
    const el = trackRef.current
    if (!el) return value
    const { left, width } = el.getBoundingClientRect()
    if (width === 0) return value
    return min + ((x - left) / width) * range
  }

  function fatten(on: boolean) {
    if (reduce) return
    animate(scale, on ? 1.15 : 1, { type: 'spring', stiffness: 400, damping: 30 })
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    fatten(true)
    commit(valueFromClientX(e.clientX))
    clientX.jump(e.clientX)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    commit(valueFromClientX(e.clientX))
    clientX.jump(e.clientX)
  }

  function handleRelease(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    fatten(false)
    // Snap the stretch back with a little bounce, so the band recoils.
    if (!reduce) animate(overflow, 0, { type: 'spring', stiffness: 300, damping: 12 })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const big = step * 10
    let next: number | null = null
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + (e.shiftKey ? big : step)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - (e.shiftKey ? big : step)
        break
      case 'PageUp':
        next = value + big
        break
      case 'PageDown':
        next = value - big
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
  }

  const readout = format ? format(value) : `${Math.round(value)}`

  return (
    <div className={`flex w-full max-w-sm flex-col items-center gap-5 ${className}`}>
      <span className="font-display text-4xl font-bold tabular-nums tracking-tight text-white">
        {readout}
      </span>
      <div className="flex w-full items-center gap-3">
        {leftIcon != null && (
          <span className="shrink-0 text-white/35" aria-hidden>
            {leftIcon}
          </span>
        )}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={readout}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handleRelease}
          onPointerCancel={handleRelease}
          onPointerEnter={() => !dragging.current && fatten(true)}
          onPointerLeave={() => !dragging.current && fatten(false)}
          onKeyDown={handleKeyDown}
          className="relative flex flex-grow cursor-grab touch-none items-center rounded-full py-3 outline-none ring-[#DCF87C]/60 focus-visible:ring-2 active:cursor-grabbing"
        >
          {/* The bar itself. Everything inside stretches together for the
              elastic pull; the fill edge is the value indicator. */}
          <motion.div
            style={{
              scaleX,
              scaleY,
              transformOrigin,
              height,
              marginTop: marginY,
              marginBottom: marginY,
            }}
            className="relative w-full overflow-hidden rounded-full bg-white/12 ring-1 ring-white/5"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#DCF87C]"
              style={{ width: `${pct}%` }}
            />
          </motion.div>
        </div>
        {rightIcon != null && (
          <span className="shrink-0 text-white/35" aria-hidden>
            {rightIcon}
          </span>
        )}
      </div>
    </div>
  )
}
