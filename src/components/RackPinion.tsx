import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A rack and pinion rebuilt as a working mechanism: a round pinion gear turns on
// a fixed axle, its teeth comb into a straight toothed bar — the rack — and the
// rack answers with pure horizontal travel. Turn the pinion and the rack slides;
// hold it and the rack holds. This is the rigid-mechanism corner's plainest
// rotary-to-linear converter, the one under every steering box and sliding gate.
//
// It belongs beside the others that trade one kind of motion for another. The
// Scotch yoke turns rotation into a perfect sine; the slider-crank turns it into
// a piston's lopsided stroke; the four-bar turns it into a curve; the Geneva
// turns it into indexed steps. The rack and pinion turns it into the simplest
// output of all — a straight line that advances in exact proportion to the turn.
//
// The honest part is the arithmetic, and it is a single line. A gear rolls on
// its pitch circle without slipping, so a point on that circle and the rack move
// together: the rack's displacement is the pitch radius times the angle turned,
// s = R·theta, exactly, with theta in radians. Spin the pinion one full turn and
// the rack travels one pitch circumference, 2*pi*R — no more, no less. Every
// tooth here is placed from that law: the pinion's teeth sit at even angles, the
// rack's at the matching pitch along x, and the rack's whole offset is R·theta.
// The one stored value is the turn angle; the pinion's rotation, the rack's
// position, and the mesh at the pitch point are all read from it, so they can
// never drift out of step. The meshing teeth are drawn to a clean stylised
// profile — the proportion is honest even though the flank is not an involute.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame (SVG user units).
const VIEW_W = 460
const VIEW_H = 300
const O = { x: 230, y: 112 } // pinion axle
const N = 14 // teeth on the pinion
const RP = 70 // pitch radius — the s = R·theta radius
const ADD = 9 // addendum (tooth height above the pitch circle)
const DED = 11 // dedendum (depth below it)
const RA = RP + ADD // tip (addendum) radius
const RD = RP - DED // root (dedendum) radius
const ALPHA = (2 * Math.PI) / N // angular pitch, one tooth-and-gap
const PITCH = (2 * Math.PI * RP) / N // linear pitch along the rack
const Y_PITCH = O.y + RP // the pitch line: tangent to the pinion at the bottom
const Y_TIP = Y_PITCH - ADD // rack tooth tips rise to here
const Y_BASE = Y_PITCH + ADD // rack teeth spring from here
const Y_BAR = 210 // bottom of the rack bar
const RAIL_TOP = Y_BASE + 2
const RAIL_BOT = Y_BAR + 8

// Rack tooth proportions, as fractions of the linear pitch.
const T_TIP = 0.18 * PITCH // half-width at the tip (narrow)
const T_ROOT = 0.30 * PITCH // half-width at the base (wide, sloped flanks)

const polar = (r: number, ang: number) => ({
  x: O.x + r * Math.cos(ang),
  y: O.y + r * Math.sin(ang),
})

export function RackPinion({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // Turn angle in degrees, unbounded so drag and spin cross the seam smoothly.
  const [drive, setDrive] = useState(0)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const theta = rad(drive)
  const shift = RP * theta // the whole output, in one line: s = R·theta

  // Continuous spin (skipped under reduced motion, where Run steps one tooth).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 44) // 44 deg/s — an unhurried turn
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

  // The pinion gear outline: N teeth at even angular pitch, each a stylised
  // trapezoid (wide at the root, narrow at the tip) with the tooth-0 centre at
  // the bottom pitch point when theta = 0, so a rack gap always meets it there.
  const pinionPath = useMemo(() => {
    let d = ''
    for (let i = 0; i < N; i++) {
      // Tooth centre: bottom (pi/2) at theta = 0, running back by theta so the
      // bottom teeth sweep toward +x as the rack does — the mesh stays in step.
      const c = Math.PI / 2 + i * ALPHA - theta
      const verts = [
        polar(RD, c - 0.3 * ALPHA),
        polar(RA, c - 0.17 * ALPHA),
        polar(RA, c + 0.17 * ALPHA),
        polar(RD, c + 0.3 * ALPHA),
      ]
      for (const v of verts) {
        d += `${d === '' ? 'M' : 'L'}${v.x.toFixed(2)} ${v.y.toFixed(2)} `
      }
    }
    return `${d.trim()} Z`
  }, [theta])

  // The rack teeth: one trapezoid per pitch across the frame, the whole comb
  // offset by s = R·theta. Centres sit at a half-pitch from the axle line, so a
  // gap — not a tooth — meets the pinion's bottom tooth at theta = 0.
  const rackPath = useMemo(() => {
    const kMin = Math.floor((-60 - shift) / PITCH) - 1
    const kMax = Math.ceil((VIEW_W + 60 - shift) / PITCH) + 1
    let d = ''
    for (let k = kMin; k <= kMax; k++) {
      const cx = O.x + (k + 0.5) * PITCH + shift
      d +=
        `M${(cx - T_ROOT).toFixed(2)} ${Y_BASE} ` +
        `L${(cx - T_TIP).toFixed(2)} ${Y_TIP} ` +
        `L${(cx + T_TIP).toFixed(2)} ${Y_TIP} ` +
        `L${(cx + T_ROOT).toFixed(2)} ${Y_BASE} Z `
    }
    return d.trim()
  }, [shift])

  const pointerAngle = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return lastPointer.current
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * VIEW_W
    const y = ((clientY - rect.top) / rect.height) * VIEW_H
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
      // No sweep: step exactly one tooth (one angular pitch) forward.
      setDrive((v) => v + (ALPHA * 180) / Math.PI)
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
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const phase = Math.round(norm(drive))
  const pitches = shift / PITCH // rack travel in pitches — the honest readout
  const spokeAngle = -theta // the hub keyway, so the turn is legible on the disc

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Pinion ${phase} degrees, rack displacement ${pitches >= 0 ? '+' : ''}${pitches.toFixed(2)} pitches, which is the pitch radius times the angle turned`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Rack and pinion. Drag the pinion to turn it, arrow keys nudge the angle, Shift for ten degrees, Space runs or
          stops it, Home returns to zero. A live region reads the angle turned and the rack's travel, which is always the
          pitch radius times the angle.
        </span>
        <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]" aria-hidden>
          <defs>
            <radialGradient id={`${gid}-disc`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </radialGradient>
            <linearGradient id={`${gid}-rack`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.07)" />
            </linearGradient>
            <radialGradient id={`${gid}-hub`} cx="0.4" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#DCF87C" stopOpacity="0.9" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.8" />
            </radialGradient>
          </defs>

          {/* Fixed guide rails: the rack may only slide along x */}
          <line x1={10} y1={RAIL_TOP} x2={VIEW_W - 10} y2={RAIL_TOP} stroke="rgba(255,255,255,0.1)" strokeWidth={2} strokeLinecap="round" />
          <line x1={10} y1={RAIL_BOT} x2={VIEW_W - 10} y2={RAIL_BOT} stroke="rgba(255,255,255,0.1)" strokeWidth={2} strokeLinecap="round" />

          {/* Pitch circle and pitch line — the no-slip contact these two share */}
          <circle cx={O.x} cy={O.y} r={RP} fill="none" stroke="rgba(220,248,124,0.18)" strokeDasharray="2 6" strokeWidth={1} />
          <line x1={10} y1={Y_PITCH} x2={VIEW_W - 10} y2={Y_PITCH} stroke="rgba(220,248,124,0.16)" strokeDasharray="2 6" strokeWidth={1} />

          {/* The rack: a solid bar with the teeth combing up from it */}
          <rect x={-40} y={Y_BASE - 1} width={VIEW_W + 80} height={Y_BAR - Y_BASE + 1} fill={`url(#${gid}-rack)`} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
          <path d={rackPath} fill={`url(#${gid}-rack)`} stroke="rgba(255,255,255,0.22)" strokeWidth={1} strokeLinejoin="round" />

          {/* The pinion: faint disc, toothed rim, lime hub with a keyway */}
          <circle cx={O.x} cy={O.y} r={RD} fill={`url(#${gid}-disc)`} />
          <path d={pinionPath} fill="rgba(16,16,16,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.4} strokeLinejoin="round" />
          <circle cx={O.x} cy={O.y} r={22} fill="rgba(10,10,10,0.95)" stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} />
          <circle cx={O.x} cy={O.y} r={8} fill={`url(#${gid}-hub)`} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
          <line
            x1={O.x}
            y1={O.y}
            x2={O.x + 20 * Math.cos(spokeAngle)}
            y2={O.y + 20 * Math.sin(spokeAngle)}
            stroke="rgba(220,248,124,0.55)"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* The pitch point: where the no-slip contact actually happens */}
          <line x1={O.x} y1={O.y} x2={O.x} y2={Y_PITCH} stroke="rgba(220,248,124,0.4)" strokeWidth={1} strokeDasharray="2 4" />
          <circle cx={O.x} cy={Y_PITCH} r={4} fill="#DCF87C" stroke="#0B0B0B" strokeWidth={1.4} />

          {/* Travel arrow on the rack, so the linear output reads at a glance */}
          <g transform={`translate(0 ${Y_BAR + 18})`}>
            <line x1={O.x - 60} y1={0} x2={O.x + 60} y2={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
            <path
              d={shift >= 0 ? `M${O.x + 56} -4 L${O.x + 64} 0 L${O.x + 56} 4` : `M${O.x - 56} -4 L${O.x - 64} 0 L${O.x - 56} 4`}
              fill="none"
              stroke="rgba(220,248,124,0.5)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {/* Live readout — the turn and the derived travel, always in step */}
      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {phase}&deg; &middot; {pitches >= 0 ? '+' : ''}
          {pitches.toFixed(2)} p
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
