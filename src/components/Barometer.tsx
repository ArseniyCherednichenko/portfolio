import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// An aneroid barometer, rebuilt as a working instrument rather than a picture of
// one, and the third member of this corner's weather set — where the VU meter
// leans after a signal and the Galilean thermometer reads the room by buoyancy,
// this one reads the air by the squeeze on a sealed metal box. The mechanism is
// the real thing: an aneroid barometer has no liquid, only a thin corrugated
// capsule pumped nearly empty, so the outside air presses it a little flatter
// when pressure rises and lets it swell when pressure falls. That tiny breath is
// multiplied by a lever and a chain into the sweep of a pointer, so the needle's
// angle is the capsule's deflection — nothing else. The reading is derived from
// exactly that: the hectopascal and inch-of-mercury numbers, and the printed word
// the needle sits over, all come straight back off the pointer's angle, so the
// dial and the figures can never disagree.
//
// The one thing you drive is the brass memory hand, the way you actually use a
// barometer: on a real role=slider, drag it round the dial or ride it with the
// arrows, Home and End, to mark the current reading. Come back later and the gap
// between the live pointer and your mark is the trend — risen toward fair, or
// fallen toward rain. Tap the glass to free a needle that has stuck, exactly as
// you would the real thing. Honest about what it is: there is no weather here and
// no air on the capsule — the pointer tracks a slow synthesised drift, not a
// measurement, and the printed words are the traditional markings off an old
// dial, not a forecast. Under prefers-reduced-motion the drift stops: the needle
// rests at standard sea-level pressure and the capsule holds still, so it stays a
// live, readable instrument, just a calm one.

// --- Geometry (SVG) --------------------------------------------------------
const VW = 300
const VH = 300
const C = 150 // dial centre
const R = 120 // scale radius

// Pressure range of the dial, in hectopascals (millibars).
const P_MIN = 950
const P_MAX = 1050
const P_STD = 1013 // standard sea-level pressure, the needle's resting place
const HPA_TO_INHG = 0.02953

// The scale sweeps 270° with the gap at the bottom: P_MIN sits at -135° (lower
// left), P_MAX at +135° (lower right), measured clockwise from straight up.
const ANG_MIN = -135
const ANG_MAX = 135

const angleFor = (p: number) => ANG_MIN + ((p - P_MIN) / (P_MAX - P_MIN)) * (ANG_MAX - ANG_MIN)
const pressureFor = (a: number) => P_MIN + ((a - ANG_MIN) / (ANG_MAX - ANG_MIN)) * (P_MAX - P_MIN)

// A point on the dial at angle a (degrees, 0 = up, clockwise) and radius r.
function polar(a: number, r: number): [number, number] {
  const rad = (a * Math.PI) / 180
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)]
}

// The traditional printed markings of an aneroid dial, by the pressure band they
// cover. Not a forecast — the words an old barometer carries on its face.
const BANDS = [
  { word: 'Stormy', from: P_MIN, to: 965 },
  { word: 'Rain', from: 965, to: 985 },
  { word: 'Change', from: 985, to: 1005 },
  { word: 'Fair', from: 1005, to: 1025 },
  { word: 'Very dry', from: 1025, to: P_MAX },
] as const

function bandFor(p: number) {
  return BANDS.find((b) => p >= b.from && p < b.to) ?? BANDS[BANDS.length - 1]
}

// The control step for the brass memory hand, in hPa.
const MARK_STEP = 1

export function Barometer({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()

  // The brass memory hand — the one thing you set.
  const [mark, setMark] = useState(P_STD)
  const markRef = useRef(mark)
  markRef.current = mark

  // The live pressure, driven every frame; `display` is a throttled copy for the
  // readout so the numbers tick without re-rendering the whole dial per frame.
  const [display, setDisplay] = useState(P_STD)
  const needleRef = useRef<SVGGElement | null>(null)
  const capsuleRef = useRef<SVGGElement | null>(null)

  const pressure = useRef(P_STD) // current pressure
  const pv = useRef(0) // its velocity (spring + taps)
  const centre = useRef(P_STD) // the slow wandering setpoint the pressure chases

  const band = useMemo(() => bandFor(display), [display])
  const trend = display - mark

  // Paint the needle and the breathing capsule straight from the pressure.
  const paint = useCallback((p: number) => {
    needleRef.current?.setAttribute('transform', `rotate(${angleFor(p).toFixed(2)} ${C} ${C})`)
    // The capsule flattens as pressure rises, swells as it falls — a small,
    // honest exaggeration of the real deflection so the mechanism is visible.
    const squeeze = 1 - (p - P_STD) / 320
    capsuleRef.current?.setAttribute('transform', `translate(${C} 214) scale(1 ${squeeze.toFixed(3)})`)
  }, [])

  // Reduced motion / no loop: rest at standard pressure, still and readable.
  useEffect(() => {
    if (!reduce) return
    pressure.current = P_STD
    pv.current = 0
    setDisplay(P_STD)
    paint(P_STD)
  }, [reduce, paint])

  // The live movement: the pressure springs toward a setpoint that itself does a
  // slow, mean-reverting random walk — a drift that reads like real barometric
  // weather over minutes, not a jitter. A tap of the glass adds a transient the
  // same damping then absorbs.
  useEffect(() => {
    if (reduce) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const STIFF = 3.2
    const DAMP = 2.6
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!document.hidden) {
        // Wander the setpoint, gently pulled back toward standard pressure.
        centre.current += (Math.random() - 0.5) * 2.4 * dt
        centre.current += (P_STD - centre.current) * 0.04 * dt
        centre.current = Math.max(962, Math.min(1042, centre.current))
        // Spring the pressure toward the setpoint.
        const accel = STIFF * (centre.current - pressure.current) - DAMP * pv.current
        pv.current += accel * dt
        pressure.current += pv.current * dt
        pressure.current = Math.max(P_MIN, Math.min(P_MAX, pressure.current))
        paint(pressure.current)
        // Throttle the readout to ~6 Hz.
        acc += dt
        if (acc >= 0.16) {
          acc = 0
          setDisplay(Math.round(pressure.current))
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduce, paint])

  const tap = () => {
    if (reduce) return
    pv.current += (Math.random() - 0.5) * 22
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = mark
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = mark + MARK_STEP
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = mark - MARK_STEP
    else if (e.key === 'PageUp') next = mark + 5
    else if (e.key === 'PageDown') next = mark - 5
    else if (e.key === 'Home') next = P_MIN
    else if (e.key === 'End') next = P_MAX
    else return
    e.preventDefault()
    setMark(Math.max(P_MIN, Math.min(P_MAX, Math.round(next))))
  }

  // Map a pointer on the dial to a pressure, for setting the brass hand.
  const markFromPoint = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * VW - C
    const y = ((clientY - r.top) / r.height) * VH - C
    let a = (Math.atan2(x, -y) * 180) / Math.PI // 0 = up, clockwise
    a = Math.max(ANG_MIN, Math.min(ANG_MAX, a))
    setMark(Math.max(P_MIN, Math.min(P_MAX, Math.round(pressureFor(a)))))
  }

  const markAngle = angleFor(mark)
  const [nx, ny] = polar(angleFor(reduce ? P_STD : display), R - 18)

  // Pre-compute the ticks once.
  const ticks = useMemo(() => {
    const out: { p: number; major: boolean; label?: number }[] = []
    for (let p = P_MIN; p <= P_MAX; p += 5) {
      const major = p % 10 === 0
      out.push({ p, major, label: p % 20 === 0 ? p : undefined })
    }
    return out
  }, [])

  const inHg = (display * HPA_TO_INHG).toFixed(2)
  const trendLabel = Math.abs(trend) < 1 ? 'Steady' : trend > 0 ? 'Rising' : 'Falling'

  return (
    <div className={`mx-auto flex w-full max-w-[400px] flex-col items-center ${className}`}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="h-[300px] w-auto cursor-pointer touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 rounded-full"
          role="slider"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={P_MIN}
          aria-valuemax={P_MAX}
          aria-valuenow={mark}
          aria-valuetext={`Memory hand at ${mark} hectopascals. Needle reads ${display} hectopascals, ${band.word}.`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            const svg = e.currentTarget
            svg.setPointerCapture(e.pointerId)
            markFromPoint(e.clientX, e.clientY, svg)
            const move = (ev: PointerEvent) => markFromPoint(ev.clientX, ev.clientY, svg)
            const up = () => {
              svg.removeEventListener('pointermove', move)
              svg.removeEventListener('pointerup', up)
            }
            svg.addEventListener('pointermove', move)
            svg.addEventListener('pointerup', up)
          }}
        >
          <defs>
            <radialGradient id="bm-face" cx="0.5" cy="0.42" r="0.68">
              <stop offset="0" stopColor="#18222b" />
              <stop offset="0.72" stopColor="#111922" />
              <stop offset="1" stopColor="#0a1016" />
            </radialGradient>
            <radialGradient id="bm-glass" cx="0.38" cy="0.3" r="0.9">
              <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="0.45" stopColor="rgba(255,255,255,0.02)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.08)" />
            </radialGradient>
            <linearGradient id="bm-bezel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>
            <linearGradient id="bm-brass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e4c57a" />
              <stop offset="1" stopColor="#9a7b32" />
            </linearGradient>
          </defs>

          {/* Bezel and face. */}
          <circle cx={C} cy={C} r={R + 14} fill="none" stroke="url(#bm-bezel)" strokeWidth="7" />
          <circle cx={C} cy={C} r={R + 9} fill="url(#bm-face)" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />

          {/* Printed weather bands, arced under the ticks. */}
          {BANDS.map((b) => {
            const a0 = angleFor(b.from) + 1.5
            const a1 = angleFor(b.to) - 1.5
            const [x0, y0] = polar(a0, R - 2)
            const [x1, y1] = polar(a1, R - 2)
            const large = a1 - a0 > 180 ? 1 : 0
            const [mx, my] = polar((a0 + a1) / 2, R - 30)
            return (
              <g key={b.word}>
                <path
                  d={`M ${x0} ${y0} A ${R - 2} ${R - 2} 0 ${large} 1 ${x1} ${y1}`}
                  fill="none"
                  stroke="rgba(220,248,124,0.18)"
                  strokeWidth="2"
                />
                <text
                  x={mx}
                  y={my}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fontWeight="700"
                  letterSpacing="0.5"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fill="rgba(235,240,245,0.5)"
                >
                  {b.word.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* Ticks and numbers. */}
          {ticks.map(({ p, major, label }) => {
            const [x0, y0] = polar(angleFor(p), R)
            const [x1, y1] = polar(angleFor(p), R - (major ? 12 : 7))
            const std = p === 1010 || p === 1020 // keep the standard zone legible
            return (
              <g key={p}>
                <line
                  x1={x0}
                  y1={y0}
                  x2={x1}
                  y2={y1}
                  stroke={std ? 'rgba(220,248,124,0.6)' : major ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.28)'}
                  strokeWidth={major ? 1.6 : 1}
                />
                {label !== undefined && (
                  <text
                    {...(() => {
                      const [lx, ly] = polar(angleFor(p), R - 24)
                      return { x: lx, y: ly }
                    })()}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fill="rgba(235,240,245,0.72)"
                  >
                    {label}
                  </text>
                )}
              </g>
            )
          })}

          {/* The aneroid capsule, breathing in the dial's lower gap — the thing
              that actually drives the needle. */}
          <g>
            <g ref={capsuleRef} transform={`translate(${C} 214) scale(1 1)`}>
              <ellipse cx={0} cy={0} rx={18} ry={9} fill="rgba(140,170,195,0.14)" stroke="rgba(180,205,225,0.3)" strokeWidth="1" />
              <ellipse cx={0} cy={-3} rx={18} ry={9} fill="none" stroke="rgba(180,205,225,0.18)" strokeWidth="0.8" />
              <ellipse cx={0} cy={3} rx={18} ry={9} fill="none" stroke="rgba(180,205,225,0.18)" strokeWidth="0.8" />
            </g>
            <text x={C} y={238} textAnchor="middle" fontSize="6.5" letterSpacing="1" fontFamily="ui-sans-serif, system-ui, sans-serif" fill="rgba(255,255,255,0.3)">
              ANEROID CAPSULE
            </text>
          </g>

          {/* The brass memory hand — the one thing you set. */}
          <g transform={`rotate(${markAngle} ${C} ${C})`}>
            <line x1={C} y1={C} x2={C} y2={C - (R - 4)} stroke="url(#bm-brass)" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx={C} cy={C - (R - 4)} r={4} fill="none" stroke="url(#bm-brass)" strokeWidth="2" />
          </g>

          {/* The live pointer, driven straight from the pressure. */}
          <g ref={needleRef} transform={`rotate(${angleFor(reduce ? P_STD : display)} ${C} ${C})`}>
            <polygon
              points={`${C - 3},${C + 16} ${C + 3},${C + 16} ${C + 1.4},${C - (R - 16)} ${C - 1.4},${C - (R - 16)}`}
              fill="#e8edf2"
            />
            <polygon points={`${C - 1.4},${C - (R - 16)} ${C + 1.4},${C - (R - 16)} ${C},${C - (R - 4)}`} fill="#DCF87C" />
          </g>

          {/* Hub and glass. */}
          <circle cx={C} cy={C} r={9} fill="#0c141b" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
          <circle cx={C} cy={C} r={3.2} fill="rgba(255,255,255,0.65)" />
          <circle cx={C} cy={C} r={R + 9} fill="url(#bm-glass)" pointerEvents="none" />

          {/* The live needle tip's reflection on the ticks, faint. */}
          <circle cx={nx} cy={ny} r={2.4} fill="rgba(220,248,124,0.55)" pointerEvents="none" />
        </svg>
      </div>

      {/* Readout: pressure in two units, the printed word, and the trend vs mark. */}
      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Reads</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold tabular-nums text-[#DCF87C]">{display}</span>
            <span className="text-lg font-semibold text-[#DCF87C]/70">hPa</span>
          </div>
          <div className="mt-0.5 text-xs text-white/45">
            {inHg} inHg · <span className="text-white/70">{band.word}</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Since your mark</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className="font-display text-4xl font-bold tabular-nums"
              style={{ color: trendLabel === 'Steady' ? 'rgba(255,255,255,0.7)' : trendLabel === 'Rising' ? '#9ae6a0' : '#e6a09a' }}
            >
              {trend > 0 ? '+' : trend < 0 ? '−' : '±'}
              {Math.abs(trend)}
            </span>
            <span className="text-lg font-semibold text-white/40">hPa</span>
          </div>
          <div className="mt-0.5 text-xs text-white/45">
            {trendLabel}
            {trendLabel !== 'Steady' && <> toward {trend > 0 ? 'fair' : 'rain'}</>}
          </div>
        </div>
      </div>

      {/* Controls: set the brass hand, and tap the glass. */}
      <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span id={labelId} className="font-semibold uppercase tracking-[0.2em] text-white/50">
            Brass memory hand
          </span>
          <span className="font-mono tabular-nums text-[#e4c57a]">{mark} hPa</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMark(Math.round(display))}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-[#DCF87C]/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
          >
            Set to now
          </button>
          <button
            type="button"
            onClick={tap}
            disabled={!!reduce}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors enabled:hover:border-[#DCF87C]/40 enabled:hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
          >
            Tap the glass
          </button>
        </div>
      </div>
      <p className="mt-3 w-full text-xs leading-relaxed text-white/40">
        Drag the dial or arrow the brass hand to mark the reading, then watch the gap open as the pressure drifts.
        The needle is driven by the breathing capsule, and the two numbers and the printed word all come off its
        angle. No live weather here &mdash; the drift is synthesised, and the words are an old dial&rsquo;s markings,
        not a forecast.
      </p>
    </div>
  )
}

export default Barometer
