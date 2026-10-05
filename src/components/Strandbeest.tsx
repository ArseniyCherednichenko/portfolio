import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Strandbeest leg — Theo Jansen's walking linkage, driven by one turning crank.
//
// Jansen spent years tuning eleven link lengths until a single rotating crank
// would carry a foot through the one path a walker needs: a long flat sweep
// along the ground to push the body forward, then a high arc up and over to
// swing clear for the next step. Those eleven numbers are the same on every
// Strandbeest he has built since; he calls them the holy numbers, and they are
// the only magic here — everything the foot does falls out of them.
//
// The mechanism is three four-bar loops sharing a frame. Two points are bolted
// to the body and never move: the crank axle O and the fixed pivot G, set an
// `a`-by-`l` offset apart. The crank throw m swings the pin J1 around O; from
// there every remaining joint is the intersection of two circles — one of each
// adjoining bar's length — so the bars can never stretch and the foot can never
// leave the curve the geometry allows:
//   J2 = circ(J1, j ; G, b)      J4 = circ(J1, k ; G, c)
//   J3 = circ(J2, e ; G, d)      J5 = circ(J3, f ; J4, g)
//   F  = circ(J4, i ; J5, h)     — the foot, apex of the rigid triangle J4 J5 F
// The branch of each intersection is fixed so the leg assembles the same way
// all the way round and the foot traces Jansen's flat-bottomed D once per turn.
//
// Two legs share the crank half a turn apart — the iconic pair — so while one
// foot is flat on the ground driving forward, the other is lifted and reaching;
// there is always a foot down. The ground scrolls left to stand in for the
// forward travel each stance stroke would earn. The single piece of state is the
// crank angle: DRAG to turn it, the buttons walk it on their own, arrows nudge
// it. Under reduced motion the loop never starts — the pair is held mid-stride.

// Jansen's holy numbers (link lengths, his canonical unit).
const H = {
  a: 38, b: 41.5, c: 39.3, d: 40.1, e: 55.8, f: 39.4,
  g: 36.7, h: 65.7, i: 49, j: 50, k: 61.9, l: 7.8, m: 15,
}
// The fixed pivot, an a-by-l offset from the crank axle at the origin.
const G = { x: -H.a, y: H.l }
// The intersection branch for each joint — the one assembly mode that walks.
const S = { s2: 1, s3: 1, s4: -1, s5: 1, s6: -1 } as const

const GROUND = 91.8 // the y the flat of the foot path rests on
const STEP = 59.3 // forward stroke the stance earns per revolution, in link units

const rad = (deg: number) => (deg * Math.PI) / 180
const norm = (deg: number) => ((deg % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

interface Pt {
  x: number
  y: number
}
interface Pose {
  O: Pt
  J1: Pt
  J2: Pt
  J3: Pt
  J4: Pt
  J5: Pt
  F: Pt
}

// The branch-selected intersection of two circles: radius r1 about a, r2 about b.
function circ(a: Pt, r1: number, b: Pt, r2: number, sign: number): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1e-6
  const t = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const hh = Math.sqrt(Math.max(0, r1 * r1 - t * t))
  const bx = a.x + (t * dx) / d
  const by = a.y + (t * dy) / d
  return { x: bx + sign * hh * (-dy / d), y: by + sign * hh * (dx / d) }
}

// Solve the whole leg for a crank angle. Every joint derives from the one before
// it, so a single angle fixes the entire pose and nothing can drift.
function solve(deg: number): Pose {
  const th = rad(deg)
  const O = { x: 0, y: 0 }
  const J1 = { x: H.m * Math.cos(th), y: H.m * Math.sin(th) }
  const J2 = circ(J1, H.j, G, H.b, S.s2)
  const J3 = circ(J2, H.e, G, H.d, S.s3)
  const J4 = circ(J1, H.k, G, H.c, S.s4)
  const J5 = circ(J3, H.f, J4, H.g, S.s5)
  const F = circ(J4, H.i, J5, H.h, S.s6)
  return { O, J1, J2, J3, J4, J5, F }
}

const bar = (p: Pt, q: Pt) => `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}`

// One leg, drawn from its pose. `lead` lights the crank throw and foot in the
// accent so the near leg of the pair reads as the one being driven.
function Leg({ pose, lead }: { pose: Pose; lead: boolean }) {
  const { O, J1, J2, J3, J4, J5, F } = pose
  const limb = lead ? 'rgba(220,248,124,0.6)' : 'rgba(255,255,255,0.5)'
  const spar = lead ? 'rgba(220,248,124,0.4)' : 'rgba(255,255,255,0.34)'
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* foot triangle, filled faintly so the rigid plate reads */}
      <path
        d={`M${J4.x.toFixed(1)} ${J4.y.toFixed(1)}L${J5.x.toFixed(1)} ${J5.y.toFixed(1)}L${F.x.toFixed(1)} ${F.y.toFixed(1)}Z`}
        fill={lead ? 'rgba(220,248,124,0.08)' : 'rgba(255,255,255,0.05)'}
        stroke="none"
      />
      {/* the upper and lower bars */}
      <path d={bar(G, J2)} stroke={spar} strokeWidth="2.4" />
      <path d={bar(J1, J2)} stroke={limb} strokeWidth="2.4" />
      <path d={bar(J2, J3)} stroke={spar} strokeWidth="2.4" />
      <path d={bar(G, J3)} stroke={spar} strokeWidth="2.4" />
      <path d={bar(J1, J4)} stroke={limb} strokeWidth="2.4" />
      <path d={bar(G, J4)} stroke={spar} strokeWidth="2.4" />
      <path d={bar(J3, J5)} stroke={spar} strokeWidth="2.4" />
      <path d={bar(J4, J5)} stroke={limb} strokeWidth="2.6" />
      <path d={bar(J4, F)} stroke={limb} strokeWidth="2.6" />
      <path d={bar(J5, F)} stroke={limb} strokeWidth="2.6" />
      {/* the crank throw, drawn in the accent as the bar that is driven */}
      <path d={bar(O, J1)} stroke="#DCF87C" strokeWidth="3.4" />
      {/* pin joints */}
      {[J2, J3, J4, J5].map((p, idx) => (
        <circle key={idx} cx={p.x} cy={p.y} r="2.6" fill="#12140f" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" />
      ))}
      <circle cx={J1.x} cy={J1.y} r="3" fill="#12140f" stroke="#DCF87C" strokeWidth="1.6" />
      <circle cx={F.x} cy={F.y} r="3.4" fill={lead ? '#DCF87C' : 'rgba(255,255,255,0.8)'} stroke="rgba(0,0,0,0.4)" strokeWidth="0.6" />
    </g>
  )
}

// viewBox chosen to hold the whole swept linkage, the chassis above it, and the
// ground below, with a little air on every side.
const VB = { x: -132, y: -52, w: 180, h: 186 }
const SAMPLES = 180

export function Strandbeest({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  // Crank angle, kept unbounded so drag and walk cross the 0/360 seam smoothly.
  const [theta, setTheta] = useState(24)
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
      d += `${s === 0 ? 'M' : 'L'}${F.x.toFixed(1)} ${F.y.toFixed(1)} `
    }
    return d + 'Z'
  }, [])

  const legA = solve(theta)
  const legB = solve(theta + 180)

  // Continuous walk (skipped under reduced motion — there the buttons step the
  // crank on at once instead of sweeping the in-between frames).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setTheta((th) => th + dt * 96) // 96 deg/s — an unhurried stroll
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
    return norm((Math.atan2(y, x) * 180) / Math.PI)
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

  const toggleRun = () => {
    if (reduce) {
      setTheta((th) => th + 120) // step the stride on without a sweep
      return
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    setRunning(false)
    setTheta(24)
  }

  const phase = Math.round(norm(theta))
  // Ground ticks scroll left by the forward travel the stance would earn.
  const travel = (norm(theta) / 360) * STEP
  const tickGap = 18
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
          Theo Jansen walking linkage. Drag to turn the crank, arrow keys nudge it, Shift for a bigger step, Space walks
          or stops it, Home returns the crank to the top.
        </span>
        <svg
          ref={svgRef}
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <linearGradient id="sb-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>
          </defs>

          {/* Ground: a hairline the flat of the stride rests on, with ticks that
              scroll left to stand in for the forward travel each stroke earns. */}
          <line x1={VB.x + 6} y1={GROUND} x2={VB.x + VB.w - 6} y2={GROUND} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <g stroke="rgba(255,255,255,0.1)" strokeWidth="1">
            {Array.from({ length: Math.ceil(VB.w / tickGap) + 2 }, (_, idx) => {
              const gx = VB.x + 6 + idx * tickGap - tickShift
              return <line key={idx} x1={gx} y1={GROUND} x2={gx - 6} y2={GROUND + 7} />
            })}
          </g>

          {/* The foot locus: the flat-bottomed D the foot is held to, drawn once. */}
          <path d={footPath} fill="none" stroke="rgba(220,248,124,0.2)" strokeWidth="1.2" strokeDasharray="3 5" />

          {/* The chassis the legs hang from — the frame that carries O and G. */}
          <g>
            <path d={`M${G.x} ${G.y}L${(0).toFixed(1)} 0`} stroke="rgba(255,255,255,0.3)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M-50 -34 L10 -34 L4 -20 L-44 -20 Z" fill="url(#sb-body)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M-40 -20 L0 0" stroke="rgba(255,255,255,0.22)" strokeWidth="1.6" strokeLinecap="round" />
            <path d={`M-20 -20 L${G.x} ${G.y}`} stroke="rgba(255,255,255,0.22)" strokeWidth="1.6" strokeLinecap="round" />
          </g>

          {/* The back leg first so the lit front leg sits over it. */}
          <Leg pose={legB} lead={false} />
          <Leg pose={legA} lead />

          {/* The crank: one throw to each leg, half a turn apart, and the axle hub. */}
          <path d={bar(legB.J1, legA.J1)} stroke="#DCF87C" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx={G.x} cy={G.y} r="3.2" fill="rgba(255,255,255,0.7)" />
          <circle cx={0} cy={0} r="5.5" fill="#12140f" stroke="#DCF87C" strokeWidth="2" />
          <circle cx={0} cy={0} r="1.6" fill="#DCF87C" />
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
