import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// The slider-crank: the piston engine's own mechanism, and the honest answer to
// the Scotch yoke standing right beside it. The yoke turns rotation into a
// *perfect* sine because it has no connecting rod — the pin rides a slot and
// only its side-to-side carries through. A slider-crank has a rod, and the rod
// is the whole story. A crank pin at r·(cos θ, sin θ) is tied by a rod of fixed
// length L to a piston that may only slide along one line, so the piston sits at
//
//     x(θ) = r·cos θ + √(L² − r²·sin²θ)
//
// — a cosine *plus* a square-root error term that the yoke does not carry. That
// term is small when the rod is long and grows as it shortens, and it is never
// positive, so the real piston always lags the ideal sine: it dwells a beat
// longer at the head end (top dead centre) than at the crank end, and it is
// quicker through one half of the turn than the other. That asymmetry is the
// reason a real engine's motion is lopsided, and it is drawn here as the gap
// between two curves — the piston's true path and the pure cosine a yoke would
// trace — swept live below the machine.
//
// The rod ratio n = L/r is the one dial that matters, so it is a control: a
// stubby rod (n≈1.6) throws a visibly skewed curve, a long one (n≈3.2) presses
// the path back toward the sine the yoke draws exactly. The only stored state is
// the crank angle and the ratio; the pin, the rod, the piston and both swept
// curves are all derived, so none can drift out of agreement.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame (SVG user units). The piston's stroke is centred on a fixed
// screen axis (MID) so the bore and the trace never move; the crank axle slides
// left as the rod lengthens, the way a longer engine actually grows backward.
const MID = 250 // stroke-centre screen x — the piston axis, and the trace's axis
const OY = 106 // the common centre line the crank axle and piston share
const R = 48 // crank radius = half the piston's stroke
const BORE_HALF = 24 // half the cylinder bore
const PIST_HALF = 17 // half the piston's travel-direction length
const BORE_L = MID - R - 20 // crankcase mouth, left of the inner dead point
const BORE_R = MID + R + 30 // cylinder head, right of the outer dead point
const TRACE_TOP = 214
const TRACE_BOT = 290

const RATIOS = [
  { n: 1.6, label: 'Stubby' },
  { n: 2.2, label: 'Typical' },
  { n: 3.2, label: 'Long' },
] as const

export function SliderCrank({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // Crank angle, unbounded so drag and spin cross the 0/360 seam without a snap.
  const [drive, setDrive] = useState(20)
  const [running, setRunning] = useState(false)
  const [n, setN] = useState(2.2)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const L = R * n
  const OX = MID - L // crank axle x: stroke-centre minus the rod length
  const theta = rad(drive)
  // The piston's whole displacement, in one line, with its rod-error term.
  const sReal = Math.cos(theta) + Math.sqrt(n * n - Math.sin(theta) * Math.sin(theta)) - n
  const sIdeal = Math.cos(theta) // what a Scotch yoke would draw: a pure cosine
  const err = sReal - sIdeal // the connecting-rod lag, always ≤ 0, in units of r

  const px = OX + R * Math.cos(theta)
  const py = OY + R * Math.sin(theta)
  const qx = MID + sReal * R // piston pin, on the centre line
  const qy = OY

  // Continuous spin (skipped under reduced motion, where Run advances a quarter
  // turn to the next cardinal position rather than sweeping the frames between).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 54) // 54 deg/s -> a ~6.7s revolution
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
    return norm((Math.atan2(y - OY, x - OX) * 180) / Math.PI)
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
    setDrive((v) => v + delta)
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

  const toggleRun = useCallback(() => {
    if (reduce) {
      setDrive((v) => Math.round(v / 90) * 90 + 90)
      return
    }
    setRunning((r) => !r)
  }, [reduce])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(s)
    else if (e.key === 'Home') {
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

  // The two curves, swept over one revolution: angle runs down the strip, the
  // horizontal axis is real displacement at the mechanism's own scale, so a
  // plumb line drops from the piston straight onto its own live point.
  const { realPath, idealPath } = useMemo(() => {
    const steps = 120
    let real = ''
    let ideal = ''
    for (let i = 0; i <= steps; i++) {
      const phi = (i / steps) * 360
      const th = rad(phi)
      const sr = Math.cos(th) + Math.sqrt(n * n - Math.sin(th) * Math.sin(th)) - n
      const si = Math.cos(th)
      const y = TRACE_TOP + (phi / 360) * (TRACE_BOT - TRACE_TOP)
      real += `${i === 0 ? 'M' : 'L'}${(MID + sr * R).toFixed(2)} ${y.toFixed(2)} `
      ideal += `${i === 0 ? 'M' : 'L'}${(MID + si * R).toFixed(2)} ${y.toFixed(2)} `
    }
    return { realPath: real.trim(), idealPath: ideal.trim() }
  }, [n])

  const readY = TRACE_TOP + (norm(drive) / 360) * (TRACE_BOT - TRACE_TOP)
  const dead = sReal > 0.985 ? 'at top dead centre' : sReal < -0.985 ? 'at bottom dead centre' : null

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Crank ${phase} degrees, piston displacement ${sReal >= 0 ? '+' : ''}${sReal.toFixed(2)} of amplitude, lagging the ideal sine by ${Math.abs(err).toFixed(2)}${dead ? `, ${dead}` : ''}. Rod ratio ${n.toFixed(1)}.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Slider-crank mechanism. Drag the crank to turn it, arrow keys nudge the crank angle, Shift for ten degrees,
          Space runs or stops it, Home returns to zero and End jumps a quarter turn. The rod-ratio buttons below set how
          long the connecting rod is. A live region reads the crank angle, the piston displacement, and how far it lags
          the ideal sine.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 300"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-pin`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
            <radialGradient id={`${gid}-disc`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.14)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.04)" />
            </radialGradient>
            <linearGradient id={`${gid}-rod`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.28)" />
            </linearGradient>
            <linearGradient id={`${gid}-pist`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="0.5" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>
          </defs>

          {/* --- The cylinder bore: two fixed rails the piston may only slide between --- */}
          <line x1={BORE_L} y1={OY - BORE_HALF} x2={BORE_R} y2={OY - BORE_HALF} stroke="rgba(255,255,255,0.16)" strokeWidth={3} strokeLinecap="round" />
          <line x1={BORE_L} y1={OY + BORE_HALF} x2={BORE_R} y2={OY + BORE_HALF} stroke="rgba(255,255,255,0.16)" strokeWidth={3} strokeLinecap="round" />
          {/* cylinder head (closed right end) */}
          <line x1={BORE_R} y1={OY - BORE_HALF} x2={BORE_R} y2={OY + BORE_HALF} stroke="rgba(255,255,255,0.22)" strokeWidth={3} strokeLinecap="round" />
          {/* dead-centre marks on the bore axis: the two turning points of the stroke */}
          {[MID - R, MID + R].map((x) => (
            <line key={x} x1={x} y1={OY - BORE_HALF - 6} x2={x} y2={OY - BORE_HALF + 2} stroke="rgba(220,248,124,0.4)" strokeWidth={2} strokeLinecap="round" />
          ))}

          {/* --- Crank: faint disc, arm, and the crank pin --- */}
          <circle cx={OX} cy={OY} r={R} fill={`url(#${gid}-disc)`} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          <circle cx={OX} cy={OY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 6" strokeWidth={1} />
          <line x1={OX} y1={OY} x2={px} y2={py} stroke="rgba(220,248,124,0.6)" strokeWidth={4} strokeLinecap="round" />

          {/* --- Connecting rod: crank pin to piston pin, the error made visible --- */}
          <line x1={px} y1={py} x2={qx} y2={qy} stroke={`url(#${gid}-rod)`} strokeWidth={5} strokeLinecap="round" />

          {/* --- Piston: a block centred on the pin, constrained to the bore axis --- */}
          <rect
            x={qx - PIST_HALF}
            y={OY - BORE_HALF + 2}
            width={PIST_HALF * 2}
            height={(BORE_HALF - 2) * 2}
            rx={5}
            fill={`url(#${gid}-pist)`}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1.5}
          />
          {/* two ring grooves, so the piston reads as a piston */}
          <line x1={qx - PIST_HALF + 5} y1={OY - BORE_HALF + 6} x2={qx - PIST_HALF + 5} y2={OY + BORE_HALF - 6} stroke="rgba(0,0,0,0.35)" strokeWidth={2} />
          <line x1={qx - PIST_HALF + 9} y1={OY - BORE_HALF + 6} x2={qx - PIST_HALF + 9} y2={OY + BORE_HALF - 6} stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />

          {/* bearings: main (fixed), crank pin, wrist pin */}
          <circle cx={OX} cy={OY} r={5} fill="#0B0B0B" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
          <circle cx={px} cy={py} r={6} fill={`url(#${gid}-pin)`} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
          <circle cx={qx} cy={qy} r={5.5} fill="#0B0B0B" stroke="#DCF87C" strokeWidth={1.5} />

          {/* --- The two swept curves: the real piston path and the ideal cosine --- */}
          <line x1={MID} y1={TRACE_TOP - 6} x2={MID} y2={TRACE_BOT + 6} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          <path d={idealPath} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} strokeDasharray="3 4" />
          <path d={realPath} fill="none" stroke="rgba(220,248,124,0.4)" strokeWidth={1.75} />
          {/* plumb line from the piston pin straight down onto its live point */}
          <line x1={qx} y1={OY + BORE_HALF + 4} x2={qx} y2={readY} stroke="rgba(220,248,124,0.4)" strokeWidth={1.5} strokeDasharray="2 4" />
          {/* ghost point on the ideal cosine, and the live point on the real path */}
          <circle cx={MID + sIdeal * R} cy={readY} r={3.5} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
          <circle cx={qx} cy={readY} r={5} fill="#DCF87C" stroke="#0B0B0B" strokeWidth={1.5} />
        </svg>
      </div>

      {/* Rod-ratio control — the one dial that changes the shape of the answer */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/40">Rod L / r</span>
        {RATIOS.map((r) => {
          const on = Math.abs(r.n - n) < 0.001
          return (
            <button
              key={r.n}
              type="button"
              aria-pressed={on}
              onClick={() => setN(r.n)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                on
                  ? 'border-[#DCF87C]/50 bg-[#DCF87C]/[0.12] text-[#DCF87C]'
                  : 'border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
              }`}
            >
              {r.label} · {r.n.toFixed(1)}
            </button>
          )
        })}
      </div>

      {/* Live readout — angle, displacement, and the connecting-rod lag */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {phase}&deg; &middot; {sReal >= 0 ? '+' : ''}
          {sReal.toFixed(2)} r
        </span>
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/80 backdrop-blur">
          lag {Math.abs(err).toFixed(2)} r
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
