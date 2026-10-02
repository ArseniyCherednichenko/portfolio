import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// An hourglass you actually run. Not a picture of a sand timer but a working
// one: a single elapsed-time clock is the only source of truth, and both the
// draining top bulb and the filling bottom bulb are drawn from it, so the glass
// can never show a level that disagrees with the time left.
//
// The craft is that the sand is volume-honest. A real bulb is a funnel, wide at
// the mouth and narrow at the neck, so equal spans of time do NOT empty equal
// spans of height — the surface drops fast while the bulb is wide and crawls as
// it narrows toward the neck. Rather than fake a linear slide, each surface is
// placed so the sand AREA remaining equals the time remaining: the funnel wall
// is linear in height, which makes the cumulative area a quadratic, so the
// surface position is the root of that quadratic in [0,1]. The fallen sand fills
// the lower bulb as a level rather than heaping into a cone — an honest
// simplification, noted plainly.
//
// Honest about the clock, too: elapsed time is read from performance.now()
// across running segments, not accumulated per frame, so tabbing away and back
// lands on the true remaining time instead of drifting. The requestAnimationFrame
// loop only redraws; it never owns the number. The sand is amber because sand is
// amber — a deliberate break from the site's lime, in the company of the Nixie
// and the Sundial, whose real materials glow warm.
//
// Reduced motion: the falling grains and the flip's turn are dropped, and the
// levels step once a second instead of easing every frame — it stays a precise,
// legible, fully operable timer with no continuous travel.

interface HourglassProps {
  /** Selectable run lengths, in seconds. The first is the initial selection. */
  durations?: number[]
  className?: string
}

// --- Glass geometry (SVG user units). Symmetric about the neck. ---
const CX = 60
const TOP_Y = 34 // mouth of the upper bulb (interior)
const NECK_Y = 110 // the waist
const BOT_Y = 186 // floor of the lower bulb (interior)
const A = 38 // interior half-width at a bulb's wide end
const N = 3.5 // interior half-width at the neck
const H = NECK_Y - TOP_Y // == BOT_Y - NECK_Y, by symmetry

// Interior half-width of the upper bulb at height y (linear wall).
function hwTop(y: number) {
  const t = (y - TOP_Y) / H
  return A + (N - A) * t
}
// Interior half-width of the lower bulb at height y (linear wall).
function hwBot(y: number) {
  const s = (y - NECK_Y) / H
  return N + (A - N) * s
}

// Pick the quadratic root that lands in [0,1]; fall back to a clamp.
function rootIn01(aa: number, bb: number, cc: number) {
  if (Math.abs(aa) < 1e-9) {
    const u = -cc / bb
    return Math.min(1, Math.max(0, u))
  }
  const disc = Math.max(0, bb * bb - 4 * aa * cc)
  const sq = Math.sqrt(disc)
  const r1 = (-bb + sq) / (2 * aa)
  const r2 = (-bb - sq) / (2 * aa)
  for (const r of [r1, r2]) if (r >= -1e-6 && r <= 1 + 1e-6) return Math.min(1, Math.max(0, r))
  return Math.min(1, Math.max(0, r1))
}

// Height of the draining surface in the upper bulb so the sand AREA above the
// neck equals (1 - progress) of the bulb. Area to the neck is a quadratic in the
// normalised height u, so u solves (N-A)/2·u^2 + A·u - progress·(A+N)/2 = 0.
function topSurfaceY(progress: number) {
  const u = rootIn01((N - A) / 2, A, -(progress * (A + N)) / 2)
  return TOP_Y + u * H
}
// Height of the settled surface in the lower bulb so the filled AREA below it
// equals progress of the bulb. s solves (A-N)/2·s^2 + N·s - (1-progress)·(A+N)/2 = 0.
function botSurfaceY(progress: number) {
  const s = rootIn01((A - N) / 2, N, -((1 - progress) * (A + N)) / 2)
  return NECK_Y + s * H
}

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function Hourglass({ durations = [30, 60, 180], className = '' }: HourglassProps) {
  const reduce = useReducedMotion()
  const id = useId()

  const [durationS, setDurationS] = useState(durations[1] ?? durations[0] ?? 60)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [flips, setFlips] = useState(0)

  // The clock. accumulatedMs is time run in completed segments; segStart marks
  // the start of the current running segment (performance.now()).
  const accumulatedMs = useRef(0)
  const segStart = useRef(0)
  const rafRef = useRef(0)
  const tickRef = useRef<number | null>(null)

  // DOM targets the RAF loop writes to directly, keeping the per-frame work off
  // the React render path (only discrete state — running/done/flips — re-renders).
  const topSandRef = useRef<SVGPolygonElement | null>(null)
  const botSandRef = useRef<SVGPolygonElement | null>(null)
  const streamRef = useRef<SVGRectElement | null>(null)
  const timeRef = useRef<HTMLSpanElement | null>(null)
  const liveRef = useRef<HTMLSpanElement | null>(null)

  const durationMs = durationS * 1000

  const elapsed = useCallback(() => {
    const base = accumulatedMs.current
    return running ? base + (performance.now() - segStart.current) : base
  }, [running])

  // Paint the glass for a given elapsed time. Pure DOM writes, no React state.
  const paint = useCallback(
    (ms: number) => {
      const p = Math.min(1, ms / durationMs)
      const ys = topSurfaceY(p)
      const yf = botSurfaceY(p)

      if (topSandRef.current) {
        const w = hwTop(ys)
        topSandRef.current.setAttribute(
          'points',
          `${CX - w},${ys} ${CX + w},${ys} ${CX + N},${NECK_Y} ${CX - N},${NECK_Y}`,
        )
        topSandRef.current.style.opacity = p >= 1 ? '0' : '1'
      }
      if (botSandRef.current) {
        const w = hwBot(yf)
        botSandRef.current.setAttribute(
          'points',
          `${CX - w},${yf} ${CX + w},${yf} ${CX + A},${BOT_Y} ${CX - A},${BOT_Y}`,
        )
        botSandRef.current.style.opacity = p <= 0 ? '0' : '1'
      }
      if (streamRef.current) {
        const flowing = p > 0 && p < 1
        streamRef.current.style.opacity = flowing ? '1' : '0'
        streamRef.current.setAttribute('y', String(NECK_Y))
        streamRef.current.setAttribute('height', String(Math.max(0, yf - NECK_Y)))
      }
      if (timeRef.current) timeRef.current.textContent = fmt(durationMs - ms)
    },
    [durationMs],
  )

  // Drive redraws while running. Smooth via RAF, or a calm 1s step under reduced
  // motion. Either way the number comes from the clock, not the loop.
  useEffect(() => {
    const finish = () => {
      accumulatedMs.current = durationMs
      setRunning(false)
      setDone(true)
      paint(durationMs)
      if (liveRef.current) liveRef.current.textContent = 'Time is up.'
    }

    if (!running) {
      paint(elapsed())
      return
    }

    if (reduce) {
      paint(elapsed())
      tickRef.current = window.setInterval(() => {
        const ms = elapsed()
        if (ms >= durationMs) {
          if (tickRef.current) window.clearInterval(tickRef.current)
          finish()
          return
        }
        paint(ms)
      }, 1000)
      return () => {
        if (tickRef.current) window.clearInterval(tickRef.current)
      }
    }

    const loop = () => {
      const ms = elapsed()
      if (ms >= durationMs) {
        finish()
        return
      }
      paint(ms)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running, reduce, durationMs, elapsed, paint])

  const start = useCallback(() => {
    if (done) return
    if (elapsed() >= durationMs) return
    segStart.current = performance.now()
    setRunning(true)
    if (liveRef.current) liveRef.current.textContent = `Running. ${fmt(durationMs - elapsed())} left.`
  }, [done, elapsed, durationMs])

  const pause = useCallback(() => {
    accumulatedMs.current = elapsed()
    setRunning(false)
    if (liveRef.current) liveRef.current.textContent = `Paused. ${fmt(durationMs - accumulatedMs.current)} left.`
  }, [elapsed, durationMs])

  // Flip turns the glass over and runs the full length again from the top.
  const flip = useCallback(() => {
    accumulatedMs.current = 0
    segStart.current = performance.now()
    setDone(false)
    setFlips((f) => f + 1)
    setRunning(true)
    paint(0)
    if (liveRef.current) liveRef.current.textContent = `Flipped. ${fmt(durationMs)} left.`
  }, [durationMs, paint])

  const chooseDuration = useCallback(
    (s: number) => {
      accumulatedMs.current = 0
      setRunning(false)
      setDone(false)
      setDurationS(s)
    },
    [],
  )

  // Repaint whenever the duration changes or we reset, so the static frame is right.
  useEffect(() => {
    paint(Math.min(elapsed(), durationMs))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationS])

  const GRAINS = [0, 1, 2, 3]

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Grain-fall keyframes scoped to this component; only used when motion is allowed. */}
      <style>{`
        @keyframes hgfall {
          0% { transform: translateY(0); opacity: 0 }
          12% { opacity: 1 }
          85% { opacity: 1 }
          100% { transform: translateY(54px); opacity: 0 }
        }
      `}</style>

      <motion.div
        // A fresh key per flip replays the turn; the glass settles upright.
        key={flips}
        initial={reduce ? false : { rotate: 180 }}
        animate={{ rotate: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 16 }}
        style={{ transformOrigin: '50% 50%' }}
      >
        <svg
          viewBox="0 0 120 220"
          width={220}
          height={300}
          role="img"
          aria-hidden
          className="max-w-full"
        >
          <defs>
            <linearGradient id={`${id}-sand`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#edd08a" />
              <stop offset="100%" stopColor="#d4ab5e" />
            </linearGradient>
            <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>
          </defs>

          {/* Wooden frame: caps top and bottom, two posts down the sides. */}
          <g fill="#3a352c" stroke="#50483a" strokeWidth="1">
            <rect x="12" y="14" width="96" height="14" rx="4" />
            <rect x="12" y="192" width="96" height="14" rx="4" />
            <rect x="16" y="26" width="7" height="168" rx="3.5" />
            <rect x="97" y="26" width="7" height="168" rx="3.5" />
          </g>

          {/* The glass bulbs. */}
          <g>
            <polygon
              points={`${CX - A},${TOP_Y} ${CX + A},${TOP_Y} ${CX + N},${NECK_Y} ${CX - N},${NECK_Y}`}
              fill={`url(#${id}-glass)`}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <polygon
              points={`${CX - N},${NECK_Y} ${CX + N},${NECK_Y} ${CX + A},${BOT_Y} ${CX - A},${BOT_Y}`}
              fill={`url(#${id}-glass)`}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </g>

          {/* Sand, clipped to each bulb so a surface can never spill past the glass. */}
          <clipPath id={`${id}-clip-top`}>
            <polygon points={`${CX - A},${TOP_Y} ${CX + A},${TOP_Y} ${CX + N},${NECK_Y} ${CX - N},${NECK_Y}`} />
          </clipPath>
          <clipPath id={`${id}-clip-bot`}>
            <polygon points={`${CX - N},${NECK_Y} ${CX + N},${NECK_Y} ${CX + A},${BOT_Y} ${CX - A},${BOT_Y}`} />
          </clipPath>

          <g clipPath={`url(#${id}-clip-top)`}>
            <polygon ref={topSandRef} fill={`url(#${id}-sand)`} points="" />
          </g>
          <g clipPath={`url(#${id}-clip-bot)`}>
            <polygon ref={botSandRef} fill={`url(#${id}-sand)`} points="" />
            {/* The falling stream + decorative grains (aria-hidden, motion only). */}
            <rect ref={streamRef} x={CX - 1} y={NECK_Y} width="2" height="0" fill={`url(#${id}-sand)`} opacity="0" />
            {!reduce &&
              running &&
              GRAINS.map((g) => (
                <circle
                  key={g}
                  cx={CX + (g % 2 === 0 ? -0.8 : 0.8)}
                  cy={NECK_Y + 2}
                  r="0.9"
                  fill="#e8c478"
                  style={{
                    animation: `hgfall 0.95s linear ${g * 0.24}s infinite`,
                    transformBox: 'fill-box',
                  }}
                />
              ))}
          </g>

          {/* The neck pinch, drawn over the sand so the waist reads crisp. */}
          <line
            x1={CX - N - 1.5}
            y1={NECK_Y}
            x2={CX + N + 1.5}
            y2={NECK_Y}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
        </svg>
      </motion.div>

      <div className="mt-6 flex flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          {done ? 'Done' : running ? 'Running' : 'Ready'}
        </span>
        <span
          ref={timeRef}
          aria-hidden
          className="font-display text-5xl font-semibold tabular-nums text-[#e8c478]"
        >
          {fmt(durationMs)}
        </span>
        <span ref={liveRef} aria-live="polite" className="sr-only" />

        {/* Run length */}
        <div
          role="radiogroup"
          aria-label="Run length"
          className="mt-5 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] p-1"
        >
          {durations.map((s) => {
            const active = s === durationS
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseDuration(s)}
                className={`rounded-full px-3 py-1 text-sm font-medium tabular-nums transition ${
                  active ? 'bg-[#e8c478] text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                {fmt(s * 1000)}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {!done && (
            <button
              type="button"
              onClick={running ? pause : start}
              className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/85 transition hover:border-[#e8c478]/40 hover:text-white"
            >
              {running ? 'Pause' : 'Start'}
            </button>
          )}
          <button
            type="button"
            onClick={flip}
            className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/85 transition hover:border-[#e8c478]/40 hover:text-white"
          >
            Flip
          </button>
        </div>
      </div>
    </div>
  )
}
