import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A cam and follower rebuilt as a working mechanism: a shaped disc turns on a
// shaft, a spring-loaded follower rides its edge, and the follower answers with
// a programmed up-and-down — rise, hold, fall, hold — that repeats once a turn.
//
// This is the rigid-mechanism corner's answer to one more question, and the
// deliberate reply to the Scotch yoke a few places back. The four-bar turns
// rotation into a curve; the Peaucellier and the Chebyshev into a straight
// line; the Geneva into indexed steps; the Strandbeest into a gait; the
// escapement meters a swing; the Scotch yoke casts a pure, symmetric sine. A
// cam casts whatever you like. Where the yoke's output is fixed by its one
// shape — r·cos θ, a cosine and nothing else — a cam's output is drawn into the
// edge of the disc itself: the profile IS the program of motion, so the same
// mechanism can dwell, snap, crawl or leap exactly where the engine wants it
// to. It is how a camshaft opens a valve: held shut through most of a turn,
// lifted on cue, held open, set back down.
//
// The honest part is that the picture and the number are one object. The lift
// law s(α) — a cycloidal rise, a high dwell, a cycloidal fall, a low dwell — is
// written once, in `lift()`. The disc's edge is that same law in polar form,
// radius = baseCircle + s(α) at every angle α, so the drawn profile is not a
// decoration laid over a scripted motion: it is the motion. The only stored
// value is the shaft angle. The disc is rotated by it, and the follower's
// height is read from the very same `lift()` at the very same angle, so the
// profile point sitting under the follower and the follower's foot are, by
// construction, the same point — they can never drift out of agreement. The
// cycloidal segments are chosen for a reason a cam designer would recognise:
// they begin and end with zero velocity AND zero acceleration, so the follower
// is never jerked — no corner in the curve, no shock in the shaft.

const TAU = Math.PI * 2
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame (SVG user units).
const O = { x: 150, y: 192 } // cam shaft centre
const R0 = 38 // base circle radius — the follower's lowest rest radius
const L = 36 // maximum lift, added to the base circle at the program's peak

// The motion program, in degrees of shaft angle. A classic dwell–rise–dwell–
// fall, deliberately asymmetric so it reads as a program and never as a sine.
const RISE_END = 100 // cycloidal climb 0 -> L across the first 100 degrees
const HIGH_END = 160 // held at full lift
const FALL_END = 290 // cycloidal descent L -> 0 across 130 degrees
// 290 -> 360 is the low dwell, back where it started.

/** Lift at shaft angle α (degrees). Cycloidal on the moving segments: both ends
 * meet at zero velocity and zero acceleration, so the follower is never jerked.
 * This single function defines both the follower's height and the disc's edge. */
function lift(aDeg: number): number {
  const a = norm(aDeg)
  if (a < RISE_END) {
    const b = a / RISE_END
    return L * (b - Math.sin(TAU * b) / TAU)
  }
  if (a < HIGH_END) return L
  if (a < FALL_END) {
    const b = (a - HIGH_END) / (FALL_END - HIGH_END)
    return L * (1 - (b - Math.sin(TAU * b) / TAU))
  }
  return 0
}

function segmentName(a: number): string {
  const x = norm(a)
  if (x < RISE_END) return 'rise'
  if (x < HIGH_END) return 'top dwell'
  if (x < FALL_END) return 'fall'
  return 'base dwell'
}

// Segment boundaries, for the End key's jump to the next phase change.
const BOUNDS = [0, RISE_END, HIGH_END, FALL_END, 360]

export function CamFollower({ className = '' }: { className?: string }) {
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

  const phase = norm(drive)
  const s = lift(phase) // the whole output, in one line, from the one law
  const frac = s / L
  // The follower contacts the disc straight above the shaft. We rotate the disc
  // so the profile point at cam-frame angle `phase` sits at the top (world 270
  // degrees, straight up in screen coords), and read the follower's height from
  // the same angle — so foot and profile are the same point by construction.
  const camRot = 270 - drive
  const footY = O.y - (R0 + s)

  // Continuous spin (skipped under reduced motion, where Step advances to the
  // next phase boundary rather than sweeping the frames between).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 60) // 60 deg/s -> a 6s turn
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
    // The shaft turns the opposite way to the pointer's travel around it,
    // because the disc is drawn rotated by (270 - drive): dragging clockwise
    // winds the program forward, which is the intuitive reading.
    setDrive((v) => v - delta)
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

  const jumpNextPhase = () => {
    const p = norm(drive)
    const next = BOUNDS.find((b) => b > p + 0.01)
    const target = next === undefined || next >= 360 ? 360 : next
    setRunning(false)
    setDrive((v) => v + (target - p))
  }

  const toggleRun = useCallback(() => {
    if (reduce) {
      setDrive((v) => {
        const p = norm(v)
        const next = BOUNDS.find((b) => b > p + 0.01)
        const target = next === undefined || next >= 360 ? 360 : next
        return v + (target - p)
      })
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
      setDrive(0)
    } else if (e.key === 'End') jumpNextPhase()
    else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  // The cam edge: the lift law in polar form. radius(α) = R0 + s(α). Drawn once
  // in the cam's own frame and rotated whole by `camRot`, so it is literally the
  // same curve the follower reads, not a shape standing in for one.
  const camPath = useMemo(() => {
    const steps = 240
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * 360
      const r = R0 + lift(a)
      const x = O.x + r * Math.cos((a * Math.PI) / 180)
      const y = O.y + r * Math.sin((a * Math.PI) / 180)
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
    }
    return d.trim() + ' Z'
  }, [])

  // The displacement diagram on the right: shaft angle runs left to right, lift
  // runs up. This is the cam engineer's drawing of the very same law, with a
  // live marker riding the curve at the current angle.
  const DX = 266
  const DY0 = 224 // baseline (lift 0)
  const DW = 170
  const DH = 96
  const diagPath = useMemo(() => {
    const steps = 180
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * 360
      const x = DX + (a / 360) * DW
      const y = DY0 - (lift(a) / L) * DH
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
    }
    return d.trim()
  }, [])
  const markX = DX + (phase / 360) * DW
  const markY = DY0 - frac * DH

  // Follower body geometry, all derived from footY so it moves as one rigid part.
  const stemTopY = footY - 74
  const collarY = footY - 56
  const SPRING_TOP = 30 // just under the fixed ceiling bushing
  const coils = useMemo(() => {
    const n = 7
    const arr: number[] = []
    for (let i = 0; i < n; i++) arr.push(SPRING_TOP + ((collarY - SPRING_TOP) * i) / (n - 1))
    return arr
  }, [collarY])

  const seg = segmentName(phase)

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(phase)}
        aria-valuetext={`Shaft ${Math.round(phase)} degrees, ${seg}, follower lift ${Math.round(frac * 100)} percent`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Cam and follower. Drag the disc to turn the shaft, arrow keys nudge the shaft angle, Shift for a larger step,
          Space runs or stops it, Home returns to zero and End jumps to the next phase change. A live region reads the
          shaft angle, the phase of the program, and the follower&rsquo;s lift.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 300"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-disc`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </radialGradient>
            <linearGradient id={`${gid}-stem`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.07)" />
            </linearGradient>
            <radialGradient id={`${gid}-foot`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* --- Fixed ceiling bracket + guide bushing: the follower may only rise and fall --- */}
          <line x1={O.x - 44} y1={22} x2={O.x + 44} y2={22} stroke="rgba(255,255,255,0.18)" strokeWidth={4} strokeLinecap="round" />
          {[-1, 1].map((d) => (
            <line key={d} x1={O.x + d * 22} y1={22} x2={O.x + d * 30} y2={14} stroke="rgba(255,255,255,0.1)" strokeWidth={2} strokeLinecap="round" />
          ))}
          <rect x={O.x - 12} y={24} width={24} height={10} rx={3} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.16)" strokeWidth={1} />

          {/* --- Return spring: compresses as the follower rises (form closure, holding the foot on the cam) --- */}
          <line x1={O.x} y1={SPRING_TOP} x2={O.x} y2={collarY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          {coils.map((cy, i) => (
            <ellipse
              key={i}
              cx={O.x}
              cy={cy}
              rx={12}
              ry={3.4}
              fill="none"
              stroke="rgba(220,248,124,0.4)"
              strokeWidth={1.6}
            />
          ))}

          {/* --- The follower: one rigid part, translated to footY --- */}
          {/* collar flange the spring presses on */}
          <rect x={O.x - 15} y={collarY - 3} width={30} height={6} rx={3} fill={`url(#${gid}-stem)`} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          {/* stem */}
          <rect x={O.x - 7} y={stemTopY} width={14} height={footY - stemTopY} rx={5} fill={`url(#${gid}-stem)`} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          {/* output cap at the top of the stem */}
          <rect x={O.x - 11} y={stemTopY - 7} width={22} height={9} rx={3} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
          {/* knife-edge foot: a pointed tip that rides directly on the profile, so lift = profile radius exactly */}
          <path
            d={`M${O.x - 8} ${footY - 11} L${O.x + 8} ${footY - 11} L${O.x} ${footY} Z`}
            fill={`url(#${gid}-foot)`}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={0.5}
          />

          {/* --- The cam disc: the lift law drawn as a polar edge, rotated by the shaft angle --- */}
          <g transform={`rotate(${camRot.toFixed(3)} ${O.x} ${O.y})`}>
            {/* base circle, the radius the follower rests on through the base dwell */}
            <circle cx={O.x} cy={O.y} r={R0} fill="none" stroke="rgba(255,255,255,0.14)" strokeDasharray="2 5" strokeWidth={1} />
            <path d={camPath} fill={`url(#${gid}-disc)`} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinejoin="round" />
            {/* index line + keyway, so the turn reads even through a dwell when the follower holds still */}
            <line x1={O.x} y1={O.y} x2={O.x} y2={O.y - (R0 + L)} stroke="rgba(220,248,124,0.5)" strokeWidth={2} strokeLinecap="round" />
            <rect x={O.x - 2.5} y={O.y - 10} width={5} height={10} rx={1.5} fill="#0B0B0B" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
          </g>
          {/* shaft hub, fixed (does not turn with the index line) */}
          <circle cx={O.x} cy={O.y} r={6} fill="#0B0B0B" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />

          {/* --- Displacement diagram: the same law, drawn as the cam engineer would --- */}
          <line x1={DX} y1={DY0} x2={DX + DW} y2={DY0} stroke="rgba(255,255,255,0.14)" strokeWidth={1.2} />
          <line x1={DX} y1={DY0} x2={DX} y2={DY0 - DH} stroke="rgba(255,255,255,0.14)" strokeWidth={1.2} />
          <line x1={DX} y1={DY0 - DH} x2={DX + DW} y2={DY0 - DH} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 5" strokeWidth={1} />
          {/* phase boundaries ticked faintly on the axis */}
          {[RISE_END, HIGH_END, FALL_END].map((b) => (
            <line
              key={b}
              x1={DX + (b / 360) * DW}
              y1={DY0}
              x2={DX + (b / 360) * DW}
              y2={DY0 + 5}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
            />
          ))}
          <path d={diagPath} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          {/* live marker, the same angle and lift the follower is at */}
          <line x1={markX} y1={DY0} x2={markX} y2={markY} stroke="rgba(220,248,124,0.4)" strokeWidth={1.5} strokeDasharray="2 4" />
          <circle cx={markX} cy={markY} r={4.5} fill="#DCF87C" stroke="#0B0B0B" strokeWidth={1.5} />
        </svg>
      </div>

      {/* Live readout — the angle, the phase, and the derived lift, always in step */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {Math.round(phase)}&deg; &middot; {seg} &middot; {Math.round(frac * 100)}%
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
