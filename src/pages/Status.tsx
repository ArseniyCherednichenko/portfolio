import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Eyebrow } from '../components/Eyebrow'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { SpotlightCard } from '../components/SpotlightCard'
import { GlassSurface } from '../components/GlassSurface'
import { WordClock } from '../components/WordClock'
import { Nixie } from '../components/Nixie'
import { Odometer } from '../components/Odometer'
import { SplitFlap } from '../components/SplitFlap'
import { DayArc } from '../components/DayArc'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { COMPONENT_COUNT, PAGE_COUNT } from '../data/stats'
import { LATEST_LOG } from '../data/latestLog'

const EASE = [0.16, 1, 0.3, 1] as const

// Status — a live instrument panel for the person and the work, not a project.
//
// Every page that shows "the latest" on this site tends to show a *project*.
// This one deliberately shows the opposite: the honest, live state of the maker
// and the ongoing craft, read off the site's own hand-built display components.
// Nothing here is a static claim — the Nixie clock and the word clock tick in
// real Berlin time, the presence dot runs the same soft awake heuristic the rest
// of the site shares (never a promise), the odometer rolls the true library
// count, and the readout board flips between an honest rest/build state. It is
// the site's many "instrument" pieces (Nixie, WordClock, SplitFlap, Odometer,
// DayArc) turned on real data about Arseniy himself — so it de-centres any one
// product and reads as him, continuously building in the open.

// A live cold-cathode clock in Berlin time, HH:MM, built on the shared hook so
// it never disagrees with the status dots and the DayArc elsewhere on the site.
function NixieClock() {
  const { time } = useBerlinTime()
  const hhmm = time.slice(0, 5) // "HH:MM" from "HH:MM:SS"
  return <Nixie value={hhmm} height={104} className="justify-center" />
}

// The honest, soft state word — the same awake heuristic as everywhere else,
// framed as a probable rhythm rather than a schedule. Flips on the split-flap
// board so the single most human fact on the page arrives mechanically.
function StateBoard() {
  const { awake } = useBerlinTime()
  return (
    <SplitFlap
      value={awake ? 'BUILDING' : 'RESTING'}
      height={48}
      width={34}
      className="justify-center"
      aria-label={awake ? 'Probably building right now' : 'Probably resting right now'}
    />
  )
}

// A live presence pill, mirroring the hero's glass status chip but stated in
// words for this board. The ping ring is reduced-motion aware.
function PresencePill() {
  const { time, awake } = useBerlinTime()
  const reduce = useReducedMotion()
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
      <span className="relative flex h-2 w-2">
        {awake && !reduce && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C] opacity-70" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/30'}`}
        />
      </span>
      <span className="text-sm text-white/70">
        {awake ? 'Around, probably building' : 'Likely asleep'}
      </span>
      <span className="text-sm tabular-nums text-white/35">{time} Berlin</span>
    </div>
  )
}

export default function Status() {
  const latest = LATEST_LOG[0]
  return (
    <>
      <Seo
        title="Status"
        description="A live instrument panel — Berlin local time, presence, and the real, growing shape of the work, read off the site's own hand-built displays."
      />

      {/* HERO */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-16 pt-28 sm:pt-36">
        <Reveal>
          <Eyebrow id="status">Status</Eyebrow>
        </Reveal>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
          <SplitText as="span" text="The live" trigger="mount" className="block" />
          <SplitText as="span" text="state of things." gradient trigger="mount" delay={0.22} className="block" />
        </h1>
        <Reveal delay={0.1}>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/55">
            Not a project, and not a claim frozen in a screenshot. This is the honest, moving state of the
            maker and the work &mdash; the local hour in Berlin, a soft sense of whether I am around, and the
            true shape of the library as it grows. All of it read off the site&rsquo;s own hand-built displays,
            ticking live as you watch.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="mt-8">
            <PresencePill />
          </div>
        </Reveal>
      </header>

      {/* THE BOARD — the live instrument panel */}
      <section id="board" className="mx-auto w-full max-w-5xl px-6 pb-8">
        <Reveal>
          <Eyebrow id="board">Right now</Eyebrow>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-12">
          {/* The clock — the widest tile, the page's beating centre */}
          <Reveal className="lg:col-span-7" delay={0.04}>
            <SpotlightCard className="h-full">
              <GlassSurface radius={24} className="h-full p-7 sm:p-9" sheen>
                <div className="flex h-full flex-col">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                      Berlin, local time
                    </span>
                    <span className="text-xs tabular-nums text-white/35">UTC+1/+2</span>
                  </div>
                  <div className="flex grow items-center justify-center py-8">
                    <NixieClock />
                  </div>
                  <p className="text-center text-sm text-white/45">
                    The same hour everything else on the site reads from.
                  </p>
                </div>
              </GlassSurface>
            </SpotlightCard>
          </Reveal>

          {/* The state word — mechanical, honest */}
          <Reveal className="lg:col-span-5" delay={0.08}>
            <SpotlightCard className="h-full">
              <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-7 sm:p-9">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                  Probably
                </span>
                <div className="flex grow items-center justify-center py-8">
                  <StateBoard />
                </div>
                <p className="text-sm leading-relaxed text-white/45">
                  A typical rhythm, not a schedule. Mornings through late evening, Berlin time, I am usually
                  at the desk.
                </p>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Components counted — the real library size, rolling up */}
          <Reveal className="lg:col-span-4" delay={0.1}>
            <SpotlightCard className="h-full">
              <Link
                to="/library"
                data-cursor
                aria-label={`${COMPONENT_COUNT} hand-built components — browse the library`}
                className="group block h-full rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
              >
                <div className="flex h-full flex-col p-7">
                  <Odometer
                    value={COMPONENT_COUNT}
                    suffix="+"
                    className="font-display text-5xl font-bold leading-none tracking-tight text-[#DCF87C]"
                  />
                  <h3 className="mt-4 text-sm font-semibold text-white/85">Hand-built components</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/45">
                    Catalogued one by one, growing most days.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-white/35 transition-colors group-hover:text-[#DCF87C]">
                    Browse the library
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
                      -&gt;
                    </span>
                  </span>
                </div>
              </Link>
            </SpotlightCard>
          </Reveal>

          {/* Pages counted */}
          <Reveal className="lg:col-span-4" delay={0.12}>
            <SpotlightCard className="h-full">
              <Link
                to="/contents"
                data-cursor
                aria-label={`${PAGE_COUNT} pages — see every one`}
                className="group block h-full rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
              >
                <div className="flex h-full flex-col p-7">
                  <Odometer
                    value={PAGE_COUNT}
                    className="font-display text-5xl font-bold leading-none tracking-tight text-[#DCF87C]"
                  />
                  <h3 className="mt-4 text-sm font-semibold text-white/85">Pages, each its own</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/45">
                    Real routes and custom layouts, every one deep-linkable.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-white/35 transition-colors group-hover:text-[#DCF87C]">
                    See every page
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
                      -&gt;
                    </span>
                  </span>
                </div>
              </Link>
            </SpotlightCard>
          </Reveal>

          {/* A word clock — the time, spelled out in lit cells */}
          <Reveal className="lg:col-span-4" delay={0.14}>
            <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
              <WordClock label="Berlin" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* THE DAY — a presence dial for the whole 24 hours */}
      <section id="day" className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow id="day">The day</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-6 font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
            A day over <GradientText>the city.</GradientText>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/55">
            The same soft rhythm drawn out along a whole day &mdash; midnight at the ends, noon at the apex,
            a marker riding the arc at the live Berlin hour.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <DayArc className="mt-10" />
        </Reveal>
      </section>

      {/* LATEST — the newest thing that shipped, linking into the log */}
      {latest && (
        <section id="latest" className="mx-auto w-full max-w-4xl px-6 pb-28">
          <Reveal>
            <Eyebrow id="latest">Latest</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: EASE }}
              className="mt-8"
            >
              <SpotlightCard>
                <div className="p-7 sm:p-9">
                  <span className="rounded-full border border-[#DCF87C]/25 bg-[#DCF87C]/[0.06] px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#DCF87C]/80">
                    {latest.tag}
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-semibold leading-snug tracking-tight text-white/90 sm:text-3xl">
                    {latest.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/50">{latest.summary}</p>
                  <Link
                    to="/changelog"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
                  >
                    Read the full build log
                    <span aria-hidden>-&gt;</span>
                  </Link>
                </div>
              </SpotlightCard>
            </motion.div>
          </Reveal>
        </section>
      )}
    </>
  )
}
