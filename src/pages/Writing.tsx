import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { PixelTrail } from '../components/PixelTrail'
import { SpotlightCard } from '../components/SpotlightCard'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Seo } from '../components/Seo'
import {
  NOTES,
  NOTE_TAGS,
  PUBLISHED_COUNT,
  LATEST_PUBLISHED,
  TOTAL_READING_MINUTES,
  TOPICS_COVERED,
  readingMinutes,
  type Note,
  type NoteTag,
} from '../data/notes'

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

// A single note card. A planned note links to its honest draft page — an
// outline of intent, never a fabricated finished post. A published one shows
// its date and an honest reading time and links to the finished piece. The
// marker and the detail page always tell the truth about where each piece stands.
function NoteCard({ note }: { note: Note }) {
  const planned = note.status === 'planned'
  const minutes = planned ? 0 : readingMinutes(note)
  return (
    <Link
      to={`/writing/${note.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 sm:p-7"
    >
      {/* Faint lime wash that warms in on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#DCF87C]/[0.06] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      {/* Lime edge that grows in on hover, echoing the Work ledger. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 rounded-full bg-[#DCF87C] transition-transform duration-500 ease-out group-hover:scale-y-100"
      />
      <div className="relative flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/80">{note.tag}</span>
        {planned ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/45">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/35" />
            Draft
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs text-white/40">
            <span className="tabular-nums">{note.date}</span>
            {minutes > 0 && (
              <>
                <span aria-hidden className="text-white/20">·</span>
                <span>{minutes} min</span>
              </>
            )}
          </span>
        )}
      </div>

      <h2 className="relative mt-5 font-display text-2xl font-bold leading-tight tracking-tight text-white/90 transition-transform duration-500 ease-out group-hover:translate-x-1 sm:text-[1.7rem]">
        {note.title}
      </h2>
      <p className="relative mt-3 flex-1 text-sm leading-relaxed text-white/55">{note.summary}</p>

      <span className="relative mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/40 transition-colors group-hover:text-[#DCF87C]">
        {planned ? 'See the outline' : 'Read'}
        <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
          -&gt;
        </span>
      </span>
    </Link>
  )
}

// The latest published piece, given an editorial spotlight at the top of the
// index — the way a journal leads with its newest essay. This foregrounds the
// writing itself (his own voice) rather than any single project, and it only
// ever features a genuinely finished piece, never a draft. The cursor spotlight
// and the lime wash warm the whole card as a reader moves toward it.
function FeaturedEssay({ note, reduce }: { note: Note; reduce: boolean | null }) {
  const minutes = readingMinutes(note)
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
    >
      <SpotlightCard className="hover:border-[#DCF87C]/40">
        <Link
          to={`/writing/${note.slug}`}
          className="group/feat block rounded-3xl p-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:p-10 lg:p-12"
          aria-label={`Read the latest piece: ${note.title}`}
        >
          {/* Soft lime wash in the corner, a shade stronger than a normal card —
              this is the lead. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#DCF87C]/[0.08] blur-3xl"
          />
          <div className="relative flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#DCF87C]/30 bg-[#DCF87C]/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/90">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#DCF87C]" />
              Latest
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{note.tag}</span>
            <span aria-hidden className="text-white/20">·</span>
            <span className="text-xs tabular-nums text-white/45">{note.date}</span>
            {minutes > 0 && (
              <>
                <span aria-hidden className="text-white/20">·</span>
                <span className="text-xs text-white/45">{minutes} min read</span>
              </>
            )}
          </div>

          <h2 className="relative mt-6 max-w-2xl font-display text-3xl font-bold leading-[1.08] tracking-tight text-white/95 transition-transform duration-500 ease-out group-hover/feat:translate-x-1 sm:text-5xl">
            {note.title}
          </h2>
          <p className="relative mt-5 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">{note.summary}</p>

          <span className="relative mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity group-hover/feat:opacity-80">
            Read the piece
            <span aria-hidden className="transition-transform duration-300 ease-out group-hover/feat:translate-x-1.5">
              -&gt;
            </span>
          </span>
        </Link>
      </SpotlightCard>
    </motion.div>
  )
}

// Three honest figures about the writing, counted straight from the real prose:
// how many pieces are up, the total reading time they add to, and how many
// topics they span. Nothing invented — each number is derived in data/notes.ts
// and moves only when a genuine piece is published.
function StatsStrip({ reduce }: { reduce: boolean | null }) {
  const stats: ReadonlyArray<{ value: number; suffix?: string; label: string }> = [
    { value: PUBLISHED_COUNT, label: PUBLISHED_COUNT === 1 ? 'piece published' : 'pieces published' },
    { value: TOTAL_READING_MINUTES, suffix: ' min', label: 'of reading, in all' },
    { value: TOPICS_COVERED, label: TOPICS_COVERED === 1 ? 'topic so far' : 'topics so far' },
  ]
  return (
    <motion.dl
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.34, ease: EASE }}
      className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:grid-cols-3"
    >
      {stats.map((s) => (
        <div key={s.label} className="bg-[#0A0A0A] px-6 py-6 sm:px-7">
          <dt className="sr-only">{s.label}</dt>
          <dd>
            <AnimatedCounter
              value={s.value}
              suffix={s.suffix}
              className="font-display text-4xl font-bold leading-none text-[#DCF87C] sm:text-5xl"
            />
            <span className="mt-2 block text-sm leading-snug text-white/50">{s.label}</span>
          </dd>
        </div>
      ))}
    </motion.dl>
  )
}

export default function Writing() {
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState<Filter>('All')

  // On the unfiltered index the newest published piece gets a featured spotlight
  // above the grid, so it is not also repeated as a card below. Choosing a
  // specific topic drops the spotlight and shows every matching piece in the
  // grid, so filtering never quietly hides a piece.
  const featured = filter === 'All' ? LATEST_PUBLISHED : undefined
  const visible = useMemo(
    () =>
      filter === 'All'
        ? NOTES.filter((n) => n.slug !== featured?.slug)
        : NOTES.filter((n) => n.tag === filter),
    [filter, featured],
  )

  return (
    <>
      <Seo
        title="Writing"
        description="Notes from Arseniy Cherednichenko on craft, building in the open, AI, and iOS — a section in progress, written a piece at a time."
      />

      {/* INTRO */}
      <header className="relative isolate mx-auto w-full max-w-4xl px-6 pb-12 pt-36 sm:pt-44">
        {/* Ambient pixel trail behind the title: it lights up in the cursor's
            wake as you move toward reading, echoing notes being set a piece at a
            time. pointer-events-none + window listener so the copy stays
            selectable; radial-masked to fade into the page. */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(120%_90%_at_20%_25%,#000_0%,transparent_70%)]">
          <PixelTrail listen="window" gap={26} radius={46} />
        </div>
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
          I am writing about how I build — the craft, the decisions, the parts that do not fit in a case study.
          A few pieces are up; the rest are honest drafts, each an outline of a topic I actually mean to write, not
          a placeholder pretending otherwise.
        </motion.p>
      </header>

      {/* FEATURED — the newest finished piece leads, like a journal cover.
          Present only when there is a published piece to lead with. */}
      {featured && (
        <section className="mx-auto w-full max-w-4xl px-6 pb-2">
          <FeaturedEssay note={featured} reduce={reduce} />
        </section>
      )}

      {/* STATS — honest, counted-from-the-prose figures, so the section reads as
          a real body of work rather than an empty promise. Shown only once there
          is something published to count. */}
      {PUBLISHED_COUNT > 0 && (
        <section className="mx-auto w-full max-w-4xl px-6 pt-6">
          <StatsStrip reduce={reduce} />
        </section>
      )}

      {/* FILTER */}
      <section className="mx-auto w-full max-w-4xl px-6 pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Eyebrow>{filter === 'All' ? (featured ? 'More writing' : 'Everything') : filter}</Eyebrow>
          <span className="text-xs tabular-nums uppercase tracking-[0.2em] text-white/35">
            {visible.length} {visible.length === 1 ? 'piece' : 'pieces'}
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
          className="mt-4 flex items-center justify-start"
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
            The pieces still marked a draft are marked so on purpose. I would rather show what is coming, honestly,
            than pad this page with things I have not written. When a piece is ready it loses the draft marker and
            gets a date — as the published ones now have — and this whole site is{' '}
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
            {PUBLISHED_COUNT > 0 ? (
              <>
                More is coming.
                <br />
                Meanwhile, the work.
              </>
            ) : (
              <>
                While you wait,
                <br />
                see the work.
              </>
            )}
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
