import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A pantograph rebuilt as a working mechanism: a stylus traces a small figure,
// and a pen pinned further out draws the same figure at twice the size. The
// pole, the stylus and the pen stay on one straight line at every instant, and
// the pen sits exactly twice as far from the pole as the stylus does — so the
// copy is a true scaling of the original, not a redrawn approximation.
//
// This is the eleventh character in the rigid-mechanism corner, and the one
// that does something none of the others do: it COPIES. The four-bar turns
// rotation into a curve; the Peaucellier and the Chebyshev into a straight
// line; the Geneva into steps; the Strandbeest into a gait; the escapement
// meters a swing; the Scotch yoke and the trammel cast sines; the cam casts a
// programmed lift; the governor closes a loop on its own speed. A pantograph
// takes a motion that already exists and hands back a scaled duplicate of it —
// the mechanical ancestor of copy-and-enlarge, used for centuries to scale maps
// and engrave coins, and the direct forebear of the engraver's and the
// milling-machine's reducing linkages.
//
// The honest part is the collinearity, and it is forced by the geometry rather
// than drawn by hand. The linkage is a chain of four rigid bars of equal length
// whose equal-and-parallel pairs mean that, for the fixed pole O and the stylus
// at T, the pen always lands at exactly W = O + 2·(T − O): twice the distance,
// on the same ray. The only stored value is where the stylus sits on the figure
// it is tracing. The elbow of the arm is solved from O and T each frame as the
// apex of an isosceles triangle on the segment OT — always taken on the same
// branch so the arm can never flip — and the two remaining joints are then fixed
// by the parallel constraints, so the pen is pinned to the one point the bars
// allow and can never leave it. The faint straight ray through O, T and W is
// drawn from those same three points, so the line the mechanism rides and the
// line the eye checks it against are the same line.

const TAU = Math.PI * 2

type Pt = { x: number; y: number }

// Fixed frame (SVG user units), viewBox 460 x 320.
const O: Pt = { x: 58, y: 284 } // the pole — bolted to the board, never moves
const TC: Pt = { x: 172, y: 176 } // centre of the small traced figure
const R_OUT = 27 // outer radius of the traced star
const R_IN = 11 // inner radius of the traced star
const SPIKES = 5
const ROD = 99 // rigid bar length; chosen so the arm never has to straighten fully

// A point on the five-point star outline, parameter u in [0,1) once around.
function starPoint(u: number): Pt {
  const v = ((u % 1) + 1) % 1
  const seg = v * SPIKES * 2 // 0 .. 10, one step per vertex
  const i = Math.floor(seg)
  const f = seg - i
  const rA = i % 2 === 0 ? R_OUT : R_IN
  const rB = i % 2 === 0 ? R_IN : R_OUT
  const angA = (i / (SPIKES * 2)) * TAU - Math.PI / 2
  const angB = ((i + 1) / (SPIKES * 2)) * TAU - Math.PI / 2
  const ax = TC.x + rA * Math.cos(angA)
  const ay = TC.y + rA * Math.sin(angA)
  const bx = TC.x + rB * Math.cos(angB)
  const by = TC.y + rB * Math.sin(angB)
  return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f }
}

// The pen is twice as far from the pole as the stylus, on the same ray. This is
// the whole behaviour of the mechanism, in one line.
const penOf = (t: Pt): Pt => ({ x: O.x + 2 * (t.x - O.x), y: O.y + 2 * (t.y - O.y) })

// The arm's elbow: apex of the isosceles triangle on OT with equal legs ROD,
// taken on a fixed branch (normal pointing up-left) so the arm never flips.
function elbow(t: Pt): Pt {
  const dx = t.x - O.x
  const dy = t.y - O.y
  const d = Math.hypot(dx, dy) || 0.0001
  const half = d / 2
  const h = Math.sqrt(Math.max(0, ROD * ROD - half * half))
  const mid = { x: (O.x + t.x) / 2, y: (O.y + t.y) / 2 }
  // unit normal to OT; pick the one with the more negative y so the elbow sits
  // above the line consistently (and nudge by x to break the vertical tie).
  let nx = -dy / d
  let ny = dx / d
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  return { x: mid.x + h * nx, y: mid.y + h * ny }
}

function toPath(pts: Pt[], close = false): string {
  if (pts.length === 0) return ''
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`
  return close ? d + ' Z' : d
}

export function Pantograph({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // The single state: how far around the traced figure the stylus has gone.
  const [t, setT] = useState(0)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  // Dense samples of the outline, for projecting a pointer to the nearest point.
  const samples = useMemo(() => {
    const n = 300
    const arr: { u: number; p: Pt }[] = []
    for (let i = 0; i < n; i++) {
      const u = i / n
      arr.push({ u, p: starPoint(u) })
    }
    return arr
  }, [])

  // The full traced figure and its doubled copy, as static ghost outlines.
  const ghostTrace = useMemo(() => {
    const pts: Pt[] = []
    for (let i = 0; i <= 160; i++) pts.push(starPoint(i / 160))
    return toPath(pts, true)
  }, [])
  const ghostPen = useMemo(() => {
    const pts: Pt[] = []
    for (let i = 0; i <= 160; i++) pts.push(penOf(starPoint(i / 160)))
    return toPath(pts, true)
  }, [])

  // The inked portion, from the start of the figure up to the current stylus
  // position — the drawing as it has been laid down so far.
  const inked = useMemo(() => {
    const steps = Math.max(1, Math.round(160 * t))
    const trace: Pt[] = []
    const pen: Pt[] = []
    for (let i = 0; i <= steps; i++) {
      const u = (i / 160) % 1
      const sp = starPoint(u > t ? t : u)
      trace.push(sp)
      pen.push(penOf(sp))
    }
    return { trace: toPath(trace), pen: toPath(pen) }
  }, [t])

  const stylus = useMemo(() => starPoint(t), [t])
  const pen = useMemo(() => penOf(stylus), [stylus])
  const joint = useMemo(() => elbow(stylus), [stylus])
  // The two parallel-forced joints that complete the chain.
  const u2 = { x: stylus.x + (joint.x - O.x), y: stylus.y + (joint.y - O.y) }

  // Continuous draw (skipped under reduced motion). Sweeps once around and stops
  // when the figure is complete, so the copy is drawn, not looped forever.
  useEffect(() => {
    if (!running || reduce) return
    const tick = (now: number) => {
      if (!lastT.current) lastT.current = now
      const dt = Math.min(0.05, (now - lastT.current) / 1000)
      lastT.current = now
      setT((v) => {
        const nv = v + dt * 0.3 // ~3.3s for a full trace
        if (nv >= 1) {
          setRunning(false)
          return 1
        }
        return nv
      })
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

  const projectPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 460
    const y = ((clientY - rect.top) / rect.height) * 320
    let best = 0
    let bestD = Infinity
    for (const s of samples) {
      const d = (s.p.x - x) ** 2 + (s.p.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = s.u
      }
    }
    setT(best)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    projectPointer(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    projectPointer(e.clientX, e.clientY)
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
    setT((v) => Math.min(1, Math.max(0, v + delta)))
  }

  const toggleRun = useCallback(() => {
    if (reduce) {
      setT((v) => (v >= 1 ? 0 : 1))
      return
    }
    setT((v) => (v >= 1 ? 0 : v))
    setRunning((r) => !r)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const step = e.shiftKey ? 0.05 : 0.0125
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-step)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(step)
    else if (e.key === 'Home') {
      setRunning(false)
      setT(0)
    } else if (e.key === 'End') {
      setRunning(false)
      setT(1)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const pct = Math.round(t * 100)

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`Stylus ${pct} percent around the traced figure; the pen draws a copy at twice the size`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Pantograph. Drag along the small figure to move the stylus and the pen draws a copy at twice the size; arrow
          keys move the stylus around the figure, Shift for a larger step, Space draws it or stops, Home returns to the
          start and End completes the drawing. A live region reads how far around the figure the stylus has travelled.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 320"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <linearGradient id={`${gid}-bar`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>
            <radialGradient id={`${gid}-nib`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* --- The collinearity ray: pole, stylus and pen on one straight line --- */}
          <line
            x1={O.x}
            y1={O.y}
            x2={pen.x}
            y2={pen.y}
            stroke="rgba(220,248,124,0.22)"
            strokeWidth={1}
            strokeDasharray="2 6"
          />

          {/* --- The two figures: small original (traced) and large copy (drawn) --- */}
          {/* ghost outlines, the full figures the mechanism will ride */}
          <path d={ghostTrace} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          <path d={ghostPen} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          {/* inked so far */}
          <path
            d={inked.trace}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={inked.pen}
            fill="none"
            stroke="#DCF87C"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* --- The linkage: four equal rigid bars, O -> P -> T -> U -> W --- */}
          {/* faint parallelogram fills make the equal-and-parallel pairs legible */}
          <path
            d={`M${O.x} ${O.y} L${joint.x.toFixed(2)} ${joint.y.toFixed(2)} L${u2.x.toFixed(2)} ${u2.y.toFixed(2)} L${stylus.x.toFixed(2)} ${stylus.y.toFixed(2)} Z`}
            fill="rgba(255,255,255,0.03)"
          />
          <path
            d={`M${joint.x.toFixed(2)} ${joint.y.toFixed(2)} L${stylus.x.toFixed(2)} ${stylus.y.toFixed(2)} L${pen.x.toFixed(2)} ${pen.y.toFixed(2)} L${u2.x.toFixed(2)} ${u2.y.toFixed(2)} Z`}
            fill="rgba(220,248,124,0.03)"
          />
          {[
            [O, joint],
            [joint, stylus],
            [stylus, u2],
            [u2, pen],
          ].map(([a, b], i) => (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={`url(#${gid}-bar)`}
              strokeWidth={5}
              strokeLinecap="round"
            />
          ))}

          {/* pin joints */}
          {[joint, u2].map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.4} fill="#0B0B0B" stroke="rgba(255,255,255,0.4)" strokeWidth={1.2} />
          ))}

          {/* --- The pole: bolted to the board --- */}
          <circle cx={O.x} cy={O.y} r={7} fill="#0B0B0B" stroke="rgba(255,255,255,0.45)" strokeWidth={1.6} />
          <circle cx={O.x} cy={O.y} r={2.4} fill="rgba(255,255,255,0.5)" />

          {/* --- The stylus, riding the small figure --- */}
          <circle cx={stylus.x} cy={stylus.y} r={5.5} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2} />
          <circle cx={stylus.x} cy={stylus.y} r={1.6} fill="rgba(255,255,255,0.9)" />

          {/* --- The pen, drawing the large copy --- */}
          <circle cx={pen.x} cy={pen.y} r={6} fill={`url(#${gid}-nib)`} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
        </svg>
      </div>

      {/* Live readout — progress, and the fixed scale the geometry forces */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {pct}% traced &middot; copy &times;2
        </span>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/[0.12]"
        >
          {reduce ? (t >= 1 ? 'Clear' : 'Draw') : running ? 'Stop' : t >= 1 ? 'Redraw' : 'Draw'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false)
            setT(0)
          }}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
