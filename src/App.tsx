import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: EASE }}
      className={`mx-auto w-full max-w-3xl px-6 ${className}`}
    >
      {children}
    </motion.section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">{children}</h2>
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A] text-white">
      {/* Ambient animated background */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#DCF87C]/20 blur-[130px]"
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/2 h-[440px] w-[440px] rounded-full bg-emerald-500/10 blur-[130px]"
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Hero */}
      <header className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-[#DCF87C]"
        >
          Berlin · builder
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl"
        >
          Arseniy
          <br />
          Cherednichenko
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-white/60 sm:text-xl"
        >
          Co-founder of Guided, a Socratic AI tutor. I build calm, fast, beautiful products, mostly with React,
          TypeScript, SwiftUI, and a lot of AI.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-9 flex flex-wrap gap-3"
        >
          <a
            href="https://github.com/ArseniyCherednichenko"
            className="rounded-full bg-[#DCF87C] px-6 py-3 font-semibold text-black transition hover:brightness-105"
          >
            GitHub
          </a>
          <a
            href="mailto:ars7ars3@gmail.com"
            className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-white/40"
          >
            Email
          </a>
        </motion.div>
      </header>

      {/* About */}
      <Section className="py-20">
        <Eyebrow>About</Eyebrow>
        <p className="mt-6 text-2xl leading-relaxed text-white/80">
          I&apos;m a student and founder in Berlin. I care about products that feel effortless: real craft in the
          motion, the typography, and the small moments. Right now I&apos;m building Guided, a tutor that teaches by
          asking the right questions instead of handing over answers.
        </p>
      </Section>

      {/* Work */}
      <Section className="py-20">
        <Eyebrow>Selected work</Eyebrow>
        <div className="mt-8 grid gap-5">
          {PROJECTS.map((p) => (
            <motion.a
              key={p.title}
              href={p.href}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="group block rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-[#DCF87C]/40"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-2xl font-bold">{p.title}</h3>
                <span className="text-sm text-white/40">{p.year}</span>
              </div>
              <p className="mt-3 leading-relaxed text-white/60">{p.blurb}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {p.stack.map((s) => (
                  <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                    {s}
                  </span>
                ))}
              </div>
            </motion.a>
          ))}
        </div>
      </Section>

      {/* Toolkit */}
      <Section className="py-20">
        <Eyebrow>Toolkit</Eyebrow>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {SKILLS.map((s) => (
            <span key={s} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75">
              {s}
            </span>
          ))}
        </div>
      </Section>

      <footer className="mx-auto w-full max-w-3xl px-6 py-16 text-white/40">
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

const SKILLS = ['React', 'TypeScript', 'SwiftUI', 'Tailwind', 'Framer Motion', 'Supabase', 'Vite', 'Node']
