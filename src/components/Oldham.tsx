import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// An Oldham coupling rebuilt as a working mechanism: two shafts whose axes are
// parallel but offset, joined by a floating disc that carries a tongue on each
// face at right angles to the other. Turn the input and the output turns with
// it — at the exact same angle, no lead and no lag — while the disc in the
// middle slides in its two slots and wanders in a little circle to swallow the
// offset.
//
// This is the rigid-mechanism corner's answer to a different question than the
// others ask. The four-bar turns rotation into a curve; the Scotch yoke turns
// it into a perfect sine; the Geneva turns continuous rotation into indexed
// steps; the Peaucellier turns it into a straight line. The Oldham does the
// quietest thing of all: it passes rotation straight through, unchanged, across
// a gap it is not allowed to bridge directly — a constant-velocity joint made
// of nothing but two slots cut at ninety degrees.
//
// The honest part is the arithmetic, and it is prettier than it has any right
// to be. Put the two axes at A = (-e, 0) and B = (+e, 0). The input slot points
// along u = (cos theta, sin theta); the output slot, carried by the second
// tongue, is forced perpendicular, along v = (-sin theta, cos theta). The disc
// centre is the one point that lies on the line through A along u *and* the line
// through B along v, and solving that intersection collapses to
//   C = e * (cos 2theta, sin 2theta).
// So the floating centre runs a circle whose diameter is exactly the offset
// between the shafts, and it runs it at twice the shaft speed — while the two
// shafts themselves stay locked at one and the same angle. The single stored
// value here is that shaft angle; both flanges, the sliding tongues, and the
// orbiting centre are all derived from it, so nothing can ever drift out of
// agreement.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame (SVG user units). The assembly is centred on O; the two shaft
// axes sit on the centre line, offset e either side of it.
const O = { x: 230, y: 140 }
const E = 34 // half the shaft offset — and the radius of the disc centre's orbit
const A = { x: O.x - E, y: O.y }
const B = { x: O.x + E, y: O.y }
const R = 84 // flange radius (both flanges and the floating disc share it)
const SLOT_HALF = 13 // half-width of the diametral slot cut in each flange
const TONGUE_HALF = 9 // half-width of a tongue — it rides inside the slot
const BAR = R * 0.94 // half-length of a tongue / slot, spanning the disc face

export function Oldham({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // Shaft angle, unbounded so drag and spin cross the 0/360 seam without a snap.
  const [drive, setDrive] = useState(0)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const theta = rad(drive)
  // The whole mechanism in one line: the floating centre orbits at twice the
  // drive, on a circle of radius E about O.
  const cx = O.x + E * Math.cos(2 * theta)
  const cy = O.y + E * Math.sin(2 * theta)

  // Continuous spin (skipped under reduced motion, where Run advances a quarter
  // turn to the next cardinal position rather than sweeping the frames between).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 48) // 48 deg/s -> a ~7.5s revolution
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
  const orbit = Math.round(norm(2 * drive))

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Input shaft ${phase} degrees, output shaft ${phase} degrees — locked together with zero phase error. The floating disc centre is ${orbit} degrees round its orbit, turning at twice the shaft rate.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Oldham coupling. Drag to turn the input shaft, arrow keys nudge the angle, Shift for ten degrees, Space runs or
          stops it, Home returns to zero and End jumps a quarter turn. A live region reads the input and output shaft
          angles, which stay locked together, and the floating disc centre&rsquo;s position on its orbit.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 300"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-flange`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
            </radialGradient>
            <radialGradient id={`${gid}-disc`} cx="0.4" cy="0.35" r="0.9">
              <stop offset="0" stopColor="rgba(220,248,124,0.16)" />
              <stop offset="1" stopColor="rgba(220,248,124,0.04)" />
            </radialGradient>
            <linearGradient id={`${gid}-tongue`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.8" />
            </linearGradient>
            <radialGradient id={`${gid}-hub`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* --- The orbit the floating centre runs: radius E about O --- */}
          <circle cx={O.x} cy={O.y} r={E} fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="2 5" strokeWidth={1} />

          {/* --- OUTPUT flange (behind): disc + diametral slot, turned to drive+90 --- */}
          <g transform={`translate(${B.x} ${B.y}) rotate(${drive + 90})`}>
            <circle r={R} fill={`url(#${gid}-flange)`} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
            {/* the dark channel the output tongue rides */}
            <rect
              x={-BAR}
              y={-SLOT_HALF}
              width={BAR * 2}
              height={SLOT_HALF * 2}
              rx={SLOT_HALF}
              fill="#050505"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            {/* rim marker — reads the output shaft's absolute angle */}
            <line x1={R - 16} y1={0} x2={R - 2} y2={0} stroke="rgba(220,248,124,0.7)" strokeWidth={3} strokeLinecap="round" />
          </g>

          {/* --- INPUT flange (behind): disc + diametral slot, turned to drive --- */}
          <g transform={`translate(${A.x} ${A.y}) rotate(${drive})`}>
            <circle r={R} fill={`url(#${gid}-flange)`} stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} />
            <rect
              x={-BAR}
              y={-SLOT_HALF}
              width={BAR * 2}
              height={SLOT_HALF * 2}
              rx={SLOT_HALF}
              fill="#050505"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <line x1={R - 16} y1={0} x2={R - 2} y2={0} stroke="rgba(220,248,124,0.7)" strokeWidth={3} strokeLinecap="round" />
          </g>

          {/* --- The floating disc (in front): its centre at C, carrying the two
                  tongues at right angles — one in each flange's slot --- */}
          <g transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)})`}>
            <circle r={R} fill={`url(#${gid}-disc)`} stroke="rgba(220,248,124,0.3)" strokeWidth={1.5} />
            {/* output tongue — lies along the output slot (drive+90) */}
            <g transform={`rotate(${drive + 90})`}>
              <rect
                x={-BAR}
                y={-TONGUE_HALF}
                width={BAR * 2}
                height={TONGUE_HALF * 2}
                rx={TONGUE_HALF}
                fill={`url(#${gid}-tongue)`}
                opacity={0.55}
              />
            </g>
            {/* input tongue — lies along the input slot (drive) */}
            <g transform={`rotate(${drive})`}>
              <rect
                x={-BAR}
                y={-TONGUE_HALF}
                width={BAR * 2}
                height={TONGUE_HALF * 2}
                rx={TONGUE_HALF}
                fill={`url(#${gid}-tongue)`}
                opacity={0.9}
              />
            </g>
            {/* the floating centre itself */}
            <circle r={5} fill="#0B0B0B" stroke="#DCF87C" strokeWidth={1.8} />
          </g>

          {/* --- Fixed shaft axes: the two points that never move --- */}
          <circle cx={A.x} cy={A.y} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} />
          <circle cx={B.x} cy={B.y} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} />
        </svg>
      </div>

      {/* Live readout — the locked shaft angle and the double-rate orbit */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          in {phase}&deg; = out {phase}&deg; &middot; orbit {orbit}&deg;
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
