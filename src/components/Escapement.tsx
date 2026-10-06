import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A deadbeat clock escapement — the heart of a pendulum clock, where a swinging
// weight is let out one measured step at a time.
//
// Every mechanical clock has to solve the same problem: a falling weight (or a
// wound spring) wants to spin the gear train away all at once, and a pendulum
// swings at a rate that barely cares what you hang off it. The escapement is the
// piece that marries the two. An anchor rides on the pendulum and rocks with it;
// at each end of the swing one of its two pallets lifts off a tooth of the escape
// wheel and lets the wheel turn — but only until the next tooth drops onto the
// other pallet and stops it dead. So the wheel does not run; it ticks. The weight
// pushes, the pendulum times, and the wheel is handed forward exactly one tooth
// per swing. That is the sound of a clock: the drop of each tooth onto the next
// pallet.
//
// This is the Graham *deadbeat* form (George Graham, c. 1715): the locking faces
// of the pallets are arcs struck from the anchor's own pivot, so while a tooth
// rests on one there is no sideways push on it at all — the wheel sits perfectly
// still, with none of the backward recoil the older anchor escapement suffered.
// Dead, then beat.
//
// The honest part here is the timing, not the draughtsman's detail of the pallet
// faces. The single piece of state is the pendulum's phase; the pendulum angle is
// a true sine of it, and the escape wheel's angle is *derived* — it holds its
// locked tooth exactly still through the swing and advances one whole tooth in the
// quick drop just after each extreme, the deadbeat behaviour, never an easing
// curve dressed up as a machine. Run it and it keeps a seconds-beat: the wheel
// carries one tooth a second and comes full circle, thirty teeth, every half
// minute. DRAG the bob to swing it by hand and watch it tick as you cross each
// end; arrows nudge the phase, Space runs or stops it. Under reduced motion the
// clock never free-runs — it holds a frame and ticks on a swing at a time.

const N = 30 // escape-wheel teeth — one per beat, so a turn is thirty seconds
const TOOTH = 360 / N // degrees between teeth
const AMP = 24 // pendulum swing amplitude, degrees either side of rest
const ANCHOR_AMP = 7.5 // the anchor rocks far less than the long pendulum
const DROP = 0.3 // fraction of the half-swing the quick tooth-drop occupies
const OMEGA = Math.PI // rad/s — a two-second period, so one tick every second

// Geometry, in SVG units. The anchor and pendulum share a pivot above the wheel.
const PIV = { x: 0, y: -42 } // anchor / pendulum pivot
const WHEEL = { x: 0, y: 58 } // escape-wheel centre
const ROD = 196 // pivot to bob centre
const BOB_R = 15
const R_RIM = 50 // wheel rim radius (tooth roots)
const R_TIP = 68 // wheel tooth-tip radius

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

// The escape wheel's angle, derived from the pendulum phase. It is flat (locked,
// dead) through the body of each half-swing and sweeps one tooth forward in the
// short DROP window just after each extreme — the deadbeat step, no recoil.
function wheelSteps(phi: number): number {
  const x = (phi - Math.PI / 2) / Math.PI // integer at each swing extreme
  const m = Math.floor(x)
  const u = x - m
  return m + smooth(clamp(u / DROP, 0, 1))
}

// One escape-wheel tooth, a forward-leaning hook, built in wheel-local degrees.
function toothPath(): string {
  let d = ''
  for (let i = 0; i < N; i++) {
    const a = i * TOOTH
    const root = polar(WHEEL.x, WHEEL.y, R_RIM, a)
    const tip = polar(WHEEL.x, WHEEL.y, R_TIP, a + TOOTH * 0.12)
    const face = polar(WHEEL.x, WHEEL.y, R_RIM, a + TOOTH * 0.52)
    d +=
      `${i === 0 ? 'M' : 'L'}${root.x.toFixed(1)} ${root.y.toFixed(1)}` +
      `L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}` +
      `L${face.x.toFixed(1)} ${face.y.toFixed(1)}`
  }
  return d + 'Z'
}

const VB = { x: -112, y: -92, w: 224, h: 262 }

export function Escapement({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  // The one piece of state: the pendulum phase, kept unbounded so drag and the
  // free run cross the swing extremes smoothly. theta_p = AMP * sin(phi).
  const [phi, setPhi] = useState(Math.PI / 2 - 0.8)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const dragTheta = useRef(0) // last pendulum angle under the pointer, for direction
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const teeth = useMemo(toothPath, [])

  const thetaP = AMP * Math.sin(phi)
  const thetaAnchor = ANCHOR_AMP * Math.sin(phi)
  const steps = wheelSteps(phi)
  const wheelAngle = steps * TOOTH // clockwise
  const ticks = Math.round(steps)
  // Which pallet is doing the locking: the one on the side the anchor leans to.
  const leftLocked = thetaAnchor < 0

  // Free run (skipped under reduced motion — there the button ticks one swing on).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setPhi((p) => p + dt * OMEGA)
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

  // Map a pointer to the pendulum angle about the pivot, clamped to the swing.
  const pointerTheta = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return dragTheta.current
    const rect = svg.getBoundingClientRect()
    const x = VB.x + ((clientX - rect.left) / rect.width) * VB.w
    const y = VB.y + ((clientY - rect.top) / rect.height) * VB.h
    const deg = (Math.atan2(x - PIV.x, y - PIV.y) * 180) / Math.PI // from straight down
    return clamp(deg, -AMP, AMP)
  }

  // Dragging the bob sets the pendulum angle; the phase follows on the branch that
  // matches the drag direction, so swinging back and forth stays continuous and
  // the wheel ticks each time an extreme is crossed. Both branches of asin are
  // real escapement states — rising (anchor opening one pallet) and falling.
  const applyDrag = (theta: number) => {
    const dir = theta >= dragTheta.current ? 1 : -1
    dragTheta.current = theta
    const principal = Math.asin(clamp(theta / AMP, -1, 1)) // [-pi/2, pi/2]
    const base = dir >= 0 ? principal : Math.PI - principal
    setPhi((prev) => base + 2 * Math.PI * Math.round((prev - base) / (2 * Math.PI)))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    dragTheta.current = thetaP
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

  const nudge = useCallback((delta: number) => {
    setRunning(false)
    setPhi((p) => p + delta)
  }, [])

  const toggleRun = () => {
    if (reduce) {
      setPhi((p) => p + Math.PI) // step one swing — one tooth — without a sweep
      return
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    setRunning(false)
    setPhi(Math.PI / 2 - 0.8)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 0.4 : 0.1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(s)
    else if (e.key === 'Home') reset()
    else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  // Pallet tips, where the anchor reaches down to the top teeth left and right.
  const palletL = { x: -30, y: PIV.y + 44 }
  const palletR = { x: 30, y: PIV.y + 44 }

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={-AMP}
        aria-valuemax={AMP}
        aria-valuenow={Math.round(thetaP)}
        aria-valuetext={`Pendulum ${Math.round(thetaP)} degrees, ${ticks} ticks`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Deadbeat clock escapement. Drag the bob to swing the pendulum by hand and the escape wheel ticks one tooth as
          you cross each end; arrow keys nudge the swing, Shift for a bigger step, Space runs or stops the clock, Home
          returns it to rest.
        </span>
        <svg
          ref={svgRef}
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id="esc-wheel" cx="0.5" cy="0.42" r="0.7">
              <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </radialGradient>
            <radialGradient id="esc-bob" cx="0.38" cy="0.34" r="0.8">
              <stop offset="0" stopColor="#f2ffc0" />
              <stop offset="0.5" stopColor="#DCF87C" />
              <stop offset="1" stopColor="#8aa52f" />
            </radialGradient>
          </defs>

          {/* The escape wheel: hub, spokes and thirty hooked teeth, rotating as a
              rigid body. Locked dead through each swing, stepped on the drop. */}
          <g transform={`rotate(${wheelAngle.toFixed(2)} ${WHEEL.x} ${WHEEL.y})`}>
            <path d={teeth} fill="url(#esc-wheel)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.1" strokeLinejoin="round" />
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i * 60 * Math.PI) / 180
              return (
                <line
                  key={i}
                  x1={WHEEL.x}
                  y1={WHEEL.y}
                  x2={WHEEL.x + R_RIM * Math.cos(a)}
                  y2={WHEEL.y + R_RIM * Math.sin(a)}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )
            })}
            <circle cx={WHEEL.x} cy={WHEEL.y} r="13" fill="#12140f" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />
          </g>
          <circle cx={WHEEL.x} cy={WHEEL.y} r="3" fill="rgba(255,255,255,0.65)" />

          {/* The anchor, rocking on the pivot with the pendulum. Its two pallets
              reach down to the top teeth; the one bearing the load lights lime. */}
          <g transform={`rotate(${thetaAnchor.toFixed(2)} ${PIV.x} ${PIV.y})`}>
            <path
              d={`M${palletL.x} ${palletL.y} Q${PIV.x} ${PIV.y + 6} ${palletR.x} ${palletR.y}`}
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path d={`M${PIV.x} ${PIV.y} L${palletL.x} ${palletL.y}`} stroke="rgba(255,255,255,0.4)" strokeWidth="3.4" strokeLinecap="round" />
            <path d={`M${PIV.x} ${PIV.y} L${palletR.x} ${palletR.y}`} stroke="rgba(255,255,255,0.4)" strokeWidth="3.4" strokeLinecap="round" />
            <rect
              x={palletL.x - 5}
              y={palletL.y - 5}
              width="10"
              height="12"
              rx="2"
              transform={`rotate(24 ${palletL.x} ${palletL.y})`}
              fill={leftLocked ? '#DCF87C' : 'rgba(255,255,255,0.3)'}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="0.6"
            />
            <rect
              x={palletR.x - 5}
              y={palletR.y - 5}
              width="10"
              height="12"
              rx="2"
              transform={`rotate(-24 ${palletR.x} ${palletR.y})`}
              fill={!leftLocked ? '#DCF87C' : 'rgba(255,255,255,0.3)'}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="0.6"
            />
          </g>

          {/* The pendulum: a suspension spring, the long rod, and the heavy bob,
              swinging a true sine of the phase about the same pivot. */}
          <path d={`M${PIV.x} ${PIV.y - 20} L${PIV.x} ${PIV.y}`} stroke="rgba(255,255,255,0.3)" strokeWidth="1.4" />
          <circle cx={PIV.x} cy={PIV.y - 20} r="3" fill="#12140f" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
          <g transform={`rotate(${thetaP.toFixed(2)} ${PIV.x} ${PIV.y})`}>
            <line x1={PIV.x} y1={PIV.y} x2={PIV.x} y2={PIV.y + ROD} stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx={PIV.x} cy={PIV.y + ROD} r={BOB_R} fill="url(#esc-bob)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
            <ellipse cx={PIV.x - 4} cy={PIV.y + ROD - 5} rx="4" ry="6" fill="rgba(255,255,255,0.35)" />
          </g>
          <circle cx={PIV.x} cy={PIV.y} r="4.4" fill="#12140f" stroke="#DCF87C" strokeWidth="1.8" />
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-lg border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-2 text-center font-mono text-lg tabular-nums text-[#DCF87C]">
          {((ticks % N) + N) % N}
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-[#DCF87C]/70">tooth</span>
        </div>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {reduce ? 'Tick' : running ? 'Stop' : 'Run'}
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
        {`Pendulum at ${Math.round(thetaP)} degrees, ${ticks} ticks`}
      </span>
    </div>
  )
}
