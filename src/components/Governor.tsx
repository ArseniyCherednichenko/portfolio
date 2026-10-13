import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A centrifugal (flyball) governor — James Watt and Matthew Boulton's self-
// regulating speed control, the first widely used feedback device of the
// industrial age (c. 1788).
//
// The problem it solves: a steam engine under a changing load wants to race
// when unloaded and stall when overloaded. The governor sits on a spindle
// geared to the engine and spins with it. Two heavy balls hang from arms
// hinged at the top; as the spindle turns faster, the balls fly outward and
// rise, and through a pair of lower links that lift drags a sliding sleeve up
// the spindle. The sleeve is coupled to the throttle. So: faster -> balls out
// -> sleeve up -> throttle closes -> the engine slows. Slower -> balls drop ->
// sleeve down -> throttle opens -> it speeds up. The machine holds its own
// speed, and finds a new balance whenever the load changes. Negative feedback,
// built of iron, a century before anyone wrote down a control equation.
//
// The honest part here is the balance and the loop, not a draughtsman's detail.
// Each ball is a point mass on an arm of length L making a cone half-angle
// theta with the vertical spindle. Spin it fast enough and the arm obeys the
// conical-pendulum law: cos(theta) = G / omega^2 — the same relation that puts
// a planet's orbit where it belongs, here written in brass. DRAG a ball out or
// in and the readout shows the exact spindle speed that cone angle demands.
// Press RUN and a real loop takes over: a prime mover drives the spindle,
// omega' = Q*(1 - sleeve) - mu*omega, so as the balls climb and the sleeve
// rises the drive is throttled back, and the whole thing hunts a moment and
// settles on a governed speed. Arrows raise or lower the load Q and watch it
// find a new balance — the governor's whole reason to exist. The sleeve height
// is not scripted: it is the exact length of the lower link resolved to the
// spindle axis each frame, so the picture and the mechanism are one object.
// Under reduced motion it never free-runs — it snaps to the settled state for
// the current load and the drag still works.

// Scaled dynamics constants (not SI — tuned so the governed speed sits mid-cone
// across the whole load range and the hunting reads without the eye losing it).
const G = 40 // gravity-over-arm-length; critical speed is omega = sqrt(G)
const DAMP = 2.0 // arm damping — sets how much it hunts before settling
const FRICTION = 6 // spindle bearing friction, the mu in omega'
const Q_MIN = 40
const Q_MAX = 240
const Q_DEF = 120
const Q_STEP = 12

const THETA_MIN = (8 * Math.PI) / 180 // arms never fully collapse onto the spindle
const THETA_MAX = (62 * Math.PI) / 180 // nor fully splay — the sleeve tops out here

// Geometry, in SVG units, drawn front-on so the opening of the arms and the
// rise of the sleeve — both in the plane — read directly; the rotation about
// the vertical axis is carried by the spinning hub cap and the ball sheen.
const PIV = { x: 0, y: -70 } // the arm pivot at the top of the spindle
const L = 92 // upper-arm length, pivot to ball centre
const L2 = 86 // lower-link length, ball to sleeve collar (> max ball reach)
const BOB_R = 13
const BASE_Y = 152
const VB = { x: -120, y: -108, w: 240, h: 272 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// The right-hand ball centre for a given cone half-angle.
const ballAt = (theta: number) => ({
  x: L * Math.sin(theta),
  y: PIV.y + L * Math.cos(theta),
})

// The sleeve rides the spindle axis; the lower link of fixed length L2 runs from
// the ball down to it, so the collar sits exactly sqrt(L2^2 - bx^2) below the
// ball. Pure kinematics — no easing, no fudge.
const sleeveYFor = (theta: number) => {
  const b = ballAt(theta)
  return b.y + Math.sqrt(Math.max(0, L2 * L2 - b.x * b.x))
}

const SLEEVE_REST = sleeveYFor(THETA_MIN) // lowest the collar ever sits
const SLEEVE_TOP = sleeveYFor(THETA_MAX) // highest
const SLEEVE_SPAN = SLEEVE_REST - SLEEVE_TOP

// Fraction of its travel the sleeve has lifted, 0 at rest to 1 at the top. This
// is the signal fed back to the throttle.
const sleeveFrac = (theta: number) => clamp((SLEEVE_REST - sleeveYFor(theta)) / SLEEVE_SPAN, 0, 1)

// The spindle speed a given cone angle demands at balance: cos(theta)=G/omega^2.
const omegaFor = (theta: number) => Math.sqrt(G / Math.cos(theta))

// Solve the steady governed state for a load Q by marching the loop to rest —
// used under reduced motion, where there is no live animation to settle.
function settle(q: number): { theta: number; omega: number } {
  let theta = THETA_MIN + 0.2
  let thetaV = 0
  let omega = 5
  for (let i = 0; i < 4000; i++) {
    const dt = 0.016
    const s = sleeveFrac(theta)
    const acc = omega * omega * Math.sin(theta) * Math.cos(theta) - G * Math.sin(theta) - DAMP * thetaV
    thetaV += acc * dt
    theta = clamp(theta + thetaV * dt, THETA_MIN, THETA_MAX)
    if (theta === THETA_MIN || theta === THETA_MAX) thetaV = 0
    omega = Math.max(0, omega + (q * (1 - s) - FRICTION * omega) * dt)
  }
  return { theta, omega }
}

export function Governor({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()

  const [theta, setTheta] = useState(THETA_MIN + 0.12)
  const [omega, setOmega] = useState(omegaFor(THETA_MIN + 0.12))
  const [q, setQ] = useState(Q_DEF)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const thetaV = useRef(0) // arm angular velocity, integrated during Run
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)
  const qRef = useRef(q)
  qRef.current = q
  // omega mirrored into a ref so the rAF closure always reads the live value.
  const omegaRef = useRef(omega)
  omegaRef.current = omega

  // The feedback loop, integrated frame by frame (semi-implicit Euler). The
  // spindle is driven toward speed by Q, throttled by how high the sleeve has
  // risen; the arms obey the rotating-frame balance and drag the sleeve.
  useEffect(() => {
    if (!running || reduce) return
    const step = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.03, (t - lastT.current) / 1000)
      lastT.current = t
      setTheta((th) => {
        const w = omegaRef.current
        const s = sleeveFrac(th)
        const acc = w * w * Math.sin(th) * Math.cos(th) - G * Math.sin(th) - DAMP * thetaV.current
        thetaV.current += acc * dt
        let next = th + thetaV.current * dt
        if (next <= THETA_MIN) {
          next = THETA_MIN
          if (thetaV.current < 0) thetaV.current = 0
        } else if (next >= THETA_MAX) {
          next = THETA_MAX
          if (thetaV.current > 0) thetaV.current = 0
        }
        const wNext = Math.max(0, w + (qRef.current * (1 - s) - FRICTION * w) * dt)
        omegaRef.current = wNext
        setOmega(wNext)
        return next
      })
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
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

  // Map a pointer to a cone angle: the horizontal distance from the spindle sets
  // how far the ball has swung out, clamped to the arm's travel.
  const pointerTheta = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return theta
    const rect = svg.getBoundingClientRect()
    const x = VB.x + ((clientX - rect.left) / rect.width) * VB.w
    const y = VB.y + ((clientY - rect.top) / rect.height) * VB.h
    // angle of the arm from straight down, taken on whichever side was grabbed
    const deg = Math.atan2(Math.abs(x - PIV.x), Math.max(1, y - PIV.y))
    return clamp(deg, THETA_MIN, THETA_MAX)
  }

  const applyDrag = (th: number) => {
    thetaV.current = 0
    setTheta(th)
    setOmega(omegaFor(th)) // the speed this cone angle balances at
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    applyDrag(pointerTheta(e.clientX, e.clientY))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    applyDrag(pointerTheta(e.clientX, e.clientY))
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

  const changeLoad = useCallback(
    (delta: number) => {
      setQ((prev) => {
        const next = clamp(prev + delta, Q_MIN, Q_MAX)
        if (reduce) {
          const st = settle(next)
          thetaV.current = 0
          setTheta(st.theta)
          setOmega(st.omega)
        }
        return next
      })
    },
    [reduce],
  )

  const toggleRun = () => {
    if (reduce) {
      const st = settle(qRef.current)
      thetaV.current = 0
      setTheta(st.theta)
      setOmega(st.omega)
      return
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    setRunning(false)
    thetaV.current = 0
    setQ(Q_DEF)
    setTheta(THETA_MIN + 0.12)
    setOmega(omegaFor(THETA_MIN + 0.12))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? Q_STEP * 3 : Q_STEP
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') changeLoad(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') changeLoad(s)
    else if (e.key === 'Home') reset()
    else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  // Derived geometry for the current frame.
  const br = ballAt(theta)
  const bl = { x: -br.x, y: br.y }
  const sleeveY = sleeveYFor(theta)
  const s = sleeveFrac(theta)
  const coneDeg = Math.round((theta * 180) / Math.PI)
  const speed = omega // scaled spindle speed
  const spin = Math.min(1, omega / 11) // 0..1 how fast it is turning, for the sheen
  const hubAngle = (omega * 42) % 360 // the hub cap's momentary rotation

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={Q_MIN}
        aria-valuemax={Q_MAX}
        aria-valuenow={q}
        aria-valuetext={`Cone angle ${coneDeg} degrees, spindle speed ${speed.toFixed(1)}, load ${q}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Centrifugal flyball governor. Drag a ball out or in to set the cone angle and read the spindle speed it
          balances at. Space runs the feedback loop so it settles on a governed speed; arrow keys raise or lower the
          load and it finds a new balance, Shift for a bigger step; Home resets.
        </span>
        <svg
          ref={svgRef}
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id="gov-ball" cx="0.36" cy="0.32" r="0.85">
              <stop offset="0" stopColor="#f2ffc0" />
              <stop offset="0.5" stopColor="#DCF87C" />
              <stop offset="1" stopColor="#8aa52f" />
            </radialGradient>
            <radialGradient id="gov-hub" cx="0.5" cy="0.4" r="0.7">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
            </radialGradient>
            <linearGradient id="gov-spindle" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="0.5" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.1)" />
            </linearGradient>
          </defs>

          {/* The base bearing the spindle stands in. */}
          <rect x={-44} y={BASE_Y} width={88} height={12} rx={3} fill="#12140f" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
          <rect x={-30} y={BASE_Y - 6} width={60} height={8} rx={2} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

          {/* The spindle, from the base up through the sleeve to the pivot. */}
          <rect x={-3.2} y={PIV.y} width={6.4} height={BASE_Y - PIV.y} rx={3.2} fill="url(#gov-spindle)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />

          {/* The lower links, running from each ball down to the collar on the axis. */}
          <line x1={br.x} y1={br.y} x2={0} y2={sleeveY} stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round" />
          <line x1={bl.x} y1={bl.y} x2={0} y2={sleeveY} stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round" />

          {/* The sliding sleeve — the throttle takeoff. A lime fill tracks how far
              it has lifted, the feedback signal made visible. */}
          <rect
            x={-20}
            y={sleeveY - 7}
            width={40}
            height={14}
            rx={3}
            fill="#161812"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.3"
          />
          <rect
            x={-20}
            y={sleeveY - 7}
            width={40 * s}
            height={14}
            rx={3}
            fill="#DCF87C"
            opacity={0.85}
          />

          {/* The upper arms from the pivot to each ball. */}
          <line x1={PIV.x} y1={PIV.y} x2={br.x} y2={br.y} stroke="rgba(255,255,255,0.6)" strokeWidth="3.4" strokeLinecap="round" />
          <line x1={PIV.x} y1={PIV.y} x2={bl.x} y2={bl.y} stroke="rgba(255,255,255,0.6)" strokeWidth="3.4" strokeLinecap="round" />

          {/* Faint speed arcs behind each ball, brightening with the spin. */}
          {spin > 0.04 && (
            <g opacity={0.14 + spin * 0.4}>
              <path
                d={`M${br.x - 7} ${br.y - 15} A 18 18 0 0 1 ${br.x + 11} ${br.y - 9}`}
                fill="none"
                stroke="#DCF87C"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
              <path
                d={`M${bl.x + 7} ${bl.y - 15} A 18 18 0 0 0 ${bl.x - 11} ${bl.y - 9}`}
                fill="none"
                stroke="#DCF87C"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            </g>
          )}

          {/* The two flyballs. */}
          {[br, bl].map((b, i) => (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={BOB_R} fill="url(#gov-ball)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
              <ellipse cx={b.x - 4} cy={b.y - 4} rx={3.6} ry={5} fill="rgba(255,255,255,0.4)" />
            </g>
          ))}

          {/* The hub cap on the pivot, spinning with the spindle — the one cue of
              rotation in a front-on view. A lime notch marks its turn. */}
          <g transform={`rotate(${hubAngle.toFixed(1)} ${PIV.x} ${PIV.y - 12})`}>
            <circle cx={PIV.x} cy={PIV.y - 12} r={13} fill="url(#gov-hub)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" />
            <rect x={PIV.x - 1.4} y={PIV.y - 24} width={2.8} height={9} rx={1.4} fill="#DCF87C" />
          </g>
          <circle cx={PIV.x} cy={PIV.y} r={4.2} fill="#12140f" stroke="#DCF87C" strokeWidth="1.6" />
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-lg border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-2 text-center font-mono text-lg tabular-nums text-[#DCF87C]">
          {coneDeg}
          <span className="text-sm">&deg;</span>
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-[#DCF87C]/70">cone</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-center font-mono text-lg tabular-nums text-white/80">
          {speed.toFixed(1)}
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">speed</span>
        </div>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {reduce ? 'Settle' : running ? 'Stop' : 'Run'}
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1">
          <button
            type="button"
            onClick={() => changeLoad(-Q_STEP)}
            aria-label="Lower the load"
            className="rounded px-2 py-1 text-sm text-white/60 transition-colors hover:text-white"
          >
            &minus;
          </button>
          <span className="min-w-[4.5rem] text-center font-mono text-xs tabular-nums text-white/55">load {q}</span>
          <button
            type="button"
            onClick={() => changeLoad(Q_STEP)}
            aria-label="Raise the load"
            className="rounded px-2 py-1 text-sm text-white/60 transition-colors hover:text-white"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Reset
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {`Cone angle ${coneDeg} degrees, spindle speed ${speed.toFixed(1)}, load ${q}`}
      </span>
    </div>
  )
}
