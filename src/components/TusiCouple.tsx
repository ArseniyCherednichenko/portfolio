import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// The Tusi couple: a straight line drawn by rolling, not by hinging. Peaucellier
// and Chebyshev, standing in the same corner, make a straight line out of BARS —
// a cell of pivots coaxed so one joint can only travel in a line. This makes one
// out of a single rolling circle, and no hinge at all.
//
// Roll a circle of radius r around the inside of a circle of radius R = 2r, and
// every point on the small circle's rim traces a perfect diameter of the big one.
// Not approximately — exactly, to machine precision: the curved rolling of one
// circle inside another exactly half its size cancels into a line. A point at
// body angle beta sits at inertial position
//
//     P = C + r·(cos(beta − (R−r)/r · phi), sin(beta − (R−r)/r · phi))
//
// with the small centre C = (R−r)·(cos phi, sin phi). At R = 2r the (R−r)/r term
// is 1, and the two sines collapse: P.x = 2r·cos phi, P.y = 0 for the point at
// beta = 0, and its antipode rides x = 0 — so the two ends of a diameter drawn
// across the rolling circle run along two PERPENDICULAR straight lines. That is
// the elliptical trammel's constraint (two points sliding in square slots), met
// with no slots: the rod is a diameter of the rolling wheel, the "slots" are the
// two lines it is forced to draw. Astronomers called it the Tusi couple, after
// Nasir al-Din al-Tusi, who used it in the 13th century to build straight-line
// motion out of circles when circles were all the heavens were allowed.
//
// The one dial that matters is the ratio R/r. It is 2 that makes the line; take
// the small circle smaller and the straight stroke bows back into a cusped
// hypocycloid — a deltoid at R/r = 3, an astroid at 4 — so the line reads as the
// single degenerate case where a curve runs out of curvature. The only stored
// state is the roll angle and the ratio; the centre, the rim point, its partner
// and the whole traced path are derived, so nothing can drift out of agreement.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame (SVG user units), square so the figure sits centred.
const VB = 360
const CX = 180
const CY = 180
const R = 150 // big (fixed) circle radius in px — its diameter is the stroke

const RATIOS = [
  { k: 2, label: 'Straight', cusps: 2 },
  { k: 3, label: 'Deltoid', cusps: 3 },
  { k: 4, label: 'Astroid', cusps: 4 },
] as const

export function TusiCouple({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // Roll angle, unbounded so drag and spin cross the 0/360 seam without a snap.
  const [drive, setDrive] = useState(24)
  const [running, setRunning] = useState(false)
  const [k, setK] = useState(2)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const r = R / k // small (rolling) circle radius
  const d = R - r // the small centre orbits at this radius
  const ratio = d / r // (R−r)/r — the spoke's spin rate against the orbit

  const phi = rad(drive)

  // A rim point at body angle beta, in SVG coords (y flipped so the maths reads
  // in the usual sense). Returns absolute SVG pixel position.
  const rimPoint = useCallback(
    (ph: number, beta: number) => {
      const ox = d * Math.cos(ph)
      const oy = d * Math.sin(ph)
      const ang = beta - ratio * ph
      const x = ox + r * Math.cos(ang)
      const y = oy + r * Math.sin(ang)
      return { x: CX + x, y: CY - y } // flip y into screen space
    },
    [d, r, ratio],
  )

  const p = rimPoint(phi, 0) // the primary traced point (rides the x-axis at k=2)
  const partner = rimPoint(phi, Math.PI) // its antipode (rides the y-axis at k=2)
  const centre = { x: CX + d * Math.cos(phi), y: CY - d * Math.sin(phi) }

  // Continuous roll (skipped under reduced motion, where Run steps a quarter turn
  // to the next cardinal position rather than sweeping the frames between).
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
    const x = ((clientX - rect.left) / rect.width) * VB
    const y = ((clientY - rect.top) / rect.height) * VB
    // Angle of the pointer about the centre, measured the same sense as phi
    // (screen y flipped, so a clockwise screen drag reads as increasing phi).
    return norm((Math.atan2(-(y - CY), x - CX) * 180) / Math.PI)
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
    const pa = pointerAngle(e.clientX, e.clientY)
    const delta = shortest(lastPointer.current, pa)
    lastPointer.current = pa
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
      setDrive((v) => Math.round(v / 90) * 90 + 90)
      return
    }
    setRunning((run) => !run)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 2
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

  // The full path the primary rim point traces over one revolution — a line at
  // k = 2, a cusped hypocycloid above it. Memoised per ratio.
  const tracePath = useMemo(() => {
    const steps = 360
    let path = ''
    for (let i = 0; i <= steps; i++) {
      const ph = (i / steps) * 2 * Math.PI
      const ox = d * Math.cos(ph)
      const oy = d * Math.sin(ph)
      const ang = -ratio * ph
      const x = CX + ox + r * Math.cos(ang)
      const y = CY - (oy + r * Math.sin(ang))
      path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
    }
    return path.trim()
  }, [d, r, ratio])

  const partnerPath = useMemo(() => {
    const steps = 360
    let path = ''
    for (let i = 0; i <= steps; i++) {
      const ph = (i / steps) * 2 * Math.PI
      const ox = d * Math.cos(ph)
      const oy = d * Math.sin(ph)
      const ang = Math.PI - ratio * ph
      const x = CX + ox + r * Math.cos(ang)
      const y = CY - (oy + r * Math.sin(ang))
      path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
    }
    return path.trim()
  }, [d, r, ratio])

  const isStraight = k === 2
  const shape = RATIOS.find((x) => x.k === k)?.label ?? ''

  return (
    <div className={`flex w-full max-w-xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Roll angle ${phase} degrees. Ratio R over r is ${k} to 1, tracing ${
          isStraight ? 'an exact straight line' : `a ${shape.toLowerCase()}`
        }.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full max-w-md touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Tusi couple. A small circle rolls inside a big one; a point on its rim traces a straight line when the big
          circle is exactly twice the small. Drag to roll it, arrow keys nudge the roll angle, Shift for ten degrees,
          Space runs or stops it, Home returns to zero and End jumps a quarter turn. The ratio buttons below change how
          many times larger the fixed circle is, bowing the straight line into a cusped curve.
        </span>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB} ${VB}`}
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-pin`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
            <radialGradient id={`${gid}-wheel`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
            </radialGradient>
          </defs>

          {/* --- The fixed ring the wheel rolls inside --- */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={2}
            strokeDasharray="2 7"
          />

          {/* --- The path the primary point traces: a line at k=2, else the guide curve --- */}
          {isStraight ? (
            <>
              {/* the two perpendicular diameters — the lines the two ends run in */}
              <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(220,248,124,0.28)" strokeWidth={1.5} />
              <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(140,194,255,0.26)" strokeWidth={1.5} />
            </>
          ) : (
            <>
              <path d={tracePath} fill="none" stroke="rgba(220,248,124,0.26)" strokeWidth={1.5} />
              <path d={partnerPath} fill="none" stroke="rgba(140,194,255,0.2)" strokeWidth={1.25} />
            </>
          )}

          {/* --- The circle the small centre itself traces (radius R−r) --- */}
          <circle cx={CX} cy={CY} r={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="1 6" />

          {/* --- The rolling wheel --- */}
          <circle cx={centre.x} cy={centre.y} r={r} fill={`url(#${gid}-wheel)`} stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} />

          {/* --- The rod: the diameter across the wheel joining the two tracked points --- */}
          <line x1={p.x} y1={p.y} x2={partner.x} y2={partner.y} stroke="rgba(255,255,255,0.42)" strokeWidth={3.5} strokeLinecap="round" />
          {/* spoke from the wheel centre to the primary point, so the roll reads */}
          <line x1={centre.x} y1={centre.y} x2={p.x} y2={p.y} stroke="rgba(220,248,124,0.5)" strokeWidth={2} strokeLinecap="round" />

          {/* --- Bearings and beads --- */}
          <circle cx={CX} cy={CY} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.4)" strokeWidth={1.25} />
          <circle cx={centre.x} cy={centre.y} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.45)" strokeWidth={1.25} />
          {/* the antipodal partner bead (rides the perpendicular line at k=2) */}
          <circle cx={partner.x} cy={partner.y} r={5} fill="#0B0B0B" stroke="#8CC2FF" strokeWidth={1.75} />
          {/* the primary traced point */}
          <circle cx={p.x} cy={p.y} r={6.5} fill={`url(#${gid}-pin)`} stroke="#0B0B0B" strokeWidth={1} />
        </svg>
      </div>

      {/* Ratio control — the one dial, and the one that makes the line */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/40">R / r</span>
        {RATIOS.map((x) => {
          const on = x.k === k
          return (
            <button
              key={x.k}
              type="button"
              aria-pressed={on}
              onClick={() => setK(x.k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                on
                  ? 'border-[#DCF87C]/50 bg-[#DCF87C]/[0.12] text-[#DCF87C]'
                  : 'border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
              }`}
            >
              {x.label} &middot; {x.k}:1
            </button>
          )
        })}
      </div>

      {/* Live readout — roll angle and the shape the ratio draws */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {phase}&deg;
        </span>
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/80 backdrop-blur">
          {isStraight ? 'straight line' : shape.toLowerCase()}
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
