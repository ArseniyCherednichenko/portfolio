import { motion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { TextReveal } from '../components/TextReveal'
import { Divider } from '../components/Divider'
import { Breadcrumb } from '../components/Breadcrumb'
import { Timeline, type TimelineItem } from '../components/Timeline'
import { CountUp } from '../components/CountUp'
import { SocialLinks } from '../components/SocialLinks'
import { MagneticButton } from '../components/MagneticButton'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const EASE = [0.16, 1, 0.3, 1] as const

export default function About() {
  useDocumentTitle('About — Arseniy Cherednichenko')
  return (
    <article id="main" tabIndex={-1} className="outline-none">
      <header className="mx-auto w-full max-w-4xl px-6 pb-10 pt-36 sm:pt-44">
        <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'About' }]} />
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-8 text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl"
        >
          A bit <GradientText>about me</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          I am a builder and founder based in Berlin. I co-founded Guided, a Socratic AI tutor, and I spend most of my
          days turning ideas into products people can actually hold, mostly in React, TypeScript, and SwiftUI, with a lot
          of AI in the loop.
        </motion.p>
      </header>

      {/* STATS */}
      <section className="mx-auto w-full max-w-4xl px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {STATS.map(([to, suffix, label]) => (
            <Reveal key={label}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                <div className="text-5xl font-bold text-[#DCF87C]">
                  <CountUp to={to as number} suffix={suffix as string} />
                </div>
                <div className="mt-3 text-sm text-white/55">{label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* STORY */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <h2 className="text-3xl font-medium leading-snug text-white/85 sm:text-4xl">
            I care about products that feel effortless, the craft in the motion, the typography, and the small moments
            people feel but cannot name.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 text-lg leading-relaxed text-white/60 sm:grid-cols-2">
          <Reveal delay={0.05}>
            <p>
              I learned to build by shipping. Rather than collect tutorials, I pick a real problem and make the thing,
              then sharpen it with honest feedback until it feels right. Guided is the clearest example, a product I help
              run end to end across web and native iOS.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              The work I enjoy most lives at the seam between design and engineering, making interfaces calm while a model
              is thinking, hiding latency behind motion, and getting the details so right that the technology disappears.
            </p>
          </Reveal>
        </div>
      </section>

      {/* JOURNEY */}
      <Divider />
      <section className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Journey</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mb-12 mt-6 text-4xl font-bold leading-tight sm:text-5xl">
            <TextReveal text="How I got here." />
          </h2>
        </Reveal>
        <Timeline items={JOURNEY} />
      </section>

      {/* CTA */}
      <Divider />
      <section className="mx-auto w-full max-w-4xl px-6 py-28 text-center">
        <Reveal>
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <TextReveal text="Want to build something?" />
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex justify-center">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black"
            >
              Get in touch
            </MagneticButton>
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <SocialLinks className="mt-10 justify-center" />
        </Reveal>
      </section>
    </article>
  )
}

const STATS: ReadonlyArray<readonly [number, string, string]> = [
  [2, '', 'Platforms shipped: web and native iOS'],
  [25, '+', 'Hand-built motion components on this site'],
  [1, '', 'Product co-founded, end to end'],
]

const JOURNEY: TimelineItem[] = [
  {
    when: 'The start',
    title: 'Learning by building',
    body: 'Skipped the tutorial loop and started shipping real things, picking up React, TypeScript, and design by making products instead of reading about them.',
  },
  {
    when: '2025',
    title: 'Co-founded Guided',
    body: 'Set out to build a tutor that asks instead of answers, a Socratic AI for students, curriculum-aware for the German Abitur.',
  },
  {
    when: '2026',
    title: 'Web and iOS',
    body: 'Grew Guided into a React web app and a native SwiftUI iOS app on one shared Supabase backend, with a single design language across both.',
  },
  {
    when: 'Now',
    title: 'Polishing and shipping',
    body: 'Heads-down on getting Guided in front of students, and keeping this site a living playground for the motion ideas I want to keep sharp.',
  },
]
