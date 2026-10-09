import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Chebyshev linkage, rebuilt as a working mechanism: four rigid bars, two of
// them crossed, and a single point on the floating bar that walks a very nearly
// straight line — with no slot, no rail, nothing to constrain it but the bars
// themselves. It is the eighth character in the rigid-mechanism corner and the
// deliberate counterpoint to the Peaucellier beside it.
//
// The Peaucellier draws a line that is straight exactly, and pays for it with
// eight links and a cell of four equal bars. Pafnuty Chebyshev asked the
// cheaper question — how straight can four bars get? — and this is his answer.
// Two equal legs of length 5 swing from two ground pivots 4 apart; a short
// coupler of length 2 bridges their tips, the legs crossing as they rise. Track
// the midpoint of that coupler and it keeps to a flat line across the top of its
// swing to within four parts in a thousand of the distance it travels. Not
// exact — and that honesty is the whole point of standing it next to the
// Peaucellier — but closer than the eye can catch, bought with half the bars.
//
// The only stored value is the angle of the left leg. Everything else — the
// right leg, the crossed coupler, the tracked midpoint, the line it rides — is
// solved from that one number each frame by intersecting two circles (the right
// tip lies at distance 5 from its pivot and distance 2 from the left tip), so no
// two parts can ever drift out of agreement. The faint rule behind the trace is
// the mathematical straight line the midpoint is *trying* to be; the bright path
// is where it actually goes. They sit all but on top of each other, which is the
// marvel: a straight edge with no straight part anywhere in it.

const rad = (d: number) => (d * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Linkage proportions (classic 4 : 5 : 2 ground : leg : coupler), world units.
const A_LEN = 5 // the two equal swinging legs
const C_LEN = 2 // the floating coupler bridging their tips
const HALF_G = 2 // half the ground span — pivots sit at x = ±2
const O1 = { x: -HALF_G, y: 0 } // left ground pivot
const O2 = { x: HALF_G, y: 0 } // right ground pivot

// The left leg rocks between these angles; both stay a touch inside the toggle
// (dead) points where the linkage would lock, and across the whole range the
// tracked midpoint stays on its straight rail.
const PHI_LO = 40
const PHI_HI = 96
const PHI_MID = 53.5 // left leg angle that sets the midpoint at the rail's centre

// World -> SVG mapping (y points up in world, down in screen). Centres the
// figure in a 460x300 frame with room above for the legs and below for ground.
const S = 46
const CX = 230
const CY = 258
const WORLD_CX = -0.345 // horizontal centre of everything the motion touches
const sx = (x: number) => CX + (x - WORLD_CX) * S
const sy = (y: number) => CY - y * S

type Pt = { x: number; y: number }

// Intersection of circle(p0, r0) and circle(p1, r1); `sign` picks the branch.
// Returns null only outside the linkage's reach (never within [PHI_LO, PHI_HI]).
function intersect(p0: Pt, r0: number, p1: Pt, r1: number, sign: number): Pt | null {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const d = Math.hypot(dx, dy)
  if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) return null
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d)
  const h2 = r0 * r0 - a * a
  if (h2 < 0) return null
  const h = Math.sqrt(h2)
  const xm = p0.x + (a * dx) / d
  const ym = p0.y + (a * dy) / d
  return { x: xm + (sign * h * dy) / d, y: ym - (sign * h * dx) / d }
}

// Solve the whole linkage from the one stored number: the left leg angle.
function solve(phiDeg: number) {
  const phi = rad(phiDeg)
  const P1 = { x: O1.x + A_LEN * Math.cos(phi), y: O1.y + A_LEN * Math.sin(phi) }
  // The crossed branch (sign -1) is the configuration whose coupler midpoint
  // rides the flat line; the legs cross as they rise.
  const P2 = intersect(O2, A_LEN, P1, C_LEN, -1) ?? { x: -P1.x, y: P1.y }
  const M = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 }
  return { P1, P2, M }
}

// The ideal straight rail the midpoint approximates: the line y = 4, run between
// the midpoint's two extremes. Computed once.
const RAIL_Y = 4
const RAIL_LEFT = solve(PHI_HI).M.x
const RAIL_RIGHT = solve(PHI_LO).M.x

export function Chebyshev({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // The single stored value: the left leg's angle, clamped to its working rock.
  const [drive, setDrive] = useState(PHI_MID)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)
  // Oscillation phase for Run: phi = PHI_LO + span*(1-cos(sweep))/2, so the
  // rock eases to rest at each end and reverses smoothly, no snap.
  const sweep = useRef(0)

  const { P1, P2, M } = solve(drive)

  // Continuous rock (skipped under reduced motion, where Step jumps end to end).
  useEffect(() => {
    if (!running || reduce) return
    const span = PHI_HI - PHI_LO
    // Resync the sweep phase to wherever the leg currently sits.
    const u = clamp((drive - PHI_LO) / span, 0, 1)
    sweep.current = Math.acos(clamp(1 - 2 * u, -1, 1))
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      sweep.current += dt * 1.15 // ~2.7s for a full there-and-back
      const next = PHI_LO + (span * (1 - Math.cos(sweep.current))) / 2
      setDrive(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastT.current = 0
    }
    // drive is read only to seed the phase; re-running on it would stutter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, reduce])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const toUser = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * 460
    const py = ((clientY - rect.top) / rect.height) * 300
    // screen -> world
    return { x: (px - CX) / S + WORLD_CX, y: (CY - py) / S }
  }

  // Pointer angle of the left leg about its pivot, in degrees, clamped to range.
  const pointerPhi = (clientX: number, clientY: number) => {
    const p = toUser(clientX, clientY)
    const deg = (Math.atan2(p.y - O1.y, p.x - O1.x) * 180) / Math.PI
    return clamp(deg, PHI_LO, PHI_HI)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrive(pointerPhi(e.clientX, e.clientY))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setDrive(pointerPhi(e.clientX, e.clientY))
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
    setDrive((v) => clamp(v + delta, PHI_LO, PHI_HI))
  }

  const toggleRun = useCallback(() => {
    if (reduce) {
      // No sweep: jump to the far end, drawing the whole stroke at a stroke.
      setDrive((v) => (v > (PHI_LO + PHI_HI) / 2 ? PHI_LO : PHI_HI))
      return
    }
    setRunning((r) => !r)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 6 : 1.5
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(s) // leg up -> pen left
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(-s) // pen right
    else if (e.key === 'Home') {
      setRunning(false)
      setDrive(PHI_MID)
    } else if (e.key === 'End') {
      setRunning(false)
      setDrive((v) => (v > (PHI_LO + PHI_HI) / 2 ? PHI_LO : PHI_HI))
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  // The real path the midpoint sweeps across its whole rock, drawn once. This is
  // the honest trace — where the point actually goes, not where it ought to.
  const tracePath = useMemo(() => {
    const steps = 120
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const phi = PHI_LO + ((PHI_HI - PHI_LO) * i) / steps
      const m = solve(phi).M
      d += `${i === 0 ? 'M' : 'L'}${sx(m.x).toFixed(2)} ${sy(m.y).toFixed(2)} `
    }
    return d.trim()
  }, [])

  // Stroke fraction and the honest straightness figure for the readout.
  const strokeFrac = clamp((RAIL_RIGHT - M.x) / (RAIL_RIGHT - RAIL_LEFT), 0, 1)
  const devPct = (Math.abs(M.y - RAIL_Y) / (RAIL_RIGHT - RAIL_LEFT)) * 100

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={PHI_LO}
        aria-valuemax={PHI_HI}
        aria-valuenow={Math.round(drive)}
        aria-valuetext={`Left leg ${Math.round(drive)} degrees, pen ${Math.round(
          strokeFrac * 100,
        )}% along the straight rail, ${devPct.toFixed(2)} percent off true`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Chebyshev straight-line linkage. Four bars, two of them crossed, carry a point on the floating bar along a very
          nearly straight line with no slot or rail to guide it. Drag to swing the left leg and watch the bright pen walk
          its straight path; the faint rule behind it is the true straight line the point approximates. Left and right
          arrows nudge the leg, Shift for a larger step, Space runs or stops the rock, Home centres it and End jumps to
          the far end. A live region reads the leg angle, how far along the rail the pen sits, and how far off true it
          strays.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 300"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-pen`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
            <radialGradient id={`${gid}-pivot`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.45)" />
            </radialGradient>
            <linearGradient id={`${gid}-leg`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.6)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.28)" />
            </linearGradient>
          </defs>

          {/* --- Ground: the two fixed pivots and a hatched base between them --- */}
          <line
            x1={sx(O1.x) - 14}
            y1={sy(0)}
            x2={sx(O2.x) + 14}
            y2={sy(0)}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1.5}
          />
          {Array.from({ length: 11 }).map((_, i) => {
            const gx = sx(O1.x) - 10 + (i * (sx(O2.x) - sx(O1.x) + 20)) / 10
            return (
              <line
                key={i}
                x1={gx}
                y1={sy(0)}
                x2={gx - 7}
                y2={sy(0) + 8}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
              />
            )
          })}

          {/* --- The ideal straight rail: the line the midpoint aims to be --- */}
          <line
            x1={sx(RAIL_LEFT) - 6}
            y1={sy(RAIL_Y)}
            x2={sx(RAIL_RIGHT) + 6}
            y2={sy(RAIL_Y)}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.25}
            strokeDasharray="3 5"
          />

          {/* --- The real trace: where the midpoint actually goes --- */}
          <path
            d={tracePath}
            fill="none"
            stroke="rgba(220,248,124,0.8)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* --- The two crossing legs --- */}
          <line
            x1={sx(O1.x)}
            y1={sy(O1.y)}
            x2={sx(P1.x)}
            y2={sy(P1.y)}
            stroke={`url(#${gid}-leg)`}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <line
            x1={sx(O2.x)}
            y1={sy(O2.y)}
            x2={sx(P2.x)}
            y2={sy(P2.y)}
            stroke={`url(#${gid}-leg)`}
            strokeWidth={5}
            strokeLinecap="round"
          />

          {/* --- The floating coupler bridging the two leg tips --- */}
          <line
            x1={sx(P1.x)}
            y1={sy(P1.y)}
            x2={sx(P2.x)}
            y2={sy(P2.y)}
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* a thin guide from each coupler tip to the tracked midpoint */}
          <line
            x1={sx(P1.x)}
            y1={sy(P1.y)}
            x2={sx(P2.x)}
            y2={sy(P2.y)}
            stroke="rgba(220,248,124,0.25)"
            strokeWidth={1}
            strokeLinecap="round"
          />

          {/* --- Joints: ground pivots, leg tips, tracked midpoint (the pen) --- */}
          <circle cx={sx(P1.x)} cy={sy(P1.y)} r={5.5} fill={`url(#${gid}-pivot)`} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
          <circle cx={sx(P2.x)} cy={sy(P2.y)} r={5.5} fill={`url(#${gid}-pivot)`} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
          <circle cx={sx(O1.x)} cy={sy(O1.y)} r={4.5} fill="rgba(255,255,255,0.55)" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
          <circle cx={sx(O2.x)} cy={sy(O2.y)} r={4.5} fill="rgba(255,255,255,0.55)" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
          <circle cx={sx(M.x)} cy={sy(M.y)} r={6.5} fill={`url(#${gid}-pen)`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
        </svg>
      </div>

      {/* Live readout — leg angle and the honest straightness figure */}
      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {Math.round(drive)}&deg; &middot; {devPct.toFixed(2)}% off
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
            setDrive(PHI_MID)
          }}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
