import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// An analog VU meter, rebuilt as a working instrument rather than a picture of
// one. The authentic part is the ballistics: a real VU movement is a weighted
// needle on a near-critically-damped spring, so it does not snap to the signal
// — it leans toward it, lags the transients, and settles with the faintest
// overshoot. That lag IS the instrument. Here the needle runs a little
// second-order system (spring + damping, integrated off the frame clock, so it
// keeps its real speed at any refresh rate) chasing a level we SYNTHESISE — a
// drifting base loudness with decaying transients riding on top, so it reads
// like program material, not a mic and not a random walk. Honest about that:
// there is no audio here, the needle is tracking a made-up signal, and the dB
// scale is a relative VU scale, not a measurement of anything real.
//
// The one piece of state you drive is the input gain. The fader is a real
// role=slider: drag it, or focus it and ride it with the arrow keys — push the
// level into the red and the needle pegs and the peak lamp catches it. The dB
// reading is derived straight from the needle position, so the number and the
// needle can never disagree. Under prefers-reduced-motion the movement stops:
// no synthesised programme, no spring — the needle maps straight to the gain
// you set against a steady reference tone, so it is still a live, operable
// meter, just a quiet one.

// --- Geometry (SVG face) ---------------------------------------------------
const VW = 300
const VH = 196
const PX = 150 // needle pivot x
const PY = 182 // needle pivot y (near the bottom edge)
const SR = 150 // scale-arc radius
const NEEDLE_LEN = 150 // needle length from pivot
const A_MIN = -52 // deg from vertical at the left end of the scale
const A_MAX = 52 // deg at the right end

// --- Scale (relative VU dB) ------------------------------------------------
const DB_MIN = -20
const DB_MAX = 3
const span = DB_MAX - DB_MIN
// Fraction [0,1] across the arc for a given dB reading.
const fracForDb = (db: number) => (db - DB_MIN) / span
// The 0 VU mark — where the red overload zone begins.
const FRAC_0 = fracForDb(0)

const rad = (deg: number) => (deg * Math.PI) / 180
const angleForFrac = (f: number) => A_MIN + f * (A_MAX - A_MIN)
// A point on the scale arc at radius rr for fraction f (0 = left, 1 = right).
const arcPt = (f: number, rr: number) => {
  const a = angleForFrac(f)
  return { x: PX + rr * Math.sin(rad(a)), y: PY - rr * Math.cos(rad(a)) }
}

// Ticks down the scale. `big` ones carry a number.
const TICKS: { db: number; label?: string }[] = [
  { db: -20, label: '-20' },
  { db: -10, label: '-10' },
  { db: -7 },
  { db: -5, label: '-5' },
  { db: -3, label: '-3' },
  { db: -1 },
  { db: 0, label: '0' },
  { db: 1 },
  { db: 2 },
  { db: 3, label: '+3' },
]

// --- Synthesised programme -------------------------------------------------
// Linear amplitude in roughly [0.03, 1] that reads like music: a slow drifting
// base loudness with a few decaying transients (plucks) layered on top. Pure
// function of time in seconds, so it is deterministic and framerate-free.
function programAmp(t: number): number {
  const base = 0.55 + 0.18 * Math.sin(t * 0.6) + 0.1 * Math.sin(t * 0.27 + 1.3)
  const trans =
    0.5 * Math.exp(-(t % 0.9) * 6) +
    0.35 * Math.exp(-((t + 0.3) % 1.3) * 5) +
    0.25 * Math.exp(-((t + 0.7) % 0.55) * 9)
  const a = base * (0.5 + 0.7 * trans)
  return Math.min(1, Math.max(0.03, a))
}

// Gain fader range, in dB.
const GAIN_MIN = -20
const GAIN_MAX = 12
const GAIN_STEP = 1

export function VuMeter({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [gain, setGain] = useState(0) // dB applied to the programme
  const [running, setRunning] = useState(true)
  const [peaked, setPeaked] = useState(false) // sticky peak indicator (user-resettable)

  const needleRef = useRef<SVGGElement>(null)
  const lampRef = useRef<SVGCircleElement>(null)
  const readRef = useRef<HTMLSpanElement>(null)
  const gainRef = useRef(gain)
  gainRef.current = gain

  // Needle state lives in refs — it updates every frame and must never trigger
  // a React render. pos/vel are the second-order movement; pos is a fraction
  // across the scale.
  const pos = useRef(FRAC_0 * 0.5)
  const vel = useRef(0)
  const peakHold = useRef(0) // timestamp the lamp stays lit until

  // Write the needle + lamp + readout for a given scale fraction.
  const paint = useCallback((f: number, now: number) => {
    const clamped = Math.max(0, Math.min(1, f))
    const deg = angleForFrac(clamped)
    needleRef.current?.setAttribute('transform', `rotate(${deg.toFixed(2)} ${PX} ${PY})`)
    // The reading in dB comes straight back off the needle fraction, so the
    // number and the needle are the same quantity.
    const db = DB_MIN + clamped * span
    if (readRef.current) {
      readRef.current.textContent = `${db >= 0 ? '+' : ''}${db.toFixed(1)}`
    }
    const over = clamped >= FRAC_0
    if (over) peakHold.current = now + 700
    const lit = now < peakHold.current
    if (lampRef.current) lampRef.current.setAttribute('opacity', lit ? '1' : '0.18')
  }, [])

  // Reduced motion / paused: no loop. Map the needle straight to the gain the
  // user has set, applied to a steady reference tone, so it is still live.
  useEffect(() => {
    if (!reduce && running) return
    const refAmp = 0.6 // a steady -4.4 dBu-ish reference programme
    const db = Math.max(DB_MIN, Math.min(DB_MAX, 20 * Math.log10(refAmp) + gain))
    const f = fracForDb(db)
    pos.current = f
    vel.current = 0
    if (f >= FRAC_0) setPeaked(true)
    paint(f, performance.now())
  }, [reduce, running, gain, paint])

  // The live movement: integrate the needle toward the synthesised level.
  useEffect(() => {
    if (reduce || !running) return
    let raf = 0
    let last = performance.now()
    const STIFFNESS = 150 // spring constant — how hard the needle is pulled
    const DAMPING = 23 // ~critically damped, a hair of overshoot like a real VU
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!document.hidden) {
        const t = now / 1000
        const amp = programAmp(t)
        const db = 20 * Math.log10(amp) + gainRef.current
        const target = Math.max(0, Math.min(1.04, fracForDb(db)))
        // Second-order approach — the needle has mass, so it leans and settles.
        const accel = STIFFNESS * (target - pos.current) - DAMPING * vel.current
        vel.current += accel * dt
        pos.current += vel.current * dt
        if (pos.current < 0) {
          pos.current = 0
          vel.current = 0
        }
        if (pos.current >= FRAC_0) setPeaked(true)
        paint(pos.current, now)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduce, running, paint])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = gain
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = gain + GAIN_STEP
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = gain - GAIN_STEP
    else if (e.key === 'PageUp') next = gain + 5
    else if (e.key === 'PageDown') next = gain - 5
    else if (e.key === 'Home') next = GAIN_MIN
    else if (e.key === 'End') next = GAIN_MAX
    else return
    e.preventDefault()
    setGain(Math.max(GAIN_MIN, Math.min(GAIN_MAX, next)))
  }

  const gainPct = ((gain - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * 100

  return (
    <div className={`mx-auto flex w-full max-w-[420px] flex-col items-center ${className}`}>
      <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a1a12] to-black/60 px-5 pt-5 pb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        {/* The meter face */}
        <div className="relative rounded-xl bg-gradient-to-b from-[#f4f0dd] to-[#d9d4bd] px-3 pt-3 pb-1 shadow-[inset_0_0_18px_rgba(0,0,0,0.25)]">
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="w-full"
            role="img"
            aria-label={`VU meter reading relative level. Input gain ${gain >= 0 ? '+' : ''}${gain} decibels.`}
          >
            <defs>
              <linearGradient id="vu-needle" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#1a1a1a" />
                <stop offset="1" stopColor="#2b2b2b" />
              </linearGradient>
              <radialGradient id="vu-hub" cx="0.5" cy="0.4" r="0.6">
                <stop offset="0" stopColor="#5a5a52" />
                <stop offset="1" stopColor="#15150f" />
              </radialGradient>
            </defs>

            {/* The black lower (nominal) portion of the scale arc. */}
            <path
              d={`M ${arcPt(0, SR).x} ${arcPt(0, SR).y} A ${SR} ${SR} 0 0 1 ${arcPt(FRAC_0, SR).x} ${arcPt(FRAC_0, SR).y}`}
              fill="none"
              stroke="#1c1c18"
              strokeWidth="2.5"
            />
            {/* The red overload arc, from 0 VU to the top of the scale. */}
            <path
              d={`M ${arcPt(FRAC_0, SR).x} ${arcPt(FRAC_0, SR).y} A ${SR} ${SR} 0 0 1 ${arcPt(1, SR).x} ${arcPt(1, SR).y}`}
              fill="none"
              stroke="#c0392b"
              strokeWidth="3"
            />

            {/* Ticks and numbers. */}
            {TICKS.map(({ db, label }) => {
              const f = fracForDb(db)
              const outer = arcPt(f, SR)
              const inner = arcPt(f, SR - (label ? 13 : 8))
              const red = db >= 0
              const txt = arcPt(f, SR - 26)
              return (
                <g key={db}>
                  <line
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={red ? '#c0392b' : '#1c1c18'}
                    strokeWidth={label ? 2 : 1.2}
                  />
                  {label && (
                    <text
                      x={txt.x}
                      y={txt.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill={red ? '#c0392b' : '#1c1c18'}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                    >
                      {label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* VU wordmark, the way the real meters carry it. */}
            <text
              x={PX}
              y={PY - 52}
              textAnchor="middle"
              fontSize="17"
              fontWeight="800"
              letterSpacing="3"
              fill="#1c1c18"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              VU
            </text>
            <text
              x={PX}
              y={PY - 36}
              textAnchor="middle"
              fontSize="7.5"
              letterSpacing="1.5"
              fill="#6b6650"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              SYNTHESISED SIGNAL
            </text>

            {/* The peak lamp, lit when the needle is in the red. */}
            <circle cx={PX + 92} cy={PY - 2} r="5.5" fill="#c0392b" opacity="0.18" ref={lampRef} />
            <text
              x={PX + 92}
              y={PY + 13}
              textAnchor="middle"
              fontSize="7"
              fontWeight="700"
              letterSpacing="1"
              fill="#8a3326"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              PEAK
            </text>

            {/* The needle — a weighted pointer on its pivot. Rotated each frame
                via the ref; the resting transform here keeps SSR/no-JS sane. */}
            <g ref={needleRef} transform={`rotate(${angleForFrac(pos.current).toFixed(2)} ${PX} ${PY})`}>
              <line
                x1={PX}
                y1={PY}
                x2={PX}
                y2={PY - NEEDLE_LEN}
                stroke="url(#vu-needle)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* A small counterweight below the pivot, as a real movement has. */}
              <line x1={PX} y1={PY} x2={PX} y2={PY + 9} stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
            </g>
            <circle cx={PX} cy={PY} r="8" fill="url(#vu-hub)" stroke="#000" strokeWidth="0.6" />
          </svg>
        </div>

        {/* Digital readout + peak reset */}
        <div className="mt-3 flex items-center justify-between">
          <div className="rounded-md border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-3 py-1 font-mono text-sm tabular-nums text-[#DCF87C]">
            <span ref={readRef}>{(DB_MIN + pos.current * span).toFixed(1)}</span>
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-[#DCF87C]/70">VU</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setPeaked(false)
              peakHold.current = 0
              if (lampRef.current) lampRef.current.setAttribute('opacity', '0.18')
            }}
            className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
              peaked
                ? 'border-[#c0392b]/50 bg-[#c0392b]/15 text-[#e08a7e] hover:bg-[#c0392b]/25'
                : 'border-white/10 text-white/35'
            }`}
            aria-label="Reset the peak indicator"
          >
            {peaked ? 'Clipped — reset' : 'No clip'}
          </button>
        </div>
      </div>

      {/* The one control: input gain. A real fader. */}
      <div className="mt-5 w-full">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span id={labelId} className="font-semibold uppercase tracking-[0.2em] text-white/50">
            Input gain
          </span>
          <span className="font-mono tabular-nums text-white/70">
            {gain >= 0 ? '+' : ''}
            {gain} dB
          </span>
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={GAIN_MIN}
          aria-valuemax={GAIN_MAX}
          aria-valuenow={gain}
          aria-valuetext={`${gain >= 0 ? '+' : ''}${gain} decibels`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            const track = e.currentTarget
            track.setPointerCapture(e.pointerId)
            const apply = (clientX: number) => {
              const r = track.getBoundingClientRect()
              const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
              setGain(Math.round(GAIN_MIN + pct * (GAIN_MAX - GAIN_MIN)))
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
          {/* The fill up to 0 dB in lime, past it in red — the fader warns you. */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${gainPct}%`,
              background: gain > 0 ? 'linear-gradient(90deg,#DCF87C,#c0392b)' : '#DCF87C',
              opacity: 0.22,
            }}
          />
          {/* 0 dB unity mark. */}
          <div
            className="absolute inset-y-1 w-px bg-white/25"
            style={{ left: `${((0 - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * 100}%` }}
          />
          {/* The cap. */}
          <div
            className="absolute top-1/2 h-7 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/20 bg-gradient-to-b from-white/90 to-white/50 shadow"
            style={{ left: `${gainPct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-white/40">
            Drag the fader or arrow it. Past the unity mark the signal runs hot and the needle pegs.
          </p>
          {!reduce && (
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="ml-3 shrink-0 rounded-md border border-white/10 px-3 py-1 text-xs font-semibold text-white/60 transition-colors hover:bg-white/5"
              aria-pressed={!running}
            >
              {running ? 'Hold' : 'Run'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VuMeter
