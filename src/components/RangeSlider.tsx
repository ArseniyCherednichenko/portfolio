import { motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function snap(value: number, min: number, step: number) {
  if (step <= 0) return value
  return Math.round((value - min) / step) * step + min
}

type Pair = [number, number]
type Handle = 'lo' | 'hi'

/**
 * A two-thumb range slider — the interval sibling of the ElasticSlider. Where
 * that control resolves to one value, this one resolves to a **span**: a low
 * and a high thumb bounding a lit stretch of track. Drag either thumb, or click
 * anywhere on the rail to send the nearer one there; the two can never cross,
 * held apart by `minGap`. A value bubble floats above whichever thumb you are
 * holding or have focused, and the held thumb swells.
 *
 * Works controlled (`value` + `onChange`) or uncontrolled (`defaultValue`).
 * Honest to assistive tech and the keyboard: each thumb is a real
 * `role="slider"` carrying aria-valuemin/max/now/text, focusable, driven by the
 * arrow, Home/End, and Page keys — Home/End on a thumb run it up to its
 * neighbour, not off the end. Under prefers-reduced-motion the swell and the
 * bubble's spring come off; it stays a plain, fully usable range input.
 */
export function RangeSlider({
  min = 0,
  max = 100,
  step = 1,
  minGap = step,
  defaultValue,
  value: controlledValue,
  onChange,
  label = 'Range',
  format = (v: number) => String(Math.round(v)),
  showTicks = false,
  className = '',
}: {
  min?: number
  max?: number
  step?: number
  /** Smallest span the two thumbs may bound — they never come closer. */
  minGap?: number
  defaultValue?: Pair
  /** Controlled value. When set, the component reports changes via onChange. */
  value?: Pair
  onChange?: (value: Pair) => void
  /** Accessible name; each thumb reads as "<label>, minimum/maximum". */
  label?: string
  /** Formats a bound for the readout, the bubble, and aria-valuetext. */
  format?: (value: number) => string
  /** Draw evenly spaced step ticks under the rail. */
  showTicks?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const id = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<Handle | null>(null)
  const [active, setActive] = useState<Handle | null>(null)

  const [uncontrolled, setUncontrolled] = useState<Pair>(() => {
    const lo = clamp(snap(defaultValue?.[0] ?? min, min, step), min, max)
    const hi = clamp(snap(defaultValue?.[1] ?? max, min, step), min, max)
    return [Math.min(lo, hi), Math.max(lo, hi)]
  })
  const raw = controlledValue ?? uncontrolled
  const value: Pair = [
    clamp(raw[0], min, max),
    clamp(raw[1], min, max),
  ]

  // Commit a single thumb, holding it inside its bound and honouring the gap so
  // the pair can never cross or touch closer than minGap.
  const commit = useCallback(
    (handle: Handle, next: number) => {
      const snapped = snap(next, min, step)
      let lo = value[0]
      let hi = value[1]
      if (handle === 'lo') {
        lo = clamp(snapped, min, hi - minGap)
      } else {
        hi = clamp(snapped, lo + minGap, max)
      }
      const pair: Pair = [lo, hi]
      if (controlledValue === undefined) setUncontrolled(pair)
      onChange?.(pair)
    },
    [controlledValue, max, min, minGap, onChange, step, value],
  )

  const valueFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return null
    const rect = track.getBoundingClientRect()
    if (rect.width === 0) return null
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    return min + ratio * (max - min)
  }, [max, min])

  const onTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const next = valueFromClientX(e.clientX)
      if (next == null) return
      // Send whichever thumb sits nearer to the tap; on a tie the low thumb
      // yields so you can always open the span from a collapsed start.
      const dLo = Math.abs(next - value[0])
      const dHi = Math.abs(next - value[1])
      const handle: Handle = dLo <= dHi ? 'lo' : 'hi'
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(handle)
      setActive(handle)
      commit(handle, next)
    },
    [commit, valueFromClientX, value],
  )

  const onTrackPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      const next = valueFromClientX(e.clientX)
      if (next != null) commit(dragging, next)
    },
    [commit, dragging, valueFromClientX],
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      setDragging(null)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    },
    [dragging],
  )

  const onThumbKeyDown = useCallback(
    (handle: Handle) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const [lo, hi] = value
      const current = handle === 'lo' ? lo : hi
      const big = Math.max(step, (max - min) / 10)
      // A thumb's own ends: min or its neighbour for lo; its neighbour or max
      // for hi. Home/End then never carry a thumb across the other.
      const floor = handle === 'lo' ? min : lo + minGap
      const ceil = handle === 'lo' ? hi - minGap : max
      let next: number | null = null
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = current - step
          break
        case 'ArrowRight':
        case 'ArrowUp':
          next = current + step
          break
        case 'PageDown':
          next = current - big
          break
        case 'PageUp':
          next = current + big
          break
        case 'Home':
          next = floor
          break
        case 'End':
          next = ceil
          break
        default:
          return
      }
      e.preventDefault()
      commit(handle, next)
    },
    [commit, max, min, minGap, step, value],
  )

  const span = max > min ? max - min : 1
  const loPct = ((value[0] - min) / span) * 100
  const hiPct = ((value[1] - min) / span) * 100

  const ticks = showTicks && step > 0 ? Math.min(Math.round((max - min) / step), 60) : 0

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="mb-4 flex items-baseline justify-between">
        <span id={id} className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-[#DCF87C]">
          {format(value[0])} <span className="text-white/30">–</span> {format(value[1])}
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-2.5 w-full cursor-pointer touch-none rounded-full bg-white/10"
      >
        {ticks > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: ticks + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute top-1/2 h-1 w-px -translate-x-1/2 -translate-y-1/2 bg-white/15"
                style={{ left: `${(i / ticks) * 100}%` }}
              />
            ))}
          </div>
        )}

        {/* The lit span between the two thumbs. */}
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#DCF87C]/70 to-[#DCF87C]"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />

        {(['lo', 'hi'] as const).map((handle) => {
          const pct = handle === 'lo' ? loPct : hiPct
          const val = handle === 'lo' ? value[0] : value[1]
          const isHeld = dragging === handle
          const isActive = active === handle || isHeld
          const floor = handle === 'lo' ? min : value[0] + minGap
          const ceil = handle === 'lo' ? value[1] - minGap : max
          return (
            <div
              key={handle}
              role="slider"
              aria-labelledby={id}
              aria-label={`${label}, ${handle === 'lo' ? 'minimum' : 'maximum'}`}
              aria-valuemin={floor}
              aria-valuemax={ceil}
              aria-valuenow={val}
              aria-valuetext={format(val)}
              aria-orientation="horizontal"
              tabIndex={0}
              onKeyDown={onThumbKeyDown(handle)}
              onFocus={() => setActive(handle)}
              onBlur={() => setActive((a) => (a === handle ? null : a))}
              onPointerDown={(e) => {
                // Claim the drag on the thumb itself so a grab never first nudges
                // it toward the pointer via the track handler.
                e.stopPropagation()
                if (e.button !== 0) return
                e.currentTarget.setPointerCapture(e.pointerId)
                setDragging(handle)
                setActive(handle)
              }}
              onPointerMove={(e) => {
                if (dragging !== handle) return
                const next = valueFromClientX(e.clientX)
                if (next != null) commit(handle, next)
              }}
              onPointerUp={(e) => {
                if (dragging !== handle) return
                setDragging(null)
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                }
              }}
              className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] outline-none ring-[#DCF87C] transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{
                left: `${pct}%`,
                transform: `translate(-50%, -50%) scale(${isHeld ? 1.25 : 1})`,
              }}
            >
              {/* The value bubble, floated above the held or focused thumb. */}
              <motion.span
                aria-hidden
                initial={false}
                animate={
                  reduce
                    ? { opacity: isActive ? 1 : 0 }
                    : { opacity: isActive ? 1 : 0, y: isActive ? 0 : 4, scale: isActive ? 1 : 0.9 }
                }
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
                className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md border border-white/12 bg-black/85 px-2 py-1 font-mono text-xs tabular-nums text-[#DCF87C] shadow-lg backdrop-blur"
              >
                {format(val)}
              </motion.span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
