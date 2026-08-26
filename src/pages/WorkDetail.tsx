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
import { SectionNav, type SectionLink } from '../components/SectionNav'
import { CASE_STUDIES, getProject } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

// Stable DOM id from a section heading, so the contents rail can jump to it.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

  // The spec panel is built from whatever facts the project actually carries —
  // no empty rows, no invented ones.
  const specRows: { label: string; value: string }[] = [
    project.role ? { label: 'Role', value: project.role } : null,
    project.year ? { label: 'Year', value: project.year } : null,
    project.platforms?.length ? { label: 'Platform', value: project.platforms.join(' · ') } : null,
    project.status ? { label: 'Status', value: project.status } : null,
  ].filter((r): r is { label: string; value: string } => r !== null)

  // Contents rail stops, in scroll order, built from what this project actually
  // carries — the top, the division of labour, then each narrative section.
  // Shown only when there are enough stops to be worth a rail (lg screens).
  const navSections: SectionLink[] = [
    { id: 'overview', label: 'Overview' },
    ...(project.contributions?.length ? [{ id: 'what-i-did', label: 'What I did' }] : []),
    ...(project.sections?.map((s) => ({ id: slugify(s.heading), label: s.heading })) ?? []),
  ]
  const showNav = navSections.length >= 3

  return (
    <article className="mx-auto w-full max-w-3xl px-6 pb-28 pt-32">
      {showNav && <SectionNav sections={navSections} />}
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
      <header id="overview" className="mt-8 scroll-mt-28 border-b border-white/10 pb-12">
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

      {/* At a glance — an editorial spec panel. Only rows with a real value
          render, so nothing is padded with a placeholder. */}
      {specRows.length > 0 && (
        <Reveal className="mt-12">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
            <dl className="divide-y divide-white/10">
              {specRows.map(({ label, value }) => (
                <div key={label} className="grid grid-cols-[100px_1fr] gap-4 px-6 py-4 sm:grid-cols-[140px_1fr]">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{label}</dt>
                  <dd className="text-sm leading-relaxed text-white/80">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      )}

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

      {/* What I did — the honest division of labour. This is the person-first
          view of the project: not what the product is, but what these hands
          made in it, area by area. */}
      {project.contributions && project.contributions.length > 0 && (
        <Reveal id="what-i-did" className="mt-16 scroll-mt-28">
          <Eyebrow>What I did</Eyebrow>
          <ul className="mt-6 space-y-px overflow-hidden rounded-3xl border border-white/10">
            {project.contributions.map((c, i) => (
              <motion.li
                key={c.area}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.06, 0.3) }}
                className="group relative grid grid-cols-1 gap-1 bg-[#0A0A0A] px-6 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[180px_1fr] sm:gap-6"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 bg-[#DCF87C] transition-transform duration-500 ease-out group-hover:scale-y-100"
                />
                <span className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#DCF87C] sm:pt-0.5">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#DCF87C]" />
                  {c.area}
                </span>
                <span className="text-base leading-relaxed text-white/75">{c.detail}</span>
              </motion.li>
            ))}
          </ul>
        </Reveal>
      )}

      {/* Narrative sections */}
      {project.sections && project.sections.length > 0 && (
        <div className="mt-16 space-y-14">
          {project.sections.map((section, i) => (
            <Reveal key={section.heading} id={slugify(section.heading)} delay={reduce ? 0 : i * 0.04} className="scroll-mt-28">
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
