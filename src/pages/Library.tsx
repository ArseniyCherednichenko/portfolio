import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { LetterGlitch } from '../components/LetterGlitch'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Seo } from '../components/Seo'
import { LIBRARY, ALL_LIBRARY_ITEMS, type LibraryItem } from '../data/library'
import { COMPONENT_COUNT } from './Colophon'

const EASE = [0.16, 1, 0.3, 1] as const

// A single component card. It carries the name, an honest one-liner, its scan
// tags (clickable — they set the filter), and, when the component is on show
// somewhere real, a link straight to that place. When there is a destination
// the whole card is a Link; otherwise it is a plain, non-interactive panel so
// nothing pretends to be clickable that is not.
function ComponentCard({
  item,
  num,
  onTag,
}: {
  item: LibraryItem
  num: number
  onTag: (tag: string) => void
}) {
  const label = String(num).padStart(2, '0')

  const inner = (
    <SpotlightCard className="flex h-full flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tabular-nums tracking-[0.2em] text-white/25">
          {label}
        </span>
        {item.where && (
          <span className="rounded-md border border-[#DCF87C]/20 bg-[#DCF87C]/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#DCF87C]/70">
            {item.where}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-xl font-bold tracking-tight text-white">{item.name}</h3>
        {item.to && (
          <span
            aria-hidden
            className="translate-x-0 text-[#DCF87C] opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100"
          >
            &rarr;
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-white/55">{item.note}</p>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
        {item.tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={(e) => {
              // Keep the tag click from also triggering the card's link.
              e.preventDefault()
              e.stopPropagation()
              onTag(tag)
            }}
            className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-white/35 transition-colors hover:border-[#DCF87C]/40 hover:text-white/70"
          >
            {tag}
          </button>
        ))}
      </div>
    </SpotlightCard>
  )

  if (item.to) {
    return (
      <Link
        to={item.to}
        className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        title={`See ${item.name} on ${item.where}`}
      >
        {inner}
      </Link>
    )
  }
  return <div className="group h-full">{inner}</div>
}

export default function Library() {
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  const q = query.trim().toLowerCase()

  // Stable card numbering by unfiltered order, so a card keeps its index no
  // matter what is filtered in or out.
  const numberOf = useMemo(() => {
    const map = new Map<string, number>()
    ALL_LIBRARY_ITEMS.forEach((it, i) => map.set(it.name, i + 1))
    return map
  }, [])

  const filtered = useMemo(() => {
    return LIBRARY.map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (group && g.label !== group) return false
        if (!q) return true
        return `${it.name} ${it.note} ${it.tags.join(' ')} ${g.label}`.toLowerCase().includes(q)
      }),
    })).filter((g) => g.items.length > 0)
  }, [q, group])

  const hitCount = filtered.reduce((n, g) => n + g.items.length, 0)
  const cleared = !q && !group

  return (
    <>
      <Seo
        title="The library"
        description="Every hand-built component on Arseniy Cherednichenko's site, catalogued and searchable. No template, no UI kit — the whole thing is made, not assembled."
      />

      {/* HEADER */}
      <header className="relative isolate overflow-hidden">
        {/* A field of glyphs — the site as a box of parts. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(120%_80%_at_78%_12%,#000_0%,transparent_66%)]"
        >
          <LetterGlitch fontSize={18} />
        </div>
        <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-36 sm:pt-44">
          <Reveal>
            <Eyebrow>The library</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
              <GradientText>Built by hand, every one.</GradientText>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/55">
              The site&rsquo;s whole argument is that it is made, not assembled. So here
              is the proof, laid out: every component in the repository, written here,
              nothing pulled off a shelf. Search it, filter by kind, or follow a card to
              where the piece is actually on show.
            </p>
          </Reveal>

          {/* STAT ROW */}
          <Reveal delay={0.15}>
            <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-6">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  Components
                </dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                  <AnimatedCounter value={COMPONENT_COUNT} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  Kinds
                </dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                  <AnimatedCounter value={LIBRARY.length} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  Off the shelf
                </dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-[#DCF87C]">
                  <AnimatedCounter value={0} />
                </dd>
              </div>
            </dl>
          </Reveal>

          {/* FILTER */}
          <Reveal delay={0.2}>
            <div className="mt-10 max-w-md">
              <label htmlFor="library-filter" className="sr-only">
                Filter the component library
              </label>
              <input
                id="library-filter"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter — try 'canvas', 'scroll', or 'pointer'"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-white placeholder:text-white/30 transition-colors focus:border-[#DCF87C]/40 focus:outline-none"
              />
              <p aria-live="polite" className="mt-2 px-1 text-xs text-white/30">
                {cleared
                  ? `${ALL_LIBRARY_ITEMS.length} components across ${LIBRARY.length} kinds`
                  : `${hitCount} ${hitCount === 1 ? 'component' : 'components'} match`}
              </p>
            </div>
          </Reveal>

          {/* KIND CHIPS */}
          <Reveal delay={0.25}>
            <div className="mt-6 flex flex-wrap gap-2">
              <GroupChip label="All" active={group === null} onClick={() => setGroup(null)} />
              {LIBRARY.map((g) => (
                <GroupChip
                  key={g.label}
                  label={g.label}
                  count={g.items.length}
                  active={group === g.label}
                  onClick={() => setGroup(group === g.label ? null : g.label)}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </header>

      {/* SECTIONS */}
      <main className="mx-auto w-full max-w-6xl px-6 pb-32">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <p className="font-display text-2xl font-semibold text-white/70">Nothing here.</p>
            <p className="mt-2 text-sm text-white/40">
              No component matches that. Try a shorter word, or clear the filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setGroup(null)
              }}
              className="mt-6 rounded-full border border-white/15 px-5 py-2 text-sm text-white/70 transition-colors hover:border-[#DCF87C]/40 hover:text-white"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-16">
            {filtered.map((g) => (
              <section key={g.label} className="scroll-mt-28">
                <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-white/10 pb-4">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                    {g.label}
                  </h2>
                  <span className="font-mono text-xs text-white/30">
                    {g.items.length}
                    {!q && !group ? '' : ' shown'}
                  </span>
                  <p className="w-full text-sm text-white/40 sm:w-auto">{g.intro}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((item, i) => (
                    <motion.div
                      key={item.name}
                      initial={reduce ? false : { opacity: 0, y: 14 }}
                      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : Math.min(i, 6) * 0.04 }}
                    >
                      <ComponentCard
                        item={item}
                        num={numberOf.get(item.name) ?? 0}
                        onTag={(t) => {
                          setGroup(null)
                          setQuery(t)
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* CLOSING */}
        <div className="mt-24 rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-12 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            <GradientText>See them move.</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/55">
            A catalogue only goes so far. Most of these are alive and pokeable in the
            Playground, and the Colophon explains how the whole thing is put together.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/playground"
              className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-105"
            >
              Open the Playground
            </Link>
            <Link
              to="/colophon"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white"
            >
              How it is built
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}

// A kind filter chip. Lime when active; shows the group's item count so the
// breadth reads at a glance.
function GroupChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ' +
        (active
          ? 'border-[#DCF87C]/50 bg-[#DCF87C]/[0.12] text-[#DCF87C]'
          : 'border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25 hover:text-white/80')
      }
    >
      {label}
      {typeof count === 'number' && (
        <span className="ml-1.5 font-mono text-[10px] text-white/30">{count}</span>
      )}
    </button>
  )
}
