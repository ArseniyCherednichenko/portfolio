import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A trammel of Archimedes, rebuilt as a working mechanism: one rigid rod
// carries two sliders, each trapped in one of two slots cut at right angles.
// Turn the rod and a pen fixed to it traces a perfect ellipse — and, nudged to
// the middle, a perfect circle. It is the "do-nothing machine" sold as a desk
// fidget, and it is also the honest ancestor of the ellipse: before plotters,
// this is how a draughtsman drew one true.
//
// This is the rigid-mechanism corner's seventh answer, and it sits right beside
// the Scotch yoke on purpose. The four-bar turns rotation into a curve; the
// Peaucellier into a straight line; the Geneva into steps; the Strandbeest into
// a gait; the escapement meters a swing; the Scotch yoke turns rotation into a
// single sine. The trammel turns it into two sines at once, a quarter-turn
// apart — which is exactly what an ellipse is.
//
// The honest part is that the rod never changes length, and everything follows
// from that one constraint. Slider A can only move up and down its vertical
// slot, slider B only left and right its horizontal one, and the straight line
// between them is a fixed distance d. So if the rod makes angle θ, then
// B sits at (d·cos θ, 0) along its slot and A at (0, −d·sin θ) along its — their
// separation is √(d²cos²θ + d²sin²θ) = d, exactly, for every θ, which is the
// whole reason the rod can be rigid at all. A pen pinned to the rod a fraction
// s of the way along it then sits at
//     x = d(1 − s)·cos θ,   y = −d·s·sin θ,
// a point whose horizontal reach is d(1 − s) and vertical reach d·s: the
// parametric equation of an ellipse with those two semi-axes, no approximation.
// Slide the pen to the exact middle (s = ½) and the two reaches are equal — the
// ellipse closes up into a true circle. The single stored value is the rod
// angle (plus where the pen is pinned); the two sliders, the rod and the swept
// curve are all derived from it, so none of them can ever drift out of
// agreement with the others.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Fixed frame (SVG user units). The two slots cross at O; the rod swings a
// circle of radius D about it, so both slots run D either side of the centre.
const O = { x: 230, y: 158 }
const D = 112 // rod length = the full span of each slot from the centre
const SLOT = 13 // half-width of a slot channel

export function Trammel({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // Rod angle, unbounded so drag and spin cross the 0/360 seam without a snap.
  const [drive, setDrive] = useState(28)
  // Where the pen is pinned along the rod, as a fraction from slider B (the
  // horizontal one) toward slider A. 0.5 is the exact middle — a circle.
  const [pen, setPen] = useState(0.68)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef<null | 'rod' | 'pen'>(null)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const theta = rad(drive)
  // The two sliders, each pinned to its slot; the rod is the line between them.
  const bx = O.x + D * Math.cos(theta) // slider B rides the horizontal slot
  const ay = O.y - D * Math.sin(theta) // slider A rides the vertical slot
  const A = { x: O.x, y: ay }
  const B = { x: bx, y: O.y }
  // Semi-axes of the swept ellipse, straight off the pin fraction.
  const axA = D * (1 - pen) // horizontal reach
  const axB = D * pen // vertical reach
  // The pen itself: a fraction `pen` along the rod from B toward A.
  const penX = O.x + axA * Math.cos(theta)
  const penY = O.y - axB * Math.sin(theta)

  // Continuous spin (skipped under reduced motion, where Run advances a quarter
  // turn to the next cardinal position rather than sweeping the frames between).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 50) // 50 deg/s -> a ~7.2s revolution
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

  const toUser = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: O.x, y: O.y }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * 460,
      y: ((clientY - rect.top) / rect.height) * 300,
    }
  }

  const pointerAngle = (clientX: number, clientY: number) => {
    const p = toUser(clientX, clientY)
    return norm((Math.atan2(O.y - p.y, p.x - O.x) * 180) / Math.PI)
  }

  // Project the pointer onto the rod line B->A, returning the fraction along it.
  const pointerPenFraction = (clientX: number, clientY: number) => {
    const p = toUser(clientX, clientY)
    const vx = A.x - B.x
    const vy = A.y - B.y
    const len2 = vx * vx + vy * vy || 1
    const s = ((p.x - B.x) * vx + (p.y - B.y) * vy) / len2
    return clamp(s, 0.08, 0.92)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    const p = toUser(e.clientX, e.clientY)
    // Grab the pen bead if the press lands near it, otherwise turn the rod.
    const nearPen = Math.hypot(p.x - penX, p.y - penY) < 22
    dragging.current = nearPen ? 'pen' : 'rod'
    e.currentTarget.setPointerCapture(e.pointerId)
    if (nearPen) setPen(pointerPenFraction(e.clientX, e.clientY))
    else lastPointer.current = pointerAngle(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    if (dragging.current === 'pen') {
      setPen(pointerPenFraction(e.clientX, e.clientY))
      return
    }
    const a = pointerAngle(e.clientX, e.clientY)
    const delta = shortest(lastPointer.current, a)
    lastPointer.current = a
    setDrive((v) => v + delta)
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = null
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
      // No sweep: jump a quarter turn to the next cardinal position.
      setDrive((v) => Math.round(v / 90) * 90 + 90)
      return
    }
    setRunning((r) => !r)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft') nudge(-s)
    else if (e.key === 'ArrowRight') nudge(s)
    else if (e.key === 'ArrowUp') {
      setRunning(false)
      setPen((p) => clamp(p + 0.02, 0.08, 0.92)) // pin the pen toward A: taller
    } else if (e.key === 'ArrowDown') {
      setRunning(false)
      setPen((p) => clamp(p - 0.02, 0.08, 0.92)) // toward B: wider
    } else if (e.key === 'Home') {
      setRunning(false)
      setDrive(0)
    } else if (e.key === 'End') {
      setRunning(false)
      setDrive((v) => Math.round(v / 90) * 90 + 90)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const phase = Math.round(norm(drive))

  // The full ellipse the pen sweeps over one turn, drawn once as a faint ghost.
  const ellipsePath = useMemo(() => {
    const steps = 120
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const phi = rad((i / steps) * 360)
      const x = O.x + axA * Math.cos(phi)
      const y = O.y - axB * Math.sin(phi)
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
    }
    return d.trim()
  }, [axA, axB])

  // The part of the ellipse already drawn, from 0 up to the current angle, so
  // the pen reads as leaving ink behind it as it goes round.
  const drawnPath = useMemo(() => {
    const end = norm(drive)
    if (end < 0.5) return ''
    const steps = Math.max(1, Math.round((end / 360) * 120))
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const phi = rad((i / steps) * end)
      const x = O.x + axA * Math.cos(phi)
      const y = O.y - axB * Math.sin(phi)
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
    }
    return d.trim()
  }, [axA, axB, drive])

  const shape =
    Math.abs(axA - axB) < 1.2
      ? 'a circle'
      : axB > axA
        ? 'an upright ellipse'
        : 'a wide ellipse'
  const ratio = axA >= axB ? `${(axA / axB).toFixed(2)}:1` : `1:${(axB / axA).toFixed(2)}`

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Rod ${phase} degrees, pen pinned to sweep ${shape}, axes ${ratio}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current === 'pen' ? 'grabbing' : dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Trammel of Archimedes. Drag to turn the rod and watch the pen trace an ellipse; drag the bright pen bead along
          the rod, or use the up and down arrows, to move where it is pinned — the middle draws a true circle. Left and
          right arrows nudge the rod angle, Shift for ten degrees, Space runs or stops it, Home returns to zero and End
          jumps a quarter turn. A live region reads the rod angle and the shape being swept.
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
            <radialGradient id={`${gid}-slider`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.5)" />
            </radialGradient>
            <linearGradient id={`${gid}-rod`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.65)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.3)" />
            </linearGradient>
          </defs>

          {/* --- The two fixed slots, cut at right angles and crossing at O --- */}
          {/* vertical slot: slider A may only travel up and down it */}
          <rect
            x={O.x - SLOT}
            y={O.y - D}
            width={SLOT * 2}
            height={D * 2}
            rx={SLOT}
            fill="#050505"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
          {/* horizontal slot: slider B may only travel left and right it */}
          <rect
            x={O.x - D}
            y={O.y - SLOT}
            width={D * 2}
            height={SLOT * 2}
            rx={SLOT}
            fill="#050505"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
          {/* centre cross-hair so the symmetry point reads */}
          <circle cx={O.x} cy={O.y} r={2.5} fill="rgba(255,255,255,0.25)" />

          {/* --- The swept ellipse: faint full ghost, bright drawn-so-far arc --- */}
          <path d={ellipsePath} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} strokeDasharray="3 5" />
          {drawnPath && (
            <path
              d={drawnPath}
              fill="none"
              stroke="rgba(220,248,124,0.85)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* --- The rigid rod between the two sliders --- */}
          <line
            x1={A.x}
            y1={A.y}
            x2={B.x}
            y2={B.y}
            stroke={`url(#${gid}-rod)`}
            strokeWidth={5}
            strokeLinecap="round"
          />
          {/* a hair of the rod carried past each slider, so it reads as a bar */}
          <line
            x1={B.x + (B.x - A.x) * 0.12}
            y1={B.y + (B.y - A.y) * 0.12}
            x2={A.x + (A.x - B.x) * 0.12}
            y2={A.y + (A.y - B.y) * 0.12}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={5}
            strokeLinecap="round"
          />

          {/* --- The two sliders, each a bead captured in its slot --- */}
          <circle cx={A.x} cy={A.y} r={8} fill={`url(#${gid}-slider)`} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
          <circle cx={B.x} cy={B.y} r={8} fill={`url(#${gid}-slider)`} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />

          {/* --- The pen: pinned to the rod, its tip the live point on the curve --- */}
          <circle cx={penX} cy={penY} r={6.5} fill={`url(#${gid}-pen)`} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
        </svg>
      </div>

      {/* Live readout — the rod angle and the shape its pin is set to sweep */}
      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {phase}&deg; &middot; {ratio}
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
