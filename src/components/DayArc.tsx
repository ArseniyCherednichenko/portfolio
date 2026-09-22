import { motion, useReducedMotion } from 'framer-motion'
import { useBerlinTime } from '../hooks/useBerlinTime'

// DayArc — an honest "presence dial" for the /now page.
//
// A 24-hour day drawn as a sun arc: midnight at the left, noon at the apex,
// the next midnight at the right. A marker rides the arc at the live Berlin
// time, and the stretch when I am *likely* around and building is lit — the
// exact same 08:00–24:00 heuristic the shared `useBerlinTime` hook uses for its
// `awake` flag, so this never disagrees with the little status dots elsewhere
// on the site.
//
// HONESTY: this is a *typical* rhythm, not a schedule or a promise. It says so
// on the face of it. Nothing here is derived from real presence data (there is
// none); it is the same soft "probably around now" the rest of the site shows,
// drawn out along a day so the shape of it is legible at a glance.
//
// Geometry is a plain semicircle sampled into a polyline (no SVG arc-flag
// guesswork): for a fraction t of the day, the angle sweeps 180deg (left) down
// to 0deg (right), and the point sits on a circle of radius R about (CX, CY).
// Because y is computed as CY - R*sin, the apex lands *above* the ends in SVG's
// y-down space, so the path reads as a sunrise-to-sunset arc directly.

const CX = 170
const CY = 158
const R = 138
const N = 96

// The lit stretch, matching useBerlinTime's `awake` (hour >= 8 && hour < 24).
const AWAKE_START = 8 / 24
const AWAKE_END = 1

function pointAt(t: number): { x: number; y: number } {
  const angle = Math.PI * (1 - t) // 180deg at t=0, 0deg at t=1
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) }
}

// A polyline `points` string for the arc between two day-fractions.
function arcPoints(from: number, to: number): string {
  const span = to - from
  const steps = Math.max(2, Math.round(N * Math.abs(span)))
  const out: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = from + (span * i) / steps
    const p = pointAt(t)
    out.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`)
  }
  return out.join(' ')
}

const HOUR_LABELS = [
  { t: 0, label: '00' },
  { t: 6 / 24, label: '06' },
  { t: 12 / 24, label: '12' },
  { t: 18 / 24, label: '18' },
  { t: 1, label: '24' },
]

export function DayArc({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const { time, hour, awake } = useBerlinTime()
  // Minute from the live time string ("HH:MM:SS") so the marker glides through
  // the hour rather than jumping on the hour boundary.
  const minute = Number(time.slice(3, 5)) || 0
  const t = Math.min(1, Math.max(0, (hour + minute / 60) / 24))
  const marker = pointAt(t)
  const dim = pointAt(0.5) // apex, only used for the ambient gradient centre

  return (
    <figure
      className={`rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-7 ${className}`}
      aria-label={`A typical day in Berlin. It is ${time}, and I am ${
        awake ? 'likely around and building' : 'likely asleep'
      }.`}
    >
      <svg
        viewBox="0 0 340 190"
        className="w-full"
        role="img"
        aria-hidden
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="dayarc-lit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#DCF87C" stopOpacity="0.25" />
            <stop offset="55%" stopColor="#DCF87C" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#DCF87C" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="dayarc-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#DCF87C" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#DCF87C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft ground haze under the arc's apex. */}
        <ellipse cx={dim.x} cy={CY} rx={R * 0.9} ry="18" fill="url(#dayarc-glow)" opacity="0.5" />

        {/* The whole day, dim. */}
        <polyline
          points={arcPoints(0, 1)}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* The lit "likely around" stretch. */}
        <polyline
          points={arcPoints(AWAKE_START, AWAKE_END)}
          fill="none"
          stroke="url(#dayarc-lit)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Hour ticks + labels along the base. */}
        {HOUR_LABELS.map(({ t: ht, label }) => {
          const p = pointAt(ht)
          // Nudge the tick a touch outward from the arc for the label.
          const nx = CX + (p.x - CX) * 1.11
          const ny = CY + (p.y - CY) * 1.11
          const lit = ht >= AWAKE_START - 0.001
          return (
            <g key={label}>
              <line
                x1={p.x}
                y1={p.y}
                x2={CX + (p.x - CX) * 1.045}
                y2={CY + (p.y - CY) * 1.045}
                stroke={lit ? 'rgba(220,248,124,0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <text
                x={nx}
                y={ny + 4}
                textAnchor="middle"
                className="fill-white/35 text-[11px] font-semibold tabular-nums"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* The live marker — the sun, riding the day. */}
        <g>
          {awake && !reduce && (
            <motion.circle
              cx={marker.x}
              cy={marker.y}
              r="7"
              fill="#DCF87C"
              initial={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: [0.5, 0, 0.5], scale: [1, 2.4, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}
            />
          )}
          <circle
            cx={marker.x}
            cy={marker.y}
            r="6"
            fill={awake ? '#DCF87C' : '#0a0a0a'}
            stroke={awake ? 'rgba(10,10,10,0.5)' : 'rgba(255,255,255,0.45)'}
            strokeWidth={awake ? '1' : '1.5'}
          />
        </g>
      </svg>

      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-white">
            {time.slice(0, 5)}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Berlin
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            awake
              ? 'border-[#DCF87C]/30 text-[#DCF87C]'
              : 'border-white/12 text-white/45'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/35'}`} />
          {awake ? 'Likely around' : 'Likely asleep'}
        </span>
      </figcaption>
      <p className="mt-3 text-[13px] leading-relaxed text-white/40">
        A typical day, not a schedule. The lit stretch is when I am usually at
        the desk and building &mdash; a rhythm, not a promise.
      </p>
    </figure>
  )
}
