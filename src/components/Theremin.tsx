import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A theremin — the instrument you play without touching. Léon Theremin's 1920
// invention is the odd one out in the sound family: every other voice here
// sounds discrete notes (the string is plucked, the matrix lights a cell, the
// music box drops a pin), but this one is pure continuous pitch. You conduct a
// single running tone through the air — glide the cursor across the field and
// the note swoops with it, raise or lower it and the note swells or hushes —
// and the whole character of the thing is in that unbroken, hands-free glide.
//
// The sound is one honest oscillator held behind a single lazily-built audio
// context, never a bank of pre-baked notes. The real instrument has no steps,
// so neither does this: horizontal position maps to frequency on a LOGARITHMIC
// law (f = fmin·2^(x·octaves)), because pitch is geometric — an octave is a
// doubling — so equal travel across the field is always equal musical
// distance, and the glide sounds even end to end. The swoop itself is a true
// portamento: the frequency is steered with setTargetAtTime toward wherever the
// cursor is, so it chases the pointer on a smooth time constant rather than
// jumping, exactly the gliding voice a theremin has. Vertical position is the
// volume — a flattening of the real instrument, whose two antennas sit at right
// angles (a vertical rod for pitch, a horizontal loop for volume); here both
// axes live in one field, and raising the cursor swells the note, dropping it
// hushes it to silence, under the same smooth time constant so there are no
// clicks at the edges.
//
// Nothing sounds until you ask. Sound is off until you POWER IT ON (the gesture
// that unlocks WebAudio), and even then the tone only speaks while the cursor
// is actually in the field — lift out and it fades to silence, as a theremin
// goes quiet when you step back. A real theremin is unquantised, so the default
// is a free continuous pitch; SCALE LOCK is an optional training wheel that
// snaps the tone to the nearest equal-tempered semitone so a wandering hand
// still lands in tune. A timbre switch picks the oscillator's wave. The field
// is a real control: focus it and the arrow keys walk a playhead (left/right
// for pitch, up/down for volume), Space powers it, and a live region speaks the
// note. Under prefers-reduced-motion the decorative ring sweep never runs — the
// crosshair still tracks and the tone still plays, since that is direct
// manipulation, not animation.

const F_MIN = 130.81 // C3, the field's left edge
const OCTAVES = 3 // span to the right edge → C6 (~1046.5 Hz)
const A4 = 440
const GLIDE = 0.025 // portamento time constant, seconds — the swoop
const SWELL = 0.03 // volume time constant, seconds — no clicks at the edges
const MAX_GAIN = 0.22 // ceiling on the master gain, kept gentle

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Nearest equal-tempered note to a frequency, with how many cents sharp/flat.
function describe(freq: number): { name: string; cents: number } {
  const midi = 69 + 12 * Math.log2(freq / A4)
  const nearest = Math.round(midi)
  const cents = Math.round((midi - nearest) * 100)
  const name = NOTE_NAMES[((nearest % 12) + 12) % 12] + (Math.floor(nearest / 12) - 1)
  return { name, cents }
}

// Snap a frequency to the nearest equal-tempered semitone (scale lock).
function quantize(freq: number): number {
  const midi = Math.round(69 + 12 * Math.log2(freq / A4))
  return A4 * 2 ** ((midi - 69) / 12)
}

type Wave = 'sine' | 'triangle' | 'sawtooth'
const WAVES: { id: Wave; label: string }[] = [
  { id: 'sine', label: 'Pure' },
  { id: 'triangle', label: 'Reedy' },
  { id: 'sawtooth', label: 'Bright' },
]

// The running voice. One oscillator through one gain, both steered by time
// constants so pitch and volume chase the pointer instead of stepping.
class Voice {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  private started = false

  ensure(wave: Wave): boolean {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return false
      if (!this.ctx) this.ctx = new AC()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      if (!this.osc) {
        this.osc = this.ctx.createOscillator()
        this.gain = this.ctx.createGain()
        this.osc.type = wave
        this.osc.frequency.setValueAtTime(F_MIN, this.ctx.currentTime)
        this.gain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
        this.osc.connect(this.gain).connect(this.ctx.destination)
      }
      if (!this.started) {
        this.osc!.start()
        this.started = true
      }
      return true
    } catch {
      this.ctx = null
      this.osc = null
      this.gain = null
      this.started = false
      return false
    }
  }

  setWave(wave: Wave) {
    if (this.osc) this.osc.type = wave
  }

  // Steer the tone. `level` 0..1 scales the master gain; `freq` is the target
  // pitch. Both glide on their own time constants.
  steer(freq: number, level: number) {
    const ctx = this.ctx
    if (!ctx || !this.osc || !this.gain) return
    const now = ctx.currentTime
    this.osc.frequency.setTargetAtTime(freq, now, GLIDE)
    this.gain.gain.setTargetAtTime(Math.max(0.0001, level * MAX_GAIN), now, SWELL)
  }

  hush() {
    const ctx = this.ctx
    if (!ctx || !this.gain) return
    this.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, SWELL)
  }

  close() {
    try {
      this.osc?.stop()
    } catch {
      /* already stopped */
    }
    try {
      void this.ctx?.close()
    } catch {
      /* ignore */
    }
    this.ctx = null
    this.osc = null
    this.gain = null
    this.started = false
  }
}

export function Theremin({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()

  const [power, setPower] = useState(false)
  const [lock, setLock] = useState(false)
  const [wave, setWave] = useState<Wave>('sine')
  // Cursor position in the field, normalised 0..1. x → pitch, y → volume
  // (0 at top). Starts mid-field so the readout reads before first contact.
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 })
  const [sounding, setSounding] = useState(false)

  const voiceRef = useRef<Voice | null>(null)
  if (!voiceRef.current) voiceRef.current = new Voice()

  const fieldRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  // Position → frequency (log law) and volume (raise to swell). Scale lock, if
  // on, snaps the pitch to the nearest semitone.
  const freqOf = useCallback(
    (x: number) => {
      const raw = F_MIN * 2 ** (x * OCTAVES)
      return lock ? quantize(raw) : raw
    },
    [lock],
  )
  const levelOf = (y: number) => 1 - y // top of field = loudest

  const freq = freqOf(pos.x)
  const level = levelOf(pos.y)
  const note = describe(freq)

  // Drive the voice from the current pitch/volume whenever it should sound.
  useEffect(() => {
    const voice = voiceRef.current
    if (!voice) return
    if (power && sounding) voice.steer(freq, level)
    else voice.hush()
  }, [power, sounding, freq, level])

  useEffect(() => {
    voiceRef.current?.setWave(wave)
  }, [wave])

  useEffect(() => () => voiceRef.current?.close(), [])

  const togglePower = useCallback(() => {
    setPower((p) => {
      const next = !p
      if (next) voiceRef.current?.ensure(wave)
      else {
        setSounding(false)
        voiceRef.current?.hush()
      }
      return next
    })
  }, [wave])

  const posFromPointer = useCallback((clientX: number, clientY: number) => {
    const field = fieldRef.current
    if (!field) return
    const rect = field.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    setPos({ x, y })
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!power) voiceRef.current?.ensure(wave)
      draggingRef.current = true
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      posFromPointer(e.clientX, e.clientY)
      setSounding(true)
      if (!power) setPower(true)
    },
    [power, wave, posFromPointer],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      posFromPointer(e.clientX, e.clientY)
      // A hover with the button up still plays once powered — the true
      // hands-free theremin feel on a device with a pointer.
      if (power && e.pointerType === 'mouse') setSounding(true)
    },
    [power, posFromPointer],
  )
  const onPointerUp = useCallback(() => {
    draggingRef.current = false
    // On touch, lifting the finger silences; on mouse, leaving the field does.
    setSounding(false)
  }, [])
  const onPointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (power && e.pointerType === 'mouse') setSounding(true)
    },
    [power],
  )
  const onPointerLeave = useCallback(() => {
    if (!draggingRef.current) setSounding(false)
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 0.04 : 0.012
      let handled = true
      switch (e.key) {
        case 'ArrowLeft':
          setPos((p) => ({ ...p, x: Math.max(0, p.x - step) }))
          setSounding(true)
          break
        case 'ArrowRight':
          setPos((p) => ({ ...p, x: Math.min(1, p.x + step) }))
          setSounding(true)
          break
        case 'ArrowUp':
          setPos((p) => ({ ...p, y: Math.max(0, p.y - step) }))
          setSounding(true)
          break
        case 'ArrowDown':
          setPos((p) => ({ ...p, y: Math.min(1, p.y + step) }))
          setSounding(true)
          break
        case ' ':
        case 'Enter':
          togglePower()
          break
        case 'Escape':
          setSounding(false)
          break
        default:
          handled = false
      }
      if (handled) {
        e.preventDefault()
        if (!power && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          voiceRef.current?.ensure(wave)
          setPower(true)
        }
      }
    },
    [power, wave, togglePower],
  )

  // Decorative ring sweep: concentric rings leave the crosshair, faster with
  // pitch and brighter with volume. Pure chrome — gated off under reduced
  // motion, where the crosshair alone carries the state.
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (reduce || !(power && sounding)) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // Ring cadence rises with pitch; normalise against the field's span.
      const rate = 0.6 + 1.8 * (pos.x)
      setPhase((p) => (p + dt * rate) % 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, power, sounding, pos.x])

  const active = power && sounding
  const cxPct = pos.x * 100
  const cyPct = pos.y * 100

  return (
    <div className={`flex h-full w-full flex-col gap-5 ${className}`}>
      {/* The playfield */}
      <div
        ref={fieldRef}
        tabIndex={0}
        role="slider"
        aria-label="Theremin field. Left and right sets pitch, up and down sets volume."
        aria-valuetext={`${note.name}, ${Math.round(level * 100)} percent volume${power ? '' : ', powered off'}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos.x * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        className="relative h-64 w-full touch-none select-none overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(130%_120%_at_50%_0%,rgba(220,248,124,0.05),transparent_60%),linear-gradient(to_bottom,rgba(255,255,255,0.03),rgba(0,0,0,0.35))] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 sm:h-72"
      >
        {/* Faint pitch guides at the octave boundaries */}
        {Array.from({ length: OCTAVES + 1 }).map((_, i) => {
          const x = (i / OCTAVES) * 100
          const f = F_MIN * 2 ** i
          return (
            <div key={i} className="pointer-events-none absolute inset-y-0" style={{ left: `${x}%` }}>
              <div className="h-full w-px bg-white/5" />
              <span className="absolute bottom-1 left-1 text-[10px] font-medium tabular-nums text-white/25">
                {describe(f).name}
              </span>
            </div>
          )
        })}

        {/* Pitch antenna — the vertical rod on the right of a real theremin */}
        <div className="pointer-events-none absolute right-5 top-6 bottom-6 w-[3px] rounded-full bg-gradient-to-b from-white/50 to-white/10" />
        {/* Volume loop — the horizontal antenna on the left */}
        <div className="pointer-events-none absolute left-5 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full border-[3px] border-white/20" />

        {/* Decorative ring sweep from the crosshair */}
        {active &&
          !reduce &&
          [0, 1, 2].map((k) => {
            const t = (phase + k / 3) % 1
            return (
              <div
                key={k}
                className="pointer-events-none absolute rounded-full border"
                style={{
                  left: `${cxPct}%`,
                  top: `${cyPct}%`,
                  width: `${t * 240}px`,
                  height: `${t * 240}px`,
                  transform: 'translate(-50%, -50%)',
                  borderColor: `rgba(220,248,124,${(1 - t) * level * 0.5})`,
                }}
              />
            )
          })}

        {/* Crosshair at the cursor — glow scales with volume */}
        <div
          className="pointer-events-none absolute"
          style={{ left: `${cxPct}%`, top: `${cyPct}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="rounded-full"
            style={{
              width: 18,
              height: 18,
              background: active ? '#DCF87C' : 'rgba(255,255,255,0.4)',
              boxShadow: active ? `0 0 ${12 + level * 34}px rgba(220,248,124,${0.4 + level * 0.5})` : 'none',
              transition: 'background 200ms ease',
            }}
          />
        </div>

        {/* Readout, top-left */}
        <div className="pointer-events-none absolute left-4 top-3">
          <span className="font-display text-2xl font-bold tabular-nums text-white">{note.name}</span>
          <span className="ml-2 text-xs tabular-nums text-white/40">{Math.round(freq)} Hz</span>
          {!lock && active && (
            <span className="ml-2 text-xs tabular-nums text-white/30">
              {note.cents >= 0 ? '+' : ''}
              {note.cents}c
            </span>
          )}
        </div>

        {!power && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white/60 backdrop-blur-sm">
              Power on, then play the air
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePower}
          aria-pressed={power}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95 ${
            power ? 'bg-[#DCF87C] text-[#0a0c0e]' : 'border border-white/15 text-white/70 hover:border-[#DCF87C]/50 hover:text-white'
          }`}
        >
          {power ? 'Power on' : 'Power off'}
        </button>

        <button
          type="button"
          onClick={() => setLock((l) => !l)}
          aria-pressed={lock}
          className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
            lock ? 'border-[#DCF87C]/60 text-[#DCF87C]' : 'border-white/15 text-white/60 hover:border-[#DCF87C]/40 hover:text-white'
          }`}
        >
          Scale lock
        </button>

        <div className="flex items-center gap-1.5 rounded-full border border-white/10 p-1">
          {WAVES.map((w) => {
            const on = w.id === wave
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setWave(w.id)}
                aria-pressed={on}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on ? 'bg-white/90 text-[#0a0c0e]' : 'text-white/55 hover:text-white'
                }`}
              >
                {w.label}
              </button>
            )
          })}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {power
          ? active
            ? `Sounding ${note.name} at ${Math.round(freq)} hertz, ${Math.round(level * 100)} percent volume`
            : 'Powered on, silent'
          : 'Powered off'}
      </p>
    </div>
  )
}
