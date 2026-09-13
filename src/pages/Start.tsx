import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { SpotlightCard } from '../components/SpotlightCard'
import { MagneticButton } from '../components/MagneticButton'
import { Squares } from '../components/Squares'
import { useContact } from '../components/ContactDialog'
import { Seo } from '../components/Seo'

const EASE = [0.16, 1, 0.3, 1] as const

// A curated destination inside one path.
interface Stop {
  label: string
  to: string
  meta: string
}

// The four ways people actually arrive at a site this size — framed by intent,
// not by the sitemap. Each path is an honest, first-person route through the
// breadth, so no single project (Guided included) is ever the whole story. The
// links all point at real pages; nothing here is aspirational.
interface Path {
  tag: string
  title: string
  body: string
  stops: Stop[]
}

const PATHS: Path[] = [
  {
    tag: 'For hiring & collaboration',
    title: 'You want to know if I can build the thing',
    body: 'Start with what I have shipped and how I work, then the one-page version and a way to reach me.',
    stops: [
      { label: 'Work', to: '/work', meta: 'Projects, each with a case study' },
      { label: 'The range', to: '/range', meta: 'The disciplines I cover' },
      { label: 'Résumé', to: '/resume', meta: 'One page, printable' },
      { label: 'Contact', to: '/contact', meta: 'The fastest way in' },
    ],
  },
  {
    tag: 'For the craft',
    title: 'You care how an interface moves and feels',
    body: 'This is where the site argues for itself — live motion you can poke at, and the thinking behind it.',
    stops: [
      { label: 'Playground', to: '/playground', meta: 'Hand-built motion, interactive' },
      { label: 'On motion', to: '/craft', meta: 'Notes on animation, playable' },
      { label: 'Design language', to: '/design', meta: 'Palette, type, and motion tokens' },
      { label: 'The reel', to: '/reel', meta: 'A full-screen showreel' },
    ],
  },
  {
    tag: 'For the quick version',
    title: 'You have about thirty seconds',
    body: 'The short, honest story: who I am, what I build, and what I am on right now.',
    stops: [
      { label: 'About', to: '/about', meta: 'The story and the path' },
      { label: 'Bio', to: '/bio', meta: 'Copyable, for an introduction' },
      { label: 'Now', to: '/now', meta: 'What I am focused on' },
      { label: 'Answers', to: '/answers', meta: 'The questions people ask' },
    ],
  },
  {
    tag: 'For the curious',
    title: 'You would rather just wander',
    body: 'The site got big on purpose. Lose the map, or take the whole thing a page at a time.',
    stops: [
      { label: 'Wander', to: '/wander', meta: 'A page, dealt at random' },
      { label: 'Atlas', to: '/atlas', meta: 'The site as a constellation' },
      { label: 'Index', to: '/contents', meta: 'Every page, in one place' },
      { label: 'The library', to: '/library', meta: 'Every component, catalogued' },
    ],
  },
]

// The honest one-breath summary. Every fact here is stated elsewhere on the
// site, so it can never drift — and Guided is one line of several, not the lede.
const FACTS: ReadonlyArray<readonly [string, string]> = [
  ['Based in', 'Berlin'],
  ['Building', 'Guided — a Socratic AI tutor'],
  ['Working in', 'React, TypeScript, SwiftUI, applied AI'],
  ['Still', 'a student, learning in the open'],
]

// One path rendered as a card: a glowing surface with a small ledger of real
// destinations, each link sliding its arrow on hover. SpotlightCard supplies
// the cursor glow and already respects prefers-reduced-motion.
function PathCard({ path }: { path: Path }) {
  return (
    <SpotlightCard className="h-full">
      <div className="flex h-full flex-col p-7 sm:p-8">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">
          {path.tag}
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold leading-[1.12] tracking-tight text-white sm:text-3xl">
          {path.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{path.body}</p>

        <ul className="mt-6 space-y-px overflow-hidden rounded-2xl border border-white/10">
          {path.stops.map((stop) => (
            <li key={stop.to}>
              <Link
                to={stop.to}
                className="group/stop flex items-center justify-between gap-4 bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#DCF87C]/60"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white/90">{stop.label}</span>
                  <span className="block truncate text-xs text-white/45">{stop.meta}</span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 translate-x-0 text-[#DCF87C] opacity-40 transition-all duration-300 ease-out group-hover/stop:translate-x-1 group-hover/stop:opacity-100"
                >
                  &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SpotlightCard>
  )
}

export default function Start() {
  const reduce = useReducedMotion()
  const { open: openContact } = useContact()

  return (
    <>
      <Seo
        title="Start here"
        description="New to the site? A short, honest guide from Arseniy Cherednichenko — four ways in, by what brought you: hiring, the craft, the quick version, or just wandering."
      />

      {/* HEADER */}
      <header className="relative isolate mx-auto w-full max-w-5xl overflow-hidden px-6 pb-12 pt-36 sm:pt-44">
        {/* A faint animated grid, masked toward the top-right so it frames the
            title without competing with the copy. Matches the Index page's
            ambient texture; Squares already stills under reduced motion. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(115%_75%_at_78%_12%,#000_0%,transparent_66%)]"
        >
          <Squares size={54} />
        </div>

        <Reveal>
          <Eyebrow>Start here</Eyebrow>
        </Reveal>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
          <SplitText as="span" text="Where to" trigger="mount" delay={0.05} className="block" />
          <SplitText as="span" text="begin." gradient trigger="mount" delay={0.22} className="block" />
        </h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          This site grew large on purpose — it is meant to be evidence, not a
          brochure. So rather than drop you at the front door, here is an honest
          map. Pick the path that matches what brought you.
        </motion.p>
      </header>

      {/* THE 30-SECOND VERSION */}
      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <Reveal>
          <SpotlightCard>
            <div className="p-7 sm:p-9">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
                The short version
              </span>
              <p className="mt-5 max-w-3xl font-display text-2xl font-medium leading-snug text-white/85 sm:text-3xl">
                I am Arseniy — I build{' '}
                <GradientText>products with real craft</GradientText>, across the
                web, iOS, and the data underneath, with a lot of applied AI in
                between.
              </p>
              <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {FACTS.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                      {label}
                    </dt>
                    <dd className="text-base text-white/80">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </SpotlightCard>
        </Reveal>
      </section>

      {/* CHOOSE A PATH */}
      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <Reveal>
          <Eyebrow>Choose a path</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/55">
            Four honest ways in. Each one routes you through the breadth of the
            work, not back to any single project.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PATHS.map((path, i) => (
            <motion.div
              key={path.tag}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, ease: EASE, delay: Math.min(i * 0.07, 0.28) }}
            >
              <PathCard path={path} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-28 pt-10 text-center">
        <Reveal>
          <p className="mx-auto max-w-xl font-display text-2xl font-medium leading-snug text-white/80 sm:text-3xl">
            Still not sure? The fastest path is a message.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
            >
              Say hello
            </MagneticButton>
            <button
              type="button"
              onClick={openContact}
              className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Other ways to reach me
            </button>
          </div>
        </Reveal>
      </section>
    </>
  )
}
