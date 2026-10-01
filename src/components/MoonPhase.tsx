import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A moon phase instrument: the Moon drawn as it stands tonight, with its lit
// limb and dark terminator in the right place, and a scrub that walks the whole
// synodic month under your hand. It is the small sibling of the Orrery — where
// that reads one day-count six ways around the Sun, this reads one age-in-the-
// month a single way, as the sliver of Moon the Sun happens to light.
//
// The single source of truth is `age` — days elapsed in the current lunation,
// a float in [0, SYNODIC). Everything else is derived from it: the illuminated
// fraction k = (1 - cos(2π·age/SYNODIC)) / 2, the phase name, and the shape of
// the terminator (a half-ellipse whose horizontal radius is R·cos of that same
// angle). Live mode just keeps writing the real age into it; scrubbing and the
// keyboard write it directly. Nothing on screen can drift from the age, because
// there is nothing else to drift from.
//
// Honesty, stated plainly: this is a *mean* synodic month measured from a known
// new moon in 2000, not an ephemeris, so over years it can sit a few hours off
// a real almanac; the illuminated fraction is the geocentric one (no libration,
// no parallax, no distance); and the Moon is drawn Northern-hemisphere up, lit
// limb on the right as it waxes. And the disc is cream, never lime — a lime Moon
// would not be a Moon.

const SYNODIC = 29.530588853 // mean synodic month, days
// A known new moon: 2000-01-06 18:14 UTC. The anchor the age is measured from.
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14)

const VIEW = 240
const CX = VIEW / 2
const CY = VIEW / 2
const R = 92 // drawn Moon radius

const TAU = Math.PI * 2
const wrap = (a: number) => ((a % SYNODIC) + SYNODIC) % SYNODIC
const phaseFrac = (age: number) => wrap(age) / SYNODIC // 0..1

// Age-in-days of the Moon right now, from the shared epoch.
function liveAge(at = Date.now()): number {
  return wrap((at - NEW_MOON_EPOCH) / 86_400_000)
}

// Illuminated fraction of the disc, 0 (new) .. 1 (full).
const illuminated = (age: number) => (1 - Math.cos(TAU * phaseFrac(age))) / 2

// The eight classical names, with a small window around the four exact beats.
function phaseName(age: number): string {
  const p = phaseFrac(age)
  if (p < 0.02 || p > 0.98) return 'New moon'
  if (p < 0.23) return 'Waxing crescent'
  if (p < 0.27) return 'First quarter'
  if (p < 0.48) return 'Waxing gibbous'
  if (p < 0.52) return 'Full moon'
  if (p < 0.73) return 'Waning gibbous'
  if (p < 0.77) return 'Last quarter'
  return 'Waning crescent'
}

// SVG path of the lit region for a *waxing* phase (lit limb on the right),
// pp in [0, 0.5]. The bright limb is a semicircle; the terminator a half-ellipse
// whose horizontal radius is R·cos(2π·pp) — positive bulges right (crescent),
// negative bulges left (gibbous), zero is the straight quarter line. Waning is
// this same shape mirrored about the vertical, drawn by the caller.
function litPath(pp: number): string {
  const rx = Math.cos(TAU * pp) * R
  const sweep = rx > 0 ? 1 : 0
  return (
    `M ${CX} ${CY - R} ` +
    `A ${R} ${R} 0 0 1 ${CX} ${CY + R} ` +
    `A ${Math.abs(rx).toFixed(3)} ${R} 0 0 ${sweep} ${CX} ${CY - R} Z`
  )
}

// Maria, placed illustratively (not a selenographic map) to give the lit face
// some texture rather than reading as a flat coin. Clipped to the lit region.
const MARIA = [
  { x: -26, y: -30, r: 20 },
  { x: 14, y: -18, r: 15 },
  { x: -8, y: 14, r: 24 },
  { x: 34, y: 26, r: 13 },
  { x: -34, y: 36, r: 11 },
  { x: 24, y: -40, r: 9 },
]

const fmt1 = (n: number) => n.toFixed(1)

export function MoonPhase({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const clipId = useId()
  const litGradId = useId()
  const glowId = useId()

  const [age, setAge] = useState(() => liveAge())
  const [live, setLive] = useState(true)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastX = useRef(0)

  // Live mode re-reads the real clock. The Moon moves slowly, so a half-minute
  // tick is plenty and keeps the component idle the rest of the time.
  useEffect(() => {
    if (!live) return
    setAge(liveAge())
    const id = window.setInterval(() => setAge(liveAge()), 30_000)
    return () => window.clearInterval(id)
  }, [live])

  // Drag horizontally to scrub the month: the full width of the disc area is one
  // lunation, so a sweep across walks new → full → new.
  const scrubBy = useCallback((clientDx: number, width: number) => {
    setLive(false)
    setAge((a) => wrap(a + (clientDx / width) * SYNODIC))
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    dragging.current = true
    lastX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const w = svgRef.current?.getBoundingClientRect().width ?? VIEW
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

  const step = useCallback((days: number) => {
    setLive(false)
    setAge((a) => wrap(a + days))
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 0.1 : 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(s)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-s)
    else if (e.key === 'PageUp') step(SYNODIC / 4) // jump a quarter
    else if (e.key === 'PageDown') step(-SYNODIC / 4)
    else if (e.key === 'Home') {
      setLive(false)
      setAge(0) // new moon
    } else if (e.key === 'End') {
      setLive(false)
      setAge(SYNODIC / 2) // full moon
    } else if (e.key === ' ' || e.key === 'Enter') {
      setLive((v) => !v)
      if (!live) setAge(liveAge())
    } else handled = false
    if (handled) e.preventDefault()
  }

  const p = phaseFrac(age)
  const waning = p > 0.5
  const pp = waning ? 1 - p : p
  const k = illuminated(age)
  const name = phaseName(age)
  const ageDays = wrap(age)
  // Days until the next full and next new moon, from the age alone.
  const toFull = wrap(SYNODIC / 2 - age)
  const toNew = wrap(SYNODIC - age)

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={Math.round(SYNODIC)}
        aria-valuenow={Math.round(ageDays)}
        aria-valuetext={`${name}, ${Math.round(k * 100)} percent lit, ${fmt1(ageDays)} days into the month`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full max-w-[320px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          The Moon tonight. Drag left or right to scrub through the lunar month. Arrow keys step a day, Shift a tenth of
          a day, Page Up and Page Down a quarter month, Home jumps to the new moon, End to the full moon, Space returns
          to tonight.
        </span>
        <svg ref={svgRef} viewBox={`0 0 ${VIEW} ${VIEW}`} className="h-auto w-full" aria-hidden>
          <defs>
            <radialGradient id={litGradId} cx="0.38" cy="0.34" r="0.85">
              <stop offset="0" stopColor="#f6f3ea" />
              <stop offset="0.6" stopColor="#ded8c6" />
              <stop offset="1" stopColor="#b8b19c" />
            </radialGradient>
            <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(246,243,234,0.42)" />
              <stop offset="0.55" stopColor="rgba(246,243,234,0.12)" />
              <stop offset="1" stopColor="rgba(246,243,234,0)" />
            </radialGradient>
            <clipPath id={clipId}>
              {waning ? (
                <path d={litPath(pp)} transform={`translate(${2 * CX} 0) scale(-1 1)`} />
              ) : (
                <path d={litPath(pp)} />
              )}
            </clipPath>
          </defs>

          {/* A few faint stars, well clear of the disc. */}
          {[
            [30, 44],
            [206, 36],
            [196, 150],
            [40, 196],
            [120, 18],
            [222, 206],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 2 ? 1.1 : 0.8} fill="rgba(255,255,255,0.5)" />
          ))}

          {/* Soft halo of moonlight, breathing gently unless motion is reduced. */}
          <motion.circle
            cx={CX}
            cy={CY}
            r={R + 26}
            fill={`url(#${glowId})`}
            style={{ opacity: 0.25 + k * 0.6 }}
            animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
            transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* The dark disc — the whole Moon, in earthshine shadow. */}
          <circle cx={CX} cy={CY} r={R} fill="#15171c" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          {/* A whisper of earthshine so the dark limb is not pure void. */}
          <circle cx={CX} cy={CY} r={R} fill="rgba(120,130,150,0.05)" />

          {/* The lit face. */}
          {waning ? (
            <path d={litPath(pp)} transform={`translate(${2 * CX} 0) scale(-1 1)`} fill={`url(#${litGradId})`} />
          ) : (
            <path d={litPath(pp)} fill={`url(#${litGradId})`} />
          )}

          {/* Maria, only where the Sun lights them. */}
          <g clipPath={`url(#${clipId})`}>
            {MARIA.map((m, i) => (
              <circle key={i} cx={CX + m.x} cy={CY + m.y} r={m.r} fill="rgba(120,116,102,0.32)" />
            ))}
          </g>

          {/* The rim, drawn last so it reads as a single sphere. */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </svg>
      </div>

      {/* Readout + controls. */}
      <div className="mt-6 w-full max-w-[320px]">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-display text-xl font-semibold text-white/90">{name}</h4>
          <span className="font-display text-xl font-semibold tabular-nums text-[#DCF87C]">{Math.round(k * 100)}%</span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Day of month', value: fmt1(ageDays) },
            { label: 'To full', value: `${fmt1(toFull)}d` },
            { label: 'To new', value: `${fmt1(toNew)}d` },
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
              setAge(liveAge())
            }}
            aria-pressed={live}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              live
                ? 'border-[#DCF87C]/60 bg-[#DCF87C]/15 text-[#DCF87C]'
                : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/80'
            }`}
          >
            Tonight
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white/80"
          >
            &minus;1 day
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white/80"
          >
            +1 day
          </button>
        </div>
      </div>
    </div>
  )
}
