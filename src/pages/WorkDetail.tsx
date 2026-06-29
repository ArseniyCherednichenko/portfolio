import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { MagneticButton } from '../components/MagneticButton'
import { ProjectPoster } from '../components/ProjectPoster'
import { GlareHover } from '../components/GlareHover'
import { Lightbox } from '../components/Lightbox'
import { Seo } from '../components/Seo'
import { CASE_STUDIES, getProject } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

export default function WorkDetail() {
  const { slug } = useParams()
  const reduce = useReducedMotion()
  const [zoom, setZoom] = useState(false)
  const project = getProject(slug)

  if (!project) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col justify-center px-6">
        <Seo title="Project not found" description="That project does not exist, or it has moved. Head back to the work." />
        <Eyebrow>Not found</Eyebrow>
        <h1 className="mt-5 font-display text-5xl font-bold tracking-tight">No such project.</h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-white/55">
          That project does not exist, or it has moved. Head back to the work.
        </p>
        <Link
          to="/work"
          className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
        >
          <span aria-hidden>&lt;-</span> All work
        </Link>
      </div>
    )
  }

  // Prev/next among real case studies for footer navigation.
  const index = CASE_STUDIES.findIndex((p) => p.slug === project.slug)
  const next = CASE_STUDIES[(index + 1) % CASE_STUDIES.length]
  const showNext = next && next.slug !== project.slug

  return (
    <article className="mx-auto w-full max-w-3xl px-6 pb-28 pt-32">
      <Seo title={project.title} description={project.blurb} />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <Link
          to="/work"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/45 transition-colors hover:text-white"
        >
          <span aria-hidden>&lt;-</span> All work
        </Link>
      </motion.div>

      {/* Title block */}
      <header className="mt-8 border-b border-white/10 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/50"
        >
          {project.role && <span className="font-semibold text-[#DCF87C]">{project.role}</span>}
          {project.role && project.year && <span aria-hidden className="text-white/20">·</span>}
          {project.year && <span>{project.year}</span>}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="mt-4 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl"
        >
          <GradientText>{project.title}</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          className="mt-6 max-w-xl text-xl leading-relaxed text-white/65"
        >
          {project.blurb}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.26, ease: EASE }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          {project.href && (
            <MagneticButton
              href={project.href}
              className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black"
            >
              Visit live
            </MagneticButton>
          )}
          {project.repo && (
            <a
              href={project.repo}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              View source
            </a>
          )}
        </motion.div>
      </header>

      {/* Poster: generative brand art, click to expand. */}
      <Reveal className="mt-12">
        <motion.button
          type="button"
          onClick={() => setZoom(true)}
          whileHover={reduce ? undefined : { y: -3 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="group relative block w-full overflow-hidden rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          aria-label={`Expand the ${project.title} visual`}
        >
          <GlareHover trigger="group" rounded="rounded-3xl">
            <ProjectPoster project={project} className="aspect-[16/10] w-full sm:aspect-[16/8]" />
          </GlareHover>
          <span className="pointer-events-none absolute right-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
            Expand
          </span>
        </motion.button>
      </Reveal>

      <Lightbox open={zoom} onClose={() => setZoom(false)} caption={`${project.title} — generative brand art`}>
        <ProjectPoster project={project} className="aspect-[16/10] w-full" />
      </Lightbox>

      {/* Stack */}
      <Reveal className="mt-12">
        <Eyebrow>Built with</Eyebrow>
        <div className="mt-5 flex flex-wrap gap-2">
          {project.stack.map((s) => (
            <span key={s} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-white/70">
              {s}
            </span>
          ))}
        </div>
      </Reveal>

      {/* Highlights */}
      {project.highlights && project.highlights.length > 0 && (
        <Reveal className="mt-14">
          <ul className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {project.highlights.map((h) => (
              <li key={h} className="bg-[#0A0A0A] p-6 text-sm leading-relaxed text-white/70">
                <span aria-hidden className="mb-3 block h-1 w-6 rounded-full bg-[#DCF87C]" />
                {h}
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {/* Narrative sections */}
      {project.sections && project.sections.length > 0 && (
        <div className="mt-16 space-y-14">
          {project.sections.map((section, i) => (
            <Reveal key={section.heading} delay={reduce ? 0 : i * 0.04}>
              <section className="grid gap-3 sm:grid-cols-[140px_1fr] sm:gap-8">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/40 sm:pt-1">
                  {section.heading}
                </h2>
                <p className="text-lg leading-relaxed text-white/75">{section.body}</p>
              </section>
            </Reveal>
          ))}
        </div>
      )}

      {/* Next project */}
      {showNext && (
        <Reveal className="mt-24">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/35">Next project</p>
          <SpotlightCard className="mt-5">
            <Link to={`/work/${next.slug}`} className="flex items-center justify-between gap-4 p-7">
              <span>
                <span className="block font-display text-2xl font-bold">{next.title}</span>
                <span className="mt-1 block text-sm text-white/55">{next.blurb}</span>
              </span>
              <span aria-hidden className="text-2xl text-[#DCF87C]">-&gt;</span>
            </Link>
          </SpotlightCard>
        </Reveal>
      )}
    </article>
  )
}
