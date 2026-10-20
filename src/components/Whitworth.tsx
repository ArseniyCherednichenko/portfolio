import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Whitworth quick-return mechanism, rebuilt as a working linkage. A crank
// turns at a perfectly steady rate about one fixed centre; a slotted link
// pivots about a second fixed centre a little below it, and the crank pin rides
// in that slot. Because the two centres don't coincide, the slotted link swings
// round *non-uniformly* — it dawdles through the half-turn where the pin is far
// out, and whips through the half where the pin passes close to the pivot. A
// connecting rod off the far end of the link turns that lopsided swing into a
// reciprocating ram that crawls out on the working stroke and snaps back on the
// return. That asymmetry is the whole point: it is what lets a shaping machine
// cut slowly under load one way and waste no time coming back.
//
// This belongs in the rigid-mechanism corner beside the others because it
// answers a question none of them do. The four-bar turns rotation into a curve;
// the Scotch yoke into a pure, *symmetric* sine; the Geneva into indexed steps;
// the Oldham passes it straight through. The Whitworth turns steady rotation
// into reciprocation that is deliberately *unequal* in time — same distance each
// way, but slow out and fast back.
//
// The honest part is the arithmetic. Put the crank centre A a distance d above
// the link pivot O, with the crank radius r > d so the pin's circle swallows O
// and the link makes full turns. The pin is P = A + r·(cos phi, sin phi); the
// link points along the line O->P, so its angle is psi = atan2(P - O). The pin
// slides in the slot at distance s = |P - O| from the pivot, between r - d and
// r + d. The far end of the link, at radius L, drives the ram through a rod of
// fixed length. Everything on screen is derived from the single stored crank
// angle, so nothing can drift. The quick-return ratio below is not asserted —
// it is measured straight off the drawn geometry by finding the two dead
// centres (where the ram reverses) and comparing the crank-angle each stroke
// takes.

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame, in SVG user units (viewBox 0 0 460 300).
const O = { x: 146, y: 152 } // slotted-link pivot — fixed
const A = { x: 146, y: 110 } // crank centre — fixed, a little above O
const D = Math.hypot(A.x - O.x, A.y - O.y) // offset between the two centres
const R_CRANK = 72 // crank radius — > D, so the pin circle swallows O (full turns)
const L_BAR = 122 // link length from pivot to the connecting-rod takeoff
const BAR_TAIL = 30 // how far the slotted bar runs past the pivot, the other way
const L_ROD = 162 // connecting-rod length (>= L_BAR, so the ram never jams)
const RAM_Y = 152 // the ram slides along this horizontal line

interface Pose {
  px: number
  py: number
  psi: number // link angle, radians
  s: number // pin distance from the pivot, along the slot
  qx: number
  qy: number
  ramX: number
}

// The entire mechanism in one pure function of the crank angle (degrees).
function pose(phi: number): Pose {
  const px = A.x + R_CRANK * Math.cos(rad(phi))
  const py = A.y + R_CRANK * Math.sin(rad(phi))
  const dx = px - O.x
  const dy = py - O.y
  const psi = Math.atan2(dy, dx)
  const s = Math.hypot(dx, dy)
  const qx = O.x + L_BAR * Math.cos(psi)
  const qy = O.y + L_BAR * Math.sin(psi)
  // Ram pin lies on the horizontal line RAM_Y, a rod-length from Q, to +x.
  const vy = RAM_Y - qy
  const h = Math.sqrt(Math.max(0, L_ROD * L_ROD - vy * vy))
  const ramX = qx + h
  return { px, py, psi, s, qx, qy, ramX }
}

// Measure the mechanism rather than assert it: sweep the crank once, find the
// ram's two extremes (the dead centres), and read the quick-return ratio off
// the crank angle each stroke actually costs.
let RAM_MIN = Infinity
let RAM_MAX = -Infinity
let PHI_AT_MIN = 0
let PHI_AT_MAX = 0
for (let i = 0; i < 1440; i++) {
  const phi = i * 0.25
  const { ramX } = pose(phi)
  if (ramX < RAM_MIN) {
    RAM_MIN = ramX
    PHI_AT_MIN = phi
  }
  if (ramX > RAM_MAX) {
    RAM_MAX = ramX
    PHI_AT_MAX = phi
  }
}
const SPAN_OUT = norm(PHI_AT_MAX - PHI_AT_MIN) // crank deg while the ram advances
const SPAN_BACK = 360 - SPAN_OUT
const SLOW_SPAN = Math.max(SPAN_OUT, SPAN_BACK)
const FAST_SPAN = Math.min(SPAN_OUT, SPAN_BACK)
const RATIO = SLOW_SPAN / FAST_SPAN
// Is the advancing (min -> max) stroke the slow, working one?
const OUT_IS_SLOW = SPAN_OUT >= SPAN_BACK

export function Whitworth({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // Crank angle, unbounded so drag and spin cross the 0/360 seam without a snap.
  const [drive, setDrive] = useState(PHI_AT_MIN)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const p = pose(drive)
  const phase = norm(drive)
  // Which stroke are we in? Advancing = crank angle sits in the min->max span.
  const advancing = norm(phase - PHI_AT_MIN) < SPAN_OUT
  const slowNow = advancing === OUT_IS_SLOW
  const travel = (p.ramX - RAM_MIN) / (RAM_MAX - RAM_MIN) // 0..1 along the stroke

  // Continuous spin at a steady crank rate — which is exactly the point: a
  // constant input makes an unequal output. Skipped under reduced motion.
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 50) // 50 deg/s -> a ~7.2s revolution
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
    const x = ((clientX - rect.left) / rect.width) * 460
    const y = ((clientY - rect.top) / rect.height) * 300
    // Drag relative to the crank centre — the thing a hand actually cranks.
    return norm(deg(Math.atan2(y - A.y, x - A.x)))
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
    const a = pointerAngle(e.clientX, e.clientY)
    const delta = shortest(lastPointer.current, a)
    lastPointer.current = a
    setDrive((v) => v + delta)
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

  const nudge = (delta: number) => {
    setRunning(false)
    setDrive((v) => v + delta)
  }

  // The two dead centres are the meaningful stops: jump to the next one.
  const nextDeadCentre = (v: number) => {
    const base = Math.floor(v / 360) * 360
    const cands = [
      base + PHI_AT_MIN,
      base + PHI_AT_MAX,
      base + 360 + PHI_AT_MIN,
      base + 360 + PHI_AT_MAX,
    ].filter((c) => c > v + 0.01)
    return cands.length ? Math.min(...cands) : v + 180
  }

  const toggleRun = useCallback(() => {
    if (reduce) {
      setDrive((v) => nextDeadCentre(v)) // no sweep: step to the next dead centre
      return
    }
    setRunning((r) => !r)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-step)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(step)
    else if (e.key === 'Home') {
      setRunning(false)
      setDrive(PHI_AT_MIN)
    } else if (e.key === 'End') {
      setRunning(false)
      setDrive((v) => nextDeadCentre(v))
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const phaseR = Math.round(phase)
  const strokeWord = slowNow ? 'working stroke' : 'return'
  const ratioText = `${RATIO.toFixed(2)}:1`

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phaseR}
        aria-valuetext={`Crank at ${phaseR} degrees, turning steadily. The ram is on its ${strokeWord}, ${Math.round(
          travel * 100,
        )} percent of the way along. The working stroke takes ${Math.round(
          SLOW_SPAN,
        )} degrees of crank to the return's ${Math.round(FAST_SPAN)}, a quick-return ratio of ${ratioText}.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Whitworth quick-return mechanism. Drag around the crank centre to turn it, arrow keys nudge the crank, Shift for
          a bigger step, Space runs or stops it, Home returns to a dead centre and End jumps to the next one. A live
          region reads the crank angle, which stroke the ram is on, and the measured quick-return ratio.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 300"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-disc`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
            </radialGradient>
            <linearGradient id={`${gid}-bar`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
            <linearGradient id={`${gid}-ram`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#DCF87C" stopOpacity="0.9" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.7" />
            </linearGradient>
            <radialGradient id={`${gid}-hub`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* The ram's full reach — a faint guide strip along its track */}
          <rect
            x={RAM_MIN}
            y={RAM_Y - 15}
            width={RAM_MAX - RAM_MIN}
            height={30}
            rx={15}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
            strokeDasharray="2 5"
          />
          {/* The two dead centres marked on the track as the stroke endpoints */}
          <line x1={RAM_MIN} y1={RAM_Y - 19} x2={RAM_MIN} y2={RAM_Y + 19} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
          <line x1={RAM_MAX} y1={RAM_Y - 19} x2={RAM_MAX} y2={RAM_Y + 19} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />

          {/* The crank pin's circular path, faint */}
          <circle cx={A.x} cy={A.y} r={R_CRANK} fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 5" strokeWidth={1} />

          {/* The slotted link: a long bar pivoting at O, turned to the link angle.
              The crank pin rides the dark slot channel cut down its length. */}
          <g transform={`translate(${O.x} ${O.y}) rotate(${deg(p.psi).toFixed(3)})`}>
            <rect
              x={-BAR_TAIL}
              y={-11}
              width={BAR_TAIL + L_BAR}
              height={22}
              rx={11}
              fill={`url(#${gid}-bar)`}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1.5}
            />
            {/* the slot the pin slides in */}
            <rect
              x={18}
              y={-6}
              width={R_CRANK + D - 18 + 10}
              height={12}
              rx={6}
              fill="#050505"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            {/* the crank pin, riding in the slot at distance s from the pivot */}
            <circle cx={p.s} cy={0} r={7} fill="#0B0B0B" stroke="#DCF87C" strokeWidth={2} />
          </g>

          {/* Connecting rod: link end Q -> ram pin */}
          <line
            x1={p.qx}
            y1={p.qy}
            x2={p.ramX}
            y2={RAM_Y}
            stroke="rgba(220,248,124,0.55)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* the link-end joint */}
          <circle cx={p.qx} cy={p.qy} r={5} fill="#0B0B0B" stroke="rgba(220,248,124,0.7)" strokeWidth={1.8} />

          {/* The crank arm: centre A -> pin P */}
          <line
            x1={A.x}
            y1={A.y}
            x2={p.px}
            y2={p.py}
            stroke="rgba(220,248,124,0.85)"
            strokeWidth={5}
            strokeLinecap="round"
          />

          {/* The ram: a block on the track, carrying a cutting tool at its nose,
              lit while it's on the slow working stroke. */}
          <g transform={`translate(${p.ramX.toFixed(2)} ${RAM_Y})`}>
            <rect
              x={-30}
              y={-14}
              width={44}
              height={28}
              rx={6}
              fill={slowNow ? `url(#${gid}-ram)` : `url(#${gid}-disc)`}
              stroke={slowNow ? 'rgba(220,248,124,0.6)' : 'rgba(255,255,255,0.18)'}
              strokeWidth={1.5}
            />
            {/* the tool nose */}
            <path d="M 14 -8 L 24 0 L 14 8 Z" fill={slowNow ? '#DCF87C' : 'rgba(255,255,255,0.5)'} />
            {/* the ram-pin joint */}
            <circle cx={0} cy={0} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          </g>

          {/* Fixed centres: the two points that never move */}
          <circle cx={A.x} cy={A.y} r={5} fill={`url(#${gid}-hub)`} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          <circle cx={O.x} cy={O.y} r={5} fill="#0B0B0B" stroke="rgba(255,255,255,0.5)" strokeWidth={1.8} />
        </svg>
      </div>

      {/* Live readout — the crank angle, the stroke in progress, the measured ratio */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          crank {phaseR}&deg;
        </span>
        <span
          className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur transition-colors ${
            slowNow
              ? 'border-[#DCF87C]/40 bg-[#DCF87C]/[0.08] text-[#DCF87C]'
              : 'border-white/10 bg-black/40 text-white/55'
          }`}
        >
          {slowNow ? 'working · slow' : 'return · fast'}
        </span>
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {ratioText}
        </span>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/[0.12]"
        >
          {reduce ? 'Step' : running ? 'Stop' : 'Run'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false)
            setDrive(PHI_AT_MIN)
          }}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
