import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useReducedMotion } from 'framer-motion'

// ---------------------------------------------------------------------------
// Euclidean rhythms. Given k onsets to place across n steps, the Euclidean
// rhythm E(k,n) is the one that spaces them as evenly as whole steps allow —
// the pattern behind the tresillo (E(3,8) = x..x..x.), the cinquillo, and a
// startling number of the world's bell and clave figures (Toussaint's result).
// The closed form below places an onset on step i exactly when (i·k) mod n < k;
// this is the same distribution Bjorklund's algorithm produces, canonically
// rotated so step 0 is always an onset, and it is pure integer arithmetic with
// no allocation on the hot path.
// ---------------------------------------------------------------------------
function euclid(k: number, n: number): boolean[] {
  const out: boolean[] = new Array(n)
  for (let i = 0; i < n; i++) out[i] = ((i * k) % n) < k
  return out
}

// Rotate a pattern right by `r` steps, wrapping — this walks the same rhythm
// round the circle so its first onset can be aligned to the top of the ring.
function rotate(p: boolean[], r: number): boolean[] {
  const n = p.length
  if (n === 0) return p
  const s = ((r % n) + n) % n
  const out: boolean[] = new Array(n)
  for (let i = 0; i < n; i++) out[i] = p[(i - s + n) % n]
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const MIN_STEPS = 4
const MAX_STEPS = 16
const MIN_BPM = 40
const MAX_BPM = 240

// A named preset is just a starting (pulses, steps, rotation) — the classics,
// so the ring opens on something musical and a tap moves between real figures.
interface Figure {
  label: string
  k: number
  n: number
  r: number
}
const FIGURES: Figure[] = [
  { label: 'Tresillo', k: 3, n: 8, r: 0 },
  { label: 'Cinquillo', k: 5, n: 8, r: 0 },
  { label: 'Son clave', k: 5, n: 16, r: 0 },
  { label: 'Ruchenitza', k: 4, n: 7, r: 0 },
  { label: 'Bembé', k: 7, n: 12, r: 0 },
]

// A tiny WebAudio voice: a short pitched blip so the ring can be heard, not
// only watched. Held behind one lazily-built context and always optional — the
// sequencer is fully usable and legible silent, and nothing here runs until the
// listener asks for sound and the browser has a user gesture to unlock it.
class Click {
  private ctx: AudioContext | null = null

  resume() {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AC) return
      if (!this.ctx) this.ctx = new AC()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch {
      this.ctx = null
    }
  }

  play(accent: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(accent ? 660 : 440, now)
      osc.frequency.exponentialRampToValueAtTime(accent ? 330 : 220, now + 0.05)
      const peak = accent ? 0.16 : 0.1
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.14)
    } catch {
      /* a single missed blip is never worth throwing over */
    }
  }

  close() {
    try {
      void this.ctx?.close()
    } catch {
      /* ignore */
    }
    this.ctx = null
  }
}

/**
 * A Euclidean rhythm sequencer, drawn as a ring. Choose how many onsets (k) to
 * spread across how many steps (n) and the pattern places them as evenly as the
 * grid allows — the maths behind a huge share of the world's traditional
 * rhythms. Press play and a hand sweeps the circle at the set tempo, lighting
 * each onset as it lands; tap any step to bend the figure by hand, spin the
 * rotation to walk it round the ring, and turn on sound to hear it.
 *
 * The transport is a real play/pause button; every step is a labelled toggle
 * carrying aria-pressed; steppers drive k, n, rotation, and tempo from the
 * keyboard; and a polite live region reads the current figure. Under
 * prefers-reduced-motion the hand snaps between steps and the onset flashes
 * come off — the rhythm still plays and every state is still legible, just
 * without the sweep.
 */
export function EuclidRing({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const baseId = useId()

  const [steps, setSteps] = useState(8)
  const [pulses, setPulses] = useState(3)
  const [rot, setRot] = useState(0)
  const [bpm, setBpm] = useState(120)
  const [playing, setPlaying] = useState(false)
  const [sound, setSound] = useState(false)
  const [current, setCurrent] = useState(-1)

  // The live pattern. Seeded from E(pulses, steps) rotated by rot, but editable
  // by hand: tapping a step toggles this array directly, so a figure can be
  // nudged off the pure Euclidean set. Any change to k/n/rotation regenerates
  // it, which is the honest behaviour — those knobs define a fresh figure.
  const [pattern, setPattern] = useState<boolean[]>(() => rotate(euclid(3, 8), 0))
  // Whether the current pattern still equals its generator, so the readout can
  // say "E(3,8)" only while that is actually what is on the ring.
  const generatorRef = useRef(true)
  const [isGenerator, setIsGenerator] = useState(true)

  const regen = useCallback((k: number, n: number, r: number) => {
    setPattern(rotate(euclid(k, n), r))
    generatorRef.current = true
    setIsGenerator(true)
  }, [])

  // ---- Refs the rAF loop reads without re-subscribing --------------------
  const patternRef = useRef(pattern)
  patternRef.current = pattern
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const soundRef = useRef(sound)
  soundRef.current = sound
  const clickRef = useRef<Click | null>(null)

  const onsets = useMemo(() => pattern.reduce((a, b) => a + (b ? 1 : 0), 0), [pattern])

  // ---- The transport clock ------------------------------------------------
  // Each step is a sixteenth note, so tempo reads as it would on any drum
  // machine and a loop of n steps lasts n·(a 16th). Timing runs off one rAF
  // loop accumulating real elapsed time, not the wall clock, so a hidden tab
  // that stalls the loop simply resumes rather than firing a burst of steps.
  const rafRef = useRef<number | null>(null)
  const accRef = useRef(0)
  const lastRef = useRef(0)

  const fire = useCallback((idx: number) => {
    if (soundRef.current) clickRef.current?.play(idx === 0)
  }, [])

  useEffect(() => {
    if (!playing) return
    accRef.current = 0
    lastRef.current = performance.now()
    // Land on the first step immediately so play never begins on silence.
    setCurrent((prev) => {
      const n = stepsRef.current
      const next = prev < 0 || prev >= n ? 0 : (prev + 1) % n
      if (patternRef.current[next]) fire(next)
      return next
    })

    const loop = (now: number) => {
      const stepMs = 60000 / bpmRef.current / 4
      accRef.current += now - lastRef.current
      lastRef.current = now
      if (accRef.current >= stepMs) {
        // Advance one step per crossing; a big stall drops the backlog rather
        // than machine-gunning to catch up.
        accRef.current = accRef.current % stepMs
        setCurrent((prev) => {
          const n = stepsRef.current
          const next = (prev + 1) % n
          if (patternRef.current[next]) fire(next)
          return next
        })
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [playing, fire])

  useEffect(() => () => clickRef.current?.close(), [])

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p
      if (next && soundRef.current) {
        if (!clickRef.current) clickRef.current = new Click()
        clickRef.current.resume()
      }
      if (!next) setCurrent(-1)
      return next
    })
  }, [])

  const toggleSound = useCallback(() => {
    setSound((s) => {
      const next = !s
      if (next) {
        if (!clickRef.current) clickRef.current = new Click()
        clickRef.current.resume()
      }
      return next
    })
  }, [])

  // ---- Editing the figure -------------------------------------------------
  const setStepsClamped = useCallback(
    (n: number) => {
      const nn = clamp(n, MIN_STEPS, MAX_STEPS)
      const kk = clamp(pulses, 0, nn)
      const rr = ((rot % nn) + nn) % nn
      setSteps(nn)
      setPulses(kk)
      setRot(rr)
      regen(kk, nn, rr)
      setCurrent((c) => (c >= nn ? -1 : c))
    },
    [pulses, rot, regen],
  )

  const setPulsesClamped = useCallback(
    (k: number) => {
      const kk = clamp(k, 0, steps)
      setPulses(kk)
      regen(kk, steps, rot)
    },
    [steps, rot, regen],
  )

  const setRotClamped = useCallback(
    (r: number) => {
      const rr = ((r % steps) + steps) % steps
      setRot(rr)
      regen(pulses, steps, rr)
    },
    [pulses, steps, regen],
  )

  const toggleStep = useCallback((i: number) => {
    setPattern((prev) => {
      const next = prev.slice()
      next[i] = !next[i]
      return next
    })
    generatorRef.current = false
    setIsGenerator(false)
  }, [])

  const loadFigure = useCallback(
    (f: Figure) => {
      setSteps(f.n)
      setPulses(f.k)
      setRot(f.r)
      setBpm((b) => b)
      regen(f.k, f.n, f.r)
      setCurrent((c) => (c >= f.n ? -1 : c))
    },
    [regen],
  )

  // ---- Geometry -----------------------------------------------------------
  const SIZE = 240
  const C = SIZE / 2
  const RING = 88
  // Step i sits at angle (i/n) of the circle, measured clockwise from the top,
  // so step 0 is at 12 o'clock and the sweep runs the way a clock does.
  const angleOf = useCallback(
    (i: number) => (i / steps) * Math.PI * 2 - Math.PI / 2,
    [steps],
  )
  const pointOf = useCallback(
    (i: number, radius: number) => {
      const a = angleOf(i)
      return { x: C + Math.cos(a) * radius, y: C + Math.sin(a) * radius }
    },
    [angleOf],
  )

  // The hand's angle in degrees for the rotating transform. When stopped it
  // rests at the top; playing, it points at the current step.
  const handDeg = current < 0 ? 0 : (current / steps) * 360

  const figureName = useMemo(() => {
    if (!isGenerator) return 'Custom'
    const hit = FIGURES.find((f) => f.k === pulses && f.n === steps && f.r === rot)
    return hit ? hit.label : `E(${pulses}, ${steps})`
  }, [isGenerator, pulses, steps, rot])

  const onStepKey = useCallback(
    (e: ReactKeyboardEvent<SVGCircleElement>, i: number) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        toggleStep(i)
      }
    },
    [toggleStep],
  )

  return (
    <div className={`w-full ${className}`}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:items-center">
        {/* -------------------------------------------------- The ring --- */}
        <div className="relative mx-auto w-full max-w-[240px]">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full">
            {/* faint guide ring */}
            <circle
              aria-hidden
              cx={C}
              cy={C}
              r={RING}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            {/* the sweeping hand — rotated about the centre */}
            <g
              aria-hidden
              transform={`rotate(${handDeg} ${C} ${C})`}
              style={{
                transition:
                  reduce || current < 0 ? 'none' : 'transform 90ms linear',
              }}
            >
              <line
                x1={C}
                y1={C}
                x2={C}
                y2={C - RING - 6}
                stroke={current < 0 ? 'rgba(255,255,255,0.14)' : 'rgba(220,248,124,0.55)'}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle
                cx={C}
                cy={C - RING - 6}
                r={current < 0 ? 0 : 3}
                fill="#DCF87C"
              />
            </g>
            {/* the steps */}
            {pattern.map((on, i) => {
              const p = pointOf(i, RING)
              const active = i === current
              const hitNow = active && on
              const r = on ? 8 : 4.5
              return (
                <g key={i}>
                  {on && (
                    <circle
                      aria-hidden
                      cx={p.x}
                      cy={p.y}
                      r={hitNow ? 16 : 12}
                      fill="#DCF87C"
                      opacity={hitNow ? 0.22 : 0.06}
                      style={{
                        transition: reduce ? 'none' : 'r 140ms ease, opacity 140ms ease',
                      }}
                    />
                  )}
                  <circle
                    aria-hidden
                    cx={p.x}
                    cy={p.y}
                    r={hitNow ? r + 2 : r}
                    fill={on ? '#DCF87C' : 'rgba(255,255,255,0.04)'}
                    stroke={on ? 'none' : 'rgba(255,255,255,0.28)'}
                    strokeWidth={1.5}
                    style={{
                      transition: reduce ? 'none' : 'r 120ms ease',
                    }}
                  />
                  {active && !on && (
                    <circle
                      aria-hidden
                      cx={p.x}
                      cy={p.y}
                      r={r + 3}
                      fill="none"
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth={1.5}
                    />
                  )}
                  {/* the interactive hit target — a real toggle for this step */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={14}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-pressed={on}
                    aria-label={`Step ${i + 1}${i === 0 ? ' (downbeat)' : ''}: ${on ? 'onset' : 'rest'}`}
                    onClick={() => toggleStep(i)}
                    onKeyDown={(e) => onStepKey(e, i)}
                    className="cursor-pointer outline-none [&:focus-visible]:stroke-[#DCF87C]"
                    style={{ strokeWidth: 2 }}
                  />
                </g>
              )
            })}
            {/* the centre readout */}
            <text
              aria-hidden
              x={C}
              y={C - 6}
              textAnchor="middle"
              className="font-display"
              fill="#ffffff"
              style={{ fontSize: 34, fontWeight: 600 }}
            >
              {onsets}
            </text>
            <text
              aria-hidden
              x={C}
              y={C + 16}
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
              style={{ fontSize: 12, letterSpacing: 1 }}
            >
              {onsets === 1 ? '1 onset' : `of ${steps}`}
            </text>
          </svg>
        </div>

        {/* ---------------------------------------------- The controls --- */}
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-pressed={playing}
              className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.03] active:scale-95"
            >
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              {playing ? 'Pause' : 'Play'}
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={sound}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                sound
                  ? 'border-[#DCF87C]/50 bg-[#DCF87C]/10 text-[#DCF87C]'
                  : 'border-white/15 text-white/60 hover:text-white'
              }`}
            >
              {sound ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </svg>
              )}
              {sound ? 'Sound on' : 'Sound off'}
            </button>
          </div>

          {/* steppers */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stepper
              id={`${baseId}-pulses`}
              label="Onsets"
              value={pulses}
              min={0}
              max={steps}
              onChange={setPulsesClamped}
            />
            <Stepper
              id={`${baseId}-steps`}
              label="Steps"
              value={steps}
              min={MIN_STEPS}
              max={MAX_STEPS}
              onChange={setStepsClamped}
            />
            <Stepper
              id={`${baseId}-rot`}
              label="Rotation"
              value={rot}
              min={0}
              max={steps - 1}
              onChange={setRotClamped}
            />
            <Stepper
              id={`${baseId}-bpm`}
              label="Tempo"
              value={bpm}
              min={MIN_BPM}
              max={MAX_BPM}
              step={4}
              suffix=" bpm"
              onChange={(v) => setBpm(clamp(v, MIN_BPM, MAX_BPM))}
            />
          </div>

          {/* figures */}
          <div className="mt-4">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Figures
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FIGURES.map((f) => {
                const active = isGenerator && f.k === pulses && f.n === steps && f.r === rot
                return (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => loadFigure(f)}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      active
                        ? 'border-[#DCF87C]/50 bg-[#DCF87C]/10 text-[#DCF87C]'
                        : 'border-white/12 text-white/55 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="mt-4 font-mono text-xs text-white/45" aria-live="polite">
            {figureName} — {onsets} on {steps}, rotated {rot}
          </p>
        </div>
      </div>
    </div>
  )
}

// A compact numeric stepper: a labelled value between two round buttons, also
// arrow-key and Home/End driven when the value itself is focused. Kept local to
// the sequencer — small, honest, and shaped for its four knobs.
function Stepper({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  const dec = () => onChange(value - step)
  const inc = () => onChange(value + step)
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault()
        onChange(value - step)
        break
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault()
        onChange(value + step)
        break
      case 'Home':
        e.preventDefault()
        onChange(min)
        break
      case 'End':
        e.preventDefault()
        onChange(max)
        break
      default:
    }
  }
  return (
    <div>
      <label htmlFor={`${id}-val`} className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <div
          id={`${id}-val`}
          role="spinbutton"
          tabIndex={0}
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={`${value}${suffix}`}
          onKeyDown={onKey}
          className="min-w-[3.25rem] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center font-mono text-sm tabular-nums text-white outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
        >
          {value}
          {suffix}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
