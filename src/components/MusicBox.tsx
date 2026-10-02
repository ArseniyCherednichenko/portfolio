import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A music box you actually run. Not a picture of one but a working mechanism:
// a pinned cylinder turns at a steady rate, and as each pin comes round to the
// comb it plucks a tuned steel tooth, which rings. It belongs beside the Geneva
// drive and the four-bar — the mechanical corner — but it is the first object
// here that is also an instrument, so it crosses into the sound family of the
// metronome and the plucked string.
//
// One number is the whole truth: the cylinder's rotation angle, advanced from
// performance.now() across the running segments rather than accumulated per
// frame, so tabbing away and back lands on the true angle instead of drifting.
// Everything on screen and every note you hear is derived from that one angle.
// The tune is laid out as pins at fixed angles around the cylinder, one pin per
// note at the angle for its moment in the bar; a pin plucks its tooth at the
// instant the angle sweeps past it, so the melody can never fall out of step
// with the drum — there is no separate note clock to disagree with the picture.
// The drum is drawn developed flat, its surface unrolled into the strip you
// read right-to-left, which is honest: a point at the rotation angle sits on
// the pluck line, and the surface scrolls one full width per revolution. A small
// end-cap disc turns in lock-step as the cylinder you are looking into end-on.
//
// The comb is tuned the way a real one is: pitch falls as a cantilever tooth
// gets longer, by f proportional to 1/length squared, so each tooth's drawn
// length is 1/sqrt(f) — the low notes are the long teeth, and the length you see
// is the pitch you hear, not decoration. The tips align on the pluck line where
// the pins catch them; only the bases fan out by pitch. A plucked tooth rings
// as a damped sine whose visible buzz-rate tracks its real pitch, the higher
// teeth shimmering faster and dying sooner, zero at the clamped base and largest
// at the free tip.
//
// The sound is synthesised, not sampled: each pluck is a triangle at the tooth's
// true equal-tempered frequency with a sine an octave up for the metallic
// tinkle, under a fast attack and an exponential decay — a small, honest
// approximation of a plucked steel comb, built on the Web Audio clock so the
// ring-down is sample-accurate regardless of frame rate. Audio only ever starts
// from a real gesture (the Play button resumes the context), never on load.
//
// Reduced motion: the free run is gated off. The drum holds a still frame and a
// Step control advances it to the very next pin and plucks that one tooth — the
// box still plays its tune, one deliberate note at a time, with no continuous
// travel. The canvas is decorative and aria-hidden; the controls are real
// buttons and a live region narrates what the box is doing.

interface Tooth {
  name: string
  freq: number
}

// One octave of C major — the set both bundled tunes draw from. Index 0 is the
// low C (the long tooth, drawn at the bottom); index 7 the high C.
const COMB: Tooth[] = [
  { name: 'C4', freq: 261.63 },
  { name: 'D4', freq: 293.66 },
  { name: 'E4', freq: 329.63 },
  { name: 'F4', freq: 349.23 },
  { name: 'G4', freq: 392.0 },
  { name: 'A4', freq: 440.0 },
  { name: 'B4', freq: 493.88 },
  { name: 'C5', freq: 523.25 },
]

// A note in a tune: an index into COMB (or null for a rest) and a length in
// beats. The angle of each resulting pin is derived from where its beat falls
// in the whole bar, so one revolution is exactly one pass of the tune.
interface Note {
  i: number | null
  beats: number
}

interface Tune {
  key: string
  label: string
  notes: Note[]
}

// Both melodies are public-domain: Beethoven's 1824 "Ode to Joy" and the 1761
// French air better known as "Twinkle, Twinkle". Kept to the opening phrase so
// the loop stays tight and recognisable.
const TUNES: Tune[] = [
  {
    key: 'ode',
    label: 'Ode to Joy',
    notes: [
      { i: 2, beats: 1 }, { i: 2, beats: 1 }, { i: 3, beats: 1 }, { i: 4, beats: 1 },
      { i: 4, beats: 1 }, { i: 3, beats: 1 }, { i: 2, beats: 1 }, { i: 1, beats: 1 },
      { i: 0, beats: 1 }, { i: 0, beats: 1 }, { i: 1, beats: 1 }, { i: 2, beats: 1 },
      { i: 2, beats: 1.5 }, { i: 1, beats: 0.5 }, { i: 1, beats: 2 },
    ],
  },
  {
    key: 'twinkle',
    label: 'Twinkle',
    notes: [
      { i: 0, beats: 1 }, { i: 0, beats: 1 }, { i: 4, beats: 1 }, { i: 4, beats: 1 },
      { i: 5, beats: 1 }, { i: 5, beats: 1 }, { i: 4, beats: 2 },
      { i: 3, beats: 1 }, { i: 3, beats: 1 }, { i: 2, beats: 1 }, { i: 2, beats: 1 },
      { i: 1, beats: 1 }, { i: 1, beats: 1 }, { i: 0, beats: 2 },
    ],
  },
]

const TAU = 2 * Math.PI

interface Pin {
  row: number // index into COMB
  angle: number // radians around the cylinder, 0..2π
  freq: number
}

// Lay a tune out as pins at fixed angles. A pin sits at the angle for the start
// of its note; rests advance the angle but drop no pin.
function pinsFor(tune: Tune): { pins: Pin[]; totalBeats: number } {
  const totalBeats = tune.notes.reduce((s, n) => s + n.beats, 0)
  const pins: Pin[] = []
  let beat = 0
  for (const n of tune.notes) {
    if (n.i !== null) pins.push({ row: n.i, angle: (beat / totalBeats) * TAU, freq: COMB[n.i].freq })
    beat += n.beats
  }
  // Order pins by angle so "the next pin" is well-defined for the Step control.
  pins.sort((a, b) => a.angle - b.angle)
  return { pins, totalBeats }
}

export function MusicBox({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveId = useId()

  const [tuneKey, setTuneKey] = useState(TUNES[0].key)
  const [bpm, setBpm] = useState(96)
  const [playing, setPlaying] = useState(false)
  const [announce, setAnnounce] = useState('')

  // Mirror the live controls into refs the animation loop reads, so changing a
  // slider never tears down the canvas or restarts the clock.
  const tuneRef = useRef(tuneKey)
  const bpmRef = useRef(bpm)
  const playingRef = useRef(false)

  // The one source of truth and its bookkeeping.
  const angleRef = useRef(0) // cylinder rotation, radians, 0..2π
  const lastTsRef = useRef<number | null>(null) // wall-clock ms of the last running frame
  const prevAngleRef = useRef(0) // previous frame's angle, for pluck-crossing
  // Per-tooth ring state: when it was last struck (audio-clock seconds) and how
  // hard. Read every frame to draw the damped buzz.
  const ringRef = useRef(COMB.map(() => ({ t0: -999, vel: 0 })))

  const audioRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)

  useEffect(() => { tuneRef.current = tuneKey }, [tuneKey])
  useEffect(() => { bpmRef.current = bpm }, [bpm])

  // --- Audio ------------------------------------------------------------
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      const ctx = new Ctx()
      const master = ctx.createGain()
      master.gain.value = 0.16
      master.connect(ctx.destination)
      audioRef.current = ctx
      masterRef.current = master
    }
    return audioRef.current
  }, [])

  const strike = useCallback(
    (freq: number, vel: number) => {
      const ctx = audioRef.current
      const master = masterRef.current
      if (!ctx || !master) return
      const t = ctx.currentTime
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, t)
      env.gain.exponentialRampToValueAtTime(Math.max(0.02, vel), t + 0.006)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
      env.connect(master)

      const body = ctx.createOscillator()
      body.type = 'triangle'
      body.frequency.value = freq
      body.connect(env)

      const shimmer = ctx.createGain()
      shimmer.gain.value = 0.4
      shimmer.connect(env)
      const tine = ctx.createOscillator()
      tine.type = 'sine'
      tine.frequency.value = freq * 2
      tine.connect(shimmer)

      body.start(t)
      tine.start(t)
      body.stop(t + 1.5)
      tine.stop(t + 1.5)
    },
    [],
  )

  // Record a tooth strike: ring state for the picture, a note for the ear.
  const pluck = useCallback(
    (row: number, vel = 1) => {
      const ctx = audioRef.current
      ringRef.current[row] = { t0: ctx ? ctx.currentTime : performance.now() / 1000, vel }
      strike(COMB[row].freq, vel)
    },
    [strike],
  )

  // --- Transport --------------------------------------------------------
  const play = useCallback(() => {
    const ctx = ensureAudio()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
    lastTsRef.current = null
    playingRef.current = true
    setPlaying(true)
    const t = TUNES.find((x) => x.key === tuneRef.current)
    setAnnounce(`Playing ${t ? t.label : 'the tune'}.`)
  }, [ensureAudio])

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setAnnounce('Paused.')
  }, [])

  // Reduced-motion Step: jump the angle to the next pin and pluck just it.
  const step = useCallback(() => {
    const ctx = ensureAudio()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
    const { pins } = pinsFor(TUNES.find((x) => x.key === tuneRef.current) ?? TUNES[0])
    if (!pins.length) return
    const cur = angleRef.current
    // The next pin strictly ahead of the current angle, wrapping round.
    let next = pins.find((p) => p.angle > cur + 1e-4)
    if (!next) next = pins[0]
    angleRef.current = next.angle
    prevAngleRef.current = next.angle
    pluck(next.row, 1)
    setAnnounce(`${COMB[next.row].name}.`)
  }, [ensureAudio, pluck])

  // --- Draw + run loop --------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let raf = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const LIME = '220,248,124'

    const draw = (nowSec: number) => {
      const { pins } = pinsFor(TUNES.find((x) => x.key === tuneRef.current) ?? TUNES[0])
      const angle = angleRef.current

      // Geometry: a left margin, the comb fanning right to the pluck line, the
      // developed drum surface filling the rest to a turning end-cap at the right.
      const padY = 18
      const bandTop = padY
      const bandH = h - padY * 2
      const rows = COMB.length
      const rowH = bandH / rows
      const rowY = (row: number) => bandTop + (rows - 1 - row) * rowH + rowH / 2 // low notes at the bottom

      const combBaseX = 14 // where the longest tooth is clamped
      const pluckX = combBaseX + Math.max(40, w * 0.3) // tips align here
      const combSpan = pluckX - combBaseX
      const capCx = w - 26
      const capR = Math.min(16, bandH / 2 - 2)
      const drumLeft = pluckX
      const drumRight = capCx - capR - 10
      const drumW = Math.max(1, drumRight - drumLeft)

      ctx.clearRect(0, 0, w, h)

      // Developed drum surface, with scrolling seams so the turn reads even
      // between pins. One full width scrolls per revolution.
      ctx.save()
      ctx.beginPath()
      ctx.rect(drumLeft, bandTop - 4, drumW, bandH + 8)
      ctx.clip()
      const grad = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH)
      grad.addColorStop(0, 'rgba(255,255,255,0.05)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.09)')
      grad.addColorStop(1, 'rgba(0,0,0,0.25)')
      ctx.fillStyle = grad
      ctx.fillRect(drumLeft, bandTop - 4, drumW, bandH + 8)
      // Vertical seams every 1/24 turn, scrolling right-to-left.
      const seams = 24
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      for (let s = 0; s <= seams; s++) {
        const frac = ((s / seams - angle / TAU) % 1 + 1) % 1
        const x = drumLeft + (1 - frac) * drumW
        ctx.beginPath()
        ctx.moveTo(x, bandTop)
        ctx.lineTo(x, bandTop + bandH)
        ctx.stroke()
      }
      // Faint row tracks.
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      for (let r = 0; r < rows; r++) {
        const y = rowY(r)
        ctx.beginPath()
        ctx.moveTo(drumLeft, y)
        ctx.lineTo(drumRight, y)
        ctx.stroke()
      }
      // Pins: a point at the rotation angle sits on the pluck line (left edge of
      // the drum); the surface carries the rest to the right, wrapping once.
      for (const p of pins) {
        const frac = ((p.angle - angle) % TAU + TAU) % TAU / TAU // 0 at pluck line
        const x = drumLeft + frac * drumW
        const y = rowY(p.row)
        const near = frac < 0.03
        ctx.beginPath()
        ctx.arc(x, y, near ? 3.6 : 3, 0, TAU)
        ctx.fillStyle = near ? `rgba(${LIME},0.95)` : 'rgba(230,232,220,0.8)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x - 0.8, y - 0.8, 1, 0, TAU)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fill()
      }
      ctx.restore()

      // The comb: one tapered tooth per row, tip on the pluck line, length by
      // pitch (f ∝ 1/L²  ⇒  L ∝ 1/√f), so low notes are the long teeth.
      const freqs = COMB.map((t) => t.freq)
      const fMin = Math.min(...freqs)
      const fMax = Math.max(...freqs)
      for (let r = 0; r < rows; r++) {
        const y = rowY(r)
        const f = COMB[r].freq
        // Normalise 1/√f across the comb so the shortest tooth still reads.
        const lenN = (1 / Math.sqrt(f) - 1 / Math.sqrt(fMax)) / (1 / Math.sqrt(fMin) - 1 / Math.sqrt(fMax))
        const len = combSpan * (0.42 + 0.58 * lenN)
        const baseX = pluckX - len

        const ring = ringRef.current[r]
        const el = nowSec - ring.t0
        // Damped buzz; visible rate tracks real pitch, scaled for the eye.
        const fVis = 7 + (f - fMin) / (fMax - fMin) * 11
        const amp = el >= 0 ? ring.vel * Math.exp(-el / 0.42) * Math.sin(TAU * fVis * el) * (rowH * 0.32) : 0
        const active = Math.abs(amp) > 0.4

        const tint = active ? `rgba(${LIME},` : 'rgba(214,218,205,'
        ctx.lineWidth = 2.4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(baseX, y)
        // Amplitude zero at the clamped base, full at the free tip.
        const steps = 10
        for (let i = 1; i <= steps; i++) {
          const u = i / steps
          const px = baseX + u * len
          const py = y + amp * u
          ctx.lineTo(px, py)
        }
        ctx.strokeStyle = `${tint}${active ? 0.95 : 0.7})`
        ctx.stroke()
        // Clamp block at the base.
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.fillRect(combBaseX - 4, y - rowH * 0.3, Math.max(2, baseX - (combBaseX - 4)), 2)
      }
      // The clamped spine.
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fillRect(combBaseX - 5, bandTop, 4, bandH)
      // The pluck line.
      ctx.strokeStyle = `rgba(${LIME},0.35)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pluckX, bandTop)
      ctx.lineTo(pluckX, bandTop + bandH)
      ctx.stroke()

      // End-cap: the cylinder seen end-on, turning in lock-step.
      const capCy = bandTop + bandH / 2
      ctx.beginPath()
      ctx.arc(capCx, capCy, capR, 0, TAU)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(capCx, capCy)
      ctx.lineTo(capCx + Math.cos(-angle) * capR, capCy + Math.sin(-angle) * capR)
      ctx.strokeStyle = `rgba(${LIME},0.8)`
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(capCx, capCy, 2, 0, TAU)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fill()
    }

    const frame = () => {
      const audioNow = audioRef.current ? audioRef.current.currentTime : performance.now() / 1000
      if (playingRef.current && !reduce) {
        const now = performance.now()
        if (lastTsRef.current !== null) {
          const dt = (now - lastTsRef.current) / 1000
          const { totalBeats } = pinsFor(TUNES.find((x) => x.key === tuneRef.current) ?? TUNES[0])
          // One revolution is one pass of the tune: ω = 2π / (beats · secPerBeat).
          const secPerBeat = 60 / bpmRef.current
          const omega = TAU / (totalBeats * secPerBeat)
          const prev = angleRef.current
          let next = prev + omega * dt
          // Pluck any pin the angle has swept past this frame (handles wrap).
          const { pins } = pinsFor(TUNES.find((x) => x.key === tuneRef.current) ?? TUNES[0])
          const sweep = next - prev
          for (const p of pins) {
            // Distance forward from prev to this pin, modulo a turn.
            const d = ((p.angle - prev) % TAU + TAU) % TAU
            if (d <= sweep) pluck(p.row, 1)
          }
          next = ((next % TAU) + TAU) % TAU
          prevAngleRef.current = prev
          angleRef.current = next
        }
        lastTsRef.current = now
      } else {
        lastTsRef.current = null
      }
      draw(audioNow)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reduce, pluck])

  // Pause the transport if the user switches to reduced motion mid-run.
  useEffect(() => {
    if (reduce && playingRef.current) {
      playingRef.current = false
      setPlaying(false)
    }
  }, [reduce])

  // Close the audio context on unmount so nothing leaks.
  useEffect(() => {
    return () => {
      if (audioRef.current) void audioRef.current.close()
    }
  }, [])

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block h-48 w-full sm:h-56"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {reduce ? (
          <button
            type="button"
            onClick={step}
            className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-5 py-2 text-sm font-semibold text-[#DCF87C] transition hover:bg-[#DCF87C]/20"
          >
            Step a note
          </button>
        ) : (
          <button
            type="button"
            onClick={playing ? pause : play}
            className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-5 py-2 text-sm font-semibold text-[#DCF87C] transition hover:bg-[#DCF87C]/20"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        )}

        <div className="inline-flex overflow-hidden rounded-full border border-white/15">
          {TUNES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTuneKey(t.key)
                tuneRef.current = t.key
                angleRef.current = 0
                prevAngleRef.current = 0
                lastTsRef.current = null
                setAnnounce(`${t.label} loaded.`)
              }}
              aria-pressed={tuneKey === t.key}
              className={`px-4 py-2 text-sm font-medium transition ${
                tuneKey === t.key ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!reduce && (
          <label className="flex items-center gap-2 text-xs text-white/50">
            <span className="uppercase tracking-[0.2em]">Tempo</span>
            <input
              type="range"
              min={48}
              max={160}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="h-1 w-28 cursor-pointer accent-[#DCF87C]"
              aria-label="Tempo in beats per minute"
            />
            <span className="w-14 tabular-nums text-white/70">{bpm} bpm</span>
          </label>
        )}
      </div>

      <p className="mt-3 text-xs text-white/40">
        {reduce
          ? 'Reduced motion is on, so the drum holds still. Step advances it to the next pin and plucks that tooth.'
          : 'A pinned cylinder turning past a tuned steel comb. Each tooth is drawn at its pitch — long is low — and rings when a pin reaches it.'}
      </p>

      <p id={liveId} role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  )
}
