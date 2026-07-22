import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { MagneticButton } from '../components/MagneticButton'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { ProjectPoster } from '../components/ProjectPoster'
import { PixelTransition } from '../components/PixelTransition'
import { ProjectQuickLook } from '../components/ProjectQuickLook'
import { Seo } from '../components/Seo'
import { PROJECTS, CASE_STUDIES, type Project } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

// A row in the work ledger. Real projects offer two ways in — a quick-look
// modal (the poster and the "Quick look" pill) for a fast preview, and a link
// through to the full case study — so browsing stays light without hiding the
// depth. The placeholder is a calm, non-clickable "in progress" row.
function WorkRow({
  project,
  index,
  onQuickLook,
}: {
  project: Project
  index: number
  onQuickLook: (p: Project) => void
}) {
  const num = String(index + 1).padStart(2, '0')

  if (project.soon) {
    return (
      <div className="group relative border-t border-white/10 py-8 sm:py-10">
        <div className="flex items-baseline gap-5 sm:gap-8">
          <span className="w-9 shrink-0 text-sm font-semibold tabular-nums text-white/20">{num}</span>
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white/35 sm:text-5xl">{project.title}</h2>
            <p className="mt-3 max-w-md text-sm text-white/30">{project.blurb}</p>
            <span className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-white/25">
              In progress
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative border-t border-white/10 py-8 transition-colors hover:bg-white/[0.015] sm:py-10">
      {/* Lime edge that grows in on hover. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 rounded-full bg-[#DCF87C] transition-transform duration-500 ease-out group-hover:scale-y-100"
      />
      <div className="flex items-start gap-5 sm:gap-8">
        <span className="w-9 shrink-0 pt-2 text-sm font-semibold tabular-nums text-white/30 transition-colors group-hover:text-[#DCF87C] sm:pt-4">
          {num}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              <Link
                to={`/work/${project.slug}`}
                className="inline-block transition-transform duration-500 ease-out hover:text-white group-hover:translate-x-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {project.title}
              </Link>
            </h2>
            <span className="shrink-0 text-sm tabular-nums text-white/35">{project.year}</span>
          </div>

          <p className="mt-3 max-w-xl leading-relaxed text-white/55">{project.blurb}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
            {project.role && (
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{project.role}</span>
            )}
            {project.role && project.stack.length > 0 && (
              <span aria-hidden className="hidden text-white/15 sm:inline">
                ·
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              {project.stack.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/55"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={() => onQuickLook(project)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:bg-white/[0.04] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
              aria-label={`Quick look at ${project.title}`}
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#DCF87C]" />
              Quick look
            </button>
            <Link
              to={`/work/${project.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
            >
              Read the case study
              <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
                -&gt;
              </span>
            </Link>
          </div>
        </div>

        {/* Generative poster preview — click it for a quick look. Hover and the
            pixels dissolve to a lime card carrying a highlight; the same
            treatment on every real project, so no single one is framed as the
            whole story. */}
        <div className="hidden w-40 shrink-0 self-center md:block lg:w-52">
          <button
            type="button"
            onClick={() => onQuickLook(project)}
            aria-label={`Quick look at ${project.title}`}
            className="block w-full transition-transform duration-500 ease-out hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <PixelTransition
              className="aspect-[4/3] w-full"
              front={<ProjectPoster project={project} className="h-full w-full" rounded="rounded-2xl" />}
              back={
                <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-gradient-to-br from-[#DCF87C] to-[#c2e85a] p-4 text-black">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/60">
                    {project.year}
                  </span>
                  <p className="font-display text-sm font-bold leading-snug">
                    {project.highlights?.[0] ?? project.blurb}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                    Quick look <span aria-hidden>-&gt;</span>
                  </span>
                </div>
              }
            />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Work() {
  const reduce = useReducedMotion()
  const [preview, setPreview] = useState<Project | null>(null)

  return (
    <>
      <Seo
        title="Work"
        description="Selected work from Arseniy Cherednichenko — a ledger of the products and case studies he has shipped, led by Guided."
      />
      {/* INTRO */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-12 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Work</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Things I have <GradientText>built.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          A small, honest set of projects. Real products I have designed and shipped, plus this site itself. Each one
          has a full write-up of what it is and what I made.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-10 flex items-end gap-3"
        >
          <AnimatedCounter
            value={CASE_STUDIES.length}
            className="text-5xl font-bold leading-none text-[#DCF87C] sm:text-6xl"
          />
          <span className="pb-1 text-sm leading-snug text-white/45">
            shipped
            <br />
            and counting
          </span>
        </motion.div>
      </header>

      {/* LEDGER */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-8">
        <ul className="mt-4">
          {PROJECTS.map((p, i) => (
            <motion.li
              key={p.slug}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, ease: EASE, delay: Math.min(i * 0.06, 0.24) }}
            >
              <WorkRow project={p} index={i} onQuickLook={setPreview} />
            </motion.li>
          ))}
        </ul>
        <div className="border-t border-white/10" />
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Have something
            <br />
            worth building?
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black"
            >
              Get in touch
            </MagneticButton>
            <Link
              to="/about"
              className="rounded-full border border-white/15 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              About me
            </Link>
          </div>
        </Reveal>
      </section>

      <ProjectQuickLook project={preview} onClose={() => setPreview(null)} />
    </>
  )
}
