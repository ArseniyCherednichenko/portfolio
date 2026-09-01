import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { SplitText } from '../components/SplitText'
import { SpotlightCard } from '../components/SpotlightCard'
import { ShinyText } from '../components/ShinyText'
import { DotGrid } from '../components/DotGrid'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Seo } from '../components/Seo'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { USES, USES_REAL_COUNT, LAST_UPDATED, LOCATION } from '../data/uses'

const EASE = [0.16, 1, 0.3, 1] as const

// Format the ISO LAST_UPDATED as "1 September 2026", parsed as UTC so the day
// never shifts with the viewer's timezone. Mirrors the /now page helper.
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

// One entry in a kit — a real daily driver, or an honest blank to fill in.
// The lime dot lights on hover the way the Toolkit cards do, tying the two
// pages together visually while keeping this one about the lived-in setup.
function Item({ name, note, placeholder }: { name: string; note: string; placeholder?: boolean }) {
  return (
    <SpotlightCard className="group h-full">
      <div className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                placeholder
                  ? 'bg-white/20'
                  : 'bg-white/25 group-hover:bg-[#DCF87C]'
              }`}
              aria-hidden
            />
            <h3
              className={`font-display text-lg font-semibold leading-tight tracking-tight transition-transform group-hover:translate-x-0.5 ${
                placeholder ? 'text-white/55' : 'text-white'
              }`}
            >
              {name}
            </h3>
          </div>
          {placeholder && (
            <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
              To fill in
            </span>
          )}
        </div>
        <p
          className={`mt-3 text-[14.5px] leading-relaxed ${
            placeholder ? 'text-white/40' : 'text-white/60'
          }`}
        >
          {note}
        </p>
      </div>
    </SpotlightCard>
  )
}

// The /uses page ("The setup") — the lived-in companion to /now, and the
// uses.tech convention done in the site's own voice. It de-centers any single
// project entirely: its subject is the everyday environment behind all of the
// work. Honest throughout — the real drivers are named, the personal specifics
// are clearly-marked blanks rather than invented gear.
export default function Uses() {
  const reduce = useReducedMotion()
  const { time, awake } = useBerlinTime()
  const updated = formatUpdated(LAST_UPDATED)

  return (
    <>
      <Seo
        title="Uses"
        description="The setup behind the work — the everyday stack, the tools that make this site, and the desk it happens at. A lived-in companion to the now page, from Berlin."
      />

      {/* HEADER */}
      <header className="relative isolate mx-auto w-full max-w-4xl overflow-hidden px-6 pb-10 pt-36 sm:pt-44">
        {/* Interactive dot field, radial-masked to the top-right so it never
            fights the left-aligned copy. Reduced-motion renders a still grid. */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(120%_80%_at_80%_16%,#000_0%,transparent_66%)]">
          <DotGrid gap={30} dotSize={2} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Uses</Eyebrow>
        </motion.div>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          <SplitText as="span" text="The" trigger="mount" delay={0.05} className="mr-3 inline-block" />
          <SplitText as="span" text="setup." gradient trigger="mount" delay={0.16} className="inline-block" />
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          What I actually reach for to build. A{' '}
          <a
            href="https://uses.tech"
            target="_blank"
            rel="noreferrer"
            className="text-[#DCF87C] underline-offset-4 hover:underline"
          >
            uses page
          </a>
          , the lived-in companion to the{' '}
          <Link to="/now" className="text-[#DCF87C] underline-offset-4 hover:underline">
            now page
          </Link>
          : less the full stack, more what is open on the machine day to day. The
          honest bits are filled in; the desk is mine to finish.
        </motion.p>

        {/* DATELINE — live Berlin time + last revised + how much is real */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
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
            <ShinyText tone="lime" speed={6} className="font-semibold uppercase tracking-[0.18em]">
              {LOCATION}
            </ShinyText>
            <span className="tabular-nums text-white/55">{time}</span>
          </span>
          <span className="text-white/30">
            Last revised <span className="text-white/55">{updated}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-white/30">
            <AnimatedCounter value={USES_REAL_COUNT} className="tabular-nums text-white/55" />
            real picks, honestly named
          </span>
        </motion.div>
      </header>

      {/* KITS — one group at a time, real drivers first, the desk last */}
      {USES.map((group, gi) => (
        <section key={group.label} className="mx-auto w-full max-w-4xl px-6 py-10">
          <div className="mb-7 border-t border-white/8 pt-8">
            <Reveal>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm font-semibold tabular-nums text-[#DCF87C]">
                  {String(gi + 1).padStart(2, '0')}
                </span>
                <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  {group.label}
                </h2>
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/50">
                {group.intro}
              </p>
            </Reveal>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.items.map((item, i) => (
              <Reveal key={item.name} delay={i * 0.04}>
                <Item name={item.name} note={item.note} placeholder={item.placeholder} />
              </Reveal>
            ))}
          </div>
        </section>
      ))}

      {/* CLOSING */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
            <p className="max-w-2xl font-display text-2xl leading-snug tracking-tight text-white/80 sm:text-3xl">
              Tools are just tools. The full, grouped stack lives on the{' '}
              <Link to="/toolkit" className="text-[#DCF87C] underline-offset-4 hover:underline">
                toolkit
              </Link>
              , and how this exact page is put together is the{' '}
              <Link to="/colophon" className="text-[#DCF87C] underline-offset-4 hover:underline">
                colophon
              </Link>
              .
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link
                to="/toolkit"
                className="rounded-full bg-[#DCF87C] px-5 py-2.5 font-semibold text-black transition hover:brightness-105"
              >
                The full toolkit
              </Link>
              <Link
                to="/now"
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                What I am on now
              </Link>
              <Link
                to="/colophon"
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                How the site is built
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
