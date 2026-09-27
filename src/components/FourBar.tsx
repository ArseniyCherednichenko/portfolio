import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A four-bar linkage rebuilt as a working mechanism: turn the crank and watch the
// far corner of the coupler trace a curve no single joint could draw on its own.
//
// A four-bar is the smallest interesting closed chain — four rigid rods pinned in
// a loop. One rod is the ground (the two pivots A and D bolted to the frame); the
// short one off A is the crank you drive; the one off D is the rocker; the bar
// joining their free ends is the coupler. This one is a Grashof crank-rocker —
// the crank is the shortest link and it is grounded, so it turns full circle while
// the rocker only swings back and forth, and the linkage never locks or breaks.
//
// The single piece of state is the crank angle. Everything else is derived, and
// the derivation is real kinematics, not a lookup: the crank tip B comes off the
// angle; the rocker tip C is the intersection of two circles — one of the coupler
// length about B, one of the rocker length about D — taken on the elbow-up branch
// so it never flips; the pen P is a point fixed to the coupler, carried along in
// the coupler's own turning frame. Because C is solved from B every frame, the
// bars can never stretch and the pen can never leave the one curve the geometry
// allows. The coupler curve you see drawn is that locus, sampled once from the
// same solver — the ghost loop is where the pen must go, and the lit arc is how
// far round this turn it has got.

// --- Fixed geometry (SVG user units). Chosen so the whole travel sits in view. ---
const A = { x: 130, y: 250 } // grounded crank pivot
const D = { x: 330, y: 250 } // grounded rocker pivot
const CRANK = 62 // A -> B
const COUPLER = 210 // B -> C
const ROCKER = 150 // D -> C
// The pen is a point rigidly fixed to the coupler bar, offset in the coupler's
// own frame: PX along B->C, PY square to it. This offset is what shapes the curve.
const PX = 100
const PY = -70

const rad = (deg: number) => (deg * Math.PI) / 180
const norm = (deg: number) => ((deg % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

interface Pose {
  bx: number
  by: number
  cx: number
  cy: number
  px: number
  py: number
}

// Solve the linkage for a crank angle. C is the elbow-up intersection of the
// coupler circle about B and the rocker circle about D; the pen is carried in the
// coupler frame. Returns a full pose so every drawn joint comes from one solve.
function solve(deg: number): Pose {
  const th = rad(deg)
  const bx = A.x + CRANK * Math.cos(th)
  const by = A.y + CRANK * Math.sin(th)
  const dx = D.x - bx
  const dy = D.y - by
  const d2 = dx * dx + dy * dy
  const d = Math.sqrt(d2)
  // Distance along B->D to the foot of the intersection chord, then its height.
  const a = (COUPLER * COUPLER - ROCKER * ROCKER + d2) / (2 * d)
  const h = Math.sqrt(Math.max(0, COUPLER * COUPLER - a * a))
  const mx = bx + (a * dx) / d
  const my = by + (a * dy) / d
  // Elbow-up branch (sgn = -1) — the one that keeps the coupler above the base
  // across the whole turn, so C never jumps to the other solution.
  const cx = mx - (-dy / d) * h
  const cy = my - (dx / d) * h
  // Pen fixed to the coupler: unit along B->C, and its left normal.
  const ux = (cx - bx) / COUPLER
  const uy = (cy - by) / COUPLER
  const px = bx + ux * PX - uy * PY
  const py = by + uy * PX + ux * PY
  return { bx, by, cx, cy, px, py }
}

// Ground hatch symbol under a fixed pivot.
function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="rgba(255,255,255,0.28)" strokeWidth="1.2">
      <line x1={x - 16} y1={y + 10} x2={x + 16} y2={y + 10} />
      {Array.from({ length: 6 }, (_, i) => {
        const sx = x - 15 + i * 6
        return <line key={i} x1={sx} y1={y + 16} x2={sx + 7} y2={y + 10} />
      })}
    </g>
  )
}

const SAMPLES = 240

export function FourBar({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  // Crank angle in degrees, kept unbounded so drag and spin can cross the 0/360
  // seam without a snap. Start a little past top-dead-centre so nothing is locked.
  const [theta, setTheta] = useState(-40)
  const [running, setRunning] = useState(false)
  // How far round the current revolution the pen has inked, 0..360, so the lit arc
  // fills as the crank turns and a completed turn leaves the whole loop drawn.
  const [inked, setInked] = useState(360)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  // The full coupler curve, sampled once from the same solver the live pose uses,
  // so the ghost loop is exactly the path the pen is constrained to.
  const curve = useMemo(() => Array.from({ length: SAMPLES + 1 }, (_, i) => solve((i / SAMPLES) * 360)), [])
  const curvePath = useMemo(() => {
    let dstr = ''
    curve.forEach((p, i) => {
      dstr += `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)} ${p.py.toFixed(1)} `
    })
    return dstr + 'Z'
  }, [curve])
  // The lit portion: the samples from the 0-mark up to how far this turn has inked.
  const inkedPath = useMemo(() => {
    const n = Math.max(1, Math.round((inked / 360) * SAMPLES))
    let dstr = ''
    for (let i = 0; i <= n; i++) {
      const p = curve[i]
      dstr += `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)} ${p.py.toFixed(1)} `
    }
    return dstr
  }, [curve, inked])

  // Advance the inked fraction to at least the current crank phase, so turning the
  // crank forward paints the loop and it stays painted once a full turn is done.
  const paintTo = useCallback((deg: number) => {
    setInked((prev) => Math.max(prev, norm(deg)))
  }, [])

  const pose = solve(theta)

  // Continuous spin (skipped under reduced motion — there the Run button completes
  // the revolution in one step instead of sweeping through the in-between frames).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setTheta((th) => {
        const next = th + dt * 72 // 72 deg/s -> a five-second revolution
        paintTo(next)
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastT.current = 0
    }
  }, [running, reduce, paintTo])

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
    const y = ((clientY - rect.top) / rect.height) * 320
    return norm((Math.atan2(y - A.y, x - A.x) * 180) / Math.PI)
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
    setTheta((th) => {
      const next = th + step
      paintTo(next)
      return next
    })
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
    setTheta((th) => {
      const next = th + delta
      paintTo(next)
      return next
    })
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(s)
    else if (e.key === 'Home') {
      setRunning(false)
      setTheta(0)
    } else if (e.key === 'End') {
      setRunning(false)
      setTheta(180)
      paintTo(180)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const toggleRun = () => {
    if (reduce) {
      // No sweep under reduced motion: complete the revolution at once.
      setTheta((th) => th + 360)
      setInked(360)
      return
    }
    setRunning((r) => !r)
  }

  const clear = () => {
    setRunning(false)
    setInked(0)
    setTheta(-40)
  }

  const phase = Math.round(norm(theta))

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
          Four-bar linkage. Drag the crank to turn it, arrow keys nudge the crank angle, Shift for ten degrees, Space
          runs or stops it, Home returns to the top and End to half a turn.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 320"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id="fb-pen" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* The coupler curve: faint full loop the pen is constrained to, then the
              lit arc showing how far this turn has drawn. */}
          <path d={curvePath} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3 5" />
          <path
            d={inkedPath}
            fill="none"
            stroke="#DCF87C"
            strokeOpacity="0.85"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Ground bar between the two fixed pivots, plus their hatch symbols. */}
          <line x1={A.x} y1={A.y} x2={D.x} y2={D.y} stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <Ground x={A.x} y={A.y} />
          <Ground x={D.x} y={D.y} />

          {/* Rocker D -> C. */}
          <line
            x1={D.x}
            y1={D.y}
            x2={pose.cx}
            y2={pose.cy}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Coupler B -> C, with the rigid arm out to the pen so the offset reads. */}
          <line
            x1={pose.bx}
            y1={pose.by}
            x2={pose.cx}
            y2={pose.cy}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={pose.bx}
            y1={pose.by}
            x2={pose.px}
            y2={pose.py}
            stroke="rgba(220,248,124,0.5)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1={pose.cx}
            y1={pose.cy}
            x2={pose.px}
            y2={pose.py}
            stroke="rgba(220,248,124,0.28)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2 4"
          />
          {/* Crank A -> B, drawn in the accent as the bar you drive. */}
          <line
            x1={A.x}
            y1={A.y}
            x2={pose.bx}
            y2={pose.by}
            stroke="#DCF87C"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Pin joints. */}
          <circle cx={pose.cx} cy={pose.cy} r="5.5" fill="#12140f" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          <circle cx={pose.bx} cy={pose.by} r="6" fill="#12140f" stroke="#DCF87C" strokeWidth="2.4" />
          <circle cx={A.x} cy={A.y} r="5" fill="rgba(255,255,255,0.55)" />
          <circle cx={D.x} cy={D.y} r="5" fill="rgba(255,255,255,0.55)" />
          {/* The pen. */}
          <circle cx={pose.px} cy={pose.py} r="7" fill="url(#fb-pen)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
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
          {reduce ? 'Turn once' : running ? 'Stop' : 'Run'}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Clear
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {`Crank at ${phase} degrees`}
      </span>
    </div>
  )
}
