import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { Seo } from '../components/Seo'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { LAST_UPDATED, LOCATION, NOW_ITEMS } from '../data/now'

const EASE = [0.16, 1, 0.3, 1] as const

// Format the ISO LAST_UPDATED date as "1 July 2026" without pulling in a date
// library. Parsed as UTC so the day never shifts by timezone.
function formatUpdated(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

// The /now page: an honest, dated snapshot of what I'm focused on right now.
// A recognised personal-site convention (nownownow.com) — deliberately a
// moment in time, not a permanent bio. It de-centers any single project by
// showing the whole of what a week actually looks like.
export default function Now() {
  const reduce = useReducedMotion()
  const { time, awake } = useBerlinTime()
  const updated = formatUpdated(LAST_UPDATED)

  return (
    <>
      <Seo
        title="Now"
        description="What Arseniy Cherednichenko is focused on right now — building, learning, and thinking about, from Berlin. A dated snapshot, updated by hand."
      />

      {/* HEADER */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-10 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Now</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          What I am <GradientText>focused on</GradientText> right now.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          Not a bio, and not everything I have ever done — just a snapshot of
          this stretch. It is a{' '}
          <a
            href="https://nownownow.com/about"
            target="_blank"
            rel="noreferrer"
            className="text-[#DCF87C] underline-offset-4 hover:underline"
          >
            now page
          </a>
          , the kind you update by hand and let go honestly stale between
          revisions.
        </motion.p>

        {/* DATELINE — live Berlin time + last revised */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/40"
        >
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {awake && !reduce && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C] opacity-60" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/30'}`}
              />
            </span>
            {LOCATION}
            <span className="tabular-nums text-white/55">{time}</span>
          </span>
          <span className="text-white/30">
            Last revised <span className="text-white/55">{updated}</span>
          </span>
        </motion.div>
      </header>

      {/* FOCUS GRID */}
      <section className="mx-auto grid w-full max-w-4xl gap-5 px-6 py-8 sm:grid-cols-2">
        {NOW_ITEMS.map((item, i) => (
          <Reveal key={item.label} delay={i * 0.05}>
            <SpotlightCard className="h-full">
              <div className="flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                    {item.label}
                  </span>
                  {item.placeholder && (
                    <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
                      To fill in
                    </span>
                  )}
                </div>
                <h2 className="mt-4 font-display text-2xl font-semibold leading-tight tracking-tight">
                  {item.title}
                </h2>
                <p
                  className={`mt-3 text-[15px] leading-relaxed ${
                    item.placeholder ? 'text-white/40' : 'text-white/60'
                  }`}
                >
                  {item.body}
                </p>
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </section>

      {/* CLOSING */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
            <p className="max-w-2xl font-display text-2xl leading-snug tracking-tight text-white/80 sm:text-3xl">
              This changes as the work does. For the longer story, the path,
              and how I like to work,{' '}
              <Link
                to="/about"
                className="text-[#DCF87C] underline-offset-4 hover:underline"
              >
                read the about page
              </Link>
              .
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link
                to="/work"
                className="rounded-full bg-[#DCF87C] px-5 py-2.5 font-semibold text-black transition hover:brightness-105"
              >
                See the work
              </Link>
              <Link
                to="/playground"
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Wander the playground
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
