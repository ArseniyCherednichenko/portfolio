import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// The Peaucellier-Lipkin linkage: the first mechanism (Charles-Nicolas Peaucellier,
// 1864; Yom Tov Lipman Lipkin, 1871) that turns circular motion into EXACT straight-
// line motion with nothing but rigid, pinned bars. It settled a problem that had
// beaten James Watt — his famous linkage only approximates a straight line — and it
// does so by being a mechanical inversor: it inverts a point in a circle.
//
// The cell. Two long equal bars run from the fixed fulcrum O to the joints C and D.
// A rhombus of four equal short bars closes it: B-C, C-P, P-D, D-B. Because O is
// equidistant from C and D (the two long bars) and both B and P are equidistant
// from C and D (the rhombus), all three of O, B, P sit on the perpendicular
// bisector of CD — so O, B, P are always collinear — and a little algebra on the
// two triangles gives the inversion law |OB|·|OP| = m² − n² (m the long bar, n the
// rhombus side), a constant. P is the inverse of B in the circle of radius √(m²−n²)
// about O.
//
// The straight line. Drive B around a circle that passes through O — here a crank
// A-B whose length equals |OA|, so the crank pivot A sits half a crank from O and
// B's circle threads the fulcrum. Inversion carries any circle through the centre of
// inversion to a straight line, so P traces one exactly. With O and A on a level, the
// line comes out perfectly vertical: P.x is analytically constant, P.y = O.y +
// (m²−n²)/(2·CRANK)·tan(θ/2). Nothing is scripted — the straight edge is forced by
// the bar lengths alone.
//
// The single source of truth is the crank angle θ. Everything drawn is derived from
// it each frame by real geometry: B off the angle; P by the exact inversion; the
// rhombus corners C and D as the two-circle intersection (radius m about O, radius n
// about B), the same construction the Four-bar uses. Because C and D are solved from
// B and P from the inversion, the bars can never stretch and the pen can never leave
// the one vertical line the geometry allows.

// --- Fixed geometry (SVG user units). Verified: P.x is constant, every bar length
// is preserved to the unit, and the whole travel sits inside the viewBox. ---
const O = { x: 150, y: 170 } // fixed fulcrum (centre of inversion)
const A = { x: 200, y: 170 } // fixed crank pivot; |OA| = CRANK so B's circle meets O
const CRANK = 50 // A -> B, equal to |OA|
const LONG = 170 // O -> C and O -> D (the two long bars)
const RHOMB = 100 // the four equal rhombus sides B-C, C-P, P-D, D-B
const K2 = LONG * LONG - RHOMB * RHOMB // inversion power, 18900
const LINE_X = O.x + K2 / (2 * CRANK) // 339 — the exact vertical the pen draws
const RANGE = 60 // crank swings ±RANGE°, keeping the pen and joints in view

const rad = (deg: number) => (deg * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface Pose {
  bx: number
  by: number
  px: number
  py: number
  cx: number
  cy: number
  dx: number
  dy: number
}

// Solve the whole cell from the crank angle. B comes off the angle; P is the exact
// inverse of B about O; C and D are the two-circle intersection (radius LONG about
// O, radius RHOMB about B). Every joint therefore comes from one solve.
function solve(deg: number): Pose {
  const th = rad(deg)
  const bx = A.x + CRANK * Math.cos(th)
  const by = A.y + CRANK * Math.sin(th)
  const ox = bx - O.x
  const oy = by - O.y
  const ob2 = ox * ox + oy * oy
  const d = Math.sqrt(ob2)
  // Exact inversion: P on ray O->B with |OB|·|OP| = K2.
  const f = K2 / ob2
  const px = O.x + f * ox
  const py = O.y + f * oy
  // Rhombus corners: intersection of the long-bar circle about O and the short-bar
  // circle about B, taken as the two symmetric branches so the rhombus always closes.
  const a = (K2 + ob2) / (2 * d)
  const h = Math.sqrt(Math.max(0, LONG * LONG - a * a))
  const mx = O.x + (a * ox) / d
  const my = O.y + (a * oy) / d
  const cx = mx + (-oy / d) * h
  const cy = my + (ox / d) * h
  const dx = mx - (-oy / d) * h
  const dy = my - (ox / d) * h
  return { bx, by, px, py, cx, cy, dx, dy }
}

// Ground hatch symbol under a fixed pivot (matches the Four-bar's ground marks).
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

const PERIOD = 4.6 // seconds for a full there-and-back sweep when running

export function Peaucellier({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  // The one piece of state: the crank angle, clamped to the usable arc.
  const [theta, setTheta] = useState(0)
  const [running, setRunning] = useState(false)
  // The stretch of the true straight line the pen has swept, so the drawn edge fills
  // in as the crank rocks and a completed sweep leaves the whole segment inked.
  const [swept, setSwept] = useState(() => {
    const y = solve(0).py
    return { lo: y, hi: y }
  })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)
  const phase = useRef(0) // sweep phase so Run can hand off smoothly from any angle

  const pose = solve(theta)

  // Grow the inked stretch to include a pen y-position.
  const paint = useCallback((y: number) => {
    setSwept((s) => ({ lo: Math.min(s.lo, y), hi: Math.max(s.hi, y) }))
  }, [])

  const setAngle = useCallback(
    (next: number) => {
      const c = clamp(next, -RANGE, RANGE)
      setTheta(c)
      paint(solve(c).py)
    },
    [paint],
  )

  // Continuous there-and-back sweep (skipped under reduced motion — there Run inks
  // the whole line in one step instead of gliding the pen along it).
  useEffect(() => {
    if (!running || reduce) return
    // Seed the phase so the sweep starts from wherever the crank currently sits.
    phase.current = Math.asin(clamp(theta / RANGE, -1, 1))
    const w = (2 * Math.PI) / PERIOD
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      phase.current += w * dt
      const next = RANGE * Math.sin(phase.current)
      setTheta(next)
      paint(solve(next).py)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastT.current = 0
    }
  }, [running, reduce, theta, paint])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  // Map a pointer to a crank angle: the bearing of the pointer about the crank pivot
  // A, clamped to the usable arc — you grab the crank and swing it directly.
  const pointerAngle = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return theta
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 460
    const y = ((clientY - rect.top) / rect.height) * 340
    return (Math.atan2(y - A.y, x - A.x) * 180) / Math.PI
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setAngle(pointerAngle(e.clientX, e.clientY))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setAngle(pointerAngle(e.clientX, e.clientY))
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
    setAngle(theta + delta)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(s)
    else if (e.key === 'Home') {
      setRunning(false)
      setAngle(0)
    } else if (e.key === 'End') {
      setRunning(false)
      setAngle(RANGE)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const toggleRun = () => {
    if (reduce) {
      // No glide under reduced motion: ink the whole reachable line at once and rest
      // the crank at one extreme so the straight edge is shown without sweeping.
      const top = solve(-RANGE).py
      const bot = solve(RANGE).py
      setSwept({ lo: Math.min(top, bot), hi: Math.max(top, bot) })
      setAngle(RANGE)
      return
    }
    setRunning((r) => !r)
  }

  const clear = () => {
    setRunning(false)
    const y = solve(theta).py
    setSwept({ lo: y, hi: y })
  }

  // The full reachable straight segment (the ghost the pen is constrained to) and the
  // inked stretch swept so far.
  const guide = useMemo(() => {
    const a = solve(-RANGE).py
    const b = solve(RANGE).py
    return { top: Math.min(a, b), bot: Math.max(a, b) }
  }, [])

  const shown = Math.round(theta)

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={-RANGE}
        aria-valuemax={RANGE}
        aria-valuenow={shown}
        aria-valuetext={`Crank ${shown} degrees; pen on the straight line`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Peaucellier-Lipkin straight-line linkage. Drag the crank to swing it, arrow keys nudge the crank angle, Shift
          for ten degrees, Space runs or stops the sweep, Home centres the crank and End takes it to the extreme. The pen
          traces an exact vertical straight line.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 340"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id="pl-pen" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* The straight line: faint full ghost the pen is constrained to, then the
              lit stretch showing how much of it this sweep has drawn. */}
          <line
            x1={LINE_X}
            y1={guide.top}
            x2={LINE_X}
            y2={guide.bot}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
            strokeDasharray="3 5"
          />
          <line
            x1={LINE_X}
            y1={swept.lo}
            x2={LINE_X}
            y2={swept.hi}
            stroke="#DCF87C"
            strokeOpacity="0.85"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* The circle B rides — a construction guide passing through the fulcrum O,
              the very property that makes the inverse trace a line. */}
          <circle
            cx={A.x}
            cy={A.y}
            r={CRANK}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />

          {/* Long bars O -> C and O -> D. */}
          <line
            x1={O.x}
            y1={O.y}
            x2={pose.cx}
            y2={pose.cy}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={O.x}
            y1={O.y}
            x2={pose.dx}
            y2={pose.dy}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Rhombus B-C, C-P, P-D, D-B. */}
          <line x1={pose.bx} y1={pose.by} x2={pose.cx} y2={pose.cy} stroke="rgba(255,255,255,0.7)" strokeWidth="3.4" strokeLinecap="round" />
          <line x1={pose.bx} y1={pose.by} x2={pose.dx} y2={pose.dy} stroke="rgba(255,255,255,0.7)" strokeWidth="3.4" strokeLinecap="round" />
          <line x1={pose.px} y1={pose.py} x2={pose.cx} y2={pose.cy} stroke="rgba(220,248,124,0.6)" strokeWidth="3.4" strokeLinecap="round" />
          <line x1={pose.px} y1={pose.py} x2={pose.dx} y2={pose.dy} stroke="rgba(220,248,124,0.6)" strokeWidth="3.4" strokeLinecap="round" />

          {/* The O -> B -> P collinear spine, drawn faint to show the three stay in line. */}
          <line
            x1={O.x}
            y1={O.y}
            x2={pose.px}
            y2={pose.py}
            stroke="rgba(220,248,124,0.22)"
            strokeWidth="1.2"
            strokeDasharray="2 4"
          />

          {/* Crank A -> B, in the accent as the bar you drive. */}
          <line x1={A.x} y1={A.y} x2={pose.bx} y2={pose.by} stroke="#DCF87C" strokeWidth="5" strokeLinecap="round" />

          {/* Ground the two fixed pivots. */}
          <Ground x={O.x} y={O.y} />
          <Ground x={A.x} y={A.y} />

          {/* Pin joints. */}
          <circle cx={pose.cx} cy={pose.cy} r="5" fill="#12140f" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          <circle cx={pose.dx} cy={pose.dy} r="5" fill="#12140f" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          <circle cx={pose.bx} cy={pose.by} r="6" fill="#12140f" stroke="#DCF87C" strokeWidth="2.4" />
          <circle cx={O.x} cy={O.y} r="5" fill="rgba(255,255,255,0.6)" />
          <circle cx={A.x} cy={A.y} r="5" fill="rgba(255,255,255,0.6)" />
          {/* The pen, riding the exact straight line. */}
          <circle cx={pose.px} cy={pose.py} r="7" fill="url(#pl-pen)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-lg border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-2 text-center font-mono text-lg tabular-nums text-[#DCF87C]">
          {(shown > 0 ? '+' : '') + shown}&deg;
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-[#DCF87C]/70">crank</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-center font-mono text-sm tabular-nums text-white/70">
          pen x&nbsp;=&nbsp;<span className="text-white">{LINE_X.toFixed(1)}</span>
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">locked</span>
        </div>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {reduce ? 'Draw the line' : running ? 'Stop' : 'Run'}
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
        {`Crank at ${shown} degrees; pen x fixed at ${LINE_X.toFixed(1)}`}
      </span>
    </div>
  )
}
