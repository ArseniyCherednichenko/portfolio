import { animate, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A half-circle protractor rebuilt as a working instrument: drag the arm around
// the arc (or focus it and tick with the arrow keys) and it reads the angle the
// way the tool actually is read — off the two scales printed on it. A real
// protractor carries a double scale: an outer run 0 -> 180 measured from the
// right base, and an inner run 0 -> 180 the other way, so a line can be read
// from either edge and the two readings always sum to 180. Both are on screen,
// and the one major division the arm sits nearest is lit lime on both scales at
// once, so the dual-scale principle is shown, not merely asserted.
//
// The angle is the single piece of state (degrees from the right base, 0..180);
// everything drawn — the arm, the lit division, both readouts — derives from it,
// so the reading is always exactly the geometry. The arm tracks the pointer one
// to one, because an instrument you are turning by hand should not feel elastic;
// only a keyboard nudge or a reset eases to its target on a short spring, and
// under prefers-reduced-motion even that cuts straight to the value.

const CX = 140
const CY = 140
const R = 118
// A hair of slack for deciding which major division is "the" reading, and for
// the numeric snap in the readout.
const STEP = 0.1

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const rad = (deg: number) => (deg * Math.PI) / 180
// A point on the dial at `deg` (measured CCW from the right base) at radius `rr`.
// SVG y grows downward, so the sine is subtracted to lift the arc above the base.
const pt = (deg: number, rr: number) => ({ x: CX + rr * Math.cos(rad(deg)), y: CY - rr * Math.sin(rad(deg)) })

const MAJORS = Array.from({ length: 19 }, (_, i) => i * 10) // 0,10,...,180
const MINORS = Array.from({ length: 91 }, (_, i) => i * 2).filter((d) => d % 10 !== 0)

export function Protractor({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [angle, setAngle] = useState(30)

  // Pointer drag rides a ref so the move handler never restarts the gesture.
  const dragging = useRef(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  // Any in-flight easing (keyboard nudge or reset), so a fresh gesture interrupts it.
  const settling = useRef<ReturnType<typeof animate> | null>(null)
  const stopSettle = () => {
    settling.current?.stop()
    settling.current = null
  }
  useEffect(() => () => stopSettle(), [])

  const setClamped = useCallback((v: number) => setAngle(clamp(v, 0, 180)), [])

  // Ease to a target on a short spring — the eased-keyboard path. Reduced motion
  // lands it. Used by the arrow keys and the reset buttons; drag never eases.
  const nudgeTo = useCallback(
    (target: number) => {
      stopSettle()
      const to = clamp(target, 0, 180)
      if (reduce) {
        setAngle(to)
        return
      }
      settling.current = animate(angle, to, {
        type: 'spring',
        stiffness: 220,
        damping: 22,
        onUpdate: (v) => setAngle(v),
      })
    },
    [reduce, angle],
  )

  // Map a pointer position onto the dial angle, measured CCW from the right base.
  const angleFromPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return angle
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * 280
    const py = ((clientY - rect.top) / rect.height) * 168
    const deg = (Math.atan2(CY - py, px - CX) * 180) / Math.PI
    return clamp(deg, 0, 180)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    stopSettle()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setClamped(angleFromPointer(e.clientX, e.clientY))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setClamped(angleFromPointer(e.clientX, e.clientY))
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudgeTo(angle - s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudgeTo(angle + s)
    else if (e.key === 'Home') nudgeTo(0)
    else if (e.key === 'End') nudgeTo(180)
    else if (e.key === 'Enter' || e.key === ' ') nudgeTo(90)
    else handled = false
    if (handled) e.preventDefault()
  }

  // The two readings a real double scale gives: outer from the right base, inner
  // from the left. They always sum to 180 — the whole point of the dual scale.
  const outer = Math.round(angle / STEP) * STEP
  const inner = Math.round((180 - angle) / STEP) * STEP
  // Which printed major division the arm sits nearest — lit on both scales.
  const litMajor = Math.round(angle / 10) * 10
  const isRight = Math.abs(angle) < 0.05 // reading straight along the base

  const tip = pt(angle, R)
  const armBase = pt(angle, 16)
  const bead = pt(angle, R - 12)

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={180}
        aria-valuenow={Math.round(angle * 10) / 10}
        aria-valuetext={`${outer.toFixed(1)} degrees`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Protractor. Drag the arm around the dial, arrow keys to nudge, Shift for ten degrees, Home and End for the
          ends, Enter to square to ninety.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 280 168"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <linearGradient id="prt-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.015)" />
            </linearGradient>
            <radialGradient id="prt-bead" cx="0.38" cy="0.34" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.4" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* The transparent-ruler body: a filled half disc with a soft edge. */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`}
            fill="url(#prt-body)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          {/* Inner cut-out arc, the way a real protractor is hollowed. */}
          <path
            d={`M ${CX - (R - 34)} ${CY} A ${R - 34} ${R - 34} 0 0 1 ${CX + (R - 34)} ${CY} Z`}
            fill="rgba(10,10,10,0.55)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />

          {/* Minor ticks, every two degrees. */}
          {MINORS.map((d) => {
            const a = pt(d, R - 1)
            const b = pt(d, R - 7)
            return <line key={`mn-${d}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
          })}

          {/* Major ticks + the double numbering. The one nearest the arm lights
              lime on both scales — the reading, shown on the tool itself. */}
          {MAJORS.map((d) => {
            const lit = d === litMajor
            const a = pt(d, R - 1)
            const b = pt(d, R - 14)
            const outerLabel = pt(d, R + 12) // outer scale: value = d
            const innerLabel = pt(d, R - 26) // inner scale: value = 180 - d
            return (
              <g key={`mj-${d}`}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={lit ? '#DCF87C' : 'rgba(255,255,255,0.5)'}
                  strokeWidth={lit ? 2.2 : 1.4}
                />
                <text
                  x={outerLabel.x}
                  y={outerLabel.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill={lit ? '#DCF87C' : 'rgba(255,255,255,0.55)'}
                  fontWeight={lit ? 700 : 400}
                >
                  {d}
                </text>
                <text
                  x={innerLabel.x}
                  y={innerLabel.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fill={lit ? '#DCF87C' : 'rgba(255,255,255,0.32)'}
                  fontWeight={lit ? 700 : 400}
                >
                  {180 - d}
                </text>
              </g>
            )
          })}

          {/* Base line and its centre pivot. */}
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" />

          {/* The arm: pivot to the dial edge, one to one with the pointer. */}
          <line
            x1={armBase.x}
            y1={armBase.y}
            x2={tip.x}
            y2={tip.y}
            stroke="#DCF87C"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={bead.x} cy={bead.y} r="6.5" fill="url(#prt-bead)" />
          {/* Pivot hub. */}
          <circle cx={CX} cy={CY} r="6" fill="#0A0A0A" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />
          <circle cx={CX} cy={CY} r="1.6" fill="#DCF87C" />
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-lg border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-3 py-2 text-center font-mono text-sm tabular-nums text-[#DCF87C]">
          {isRight ? '0.0' : outer.toFixed(1)}&deg;
          <span className="ml-1 text-[10px] uppercase tracking-wider text-[#DCF87C]/60">outer</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-center font-mono text-sm tabular-nums text-white/70">
          {inner.toFixed(1)}&deg;
          <span className="ml-1 text-[10px] uppercase tracking-wider text-white/40">inner</span>
        </div>
        <button
          type="button"
          onClick={() => nudgeTo(90)}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Square it
        </button>
      </div>

      {/* The dual scale, stated once for a reader who cannot see the dial. */}
      <span aria-live="polite" className="sr-only">
        {`${outer.toFixed(1)} degrees on the outer scale, ${inner.toFixed(1)} on the inner`}
      </span>
    </div>
  )
}
