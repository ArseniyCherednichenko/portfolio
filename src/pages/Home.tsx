import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { RotatingWord } from '../components/RotatingWord'
import { SpotlightCard } from '../components/SpotlightCard'
import { Marquee } from '../components/Marquee'
import { MagneticButton } from '../components/MagneticButton'
import { HeroOrbit } from '../components/HeroOrbit'
import { ScrollCue } from '../components/ScrollCue'
import { TiltCard } from '../components/TiltCard'
import { TextReveal } from '../components/TextReveal'
import { Divider } from '../components/Divider'
import { Accordion, type QA } from '../components/Accordion'
import { Tooltip } from '../components/Tooltip'
import { SocialLinks } from '../components/SocialLinks'
import { CopyButton } from '../components/CopyButton'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PROJECTS } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

function Eyebrow({ children }: { children: string }) {
  return <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">{children}</p>
}

export default function Home() {
  useDocumentTitle('Arseniy Cherednichenko — Builder and Founder')
  return (
    <>
      {/* HERO */}
      <header id="main" tabIndex={-1} className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 outline-none">
        <HeroOrbit />
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/50"
        >
          Berlin · builder · founder
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="text-6xl font-bold leading-[1.02] tracking-tight sm:text-8xl"
        >
          <GradientText>Arseniy</GradientText>
          <br />
          Cherednichenko
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-7 flex flex-wrap items-center gap-2 text-2xl text-white/70 sm:text-3xl"
        >
          <span>I build</span>
          <RotatingWord words={['beautiful products.', 'Socratic AI.', 'calm interfaces.', 'things with craft.']} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-white/55"
        >
          Co-founder of Guided, a Socratic AI tutor. I work mostly in React, TypeScript, and SwiftUI, with a lot of AI.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <MagneticButton href="#work" className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black">
            See my work
          </MagneticButton>
          <MagneticButton
            href="https://github.com/ArseniyCherednichenko"
            className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white"
          >
            GitHub
          </MagneticButton>
          <MagneticButton
            href="https://www.linkedin.com/in/arseniy-cherednichenko-bb3b962b9/"
            className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white"
          >
            LinkedIn
          </MagneticButton>
        </motion.div>
        <motion.button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
        >
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-sans">⌘ K</kbd>
          <span>jump anywhere</span>
        </motion.button>
        <ScrollCue />
      </header>

      {/* ABOUT */}
      <section id="about" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <Eyebrow>About</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-6 text-3xl font-medium leading-snug text-white/85 sm:text-4xl">
            I care about products that feel effortless. Real craft in the motion, the typography, and the small
            moments, the things people feel but cannot name.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {NOW.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{label}</div>
                <div className="mt-2 text-white/80">{value}</div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <Link
            to="/about"
            className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            Read the full story
            <span aria-hidden>-&gt;</span>
          </Link>
        </Reveal>
      </section>

      {/* WORK */}
      <section id="work" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <Eyebrow>Selected work</Eyebrow>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PROJECTS.map((p, idx) =>
            p.soon ? (
              <Reveal key={p.slug} delay={idx * 0.05}>
                <div className="flex h-full min-h-[210px] flex-col justify-between rounded-3xl border border-dashed border-white/15 p-8 text-white/40">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">In progress</span>
                  <div>
                    <h3 className="text-2xl font-bold text-white/55">{p.title}</h3>
                    <p className="mt-2 text-sm">{p.blurb}</p>
                  </div>
                </div>
              </Reveal>
            ) : (
              <Reveal key={p.slug} delay={idx * 0.05}>
                <SpotlightCard className="h-full">
                  <Link to={`/work/${p.slug}`} className="flex h-full w-full flex-col justify-between p-8 text-left">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-2xl font-bold">{p.title}</h3>
                      <span className="text-sm text-white/40">{p.year}</span>
                    </div>
                    <p className="mt-4 leading-relaxed text-white/60">{p.blurb}</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {p.stack.map((s) => (
                        <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                          {s}
                        </span>
                      ))}
                    </div>
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#DCF87C]">
                      Read case study
                      <span aria-hidden>-&gt;</span>
                    </span>
                  </Link>
                </SpotlightCard>
              </Reveal>
            ),
          )}
        </div>
      </section>

      {/* TOOLKIT */}
      <section id="toolkit" className="py-24">
        <div className="mx-auto mb-9 w-full max-w-4xl px-6">
          <Reveal>
            <Eyebrow>Toolkit</Eyebrow>
          </Reveal>
        </div>
        <Marquee>
          {SKILLS.map(([name, note]) => (
            <Tooltip key={name} label={note}>
              <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-lg text-white/75">
                {name}
              </span>
            </Tooltip>
          ))}
        </Marquee>
      </section>

      {/* PLAYGROUND */}
      <section id="playground" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <Eyebrow>Playground</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-6 max-w-2xl text-2xl font-medium leading-snug text-white/80">
            This whole site is hand-built motion. A few of the interactions I make, hover the cards.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Reveal>
            <TiltCard className="flex h-44 flex-col justify-between p-7">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Shine text</span>
              <GradientText className="text-4xl font-bold">handcrafted</GradientText>
            </TiltCard>
          </Reveal>
          <Reveal delay={0.05}>
            <TiltCard className="flex h-44 flex-col justify-between p-7">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Rotating words</span>
              <div className="flex items-center gap-2 text-2xl text-white/80">
                <span>I build</span>
                <RotatingWord words={['motion.', 'interfaces.', 'delight.']} />
              </div>
            </TiltCard>
          </Reveal>
          <Reveal delay={0.1}>
            <TiltCard className="flex h-44 flex-col justify-between p-7">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">3D tilt</span>
              <span className="text-white/60">Cards that lean toward your cursor, like this one.</span>
            </TiltCard>
          </Reveal>
          <Reveal delay={0.15}>
            <TiltCard className="flex h-44 items-center justify-center p-7">
              <MagneticButton href="#contact" className="rounded-full bg-[#DCF87C] px-6 py-3 font-semibold text-black">
                Magnetic button
              </MagneticButton>
            </TiltCard>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <Link
            to="/playground"
            className="mt-10 inline-flex items-center gap-1 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            Open the full playground
            <span aria-hidden>-&gt;</span>
          </Link>
        </Reveal>
      </section>

      {/* APPROACH */}
      <Divider />
      <section id="approach" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <Eyebrow>How I work</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
            <TextReveal text="A few things I believe about building." />
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05}>
              <div className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                <div className="text-3xl font-bold text-[#DCF87C]">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="mt-4 text-xl font-semibold">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-white/55">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <Divider />
      <section id="contact" className="mx-auto w-full max-w-4xl px-6 py-28 text-center">
        <Reveal>
          <h2 className="text-5xl font-bold tracking-tight sm:text-7xl">
            <TextReveal text="Let us build something good." />
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex justify-center">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black"
            >
              ars7ars3@gmail.com
            </MagneticButton>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-4 flex justify-center">
            <CopyButton
              value="ars7ars3@gmail.com"
              label="Copy email"
              className="text-sm text-white/45 hover:text-white"
            />
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <SocialLinks className="mt-10 justify-center" />
        </Reveal>
      </section>

      {/* GOOD TO KNOW */}
      <Divider />
      <section id="faq" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <Eyebrow>Good to know</Eyebrow>
        </Reveal>
        <div className="mt-8">
          <Accordion items={FAQ} />
        </div>
      </section>
    </>
  )
}

const SKILLS: ReadonlyArray<readonly [string, string]> = [
  ['React', 'UI library I build most things in'],
  ['TypeScript', 'typed JavaScript, my default'],
  ['SwiftUI', 'native iOS'],
  ['Tailwind', 'utility-first styling'],
  ['Framer Motion', 'the animations on this site'],
  ['Supabase', 'auth and Postgres backend'],
  ['Vite', 'fast dev and build'],
  ['Node', 'tooling and scripts'],
  ['Figma', 'design'],
  ['GSAP', 'advanced motion'],
]

const NOW: ReadonlyArray<readonly [string, string]> = [
  ['Now', 'Building Guided'],
  ['Based in', 'Berlin'],
  ['Into', 'Motion design, AI, calm software'],
]

const PRINCIPLES: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Calm over flashy', body: 'Motion should guide attention, not fight for it. Every animation has to earn its place.' },
  { title: 'Details are the product', body: 'Type, spacing, timing, the small things people feel but cannot name. That is where quality lives.' },
  { title: 'Ship, then sharpen', body: 'Get it real and in front of people fast, then refine with taste and honest feedback.' },
]

const FAQ: QA[] = [
  { q: 'What do you build with?', a: 'Mostly React, TypeScript, and SwiftUI, with Tailwind and Framer Motion on the front end, and a lot of AI in the loop.' },
  { q: 'Where are you based?', a: 'Berlin.' },
  { q: 'What are you working on now?', a: 'Guided, a Socratic AI tutor for students. I co-founded it and build across web and iOS.' },
  { q: 'Open to collaborating?', a: 'Always happy to talk about good product and design. The fastest way to reach me is email.' },
]
