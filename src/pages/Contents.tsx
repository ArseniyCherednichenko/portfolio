import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Seo } from '../components/Seo'
import { CONTENTS, ALL_CONTENT_ENTRIES, type ContentEntry } from '../data/contents'
import { COMPONENT_COUNT } from './Colophon'

const EASE = [0.16, 1, 0.3, 1] as const

// A single entry card. It links to a real route, shows its go-chord if it has
// one, and slides its arrow on hover. SpotlightCard supplies the cursor glow
// and already respects prefers-reduced-motion.
function EntryCard({ entry, num }: { entry: ContentEntry; num: number }) {
  const label = String(num).padStart(2, '0')
  return (
    <Link
      to={entry.to}
      className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-2xl"
    >
      <SpotlightCard className="flex h-full flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tabular-nums tracking-[0.2em] text-white/25">
            {label}
          </span>
          {entry.chord && (
            <span
              className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/30"
              title={`Press g then ${entry.chord} to jump here`}
            >
              g&nbsp;{entry.chord}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-2xl font-bold tracking-tight text-white">
            {entry.title}
          </h3>
          <span
            aria-hidden
            className="translate-x-0 text-[#DCF87C] opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100"
          >
            &rarr;
          </span>
        </div>

        <p className="text-sm leading-relaxed text-white/55">{entry.blurb}</p>

        <span className="mt-auto pt-2 font-mono text-xs text-white/25 transition-colors group-hover:text-white/45">
          {entry.to}
        </span>
      </SpotlightCard>
    </Link>
  )
}

export default function Contents() {
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()

  // Filter sections by the query, keeping only sections that still have a hit.
  // Numbering follows the full, unfiltered order so a card keeps its index no
  // matter what is typed.
  const numberOf = useMemo(() => {
    const map = new Map<string, number>()
    ALL_CONTENT_ENTRIES.forEach((e, i) => map.set(e.to, i + 1))
    return map
  }, [])

  const filtered = useMemo(() => {
    if (!q) return CONTENTS
    return CONTENTS.map((section) => ({
      ...section,
      entries: section.entries.filter((e) =>
        `${e.title} ${e.blurb} ${e.to} ${section.label}`.toLowerCase().includes(q),
      ),
    })).filter((section) => section.entries.length > 0)
  }, [q])

  const hitCount = filtered.reduce((n, s) => n + s.entries.length, 0)

  return (
    <>
      <Seo
        title="Contents"
        description="An index to Arseniy Cherednichenko's site — every page in one place, grouped and searchable. The whole publication, not just one project."
      />

      {/* HEADER */}
      <header className="mx-auto w-full max-w-5xl px-6 pb-12 pt-36 sm:pt-44">
        <Reveal>
          <Eyebrow>Index</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            <GradientText>Contents</GradientText>
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/55">
            The whole site in one place. It is bigger than any single project — a
            story, a body of work, notes on craft, and a few things built purely
            for the fun of it. Search, or scan the sections.
          </p>
        </Reveal>

        {/* STAT ROW */}
        <Reveal delay={0.15}>
          <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-6">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Pages</dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                <AnimatedCounter value={ALL_CONTENT_ENTRIES.length} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Sections</dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                <AnimatedCounter value={CONTENTS.length} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Components</dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                <AnimatedCounter value={COMPONENT_COUNT} suffix="+" />
              </dd>
            </div>
          </dl>
        </Reveal>

        {/* FILTER */}
        <Reveal delay={0.2}>
          <div className="mt-10 max-w-md">
            <label htmlFor="contents-filter" className="sr-only">
              Filter the site index
            </label>
            <input
              id="contents-filter"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter — try 'motion' or 'contact'"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-white placeholder:text-white/30 transition-colors focus:border-[#DCF87C]/40 focus:outline-none"
            />
            <p aria-live="polite" className="mt-2 px-1 text-xs text-white/30">
              {q
                ? `${hitCount} ${hitCount === 1 ? 'page' : 'pages'} match`
                : `${ALL_CONTENT_ENTRIES.length} pages across ${CONTENTS.length} sections`}
            </p>
          </div>
        </Reveal>
      </header>

      {/* SECTIONS */}
      <main className="mx-auto w-full max-w-5xl px-6 pb-32">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <p className="font-display text-2xl font-semibold text-white/70">Nothing here.</p>
            <p className="mt-2 text-sm text-white/40">
              No page matches &ldquo;{query}&rdquo;. Try a shorter word, or clear the filter.
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-6 rounded-full border border-white/15 px-5 py-2 text-sm text-white/70 transition-colors hover:border-[#DCF87C]/40 hover:text-white"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="space-y-16">
            {filtered.map((section) => (
              <section key={section.label}>
                <div className="mb-6 flex items-baseline gap-4 border-b border-white/10 pb-4">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                    {section.label}
                  </h2>
                  <p className="text-sm text-white/40">{section.intro}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.entries.map((entry, i) => (
                    <motion.div
                      key={entry.to}
                      initial={reduce ? false : { opacity: 0, y: 14 }}
                      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : i * 0.05 }}
                    >
                      <EntryCard entry={entry} num={numberOf.get(entry.to) ?? 0} />
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
