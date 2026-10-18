import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Foucault pendulum, seen from directly above. A bob swings back and forth
// along a line through the centre; left to itself for long enough, that line of
// swing slowly turns — not because anything pushes it, but because the floor
// (the Earth) rotates underneath it. Stand a ring of pegs around the edge and
// the swing knocks them down one opposite pair at a time, so the turning of the
// plane becomes something you can count.
//
// The one honest number here is the rate. A Foucault pendulum's plane rotates a
// full circle in one sidereal day DIVIDED BY the sine of the latitude: fastest
// at the poles (a turn a day), and — the part that surprises people — not at all
// on the equator, where sin is zero and the plane never moves. So latitude is
// the control. It defaults to Berlin's 52.5 degrees, the city this site is made
// from, where the real plane takes about thirty hours to come all the way round.
// The animation speeds that up to seconds so it is watchable, but it keeps the
// sin(latitude) law exactly: slide toward the equator and the precession stalls;
// slide toward the pole and the pegs fall faster.
//
// Nothing is integrated and nothing drifts: the swing is a pure cosine, and how
// far the plane has turned is a single accumulated angle. A peg at bearing a has
// fallen once the plane has swept past a (modulo pi, because the two ends of the
// swing knock opposite pegs together). Under prefers-reduced-motion the loop
// never starts — it paints one still frame with the bob at rest and a faint fan
// of a few later swing lines, so the idea of a turning plane reads at a glance.

const TAU = Math.PI * 2
const C = 220 // centre, in viewBox units (square 440 x 440)
const R_PEG = 186 // radius of the standing peg ring
const R_SWING = 196 // how far the bob travels from centre — just past the pegs
const N_PEGS = 24 // pegs around the full circle (12 opposite pairs)

const SWING_PERIOD = 1.5 // seconds for one full there-and-back swing
const OMEGA_SWING = TAU / SWING_PERIOD

// Precession rate, scaled for watching. Tuned so that at Berlin's latitude the
// plane sweeps the half-turn that fells every peg in about 26 seconds, then
// multiplied by sin(latitude) so the real law holds across the slider.
const LAT_BERLIN = 52.5
const OMEGA_BASE = Math.PI / 26 / Math.sin((LAT_BERLIN * Math.PI) / 180)
const SIDEREAL_HOURS = 23.934 // a sidereal day — the real period's numerator

const PEG_ANGLES = Array.from({ length: N_PEGS }, (_, i) => (i / N_PEGS) * TAU)

// Honest, human description of the real-world precession period at a latitude.
function periodLabel(latDeg: number): string {
  const s = Math.sin((latDeg * Math.PI) / 180)
  if (s < 1e-3) return 'the plane does not turn at all'
  const hours = SIDEREAL_HOURS / s
  if (hours >= 48) return `a full turn takes about ${Math.round(hours / 24)} days`
  return `a full turn takes about ${hours.toFixed(1)} hours`
}

export function Foucault({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const gid = useId()
  const labelId = useId()
  const statusId = useId()

  const [lat, setLat] = useState(LAT_BERLIN)
  const [running, setRunning] = useState(true)
  // phase = the fast swing; sweep = radians the plane has turned so far.
  const [phase, setPhase] = useState(0)
  const [sweep, setSweep] = useState(0)

  const latRef = useRef(lat)
  latRef.current = lat
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef(0)

  // The animation loop: advance the swing always, and turn the plane at
  // omega(lat) = base * sin(lat). Stops once the half-turn has felled every peg.
  useEffect(() => {
    if (!running || reduce) return
    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const dt = Math.min(0.05, (now - lastRef.current) / 1000)
      lastRef.current = now
      setPhase((p) => (p + OMEGA_SWING * dt) % TAU)
      setSweep((s) => {
        const omega = OMEGA_BASE * Math.sin((latRef.current * Math.PI) / 180)
        const ns = s + omega * dt
        if (ns >= Math.PI) {
          setRunning(false)
          return Math.PI // all pegs down; hold
        }
        return ns
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = 0
    }
  }, [running, reduce])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  // The swing axis and the bob position for the current frame.
  const phi = sweep // plane starts horizontal at angle 0, turns clockwise on screen
  const offset = reduce ? R_SWING : R_SWING * Math.cos(phase)
  const bx = C + Math.cos(phi) * offset
  const by = C + Math.sin(phi) * offset
  // Diameter endpoints of the current plane, for the dashed axis line.
  const ax1 = C + Math.cos(phi) * R_SWING
  const ay1 = C + Math.sin(phi) * R_SWING
  const ax2 = C - Math.cos(phi) * R_SWING
  const ay2 = C - Math.sin(phi) * R_SWING

  const fellCount = PEG_ANGLES.filter((a) => sweep >= a % Math.PI).length
  const pct = Math.round((sweep / Math.PI) * 100)

  const nudgeLat = (d: number) => setLat((v) => Math.max(0, Math.min(90, Math.round(v + d))))

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const step = e.shiftKey ? 5 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudgeLat(-step)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudgeLat(step)
    else if (e.key === 'Home') setLat(0)
    else if (e.key === 'End') setLat(90)
    else if (e.key === ' ' || e.key === 'Enter') {
      if (!reduce) {
        setSweep((s) => (s >= Math.PI ? 0 : s))
        setRunning((r) => !r)
      }
    } else handled = false
    if (handled) e.preventDefault()
  }

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={90}
        aria-valuenow={Math.round(lat)}
        aria-valuetext={`Latitude ${Math.round(lat)} degrees; ${periodLabel(lat)}`}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
      >
        <span id={labelId} className="sr-only">
          Foucault pendulum, seen from above. The arrow keys set the latitude from the equator to the pole, which
          changes how fast the swing plane turns; Shift takes larger steps, Home jumps to the equator and End to the
          pole, and Space starts or stops the sweep. The plane turns a full circle in one sidereal day divided by the
          sine of the latitude, so it is fastest at the poles and does not turn at all on the equator.
        </span>

        <svg viewBox="0 0 440 440" className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]" aria-hidden>
          <defs>
            <radialGradient id={`${gid}-bob`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.8" />
            </radialGradient>
            <radialGradient id={`${gid}-floor`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="0.7" stopColor="rgba(255,255,255,0.02)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {/* The floor, and a faint guide circle the pegs stand on. */}
          <circle cx={C} cy={C} r={R_PEG + 18} fill={`url(#${gid}-floor)`} />
          <circle cx={C} cy={C} r={R_PEG} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

          {/* Under reduced motion, a faint fan of later swing lines standing in
              for the turning plane, so the idea reads without any movement. */}
          {reduce &&
            [0.22, 0.44, 0.66, 0.88].map((f, i) => (
              <line
                key={i}
                x1={C + Math.cos(f * Math.PI) * R_SWING}
                y1={C + Math.sin(f * Math.PI) * R_SWING}
                x2={C - Math.cos(f * Math.PI) * R_SWING}
                y2={C - Math.sin(f * Math.PI) * R_SWING}
                stroke="rgba(220,248,124,0.12)"
                strokeWidth={1}
                strokeDasharray="2 7"
              />
            ))}

          {/* The pegs. A peg has fallen once the plane has swept past its bearing
              (mod pi — opposite pegs fall together). Standing pegs point out
              along the radius; fallen ones tip over and dim. */}
          {PEG_ANGLES.map((a, i) => {
            const fallen = !reduce && sweep >= a % Math.PI
            const baseR = R_PEG - 6
            const px = C + Math.cos(a) * baseR
            const py = C + Math.sin(a) * baseR
            const tipR = R_PEG + 8
            const tx = C + Math.cos(a) * tipR
            const ty = C + Math.sin(a) * tipR
            return (
              <g
                key={i}
                style={{
                  transformOrigin: `${px}px ${py}px`,
                  transform: fallen ? 'rotate(70deg)' : 'rotate(0deg)',
                  opacity: fallen ? 0.3 : 1,
                  transition: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.55s ease',
                }}
              >
                <line
                  x1={px}
                  y1={py}
                  x2={tx}
                  y2={ty}
                  stroke={fallen ? 'rgba(255,255,255,0.3)' : 'rgba(220,248,124,0.7)'}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
                <circle cx={px} cy={py} r={2} fill="rgba(255,255,255,0.4)" />
              </g>
            )
          })}

          {/* The current plane of swing — a dashed diameter through the pivot. */}
          <line
            x1={ax1}
            y1={ay1}
            x2={ax2}
            y2={ay2}
            stroke="rgba(220,248,124,0.28)"
            strokeWidth={1}
            strokeDasharray="3 7"
          />

          {/* The pivot, directly above the centre. */}
          <circle cx={C} cy={C} r={4} fill="#0B0B0B" stroke="rgba(255,255,255,0.4)" strokeWidth={1.4} />

          {/* The bob: a lime disc with an additive glow, riding the plane. */}
          <circle cx={bx} cy={by} r={30} fill={`url(#${gid}-bob)`} opacity={0.18} />
          <circle cx={bx} cy={by} r={9} fill={`url(#${gid}-bob)`} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
          <circle cx={bx - 3} cy={by - 3} r={2.6} fill="rgba(255,255,255,0.6)" />
        </svg>
      </div>

      {/* Live readout: latitude, the honest real-world period, and the sweep. */}
      <p id={statusId} aria-live="polite" className="sr-only">
        Latitude {Math.round(lat)} degrees. In the real world, {periodLabel(lat)}. {fellCount} of {N_PEGS} pegs down.
      </p>

      <div className="mt-6 w-full">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
            {Math.round(lat)}&deg; {lat >= LAT_BERLIN - 0.5 && lat <= LAT_BERLIN + 0.5 ? '· Berlin' : ''}
          </span>
          <span className="font-mono text-xs text-white/45">{periodLabel(lat)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={90}
          step={1}
          value={Math.round(lat)}
          onChange={(e) => setLat(Number(e.target.value))}
          aria-label="Latitude, from the equator to the pole"
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#DCF87C]"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          <span>Equator</span>
          <span>Pole</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {reduce ? 'at rest' : `${pct}% turned`}
        </span>
        <button
          type="button"
          onClick={() => {
            if (reduce) return
            setSweep((s) => (s >= Math.PI ? 0 : s))
            setRunning((r) => !r)
          }}
          disabled={!!reduce}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/[0.12] disabled:opacity-40"
        >
          {running ? 'Stop' : sweep >= Math.PI ? 'Again' : 'Start'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false)
            setSweep(0)
            setPhase(0)
          }}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Stand pegs up
        </button>
      </div>
    </div>
  )
}
