import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { DonutChart } from '../components/DonutChart'
import { AreaChart, type AreaDatum } from '../components/AreaChart'
import { Contour } from '../components/Contour'
import { Seo } from '../components/Seo'
import { COMPONENT_COUNT, PAGE_COUNT } from '../data/stats'
import { LIBRARY, ALL_LIBRARY_ITEMS } from '../data/library'
import { CONTENTS } from '../data/contents'
import { CHAPTERS, KIND_META, KIND_ORDER, type EntryKind } from '../data/changelog'

const EASE = [0.16, 1, 0.3, 1] as const

// A single count derived from the site's own data. Nothing here is typed by
// hand — every figure is read off the same files the rest of the site runs on,
// so the page can never drift from the truth it describes.
interface Datum {
  label: string
  value: number
  /** Optional route the row links to, so a bar is also a way in. */
  to?: string
}

/**
 * One horizontal bar in a breakdown. The fill grows from zero to its share of
 * the largest value when the row scrolls into view; the count ticks up beside
 * it. Under reduced motion the bar is simply drawn at full width with the final
 * number already in place — no growth, no tick.
 */
function Bar({
  datum,
  max,
  index,
  reduce,
}: {
  datum: Datum
  max: number
  index: number
  reduce: boolean | null
}) {
  const pct = max > 0 ? (datum.value / max) * 100 : 0
  const label = (
    <span className="flex items-baseline justify-between gap-4">
      <span className="text-sm font-medium text-white/80">{datum.label}</span>
      <span className="font-display text-sm font-bold tabular-nums text-[#DCF87C]">
        {reduce ? (
          datum.value
        ) : (
          <AnimatedCounter value={datum.value} duration={1.1} />
        )}
      </span>
    </span>
  )

  return (
    <div className="group">
      {datum.to ? (
        <Link
          to={datum.to}
          className="block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {label}
        </Link>
      ) : (
        label
      )}
      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#DCF87C]/55 to-[#DCF87C] group-hover:from-[#DCF87C]/70"
          initial={reduce ? false : { width: 0 }}
          whileInView={reduce ? undefined : { width: `${pct}%` }}
          style={reduce ? { width: `${pct}%` } : undefined}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1, ease: EASE, delay: 0.05 + index * 0.06 }}
        />
      </div>
    </div>
  )
}

/** A titled group of bars sharing one scale. */
function Breakdown({
  eyebrow,
  title,
  note,
  data,
  reduce,
}: {
  eyebrow: string
  title: string
  note: string
  data: Datum[]
  reduce: boolean | null
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div>
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/50">{note}</p>
      </Reveal>
      <div className="mt-9 space-y-5">
        {data.map((d, i) => (
          <Bar key={d.label} datum={d} max={max} index={i} reduce={reduce} />
        ))}
      </div>
    </div>
  )
}

export default function Numbers() {
  const reduce = useReducedMotion()

  // Components grouped by the kind of thing they are, largest family first.
  const byCategory = useMemo<Datum[]>(
    () =>
      LIBRARY.map((g) => ({ label: g.label, value: g.items.length })).sort(
        (a, b) => b.value - a.value,
      ),
    [],
  )

  // Pages grouped by the section of the site they belong to.
  const bySection = useMemo<Datum[]>(
    () => CONTENTS.map((s) => ({ label: s.label, value: s.entries.length })),
    [],
  )

  // How much of the build log is each kind of work.
  const byKind = useMemo<Datum[]>(() => {
    const tally = new Map<EntryKind, number>()
    for (const chapter of CHAPTERS) {
      for (const item of chapter.items) {
        tally.set(item.kind, (tally.get(item.kind) ?? 0) + 1)
      }
    }
    return KIND_ORDER.map((k) => ({ label: KIND_META[k].label, value: tally.get(k) ?? 0 })).filter(
      (d) => d.value > 0,
    )
  }, [])

  // The site's growth as a curve: cumulative components shipped, read chapter by
  // chapter from the changelog in chronological order (it is stored newest-first,
  // so reverse it). Each point carries the running total of component-kind entries
  // up to and including that chapter — the honest shape of the making over time.
  const growth = useMemo<AreaDatum[]>(() => {
    let running = 0
    return [...CHAPTERS]
      .reverse()
      .map((chapter) => {
        running += chapter.items.filter((it) => it.kind === 'component').length
        return { label: chapter.marker, value: running }
      })
  }, [])

  // The share of components that are actually on show somewhere reachable.
  const onShow = useMemo(() => {
    const shown = ALL_LIBRARY_ITEMS.filter((i) => i.to).length
    const homes = new Set(ALL_LIBRARY_ITEMS.map((i) => i.to).filter(Boolean)).size
    return { shown, homes, total: ALL_LIBRARY_ITEMS.length }
  }, [])

  const headline: { value: number; suffix?: string; label: string; detail: string }[] = [
    { value: COMPONENT_COUNT, label: 'Components', detail: 'Hand-built React components in the repo.' },
    { value: PAGE_COUNT, label: 'Pages', detail: 'Distinct, deep-linkable routes.' },
    { value: LIBRARY.length, label: 'Categories', detail: 'Families the components sort into.' },
    { value: 0, label: 'Templates', detail: 'No UI kit, no starter, no theme bought in.' },
  ]

  return (
    <div className="w-full pb-28">
      <Seo
        title="By the numbers"
        description="The whole site, counted — every figure read live from the repo's own data files. No estimates, no UI kit, made by hand."
      />

      {/* HEADER — a topographic field under the title, so a page about measuring
          reads as a survey of its own terrain. Radially masked for legibility. */}
      <header className="relative isolate overflow-hidden px-6 pt-32 pb-16 sm:pt-36">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]">
          <Contour className="h-full w-full" count={7} levels={12} />
        </div>
        <div className="mx-auto w-full max-w-4xl">
          <Reveal>
            <Eyebrow>Measured</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl">
              The site, <GradientText>in numbers.</GradientText>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/60">
              No estimates. Every figure on this page is counted live from the repo's own data
              files, the same ones the rest of the site runs on, so the page can never drift from
              what is actually here. It is the honest shape of a thing made by hand.
            </p>
          </Reveal>
        </div>
      </header>

      {/* HEADLINE COUNTS */}
      <section className="mx-auto w-full max-w-4xl px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {headline.map((s, idx) => (
            <Reveal key={s.label} delay={idx * 0.06}>
              <SpotlightCard className="h-full">
                <div className="flex h-full flex-col p-6">
                  <AnimatedCounter
                    value={s.value}
                    className="font-display text-5xl font-bold leading-none tracking-tight text-[#DCF87C]"
                  />
                  <h2 className="mt-4 text-sm font-semibold text-white/85">{s.label}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/45">{s.detail}</p>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* COMPONENTS BY CATEGORY — the centrepiece breakdown, drawn as the site's
          first chart: an animated donut whose legend doubles as the readout. */}
      <section className="mx-auto mt-28 w-full max-w-4xl px-6">
        <Reveal>
          <Eyebrow>The library</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Components, by kind.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/50">
            Every hand-built component sorts into one family. This is the spread — where the making
            has gone deepest, and where there is still room to grow. Hover a slice to read it.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
            <DonutChart data={byCategory} unit="components" centerLabel="components, total" />
          </div>
        </Reveal>
      </section>

      {/* THE BUILD, OVER TIME — the second chart. Where the donut holds a single
          instant, this shows one number moving: the component library growing
          chapter over chapter, drawn as an area curve that wipes itself in. */}
      <section className="mx-auto mt-28 w-full max-w-4xl px-6">
        <Reveal>
          <Eyebrow>Over time</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            The build, chapter by chapter.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/50">
            The same library, seen as a curve instead of a spread: the running total of hand-built
            components at the close of each chapter of the changelog. It only ever climbs. Hover a
            point to read where it stood.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-10">
            <AreaChart data={growth} unit="components" ariaLabel={
              `The cumulative count of hand-built components at the end of each changelog chapter, ` +
              `climbing from ${growth[0]?.value ?? 0} in chapter ${growth[0]?.label ?? '01'} to ` +
              `${growth[growth.length - 1]?.value ?? 0} in chapter ${growth[growth.length - 1]?.label ?? 'now'}.`
            } />
          </div>
        </Reveal>
      </section>

      {/* PAGES BY SECTION */}
      <section className="mx-auto mt-28 w-full max-w-4xl px-6">
        <Breakdown
          eyebrow="The map"
          title="Pages, by section."
          note="The site reads as a small publication. These are its sections and how many pages sit inside each — the same grouping the index uses."
          data={bySection}
          reduce={reduce}
        />
        <Reveal delay={0.1}>
          <Link
            to="/contents"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            Open the full index
            <span aria-hidden>-&gt;</span>
          </Link>
        </Reveal>
      </section>

      {/* BUILD LOG BY KIND */}
      <section className="mx-auto mt-28 w-full max-w-4xl px-6">
        <Breakdown
          eyebrow="In the open"
          title="The build log, by kind."
          note="Every entry in the changelog is tagged by the kind of work it was. This is what the site has actually been made of, chapter over chapter."
          data={byKind}
          reduce={reduce}
        />
        <Reveal delay={0.1}>
          <Link
            to="/changelog"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            Read the changelog
            <span aria-hidden>-&gt;</span>
          </Link>
        </Reveal>
      </section>

      {/* ON SHOW — a single honest proportion */}
      <section className="mx-auto mt-28 w-full max-w-4xl px-6">
        <Reveal>
          <SpotlightCard className="w-full">
            <div className="p-8 sm:p-10">
              <Eyebrow>On show</Eyebrow>
              <p className="mt-5 max-w-2xl font-display text-2xl font-medium leading-snug text-white/85 sm:text-3xl">
                <span className="text-[#DCF87C]">
                  {reduce ? onShow.shown : <AnimatedCounter value={onShow.shown} />}
                </span>{' '}
                of {onShow.total} components are on show somewhere you can reach, spread across{' '}
                <span className="text-[#DCF87C]">
                  {reduce ? onShow.homes : <AnimatedCounter value={onShow.homes} />}
                </span>{' '}
                different pages. The rest wait in the library, ready to be put to work.
              </p>
              <div className="relative mt-8 h-3 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#DCF87C]/55 to-[#DCF87C]"
                  initial={reduce ? false : { width: 0 }}
                  whileInView={
                    reduce ? undefined : { width: `${(onShow.shown / onShow.total) * 100}%` }
                  }
                  style={reduce ? { width: `${(onShow.shown / onShow.total) * 100}%` } : undefined}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 1.1, ease: EASE }}
                />
              </div>
              <Link
                to="/library"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
              >
                Browse the library
                <span aria-hidden>-&gt;</span>
              </Link>
            </div>
          </SpotlightCard>
        </Reveal>
      </section>

      {/* CLOSING */}
      <section className="mx-auto mt-28 w-full max-w-4xl px-6">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center sm:p-14">
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Made, not <GradientText>assembled.</GradientText>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/55">
              The numbers are only interesting because there is no template underneath them. Here is
              how it all fits together, and how it moves.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                to="/colophon"
                className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105"
              >
                How it is built
              </Link>
              <Link
                to="/playground"
                className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                See it in motion
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
