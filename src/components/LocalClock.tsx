import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// Live wall-clock for Berlin, where Arseniy is based. Updates every second so
// the page has a genuine pulse, and reads back an honest, hedged guess at what
// he is probably doing right now based on the local hour. All times are
// computed in the Europe/Berlin zone via Intl, so they are correct regardless
// of where the visitor is sitting.

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const HOUR_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  hour: 'numeric',
  hour12: false,
})

const DAY_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'long',
})

function statusFor(hour: number): string {
  if (hour < 7) return 'Probably asleep'
  if (hour < 10) return 'Probably waking up, coffee first'
  if (hour < 13) return 'Likely heads-down building'
  if (hour < 18) return 'Likely deep in the work'
  if (hour < 23) return 'Probably still shipping'
  return 'Winding down for the day'
}

export function LocalClock() {
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const time = TIME_FMT.format(now)
  const [hh, mm] = time.split(':')
  const hour = Number(HOUR_FMT.format(now)) % 24
  const day = DAY_FMT.format(now)
  // Blink the separator on each tick (even second), unless motion is reduced.
  const blink = reduce ? true : now.getSeconds() % 2 === 0

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:p-9">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">
        <span className="relative flex h-2 w-2">
          {!reduce && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C] opacity-60" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DCF87C]" />
        </span>
        Berlin, right now
      </div>

      <div
        className="mt-6 flex items-baseline font-bold tabular-nums leading-none tracking-tight"
        aria-label={`Local time in Berlin: ${time}`}
      >
        <span className="text-6xl sm:text-7xl">{hh}</span>
        <span
          aria-hidden
          className="px-1 text-5xl text-[#DCF87C] transition-opacity duration-200 sm:text-6xl"
          style={{ opacity: blink ? 1 : 0.15 }}
        >
          :
        </span>
        <span className="text-6xl sm:text-7xl">{mm}</span>
        <span className="ml-3 text-base font-medium uppercase tracking-widest text-white/40">CET</span>
      </div>

      <div className="mt-6 h-6 overflow-hidden text-lg text-white/55">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={statusFor(hour)}
            initial={reduce ? false : { y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -20, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {day} — {statusFor(hour)}.
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
