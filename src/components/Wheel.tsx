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
import { useReducedMotion } from 'framer-motion'

// The angular spacing between two neighbouring rows on the cylinder. At 18° a
// little over ten rows fall inside the ±90° visible arc, which reads as a real
// barrel without so many faces that the far ones turn to noise.
const ANGLE = 18
// Row height in px. RADIUS is chosen so that two rows exactly one step apart sit
// one itemHeight apart at the centre of the wheel — the honest cylinder radius
// for this angle, so the projection never drifts from the layout.
const ITEM_H = 40
const RADIUS = ITEM_H / (2 * Math.tan((ANGLE * Math.PI) / 180 / 2))
// How many rows of head-room the wheel shows above and below the selection.
const HALF_ROWS = 2

// How far a flick carries, in ms of projected velocity. A fast throw of the
// barrel travels a few rows past where the finger left it, then snaps.
const MOMENTUM = 150
// Rows the barrel may be dragged past its ends before the rubber-band clamps —
// on release it always settles back onto a real row.
const OVERSCROLL = 0.85

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * An iOS-style wheel picker: a barrel of options you spin. Drag it (pointer or
 * touch) and it tracks your finger, then carries on a flick and snaps to the
 * nearest row; spin the mouse wheel to step; or focus it and drive it with the
 * arrows, Page keys, and Home/End. The rows curve away on a real cylinder —
 * projected honestly, so the centre row sits at natural size while its
 * neighbours foreshorten and fade — framed by a lit selection window.
 *
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). It is a
 * genuine `role="listbox"`: the container carries the accessible name and an
 * aria-activedescendant, every row is a `role="option"` with aria-selected, and
 * the whole thing is keyboard-operable. Under prefers-reduced-motion the flick
 * and the eased settle come off — every change lands instantly on its row — while
 * the barrel's shape stays, so it is still recognisably the same control.
 */
export function Wheel({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  label = 'Select',
  className = '',
}: {
  options: string[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  label?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const baseId = useId()
  const n = options.length

  const indexOf = useCallback(
    (v: string | undefined) => {
      const i = v == null ? -1 : options.indexOf(v)
      return i < 0 ? 0 : i
    },
    [options],
  )

  const [uncontrolled, setUncontrolled] = useState(() => indexOf(defaultValue))
  const index = controlledValue !== undefined ? indexOf(controlledValue) : uncontrolled

  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  // The live floating position of the barrel, in row units. Driven imperatively
  // off the React render path (like the site's other canvas/RAF pieces) so a
  // spin stays smooth; React state only holds the committed integer selection.
  const posRef = useRef(index)
  const rafRef = useRef<number | null>(null)

  const commit = useCallback(
    (i: number) => {
      const next = clamp(Math.round(i), 0, n - 1)
      if (controlledValue === undefined) setUncontrolled(next)
      if (options[next] !== undefined) onChange?.(options[next])
    },
    [controlledValue, n, onChange, options],
  )

  // Paint the barrel at a given floating position: each row is placed on the
  // cylinder and foreshortened, rows past the ±90° horizon hidden outright.
  const paint = useCallback((pos: number) => {
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i]
      if (!el) continue
      const offset = i - pos
      const ang = offset * ANGLE
      if (Math.abs(ang) >= 90) {
        el.style.visibility = 'hidden'
        el.style.opacity = '0'
        el.style.pointerEvents = 'none'
        continue
      }
      const rad = (ang * Math.PI) / 180
      const y = RADIUS * Math.sin(rad)
      const near = Math.abs(offset)
      el.style.visibility = 'visible'
      el.style.transform = `translateY(${y.toFixed(2)}px) rotateX(${(-ang).toFixed(2)}deg)`
      el.style.opacity = Math.max(0.16, Math.cos(rad)).toFixed(3)
      el.style.pointerEvents = near < 0.5 ? 'auto' : 'none'
      el.style.color = near < 0.5 ? '#ffffff' : 'rgba(255,255,255,0.55)'
      el.style.fontWeight = near < 0.5 ? '600' : '400'
    }
  }, [])

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  // Ease the barrel to a target row and commit it. Instant under reduced motion.
  const settle = useCallback(
    (target: number, immediate = false) => {
      stop()
      const dest = clamp(Math.round(target), 0, n - 1)
      if (immediate || reduce) {
        posRef.current = dest
        paint(dest)
        commit(dest)
        return
      }
      const start = posRef.current
      const dist = dest - start
      if (Math.abs(dist) < 0.001) {
        posRef.current = dest
        paint(dest)
        commit(dest)
        return
      }
      const dur = Math.min(560, 200 + Math.abs(dist) * 80)
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur)
        const e = 1 - Math.pow(1 - p, 3)
        posRef.current = start + dist * e
        paint(posRef.current)
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          posRef.current = dest
          paint(dest)
          commit(dest)
          rafRef.current = null
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [commit, n, paint, reduce, stop],
  )

  // Keep the barrel in sync when the selection is driven from outside (a
  // controlled value change, or the initial mount).
  useEffect(() => {
    stop()
    posRef.current = index
    paint(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paint, stop])

  useEffect(() => stop, [stop])

  // ---- Drag ----------------------------------------------------------------
  const drag = useRef<{
    startY: number
    startPos: number
    lastY: number
    lastT: number
    vel: number
    active: boolean
  } | null>(null)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      stop()
      e.currentTarget.setPointerCapture(e.pointerId)
      const now = performance.now()
      drag.current = {
        startY: e.clientY,
        startPos: posRef.current,
        lastY: e.clientY,
        lastT: now,
        vel: 0,
        active: true,
      }
    },
    [stop],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || !d.active) return
      // Content follows the finger: drag down and earlier rows come to centre.
      let pos = d.startPos - (e.clientY - d.startY) / ITEM_H
      pos = clamp(pos, -OVERSCROLL, n - 1 + OVERSCROLL)
      const now = performance.now()
      const dt = now - d.lastT
      if (dt > 0) {
        const instant = (-(e.clientY - d.lastY) / ITEM_H) / dt
        // Smooth the velocity a touch so a jittery pointer does not throw wild.
        d.vel = d.vel * 0.7 + instant * 0.3
        d.lastY = e.clientY
        d.lastT = now
      }
      posRef.current = pos
      paint(pos)
    },
    [n, paint],
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || !d.active) return
      d.active = false
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      const projected = posRef.current + d.vel * MOMENTUM
      settle(projected)
      drag.current = null
    },
    [settle],
  )

  // ---- Wheel ---------------------------------------------------------------
  const wheelAccum = useRef(0)
  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      wheelAccum.current += e.deltaY
      const steps = Math.trunc(wheelAccum.current / ITEM_H)
      if (steps !== 0) {
        wheelAccum.current -= steps * ITEM_H
        settle(clamp(Math.round(posRef.current) + steps, 0, n - 1))
      }
    },
    [n, settle],
  )

  // ---- Keyboard ------------------------------------------------------------
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      let target: number | null = null
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          target = index - 1
          break
        case 'ArrowDown':
        case 'ArrowRight':
          target = index + 1
          break
        case 'PageUp':
          target = index - 3
          break
        case 'PageDown':
          target = index + 3
          break
        case 'Home':
          target = 0
          break
        case 'End':
          target = n - 1
          break
        default:
          return
      }
      e.preventDefault()
      settle(clamp(target, 0, n - 1))
    },
    [index, n, settle],
  )

  const height = ITEM_H * (HALF_ROWS * 2 + 1)

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{label}</span>
        <span className="font-mono text-sm tabular-nums text-[#DCF87C]">{options[index]}</span>
      </div>

      <div
        ref={containerRef}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${baseId}-opt-${index}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className="relative mx-auto max-w-[240px] cursor-grab touch-none overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:cursor-grabbing"
        style={{ height }}
      >
        {/* The lit selection window: a faint lime band framed by two hairlines,
            sitting over the centre row. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-[#DCF87C]/30 bg-[#DCF87C]/[0.06]"
          style={{ height: ITEM_H }}
        />
        {/* Top and bottom fades, so rows dissolve into the frame rather than
            hitting a hard edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'linear-gradient(to bottom, #0d0d0d 0%, transparent 34%, transparent 66%, #0d0d0d 100%)',
          }}
        />

        {/* The barrel. Perspective on the frame, preserve-3d on the stack, and
            each row placed on the cylinder by `paint`. */}
        <div
          className="absolute inset-0"
          style={{ perspective: '900px' }}
        >
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2"
            style={{ transformStyle: 'preserve-3d', height: 0 }}
          >
            {options.map((opt, i) => (
              <div
                key={opt + i}
                id={`${baseId}-opt-${i}`}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                role="option"
                aria-selected={i === index}
                onClick={() => settle(i)}
                className="absolute inset-x-0 flex items-center justify-center text-lg leading-none tracking-tight"
                style={{
                  height: ITEM_H,
                  top: -ITEM_H / 2,
                  backfaceVisibility: 'hidden',
                  willChange: 'transform, opacity',
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
