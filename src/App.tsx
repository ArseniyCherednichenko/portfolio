import { motion } from 'framer-motion'
import { Aurora } from './components/Aurora'
import { Nav } from './components/Nav'
import { Reveal } from './components/Reveal'
import { GradientText } from './components/GradientText'
import { RotatingWord } from './components/RotatingWord'
import { SpotlightCard } from './components/SpotlightCard'
import { Marquee } from './components/Marquee'
import { MagneticButton } from './components/MagneticButton'

const EASE = [0.16, 1, 0.3, 1] as const

function Eyebrow({ children }: { children: string }) {
  return <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">{children}</p>
}

export default function App() {
  return (
    <div id="top" className="relative min-h-screen bg-[#0A0A0A] text-white">
      <Aurora />
      <Nav />

      {/* HERO */}
      <header className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6">
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
        </motion.div>
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
      </section>

      {/* WORK */}
      <section id="work" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <Eyebrow>Selected work</Eyebrow>
        </Reveal>
        <div className="mt-10 grid gap-6">
          {PROJECTS.map((p, idx) => (
            <Reveal key={p.title} delay={idx * 0.05}>
              <SpotlightCard className="p-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-3xl font-bold">{p.title}</h3>
                  <span className="text-sm text-white/40">{p.year}</span>
                </div>
                <p className="mt-4 max-w-2xl leading-relaxed text-white/60">{p.blurb}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {p.stack.map((s) => (
                    <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                      {s}
                    </span>
                  ))}
                </div>
                <a href={p.href} className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#DCF87C]">
                  Visit {p.title}
                </a>
              </SpotlightCard>
            </Reveal>
          ))}
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
          {SKILLS.map((s) => (
            <span key={s} className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-lg text-white/75">
              {s}
            </span>
          ))}
        </Marquee>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto w-full max-w-4xl px-6 py-28 text-center">
        <Reveal>
          <h2 className="text-5xl font-bold tracking-tight sm:text-7xl">
            Let us build
            <br />
            something good.
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
      </section>

      <footer className="mx-auto w-full max-w-4xl px-6 py-12 text-sm text-white/35">
        <p>Built by Arseniy Cherednichenko in Berlin.</p>
      </footer>
    </div>
  )
}

interface Project {
  title: string
  year: string
  href: string
  blurb: string
  stack: string[]
}

const PROJECTS: Project[] = [
  {
    title: 'Guided',
    year: '2026',
    href: 'https://askguided.com',
    blurb:
      'A Socratic AI tutor for students aged 8 to 18. It asks the questions that build real understanding instead of giving away answers. Web app plus native iOS, on a shared Supabase backend.',
    stack: ['React', 'TypeScript', 'SwiftUI', 'Supabase'],
  },
]

const SKILLS = ['React', 'TypeScript', 'SwiftUI', 'Tailwind', 'Framer Motion', 'Supabase', 'Vite', 'Node', 'Figma', 'GSAP']
