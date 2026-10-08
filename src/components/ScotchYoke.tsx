import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Scotch yoke rebuilt as a working mechanism: a pin on a turning crank rides
// a vertical slot in a sliding yoke, and the yoke answers with pure horizontal
// travel. Turn the crank at a steady rate and the yoke moves in exact simple
// harmonic motion — fast through the middle, dead still at each end.
//
// This is the rigid-mechanism corner's answer to one more question. The
// four-bar turns rotation into a curve; the Peaucellier turns it into a
// straight line; the Geneva turns continuous rotation into indexed steps; the
// Strandbeest turns it into a gait; the escapement meters a swing. The Scotch
// yoke turns rotation into a perfect sine.
//
// The honest part is the arithmetic. The slot is vertical and the yoke can only
// move sideways, so the pin's up-and-down is absorbed and only its side-to-side
// drives the output. The pin sits at x = O.x + r·cos θ, so the yoke's
// displacement is r·cos θ — exactly, with no approximation. That is the quiet
// thing that sets this mechanism apart from the slider-crank it is so often
// confused with: a slider-crank's output is cosine plus a connecting-rod error
// term that grows with the rod's shortness, so its motion is lopsided — quicker
// to one end than the other. The yoke has no rod, so it has no error: the trace
// it draws below is a true, symmetric cosine, the same curve a point on a
// spinning wheel casts onto a wall. The single stored value here is the crank
// angle; the pin, the yoke, and the swept trace are all derived from it, so
// none of them can ever drift out of agreement.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame (SVG user units). The crank axle sits on the centre line so the
// yoke swings symmetrically about it.
const O = { x: 230, y: 112 }
const R = 78 // crank radius = the yoke's stroke amplitude
const YOKE_HALF = 16 // half the slotted bar's width
const RAIL_L = O.x - R - 34
const RAIL_R = O.x + R + 34
const RAIL_TOP = 30
const RAIL_BOT = 194
// The trace strip below: one revolution mapped top-to-bottom, the curve laid on
// its side so its horizontal axis is the yoke's real displacement at real scale.
const TRACE_TOP = 214
const TRACE_BOT = 290

export function ScotchYoke({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // Crank angle, unbounded so drag and spin cross the 0/360 seam without a snap.
  const [drive, setDrive] = useState(0)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const theta = rad(drive)
  const yokeX = O.x + R * Math.cos(theta) // the whole output, in one line
  const pinY = O.y + R * Math.sin(theta)
  const disp = Math.cos(theta) // displacement as a fraction of the amplitude

  // Continuous spin (skipped under reduced motion, where Run advances a quarter
  // turn to the next cardinal extreme rather than sweeping the frames between).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 54) // 54 deg/s -> a ~6.7s revolution
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
    return norm((Math.atan2(y - O.y, x - O.x) * 180) / Math.PI)
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
    const delta = shortest(lastPointer.current, p)
    lastPointer.current = p
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

  const toggleRun = useCallback(() => {
    if (reduce) {
      // No sweep: jump a quarter turn to the next cardinal position.
      setDrive((v) => Math.round(v / 90) * 90 + 90)
      return
    }
    setRunning((r) => !r)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(s)
    else if (e.key === 'Home') {
      setRunning(false)
      setDrive(0)
    } else if (e.key === 'End') {
      setRunning(false)
      setDrive((v) => Math.round(v / 90) * 90 + 90)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const phase = Math.round(norm(drive))

  // The side-laid cosine the yoke sweeps over one revolution: angle runs down
  // the strip, the horizontal axis is real displacement at the mechanism's own
  // scale, so a plumb line drops from the yoke centre straight onto the curve.
  const tracePath = useMemo(() => {
    const steps = 96
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const phi = (i / steps) * 360
      const x = O.x + R * Math.cos(rad(phi))
      const y = TRACE_TOP + (phi / 360) * (TRACE_BOT - TRACE_TOP)
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
    }
    return d.trim()
  }, [])

  const readY = TRACE_TOP + (norm(drive) / 360) * (TRACE_BOT - TRACE_TOP)
  const extreme = Math.abs(disp) > 0.985 ? 'at full stroke' : Math.abs(disp) < 0.015 ? 'crossing centre' : null

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Crank ${phase} degrees, yoke displacement ${disp >= 0 ? '+' : ''}${disp.toFixed(2)} of amplitude${extreme ? `, ${extreme}` : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Scotch yoke. Drag the crank to turn it, arrow keys nudge the crank angle, Shift for ten degrees, Space runs or
          stops it, Home returns to zero and End jumps a quarter turn. A live region reads the crank angle and the yoke
          displacement.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 300"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-pin`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
            <radialGradient id={`${gid}-disc`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.04)" />
            </radialGradient>
            <linearGradient id={`${gid}-yoke`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.07)" />
            </linearGradient>
          </defs>

          {/* --- Fixed horizontal guide rails: the yoke may only slide along x --- */}
          <line x1={RAIL_L} y1={RAIL_TOP} x2={RAIL_R} y2={RAIL_TOP} stroke="rgba(255,255,255,0.14)" strokeWidth={3} strokeLinecap="round" />
          <line x1={RAIL_L} y1={RAIL_BOT} x2={RAIL_R} y2={RAIL_BOT} stroke="rgba(255,255,255,0.14)" strokeWidth={3} strokeLinecap="round" />
          {/* Stroke extremes, marked faintly on the rail so the dead points read */}
          {[O.x - R, O.x + R].map((x) => (
            <line key={x} x1={x} y1={RAIL_TOP - 6} x2={x} y2={RAIL_TOP + 6} stroke="rgba(220,248,124,0.4)" strokeWidth={2} strokeLinecap="round" />
          ))}

          {/* --- Crank: faint disc, arm, and the driving pin --- */}
          <circle cx={O.x} cy={O.y} r={R} fill={`url(#${gid}-disc)`} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          <circle cx={O.x} cy={O.y} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 6" strokeWidth={1} />
          <line x1={O.x} y1={O.y} x2={yokeX} y2={pinY} stroke="rgba(220,248,124,0.55)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={O.x} cy={O.y} r={5} fill="#0B0B0B" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />

          {/* --- Yoke: the slotted bar, translated to the pin's x --- */}
          <g transform={`translate(${(yokeX - O.x).toFixed(2)} 0)`}>
            {/* slotted body */}
            <rect
              x={O.x - YOKE_HALF}
              y={RAIL_TOP}
              width={YOKE_HALF * 2}
              height={RAIL_BOT - RAIL_TOP}
              rx={YOKE_HALF}
              fill={`url(#${gid}-yoke)`}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1.5}
            />
            {/* the vertical slot cut through it: a dark channel the pin rides */}
            <rect
              x={O.x - YOKE_HALF + 5}
              y={RAIL_TOP + 5}
              width={(YOKE_HALF - 5) * 2}
              height={RAIL_BOT - RAIL_TOP - 10}
              rx={YOKE_HALF - 5}
              fill="#050505"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            {/* rollers riding the rails, so the horizontal constraint reads */}
            <circle cx={O.x} cy={RAIL_TOP} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />
            <circle cx={O.x} cy={RAIL_BOT} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />
            {/* output stub pointing to the plumb line below */}
            <line x1={O.x} y1={RAIL_BOT} x2={O.x} y2={RAIL_BOT + 10} stroke="rgba(220,248,124,0.5)" strokeWidth={2} strokeLinecap="round" />
          </g>

          {/* The pin: rides the slot (its x is the yoke's x; its y slides free) */}
          <circle cx={yokeX} cy={pinY} r={7} fill={`url(#${gid}-pin)`} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />

          {/* --- The swept cosine: angle down the strip, displacement across --- */}
          <line x1={O.x} y1={TRACE_TOP - 6} x2={O.x} y2={TRACE_BOT + 6} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          <path d={tracePath} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
          {/* plumb line from the yoke centre straight down onto the live point */}
          <line
            x1={yokeX}
            y1={RAIL_BOT + 10}
            x2={yokeX}
            y2={readY}
            stroke="rgba(220,248,124,0.45)"
            strokeWidth={1.5}
            strokeDasharray="2 4"
          />
          <circle cx={yokeX} cy={readY} r={5} fill="#DCF87C" stroke="#0B0B0B" strokeWidth={1.5} />
        </svg>
      </div>

      {/* Live readout — the angle and the derived displacement, always in step */}
      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {phase}&deg; &middot; {disp >= 0 ? '+' : ''}
          {disp.toFixed(2)} r
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
            setDrive(0)
          }}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
