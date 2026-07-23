import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Clock — a hand-drawn analog dial that reads a real timezone. The site shows
// its Berlin time as digits in several places (SplitFlap, the footer, the Now
// dateline); none of them is a *face*. This is that face: an SVG dial with a
// short hour hand, a long minute hand, and a hair-thin second hand that sweeps
// continuously (a mechanical sweep, not a quartz tick), driven by a single RAF
// loop that writes transforms straight to the hand nodes — no per-frame React
// render. It is timezone-correct and DST-safe because the base hours/minutes/
// seconds are read from Intl.DateTimeFormat for the given `timeZone`, and the
// sub-second fraction (identical in every zone) is taken from the wall clock.
//
// Day/night aware: between 08:00 and midnight local the dial is "awake" and the
// second hand and the twelve-marker warm to lime; otherwise it rests in white.
// Reduced motion drops the sweep — the hands still update once a second so the
// time stays honest, they just jump instead of gliding, and the ambient glow is
// stilled. Purely a readout; `role="img"` with a live label keeps it legible to
// assistive tech without announcing every second.

interface ClockParts {
  hour: number
  minute: number
  second: number
}

// Read the wall-clock hour/minute/second for a timezone. Integer seconds only —
// the smooth fraction is added by the caller from Date.now() % 1000, which is
// zone-independent (offsets are whole minutes).
function readZoneParts(fmt: Intl.DateTimeFormat, now: number): ClockParts {
  const parts = fmt.formatToParts(now)
  let hour = 0
  let minute = 0
  let second = 0
  for (const p of parts) {
    if (p.type === 'hour') hour = Number(p.value) % 24
    else if (p.type === 'minute') minute = Number(p.value)
    else if (p.type === 'second') second = Number(p.value)
  }
  return { hour, minute, second }
}

export function Clock({
  timeZone = 'Europe/Berlin',
  size = 96,
  label = 'Berlin',
  className = '',
}: {
  /** IANA timezone the dial reads. Default Europe/Berlin — where Arseniy is. */
  timeZone?: string
  /** Pixel size of the square dial. */
  size?: number
  /** Place name used in the accessible label, e.g. "Berlin". */
  label?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const hourRef = useRef<SVGGElement>(null)
  const minuteRef = useRef<SVGGElement>(null)
  const secondRef = useRef<SVGGElement>(null)
  const [readout, setReadout] = useState('')
  // `awake` gates the accent + glow; it only changes on the hour, so keeping it
  // in state (updated each second) costs nothing and avoids threading it out.
  const [awake, setAwake] = useState(true)

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    [timeZone],
  )

  // Twelve hour markers, plus a thin minute tick between them. Precomputed so
  // the render stays declarative and the RAF loop only touches the three hands.
  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0
      const a = (i / 60) * Math.PI * 2
      const outer = 46
      const inner = major ? 39 : 43
      out.push({
        x1: 50 + Math.sin(a) * inner,
        y1: 50 - Math.cos(a) * inner,
        x2: 50 + Math.sin(a) * outer,
        y2: 50 - Math.cos(a) * outer,
        major,
      })
    }
    return out
  }, [])

  useEffect(() => {
    let raf = 0
    let interval = 0
    let lastLabelSecond = -1

    const paint = (frac: number) => {
      const { hour, minute, second } = readZoneParts(fmt, Date.now())
      const s = second + frac
      const m = minute + s / 60
      const h = (hour % 12) + m / 60
      const secDeg = (s / 60) * 360
      const minDeg = (m / 60) * 360
      const hourDeg = (h / 12) * 360
      if (secondRef.current) secondRef.current.style.transform = `rotate(${secDeg}deg)`
      if (minuteRef.current) minuteRef.current.style.transform = `rotate(${minDeg}deg)`
      if (hourRef.current) hourRef.current.style.transform = `rotate(${hourDeg}deg)`

      if (second !== lastLabelSecond) {
        lastLabelSecond = second
        const pad = (n: number) => String(n).padStart(2, '0')
        setReadout(`${pad(hour)}:${pad(minute)}:${pad(second)}`)
        setAwake(hour >= 8 && hour < 24)
      }
    }

    if (reduce) {
      // Discrete, honest updates — no sweep. Once a second, hands jump.
      paint(0)
      interval = window.setInterval(() => paint(0), 1000)
      return () => window.clearInterval(interval)
    }

    // Smooth mechanical sweep: fraction of the current second from the wall
    // clock, which is the same in every timezone (offsets are whole minutes).
    const loop = () => {
      paint((Date.now() % 1000) / 1000)
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
  }, [fmt, reduce])

  const accent = awake ? '#DCF87C' : 'rgba(255,255,255,0.5)'

  return (
    <div
      role="img"
      aria-label={readout ? `Clock — ${readout} in ${label}` : `Clock in ${label}`}
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient glow — a soft lime halo when the hours are awake, stilled under
          reduced motion. Decorative, behind the dial. */}
      {!reduce && awake && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-[#DCF87C]/10 blur-xl"
        />
      )}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden
        className="relative"
      >
        <defs>
          <radialGradient id="clock-face" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#0b0b0b" />
          </radialGradient>
        </defs>

        {/* Dial */}
        <circle cx="50" cy="50" r="48" fill="url(#clock-face)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />

        {/* Ticks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.major ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={t.major ? 1.1 : 0.6}
            strokeLinecap="round"
          />
        ))}
        {/* The twelve-marker, warmed when awake */}
        <circle cx="50" cy="8" r="1.7" fill={accent} />

        {/* Hour hand — short, thick, rounded. Rotates about the dial centre. */}
        <g ref={hourRef} style={{ transformOrigin: '50px 50px' }}>
          <line x1="50" y1="54" x2="50" y2="29" stroke="rgba(255,255,255,0.9)" strokeWidth="3.2" strokeLinecap="round" />
        </g>
        {/* Minute hand — long, thinner. */}
        <g ref={minuteRef} style={{ transformOrigin: '50px 50px' }}>
          <line x1="50" y1="55" x2="50" y2="16" stroke="rgba(255,255,255,0.72)" strokeWidth="2" strokeLinecap="round" />
        </g>
        {/* Second hand — hair-thin, accented, with a small counterweight tail. */}
        <g ref={secondRef} style={{ transformOrigin: '50px 50px' }}>
          <line x1="50" y1="60" x2="50" y2="13" stroke={accent} strokeWidth="0.9" strokeLinecap="round" />
          <circle cx="50" cy="50" r="2.6" fill={accent} />
        </g>
        {/* Centre hub cap over the hands */}
        <circle cx="50" cy="50" r="1.4" fill="#0b0b0b" />
      </svg>
    </div>
  )
}
