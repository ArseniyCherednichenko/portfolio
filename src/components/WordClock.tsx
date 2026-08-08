import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// WordClock — a QLOCKTWO-style letter grid that spells the time in words.
//
// The site already tells its Berlin time two ways: the analog Clock (a drawn
// dial) and the SplitFlap (rolling digits). This is the third and most
// typographic reading — a fixed 11×10 field of letters where only the words
// that spell the current time light up, so you read "IT IS HALF PAST TEN" out
// of an otherwise dim wall of glyphs. It leans entirely on the site's love of
// type, which is why it belongs here rather than being another dial.
//
// The grid is hand-laid so every needed word sits at a known coordinate and
// every remaining cell is still a real letter (no blanks): the classic English
// word-clock layout, with a couple of filler letters chosen so the rows stay
// full. Time is read to the nearest five minutes — the convention these clocks
// have always used — from a real timezone via Intl (default Europe/Berlin), so
// it is honest and DST-safe. Only the *set of lit cells* drives React state, and
// it is recomputed once a second but compared first, so a re-render happens only
// when the phrase actually changes (four times an hour), not every tick.
//
// Reduced motion: the letters still light for the correct time, they just do
// not cross-fade — the glow snaps in instead of breathing.

// The letter field. 11 columns, 10 rows; every cell is a real letter.
const GRID = [
  'ITLISAMPMXQ',
  'QUARTERDCXZ',
  'TWENTYFIVEX',
  'HALFBTENXTO',
  'PASTORUNINE',
  'ONESIXTHREE',
  'FOURFIVETWO',
  'EIGHTELEVEN',
  'SEVENTWELVE',
  'TENSEOCLOCK',
] as const

type Span = readonly [row: number, col: number, len: number]

// Where each word lives in the grid. `m`/`h` suffixes disambiguate the minute
// and hour readings of FIVE and TEN, which appear in two different rows.
const WORDS = {
  IT: [0, 0, 2],
  IS: [0, 3, 2],
  A: [0, 5, 1],
  QUARTER: [1, 0, 7],
  TWENTY: [2, 0, 6],
  FIVEm: [2, 6, 4],
  HALF: [3, 0, 4],
  TENm: [3, 5, 3],
  TO: [3, 9, 2],
  PAST: [4, 0, 4],
  NINE: [4, 7, 4],
  ONE: [5, 0, 3],
  SIX: [5, 3, 3],
  THREE: [5, 6, 5],
  FOUR: [6, 0, 4],
  FIVEh: [6, 4, 4],
  TWO: [6, 8, 3],
  EIGHT: [7, 0, 5],
  ELEVEN: [7, 5, 6],
  SEVEN: [8, 0, 5],
  TWELVE: [8, 5, 6],
  TENh: [9, 0, 3],
  OCLOCK: [9, 5, 6],
} satisfies Record<string, Span>

type WordKey = keyof typeof WORDS

// Hour words indexed by 12-hour clock number (1..12).
const HOURS: readonly WordKey[] = [
  'TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVEh', 'SIX',
  'SEVEN', 'EIGHT', 'NINE', 'TENh', 'ELEVEN', 'TWELVE',
]

// The minute lead-in for each five-minute mark (0..11 → 0,5,10,…55) and whether
// the phrase reaches forward to the next hour ("… TO") rather than the current.
const MINUTES: readonly { words: readonly WordKey[]; next: boolean }[] = [
  { words: [], next: false }, // :00 — "… o'clock"
  { words: ['FIVEm', 'PAST'], next: false },
  { words: ['TENm', 'PAST'], next: false },
  { words: ['A', 'QUARTER', 'PAST'], next: false },
  { words: ['TWENTY', 'PAST'], next: false },
  { words: ['TWENTY', 'FIVEm', 'PAST'], next: false },
  { words: ['HALF', 'PAST'], next: false },
  { words: ['TWENTY', 'FIVEm', 'TO'], next: true },
  { words: ['TWENTY', 'TO'], next: true },
  { words: ['A', 'QUARTER', 'TO'], next: true },
  { words: ['TENm', 'TO'], next: true },
  { words: ['FIVEm', 'TO'], next: true },
]

/** Read integer H (0-23) and M (0-59) in a timezone, DST-safe, via Intl. */
function readClock(timeZone: string): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  // 'en-GB' 24h renders midnight as 24; fold it back to 0.
  return { h: get('hour') % 24, m: get('minute') }
}

/** The set of lit word keys, plus a spoken sentence, for a given H/M. */
function phraseFor(h: number, m: number): { keys: WordKey[]; sentence: string } {
  const slot = Math.round(m / 5) % 12 // nearest five minutes, 0..11
  const rounded = Math.round(m / 5) // 0..12; 12 means it rolled into the next hour
  const min = MINUTES[slot]
  // Advance the hour when the phrase reads "… TO", or when rounding pushed us
  // past the top of the hour (:58 → the next hour's o'clock).
  const hourShift = (min.next ? 1 : 0) + (rounded === 12 ? 1 : 0)
  const hour12 = ((h + hourShift) % 12) || 12
  const hourKey = HOURS[hour12]

  const keys: WordKey[] = ['IT', 'IS', ...min.words, hourKey]
  if (slot === 0) keys.push('OCLOCK')

  // A clean spoken sentence for the accessible label, e.g. "It is half past six"
  // or "It is six o'clock" — strip the m/h disambiguators and lower-case the words.
  const spoken = keys
    .map((k) => (k === 'OCLOCK' ? "o'clock" : k.replace(/[mh]$/, '').toLowerCase()))
    .join(' ')
  return { keys, sentence: spoken.charAt(0).toUpperCase() + spoken.slice(1) }
}

/** Flatten a set of word keys into the individual "row-col" cells to light. */
function cellsFor(keys: WordKey[]): Set<string> {
  const cells = new Set<string>()
  for (const k of keys) {
    const [r, c, len] = WORDS[k]
    for (let i = 0; i < len; i++) cells.add(`${r}-${c + i}`)
  }
  return cells
}

export interface WordClockProps {
  /** IANA timezone the clock reads. Defaults to Berlin, like the rest of the site. */
  timeZone?: string
  /** Short place label under the grid, e.g. "Berlin". */
  label?: string
  className?: string
}

export function WordClock({ timeZone = 'Europe/Berlin', label = 'Berlin', className }: WordClockProps) {
  const reduce = useReducedMotion()

  const initial = useMemo(() => {
    const { h, m } = readClock(timeZone)
    return phraseFor(h, m)
  }, [timeZone])

  const [lit, setLit] = useState<Set<string>>(() => cellsFor(initial.keys))
  const [sentence, setSentence] = useState(initial.sentence)
  const litRef = useRef<Set<string>>(lit)

  useEffect(() => {
    litRef.current = lit
  }, [lit])

  useEffect(() => {
    // Tick once a second, but only push new state when the lit set actually
    // changes — the phrase turns over four times an hour, so most ticks are no-ops.
    const tick = () => {
      const { h, m } = readClock(timeZone)
      const { keys, sentence: next } = phraseFor(h, m)
      const cells = cellsFor(keys)
      const prev = litRef.current
      let same = cells.size === prev.size
      if (same) {
        for (const c of cells) {
          if (!prev.has(c)) {
            same = false
            break
          }
        }
      }
      if (!same) {
        litRef.current = cells
        setLit(cells)
        setSentence(next)
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [timeZone])

  return (
    <figure className={className}>
      <div
        role="img"
        aria-label={`Word clock — ${sentence} in ${label}`}
        className="mx-auto grid aspect-square w-full max-w-[22rem] grid-cols-11 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:gap-y-1.5 sm:p-6"
      >
        {GRID.map((row, r) =>
          row.split('').map((ch, c) => {
            const on = lit.has(`${r}-${c}`)
            return (
              <motion.span
                key={`${r}-${c}`}
                aria-hidden
                initial={false}
                animate={{
                  opacity: on ? 1 : 0.14,
                  color: on ? '#DCF87C' : '#ffffff',
                  textShadow: on ? '0 0 14px rgba(220,248,124,0.55)' : '0 0 0 rgba(0,0,0,0)',
                }}
                transition={{ duration: reduce ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="select-none text-center font-display text-[clamp(0.8rem,3.4vw,1.35rem)] font-semibold leading-none tracking-[0.06em] tabular-nums"
              >
                {ch}
              </motion.span>
            )
          }),
        )}
      </div>
      {label && (
        <figcaption className="mt-3 flex items-center justify-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/40">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#DCF87C]/70" />
          {label}, in words
        </figcaption>
      )}
      {/* Polite live reading of the time for screen readers, updated only when the
          phrase changes. */}
      <span className="sr-only" aria-live="polite">
        {sentence}
      </span>
    </figure>
  )
}
