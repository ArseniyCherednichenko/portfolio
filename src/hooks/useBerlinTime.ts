import { useEffect, useState } from 'react'

export interface BerlinTime {
  /** Live HH:MM:SS string in Europe/Berlin, 24-hour. */
  time: string
  /** Current Berlin hour (0-23). */
  hour: number
  /** Soft sense of whether a reply is likely soon — never a hard promise. */
  awake: boolean
}

// Live local time in Berlin, so surfaces that show it feel present rather than
// static. Shared by the Contact page and the About snapshot so they never drift.
export function useBerlinTime(): BerlinTime {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Berlin',
    hour12: false,
  }).format(now)

  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }).format(now),
  )

  const awake = hour >= 8 && hour < 24

  return { time, hour, awake }
}
