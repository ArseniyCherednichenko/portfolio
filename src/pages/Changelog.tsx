import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { GooeyTabs } from '../components/GooeyTabs'
import { Threads } from '../components/Threads'
import { Seo } from '../components/Seo'
import {
  CHAPTERS,
  KIND_META,
  KIND_ORDER,
  SHIPPED_COUNT,
  type Chapter,
  type EntryKind,
} from '../data/changelog'
import { COMPONENT_COUNT, PAGE_COUNT } from './Colophon'

const EASE = [0.16, 1, 0.3, 1] as const

// The filter tabs: "All" plus one per kind, in KIND_ORDER. Index 0 is All; the
// rest map to KIND_ORDER[index - 1].
const TABS = ['All', ...KIND_ORDER.map((k) => KIND_META[k].label)]

function kindForTab(index: number): EntryKind | null {
  return index === 0 ? null : KIND_ORDER[index - 1] ?? null
}

// A small tag chip for an entry kind. Lime-tinted, quiet, so it reads as
// metadata rather than a button.
function KindChip({ kind }: { kind: EntryKind }) {
  return (
    <span className="shrink-0 rounded-full border border-[#DCF87C]/25 bg-[#DCF87C]/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#DCF87C]/80">
      {KIND_META[kind].label}
    </span>
  )
}

// One chapter block on the spine: a marker node, its heading and summary, and
// the (filtered) list of things that shipped. When a filter hides every item
// the whole chapter fades back so the eye skips it without the layout jumping.
function ChapterBlock({
  chapter,
  filter,
  index,
}: {
  chapter: Chapter
  filter: EntryKind | null
  index: number
}) {
  const items = filter
    ? chapter.items.filter((it) => it.kind === filter)
    : chapter.items
  const empty = items.length === 0

  return (
    <motion.li
      layout
      animate={{ opacity: empty ? 0.28 : 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="relative pl-14 sm:pl-20"
    >
      {/* Spine node */}
      <span className="absolute left-[13px] top-1.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center sm:left-[27px]">
        <span
          className={`h-2.5 w-2.5 rounded-full ring-4 ring-[#0A0A0A] transition-colors duration-500 ${
            empty ? 'bg-white/20' : 'bg-[#DCF87C]'
          }`}
        />
      </span>

      {/* Marker label sitting in the gutter */}
      <span className="absolute left-0 top-0 hidden w-10 text-right font-display text-sm font-semibold tabular-nums text-white/30 sm:block">
        {chapter.marker}
      </span>

      <Reveal delay={Math.min(index, 4) * 0.04}>
        <div className="pb-14">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-sm font-semibold tabular-nums text-white/40 sm:hidden">
              {chapter.marker}
            </span>
            <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {chapter.title}
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/55">
            {chapter.summary}
          </p>

          <ul className="mt-6 space-y-2.5">
            {items.map((it) => (
              <motion.li
                key={it.text}
                layout
                className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
              >
                <KindChip kind={it.kind} />
                <span className="text-[14px] leading-relaxed text-white/70">
                  {it.text}
                </span>
              </motion.li>
            ))}
            {empty && (
              <li className="text-[13px] italic text-white/30">
                Nothing of that kind in this chapter.
              </li>
            )}
          </ul>
        </div>
      </Reveal>
    </motion.li>
  )
}

// The /changelog page: the site's build log. It turns the promise made
// elsewhere — that this thing grows in the open, one improvement at a time —
// into something browsable. Honest chapters, newest first, filterable by the
// kind of work. It is deliberately about the craft of the site itself, a
// living object, not about any one project.
export default function Changelog() {
  const [tab, setTab] = useState(0)
  const filter = kindForTab(tab)

  const matchCount = useMemo(() => {
    if (!filter) return SHIPPED_COUNT
    return CHAPTERS.reduce(
      (n, c) => n + c.items.filter((it) => it.kind === filter).length,
      0,
    )
  }, [filter])

  return (
    <>
      <Seo
        title="Changelog"
        description="The build log for this portfolio — an open-source site that grows one coherent improvement at a time. Honest chapters of what shipped, filterable by the kind of work."
      />

      {/* HEADER */}
      <header className="relative isolate mx-auto w-full max-w-4xl overflow-hidden px-6 pb-8 pt-36 sm:pt-44">
        {/* Ambient thread field, drawn toward the top so it never fights the
            left-aligned copy. Threads settle to a calm static frame under
            reduced motion. */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(120%_80%_at_80%_12%,#000_0%,transparent_66%)]">
          <Threads count={12} amplitude={10} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Changelog</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Built in the <GradientText>open</GradientText>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          This site is open source and grows a little most days, one coherent
          improvement at a time. Here is the build log — not a marketing
          timeline, just what actually shipped, gathered into honest chapters.
        </motion.p>

        {/* STAT ROW — animated counters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-10 grid max-w-lg grid-cols-3 gap-4"
        >
          {[
            { value: COMPONENT_COUNT, label: 'Hand-built components' },
            { value: PAGE_COUNT, label: 'Pages and views' },
            { value: 0, label: 'Templates or copied UI' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-5"
            >
              <AnimatedCounter
                value={s.value}
                className="font-display text-3xl font-bold tabular-nums text-[#DCF87C] sm:text-4xl"
              />
              <p className="mt-1.5 text-[11px] uppercase leading-tight tracking-[0.14em] text-white/40">
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </header>

      {/* FILTER */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-6 pt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="overflow-x-auto">
            <GooeyTabs tabs={TABS} value={tab} onChange={setTab} />
          </div>
          <p className="text-sm text-white/35">
            <span className="tabular-nums text-white/60">{matchCount}</span>{' '}
            {filter ? KIND_META[filter].label.toLowerCase() : ''} entr
            {matchCount === 1 ? 'y' : 'ies'}
          </p>
        </div>
      </section>

      {/* SPINE */}
      <section className="relative mx-auto w-full max-w-4xl px-6 pb-10">
        <ol className="relative">
          {/* The drawn spine behind the nodes */}
          <span
            aria-hidden
            className="absolute bottom-6 left-[13px] top-1.5 w-px bg-gradient-to-b from-[#DCF87C]/40 via-white/10 to-transparent sm:left-[27px]"
          />
          {CHAPTERS.map((chapter, i) => (
            <ChapterBlock
              key={chapter.marker}
              chapter={chapter}
              filter={filter}
              index={i}
            />
          ))}
        </ol>
      </section>

      {/* CLOSING */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
            <p className="max-w-2xl font-display text-2xl leading-snug tracking-tight text-white/80 sm:text-3xl">
              The whole history is public. If you want to see how a change
              really ships, the commits tell the unedited version.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <a
                href="https://github.com/ArseniyCherednichenko/portfolio"
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#DCF87C] px-5 py-2.5 font-semibold text-black transition hover:brightness-105"
              >
                Read the source
              </a>
              <Link
                to="/colophon"
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                How it is built
              </Link>
              <Link
                to="/playground"
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Play with the components
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
