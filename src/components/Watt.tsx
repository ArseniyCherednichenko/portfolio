import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Watt's linkage, rebuilt as a working mechanism: three bars — two equal rockers
// swinging from fixed pivots and a coupler bridging their tips — whose coupler
// midpoint walks a very nearly straight line with no slot or rail to guide it.
// It is the deliberate third character beside the Peaucellier and the Chebyshev,
// and the oldest of the three: James Watt drew it in 1784 to guide the piston
// rod of his double-acting engine straight up and down, years before anyone
// proved a four-bar could draw a line exactly.
//
// The Peaucellier draws a line that is straight exactly, with eight links.
// Chebyshev got within four parts in a thousand on four bars. Watt asked the
// question first and the cruder one: can three bars get close enough that a
// steam engine will not care? His answer is a figure-eight — a lemniscate — and
// the trick is that right across the crossing of the eight the curve is so
// nearly straight that the engine never knew the difference. The two rockers are
// equal; their pivots sit on opposite sides of the centre, one above the line
// and one below, so the whole linkage has a half-turn (point) symmetry about the
// middle. That symmetry forces the coupler midpoint through the centre, and
// there the two opposing bends of the eight cancel to leave a straight run.
//
// The only stored value is the angle of the left rocker. Everything else — the
// right rocker, the coupler, the tracked midpoint, the line it rides — is solved
// from that one number each frame by intersecting two circles (the right tip
// lies at distance A_LEN from its pivot and distance C_LEN from the left tip),
// so no two parts can ever drift out of agreement. The faint full curve behind
// the trace is the honest whole lemniscate this linkage draws; the bright path
// is the central stroke the pen actually rides; the dashed rule is the straight
// line it is trying to be. The straightness figure on the chip is not a claim —
// it is measured off the drawn geometry, as the largest the trace strays from
// that line across the stroke, as a fraction of the stroke's length.

const rad = (d: number) => (d * Math.PI) / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Linkage proportions, world units. Equal rockers, a coupler of the same length,
// and the two ground pivots thrown diagonally across the centre (±G_X, ∓G_Y) so
// the figure has the half-turn symmetry Watt's needs.
const A_LEN = 2.4 // the two equal swinging rockers
const C_LEN = 2.4 // the floating coupler bridging their tips
const G_X = 1.4 // pivots sit at x = ∓1.4
const G_Y = 1.0 // and at y = ±1.0, left pivot high, right pivot low
const A = { x: -G_X, y: G_Y } // left ground pivot (upper)
const D = { x: G_X, y: -G_Y } // right ground pivot (lower)

// The left rocker rocks between these angles; across the whole range the tracked
// midpoint stays on the straight central stroke of the lemniscate. Centre is the
// crossing of the eight, where the pen passes through the middle.
const PHI_LO = -28
const PHI_HI = 24
const PHI_MID = (PHI_LO + PHI_HI) / 2

// World -> SVG mapping (y points up in world, down in screen). Centres the
// origin — the crossing of the eight — in a 420x360 frame.
const S = 70
const CX = 210
const CY = 180
const sx = (x: number) => CX + x * S
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

// Solve the whole linkage from the one stored number: the left rocker angle.
function solve(phiDeg: number) {
  const phi = rad(phiDeg)
  const B = { x: A.x + A_LEN * Math.cos(phi), y: A.y + A_LEN * Math.sin(phi) }
  // The branch (sign -1) is the configuration that carries the coupler midpoint
  // along the straight central stroke of the eight.
  const C = intersect(D, A_LEN, B, C_LEN, -1) ?? { x: -B.x, y: -B.y }
  const M = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 }
  return { B, C, M }
}

// The ideal straight line the midpoint approximates: the chord between the pen's
// two stroke extremes. Computed once.
const M_LO = solve(PHI_LO).M
const M_HI = solve(PHI_HI).M
const CHORD = Math.hypot(M_HI.x - M_LO.x, M_HI.y - M_LO.y)

// Perpendicular distance of a point from the ideal chord, in world units.
function devFromLine(m: Pt) {
  const ux = M_HI.x - M_LO.x
  const uy = M_HI.y - M_LO.y
  return Math.abs((m.x - M_LO.x) * uy - (m.y - M_LO.y) * ux) / CHORD
}

// The headline straightness figure: the largest the trace strays from the ideal
// line across the whole stroke, as a fraction of the stroke length. Measured off
// the drawn geometry, computed once.
const MAX_DEV_PCT = (() => {
  let md = 0
  for (let phi = PHI_LO; phi <= PHI_HI; phi += 0.2) md = Math.max(md, devFromLine(solve(phi).M))
  return (md / CHORD) * 100
})()

export function Watt({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // The single stored value: the left rocker's angle, clamped to its working rock.
  const [drive, setDrive] = useState(PHI_MID)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)
  // Oscillation phase for Run: phi eases to rest at each end and reverses, no snap.
  const sweep = useRef(0)

  const { B, C, M } = solve(drive)

  // Continuous rock (skipped under reduced motion, where Step jumps end to end).
  useEffect(() => {
    if (!running || reduce) return
    const span = PHI_HI - PHI_LO
    const u = clamp((drive - PHI_LO) / span, 0, 1)
    sweep.current = Math.acos(clamp(1 - 2 * u, -1, 1))
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      sweep.current += dt * 1.1 // ~2.9s for a full there-and-back
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
    const px = ((clientX - rect.left) / rect.width) * 420
    const py = ((clientY - rect.top) / rect.height) * 360
    return { x: (px - CX) / S, y: (CY - py) / S }
  }

  // Pointer angle of the left rocker about its pivot, in degrees, clamped to range.
  const pointerPhi = (clientX: number, clientY: number) => {
    const p = toUser(clientX, clientY)
    const deg = (Math.atan2(p.y - A.y, p.x - A.x) * 180) / Math.PI
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
      setDrive((v) => (v > PHI_MID ? PHI_LO : PHI_HI))
      return
    }
    setRunning((r) => !r)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 5 : 1.5
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') nudge(-s) // rocker down -> pen down
    else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') nudge(s) // pen up
    else if (e.key === 'Home') {
      setRunning(false)
      setDrive(PHI_MID)
    } else if (e.key === 'End') {
      setRunning(false)
      setDrive((v) => (v > PHI_MID ? PHI_LO : PHI_HI))
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  // The bright central stroke the pen actually rides, drawn once.
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

  // The faint full lemniscate this linkage draws, over its whole reachable swing,
  // drawn once — the honest whole path the central stroke is cut from.
  const ghostPath = useMemo(() => {
    let d = ''
    let started = false
    for (let phi = -144; phi <= 73; phi += 1) {
      const m = solve(phi).M
      d += `${started ? 'L' : 'M'}${sx(m.x).toFixed(2)} ${sy(m.y).toFixed(2)} `
      started = true
    }
    return d.trim()
  }, [])

  // Stroke fraction and the honest straightness figure for the readout.
  const strokeFrac = clamp((drive - PHI_LO) / (PHI_HI - PHI_LO), 0, 1)
  const devPct = (devFromLine(M) / CHORD) * 100

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={PHI_LO}
        aria-valuemax={PHI_HI}
        aria-valuenow={Math.round(drive)}
        aria-valuetext={`Left rocker ${Math.round(drive)} degrees, pen ${Math.round(
          strokeFrac * 100,
        )}% along the straight stroke, ${devPct.toFixed(2)} percent off true`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Watt&rsquo;s linkage. Three bars — two equal rockers swinging from fixed pivots and a coupler bridging their
          tips — carry the coupler midpoint along a very nearly straight line with no slot or rail to guide it, the
          central stroke of a figure-eight. Drag to swing the left rocker and watch the bright pen walk its straight
          path; the faint loop behind it is the whole figure-eight the linkage draws, and the dashed rule is the true
          straight line the pen approximates. Up and down arrows nudge the rocker, Shift for a larger step, Space runs or
          stops the rock, Home centres it and End jumps to the far end. A live region reads the rocker angle, how far
          along the stroke the pen sits, and how far off true it strays.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 420 360"
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

          {/* --- The two fixed pivots, each on a short hatched ground pad --- */}
          {[A, D].map((pivot, i) => (
            <g key={i}>
              <line
                x1={sx(pivot.x) - 15}
                y1={sy(pivot.y)}
                x2={sx(pivot.x) + 15}
                y2={sy(pivot.y)}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={1.5}
              />
              {Array.from({ length: 6 }).map((_, j) => {
                const gx = sx(pivot.x) - 12 + j * 5
                return (
                  <line
                    key={j}
                    x1={gx}
                    y1={sy(pivot.y)}
                    x2={gx - 6}
                    y2={sy(pivot.y) + 7}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={1}
                  />
                )
              })}
            </g>
          ))}

          {/* --- The whole figure-eight this linkage draws (faint ghost) --- */}
          <path
            d={ghostPath}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* --- The ideal straight line: the chord the pen aims to be --- */}
          <line
            x1={sx(M_LO.x) - (sx(M_HI.x) - sx(M_LO.x)) * 0.06}
            y1={sy(M_LO.y) - (sy(M_HI.y) - sy(M_LO.y)) * 0.06}
            x2={sx(M_HI.x) + (sx(M_HI.x) - sx(M_LO.x)) * 0.06}
            y2={sy(M_HI.y) + (sy(M_HI.y) - sy(M_LO.y)) * 0.06}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.25}
            strokeDasharray="3 5"
          />

          {/* --- The real trace: the central stroke the pen actually rides --- */}
          <path
            d={tracePath}
            fill="none"
            stroke="rgba(220,248,124,0.8)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* --- The two rockers --- */}
          <line
            x1={sx(A.x)}
            y1={sy(A.y)}
            x2={sx(B.x)}
            y2={sy(B.y)}
            stroke={`url(#${gid}-leg)`}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <line
            x1={sx(D.x)}
            y1={sy(D.y)}
            x2={sx(C.x)}
            y2={sy(C.y)}
            stroke={`url(#${gid}-leg)`}
            strokeWidth={5}
            strokeLinecap="round"
          />

          {/* --- The floating coupler bridging the two rocker tips --- */}
          <line
            x1={sx(B.x)}
            y1={sy(B.y)}
            x2={sx(C.x)}
            y2={sy(C.y)}
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={4}
            strokeLinecap="round"
          />

          {/* --- Joints: ground pivots, rocker tips, tracked midpoint (the pen) --- */}
          <circle cx={sx(B.x)} cy={sy(B.y)} r={5.5} fill={`url(#${gid}-pivot)`} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
          <circle cx={sx(C.x)} cy={sy(C.y)} r={5.5} fill={`url(#${gid}-pivot)`} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
          <circle cx={sx(A.x)} cy={sy(A.y)} r={4.5} fill="rgba(255,255,255,0.55)" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
          <circle cx={sx(D.x)} cy={sy(D.y)} r={4.5} fill="rgba(255,255,255,0.55)" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
          <circle cx={sx(M.x)} cy={sy(M.y)} r={6.5} fill={`url(#${gid}-pen)`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
        </svg>
      </div>

      {/* Live readout — rocker angle and the honest straightness figure */}
      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {Math.round(drive)}&deg; &middot; {MAX_DEV_PCT.toFixed(1)}% off
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
