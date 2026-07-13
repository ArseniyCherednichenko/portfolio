import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { TiltCard } from '../components/TiltCard'
import { SpotlightCard } from '../components/SpotlightCard'
import { MagneticButton } from '../components/MagneticButton'
import { ScrollReveal } from '../components/ScrollReveal'
import { VariableProximity } from '../components/VariableProximity'
import { BentoGrid, BentoCell } from '../components/BentoGrid'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Accordion, type AccordionItem } from '../components/Accordion'
import { Timeline } from '../components/Timeline'
import { ProfileCard } from '../components/ProfileCard'
import { Folder, type FolderPaper } from '../components/Folder'
import { Terminal, type TerminalLine } from '../components/Terminal'
import { useContact } from '../components/ContactDialog'
import { Seo } from '../components/Seo'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { CASE_STUDIES } from '../data/projects'
import { GITHUB_URL } from '../data/contact'

const EASE = [0.16, 1, 0.3, 1] as const

// The other facets of the site, tucked into a folder you open — so About does
// not have to be the last word, and no single project is the whole story.
const FACETS: FolderPaper[] = [
  { label: 'Résumé', hint: 'The one-pager', to: '/resume' },
  { label: 'Writing', hint: 'Notes, in progress', to: '/writing' },
  { label: 'Now', hint: 'What I am on', to: '/now' },
  { label: 'Toolkit', hint: 'What I build with', to: '/toolkit' },
]

// What I'm focused on right now. Keep this honest and current.
const NOW: ReadonlyArray<readonly [string, string]> = [
  ['Building', 'Guided — a Socratic AI tutor, across web, iOS, and the backend.'],
  ['Studying', 'Finishing school in Berlin while shipping real products.'],
  ['Learning', 'Native iOS with SwiftUI, and pushing motion design further.'],
  ['Reading', 'On interface craft, AI, and how good products actually feel.'],
]

// How I work — statements of approach and taste, not metrics.
const PRINCIPLES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Craft is in the details',
    body: 'The motion, the typography, the spacing between things. People feel it long before they can name it.',
  },
  {
    title: 'Ship, then refine',
    body: 'Real products beat perfect plans. I get something working in front of people, then make it better.',
  },
  {
    title: 'Calm over clever',
    body: 'Interfaces should feel effortless. I cut the noise so the important thing is the obvious thing.',
  },
  {
    title: 'Build across the stack',
    body: 'Design, frontend, backend, native. Owning the whole thing keeps the seams invisible.',
  },
]

// An honest, lightweight path. No invented dates or roles.
const PATH: ReadonlyArray<{ when: string; what: string; note: string }> = [
  {
    when: '2026',
    what: 'Co-founded Guided',
    note: 'A Socratic AI tutor for students aged 8 to 18. Curriculum-aware, web plus native iOS.',
  },
  {
    when: '2026',
    what: 'Built this portfolio',
    note: 'Open source. Every animation is a hand-built React and Framer Motion component.',
  },
  {
    when: 'Now',
    what: 'Studying in Berlin',
    note: 'Learning fast, building in public, and looking for hard problems worth solving.',
  },
]

// Disciplines I actually work across — the range, not a single project.
const DISCIPLINES = ['Frontend', 'Native iOS', 'Backend', 'Applied AI', 'Motion']

// Honest answers to the questions people actually ask. No invented availability
// or promises — real facts, framed to show the range beyond any one project.
const QUESTIONS: AccordionItem[] = [
  {
    q: 'What do you actually do?',
    a: 'I build products end to end — the interface, the systems underneath, and increasingly native iOS. Most of that energy goes into Guided right now, but the craft is the constant: design, frontend, backend, and applied AI, held together so the seams stay invisible.',
  },
  {
    q: 'Where are you based?',
    a: 'Berlin. I work remotely and am comfortable collaborating async across time zones — the live clock on this page is mine.',
  },
  {
    q: 'What are you looking for?',
    a: 'Hard problems worth solving, and people who care about the details. I am open to collaboration and conversations that might turn into something. No fixed checklist — if the work is interesting, I want to hear about it.',
  },
  {
    q: 'What do you build with?',
    a: (
      <>
        Mostly React and TypeScript on the web, SwiftUI on iOS, and Supabase
        underneath, with a fair amount of applied AI in between. The full set,
        and why I reach for each tool, lives on the{' '}
        <Link to="/toolkit" className="text-[#DCF87C] underline-offset-4 hover:underline">
          toolkit page
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Can I see the code?',
    a: (
      <>
        Yes. This whole site is open source and grows most days — every
        animation here is a hand-built component, no template.{' '}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[#DCF87C] underline-offset-4 hover:underline"
        >
          It is all on GitHub
        </a>
        .
      </>
    ),
  },
  {
    q: 'How do you like to work?',
    a: 'Close to the problem and in the real thing. I prototype in code early, ship, and refine in the open. Feel matters more to me than how something looks in a static mock — motion and timing are hard to judge any other way.',
  },
]

// The short version, in the medium I actually live in. Every line is an honest
// fact; Guided is one of them, not the frame. Keeps the person in front.
const SHELL: TerminalLine[] = [
  { cmd: 'whoami', out: 'arseniy — builder, co-founder of Guided', hold: 620 },
  { cmd: 'cat location.txt', out: 'Berlin, Germany · remote, async-friendly', hold: 620 },
  {
    cmd: 'ls disciplines/',
    out: (
      <span className="text-[#DCF87C]">frontend  native-ios  backend  applied-ai  motion</span>
    ),
    outText: 'frontend  native-ios  backend  applied-ai  motion',
    hold: 700,
  },
  { cmd: 'cat now.txt', out: 'Building across web, iOS, and the backend. Finishing school.', hold: 700 },
  { cmd: 'echo $PHILOSOPHY', out: 'Motion is meaning, not decoration.', hold: 700 },
  { cmd: 'git log --oneline | wc -l', out: 'this site grows most days — it is all on GitHub', hold: 300 },
]

// A scannable, live snapshot of who and where I am. Honest facts only.
function Snapshot() {
  const reduce = useReducedMotion()
  const { time, awake } = useBerlinTime()
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <Reveal>
        <Eyebrow>At a glance</Eyebrow>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-4 max-w-xl text-lg leading-relaxed text-white/50">
          The short version — where I am, what I build with, and how to find the work.
        </h2>
      </Reveal>

      <BentoGrid className="mt-8">
        {/* LIVE CLOCK — the big cell */}
        <BentoCell className="col-span-2 sm:col-span-2 sm:row-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Local time</p>
          <div className="mt-auto flex flex-col gap-2">
            <span className="font-display text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">{time}</span>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <span className="relative flex h-2 w-2">
                {awake && !reduce && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C]/60" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/30'}`}
                />
              </span>
              <span>Berlin, Germany · {awake ? 'around' : 'probably asleep'}</span>
            </div>
          </div>
        </BentoCell>

        {/* CURRENTLY */}
        <BentoCell className="col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Currently</p>
          <p className="mt-auto text-base leading-snug text-white/80">
            Co-founding <span className="text-white">Guided</span>, and building across web, iOS, and the backend.
          </p>
        </BentoCell>

        {/* DISCIPLINES / RANGE */}
        <BentoCell className="col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">I work across</p>
          <div className="mt-auto flex flex-wrap gap-2">
            {DISCIPLINES.map((d) => (
              <span
                key={d}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/70 transition-colors group-hover:border-[#DCF87C]/30"
              >
                {d}
              </span>
            ))}
          </div>
        </BentoCell>

        {/* SHIPPED COUNTER -> WORK */}
        <BentoCell className="col-span-2 sm:col-span-2">
          <Link to="/work" className="flex h-full flex-col" data-cursor>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Shipped</p>
            <div className="mt-auto flex items-end justify-between gap-3">
              <span className="font-display text-4xl font-bold leading-none">
                <AnimatedCounter value={CASE_STUDIES.length} />
              </span>
              <span className="inline-flex items-center gap-1 text-sm text-white/60 transition-colors group-hover:text-[#DCF87C]">
                See the work
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  -&gt;
                </span>
              </span>
            </div>
          </Link>
        </BentoCell>

        {/* OPEN SOURCE / GITHUB */}
        <BentoCell className="col-span-2 sm:col-span-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex h-full flex-col"
            data-cursor
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Open source</p>
            <div className="mt-auto flex items-end justify-between gap-3">
              <p className="max-w-[16rem] text-base leading-snug text-white/80">
                This whole site is public, and grows most days.
              </p>
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-white/60 transition-colors group-hover:text-[#DCF87C]">
                GitHub
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  -&gt;
                </span>
              </span>
            </div>
          </a>
        </BentoCell>
      </BentoGrid>
    </section>
  )
}

export default function About() {
  const { open: openContact } = useContact()
  return (
    <>
      <Seo
        title="About"
        description="Arseniy Cherednichenko — builder and co-founder of Guided in Berlin. What I am working on now, how I work, and the path that got me here."
      />
      {/* INTRO */}
      <header className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-16 pt-36 sm:pt-44 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Eyebrow>About</Eyebrow>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
            className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
          >
            A builder who <GradientText>sweats the details.</GradientText>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
            className="mt-8 space-y-6 text-lg leading-relaxed text-white/60"
          >
            <p>
              I am Arseniy Cherednichenko, a builder and founder based in Berlin. I co-founded Guided, a Socratic
              AI tutor, and I work across the whole stack: React and TypeScript on the web, SwiftUI on iOS, and a lot
              of applied AI in between.
            </p>
            <p>
              I care about products that feel effortless. The kind where the motion, the typography, and the small
              moments add up to something people trust. This site is where I keep that craft sharp in the open.
            </p>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          className="flex justify-center lg:justify-end"
        >
          <ProfileCard
            name="Arseniy Cherednichenko"
            role="Builder - Co-founder of Guided. I work across web, native iOS, and applied AI."
            location="Berlin, Germany"
            initials="AC"
            status="Building"
            tags={['Frontend', 'Native iOS', 'Backend', 'Applied AI', 'Motion']}
            action={
              <MagneticButton
                onClick={openContact}
                className="w-full rounded-full bg-[#DCF87C] px-5 py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-[#e6ff8f]"
              >
                Get in touch
              </MagneticButton>
            }
          />
        </motion.div>
      </header>

      {/* STATEMENT */}
      <section className="mx-auto w-full max-w-4xl px-6 py-20 sm:py-28">
        <Reveal>
          <Eyebrow>What I am about</Eyebrow>
        </Reveal>
        <ScrollReveal
          className="mt-8 font-display text-3xl font-semibold leading-[1.25] tracking-tight text-white/85 sm:text-5xl sm:leading-[1.2]"
          highlight={['craft', 'motion', 'type', 'feel', 'details']}
        >
          I build for the web and beyond — interfaces that move, products that
          feel considered, and the systems underneath them. I care less about
          any single project than about the craft that carries across all of
          them: motion, type, and the quiet details most people only feel.
        </ScrollReveal>
      </section>

      {/* IN A SHELL — the short version, typed out in the medium I live in */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div>
            <Reveal>
              <Eyebrow>In a shell</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-6 font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                The short version, <GradientText>in my own medium.</GradientText>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
                Same facts as the snapshot below, run through the place I actually spend my days.
                It types itself out when it scrolls into view.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.12}>
            <Terminal lines={SHELL} className="w-full" />
          </Reveal>
        </div>
      </section>

      {/* AT A GLANCE — live, scannable snapshot */}
      <Snapshot />

      {/* NOW */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>Now</Eyebrow>
            <Link
              to="/now"
              className="text-sm text-white/40 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
            >
              Full now page
            </Link>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {NOW.map(([label, body], i) => (
            <Reveal key={label} delay={i * 0.05}>
              <SpotlightCard className="h-full">
                <div className="p-6">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{label}</span>
                  <p className="mt-3 leading-relaxed text-white/70">{body}</p>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>How I work</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-6 max-w-2xl text-2xl font-medium leading-snug text-white/85 sm:text-3xl">
            A few things I keep coming back to.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05}>
              <TiltCard className="h-full">
                <div className="p-7">
                  <span className="text-sm font-semibold text-white/35">0{i + 1}</span>
                  <h3 className="mt-3 text-xl font-bold">{p.title}</h3>
                  <p className="mt-3 leading-relaxed text-white/60">{p.body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1}>
          <p className="mt-8 text-white/50">
            That is the telling.{' '}
            <Link
              to="/craft"
              className="font-semibold text-[#DCF87C] underline-offset-4 hover:underline"
            >
              On motion
            </Link>{' '}
            is the showing — the same beliefs, made playable.
          </p>
        </Reveal>
      </section>

      {/* PATH */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>Path</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <Timeline items={PATH} className="mt-10" />
        </Reveal>
      </section>

      {/* MORE OF ME — a folder that opens to the other facets of the site */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="grid items-center gap-10 sm:grid-cols-[1fr_auto] sm:gap-14">
          <div>
            <Reveal>
              <Eyebrow>More of me</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-6 font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                This page is not <GradientText>the whole story.</GradientText>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
                Open the folder for the other threads — the one-page résumé, notes in progress, what I
                am on right now, and the tools I reach for.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.12}>
            <div className="flex justify-center pt-6 sm:justify-end sm:pt-0">
              <Folder papers={FACETS} label="Open me" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* QUESTIONS */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-6 max-w-2xl text-2xl font-medium leading-snug text-white/85 sm:text-3xl">
            The things people tend to ask.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <Accordion items={QUESTIONS} defaultOpen={0} className="mt-10" />
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <VariableProximity
              text="Want to see the work?"
              className="leading-[1.05] tracking-tight"
            />
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mx-auto mt-5 max-w-md text-white/45">
            Move your cursor across the line above. The whole site is built like this.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <MagneticButton
              href="/#work"
              className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black"
            >
              See selected work
            </MagneticButton>
            <Link
              to="/playground"
              className="rounded-full border border-white/15 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Playground
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
