import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { ProjectPoster } from '../components/ProjectPoster'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { RotatingWord } from '../components/RotatingWord'
import { SpotlightCard } from '../components/SpotlightCard'
import { Marquee } from '../components/Marquee'
import { MagneticButton } from '../components/MagneticButton'
import { HeroOrbit } from '../components/HeroOrbit'
import { ScrollCue } from '../components/ScrollCue'
import { Eyebrow } from '../components/Eyebrow'
import { useContact } from '../components/ContactDialog'
import { PROJECTS, SKILLS, type Project } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

export default function Home() {
  const [active, setActive] = useState<Project | null>(null)
  const navigate = useNavigate()
  const { open: openContact } = useContact()
  return (
    <>
      {/* HERO */}
      <header className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6">
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
          <Link
            to="/playground"
            className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
          >
            Playground
          </Link>
        </motion.div>
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
          <Link
            to="/about"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            More about me
            <span aria-hidden>-&gt;</span>
          </Link>
        </Reveal>
      </section>

      {/* WORK */}
      <section id="work" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>Selected work</Eyebrow>
            <Link
              to="/work"
              className="text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
            >
              All work <span aria-hidden>-&gt;</span>
            </Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PROJECTS.map((p, idx) =>
            p.soon ? (
              <Reveal key={p.title} delay={idx * 0.05}>
                <div className="flex h-full min-h-[210px] flex-col justify-between rounded-3xl border border-dashed border-white/15 p-8 text-white/40">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">In progress</span>
                  <div>
                    <h3 className="text-2xl font-bold text-white/55">{p.title}</h3>
                    <p className="mt-2 text-sm">{p.blurb}</p>
                  </div>
                </div>
              </Reveal>
            ) : (
              <Reveal key={p.title} delay={idx * 0.05}>
                <SpotlightCard className="h-full">
                  <button
                    onClick={() => setActive(p)}
                    className="flex h-full w-full flex-col justify-between p-8 text-left"
                  >
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
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#DCF87C]">Read more</span>
                  </button>
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
        <Reveal delay={0.18}>
          <button
            type="button"
            onClick={openContact}
            className="mt-6 text-sm font-medium text-white/45 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
          >
            Other ways to reach me
          </button>
        </Reveal>
      </section>

      <Modal open={active !== null} onClose={() => setActive(null)}>
        {active && (
          <div>
            <ProjectPoster project={active} className="mb-6 aspect-[16/9] w-full" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
              {active.year || 'Project'}
            </span>
            <h3 className="mt-2 text-3xl font-bold">{active.title}</h3>
            <p className="mt-4 leading-relaxed text-white/65">{active.detail}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {active.stack.map((s) => (
                <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  const slug = active.slug
                  setActive(null)
                  navigate(`/work/${slug}`)
                }}
                className="rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black"
              >
                Read the full case study
              </button>
              {active.href && (
                <a
                  href={active.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  Visit
                </a>
              )}
              {active.repo && (
                <a
                  href={active.repo}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  Source
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
