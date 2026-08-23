import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { Seo } from '../components/Seo'
import { Confetti, type ConfettiHandle } from '../components/Confetti'
import { CONTENTS } from '../data/contents'

const EASE = [0.16, 1, 0.3, 1] as const

// Wander turns the site's depth into a game of chance: instead of a map or an
// index, it deals you one real destination at a time. Every card here points at
// an actual route with its honest one-line blurb — the deck is built straight
// from the /contents source of truth, so it can never drift out of sync or
// invent a page. The point is breadth: no single project carries the site, and
// the fastest way to feel that is to be sent somewhere you would not have
// clicked to.

interface Destination {
  to: string
  title: string
  blurb: string
  section: string
  chord?: string
}

// Flatten the editorial table of contents into a single deck, carrying each
// entry's section label along for context. Wander itself is left out — the deck
// only ever sends you elsewhere.
const DESTINATIONS: Destination[] = CONTENTS.flatMap((s) =>
  s.entries
    .filter((e) => e.to !== '/wander')
    .map((e) => ({ to: e.to, title: e.title, blurb: e.blurb, section: s.label, chord: e.chord })),
)

// Fisher–Yates. Runs only in the browser at interaction time, so Math.random
// is exactly right here — the shuffle should be genuinely different each visit.
function shuffle(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Wander() {
  const reduce = useReducedMotion()
  const [deck, setDeck] = useState<number[]>(() => shuffle(DESTINATIONS.length))
  const [pos, setPos] = useState(0)
  // Sign of the last move, so the card can enter from the direction of travel:
  // dealt up from the deck when advancing, slid back down when reversing.
  const [dir, setDir] = useState(1)

  const total = DESTINATIONS.length
  const atEnd = pos >= total - 1
  const atStart = pos <= 0
  const current = DESTINATIONS[deck[pos]]

  const next = useCallback(() => {
    setDir(1)
    setPos((p) => Math.min(p + 1, total - 1))
  }, [total])

  const prev = useCallback(() => {
    setDir(-1)
    setPos((p) => Math.max(p - 1, 0))
  }, [])

  const reshuffle = useCallback(() => {
    setDir(1)
    setDeck(shuffle(total))
    setPos(0)
  }, [total])

  // Reaching the last card means the whole site has been wandered — an earned
  // moment, so mark it with one confetti burst. The effect fires each time
  // `atEnd` flips true, so a reshuffle-and-finish celebrates again.
  const confettiRef = useRef<ConfettiHandle>(null)
  useEffect(() => {
    if (atEnd) confettiRef.current?.fire()
  }, [atEnd])

  // Keyboard: space / right-arrow deals the next card, left-arrow / backspace
  // steps back, and `s` reshuffles. Bails whenever a field is focused or a
  // modal (the command palette, contact dialog) is open, so it never fights the
  // site's other shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return
      }
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        atEnd ? reshuffle() : next()
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault()
        prev()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        reshuffle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [atEnd, next, prev, reshuffle])

  // The last few dealt cards, newest last, as a revisitable trail.
  const trail = useMemo(() => {
    const start = Math.max(0, pos - 5)
    return deck.slice(start, pos).map((idx, i) => ({ d: DESTINATIONS[idx], at: start + i }))
  }, [deck, pos])

  const progress = ((pos + 1) / total) * 100

  return (
    <>
      <Seo
        title="Wander"
        description="Lose the map. Wander deals you one real page of Arseniy Cherednichenko's site at a time — a game of chance across every corner of the work, the craft, and the person."
      />

      {/* HERO */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-10 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Wander</Eyebrow>
        </motion.div>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
          <SplitText as="span" text="Lose the map." trigger="mount" delay={0.1} className="block" />
          <SplitText as="span" text="Wander instead." gradient trigger="mount" delay={0.32} className="block" />
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-white/60"
        >
          {total} corners of the site, dealt one at a time. No single project is the whole story, so let
          the deck send you somewhere you would not have clicked to. Press{' '}
          <kbd className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-sm font-medium text-white/60">
            space
          </kbd>{' '}
          to deal.
        </motion.p>
      </header>

      {/* THE DECK */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-16">
        <div className="relative mx-auto max-w-2xl">
          {/* Ghost cards behind the top card give the deck real depth. They
              thin out as the deck runs down, so you can feel how much is left. */}
          {!reduce &&
            [2, 1].map((offset) => {
              const remaining = total - 1 - pos
              const show = remaining >= offset
              return (
                <motion.div
                  key={offset}
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-full rounded-3xl border border-white/10 bg-white/[0.015]"
                  animate={{
                    y: show ? offset * 10 : 0,
                    scale: show ? 1 - offset * 0.03 : 1,
                    opacity: show ? 0.5 : 0,
                  }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
              )
            })}

          {/* The live card. */}
          <div className="relative">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={`${deck[pos]}-${pos}`}
                custom={dir}
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, y: dir >= 0 ? 34 : -26, rotate: dir >= 0 ? 2.5 : -2.5, scale: 0.97 }
                }
                animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: dir >= 0 ? -22 : 30, rotate: dir >= 0 ? -2 : 2, scale: 0.98 }}
                transition={{ duration: 0.42, ease: EASE }}
                className="relative"
              >
                <Link
                  to={current.to}
                  className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition-colors hover:border-[#DCF87C]/30 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 sm:p-11"
                >
                  {/* Soft lime bloom that answers the cursor. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#DCF87C]/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#DCF87C]">
                      {current.section}
                    </span>
                    <span className="font-display text-sm font-bold tabular-nums text-white/30">
                      {String(pos + 1).padStart(2, '0')}
                      <span className="text-white/15"> / {String(total).padStart(2, '0')}</span>
                    </span>
                  </div>

                  <h2 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
                    <GradientText>{current.title}</GradientText>
                  </h2>
                  <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/65">{current.blurb}</p>

                  <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C]">
                      Go there
                      <span
                        aria-hidden
                        className="transition-transform duration-300 ease-out group-hover:translate-x-1"
                      >
                        -&gt;
                      </span>
                    </span>
                    <span className="font-mono text-xs text-white/35">{current.to}</span>
                    {current.chord && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-white/35">
                        <kbd className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-0.5 font-sans font-medium text-white/50">
                          g
                        </kbd>
                        <kbd className="rounded border border-white/12 bg-white/[0.03] px-1.5 py-0.5 font-sans font-medium text-white/50">
                          {current.chord}
                        </kbd>
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Fires once when the deck runs out — the whole site wandered. */}
          <Confetti ref={confettiRef} className="z-30" />
        </div>

        {/* Progress rail. */}
        <div className="mx-auto mt-8 max-w-2xl">
          <div className="h-px w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-[#DCF87C]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
            />
          </div>
          <p className="mt-3 text-xs text-white/40">
            {atEnd ? (
              <span className="text-white/60">You have wandered the whole site. Shuffle to go again.</span>
            ) : (
              <>
                {pos + 1} of {total} dealt
              </>
            )}
          </p>
        </div>

        {/* Controls. */}
        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={prev}
            disabled={atStart}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          >
            <span aria-hidden>&lt;-</span> Back
          </button>
          <button
            type="button"
            onClick={atEnd ? reshuffle : next}
            className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-7 py-3 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {atEnd ? 'Shuffle again' : 'Deal another'}
            <span aria-hidden>{atEnd ? '↺' : '→'}</span>
          </button>
          <button
            type="button"
            onClick={reshuffle}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          >
            Shuffle
          </button>
        </div>

        {/* Trail of the last few dealt cards, revisitable. */}
        {trail.length > 0 && (
          <div className="mx-auto mt-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/30">Dealt so far</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {trail.map(({ d, at }) => (
                <button
                  key={`${d.to}-${at}`}
                  type="button"
                  onClick={() => {
                    setDir(at > pos ? 1 : -1)
                    setPos(at)
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-white/55 transition-colors hover:border-white/25 hover:text-white/85"
                >
                  {d.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* PREFER A MAP */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-32">
        <Reveal>
          <div className="flex flex-col items-start gap-4 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-relaxed text-white/50">
              Prefer to steer? The whole site is laid out plainly — as an editorial index, or as a map you
              can drag around.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/contents"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                The index
              </Link>
              <Link
                to="/atlas"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                The atlas
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
