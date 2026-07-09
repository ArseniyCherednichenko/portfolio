import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Lightning } from '../components/Lightning'
import { Seo } from '../components/Seo'
import { GITHUB_URL } from '../data/contact'

const EASE = [0.16, 1, 0.3, 1] as const

// Honest counts of what actually ships in this repo (src/components and
// src/pages). Kept current by the daily routine as the site grows.
const COMPONENT_COUNT = 67
const PAGE_COUNT = 14

// What this specific site runs on, and how each piece is actually used here.
// Honest, in-use only — this is the build, not a generic stack list.
const STACK: ReadonlyArray<{ name: string; note: string }> = [
  {
    name: 'React 18 + Vite',
    note: 'Component model and an instant dev loop. The whole site is a single-page app, built static.',
  },
  {
    name: 'TypeScript, strict',
    note: 'Every prop and data shape is typed. The build fails before a type slip ever ships.',
  },
  {
    name: 'Tailwind v4',
    note: 'Utility styling via the Vite plugin, with a small @theme layer for the lime accent and the display font.',
  },
  {
    name: 'Framer Motion',
    note: 'Every entrance, scroll-reveal, and hover. Springs and eased curves over linear tweens.',
  },
  {
    name: 'React Router v6',
    note: 'Real client-side pages with shared-shell page transitions and deep-linkable routes.',
  },
  {
    name: 'No UI kit',
    note: 'Nothing is pulled off the shelf. The aurora, the cards, the cursor, all hand-built here.',
  },
]

// How the site is made, and the rules it holds itself to.
const PRINCIPLES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Hand-built, never templated',
    body: 'Every motion component is written from scratch. A portfolio about craft should be made with craft, so the site is itself a sample of the work.',
  },
  {
    title: 'Motion that respects you',
    body: 'Everything that moves checks prefers-reduced-motion first and falls back to a calm, static version. Delight is never forced on anyone.',
  },
  {
    title: 'Honest by default',
    body: 'No fabricated clients, metrics, or testimonials. Generative posters stand in for screenshots and never pretend to be real UI.',
  },
  {
    title: 'Open and always growing',
    body: 'The whole thing is public on GitHub and gains one coherent improvement most days, so the commit history is part of the story.',
  },
]

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  return (
    <div>
      <p className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
        <AnimatedCounter value={value} suffix={suffix} />
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/45">{label}</p>
    </div>
  )
}

export default function Colophon() {
  return (
    <>
      <Seo
        title="Colophon"
        description="How this site is built — the stack, the motion principles, and the craft behind Arseniy Cherednichenko's open-source portfolio."
      />

      {/* HEADER */}
      <header className="relative isolate mx-auto w-full max-w-4xl px-6 pb-12 pt-36 sm:pt-44">
        {/* Faint electric filaments behind the title — the engine room reads as
            live current. pointer-events-none + window listener so the copy stays
            selectable; radial-masked and dimmed to fade into the page. */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(130%_90%_at_25%_30%,#000_0%,transparent_72%)]">
          <Lightning listen="window" count={5} intensity={0.7} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Colophon</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Made with the same <GradientText>care as the work.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          A note on how this site is built. It is open source, written from scratch, and grows a
          little most days. No template, no UI kit, no shortcuts that show.
        </motion.p>
      </header>

      {/* STATS */}
      <section className="mx-auto w-full max-w-4xl px-6 py-8">
        <Reveal>
          <div className="grid grid-cols-2 gap-8 rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:grid-cols-3 sm:p-10">
            <Stat value={COMPONENT_COUNT} label="Hand-built components" />
            <Stat value={PAGE_COUNT} label="Pages and views" />
            <Stat value={0} label="Templates, kits, or copied UI" />
          </div>
        </Reveal>
      </section>

      {/* STACK */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>The stack</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            What it runs on.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {STACK.map((item, i) => (
            <Reveal key={item.name} delay={i * 0.05}>
              <SpotlightCard className="h-full">
                <div className="p-6 sm:p-7">
                  <h3 className="text-lg font-bold">{item.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/55">{item.note}</p>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>How it is made</Eyebrow>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] sm:grid-cols-2">
          {PRINCIPLES.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.06}>
              <div className="h-full bg-[#0A0A0A] p-7 transition-colors hover:bg-white/[0.02]">
                <span className="text-sm font-semibold text-white/30">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* TYPE */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>Type</Eyebrow>
        </Reveal>
        <div className="mt-10 grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <SpotlightCard>
              <div className="p-8 sm:p-10">
                <p className="font-display text-6xl font-bold leading-none tracking-tight sm:text-7xl">
                  Aa
                </p>
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                  Fraunces
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  A self-hosted variable serif for headlines. Its optical-size axis tracks the
                  rendered size, so big type stays crisp and small type stays warm.
                </p>
              </div>
            </SpotlightCard>
          </Reveal>
          <Reveal delay={0.08}>
            <SpotlightCard>
              <div className="p-8 sm:p-10">
                <p className="text-6xl font-bold leading-none tracking-tight sm:text-7xl">Aa</p>
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                  Inter
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Carries body copy and every label. Pairing an editorial serif with a clean sans
                  keeps the hierarchy obvious without ever feeling templated.
                </p>
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      </section>

      {/* CLOSING */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <p className="mx-auto max-w-2xl font-display text-2xl font-medium leading-snug text-white/80 sm:text-3xl">
            The best way to read the colophon is the source itself.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105"
            >
              View the source
            </a>
            <Link
              to="/playground"
              className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              See it in motion
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
