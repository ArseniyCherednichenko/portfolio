import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A horizontal sundial: the shadow a polar-pointing style casts across a fan of
// hour lines cut for Berlin's latitude. It is the third in the sky/time thread —
// the Orrery reads one day-count as six orbits, the Moon reads one age as one
// sliver, and this reads one time-of-day as the single angle a shadow turns to.
//
// The single source of truth is `solarHours` — apparent solar time, 0..24, where
// 12 is solar noon (the Sun due south, the shadow pointing due north). Everything
// else is derived from it: the hour angle H = (t − 12)·15°, the shadow bearing
// θ = atan2(sin φ · sin H, cos H) measured clockwise from north, the compass
// name of that bearing, and the clock readout. Live mode just keeps writing the
// real local mean solar time into it; the drag and the keyboard write it
// directly. Nothing on screen can drift from the time, because there is nothing
// else to drift from.
//
// Honesty, stated plainly: a real sundial reads *apparent* solar time, which is
// mean time plus the equation of time (±16 minutes across the year); live mode
// seeds the mean time (UTC shifted by Berlin's longitude), so against a true
// sundial it can sit a quarter-hour off, by season. The dial is cut for Berlin's
// latitude, 52.52° N, and only reads while the Sun is in the southern sky —
// roughly 6 to 18 in solar time; outside that the simple dial casts no shadow.
// And the gnomon's blade is lime, but the Sun itself is drawn amber, never lime —
// a lime Sun would not be the Sun, the same honesty that keeps the Moon cream.

const BERLIN_LAT = 52.52 // degrees north — the dial is cut for this latitude
const BERLIN_LON = 13.405 // degrees east — fixes local mean solar time
const SIN_LAT = Math.sin((BERLIN_LAT * Math.PI) / 180)

const DEG = Math.PI / 180
const wrap24 = (h: number) => ((h % 24) + 24) % 24

// Geometry of the drawn dial. The gnomon's foot sits low (the southern edge) so
// the hour lines fan up into the northern half, the way a real horizontal dial's
// lines spread from the point where the style meets the base.
const VW = 320
const VH = 250
const OX = VW / 2 // gnomon foot x
const OY = 202 // gnomon foot y (near the bottom — the south of the plate)
const R = 132 // radius out to the hour-line rim
const GNOMON_H = 66 // height of the style blade on screen

// Hours the dial reliably shows: the Sun is unambiguously in the south, so the
// style's shadow lands in the upper (northern) half of the plate.
const FIRST_HOUR = 6
const LAST_HOUR = 18

// Local mean solar time at Berlin's longitude, read from the real clock. Pure
// Sun-based time: no civil zone, no daylight saving, no equation of time.
function liveSolar(at = Date.now()): number {
  const d = new Date(at)
  const utc = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  return wrap24(utc + BERLIN_LON / 15)
}

// The one derivation: solar time → shadow bearing, clockwise from due north.
// atan2 carries it right around, so morning throws the shadow west, noon north,
// afternoon east, and the pre-6/post-18 hours (|H| > 90°) fall to the south.
function shadowBearing(t: number): number {
  const H = (t - 12) * 15 * DEG
  return Math.atan2(SIN_LAT * Math.sin(H), Math.cos(H)) // radians, 0 = north
}

// Screen endpoint of a ray from the foot at a given bearing (north = up).
function rimPoint(bearingRad: number, radius: number): [number, number] {
  return [OX + radius * Math.sin(bearingRad), OY - radius * Math.cos(bearingRad)]
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
function compassName(bearingRad: number): string {
  const deg = ((bearingRad / DEG) % 360 + 360) % 360
  return COMPASS[Math.round(deg / 22.5) % 16]
}

// Roman numerals for the labelled hours, the way a dial is engraved.
const ROMAN: Record<number, string> = {
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
  11: 'XI',
  12: 'XII',
  13: 'I',
  14: 'II',
  15: 'III',
  16: 'IIII',
  17: 'V',
  18: 'VI',
}

function hhmm(t: number): string {
  let h = Math.floor(t)
  let m = Math.round((t - h) * 60)
  if (m === 60) {
    m = 0
    h = (h + 1) % 24
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function Sundial({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const shadowGradId = useId()
  const bladeGradId = useId()
  const sunGlowId = useId()

  const [solar, setSolar] = useState(() => liveSolar())
  const [live, setLive] = useState(true)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastX = useRef(0)

  // Live mode re-reads the clock. The shadow turns 15° an hour, so a half-minute
  // tick is plenty and keeps the component idle the rest of the time.
  useEffect(() => {
    if (!live) return
    setSolar(liveSolar())
    const id = window.setInterval(() => setSolar(liveSolar()), 30_000)
    return () => window.clearInterval(id)
  }, [live])

  // Drag horizontally to scrub the day: the full width of the plate is 24 hours.
  const scrubBy = useCallback((clientDx: number, width: number) => {
    setLive(false)
    setSolar((t) => wrap24(t + (clientDx / width) * 24))
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    dragging.current = true
    lastX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const w = svgRef.current?.getBoundingClientRect().width ?? VW
    scrubBy(e.clientX - lastX.current, w)
    lastX.current = e.clientX
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

  const step = useCallback((hours: number) => {
    setLive(false)
    setSolar((t) => wrap24(t + hours))
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(e.shiftKey ? 1 / 6 : 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(e.shiftKey ? -1 / 6 : -1)
    else if (e.key === 'PageUp') step(3)
    else if (e.key === 'PageDown') step(-3)
    else if (e.key === 'Home') {
      setLive(false)
      setSolar(FIRST_HOUR) // sunrise end of the dial
    } else if (e.key === 'End') {
      setLive(false)
      setSolar(LAST_HOUR) // sunset end of the dial
    } else if (e.key === ' ' || e.key === 'Enter') {
      setLive((v) => !v)
      if (!live) setSolar(liveSolar())
    } else handled = false
    if (handled) e.preventDefault()
  }

  const onDial = solar >= FIRST_HOUR && solar <= LAST_HOUR
  const bearing = shadowBearing(solar)
  const [shadowX, shadowY] = rimPoint(bearing, R - 6)
  // The Sun sits opposite the shadow it throws.
  const [sunX, sunY] = rimPoint(bearing + Math.PI, R - 2)
  const H = (solar - 12) * 15 // hour angle, degrees (− morning, + afternoon)

  // A tapered shadow: a slim wedge from the foot out to the rim.
  const perp = bearing + Math.PI / 2
  const footHalf = 6
  const tipHalf = 2
  const [fax, fay] = [OX + footHalf * Math.sin(perp), OY - footHalf * Math.cos(perp)]
  const [fbx, fby] = [OX - footHalf * Math.sin(perp), OY + footHalf * Math.cos(perp)]
  const [tax, tay] = [shadowX + tipHalf * Math.sin(perp), shadowY - tipHalf * Math.cos(perp)]
  const [tbx, tby] = [shadowX - tipHalf * Math.sin(perp), shadowY + tipHalf * Math.cos(perp)]
  const shadowPts = `${fax},${fay} ${tax},${tay} ${tbx},${tby} ${fbx},${fby}`

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={24}
        aria-valuenow={Math.round(solar * 10) / 10}
        aria-valuetext={
          onDial
            ? `${hhmm(solar)} solar time, shadow to the ${compassName(bearing)}`
            : `${hhmm(solar)} solar time, the Sun is off the dial`
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full max-w-[340px] touch-none select-none rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          A horizontal sundial for Berlin. Drag left or right to scrub through the day. Arrow keys step an hour, Shift ten
          minutes, Page Up and Page Down three hours, Home jumps to the dial&rsquo;s morning edge, End to its evening
          edge, Space returns to the real time now.
        </span>
        <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" aria-hidden>
          <defs>
            <linearGradient id={shadowGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(10,12,20,0.72)" />
              <stop offset="1" stopColor="rgba(10,12,20,0.04)" />
            </linearGradient>
            <linearGradient id={bladeGradId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#DCF87C" />
              <stop offset="1" stopColor="#aee04a" />
            </linearGradient>
            <radialGradient id={sunGlowId} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(255,214,140,0.9)" />
              <stop offset="0.5" stopColor="rgba(255,196,110,0.35)" />
              <stop offset="1" stopColor="rgba(255,196,110,0)" />
            </radialGradient>
          </defs>

          {/* The dial plate — a quiet panel the lines are cut into. */}
          <path
            d={`M ${OX - R - 10} ${OY} A ${R + 10} ${R + 10} 0 0 1 ${OX + R + 10} ${OY} Z`}
            fill="rgba(255,255,255,0.02)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          {/* The noon baseline (the dial's east–west edge). */}
          <line x1={OX - R - 10} y1={OY} x2={OX + R + 10} y2={OY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Faint half-hour lines for texture, unlabelled. */}
          {Array.from({ length: (LAST_HOUR - FIRST_HOUR) * 2 + 1 }, (_, i) => FIRST_HOUR + i / 2).map((h) => {
            if (Number.isInteger(h)) return null
            const [x, y] = rimPoint(shadowBearing(h), R)
            return <line key={`half-${h}`} x1={OX} y1={OY} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          })}

          {/* The labelled hour lines, fanned from the foot. */}
          {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i).map((h) => {
            const b = shadowBearing(h)
            const [x, y] = rimPoint(b, R)
            const [lx, ly] = rimPoint(b, R + 15)
            const noon = h === 12
            return (
              <g key={`hour-${h}`}>
                <line
                  x1={OX}
                  y1={OY}
                  x2={x}
                  y2={y}
                  stroke={noon ? 'rgba(220,248,124,0.5)' : 'rgba(255,255,255,0.18)'}
                  strokeWidth={noon ? 1.5 : 1}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                  fill={noon ? 'rgba(220,248,124,0.85)' : 'rgba(255,255,255,0.5)'}
                >
                  {ROMAN[h]}
                </text>
              </g>
            )
          })}

          {/* The Sun, opposite the shadow — amber, never lime — with its glow. */}
          {onDial && (
            <g>
              <circle cx={sunX} cy={sunY} r={26} fill={`url(#${sunGlowId})`} />
              <motion.circle
                cx={sunX}
                cy={sunY}
                r={7}
                fill="#ffd27a"
                animate={reduce ? undefined : { opacity: [0.9, 1, 0.9] }}
                transition={reduce ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          )}

          {/* The cast shadow of the style — a tapered wedge, dark and lime-free. */}
          {onDial && <polygon points={shadowPts} fill={`url(#${shadowGradId})`} />}

          {/* The gnomon's style blade, standing on the noon line, pointing north. */}
          <polygon
            points={`${OX - 6},${OY} ${OX},${OY - GNOMON_H} ${OX + 6},${OY}`}
            fill={`url(#${bladeGradId})`}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth="0.75"
          />
          {/* The foot hub. */}
          <circle cx={OX} cy={OY} r={4} fill="#0b0b0d" stroke="rgba(220,248,124,0.6)" strokeWidth="1.5" />

          {/* When the Sun is off the dial, say so rather than draw a false shadow. */}
          {!onDial && (
            <text
              x={OX}
              y={OY - R / 2}
              textAnchor="middle"
              fontSize="12"
              fontFamily="ui-monospace, monospace"
              fill="rgba(255,255,255,0.4)"
            >
              Sun off the dial
            </text>
          )}
        </svg>
      </div>

      {/* Readout + controls. */}
      <div className="mt-6 w-full max-w-[340px]">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-display text-xl font-semibold text-white/90">Solar time</h4>
          <span className="font-display text-xl font-semibold tabular-nums text-[#DCF87C]">{hhmm(solar)}</span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Hour angle', value: `${H > 0 ? '+' : ''}${Math.round(H)}°` },
            { label: 'Shadow to', value: onDial ? compassName(bearing) : '—' },
            { label: 'Latitude', value: `${BERLIN_LAT}°N` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2">
              <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">{s.label}</dt>
              <dd className="mt-0.5 font-mono text-sm tabular-nums text-white/80">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLive(true)
              setSolar(liveSolar())
            }}
            aria-pressed={live}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              live
                ? 'border-[#DCF87C]/60 bg-[#DCF87C]/15 text-[#DCF87C]'
                : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/80'
            }`}
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white/80"
          >
            &minus;1 hour
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white/80"
          >
            +1 hour
          </button>
        </div>
      </div>
    </div>
  )
}
