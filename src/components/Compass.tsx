import { animate, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A marine steering compass rebuilt as a working instrument: turn the ship and
// read your heading where the card sits under the lubber line. A card compass
// floats a graduated disc on a pivot so its magnet keeps the card's north toward
// magnetic north; the bowl — the frame you read through — is fixed to the vessel,
// so as the ship swings, the card appears to rotate the other way and the number
// under the fixed lubber line at the bow is the heading you are steering.
//
// The heading is the single piece of state (degrees, kept unbounded so a spring
// can settle across the 360 seam without a jump; `norm` gives the 0..360 reading).
// Everything drawn derives from it: the card is turned by `-heading`, so the
// graduation that lands under the top lubber line is exactly the heading, and the
// digital readout and the cardinal name come off the same number — the card and
// the figure can never disagree. Dragging turns the card one to one with the
// pointer, because a wheel you are turning by hand should not feel elastic; only
// a keyboard nudge or a "come to" button eases to its target on a short spring,
// and under prefers-reduced-motion even that lands straight on the value.

const CX = 130
const CY = 130
const R = 120 // bowl inner radius
const CARD_R = 104 // card outer radius

const norm = (deg: number) => ((deg % 360) + 360) % 360
// Shortest signed step from a to b, wrapped to (-180, 180].
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180
const rad = (deg: number) => (deg * Math.PI) / 180
// A point at compass bearing `deg` (0 = up = north, clockwise) at radius `rr`,
// in the card's own frame (before the card's rotation is applied).
const pt = (deg: number, rr: number) => ({
  x: CX + rr * Math.sin(rad(deg)),
  y: CY - rr * Math.cos(rad(deg)),
})

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5) // every 5 degrees
const NUMBERS = Array.from({ length: 12 }, (_, i) => i * 30) // 0,30,...,330
const CARDINALS = [
  { deg: 0, label: 'N' },
  { deg: 90, label: 'E' },
  { deg: 180, label: 'S' },
  { deg: 270, label: 'W' },
]
const INTERCARDINALS = [
  { deg: 45, label: 'NE' },
  { deg: 135, label: 'SE' },
  { deg: 225, label: 'SW' },
  { deg: 315, label: 'NW' },
]
// The 16-point rose, for naming the heading in words.
const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
const pointName = (deg: number) => POINTS[Math.round(norm(deg) / 22.5) % 16]

export function Compass({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  // Unbounded so a spring can cross the 0/360 seam without snapping back.
  const [heading, setHeading] = useState(42)

  const svgRef = useRef<SVGSVGElement | null>(null)
  // Drag rides refs so a move never restarts the gesture. `lastPointer` holds the
  // previous pointer bearing, and we accumulate the shortest step into heading, so
  // turning the card is relative — you grab it where you touch and turn from there.
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const settling = useRef<ReturnType<typeof animate> | null>(null)
  const stopSettle = () => {
    settling.current?.stop()
    settling.current = null
  }
  useEffect(() => () => stopSettle(), [])

  // Ease to a target on a short spring — the eased path for the keyboard and the
  // "come to" buttons. Reduced motion lands it. Dragging never routes through here.
  const easeTo = useCallback(
    (target: number) => {
      stopSettle()
      if (reduce) {
        setHeading(target)
        return
      }
      settling.current = animate(heading, target, {
        type: 'spring',
        stiffness: 200,
        damping: 24,
        onUpdate: (v) => setHeading(v),
      })
    },
    [reduce, heading],
  )

  // Pointer bearing measured from the bowl centre (0 = up, clockwise), matching
  // the card's own convention so a drag maps straight onto a turn.
  const pointerBearing = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return lastPointer.current
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * 260
    const py = ((clientY - rect.top) / rect.height) * 260
    return norm((Math.atan2(px - CX, CY - py) * 180) / Math.PI)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    stopSettle()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    lastPointer.current = pointerBearing(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const p = pointerBearing(e.clientX, e.clientY)
    // Turning the pointer clockwise swings the bow to starboard: heading rises.
    const d = shortest(lastPointer.current, p)
    lastPointer.current = p
    setHeading((h) => h + d)
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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') easeTo(heading - s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') easeTo(heading + s)
    // Come to north by the short way, wherever the seam happens to fall.
    else if (e.key === 'Home') easeTo(Math.round(heading / 360) * 360)
    else if (e.key === 'End') easeTo(heading + shortest(norm(heading), 180)) // reciprocal
    else handled = false
    if (handled) e.preventDefault()
  }

  const reading = norm(heading)
  const readingText = `${Math.round(reading).toString().padStart(3, '0')}°`
  // The card turns opposite the ship, so the graduation at `-heading` sits under
  // the fixed lubber line at the top — and that graduation reads `heading`.
  const cardRotation = -heading

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(reading)}
        aria-valuetext={`${Math.round(reading)} degrees, ${pointName(reading)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full max-w-[340px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Steering compass. Drag to turn the ship, arrow keys to nudge the heading, Shift for ten degrees, Home to come
          to north, End for the reciprocal.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 260 260"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
          aria-hidden
        >
          <defs>
            <radialGradient id="cmp-bowl" cx="0.42" cy="0.36" r="0.8">
              <stop offset="0" stopColor="rgba(255,255,255,0.09)" />
              <stop offset="0.7" stopColor="rgba(255,255,255,0.02)" />
              <stop offset="1" stopColor="rgba(0,0,0,0.35)" />
            </radialGradient>
            <radialGradient id="cmp-card" cx="0.5" cy="0.42" r="0.75">
              <stop offset="0" stopColor="rgba(24,26,20,0.96)" />
              <stop offset="1" stopColor="rgba(8,9,7,0.98)" />
            </radialGradient>
            <radialGradient id="cmp-hub" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#DCF87C" stopOpacity="0.9" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.8" />
            </radialGradient>
          </defs>

          {/* The fixed bowl and its bezel. */}
          <circle cx={CX} cy={CY} r={R + 6} fill="url(#cmp-bowl)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <circle cx={CX} cy={CY} r={R} fill="rgba(6,7,5,0.6)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* The floating card: everything on it turns together with the heading. */}
          <g transform={`rotate(${cardRotation} ${CX} ${CY})`}>
            <circle cx={CX} cy={CY} r={CARD_R} fill="url(#cmp-card)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {/* Graduation ticks — a long tick every 30 degrees. */}
            {TICKS.map((d) => {
              const major = d % 30 === 0
              const a = pt(d, CARD_R - 2)
              const b = pt(d, CARD_R - (major ? 12 : 6))
              return (
                <line
                  key={`t-${d}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.24)'}
                  strokeWidth={major ? 1.4 : 1}
                />
              )
            })}

            {/* Degree numbers (tens dropped: 3 for 30, 33 for 330), upright to the card. */}
            {NUMBERS.filter((d) => d % 90 !== 0).map((d) => {
              const p = pt(d, CARD_R - 26)
              return (
                <text
                  key={`n-${d}`}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${d} ${p.x} ${p.y})`}
                  fontSize="10"
                  fontWeight={500}
                  fill="rgba(255,255,255,0.5)"
                >
                  {d / 10}
                </text>
              )
            })}

            {/* Intercardinal letters. */}
            {INTERCARDINALS.map(({ deg, label }) => {
              const p = pt(deg, CARD_R - 40)
              return (
                <text
                  key={label}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${deg} ${p.x} ${p.y})`}
                  fontSize="9"
                  fontWeight={600}
                  fill="rgba(255,255,255,0.4)"
                  letterSpacing="0.5"
                >
                  {label}
                </text>
              )
            })}

            {/* The compass rose: eight rays, the north pair drawn in the accent. */}
            {Array.from({ length: 8 }, (_, i) => i * 45).map((d) => {
              const long = d % 90 === 0
              const tip = pt(d, long ? CARD_R - 50 : CARD_R - 62)
              const l = pt(d - 6, 20)
              const r = pt(d + 6, 20)
              const north = d === 0
              return (
                <polygon
                  key={`ray-${d}`}
                  points={`${tip.x},${tip.y} ${l.x},${l.y} ${r.x},${r.y}`}
                  fill={north ? 'rgba(220,248,124,0.85)' : long ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)'}
                  stroke={north ? '#DCF87C' : 'rgba(255,255,255,0.14)'}
                  strokeWidth="0.6"
                />
              )
            })}

            {/* Cardinal letters, N lit in the accent so the card's north reads at a glance. */}
            {CARDINALS.map(({ deg, label }) => {
              const p = pt(deg, CARD_R - 18)
              const isN = deg === 0
              return (
                <text
                  key={label}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${deg} ${p.x} ${p.y})`}
                  fontSize="15"
                  fontWeight={700}
                  fill={isN ? '#DCF87C' : 'rgba(255,255,255,0.78)'}
                >
                  {label}
                </text>
              )
            })}

            {/* Pivot hub. */}
            <circle cx={CX} cy={CY} r="6" fill="url(#cmp-hub)" stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
          </g>

          {/* The fixed lubber line at the bow, and the heading window it frames. */}
          <line x1={CX} y1={CY - R} x2={CX} y2={CY - R + 22} stroke="#DCF87C" strokeWidth="2" strokeLinecap="round" />
          <polygon
            points={`${CX},${CY - R + 4} ${CX - 6},${CY - R - 9} ${CX + 6},${CY - R - 9}`}
            fill="#DCF87C"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.6"
          />
          {/* Fore-and-aft reference line of the vessel, faint down the centre. */}
          <line
            x1={CX}
            y1={CY - R + 22}
            x2={CX}
            y2={CY + R - 22}
            stroke="rgba(220,248,124,0.14)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-lg border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-2 text-center font-mono text-lg tabular-nums text-[#DCF87C]">
          {readingText}
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-[#DCF87C]/70">
            {pointName(reading)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => easeTo(Math.round(heading / 360) * 360)}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Come to north
        </button>
        <button
          type="button"
          onClick={() => easeTo(heading + shortest(norm(heading), 180))}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Reciprocal
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {`Heading ${Math.round(reading)} degrees, ${pointName(reading)}`}
      </span>
    </div>
  )
}
