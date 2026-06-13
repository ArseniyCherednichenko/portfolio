import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { TextReveal } from '../components/TextReveal'
import { Divider } from '../components/Divider'
import { Breadcrumb } from '../components/Breadcrumb'
import { LocalClock } from '../components/LocalClock'
import { SocialLinks } from '../components/SocialLinks'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useMeta } from '../hooks/useMeta'

const EASE = [0.16, 1, 0.3, 1] as const

// A "now" page in the spirit of nownownow.com — a public snapshot of what has
// my attention at the moment, kept deliberately short and honest. It is the
// human counterpart to the work pages: less portfolio, more present tense.

interface Focus {
  label: string
  title: string
  body: string
}

const FOCUS: Focus[] = [
  {
    label: 'Building',
    title: 'Guided, day to day',
    body: 'Most of my hours go to Guided — the Socratic AI tutor I co-founded. Right now that means sharpening the prompting so it guides without giving the answer away, and making the web and iOS apps feel like one calm product.',
  },
  {
    label: 'Sharpening',
    title: 'This site, a little every day',
    body: 'This portfolio is my open playground for motion and interface ideas. A daily habit: build one original, hand-made component, keep it honest, keep it fast. The thing you are reading is the proof of work.',
  },
  {
    label: 'Studying',
    title: 'Still a student',
    body: 'I am a student in Berlin, so school runs alongside the building. A lot of what I learn about how people actually study feeds straight back into Guided.',
  },
  {
    label: 'Curious about',
    title: 'Calm interfaces for AI',
    body: 'The problem I keep circling: how to make a screen feel composed while a model is thinking. Optimistic UI, motion that covers latency, type and spacing that stay legible under load. Less spinner, more poise.',
  },
]

export default function Now() {
  useDocumentTitle('Now — Arseniy Cherednichenko')
  useMeta(
    'What Arseniy Cherednichenko is focused on right now: building Guided, studying in Berlin, and keeping this site a living playground.',
  )
  return (
    <article id="main" tabIndex={-1} className="outline-none">
      <header className="mx-auto w-full max-w-4xl px-6 pb-10 pt-36 sm:pt-44">
        <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Now' }]} />
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-8 text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl"
        >
          What I&apos;m <GradientText>doing now</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          A snapshot of what has my attention at the moment, not a resume. It is a{' '}
          <a
            href="https://nownownow.com/about"
            target="_blank"
            rel="noreferrer"
            className="text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-[#DCF87C]"
          >
            now page
          </a>
          , so it goes out of date on purpose and gets rewritten when life moves.
        </motion.p>
      </header>

      {/* LIVE CLOCK */}
      <section className="mx-auto w-full max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
        >
          <LocalClock />
        </motion.div>
      </section>

      {/* FOCUS LIST */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]">
          {FOCUS.map((f, i) => (
            <Reveal key={f.label} delay={i * 0.05}>
              <div className="grid gap-3 bg-[#0A0A0A] p-7 sm:grid-cols-[10rem_1fr] sm:gap-8 sm:p-9">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{f.label}</p>
                <div>
                  <h2 className="text-xl font-semibold text-white/90">{f.title}</h2>
                  <p className="mt-2 text-lg leading-relaxed text-white/55">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <Divider />
      <section className="mx-auto w-full max-w-4xl px-6 py-28 text-center">
        <Reveal>
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <TextReveal text="If any of this overlaps with you, say hello." />
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/55">
            More background on the{' '}
            <Link to="/about" className="text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-[#DCF87C]">
              about page
            </Link>
            , or reach me directly.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <SocialLinks className="mt-10 justify-center" />
        </Reveal>
      </section>
    </article>
  )
}
