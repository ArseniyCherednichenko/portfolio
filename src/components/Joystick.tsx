import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/** A two-axis reading: each component in [-1, 1], y positive upward. */
export interface Vector2 {
  x: number
  y: number
}

// Eight-point compass for the spoken direction, starting at due east and
// running counter-clockwise the way atan2 does, so the label matches the maths.
const COMPASS = ['right', 'up and right', 'up', 'up and left', 'left', 'down and left', 'down', 'down and right']

function describe(v: Vector2): string {
  const mag = Math.hypot(v.x, v.y)
  if (mag < 0.04) return 'centred'
  const a = Math.atan2(v.y, v.x) // y already up-positive
  const idx = ((Math.round((a / (Math.PI / 4)) % 8) + 8) % 8)
  return `${COMPASS[idx]}, ${Math.round(mag * 100)}%`
}

/**
 * A spring-return analog stick — the two-axis control the family never had.
 * Every other control here resolves to a single value (the Knob's dial, the
 * ElasticSlider, the Switch, the Stepper); this one reports a whole vector.
 * Grab the nub and it follows the pointer within a circular gate, clamped to
 * the rim so it can never leave the well; let go and it springs back to centre
 * with the snap of a real thumbstick. It reports a normalised `{ x, y }` in
 * [-1, 1] with y positive **upward**, the intuitive sense for a stick.
 *
 * A real `role="slider"`: focus it and the arrow keys walk the nub a step at a
 * time, Home/Space re-centre it, and `aria-valuetext` speaks the live
 * direction and throw ("up and right, 62%"). When `returnToCenter` is off it
 * holds wherever it is left — a flight-stick trim rather than a game pad.
 *
 * Under prefers-reduced-motion the spring and the glow come off: the nub snaps
 * exactly to position and back to centre, a plain, fully usable two-axis pad.
 */
export function Joystick({
  size = 180,
  step = 0.12,
  returnToCenter = true,
  onChange,
  label = 'Direction',
  className = '',
}: {
  /** Diameter of the well in px. */
  size?: number
  /** Keyboard nudge, as a fraction of full throw (0..1). */
  step?: number
  /** Spring back to centre on release. Off: holds its last position. */
  returnToCenter?: boolean
  /** Fires on every change with the normalised vector (y up-positive). */
  onChange?: (v: Vector2) => void
  /** Accessible name for the stick. */
  label?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const id = useId()
  const [dragging, setDragging] = useState(false)
  // Nub offset from centre, in px, y positive downward (screen space).
  const [pos, setPos] = useState<Vector2>({ x: 0, y: 0 })

  // The nub stays a hair inside the rim so its ring never clips the well edge.
  const radius = size / 2 - size * 0.18

  // Report in normalised space with y flipped so up is positive.
  const emit = useCallback(
    (px: Vector2) => {
      onChange?.({ x: px.x / radius, y: -px.y / radius })
    },
    [onChange, radius],
  )

  // Clamp a raw px offset into the circular gate, then store + report it.
  const place = useCallback(
    (rawX: number, rawY: number) => {
      const mag = Math.hypot(rawX, rawY)
      const scale = mag > radius ? radius / mag : 1
      const next = { x: rawX * scale, y: rawY * scale }
      setPos(next)
      emit(next)
    },
    [emit, radius],
  )

  const wrapRef = useRef<HTMLDivElement>(null)

  const fromPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return { x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height / 2) }
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      setDragging(true)
      const p = fromPointer(e)
      place(p.x, p.y)
    },
    [fromPointer, place],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      const p = fromPointer(e)
      place(p.x, p.y)
    },
    [dragging, fromPointer, place],
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      setDragging(false)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (returnToCenter) {
        setPos({ x: 0, y: 0 })
        emit({ x: 0, y: 0 })
      }
    },
    [emit, returnToCenter],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const d = step * radius
      let nx = pos.x
      let ny = pos.y
      switch (e.key) {
        case 'ArrowLeft':
          nx -= d
          break
        case 'ArrowRight':
          nx += d
          break
        case 'ArrowUp':
          ny -= d
          break
        case 'ArrowDown':
          ny += d
          break
        case 'Home':
        case ' ':
        case 'Spacebar':
          nx = 0
          ny = 0
          break
        default:
          return
      }
      e.preventDefault()
      place(nx, ny)
    },
    [place, pos.x, pos.y, radius, step],
  )

  // Blur re-centres when it is a spring-return stick, so tabbing away lets it
  // rest at neutral the way lifting a thumb would.
  const onBlur = useCallback(() => {
    if (returnToCenter && (pos.x !== 0 || pos.y !== 0)) {
      setPos({ x: 0, y: 0 })
      emit({ x: 0, y: 0 })
    }
  }, [emit, pos.x, pos.y, returnToCenter])

  const norm: Vector2 = { x: pos.x / radius, y: -pos.y / radius }
  const mag = Math.min(1, Math.hypot(norm.x, norm.y))

  return (
    <div className={`flex select-none flex-col items-center gap-4 ${className}`}>
      <div
        ref={wrapRef}
        role="slider"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(mag * 100)}
        aria-valuetext={describe(norm)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        style={{ width: size, height: size }}
        className="group relative touch-none rounded-full outline-none"
      >
        {/* The well: a recessed round plate with a faint grid of guide lines so
            the two axes are legible even at rest. */}
        <div className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.02] shadow-[inset_0_2px_20px_rgba(0,0,0,0.6)]" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[12%] h-[76%] w-px -translate-x-1/2 bg-white/[0.07]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-[12%] h-px w-[76%] -translate-y-1/2 bg-white/[0.07]"
        />
        {/* The travel ring the nub rides inside. */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full border border-dashed border-white/10"
          style={{ inset: size * 0.18 }}
        />
        {/* A lime reach line from centre to the nub, so the throw reads as a
            vector and not just a moved dot. Scales with magnitude. */}
        {mag > 0.04 && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 origin-left rounded-full bg-gradient-to-r from-[#DCF87C]/0 to-[#DCF87C]/70"
            style={{ height: 2 }}
            animate={{
              width: Math.hypot(pos.x, pos.y),
              rotate: (Math.atan2(pos.y, pos.x) * 180) / Math.PI,
            }}
            transition={dragging || reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 30 }}
          />
        )}
        {/* The nub. Springs home on release unless it is a hold stick. */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 rounded-full border border-white/20 bg-gradient-to-b from-white/15 to-white/[0.03] shadow-[0_6px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
          style={{ width: size * 0.3, height: size * 0.3, marginLeft: -size * 0.15, marginTop: -size * 0.15 }}
          animate={{
            x: pos.x,
            y: pos.y,
            scale: dragging && !reduce ? 1.06 : 1,
          }}
          transition={dragging || reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 24 }}
        >
          {/* Inner cap: brightens toward lime as the stick is pushed. */}
          <div
            className="absolute inset-[18%] rounded-full border border-white/10"
            style={{
              background: `radial-gradient(circle at 50% 35%, rgba(220,248,124,${0.18 + mag * 0.5}), rgba(255,255,255,0.04))`,
            }}
          />
        </motion.div>
        {/* Focus ring hugging the round hit area. */}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-[#DCF87C] transition group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-black" />
      </div>

      <div className="flex flex-col items-center gap-1">
        <span id={id} className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/45">
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-[#DCF87C]">
          x {norm.x >= 0 ? '+' : ''}
          {norm.x.toFixed(2)} · y {norm.y >= 0 ? '+' : ''}
          {norm.y.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
