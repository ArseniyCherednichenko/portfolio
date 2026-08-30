import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useReducedMotion } from 'framer-motion'

// A tiny deterministic PRNG (mulberry32). The waveform is seeded, so the same
// bars are drawn on every load and across resizes — no wall clock, no Math.random
// on the render path, and reduced motion gets the identical figure.
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// mm:ss — the honest transport readout. Tabular so digits never shift the layout.
function fmt(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/**
 * Build a voice-memo-shaped envelope of bar heights (0..1). Not white noise —
 * a couple of slow swells with quieter valleys between, so it reads as speech
 * or a phrase rather than a random field. Deterministic from `seed` and `count`.
 */
function buildEnvelope(count: number, seed: number): number[] {
  const rand = mulberry32(seed)
  // Two low-frequency sine swells at random phase set the loudness contour; a
  // little seeded jitter per bar keeps neighbouring bars from being identical.
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  const f1 = 1.4 + rand() * 1.2
  const f2 = 3.1 + rand() * 2.4
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const swell = 0.55 + 0.32 * Math.sin(t * Math.PI * f1 + p1) + 0.18 * Math.sin(t * Math.PI * f2 + p2)
    const jitter = 0.75 + rand() * 0.5
    // Taper the very ends so the clip fades in and out rather than starting mid-shout.
    const taper = Math.sin(clamp(t, 0, 1) * Math.PI) * 0.4 + 0.6
    out.push(clamp(swell * jitter * taper, 0.06, 1))
  }
  return out
}

/**
 * A seekable waveform transport — the voice-memo / SoundCloud scrubber, built as
 * an interaction study rather than a real player. A deterministic waveform is
 * drawn as a row of bars; the bars behind the playhead are lit in the accent and
 * the ones ahead stay muted, with the exact bar under the head half-filled, so
 * progress reads as a wave colouring in from the left.
 *
 * Press play and the head sweeps at a steady pace (looping at the end); click or
 * drag anywhere on the wave to seek; hover to read the time under the pointer.
 * While it plays, bars just behind the head give a small reactive kick — the one
 * piece of decoration, and the only part reduced motion removes. The scrubber is
 * an honest `role="slider"` (min/max/now in seconds, a spoken value like
 * "0:12 of 0:42"), focusable and driven by the arrow, Home/End, and Space keys.
 *
 * Nothing here plays audio; the duration is arbitrary. It demonstrates the
 * transport interaction, not a media file.
 */
export function Waveform({
  bars = 68,
  duration = 42,
  seed = 7,
  label = 'Waveform',
  className = '',
}: {
  /** How many bars to draw. */
  bars?: number
  /** Clip length in seconds — arbitrary; sets the scale of the readout and sweep. */
  duration?: number
  /** Seed for the deterministic waveform. */
  seed?: number
  /** Accessible label for the scrubber. */
  label?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const id = useId()
  const trackRef = useRef<HTMLDivElement>(null)

  const [heights] = useState(() => buildEnvelope(bars, seed))
  // Playback position in seconds.
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [dragging, setDragging] = useState(false)
  // Pointer position for the hover time flag, as a fraction 0..1, or null.
  const [hoverFrac, setHoverFrac] = useState<number | null>(null)

  const timeRef = useRef(time)
  timeRef.current = time
  const progress = clamp(time / duration, 0, 1)

  // The play loop: advance `time` by real elapsed seconds each frame, looping at
  // the end. Runs off React's timers via rAF so the sweep stays smooth and stops
  // dead the moment playback pauses or the component unmounts.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      let next = timeRef.current + dt
      if (next >= duration) next = 0
      setTime(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, duration])

  // Map a client X to a fraction along the track.
  const fracFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width, 0, 1)
  }, [])

  const seekToClientX = useCallback(
    (clientX: number) => {
      setTime(fracFromClientX(clientX) * duration)
    },
    [fracFromClientX, duration],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    seekToClientX(e.clientX)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    setHoverFrac(fracFromClientX(e.clientX))
    if (dragging) seekToClientX(e.clientX)
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = duration / 40 // ~one bar per press feels right
    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        setTime((t) => clamp(t - step, 0, duration))
        break
      case 'ArrowRight':
      case 'ArrowUp':
        setTime((t) => clamp(t + step, 0, duration))
        break
      case 'Home':
        setTime(0)
        break
      case 'End':
        setTime(duration)
        break
      case ' ':
      case 'Enter':
        setPlaying((p) => !p)
        break
      default:
        handled = false
    }
    if (handled) e.preventDefault()
  }

  const headFrac = progress
  const hoverTime = hoverFrac == null ? null : hoverFrac * duration

  return (
    <div className={`flex w-full max-w-[440px] flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#DCF87C] text-black transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
            </svg>
          )}
        </button>

        {/* The wave itself — a real slider you can grab, click, or key through. */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
          aria-describedby={`${id}-time`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHoverFrac(null)}
          onKeyDown={onKeyDown}
          data-cursor
          className="group relative flex h-20 flex-1 cursor-pointer touch-none items-center gap-[2px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
        >
          {heights.map((h, i) => {
            const barFrac = bars > 1 ? i / (bars - 1) : 0
            const played = barFrac <= headFrac
            // How close this bar is behind the head, 0..1 within a short window.
            const behind = headFrac - barFrac
            const kick =
              !reduce && playing && behind >= 0 && behind < 0.06 ? 1 - behind / 0.06 : 0
            const scale = 1 + kick * 0.35
            return (
              <span
                key={i}
                aria-hidden
                className="relative block flex-1 rounded-full"
                style={{
                  height: `${18 + h * 82}%`,
                  transform: `scaleY(${scale})`,
                  background: played ? '#DCF87C' : 'rgba(255,255,255,0.16)',
                  opacity: played ? 0.95 : 1,
                  transition: reduce ? undefined : 'background 120ms linear, transform 120ms ease-out',
                }}
              />
            )
          })}

          {/* Playhead line + thumb. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 z-10 h-[118%] w-px -translate-y-1/2 bg-[#DCF87C]"
            style={{ left: `${headFrac * 100}%`, boxShadow: '0 0 8px rgba(220,248,124,0.7)' }}
          >
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DCF87C] shadow-[0_0_10px_rgba(220,248,124,0.8)]" />
          </span>

          {/* Hover time flag — only while the pointer is over the track and not mid-drag. */}
          {hoverTime != null && !dragging && (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-1 z-20 -translate-x-1/2 -translate-y-full rounded-md border border-white/12 bg-[#0B0B0B] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/70"
              style={{ left: `${(hoverFrac ?? 0) * 100}%` }}
            >
              {fmt(hoverTime)}
            </span>
          )}
        </div>
      </div>

      <div id={`${id}-time`} className="flex items-center justify-between px-1 text-xs tabular-nums text-white/45">
        <span className="text-[#DCF87C]/80">{fmt(time)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  )
}
