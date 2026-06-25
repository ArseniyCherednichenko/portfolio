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
import { Seo } from '../components/Seo'

const EASE = [0.16, 1, 0.3, 1] as const

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

export default function About() {
  const reduce = useReducedMotion()
  return (
    <>
      <Seo
        title="About"
        description="Arseniy Cherednichenko — builder and co-founder of Guided in Berlin. What I am working on now, how I work, and the path that got me here."
      />
      {/* INTRO */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-16 pt-36 sm:pt-44">
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
          className="mt-8 grid gap-6 text-lg leading-relaxed text-white/60 sm:grid-cols-2"
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

      {/* NOW */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>Now</Eyebrow>
            <span className="text-sm text-white/35">Updated 2026</span>
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
      </section>

      {/* PATH */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>Path</Eyebrow>
        </Reveal>
        <ol className="mt-10 border-l border-white/10">
          {PATH.map((step, i) => (
            <Reveal key={step.what} delay={i * 0.05}>
              <li className="relative pb-10 pl-8 last:pb-0">
                <motion.span
                  className="absolute -left-[6px] top-1.5 h-3 w-3 rounded-full bg-[#DCF87C]"
                  initial={reduce ? false : { scale: 0 }}
                  whileInView={reduce ? undefined : { scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.1 + i * 0.05 }}
                />
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/40">{step.when}</span>
                <h3 className="mt-1 text-2xl font-bold">{step.what}</h3>
                <p className="mt-2 max-w-xl leading-relaxed text-white/55">{step.note}</p>
              </li>
            </Reveal>
          ))}
        </ol>
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
