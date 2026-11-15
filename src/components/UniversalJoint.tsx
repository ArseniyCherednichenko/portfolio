import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Hooke (Cardan) universal joint — the one in the rigid-mechanism corner that
// does what none of the others do: it carries rotation around a bend. Two shafts
// meet at an angle, a cross (the spider) pins between their forks, and a turn of
// one shaft hands a turn to the other across the kink.
//
// The honest, and faintly famous, part is the cost of that bend. The joint is
// not a constant-velocity coupling: drive the input at a steady speed and the
// output does not keep step — it runs ahead of the input through part of each
// turn and lags behind through the rest, twice a revolution, by more the steeper
// the bend. That ripple is not a defect in this drawing; it is forced by the
// geometry, and it is exactly why a driveshaft under a car uses two of these out
// of phase, or a constant-velocity joint instead.
//
// None of the motion here is scripted. The cross is a rigid right angle: one arm
// is held perpendicular to the input shaft and swung by the input angle; the
// other must stay perpendicular to BOTH that arm and the output shaft, so it is
// the normalised cross product a2 x arm1, and nothing else it could be. The
// output angle read off it is therefore the textbook Cardan relation
//   theta2 = atan2(sin theta1, cos(beta) * cos theta1)
// and the instantaneous speed ratio
//   omega2 / omega1 = cos(beta) / (1 - sin^2(beta) * cos^2(theta1))
// swings between cos(beta) and 1/cos(beta) — both plotted live beneath the joint.
// DRAG to turn the input shaft, the button spins it, arrows nudge it; a second
// slider sets the bend. Under reduced motion the spin never starts — Step turns
// the input on a station at a time.

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const norm = (d: number) => ((d % 360) + 360) % 360
const norm180 = (d: number) => (((d % 360) + 540) % 360) - 180
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

type V3 = [number, number, number]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const unit = (v: V3): V3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1e-9
  return [v[0] / m, v[1] / m, v[2] / m]
}
const scale = (v: V3, s: number): V3 => [v[0] * s, v[1] * s, v[2] * s]

// Oblique projection of a math point (x right, y up, z into depth) to svg (y down).
// Depth is thrown gently down-right so the two rotation hoops read as tilted rings.
const SC = 100
const DZX = 0.45
const DZY = 0.28
const px = (p: V3) => (p[0] + p[2] * DZX) * SC
const py = (p: V3) => (-p[1] + p[2] * DZY) * SC

// Geometry, in a unit where the pin circle has radius r.
const R_SHAFT = 1.35 // shaft half-length from the joint centre
const R_YOKE = 0.55 // where a yoke's fork springs off its shaft
const R = 0.5 // cross (pin-circle) radius

// The input cross-arm: perpendicular to the input shaft (the x axis), swung about
// it by the input angle. At 0 it stands straight up in the screen plane.
const inputArm = (t1: number): V3 => [0, Math.cos(rad(t1)), Math.sin(rad(t1))]

interface Pose {
  a2: V3 // output shaft axis
  arm1: V3 // cross arm held by the input fork (unit)
  arm2: V3 // cross arm held by the output fork (unit)
  t2: number // output angle, degrees (Cardan relation)
  ratio: number // instantaneous omega2 / omega1
}

function solve(t1: number, beta: number): Pose {
  const b = rad(beta)
  const a2: V3 = [Math.cos(b), Math.sin(b), 0]
  const arm1 = inputArm(t1)
  const arm2 = unit(cross(a2, arm1)) // forced perpendicular to both shaft and arm1
  const t2 = deg(Math.atan2(Math.sin(rad(t1)), Math.cos(b) * Math.cos(rad(t1))))
  const ratio = Math.cos(b) / (1 - Math.sin(b) * Math.sin(b) * Math.cos(rad(t1)) * Math.cos(rad(t1)))
  return { a2, arm1, arm2, t2, ratio }
}

const line = (p: V3, q: V3, extra = '') =>
  `M${px(p).toFixed(1)} ${py(p).toFixed(1)}L${px(q).toFixed(1)} ${py(q).toFixed(1)}${extra}`

// A projected circle (a shaft's pin-hoop) in the plane perpendicular to axis n.
function hoop(n: V3, r: number): string {
  // two orthonormal vectors spanning the plane perpendicular to n
  const seed: V3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]
  const u = unit(cross(n, seed))
  const v = unit(cross(n, u))
  let d = ''
  const N = 48
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const p: V3 = [
      r * (Math.cos(a) * u[0] + Math.sin(a) * v[0]),
      r * (Math.cos(a) * u[1] + Math.sin(a) * v[1]),
      r * (Math.cos(a) * u[2] + Math.sin(a) * v[2]),
    ]
    d += `${i === 0 ? 'M' : 'L'}${px(p).toFixed(1)} ${py(p).toFixed(1)} `
  }
  return d + 'Z'
}

const VB = { x: -158, y: -120, w: 316, h: 196 }

// The velocity-ripple inset: omega2/omega1 across one input turn, with the live
// marker and the min/max band the current bend forces.
const GVB = { w: 316, h: 92 }
const G_PAD = { l: 8, r: 8, t: 10, b: 16 }
const V_MIN = 0.58 // domain floor (1/cos is <= ~1.74 at 55 degrees)
const V_MAX = 1.74

export function UniversalJoint({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [theta, setTheta] = useState(28) // input angle, unbounded across the seam
  const [beta, setBeta] = useState(32) // shaft bend, degrees
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const pose = solve(theta, beta)
  const t1n = norm(theta)
  const t2n = norm(pose.t2)
  const lag = norm180(pose.t2 - theta)
  const vmin = Math.cos(rad(beta))
  const vmax = 1 / Math.cos(rad(beta))

  // The ripple curve for the current bend, redrawn only when the bend changes.
  const ripplePath = useMemo(() => {
    const gx = (t: number) => G_PAD.l + (t / 360) * (GVB.w - G_PAD.l - G_PAD.r)
    const gy = (v: number) =>
      G_PAD.t + (1 - (v - V_MIN) / (V_MAX - V_MIN)) * (GVB.h - G_PAD.t - G_PAD.b)
    const b = rad(beta)
    let d = ''
    for (let t = 0; t <= 360; t += 2) {
      const v = Math.cos(b) / (1 - Math.sin(b) * Math.sin(b) * Math.cos(rad(t)) * Math.cos(rad(t)))
      d += `${t === 0 ? 'M' : 'L'}${gx(t).toFixed(1)} ${gy(v).toFixed(1)} `
    }
    return d
  }, [beta])

  const gX = (t: number) => G_PAD.l + (t / 360) * (GVB.w - G_PAD.l - G_PAD.r)
  const gY = (v: number) =>
    G_PAD.t + (1 - (v - V_MIN) / (V_MAX - V_MIN)) * (GVB.h - G_PAD.t - G_PAD.b)

  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setTheta((th) => th + dt * 70) // deg/s — slow enough to watch the lead and lag
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
    // angle about the joint centre, which projects to svg (0,0)
    return norm((Math.atan2(-y, x) * 180) / Math.PI)
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
      setTheta((th) => th + 24)
      return
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    setRunning(false)
    setTheta(28)
    setBeta(32)
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

  // Pin ends. Depth (z) dims and shrinks the far pin so the ring reads as 3D.
  const pins = [
    { p: scale(pose.arm1, R), accent: true },
    { p: scale(pose.arm1, -R), accent: true },
    { p: scale(pose.arm2, R), accent: false },
    { p: scale(pose.arm2, -R), accent: false },
  ]
  const OTp = scale(pose.a2, R_SHAFT)
  const OYR = scale(pose.a2, R_YOKE)
  const IT: V3 = [-R_SHAFT, 0, 0]
  const IYR: V3 = [-R_YOKE, 0, 0]
  const O: V3 = [0, 0, 0]

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(t1n)}
        aria-valuetext={`Input shaft ${Math.round(t1n)} degrees, output ${Math.round(t2n)} degrees`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Hooke universal joint. Drag to turn the input shaft, arrow keys nudge it, Shift for a bigger step, Space spins
          or stops it, Home returns the input to zero. A separate slider sets the bend between the shafts.
        </span>
        <svg
          ref={svgRef}
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <linearGradient id="uj-in" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.46)" />
            </linearGradient>
            <linearGradient id="uj-out" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="rgba(220,248,124,0.32)" />
              <stop offset="1" stopColor="rgba(220,248,124,0.66)" />
            </linearGradient>
          </defs>

          {/* The two shaft axes, as faint centre-lines, so the bend angle reads. */}
          <path d={line(IT, O)} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="2 4" />
          <path d={line(O, OTp)} stroke="rgba(220,248,124,0.18)" strokeWidth="1" strokeDasharray="2 4" />

          {/* The two rotation hoops: the circles each fork's pins travel on, tilted
              apart by the bend — the gimbal read as two rings. */}
          <path d={hoop([1, 0, 0], R)} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.1" />
          <path d={hoop(pose.a2, R)} fill="none" stroke="rgba(220,248,124,0.16)" strokeWidth="1.1" />

          {/* Input shaft (solid bar), its yoke forks reaching to the two near pins. */}
          <path d={line(IT, IYR)} stroke="url(#uj-in)" strokeWidth="9" strokeLinecap="round" />
          <path
            d={line(IYR, scale(pose.arm1, R)) + line(IYR, scale(pose.arm1, -R))}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Output shaft (accent), its yoke forks reaching to the two far pins. */}
          <path d={line(OYR, OTp)} stroke="url(#uj-out)" strokeWidth="9" strokeLinecap="round" />
          <path
            d={line(OYR, scale(pose.arm2, R)) + line(OYR, scale(pose.arm2, -R))}
            fill="none"
            stroke="rgba(220,248,124,0.62)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* The cross itself: two rigid arms at a right angle, meeting at the hub. */}
          <path
            d={line(scale(pose.arm1, R), scale(pose.arm1, -R))}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d={line(scale(pose.arm2, R), scale(pose.arm2, -R))}
            stroke="#DCF87C"
            strokeWidth="3.4"
            strokeLinecap="round"
          />

          {/* Pins, depth-sorted far-to-near so the near ones sit on top. */}
          {pins
            .slice()
            .sort((a, b) => b.p[2] - a.p[2])
            .map(({ p, accent }, i) => {
              const depth = (p[2] + R) / (2 * R) // 0 far .. 1 near
              const rr = 3.2 + depth * 1.6
              const op = 0.5 + depth * 0.5
              return (
                <circle
                  key={i}
                  cx={px(p)}
                  cy={py(p)}
                  r={rr}
                  fill="#12140f"
                  stroke={accent ? 'rgba(255,255,255,0.85)' : '#DCF87C'}
                  strokeWidth="1.6"
                  opacity={op}
                />
              )
            })}
          {/* The hub at the joint centre. */}
          <circle cx={px(O)} cy={py(O)} r="5.5" fill="#12140f" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />
          <circle cx={px(O)} cy={py(O)} r="1.8" fill="rgba(255,255,255,0.6)" />

          {/* Quiet shaft labels. */}
          <text x={px(IT)} y={py(IT) - 12} textAnchor="middle" className="fill-white/35" style={{ fontSize: 9 }}>
            input
          </text>
          <text
            x={px(OTp)}
            y={py(OTp) - 12}
            textAnchor="middle"
            className="fill-[#DCF87C]/50"
            style={{ fontSize: 9 }}
          >
            output
          </text>
        </svg>
      </div>

      {/* The velocity-ripple inset. */}
      <svg
        viewBox={`0 0 ${GVB.w} ${GVB.h}`}
        className="mt-3 h-auto w-full max-w-2xl"
        role="img"
        aria-label={`Speed ratio across one turn: ranges ${vmin.toFixed(2)} to ${vmax.toFixed(2)} at this bend`}
      >
        {/* unity line — where a straight, bend-free shaft would sit, always */}
        <line
          x1={G_PAD.l}
          y1={gY(1)}
          x2={GVB.w - G_PAD.r}
          y2={gY(1)}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        {/* the band this bend forces the ratio between */}
        <line x1={G_PAD.l} y1={gY(vmax)} x2={GVB.w - G_PAD.r} y2={gY(vmax)} stroke="rgba(220,248,124,0.16)" strokeWidth="1" />
        <line x1={G_PAD.l} y1={gY(vmin)} x2={GVB.w - G_PAD.r} y2={gY(vmin)} stroke="rgba(220,248,124,0.16)" strokeWidth="1" />
        <path d={ripplePath} fill="none" stroke="#DCF87C" strokeWidth="1.8" strokeLinejoin="round" />
        {/* live marker at the current input angle */}
        <line
          x1={gX(t1n)}
          y1={G_PAD.t - 2}
          x2={gX(t1n)}
          y2={GVB.h - G_PAD.b + 2}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
        <circle cx={gX(t1n)} cy={gY(pose.ratio)} r="3.2" fill="#DCF87C" stroke="#12140f" strokeWidth="1" />
        <text x={G_PAD.l} y={gY(vmax) - 3} className="fill-[#DCF87C]/55" style={{ fontSize: 8 }}>
          1/cos β = {vmax.toFixed(2)}
        </text>
        <text x={G_PAD.l} y={gY(vmin) + 9} className="fill-[#DCF87C]/55" style={{ fontSize: 8 }}>
          cos β = {vmin.toFixed(2)}
        </text>
      </svg>

      {/* Readouts: input, output, the lead/lag the bend costs, and the live ratio. */}
      <div className="mt-5 grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
          <div className="font-mono text-base tabular-nums text-white/80">{Math.round(t1n)}&deg;</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">input</div>
        </div>
        <div className="rounded-lg border border-[#DCF87C]/35 bg-[#DCF87C]/[0.06] px-3 py-2 text-center">
          <div className="font-mono text-base tabular-nums text-[#DCF87C]">{Math.round(t2n)}&deg;</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#DCF87C]/60">output</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
          <div className="font-mono text-base tabular-nums text-white/80">
            {lag >= 0 ? '+' : '−'}
            {Math.abs(lag).toFixed(1)}&deg;
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">lead / lag</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
          <div className="font-mono text-base tabular-nums text-white/80">{pose.ratio.toFixed(3)}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">speed ratio</div>
        </div>
      </div>

      {/* The bend control. */}
      <div className="mt-5 flex w-full max-w-md items-center gap-3">
        <label htmlFor={`${labelId}-beta`} className="shrink-0 text-xs font-semibold uppercase tracking-wider text-white/45">
          Bend
        </label>
        <input
          id={`${labelId}-beta`}
          type="range"
          min={0}
          max={55}
          step={1}
          value={beta}
          onChange={(e) => setBeta(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#DCF87C]"
          aria-label="Shaft bend angle in degrees"
        />
        <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums text-[#DCF87C]">{beta}&deg;</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {reduce ? 'Step' : running ? 'Stop' : 'Spin'}
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
        {`Input ${Math.round(t1n)} degrees, output ${Math.round(t2n)} degrees, speed ratio ${pose.ratio.toFixed(2)}, bend ${beta} degrees`}
      </span>
    </div>
  )
}
