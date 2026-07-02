import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { Seo } from '../components/Seo'
import { NOTES, NOTE_TAGS, type Note, type NoteTag } from '../data/notes'

const EASE = [0.16, 1, 0.3, 1] as const

type Filter = 'All' | NoteTag
const FILTERS: Filter[] = ['All', ...NOTE_TAGS]

// A compact, accessible segmented filter. The active pill glides between
// options with a shared layoutId; reduced-motion drops the glide.
function TagFilter({
  value,
  onChange,
  reduce,
}: {
  value: Filter
  onChange: (v: Filter) => void
  reduce: boolean | null
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter notes by topic"
      className="flex flex-wrap gap-1.5 rounded-full border border-white/10 bg-white/[0.02] p-1.5"
    >
      {FILTERS.map((f) => {
        const isActive = f === value
        return (
          <button
            key={f}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(f)}
            className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive ? 'text-black' : 'text-white/55 hover:text-white/85'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={reduce ? undefined : 'writing-filter-pill'}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-[#DCF87C]"
              />
            )}
            <span className="relative z-10">{f}</span>
          </button>
        )
      })}
    </div>
  )
}

// A single note card. Every note is currently `planned`, so the card is a
// calm, non-clickable surface with an honest "Draft" marker — no fake link,
// no fake date, no invented content.
function NoteCard({ note }: { note: Note }) {
  const planned = note.status === 'planned'
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 sm:p-7">
      {/* Faint lime wash that warms in on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#DCF87C]/[0.06] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/80">{note.tag}</span>
        {planned ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/45">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/35" />
            Draft
          </span>
        ) : (
          <span className="text-xs tabular-nums text-white/40">{note.date}</span>
        )}
      </div>

      <h2 className="relative mt-5 font-display text-2xl font-bold leading-tight tracking-tight text-white/90 sm:text-[1.7rem]">
        {note.title}
      </h2>
      <p className="relative mt-3 flex-1 text-sm leading-relaxed text-white/55">{note.summary}</p>

      <span className="relative mt-6 text-xs font-medium uppercase tracking-[0.18em] text-white/30">
        {planned ? 'Writing soon' : 'Read'}
      </span>
    </article>
  )
}

export default function Writing() {
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState<Filter>('All')

  const visible = useMemo(
    () => (filter === 'All' ? NOTES : NOTES.filter((n) => n.tag === filter)),
    [filter],
  )

  return (
    <>
      <Seo
        title="Writing"
        description="Notes from Arseniy Cherednichenko on craft, building in the open, AI, and iOS — a section in progress, written a piece at a time."
      />

      {/* INTRO */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-12 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Writing</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Notes, in the <GradientText>open.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          I am starting to write about how I build — the craft, the decisions, the parts that do not fit in a case
          study. These are the first pieces, honestly still in draft. Each one below is a topic I actually mean to
          write, not a placeholder pretending otherwise.
        </motion.p>
      </header>

      {/* FILTER */}
      <section className="mx-auto w-full max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
          className="flex items-center justify-start"
        >
          <TagFilter value={filter} onChange={setFilter} reduce={reduce} />
        </motion.div>
      </section>

      {/* NOTES */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-8 pt-8">
        <motion.div layout={!reduce} className="grid gap-5 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {visible.map((note, i) => (
              <motion.div
                key={note.slug}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.05, 0.2) }}
              >
                <NoteCard note={note} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {visible.length === 0 && (
          <p className="py-16 text-center text-sm text-white/40">Nothing under that topic yet.</p>
        )}
      </section>

      {/* HONEST NOTE */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-4">
        <Reveal>
          <div className="rounded-2xl border border-white/10 bg-white/[0.015] p-6 text-sm leading-relaxed text-white/45 sm:p-8">
            Everything here is marked a draft on purpose. I would rather show what is coming, honestly, than pad this
            page with things I have not written. When a piece is ready it will lose the draft marker and get a date —
            and this whole site is{' '}
            <Link to="/colophon" className="text-white/70 underline-offset-4 hover:text-[#DCF87C] hover:underline">
              built in the open
            </Link>
            , so you can watch it happen.
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
            While you wait,
            <br />
            see the work.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/work"
              className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black transition-colors hover:bg-[#e6ff9a]"
            >
              See the work
            </Link>
            <Link
              to="/playground"
              className="rounded-full border border-white/15 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Into the playground
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
