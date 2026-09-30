import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A mechanical orrery: the Sun at the centre and the planets out to Saturn
// wheeling around it, the way the brass grand orreries of the 1700s modelled
// the solar system on a table. It runs on one clock.
//
// The single source of truth is `days` — simulated days elapsed, an unbounded
// float. Every body's angle is derived from it alone: angle = phase0 + 360 *
// days / period, where `period` is the body's real sidereal orbital period in
// days. So the *relative speeds are true* — Mercury laps the Sun four times a
// year while Saturn barely creeps — even though the starting angles are
// illustrative and the orbit radii are spaced for legibility, not to distance
// scale (Saturn really sits ~24× further out than Mercury; on a table it would
// not fit). Nothing on screen can drift from the clock, because there is
// nothing else to drift from.
//
// Dragging the dial scrubs that clock: a full turn of the pointer about the Sun
// is exactly one Earth year, so Earth tracks your hand one to one and every
// other planet moves at its own honest rate against it. The run loop advances
// the same `days`; a keyboard nudge steps it; and under prefers-reduced-motion
// the free run is gated off — the model holds a still frame and steps only on
// demand.

const CX = 180
const CY = 180

const rad = (deg: number) => (deg * Math.PI) / 180
// Shortest signed step from a to b, wrapped to (-180, 180].
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180
const norm = (deg: number) => ((deg % 360) + 360) % 360

interface Body {
  name: string
  /** Real sidereal orbital period, in days. Fact, not invented. */
  period: number
  /** Orbit radius on the dial (spaced for legibility, not to distance scale). */
  orbit: number
  /** Drawn body radius. */
  size: number
  /** Illustrative starting angle so the model opens visually spread. */
  phase0: number
  color: string
  /** A faint glow tint used behind the larger bodies. */
  glow?: string
  /** Saturn's ring, drawn as an ellipse cutting across the disc. */
  ring?: boolean
}

// Sun + the six planets a classical grand orrery carried (Mercury out to
// Saturn). Periods are the real sidereal years, in days.
const BODIES: Body[] = [
  { name: 'Mercury', period: 87.969, orbit: 46, size: 2.6, phase0: 20, color: '#9c948a' },
  { name: 'Venus', period: 224.701, orbit: 64, size: 3.8, phase0: 140, color: '#e6d5a4' },
  { name: 'Earth', period: 365.256, orbit: 84, size: 4.0, phase0: 250, color: '#6fb0cc', glow: 'rgba(111,176,204,0.5)' },
  { name: 'Mars', period: 686.98, orbit: 104, size: 3.2, phase0: 60, color: '#c26a41' },
  { name: 'Jupiter', period: 4332.59, orbit: 133, size: 8.2, phase0: 300, color: '#cbb08a', glow: 'rgba(203,176,138,0.35)' },
  { name: 'Saturn', period: 10759.22, orbit: 162, size: 6.8, phase0: 110, color: '#d8c79a', glow: 'rgba(216,199,154,0.3)', ring: true },
]

// The Moon rides Earth's drawn position; a real sidereal month.
const MOON_PERIOD = 27.322
const MOON_PHASE0 = 40
const EARTH_PERIOD = 365.256

const EARTH_YEAR = 365.256
const DAYS_PER_SEC = 42 // free-run rate: a busy Mercury, a crawling Saturn.

// Where a body sits on the dial at a given day count.
function bodyAt(b: Body, days: number) {
  const a = rad(b.phase0 + (360 * days) / b.period)
  return { x: CX + b.orbit * Math.cos(a), y: CY + b.orbit * Math.sin(a) }
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const years = (days: number) => days / EARTH_YEAR

export function Orrery({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [days, setDays] = useState(0)
  const [running, setRunning] = useState(!reduce)
  const [selected, setSelected] = useState('Earth')

  const svgRef = useRef<SVGSVGElement | null>(null)
  const daysRef = useRef(days)
  daysRef.current = days
  const runningRef = useRef(running)
  runningRef.current = running

  // Drag rides refs so a move never restarts the gesture. We accumulate the
  // shortest pointer step about the Sun into `days`, scaled so one full turn is
  // one Earth year — Earth then tracks the pointer one to one.
  const dragging = useRef(false)
  const lastPointer = useRef(0)

  // One run loop owns the free motion. It advances the same `days` the drag and
  // keyboard write, so there is only ever one clock. Gated off under reduced
  // motion — there the model holds still and steps only on demand.
  useEffect(() => {
    if (reduce || !running) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) // clamp tab-away jumps
      last = now
      setDays((d) => d + dt * DAYS_PER_SEC)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, running])

  // Pointer bearing about the Sun, in degrees (0 = +x, clockwise in SVG space).
  const pointerBearing = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return lastPointer.current
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * 360
    const py = ((clientY - rect.top) / rect.height) * 360
    return (Math.atan2(py - CY, px - CX) * 180) / Math.PI
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false) // grabbing the model stops the free run, like a real hand
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    lastPointer.current = pointerBearing(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const p = pointerBearing(e.clientX, e.clientY)
    const d = shortest(lastPointer.current, p)
    lastPointer.current = p
    // A full turn of the pointer is one Earth year of the clock.
    setDays((v) => v + (d / 360) * EARTH_PERIOD)
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  const step = useCallback((delta: number) => {
    setRunning(false)
    setDays((d) => d + delta)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(s)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-s)
    else if (e.key === 'PageUp') step(EARTH_YEAR)
    else if (e.key === 'PageDown') step(-EARTH_YEAR)
    else if (e.key === 'Home') {
      setRunning(false)
      setDays(0)
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (reduce) step(30) // no free run under reduced motion — step a month
      else setRunning((r) => !r)
    } else handled = false
    if (handled) e.preventDefault()
  }

  const sel = BODIES.find((b) => b.name === selected) ?? BODIES[2]
  const dayOfYear = Math.round(norm((days / EARTH_YEAR) * 360) / 360 * EARTH_YEAR)
  const elapsedYears = years(days)
  const moonAngle = rad(MOON_PHASE0 + (360 * days) / MOON_PERIOD)

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={Math.round(EARTH_YEAR)}
        aria-valuenow={dayOfYear}
        aria-valuetext={`Day ${dayOfYear} of the Earth year; ${elapsedYears.toFixed(1)} years elapsed`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full max-w-[360px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Orrery of the Sun and planets out to Saturn. Drag around the Sun to scrub time — one full turn is an Earth
          year. Arrow keys step a day, Shift ten days, Page Up and Page Down a year, Home returns to the start,
          Space starts or stops the motion.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 360 360"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
          aria-hidden
        >
          <defs>
            <radialGradient id="orr-space" cx="0.5" cy="0.5" r="0.6">
              <stop offset="0" stopColor="rgba(28,30,24,0.55)" />
              <stop offset="1" stopColor="rgba(6,7,5,0.85)" />
            </radialGradient>
            <radialGradient id="orr-sun" cx="0.42" cy="0.4" r="0.7">
              <stop offset="0" stopColor="#fff8e0" />
              <stop offset="0.4" stopColor="#DCF87C" />
              <stop offset="1" stopColor="#e0a23a" />
            </radialGradient>
            <radialGradient id="orr-earth" cx="0.4" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#9fd0e2" />
              <stop offset="1" stopColor="#4f8ba6" />
            </radialGradient>
          </defs>

          {/* The field of space. */}
          <circle cx={CX} cy={CY} r={176} fill="url(#orr-space)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Orbit rings — the selected body's ring lit lime. */}
          {BODIES.map((b) => {
            const on = b.name === selected
            return (
              <circle
                key={`ring-${b.name}`}
                cx={CX}
                cy={CY}
                r={b.orbit}
                fill="none"
                stroke={on ? 'rgba(220,248,124,0.5)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={on ? 1.2 : 0.8}
                strokeDasharray={on ? undefined : '1 5'}
              />
            )
          })}

          {/* The Sun, with a soft corona. */}
          <circle cx={CX} cy={CY} r={26} fill="rgba(220,248,124,0.1)" />
          <circle cx={CX} cy={CY} r={15} fill="url(#orr-sun)" stroke="rgba(255,240,190,0.5)" strokeWidth="0.6" />

          {/* Each planet at its derived position. */}
          {BODIES.map((b) => {
            const p = bodyAt(b, days)
            const on = b.name === selected
            return (
              <g key={b.name}>
                {b.glow && <circle cx={p.x} cy={p.y} r={b.size + 5} fill={b.glow} />}
                {on && (
                  <circle cx={p.x} cy={p.y} r={b.size + 4} fill="none" stroke="#DCF87C" strokeWidth="1.2" />
                )}
                {b.ring && (
                  <ellipse
                    cx={p.x}
                    cy={p.y}
                    rx={b.size + 6}
                    ry={(b.size + 6) / 2.6}
                    fill="none"
                    stroke="rgba(230,214,168,0.75)"
                    strokeWidth="1.4"
                    transform={`rotate(-18 ${p.x} ${p.y})`}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={b.size}
                  fill={b.name === 'Earth' ? 'url(#orr-earth)' : b.color}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth="0.5"
                />
                {/* Earth carries its Moon. */}
                {b.name === 'Earth' && (
                  <circle
                    cx={p.x + 9 * Math.cos(moonAngle)}
                    cy={p.y + 9 * Math.sin(moonAngle)}
                    r={1.5}
                    fill="rgba(220,220,220,0.9)"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Readout: the selected body's real orbit, and the clock in Earth years. */}
      <div className="mt-6 w-full max-w-[360px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
        <div className="font-display text-lg font-semibold tracking-tight text-white/90">{sel.name}</div>
        <div className="mt-1 text-sm text-white/55">
          Orbits the Sun once every{' '}
          <span className="font-semibold text-[#DCF87C]">
            {sel.period < 365 ? `${sel.period.toFixed(0)} days` : `${years(sel.period).toFixed(1)} Earth years`}
          </span>{' '}
          <span className="text-white/35">({fmt(sel.period)} days)</span>
        </div>
        <div className="mt-3 border-t border-white/8 pt-3 text-xs tabular-nums text-white/45">
          Clock: <span className="text-white/70">{elapsedYears.toFixed(2)} Earth years</span> ·{' '}
          {fmt(days)} days · {fmt(days / sel.period)} {sel.name} orbits
        </div>
      </div>

      {/* Body selector + run controls. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {BODIES.map((b) => {
          const on = b.name === selected
          return (
            <button
              key={b.name}
              type="button"
              onClick={() => setSelected(b.name)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                on
                  ? 'border-[#DCF87C]/50 bg-[#DCF87C]/10 text-[#DCF87C]'
                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white'
              }`}
            >
              {b.name}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {!reduce && (
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
          >
            {running ? 'Pause' : 'Run'}
          </button>
        )}
        {reduce && (
          <button
            type="button"
            onClick={() => step(30)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
          >
            Step a month
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setRunning(false)
            setDays(0)
          }}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Reset
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {`${sel.name} selected. ${elapsedYears.toFixed(1)} Earth years elapsed.`}
      </span>
    </div>
  )
}
