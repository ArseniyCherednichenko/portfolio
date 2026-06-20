import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { MagneticButton } from '../components/MagneticButton'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { PROJECTS, CASE_STUDIES, type Project } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

// A row in the work ledger. Real projects link to their case study and react
// to hover; the placeholder is a calm, non-clickable "in progress" row.
function WorkRow({ project, index }: { project: Project; index: number }) {
  const num = String(index + 1).padStart(2, '0')

  if (project.soon) {
    return (
      <div className="group relative border-t border-white/10 py-8 sm:py-10">
        <div className="flex items-baseline gap-5 sm:gap-8">
          <span className="w-9 shrink-0 text-sm font-semibold tabular-nums text-white/20">{num}</span>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white/35 sm:text-5xl">{project.title}</h2>
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
    <Link
      to={`/work/${project.slug}`}
      className="group relative block border-t border-white/10 py-8 transition-colors hover:bg-white/[0.015] sm:py-10"
    >
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
            <h2 className="text-3xl font-bold leading-[1.05] tracking-tight transition-transform duration-500 ease-out group-hover:translate-x-1.5 sm:text-5xl">
              {project.title}
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

          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C]">
            Read the case study
            <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
              -&gt;
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Work() {
  const reduce = useReducedMotion()

  return (
    <>
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
          className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
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
              <WorkRow project={p} index={i} />
            </motion.li>
          ))}
        </ul>
        <div className="border-t border-white/10" />
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
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
    </>
  )
}
