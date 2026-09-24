import { animate, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// The dial's centre in the 240×240 viewBox, the radius the finger holes ride on,
// and how big each hole is.
const CX = 120
const CY = 120
const RING = 76
const HOLE_R = 15

// Degrees of rotation between adjacent digits — one "pulse" of the old line. A
// real dial ticks the exchange once per step as it returns, so the digit you
// dialled equals the number of steps travelled: 1 is a short pull, 0 the longest.
const STEP = 30
// Where the finger stop sits, measured clockwise from twelve o'clock. Lower
// right, the way every desk phone had it. Hole 1 rests one STEP short of it.
const STOP = 135
// How fast the governed return unwinds, in degrees per second. Constant speed —
// the whole point of the dial's centrifugal governor was that 0 took the same
// tick rate as 1, just longer. So the return duration scales with the travel.
const RETURN_SPEED = 520
// How long the powered outward pull takes when you dial from the keyboard or by
// clicking a hole, again scaled by distance so every digit pulls at one speed.
const PULL_SPEED = 620

// Digits in dialling order. Index 0 is the digit "1" (one step from the stop);
// the last, "0", is ten steps away — the far end of the arc.
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// The travel, in degrees, needed to bring a digit's hole to the finger stop.
// steps runs 1..10; digit 0 is steps 10.
const travelFor = (steps: number) => steps * STEP
// Rest angle of a hole, clockwise from twelve. Home + travel lands it on STOP.
const homeAngle = (steps: number) => STOP - steps * STEP
// A point on the hole ring at a clockwise-from-top angle.
const ringPoint = (deg: number, r = RING) => {
  const rad = (deg * Math.PI) / 180
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) }
}
// Pointer offset from centre → clockwise-from-top angle in [0, 360).
const angleOf = (dx: number, dy: number) => ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
// Shortest signed difference a − b, folded into (−180, 180].
const shortest = (a: number, b: number) => ((a - b + 540) % 360) - 180

/**
 * A rotary telephone dial, rebuilt as a real control rather than a picture of
 * one. Put the pointer in a numbered hole and drag it clockwise to the finger
 * stop, then let go: the dial unwinds under a governed spring at a constant tick
 * rate and the digit lands in the readout as the hole passes home. Because the
 * pull is metered in equal steps, dialling 1 is a flick and dialling 0 is very
 * nearly a full turn — the encoding the mechanism actually used. You can also
 * click a hole or type 0–9 to dial it, Backspace to rub out the last digit, and
 * Escape to clear the line.
 *
 * The drag tracks the pointer's angle one-to-one and cannot be pulled past the
 * stop, exactly as a finger meeting the metal tab cannot; a pull that never
 * reaches the stop springs back with nothing dialled. Under
 * prefers-reduced-motion the wheel never spins — a dialled digit simply appears —
 * so the control stays fully usable with no rotation at all.
 */
export function RotaryDial({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [phi, setPhi] = useState(0)
  const [number, setNumber] = useState('')
  // The digit whose hole is glowing at the stop, for the lit-hole treatment.
  const [litSteps, setLitSteps] = useState<number | null>(null)

  // Live drag: the hole we grabbed and the pointer angle we started from. A ref
  // so the move handler never resets the gesture mid-pull.
  const drag = useRef<{ id: number; steps: number; from: number; phi0: number; hit: boolean } | null>(null)
  // Any in-flight spin (return or powered pull), so a fresh action interrupts it.
  const spin = useRef<ReturnType<typeof animate> | null>(null)
  const busy = useRef(false)
  const stopSpin = () => {
    spin.current?.stop()
    spin.current = null
  }
  useEffect(() => () => stopSpin(), [])

  const append = useCallback((digit: string) => {
    setNumber((n) => (n.length >= 14 ? n : n + digit))
  }, [])

  // Wind the dial home from wherever it is, ticking at a constant rate. Commits
  // the digit first if the pull reached the stop. Reduced motion just lands it.
  const release = useCallback(
    (steps: number, reached: boolean, fromPhi: number) => {
      if (reached) {
        append(DIGITS[steps - 1])
        setLitSteps(steps)
      }
      const settle = () => {
        setLitSteps(null)
        busy.current = false
      }
      if (reduce || fromPhi < 1) {
        setPhi(0)
        settle()
        return
      }
      busy.current = true
      spin.current = animate(fromPhi, 0, {
        duration: fromPhi / RETURN_SPEED,
        ease: 'linear',
        onUpdate: setPhi,
        onComplete: settle,
      })
    },
    [append, reduce],
  )

  // Powered dial for click / keyboard: pull the hole out to the stop, then hand
  // off to the governed return. Reduced motion skips straight to the digit.
  const dialDigit = useCallback(
    (steps: number) => {
      if (busy.current) return
      stopSpin()
      const target = travelFor(steps)
      if (reduce) {
        append(DIGITS[steps - 1])
        return
      }
      busy.current = true
      spin.current = animate(0, target, {
        duration: target / PULL_SPEED,
        ease: [0.4, 0, 0.2, 1],
        onUpdate: setPhi,
        onComplete: () => release(steps, true, target),
      })
    },
    [append, reduce, release],
  )

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (busy.current || (e.button != null && e.button !== 0)) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Map the pointer into viewBox units so the geometry lines up at any size.
    const px = ((e.clientX - rect.left) / rect.width) * 240
    const py = ((e.clientY - rect.top) / rect.height) * 240
    const dx = px - CX
    const dy = py - CY
    const dist = Math.hypot(dx, dy)
    if (dist < RING - 26 || dist > RING + 26) return
    const a = angleOf(dx, dy)
    // Which hole is under the pointer? Home angle nearest the pointer wins.
    let best = -1
    let bestErr = 999
    for (let s = 1; s <= 10; s++) {
      const err = Math.abs(shortest(a, homeAngle(s) + phi))
      if (err < bestErr) {
        bestErr = err
        best = s
      }
    }
    if (best < 0 || bestErr > STEP / 2 - 2) return
    stopSpin()
    drag.current = { id: e.pointerId, steps: best, from: a, phi0: phi, hit: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * 240
    const py = ((e.clientY - rect.top) / rect.height) * 240
    const a = angleOf(px - CX, py - CY)
    const max = travelFor(d.steps)
    // Clockwise pull only, and never past the stop the finger meets.
    const next = clamp(d.phi0 + shortest(a, d.from), 0, max)
    if (next >= max - 0.5) d.hit = true
    setPhi(next)
    setLitSteps(next >= max - 6 ? d.steps : null)
  }

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    // Committed only if the finger reached the stop — a short, abandoned pull
    // winds back with nothing dialled, exactly like the real thing.
    const max = travelFor(d.steps)
    const reached = d.hit || phi >= max - 6
    setLitSteps(null)
    release(d.steps, reached, phi)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      dialDigit(e.key === '0' ? 10 : Number(e.key))
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setNumber((n) => n.slice(0, -1))
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      e.preventDefault()
      setNumber('')
    }
  }

  const grabbing = drag.current != null

  return (
    <div className={`flex w-full max-w-sm flex-col items-center ${className}`}>
      {/* The readout — a lit glass strip above the dial. */}
      <div className="mb-8 w-full max-w-xs">
        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center">
          <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/35">Number</span>
          <span className="mt-1 block min-h-[1.75rem] font-mono text-2xl tabular-nums tracking-[0.15em] text-[#DCF87C]">
            {number || <span className="text-white/20">&mdash;</span>}
            {number && <span className="ml-0.5 animate-pulse text-[#DCF87C]/60">|</span>}
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 240 240"
        role="group"
        aria-labelledby={labelId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="h-auto w-full max-w-[19rem] touch-none select-none rounded-full outline-none drop-shadow-[0_24px_60px_rgba(0,0,0,0.5)] focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: grabbing ? 'grabbing' : 'pointer' }}
      >
        <title id={labelId}>
          Rotary dial. Drag a numbered hole to the finger stop and release, click a hole, or type 0 to 9 to dial.
          Backspace deletes, Escape clears.
        </title>
        <defs>
          <radialGradient id="rot-body" cx="0.38" cy="0.32" r="0.85">
            <stop offset="0" stopColor="#2a2e26" />
            <stop offset="0.6" stopColor="#1c1f18" />
            <stop offset="1" stopColor="#111309" />
          </radialGradient>
          <radialGradient id="rot-well" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#0c0d08" />
            <stop offset="1" stopColor="#02030100" />
          </radialGradient>
        </defs>

        {/* Fixed base plate and centre hub — these never turn. */}
        <circle cx={CX} cy={CY} r="116" fill="url(#rot-body)" stroke="rgba(255,255,255,0.06)" />
        <circle cx={CX} cy={CY} r="102" fill="none" stroke="rgba(255,255,255,0.04)" />

        {/* The number card behind the finger wheel — digits stay upright. */}
        {DIGITS.map((label, i) => {
          const steps = i + 1
          const p = ringPoint(homeAngle(steps), RING)
          const lit = litSteps === steps
          return (
            <text
              key={label}
              x={p.x}
              y={p.y + 6}
              textAnchor="middle"
              className="font-mono font-semibold"
              fontSize="18"
              fill={lit ? '#DCF87C' : 'rgba(255,255,255,0.8)'}
              aria-hidden
            >
              {label}
            </text>
          )
        })}

        {/* The finger wheel: the perforated disc you turn. Rotates by phi. */}
        <g style={{ transform: `rotate(${phi}deg)`, transformOrigin: `${CX}px ${CY}px` }} aria-hidden>
          {/* The translucent disc, so the numbers read through it. */}
          <circle cx={CX} cy={CY} r="100" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
          <circle cx={CX} cy={CY} r="40" fill="url(#rot-well)" stroke="rgba(255,255,255,0.06)" />
          {DIGITS.map((label, i) => {
            const steps = i + 1
            const p = ringPoint(homeAngle(steps), RING)
            const lit = litSteps === steps
            return (
              <circle
                key={label}
                cx={p.x}
                cy={p.y}
                r={HOLE_R}
                fill={lit ? 'rgba(220,248,124,0.16)' : 'rgba(0,0,0,0.55)'}
                stroke={lit ? '#DCF87C' : 'rgba(255,255,255,0.14)'}
                strokeWidth={lit ? 2 : 1.25}
              />
            )
          })}
        </g>

        {/* The finger stop — a fixed metal tab the pull comes to rest against. */}
        {(() => {
          const inner = ringPoint(STOP, RING - HOLE_R - 3)
          const outer = ringPoint(STOP, RING + HOLE_R + 6)
          return (
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="6"
              strokeLinecap="round"
              aria-hidden
            />
          )
        })()}
      </svg>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setNumber((n) => n.slice(0, -1))}
          disabled={!number}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Backspace
        </button>
        <button
          type="button"
          onClick={() => setNumber('')}
          disabled={!number}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {/* Announces each dialled digit to assistive tech without stealing focus. */}
      <span aria-live="polite" className="sr-only">
        {number ? `Dialled ${number.split('').join(' ')}` : 'Line clear'}
      </span>
    </div>
  )
}
