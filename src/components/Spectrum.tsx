import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useReducedMotion } from 'framer-motion'

const ACCENT = '#DCF87C'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// A tiny deterministic PRNG (mulberry32) so the per-band jitter is the same on
// every load and across resizes — the spectrum has a fixed character, not a
// different random field each mount.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The synthesized spectrum. There is no audio here — the magnitude of each of
 * `bands` frequency bins is built from physics-of-music shapes rather than an
 * FFT: a 1/f spectral tilt (bass heavier than treble, as most music is), three
 * slow-drifting Gaussian "formants" that rise and fall like notes being played,
 * and a touch of seeded per-band jitter so neighbouring bins are never identical.
 * Everything is a function of a single accumulated phase `t`, so the display has
 * a real speed independent of refresh rate and never touches the wall clock.
 */
function spectrumAt(i: number, bands: number, t: number, jitter: number): number {
  const f = i / (bands - 1) // 0 (bass) .. 1 (treble)
  // 1/f tilt — low bins sit higher. Gentle so the treble still shows.
  const tilt = Math.pow(1 - f, 1.5) * 0.55 + 0.1
  // Three moving formants: centre, width, and a bob in loudness, each on its
  // own slow period so they drift in and out of alignment and never repeat on a
  // short loop.
  const formant = (centre: number, width: number, speed: number, phase: number) => {
    const c = centre + 0.14 * Math.sin(t * speed + phase)
    const g = Math.exp(-((f - c) * (f - c)) / (2 * width * width))
    const loud = 0.6 + 0.4 * Math.sin(t * speed * 1.7 + phase * 2.3)
    return g * loud
  }
  const peaks =
    0.9 * formant(0.12, 0.09, 0.9, 0.0) +
    0.7 * formant(0.42, 0.11, 0.62, 2.1) +
    0.55 * formant(0.74, 0.14, 1.3, 4.2)
  // A fast shimmer so the bars flicker like a live analyser rather than easing
  // smoothly between frames.
  const shimmer = 0.12 * Math.sin(t * 7 + i * 0.9) + 0.08 * Math.sin(t * 11 + i * 2.1)
  return clamp(tilt * 0.5 + peaks * 0.8 + shimmer + (jitter - 0.5) * 0.12, 0.02, 1)
}

/**
 * Spectrum — a synthesized frequency-spectrum analyser, built as a signal-study
 * sibling to the Oscilloscope and Waveform rather than a real audio meter. A row
 * of frequency bins climbs and falls with a bass-heavy, formant-driven magnitude
 * (see {@link spectrumAt}); above each bar floats the classic peak-hold cap — a
 * thin mark that jumps up to a new maximum instantly and then sinks back under a
 * slow gravity, so a loud transient leaves a falling trace. Sweep the pointer
 * across the field and the bins under it are excited upward, the energy
 * decaying out on either side, so it answers the cursor like a hand near a
 * contact mic. Space pauses the drift, Up/Down set the gain, Home resets.
 *
 * Nothing plays; the magnitudes are generated, not measured. It is the
 * analyser's look and interaction, not a spectrum of any real sound. One rAF
 * loop accumulates phase off the frame delta, a DPR-capped canvas keeps it crisp,
 * and a ResizeObserver re-fits it. Reduced motion paints one still, representative
 * frame with the caps resting on the bars and runs no loop.
 */
export function Spectrum({
  bands = 44,
  seed = 11,
  className = '',
}: {
  /** Number of frequency bins to draw. */
  bands?: number
  /** Seed for the fixed per-band jitter. */
  seed?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Gain is a ref (tuned without restarting the rAF effect) mirrored into state
  // only for the visible readout.
  const gainRef = useRef(1)
  const [gain, setGain] = useState(1)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  // Pointer excitation: band index under the cursor (-1 = none) and its strength,
  // which decays every frame so the bump trails the pointer and fades when it
  // leaves.
  const exciteRef = useRef({ band: -1, strength: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const jitter = (() => {
      const rand = mulberry32(seed)
      return Array.from({ length: bands }, () => rand())
    })()

    let w = 0
    let h = 0
    let dpr = 1
    const fit = () => {
      const r = wrap.getBoundingClientRect()
      w = Math.max(1, r.width)
      h = Math.max(1, r.height)
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)

    // Current smoothed magnitudes and the floating peak caps, per band.
    const mag = new Float32Array(bands)
    const peak = new Float32Array(bands)

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      const padX = 16
      const padTop = 14
      const padBottom = 18
      const innerW = w - padX * 2
      const innerH = h - padTop - padBottom
      const gap = innerW < 360 ? 2 : 3
      const barW = (innerW - gap * (bands - 1)) / bands
      const floor = h - padBottom
      const ex = exciteRef.current

      for (let i = 0; i < bands; i++) {
        // Target magnitude plus any local excitation from the pointer.
        let target = spectrumAt(i, bands, t, jitter[i]) * gainRef.current
        if (ex.band >= 0 && ex.strength > 0.01) {
          const d = i - ex.band
          target += ex.strength * Math.exp(-(d * d) / 10)
        }
        target = clamp(target, 0, 1)
        // Asymmetric smoothing: snap up to a louder reading, ease down slowly —
        // the attack-fast / release-slow envelope that gives analysers their feel.
        const cur = mag[i]
        mag[i] = target > cur ? target * 0.6 + cur * 0.4 : cur * 0.82 + target * 0.18
        // Peak cap: jump to a new max, otherwise fall under gravity.
        if (mag[i] >= peak[i]) peak[i] = mag[i]
        else peak[i] = Math.max(mag[i], peak[i] - 0.009)

        const x = padX + i * (barW + gap)
        const barH = Math.max(1.5, mag[i] * innerH)
        const top = floor - barH

        // Bar — a vertical lime gradient, brighter toward the top so a tall bar
        // glows at its crest.
        const grad = ctx.createLinearGradient(0, floor, 0, floor - innerH)
        grad.addColorStop(0, 'rgba(220,248,124,0.25)')
        grad.addColorStop(0.55, 'rgba(220,248,124,0.7)')
        grad.addColorStop(1, ACCENT)
        ctx.fillStyle = grad
        ctx.fillRect(x, top, barW, barH)

        // Peak-hold cap — a thin white mark floating above the bar.
        const capY = floor - Math.max(barH, peak[i] * innerH) - 3
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.fillRect(x, Math.max(padTop, capY), barW, 2)
      }

      // Decay the excitation so the bump trails the pointer.
      if (ex.strength > 0) ex.strength = Math.max(0, ex.strength - 0.02)

      // A faint baseline so the field is anchored even when quiet.
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(padX, floor + 1, innerW, 1)
    }

    if (reduce) {
      // One representative still frame: prime the smoothing toward the target so
      // the caps rest on the bars, then paint once. No loop.
      const t0 = 3.2
      for (let i = 0; i < bands; i++) {
        mag[i] = spectrumAt(i, bands, t0, jitter[i]) * gainRef.current
        peak[i] = mag[i]
      }
      draw(t0)
      return () => ro.disconnect()
    }

    let raf = 0
    let last = performance.now()
    let phase = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!pausedRef.current) phase += dt
      draw(phase)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [bands, seed, reduce])

  // Pointer excitation — map the cursor X to a band and push energy in.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const r = wrap.getBoundingClientRect()
    const frac = clamp((e.clientX - r.left) / r.width, 0, 1)
    exciteRef.current = { band: Math.round(frac * (bands - 1)), strength: 0.6 }
  }
  const onPointerLeave = () => {
    exciteRef.current = { band: -1, strength: 0 }
  }

  const setGainBoth = (v: number) => {
    const g = clamp(v, 0.4, 1.8)
    gainRef.current = g
    setGain(g)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let handled = true
    switch (e.key) {
      case ' ':
      case 'Enter':
        setPaused((p) => !p)
        break
      case 'ArrowUp':
      case 'ArrowRight':
        setGainBoth(gainRef.current + 0.1)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        setGainBoth(gainRef.current - 0.1)
        break
      case 'Home':
        setGainBoth(1)
        setPaused(false)
        break
      default:
        handled = false
    }
    if (handled) e.preventDefault()
  }

  return (
    <figure
      className={`flex w-full max-w-[520px] flex-col gap-3 ${className}`}
      role="img"
      aria-label="A synthesized frequency-spectrum analyser: a row of frequency bins rising and falling with bass-heavy, drifting peaks, each capped by a floating peak-hold mark. Nothing plays; the magnitudes are generated, not measured."
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        ref={wrapRef}
        data-cursor
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative h-[200px] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#070707] outline-none"
      >
        <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
      </div>
      <figcaption className="flex items-center justify-between px-1 text-xs tabular-nums text-white/45">
        <span>
          <span className="text-[#DCF87C]/80">gain {gain.toFixed(1)}×</span>
          <span className="mx-2 text-white/20">·</span>
          <span>{paused ? 'paused' : 'live'}</span>
        </span>
        <span className="text-white/30">Space pauses · arrows set gain · sweep to excite</span>
      </figcaption>
    </figure>
  )
}
