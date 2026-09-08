import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SpotlightCard } from './SpotlightCard'
import { LIBRARY } from '../data/library'

// One flat entry: a component paired with its kind (group) and its stable number
// in the catalogue, so the spotlight can echo the Library's own numbering.
interface Entry {
  name: string
  note: string
  tags: string[]
  to?: string
  where?: string
  kind: string
  num: number
}

// Flatten the library once at module load, numbering in catalogue order — the
// same order Library.tsx numbers by, so a spotlighted "No. 47" matches its card.
const ENTRIES: Entry[] = (() => {
  let i = 0
  const out: Entry[] = []
  for (const g of LIBRARY) {
    for (const item of g.items) {
      i += 1
      out.push({ ...item, kind: g.label, num: i })
    }
  }
  return out
})()

// A deterministic "which one today" — the count of whole days since the epoch,
// modulo the catalogue size. It rolls to a new component every calendar day
// without inventing anything: the pick is just the real library, rotated. Not
// random, so a shared link and a screenshot taken the same day agree.
function todaysIndex(len: number): number {
  const now = new Date()
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000)
  return ((day % len) + len) % len
}

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * A single component lifted out of the library and shown large — the day's
 * featured piece, with a "show another" shuffle. The site's argument is that it
 * is made, not assembled; this gives that argument a face each visit rather than
 * a wall of cards. Honest by construction: everything shown is a real entry in
 * `library.ts`, and the daily pick is a rotation, not a claim.
 *
 * `onOpen` (when given) opens the caller's own quick-look for that component —
 * used on the Library page, where the detail modal already lives. Without it the
 * primary action deep-links to `/library?c=Name`, so the spotlight is reusable
 * anywhere on the site.
 */
export function FeaturedComponent({ onOpen }: { onOpen?: (name: string) => void }) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(() => todaysIndex(ENTRIES.length))
  // True once the visitor has shuffled: the eyebrow stops claiming "today".
  const [shuffled, setShuffled] = useState(false)

  const entry = ENTRIES[index]

  function shuffle() {
    if (ENTRIES.length < 2) return
    let next = index
    while (next === index) next = Math.floor(Math.random() * ENTRIES.length)
    setIndex(next)
    setShuffled(true)
  }

  return (
    <SpotlightCard className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            {!reduce && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C] opacity-60" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DCF87C]" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]/80">
            {shuffled ? 'From the library' : 'Component of the day'}
          </span>
        </div>
        <button
          type="button"
          onClick={shuffle}
          className="group/shuffle inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:border-[#DCF87C]/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        >
          <span
            aria-hidden
            className={
              'text-sm leading-none transition-transform duration-500 ' +
              (reduce ? '' : 'group-hover/shuffle:rotate-180')
            }
          >
            &#8635;
          </span>
          Show another
        </button>
      </div>

      {/* The pick crossfades when it changes, so a shuffle reads as a swap, not
          a jump. Keyed on the entry name so AnimatePresence sees a new child. */}
      <div className="mt-6 min-h-[9.5rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={entry.name}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-white/30">
                {String(entry.num).padStart(3, '0')}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/45">
                {entry.kind}
              </span>
              {entry.where && (
                <span className="rounded-md border border-[#DCF87C]/20 bg-[#DCF87C]/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#DCF87C]/70">
                  {entry.where}
                </span>
              )}
            </div>

            <h3 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {entry.name}
            </h3>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/60 line-clamp-4">
              {entry.note}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-white/35"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(entry.name)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#DCF87C] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Take a closer look
            <span aria-hidden>&rarr;</span>
          </button>
        ) : (
          <Link
            to={`/library?c=${encodeURIComponent(entry.name)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#DCF87C] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Take a closer look
            <span aria-hidden>&rarr;</span>
          </Link>
        )}
        {entry.to && (
          <Link
            to={entry.to}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:border-[#DCF87C]/40 hover:text-white"
          >
            See it live on {entry.where}
            <span aria-hidden>&rarr;</span>
          </Link>
        )}
      </div>
    </SpotlightCard>
  )
}
