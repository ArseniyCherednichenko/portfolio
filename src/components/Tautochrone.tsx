import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Tautochrone — the curve of equal descent, and the honest sibling of the
// Brachistochrone a few racks over.
//
// That one asks which shape gets a single bead down fastest; this asks a
// stranger question and gives a stranger answer. Take one curve — the very same
// cycloid, only turned up into a cup — and release several beads on it from
// different heights at the same instant. They all reach the bottom together.
// Not nearly, not on average: at the same tick of the clock, to the frame. A
// bead dropped near the rim has further to fall and a longer road to travel, and
// it makes up exactly the difference by moving faster the whole way down. Huygens
// found this in 1659 and hung a pendulum clock on it, because a swing that keeps
// its time whatever its amplitude is a clock that does not drift as it winds down.
//
// The physics is exact, not integrated — there is no stepper here and so no drift
// to accumulate. Measure arc length s from the lowest point of the cup and the
// cycloid hands you s = 4R·sin(θ/2), which makes the height above the bottom
// h = s²/(8R): the restoring pull along the wire, g·dh/ds = g·s/(4R), is linear
// in s. That is simple harmonic motion in arc length, so every bead obeys
// s(t) = s₀·cos(ω t) with the one shared ω = √(g/4R) — the amplitude s₀ sets how
// far each starts out but drops clean out of the quarter-period to the bottom,
// T = (π/2)/ω = π·√(R/g), the same number for all of them. The beads are placed
// by that closed form every frame, so the convergence is the maths, not a tuning.

// Geometry, in viewBox units (y points down, as on screen).
const R = 13 // cycloid radius; the cup spans x ∈ [50 − Rπ, 50 + Rπ]
const G = 120 // gravity, viewBox units/s²
const CX = 50 // horizontal centre (lowest point)
const BASE_Y = 46 // screen y of the lowest point; height lifts the curve toward y=0
const OMEGA = Math.sqrt(G / (4 * R)) // shared angular frequency of the arc-length SHM
const T_DESCENT = Math.PI / 2 / OMEGA // quarter period: time from any release to the bottom
const S_MAX = 4 * R // arc length at the rim (θ = π)
const N = 240 // samples for the drawn cup

type Pt = { x: number; y: number }

// Map a signed arc length s (from the bottom; sign gives the side) to a screen
// point on the cycloid cup. θ = 2·asin(s/4R); x = R(θ + sinθ), height = R(1−cosθ).
function pointAtArc(s: number): Pt {
  const sign = s < 0 ? -1 : 1
  const mag = Math.min(Math.abs(s), S_MAX)
  const theta = sign * 2 * Math.asin(mag / S_MAX)
  const x = CX + R * (theta + Math.sin(theta))
  const height = R * (1 - Math.cos(theta)) // above the bottom
  return { x, y: BASE_Y - height }
}

// The drawn cup, θ sweeping rim to rim.
function cupPath(): string {
  const pts: string[] = []
  for (let i = 0; i <= N; i++) {
    const theta = -Math.PI + (2 * Math.PI * i) / N
    const x = CX + R * (theta + Math.sin(theta))
    const y = BASE_Y - R * (1 - Math.cos(theta))
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return pts.join(' ')
}

interface Rider {
  // Signed starting arc length (amplitude of the SHM); sign chooses the side.
  s0: number
  color: string
  label: string
}

// Four riders at different heights and alternating sides, so they rush the
// bottom from both directions and still meet there on the same frame. The lime
// hero leads; the others are cooler tints that recede.
const RIDERS: Rider[] = [
  { s0: -S_MAX * 0.985, color: '#DCF87C', label: 'Rim' },
  { s0: S_MAX * 0.78, color: '#A7E8B0', label: 'High' },
  { s0: -S_MAX * 0.55, color: '#5BD8C4', label: 'Mid' },
  { s0: S_MAX * 0.3, color: '#7FB8E8', label: 'Low' },
]

// Closed-form arc length at time t for a rider: SHM, s(t) = s₀·cos(ω t).
const arcAt = (s0: number, t: number) => s0 * Math.cos(OMEGA * t)

const DESCENT_LABEL = `${T_DESCENT.toFixed(2)}s`

export function Tautochrone({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const path = useMemo(cupPath, [])

  const riderRefs = useRef<Array<SVGGElement | null>>(RIDERS.map(() => null))
  const clockRef = useRef<HTMLSpanElement | null>(null)
  const metRef = useRef<HTMLSpanElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTs = useRef<number | null>(null)
  const elapsed = useRef(0)

  const [running, setRunning] = useState(false)
  const [slow, setSlow] = useState(false)
  // Reduced-motion frozen time along the descent (0 = release, T_DESCENT = bottom).
  const [freeze, setFreeze] = useState(0)
  const [arrived, setArrived] = useState(false)

  const slowRef = useRef(slow)
  slowRef.current = slow

  // Paint every rider from the closed form at time t, plus the shared clock and
  // the "met at the bottom" marker once the descent completes.
  const paint = (t: number) => {
    RIDERS.forEach((r, i) => {
      const p = pointAtArc(arcAt(r.s0, t))
      const g = riderRefs.current[i]
      if (g) g.setAttribute('transform', `translate(${p.x} ${p.y})`)
    })
    if (clockRef.current) clockRef.current.textContent = `${Math.min(t, T_DESCENT).toFixed(2)}s`
    const met = t >= T_DESCENT - 1e-3
    if (metRef.current) metRef.current.style.opacity = met ? '1' : '0'
  }

  // Full-motion loop: run the descent once (release → bottom), then hold with the
  // beads gathered at the lowest point — the whole point is the shared arrival.
  useEffect(() => {
    if (reduce || !running) return
    const loop = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts
      let dt = (ts - lastTs.current) / 1000
      lastTs.current = ts
      if (dt > 0.1) dt = 0.1 // tab-away guard
      elapsed.current += dt * (slowRef.current ? 0.4 : 1)
      if (elapsed.current >= T_DESCENT) {
        elapsed.current = T_DESCENT
        paint(T_DESCENT)
        setArrived(true)
        setRunning(false)
        return
      }
      paint(elapsed.current)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      lastTs.current = null
    }
  }, [running, reduce])

  // Reduced-motion: repaint the frozen still frame whenever the frozen time moves.
  useEffect(() => {
    if (!reduce) return
    paint(freeze)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, freeze])

  // Paint the released (t = 0) frame once on mount.
  useEffect(() => {
    paint(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const release = () => {
    elapsed.current = 0
    lastTs.current = null
    setArrived(false)
    if (reduce) {
      setFreeze(0)
    } else {
      paint(0)
      setRunning(true)
    }
  }

  const reset = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    elapsed.current = 0
    lastTs.current = null
    setRunning(false)
    setArrived(false)
    setFreeze(0)
    paint(0)
  }

  // Reduced-motion "Step": walk the frozen time toward the bottom.
  const step = () => setFreeze((f) => Math.min(f + T_DESCENT * 0.25, T_DESCENT))

  const met = reduce ? freeze >= T_DESCENT - 1e-3 : arrived
  const announcement = met
    ? `All four beads reach the bottom together, at ${DESCENT_LABEL} — the same time whatever height each began from.`
    : running
      ? 'Beads released from four different heights.'
      : 'Ready. Release the beads and watch them meet at the bottom.'

  return (
    <div className={className}>
      <div className="mx-auto max-w-2xl">
        <svg viewBox="0 0 100 54" className="w-full" aria-hidden="true">
          <defs>
            <radialGradient id="tauto-bottom" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#DCF87C" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#DCF87C" stopOpacity="0" />
            </radialGradient>
            {RIDERS.map((r, i) => (
              <radialGradient key={i} id={`tauto-bead-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={r.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={r.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* The cup itself — one cycloid, turned up. */}
          <path d={path} fill="none" stroke="#DCF87C" strokeOpacity="0.8" strokeWidth="0.9" strokeLinecap="round" />

          {/* The lowest point: the mark every bead is racing toward. */}
          <circle cx={CX} cy={BASE_Y} r="6" fill="url(#tauto-bottom)" />
          <circle cx={CX} cy={BASE_Y} r="1.6" fill="#DCF87C" />
          {/* A ring that lights when they have all gathered there. */}
          <circle
            ref={metRef as React.RefObject<SVGCircleElement>}
            cx={CX}
            cy={BASE_Y}
            r="3.4"
            fill="none"
            stroke="#DCF87C"
            strokeWidth="0.5"
            strokeOpacity="0.9"
            style={{ opacity: 0, transition: reduce ? 'none' : 'opacity 0.3s ease' }}
          />

          {/* The beads — a soft halo under a solid core. */}
          {RIDERS.map((r, i) => (
            <g key={i} ref={(el) => (riderRefs.current[i] = el)}>
              <circle r="3.6" fill={`url(#tauto-bead-${i})`} />
              <circle r="1.6" fill={r.color} />
            </g>
          ))}
        </svg>
      </div>

      {/* Legend + the single shared descent time. */}
      <div className="mx-auto mt-5 max-w-md">
        <ul className="grid grid-cols-4 gap-2 text-center">
          {RIDERS.map((r, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.02] px-1.5 py-2.5">
              <span className="flex items-center justify-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="text-[0.7rem] font-semibold text-white/75">{r.label}</span>
              </span>
              <span
                className="mt-1 block font-display text-sm font-semibold tabular-nums"
                style={{ color: r.color }}
              >
                {DESCENT_LABEL}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-[0.7rem] uppercase tracking-[0.2em] text-white/35">
          Four heights, one descent time
        </p>
      </div>

      {/* Controls. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={release}
          className="rounded-full bg-[#DCF87C] px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCF87C]"
        >
          {reduce ? 'Release (show result)' : 'Release the beads'}
        </button>
        {reduce && (
          <button
            type="button"
            onClick={step}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
          >
            Step
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
        >
          Reset
        </button>
        {!reduce && (
          <button
            type="button"
            onClick={() => setSlow((s) => !s)}
            aria-pressed={slow}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 ${
              slow
                ? 'border-[#DCF87C]/60 text-[#DCF87C]'
                : 'border-white/15 text-white/80 hover:border-white/35 hover:text-white'
            }`}
          >
            Slow motion
          </button>
        )}
        <span className="ml-1 font-display text-sm tabular-nums text-white/55">
          <span ref={clockRef}>0.00s</span>
        </span>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
