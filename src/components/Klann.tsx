import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Klann linkage leg — the other famous walking mechanism, and the Strandbeest's
// honest counterpart in the rigid-mechanism corner.
//
// Theo Jansen tuned eleven lengths until a crank would carry a foot through a
// walker's path; Joe Klann, patenting his "spider" leg in 2001 (US 6,260,862),
// reached the same gait with a leaner six-bar — a crank, two rockers bolted to
// the frame, a connecting rod, and the leg plate itself. Where Jansen's holy
// numbers are a closed recipe, Klann's leg is a plain planar linkage you can
// read joint by joint, which is exactly why it earns a place beside the beest:
// two routes to one problem, one dense and organic, one spare and mechanical.
//
// The geometry here is not invented. The link lengths are derived straight from
// the patent's Table 1 — the fully-extended ground-stride pose — so every bar is
// the real published proportion, the crank throw their canonical 0.268 unit, and
// the branch of each circle-intersection chosen so the leg assembles the one way
// that walks. Solved forward over a full turn the foot traces the patent's gait:
// a long near-flat stroke along the ground to drive the body forward, then a
// high arc up and over to swing clear for the next step.
//
// Every joint is the intersection of two circles — one of each adjoining bar's
// fixed length — so no bar can stretch and the foot can never leave the curve
// the geometry allows. From the crank pin A, with the two frame pivots P1 and P2:
//   E = circ(A, |AE| ; P2, |P2E|)        — elbow, on the lower rocker
//   K = circ(A, |AK| ; E, |EK|)          — knee, far pin of the ternary rod
//   H = circ(K, |KH| ; P1, |P1H|)        — hip, on the upper rocker
//   F = circ(K, |KF| ; H, |HF|)          — foot, apex of the rigid leg plate H K F
// Two legs share the crank half a turn apart — the iconic pair — so one foot is
// always flat on the ground driving while the other lifts and reaches; the ground
// scrolls left to stand in for the forward travel each stance stroke earns.
// DRAG to turn the crank, the button walks it, arrows nudge it. Under reduced
// motion the loop never starts — the pair is held mid-stride.

// The two frame pivots and the crank axle, in the patent's canonical unit.
const O = { x: 1.599, y: 0.75 } // crankshaft
const P1 = { x: 1.366, y: 1.366 } // upper rocker pivot
const P2 = { x: 1.009, y: 0.574 } // lower rocker pivot

// Link lengths derived from Table 1 (fully-extended pose), patent units.
const L = {
  crank: 0.268,
  AE: 0.59, // connecting rod, crank pin to elbow
  P2E: 0.32062, // lower rocker
  AK: 1.1051, // connecting rod, crank pin to knee (far pin of the ternary rod)
  EK: 0.52205, // connecting rod, elbow to knee
  P1H: 0.51764, // upper rocker
  KH: 0.89661, // leg plate, knee to hip
  KF: 0.89654, // leg plate, knee to foot
  HF: 1.73204, // leg plate, hip to foot
}
// The intersection branch for each joint — the one assembly mode that walks,
// found by reproducing Table 1 exactly at a crank angle of 180 degrees.
const S = { e: -1, k: -1, h: 1, f: -1 } as const

const SC = 100 // math unit -> svg unit
const STEP = 100 // forward travel per revolution (the stance stroke), svg units

const rad = (deg: number) => (deg * Math.PI) / 180
const norm = (deg: number) => ((deg % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

interface Pt {
  x: number
  y: number
}
interface Pose {
  A: Pt
  E: Pt
  K: Pt
  H: Pt
  F: Pt
}

// The branch-selected intersection of two circles: radius r1 about a, r2 about b.
function circ(a: Pt, r1: number, b: Pt, r2: number, sign: number): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1e-9
  const t = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const hh = Math.sqrt(Math.max(0, r1 * r1 - t * t))
  const bx = a.x + (t * dx) / d
  const by = a.y + (t * dy) / d
  return { x: bx + sign * hh * (-dy / d), y: by + sign * hh * (dx / d) }
}

// Solve the whole leg for a crank angle. Each joint derives from the one before
// it, so a single angle fixes the entire pose and nothing can drift.
function solve(deg: number): Pose {
  const th = rad(deg)
  const A = { x: O.x + L.crank * Math.cos(th), y: O.y + L.crank * Math.sin(th) }
  const E = circ(A, L.AE, P2, L.P2E, S.e)
  const K = circ(A, L.AK, E, L.EK, S.k)
  const H = circ(K, L.KH, P1, L.P1H, S.h)
  const F = circ(K, L.KF, H, L.HF, S.f)
  return { A, E, K, H, F }
}

// Math coords (y up) -> svg coords (y down), scaled.
const sx = (p: Pt) => p.x * SC
const sy = (p: Pt) => -p.y * SC
const bar = (p: Pt, q: Pt) => `M${sx(p).toFixed(1)} ${sy(p).toFixed(1)}L${sx(q).toFixed(1)} ${sy(q).toFixed(1)}`
const tri = (p: Pt, q: Pt, r: Pt) =>
  `M${sx(p).toFixed(1)} ${sy(p).toFixed(1)}L${sx(q).toFixed(1)} ${sy(q).toFixed(1)}L${sx(r).toFixed(1)} ${sy(r).toFixed(1)}Z`

// One leg, drawn from its pose. `lead` lights the crank throw and foot in the
// accent so the near leg of the pair reads as the one being driven.
function Leg({ pose, lead }: { pose: Pose; lead: boolean }) {
  const { A, E, K, H, F } = pose
  const limb = lead ? 'rgba(220,248,124,0.62)' : 'rgba(255,255,255,0.5)'
  const spar = lead ? 'rgba(220,248,124,0.4)' : 'rgba(255,255,255,0.32)'
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* the leg plate H K F, filled faintly so the rigid member reads */}
      <path d={tri(H, K, F)} fill={lead ? 'rgba(220,248,124,0.08)' : 'rgba(255,255,255,0.05)'} stroke="none" />
      {/* the ternary connecting rod A E K, filled faintly */}
      <path d={tri(A, E, K)} fill={lead ? 'rgba(220,248,124,0.06)' : 'rgba(255,255,255,0.04)'} stroke="none" />
      {/* the two grounded rockers */}
      <path d={bar(P2, E)} stroke={spar} strokeWidth="3" />
      <path d={bar(P1, H)} stroke={spar} strokeWidth="3" />
      {/* the connecting rod, A to elbow to knee */}
      <path d={bar(A, E)} stroke={limb} strokeWidth="2.6" />
      <path d={bar(E, K)} stroke={limb} strokeWidth="2.6" />
      {/* the leg plate edges */}
      <path d={bar(H, K)} stroke={limb} strokeWidth="2.8" />
      <path d={bar(K, F)} stroke={limb} strokeWidth="2.8" />
      <path d={bar(H, F)} stroke={spar} strokeWidth="2.2" />
      {/* the crank throw, drawn in the accent as the bar that is driven */}
      <path d={bar(O, A)} stroke="#DCF87C" strokeWidth="3.6" />
      {/* pin joints */}
      {[E, K, H].map((p, idx) => (
        <circle
          key={idx}
          cx={sx(p)}
          cy={sy(p)}
          r="3"
          fill="#12140f"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.4"
        />
      ))}
      <circle cx={sx(A)} cy={sy(A)} r="3.4" fill="#12140f" stroke="#DCF87C" strokeWidth="1.8" />
      <circle
        cx={sx(F)}
        cy={sy(F)}
        r="4"
        fill={lead ? '#DCF87C' : 'rgba(255,255,255,0.8)'}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="0.6"
      />
    </g>
  )
}

// viewBox holds the whole swept linkage, the frame above it, and the ground
// below, with a little air on every side (computed from the swept bounds).
const VB = { x: -22, y: -204, w: 230, h: 234 }
const GROUND = 8 // svg y the flat of the foot path rests on
const SAMPLES = 220

export function Klann({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  // Crank angle, kept unbounded so drag and walk cross the 0/360 seam smoothly.
  const [theta, setTheta] = useState(26)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  // The foot locus, sampled once from the same solver the live legs use, so the
  // ghost curve is exactly the path the foot is constrained to.
  const footPath = useMemo(() => {
    let d = ''
    for (let s = 0; s <= SAMPLES; s++) {
      const F = solve((s / SAMPLES) * 360).F
      d += `${s === 0 ? 'M' : 'L'}${sx(F).toFixed(1)} ${sy(F).toFixed(1)} `
    }
    return d + 'Z'
  }, [])

  const legA = solve(theta)
  const legB = solve(theta + 180)

  // Continuous walk (skipped under reduced motion — there the button steps the
  // crank on at once instead of sweeping the in-between frames).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setTheta((th) => th + dt * 104) // deg/s — an unhurried stride
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastT.current = 0
    }
  }, [running, reduce])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const pointerAngle = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return lastPointer.current
    const rect = svg.getBoundingClientRect()
    const x = VB.x + ((clientX - rect.left) / rect.width) * VB.w
    const y = VB.y + ((clientY - rect.top) / rect.height) * VB.h
    // angle about the crank axle, in the svg frame (y is flipped back to math)
    return norm((Math.atan2(-(y - sy(O)), x - sx(O)) * 180) / Math.PI)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    lastPointer.current = pointerAngle(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const p = pointerAngle(e.clientX, e.clientY)
    const step = shortest(lastPointer.current, p)
    lastPointer.current = p
    setTheta((th) => th + step)
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  const nudge = useCallback((delta: number) => {
    setRunning(false)
    setTheta((th) => th + delta)
  }, [])

  const toggleRun = () => {
    if (reduce) {
      setTheta((th) => th + 120) // step the stride on without a sweep
      return
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    setRunning(false)
    setTheta(26)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 15 : 3
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(s)
    else if (e.key === 'Home') {
      setRunning(false)
      setTheta(0)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const phase = Math.round(norm(theta))
  // Ground ticks scroll left by the forward travel the stance would earn.
  const travel = (norm(theta) / 360) * STEP
  const tickGap = 22
  const tickShift = ((travel % tickGap) + tickGap) % tickGap

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Crank ${phase} degrees`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Klann walking linkage, built to the patent proportions. Drag to turn the crank, arrow keys nudge it, Shift for
          a bigger step, Space walks or stops it, Home returns the crank to the top.
        </span>
        <svg
          ref={svgRef}
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <linearGradient id="kl-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>
          </defs>

          {/* Ground: a hairline the flat of the stride rests on, with ticks that
              scroll left to stand in for the forward travel each stroke earns. */}
          <line
            x1={VB.x + 6}
            y1={GROUND}
            x2={VB.x + VB.w - 6}
            y2={GROUND}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1"
          />
          <g stroke="rgba(255,255,255,0.1)" strokeWidth="1">
            {Array.from({ length: Math.ceil(VB.w / tickGap) + 2 }, (_, idx) => {
              const gx = VB.x + 6 + idx * tickGap - tickShift
              return <line key={idx} x1={gx} y1={GROUND} x2={gx - 7} y2={GROUND + 8} />
            })}
          </g>

          {/* The foot locus: the flat-bottomed gait the foot is held to, once. */}
          <path d={footPath} fill="none" stroke="rgba(220,248,124,0.2)" strokeWidth="1.3" strokeDasharray="3 5" />

          {/* The frame the leg hangs from — the plate carrying O, P1 and P2. */}
          <g>
            <path
              d={tri(O, P1, P2)}
              fill="url(#kl-body)"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </g>

          {/* The back leg first so the lit front leg sits over it. */}
          <Leg pose={legB} lead={false} />
          <Leg pose={legA} lead />

          {/* The crank: one throw to each leg, half a turn apart, and the axle hub. */}
          <path
            d={bar(legB.A, legA.A)}
            stroke="#DCF87C"
            strokeWidth="3.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={sx(P1)} cy={sy(P1)} r="3.6" fill="rgba(255,255,255,0.7)" />
          <circle cx={sx(P2)} cy={sy(P2)} r="3.6" fill="rgba(255,255,255,0.7)" />
          <circle cx={sx(O)} cy={sy(O)} r="6" fill="#12140f" stroke="#DCF87C" strokeWidth="2.2" />
          <circle cx={sx(O)} cy={sy(O)} r="1.8" fill="#DCF87C" />
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-lg border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-2 text-center font-mono text-lg tabular-nums text-[#DCF87C]">
          {phase.toString().padStart(3, '0')}&deg;
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-[#DCF87C]/70">crank</span>
        </div>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {reduce ? 'Step' : running ? 'Stop' : 'Walk'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Reset
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {`Crank at ${phase} degrees`}
      </span>
    </div>
  )
}
