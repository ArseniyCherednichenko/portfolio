import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A mechanical metronome — the pyramid-bodied instrument, not a rhythm grid.
// Where the Euclidean ring beside it *composes* a pattern and sweeps a hand,
// this one does the one thing the wooden original does: keep a steady beat, set
// by a weight you slide up and down an inverted pendulum. Higher weight, slower
// swing; lower weight, faster — the same feel as thumbing the bob on a Wittner.
//
// The swing is honest pendulum motion, not a linear sweep. A single phase
// accumulator counts beats — phase advances at bpm/60 beats per second off the
// clamped rAF delta — and the arm angle is θmax·cos(π·phase), so it eases to a
// stop at each extreme (velocity zero at the tick, fastest through the centre)
// exactly as a real escapement swings. Because tempo only changes the *rate* at
// which phase advances, dragging the weight while it runs never jerks the arm;
// it just speeds up or slows down from wherever it is. No wall clock: the loop
// reads the frame delta, so a tab-away or a resize can't drift the count.
//
// Every way in works: drag the bob, press the steppers, hold Arrow keys on the
// focused control, or TAP the tempo out on the tap pad and it takes the median
// of your last few taps. A time signature sets how many beats to a bar, and the
// downbeat of each bar is accented — brighter, and a higher blip if sound is on.
// Sound is optional and off by default (one lazily-built AudioContext, unlocked
// only on a gesture), so the instrument is fully usable and legible silent.
//
// Under prefers-reduced-motion the arm does not sweep: it snaps to the side of
// the current beat and the beat lights step forward, so the tempo still reads
// at a glance without continuous motion. The bob, being the tempo control, is a
// real role="slider" carrying a spoken value ("120 BPM, Allegro"); a polite
// live region announces the tempo term as it crosses into a new range.

const BPM_MIN = 40
const BPM_MAX = 208
const THETA = 24 // peak swing, degrees to each side
const MAX_DT = 0.05 // clamp a stalled frame so the count can't jump

// Geometry, in the SVG's own viewBox units (0 0 300 400).
const PIVOT_X = 150
const PIVOT_Y = 306
const ARM_TOP_Y = 66 // arm tip when upright
const BOB_NEAR = 96 // bob distance from pivot at the fastest tempo (low on arm)
const BOB_FAR = 224 // bob distance from pivot at the slowest tempo (high on arm)

interface Term {
  name: string
  upTo: number
}
// Traditional Italian tempo ranges — the marks printed beside a real scale.
const TERMS: Term[] = [
  { name: 'Largo', upTo: 60 },
  { name: 'Larghetto', upTo: 66 },
  { name: 'Adagio', upTo: 76 },
  { name: 'Andante', upTo: 108 },
  { name: 'Moderato', upTo: 120 },
  { name: 'Allegro', upTo: 168 },
  { name: 'Presto', upTo: 200 },
  { name: 'Prestissimo', upTo: Infinity },
]

function termFor(bpm: number): string {
  for (const t of TERMS) if (bpm < t.upTo) return t.name
  return TERMS[TERMS.length - 1].name
}

const clampBpm = (v: number) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(v)))

// bpm → distance of the bob from the pivot. Slower is higher up the arm.
function bobDistance(bpm: number): number {
  const slow = (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN) // 1 at slow end
  return BOB_NEAR + slow * (BOB_FAR - BOB_NEAR)
}

const SIGNATURES = [2, 3, 4, 6] as const

// A tiny, optional WebAudio voice — a short pitched blip on each beat, brighter
// on the downbeat. Held behind one lazily-built context; nothing sounds until
// the listener asks for it and the browser has a gesture to unlock playback.
class Click {
  private ctx: AudioContext | null = null

  resume() {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
      osc.type = accent ? 'square' : 'triangle'
      osc.frequency.setValueAtTime(accent ? 1500 : 1000, now)
      osc.frequency.exponentialRampToValueAtTime(accent ? 900 : 620, now + 0.03)
      const peak = accent ? 0.16 : 0.1
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.1)
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

export function Metronome({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()

  const [bpm, setBpm] = useState(112)
  const [playing, setPlaying] = useState(false)
  const [sound, setSound] = useState(false)
  const [beatsPerBar, setBeatsPerBar] = useState<number>(4)
  const [beat, setBeat] = useState(0) // current beat within the bar (0-indexed)
  const [term, setTerm] = useState(() => termFor(112))

  // Live values the rAF loop reads without re-subscribing.
  const bpmRef = useRef(bpm)
  const soundRef = useRef(sound)
  const barRef = useRef(beatsPerBar)
  const reduceRef = useRef(!!reduce)
  bpmRef.current = bpm
  soundRef.current = sound
  barRef.current = beatsPerBar
  reduceRef.current = !!reduce

  const armRef = useRef<SVGGElement>(null)
  const tipRef = useRef<SVGCircleElement>(null)
  const clickRef = useRef<Click | null>(null)
  const phaseRef = useRef(0) // continuous beat phase
  const lastBeatRef = useRef(-1)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const tapsRef = useRef<number[]>([])

  if (!clickRef.current) clickRef.current = new Click()

  // Keep the spoken tempo term in step with the number.
  useEffect(() => {
    setTerm(termFor(bpm))
  }, [bpm])

  const applyAngle = useCallback((deg: number) => {
    const arm = armRef.current
    if (arm) arm.style.transform = `rotate(${deg}deg)`
  }, [])

  const flashTip = useCallback((accent: boolean) => {
    const tip = tipRef.current
    if (!tip) return
    tip.style.transition = 'none'
    tip.setAttribute('r', accent ? '11' : '9')
    tip.style.fill = accent ? '#DCF87C' : '#eafbb6'
    // Let the browser paint the bright frame, then fade back.
    requestAnimationFrame(() => {
      tip.style.transition = 'r 300ms ease-out, fill 300ms ease-out'
      tip.setAttribute('r', '6')
      tip.style.fill = 'rgba(220,248,124,0.35)'
    })
  }, [])

  const fireBeat = useCallback(
    (index: number) => {
      const bar = barRef.current
      const inBar = ((index % bar) + bar) % bar
      const accent = inBar === 0
      setBeat(inBar)
      flashTip(accent)
      if (soundRef.current) clickRef.current?.play(accent)
    },
    [flashTip],
  )

  // The transport loop. Advances the phase by real elapsed time so the count is
  // frame-rate independent; renders the arm every frame (full motion) or snaps
  // it to the current side (reduced motion).
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current)
      // Settle the arm upright.
      const arm = armRef.current
      if (arm) {
        arm.style.transition = reduce ? 'none' : 'transform 420ms cubic-bezier(0.16,1,0.3,1)'
        arm.style.transform = 'rotate(0deg)'
      }
      return
    }

    const arm = armRef.current
    if (arm) arm.style.transition = 'none'
    lastTsRef.current = 0
    lastBeatRef.current = Math.floor(phaseRef.current) - 1

    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(MAX_DT, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      phaseRef.current += dt * (bpmRef.current / 60)
      const idx = Math.floor(phaseRef.current)
      if (idx > lastBeatRef.current) {
        lastBeatRef.current = idx
        fireBeat(idx)
      }

      if (reduceRef.current) {
        // Snap to the side of the current beat; no continuous sweep.
        applyAngle(idx % 2 === 0 ? THETA : -THETA)
      } else {
        applyAngle(THETA * Math.cos(Math.PI * phaseRef.current))
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, reduce, applyAngle, fireBeat])

  useEffect(() => () => clickRef.current?.close(), [])

  const toggle = useCallback(() => {
    setPlaying((p) => {
      const next = !p
      if (next && soundRef.current) clickRef.current?.resume()
      if (!next) setBeat(0)
      return next
    })
  }, [])

  const nudge = useCallback((delta: number) => setBpm((b) => clampBpm(b + delta)), [])

  const onSoundToggle = useCallback(() => {
    setSound((s) => {
      const next = !s
      if (next) clickRef.current?.resume()
      soundRef.current = next
      return next
    })
  }, [])

  // Tap tempo — median of the gaps between the last handful of taps.
  const tap = useCallback(() => {
    const now = performance.now()
    const taps = tapsRef.current
    taps.push(now)
    // Drop taps older than 2.5s so a fresh tempo isn't polluted by a stale one.
    while (taps.length > 1 && now - taps[0] > 2500) taps.shift()
    if (taps.length > 6) taps.shift()
    if (taps.length >= 2) {
      const gaps: number[] = []
      for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1])
      gaps.sort((a, b) => a - b)
      const mid = gaps[Math.floor(gaps.length / 2)]
      if (mid > 0) setBpm(clampBpm(60000 / mid))
    }
  }, [])

  // Drag the bob (or click-drag anywhere on the instrument) to set tempo from
  // the pointer's vertical position: high on the body is slow, low is fast.
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef(false)

  const setFromPointer = useCallback((clientY: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // Map the arm's vertical travel band to [slow..fast].
    const topPx = rect.top + (ARM_TOP_Y / 400) * rect.height
    const botPx = rect.top + (PIVOT_Y / 400) * rect.height
    const t = (clientY - topPx) / (botPx - topPx) // 0 at top (slow) → 1 near pivot (fast)
    const clamped = Math.max(0, Math.min(1, t))
    setBpm(clampBpm(BPM_MIN + clamped * (BPM_MAX - BPM_MIN)))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      setFromPointer(e.clientY)
    },
    [setFromPointer],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingRef.current) setFromPointer(e.clientY)
    },
    [setFromPointer],
  )
  const onPointerUp = useCallback(() => {
    draggingRef.current = false
  }, [])

  const onBobKey = useCallback(
    (e: React.KeyboardEvent) => {
      const big = 5
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault()
          nudge(1)
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault()
          nudge(-1)
          break
        case 'PageUp':
          e.preventDefault()
          nudge(big)
          break
        case 'PageDown':
          e.preventDefault()
          nudge(-big)
          break
        case 'Home':
          e.preventDefault()
          setBpm(BPM_MIN)
          break
        case 'End':
          e.preventDefault()
          setBpm(BPM_MAX)
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          toggle()
          break
      }
    },
    [nudge, toggle],
  )

  const dist = bobDistance(bpm)
  const bobY = PIVOT_Y - dist

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-6 p-6 sm:flex-row sm:gap-10 ${className}`}>
      {/* The instrument */}
      <div
        className="relative w-full max-w-[240px] shrink-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg ref={svgRef} viewBox="0 0 300 400" className="h-auto w-full" role="img" aria-label="Mechanical metronome">
          <defs>
            <linearGradient id="mtro-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#14171b" />
              <stop offset="1" stopColor="#080a0c" />
            </linearGradient>
            <linearGradient id="mtro-face" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d0f12" />
              <stop offset="1" stopColor="#050607" />
            </linearGradient>
          </defs>

          {/* Pyramid body */}
          <path d="M150 40 L232 350 L68 350 Z" fill="url(#mtro-body)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
          {/* Inset face where the scale lives */}
          <path d="M150 74 L206 336 L94 336 Z" fill="url(#mtro-face)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          {/* Base */}
          <rect x="52" y="350" width="196" height="20" rx="4" fill="#0b0d10" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Scale ticks along the arm's travel */}
          {[40, 60, 80, 100, 120, 152, 184, 208].map((mark) => {
            const d = bobDistance(mark)
            const y = PIVOT_Y - d
            const near = Math.abs(mark - bpm) < 6
            return (
              <g key={mark}>
                <line
                  x1="150"
                  y1={y}
                  x2="168"
                  y2={y}
                  stroke={near ? '#DCF87C' : 'rgba(255,255,255,0.28)'}
                  strokeWidth={near ? 2 : 1}
                />
                <text
                  x="174"
                  y={y + 3.5}
                  fontSize="10"
                  fill={near ? '#DCF87C' : 'rgba(255,255,255,0.4)'}
                  fontFamily="ui-monospace, monospace"
                >
                  {mark}
                </text>
              </g>
            )
          })}

          {/* The swinging arm — rotated about the pivot. transform-box keeps the
              origin in the group's own space so rotate() pivots on the point. */}
          <g
            ref={armRef}
            style={{ transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`, transformBox: 'view-box' }}
          >
            {/* counterweight below the pivot */}
            <line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y + 30} stroke="rgba(255,255,255,0.35)" strokeWidth="4" strokeLinecap="round" />
            <circle cx={PIVOT_X} cy={PIVOT_Y + 30} r="7" fill="#1a1d22" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            {/* rod up to the tip */}
            <line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={ARM_TOP_Y} stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round" />
            {/* the sliding weight (tempo control) */}
            <g
              role="slider"
              tabIndex={0}
              aria-label="Tempo"
              aria-valuemin={BPM_MIN}
              aria-valuemax={BPM_MAX}
              aria-valuenow={bpm}
              aria-valuetext={`${bpm} BPM, ${term}`}
              aria-orientation="vertical"
              onKeyDown={onBobKey}
              className="cursor-ns-resize outline-none [&:focus-visible>rect]:stroke-[#DCF87C]"
            >
              <rect
                x={PIVOT_X - 16}
                y={bobY - 12}
                width="32"
                height="24"
                rx="3"
                fill="#DCF87C"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1"
              />
              <line x1={PIVOT_X - 9} y1={bobY} x2={PIVOT_X + 9} y2={bobY} stroke="rgba(8,10,12,0.6)" strokeWidth="2" />
            </g>
            {/* tip marker that flashes on the beat */}
            <circle ref={tipRef} cx={PIVOT_X} cy={ARM_TOP_Y - 4} r="6" fill="rgba(220,248,124,0.35)" />
          </g>

          {/* Pivot cap, drawn over the arm */}
          <circle cx={PIVOT_X} cy={PIVOT_Y} r="6" fill="#22262c" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Controls */}
      <div className="flex w-full max-w-xs flex-col gap-5">
        <div>
          <div className="flex items-end gap-3">
            <span className="font-display text-6xl font-bold tabular-nums leading-none tracking-tight text-white">{bpm}</span>
            <span className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/40">bpm</span>
          </div>
          <p className="mt-1 font-display text-xl font-medium text-[#DCF87C]">{term}</p>
        </div>

        {/* Beat pips */}
        <div className="flex items-center gap-2" aria-hidden="true">
          {Array.from({ length: beatsPerBar }).map((_, i) => {
            const active = playing && beat === i
            const down = i === 0
            return (
              <span
                key={i}
                className="h-2.5 rounded-full transition-all duration-100"
                style={{
                  width: down ? 22 : 14,
                  background: active ? '#DCF87C' : 'rgba(255,255,255,0.14)',
                  boxShadow: active ? '0 0 12px rgba(220,248,124,0.6)' : 'none',
                }}
              />
            )
          })}
        </div>

        {/* Transport + steppers */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex-1 rounded-full bg-[#DCF87C] px-4 py-2.5 text-sm font-semibold text-[#0a0c0e] transition-transform active:scale-95"
          >
            {playing ? 'Stop' : 'Start'}
          </button>
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Slower by one"
            className="h-10 w-10 rounded-full border border-white/15 text-lg text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white active:scale-95"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Faster by one"
            className="h-10 w-10 rounded-full border border-white/15 text-lg text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white active:scale-95"
          >
            +
          </button>
        </div>

        {/* Tap tempo */}
        <button
          type="button"
          onClick={tap}
          className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white active:scale-95"
        >
          Tap tempo
        </button>

        {/* Time signature */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Beats per bar</div>
          <div className="flex gap-1.5">
            {SIGNATURES.map((n) => {
              const on = n === beatsPerBar
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setBeatsPerBar(n)
                    setBeat(0)
                  }}
                  aria-pressed={on}
                  className={`h-9 flex-1 rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                    on ? 'bg-[#DCF87C] text-[#0a0c0e]' : 'border border-white/15 text-white/60 hover:border-[#DCF87C]/40 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sound */}
        <button
          type="button"
          onClick={onSoundToggle}
          aria-pressed={sound}
          className="flex items-center justify-between rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-[#DCF87C]/40"
        >
          <span>Sound</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${sound ? 'text-[#DCF87C]' : 'text-white/35'}`}>
            {sound ? 'On' : 'Off'}
          </span>
        </button>

        <p className="sr-only" role="status" aria-live="polite">
          {playing ? `Playing at ${bpm} beats per minute, ${term}` : `Stopped, ${bpm} beats per minute, ${term}`}
        </p>
      </div>
    </div>
  )
}
