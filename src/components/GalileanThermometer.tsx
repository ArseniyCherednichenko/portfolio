import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// A Galilean thermometer, rebuilt as a working instrument rather than a picture
// of one. The physics is the real thing: a sealed cylinder of clear liquid whose
// density FALLS as it warms, and a handful of sealed glass spheres, each weighted
// by its little tag to a slightly different fixed density. A sphere rises while
// the liquid around it is denser than the sphere, and sinks once the warming
// liquid drops below the sphere's own density — so each tag is the temperature at
// which that sphere is neutrally buoyant, the one real calibration a Galilean
// thermometer carries. Warm the liquid and the densest spheres give up and sink
// one by one; cool it and they rise back. You never read a number off a scale:
// the temperature is the tag on the LOWEST sphere still floating, derived here
// from exactly that rule, so the reading and the spheres can never disagree.
//
// The one thing you drive is the ambient temperature, on a real role=slider —
// drag it or ride it with the arrow keys. Honest about what it is: there is no
// heat and no fluid here, the float/sink decision is the calibration above
// (tag > ambient floats) and the bob is a stand-in for a liquid that is never
// quite still. Under prefers-reduced-motion the spheres settle straight to their
// stacks with no bob and no travel spring — still a live, readable instrument,
// just a calm one.

// --- Geometry (SVG) --------------------------------------------------------
const VW = 220
const VH = 404
const CX = 110 // cylinder centre line
const INNER_TOP = 46 // top of the liquid column
const INNER_BOTTOM = 346 // bottom of the liquid column
const R = 21 // sphere radius
const PITCH = 48 // centre-to-centre spacing when spheres stack

// The spheres, by the temperature (°C) each is tagged with — its neutral point.
const TAGS = [18, 20, 22, 24, 26, 28] as const

// Ambient-temperature control range.
const TEMP_MIN = 16
const TEMP_MAX = 30
const TEMP_STEP = 0.5

type Targets = Record<number, number>

// Given an ambient temperature, the resting y for every sphere: the floaters
// (tag warmer than ambient) stack down from the top in descending order, the
// sinkers rest on the floor in the same order, and the gap between the two packs
// is where the reading lives. Pure geometry from the one calibration rule.
function targetsFor(temp: number): Targets {
  const floaters = TAGS.filter((t) => t > temp).sort((a, b) => b - a)
  const sinkers = TAGS.filter((t) => t <= temp).sort((a, b) => b - a)
  const map: Targets = {}
  floaters.forEach((tag, i) => {
    map[tag] = INNER_TOP + R + i * PITCH
  })
  const n = sinkers.length
  sinkers.forEach((tag, i) => {
    map[tag] = INNER_BOTTOM - R - (n - 1 - i) * PITCH
  })
  return map
}

// The reading: the tag on the lowest floating sphere, or null when every sphere
// has sunk (ambient warmer than the warmest tag).
function readingFor(temp: number): number | null {
  const floaters = TAGS.filter((t) => t > temp)
  return floaters.length ? Math.min(...floaters) : null
}

interface Sphere {
  tag: number
  y: number // current centre y
  vy: number // vertical velocity (travel spring)
  phase: number // bob phase offset
  freq: number // bob frequency
}

export function GalileanThermometer({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [temp, setTemp] = useState(23)
  const tempRef = useRef(temp)
  tempRef.current = temp

  const reading = useMemo(() => readingFor(temp), [temp])

  // Refs to every sphere group so the loop can move them without a React render.
  const groupRefs = useRef<(SVGGElement | null)[]>([])
  const spheres = useRef<Sphere[]>(
    TAGS.map((tag, i) => {
      const t0 = targetsFor(23)[tag]
      return { tag, y: t0, vy: 0, phase: i * 1.7, freq: 0.7 + i * 0.06 }
    }),
  )

  const paint = useCallback(() => {
    spheres.current.forEach((s, i) => {
      groupRefs.current[i]?.setAttribute('transform', `translate(${CX} ${s.y.toFixed(2)})`)
    })
  }, [])

  // Reduced motion / no loop: drop every sphere straight onto its stack.
  useEffect(() => {
    if (!reduce) return
    const tgt = targetsFor(temp)
    spheres.current.forEach((s) => {
      s.y = tgt[s.tag]
      s.vy = 0
    })
    paint()
  }, [reduce, temp, paint])

  // The live movement: a critically damped travel spring toward each sphere's
  // stack position, plus a small bob on the floaters for a liquid never at rest.
  useEffect(() => {
    if (reduce) return
    let raf = 0
    let last = performance.now()
    const STIFF = 90
    const DAMP = 18 // ~2*sqrt(STIFF): a touch under critical, settles clean
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!document.hidden) {
        const t = now / 1000
        const tgt = targetsFor(tempRef.current)
        for (const s of spheres.current) {
          const floating = s.tag > tempRef.current
          const bob = floating ? Math.sin(t * s.freq + s.phase) * 2.6 : 0
          const target = tgt[s.tag] + bob
          const accel = STIFF * (target - s.y) - DAMP * s.vy
          s.vy += accel * dt
          s.y += s.vy * dt
        }
        paint()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduce, paint])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = temp
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = temp + TEMP_STEP
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = temp - TEMP_STEP
    else if (e.key === 'PageUp') next = temp + 2
    else if (e.key === 'PageDown') next = temp - 2
    else if (e.key === 'Home') next = TEMP_MIN
    else if (e.key === 'End') next = TEMP_MAX
    else return
    e.preventDefault()
    setTemp(Math.max(TEMP_MIN, Math.min(TEMP_MAX, Math.round(next / TEMP_STEP) * TEMP_STEP)))
  }

  const tempPct = ((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100
  const initial = targetsFor(23)

  return (
    <div className={`mx-auto flex w-full max-w-[380px] flex-col items-center ${className}`}>
      <div className="flex w-full items-stretch gap-6">
        {/* The instrument */}
        <div className="relative shrink-0">
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="h-[340px] w-auto"
            role="img"
            aria-label={`Galilean thermometer. Ambient temperature ${temp} degrees Celsius; reads ${
              reading !== null ? `${reading} degrees` : 'above the warmest sphere'
            }.`}
          >
            <defs>
              <linearGradient id="gt-liquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1a2630" />
                <stop offset="1" stopColor="#0d141b" />
              </linearGradient>
              <linearGradient id="gt-glass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
                <stop offset="0.5" stopColor="rgba(255,255,255,0.03)" />
                <stop offset="1" stopColor="rgba(255,255,255,0.14)" />
              </linearGradient>
              <radialGradient id="gt-orb" cx="0.38" cy="0.32" r="0.75">
                <stop offset="0" stopColor="rgba(205,226,240,0.42)" />
                <stop offset="0.55" stopColor="rgba(120,150,172,0.16)" />
                <stop offset="1" stopColor="rgba(70,92,110,0.10)" />
              </radialGradient>
            </defs>

            {/* Glass cylinder body with a rounded finial and a base. */}
            <path
              d={`M ${CX - 3} 14 Q ${CX} 6 ${CX + 3} 14 L ${CX + 3} 26`}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2"
            />
            <rect x={CX - 40} y={28} width={80} height={VH - 54} rx={40} fill="url(#gt-liquid)" />

            {/* The liquid column, clipped to the glass, with a faint meniscus. */}
            <clipPath id="gt-clip">
              <rect x={CX - 36} y={INNER_TOP - 8} width={72} height={INNER_BOTTOM - INNER_TOP + 14} rx={30} />
            </clipPath>
            <g clipPath="url(#gt-clip)">
              <ellipse cx={CX} cy={INNER_TOP - 2} rx={34} ry={5} fill="rgba(120,160,185,0.18)" />

              {/* The spheres. Rendered at rest; the loop translates each group. */}
              {TAGS.map((tag, i) => {
                const isReading = reading === tag
                return (
                  <g
                    key={tag}
                    ref={(el) => {
                      groupRefs.current[i] = el
                    }}
                    transform={`translate(${CX} ${initial[tag]})`}
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={R}
                      fill="url(#gt-orb)"
                      stroke={isReading ? 'rgba(220,248,124,0.55)' : 'rgba(205,226,240,0.28)'}
                      strokeWidth={isReading ? 1.6 : 1}
                    />
                    {/* Specular highlight. */}
                    <ellipse cx={-7} cy={-9} rx={5.5} ry={3.5} fill="rgba(255,255,255,0.5)" />
                    {/* The engraved tag that hangs under the orb. */}
                    <g transform={`translate(0 ${R - 3})`}>
                      <rect
                        x={-11}
                        y={-7}
                        width={22}
                        height={14}
                        rx={3}
                        fill={isReading ? 'rgba(220,248,124,0.16)' : 'rgba(255,255,255,0.08)'}
                        stroke={isReading ? 'rgba(220,248,124,0.6)' : 'rgba(255,255,255,0.18)'}
                        strokeWidth="0.8"
                      />
                      <text
                        x={0}
                        y={0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="8.5"
                        fontWeight="700"
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        fill={isReading ? '#DCF87C' : 'rgba(235,240,245,0.7)'}
                      >
                        {tag}
                      </text>
                    </g>
                  </g>
                )
              })}
            </g>

            {/* Glass front: specular stripe and outline, over the liquid. */}
            <rect
              x={CX - 40}
              y={28}
              width={80}
              height={VH - 54}
              rx={40}
              fill="url(#gt-glass)"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.5"
              pointerEvents="none"
            />
            <rect x={CX - 28} y={44} width={7} height={VH - 92} rx={3.5} fill="rgba(255,255,255,0.14)" pointerEvents="none" />
            {/* Base. */}
            <rect x={CX - 26} y={VH - 20} width={52} height={14} rx={4} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          </svg>
        </div>

        {/* Readout + the reading rule, stated plainly. */}
        <div className="flex flex-1 flex-col justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Reads</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-5xl font-bold tabular-nums text-[#DCF87C]">
              {reading !== null ? reading : '—'}
            </span>
            <span className="text-2xl font-semibold text-[#DCF87C]/70">°C</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            {reading !== null ? (
              <>
                The lowest sphere still floating is tagged <span className="text-white/70">{reading}°</span> — that is
                the temperature. Warm the liquid and it will sink next.
              </>
            ) : (
              <>Every sphere has sunk: the liquid is warmer than the 28° sphere, the warmest it carries.</>
            )}
          </p>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="uppercase tracking-wider text-white/40">Floating</span>
              <span className="font-mono tabular-nums text-white/70">
                {TAGS.filter((t) => t > temp).length} / {TAGS.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* The one control: ambient temperature. A real fader. */}
      <div className="mt-6 w-full">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span id={labelId} className="font-semibold uppercase tracking-[0.2em] text-white/50">
            Ambient temperature
          </span>
          <span className="font-mono tabular-nums text-white/70">{temp.toFixed(1)} °C</span>
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={TEMP_MIN}
          aria-valuemax={TEMP_MAX}
          aria-valuenow={temp}
          aria-valuetext={`${temp} degrees Celsius`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            const track = e.currentTarget
            track.setPointerCapture(e.pointerId)
            const apply = (clientX: number) => {
              const r = track.getBoundingClientRect()
              const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
              const raw = TEMP_MIN + pct * (TEMP_MAX - TEMP_MIN)
              setTemp(Math.round(raw / TEMP_STEP) * TEMP_STEP)
            }
            apply(e.clientX)
            const move = (ev: PointerEvent) => apply(ev.clientX)
            const up = () => {
              track.removeEventListener('pointermove', move)
              track.removeEventListener('pointerup', up)
            }
            track.addEventListener('pointermove', move)
            track.addEventListener('pointerup', up)
          }}
          className="relative h-9 cursor-pointer touch-none select-none rounded-full border border-white/10 bg-white/[0.04] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        >
          {/* Cool (left) to warm (right) fill, so the fader reads as a temperature. */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${tempPct}%`,
              background: 'linear-gradient(90deg,#4a7fa5,#DCF87C)',
              opacity: 0.22,
            }}
          />
          <div
            className="absolute top-1/2 h-7 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/20 bg-gradient-to-b from-white/90 to-white/50 shadow"
            style={{ left: `${tempPct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-white/40">
          Drag or arrow the fader. As the liquid warms it thins, and the densest spheres sink one by one — the
          reading is always the lowest one left afloat.
        </p>
      </div>
    </div>
  )
}

export default GalileanThermometer
