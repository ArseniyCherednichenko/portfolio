import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Seconds -> m:ss, the way a media player reads time. Negatives clamp to 0 so a
// rounding wobble at the very start never shows "-0:01".
function timecode(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/**
 * A media transport scrubber — the control the player family was missing. Not a
 * value slider (that is `ElasticSlider`) nor an interval (that is `RangeSlider`)
 * but the timeline every audio and video player rides on, with the three things
 * that make it one rather than a bar with a dot:
 *
 * - **A playhead that moves on its own.** Press play and a requestAnimationFrame
 *   loop advances the position in real time, so the control is alive rather than
 *   inert; it pauses itself at the end and the play button becomes replay.
 * - **A buffered region.** A second, dimmer fill runs ahead of the playhead the
 *   way a stream loads ahead of what you are watching — the honest two-layer
 *   track no plain slider has. It only ever grows and never falls behind the
 *   playhead.
 * - **Hover-scrub preview.** Move the pointer across the track and a timecode
 *   bubble floats to it, previewing the moment you would land on before you
 *   commit — the seek affordance a value slider has no concept of.
 *
 * Grab the playhead (or click the track) to seek; the visual advance holds while
 * you scrub and resumes on release, the way a real transport does. Honest to the
 * keyboard and assistive tech: the playhead is a real `role="slider"` carrying
 * aria-valuemin/max/now and a timecode aria-valuetext, driven by the arrow
 * (±5s), Page (±10s), and Home/End keys; the transport button is a labelled
 * toggle. Under prefers-reduced-motion the thumb swell and the bubble's spring
 * come off and the fills jump rather than ease — the playhead still advances,
 * because its position is information, not decoration.
 */
export function Scrubber({
  duration = 214,
  label = 'Timeline',
  title,
  className = '',
}: {
  /** Total length of the track, in seconds. */
  duration?: number
  /** Accessible name for the scrubber. */
  label?: string
  /** Optional title line shown above the track, e.g. a track name. */
  title?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)

  const [time, setTime] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  // Pointer position over the track, 0..1, while hovering — drives the preview
  // bubble. Null when the pointer is away.
  const [hover, setHover] = useState<number | null>(null)

  // Refs mirror the state the rAF loop reads, so the loop stays a single effect
  // and never restarts (or goes stale) as play/scrub state changes each frame.
  const timeRef = useRef(0)
  const bufferedRef = useRef(0)
  const playingRef = useRef(false)
  const scrubbingRef = useRef(false)
  timeRef.current = time
  bufferedRef.current = buffered
  playingRef.current = playing
  scrubbingRef.current = scrubbing

  // One animation loop for the lifetime of the component. It advances the
  // playhead while playing (and not being scrubbed) and runs the buffer ahead of
  // it at a shade over playback speed, so the stream always loads ahead of the
  // viewer and the two-layer track reads honestly.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if (playingRef.current && !scrubbingRef.current) {
        const next = Math.min(duration, timeRef.current + dt)
        timeRef.current = next
        setTime(next)
        if (next >= duration) {
          playingRef.current = false
          setPlaying(false)
        }
      }

      // Buffer leads the playhead by ~8s, fills at 1.4x, only ever grows, caps
      // at the end. It advances whether or not playback is running, the way a
      // paused stream keeps loading.
      const target = Math.min(duration, Math.max(timeRef.current + 8, bufferedRef.current + dt * 1.4))
      if (target > bufferedRef.current) {
        bufferedRef.current = target
        setBuffered(target)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration])

  const seek = useCallback(
    (next: number) => {
      const clamped = clamp(next, 0, duration)
      timeRef.current = clamped
      setTime(clamped)
      // Seeking forward past what has loaded pulls the buffer along with you.
      if (clamped > bufferedRef.current) {
        bufferedRef.current = clamped
        setBuffered(clamped)
      }
    },
    [duration],
  )

  const ratioFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    if (rect.width === 0) return 0
    return clamp((clientX - rect.left) / rect.width, 0, 1)
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      setScrubbing(true)
      scrubbingRef.current = true
      seek(ratioFromClientX(e.clientX) * duration)
    },
    [duration, ratioFromClientX, seek],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const r = ratioFromClientX(e.clientX)
      setHover(r)
      if (scrubbingRef.current) seek(r * duration)
    },
    [duration, ratioFromClientX, seek],
  )

  const endScrub = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return
    setScrubbing(false)
    scrubbingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = timeRef.current - 5
          break
        case 'ArrowRight':
        case 'ArrowUp':
          next = timeRef.current + 5
          break
        case 'PageDown':
          next = timeRef.current - 10
          break
        case 'PageUp':
          next = timeRef.current + 10
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = duration
          break
        case ' ':
        case 'k':
          e.preventDefault()
          setPlaying((p) => !p)
          return
        default:
          return
      }
      e.preventDefault()
      seek(next)
    },
    [duration, seek],
  )

  const ended = time >= duration
  const toggle = useCallback(() => {
    if (ended) {
      seek(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }, [ended, seek])

  const pct = duration > 0 ? (time / duration) * 100 : 0
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0
  const ease = reduce ? { duration: 0 } : { duration: 0.12, ease: 'linear' as const }

  return (
    <div className={`w-full select-none ${className}`}>
      {title != null && (
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/85">{title}</p>
            <p className="text-xs text-white/40">{playing ? 'Now playing' : ended ? 'Ended' : 'Paused'}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={ended ? 'Replay' : playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DCF87C] text-black outline-none ring-[#DCF87C] transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {ended ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v4h4" />
            </svg>
          ) : playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onPointerLeave={() => setHover(null)}
            className="group relative flex h-6 cursor-pointer touch-none items-center"
          >
            {/* The rail, with the buffered and played layers stacked on it. */}
            <div className="relative h-1.5 w-full rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                animate={{ width: `${bufPct}%` }}
                transition={ease}
              />
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-[#DCF87C]"
                animate={{ width: `${pct}%` }}
                transition={ease}
              />

              {/* Hover-scrub preview bubble — the moment you would seek to. */}
              <AnimatePresence>
                {hover != null && !scrubbing && (
                  <motion.span
                    key="preview"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    transition={{ duration: 0.14 }}
                    className="pointer-events-none absolute bottom-5 -translate-x-1/2 rounded-md border border-white/12 bg-[#161616] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white/75 shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
                    style={{ left: `${hover * 100}%` }}
                  >
                    {timecode(hover * duration)}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* The playhead: a real slider handle, focusable and keyboard-driven. */}
              <motion.div
                role="slider"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={Math.round(time)}
                aria-valuetext={`${timecode(time)} of ${timecode(duration)}`}
                aria-orientation="horizontal"
                tabIndex={0}
                onKeyDown={onKeyDown}
                className="absolute top-1/2 h-4 w-4 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] outline-none ring-[#DCF87C] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ left: `${pct}%`, x: '-50%', y: '-50%' }}
                animate={{ scale: scrubbing ? 1.4 : 1 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 30 }}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-[11px] tabular-nums text-white/45">
            <span className="text-[#DCF87C]/80">{timecode(time)}</span>
            <span>{timecode(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
