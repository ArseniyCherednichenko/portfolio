import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { Divider } from '../components/Divider'
import { Breadcrumb } from '../components/Breadcrumb'
import { CASE_STUDIES, getProject } from '../data/projects'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useMeta } from '../hooks/useMeta'
import NotFound from './NotFound'

const EASE = [0.16, 1, 0.3, 1] as const

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="mt-2 text-white/80">{value}</div>
    </div>
  )
}

export default function WorkDetail() {
  const { slug } = useParams()
  const project = getProject(slug)
  useDocumentTitle(
    project && !project.soon ? `${project.title} — Arseniy Cherednichenko` : 'Not found — Arseniy Cherednichenko',
  )
  useMeta(project && !project.soon ? project.detail : 'This project could not be found.')
  if (!project || project.soon) return <NotFound />

  // Wrap-around prev/next through the real case studies.
  const idx = CASE_STUDIES.findIndex((p) => p.slug === project.slug)
  const next = CASE_STUDIES[(idx + 1) % CASE_STUDIES.length]
  const prev = CASE_STUDIES[(idx - 1 + CASE_STUDIES.length) % CASE_STUDIES.length]

  return (
    <article id="main" tabIndex={-1} className="outline-none">
      {/* HERO */}
      <header className="relative mx-auto w-full max-w-4xl px-6 pb-12 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Work', to: '/work' }, { label: project.title }]} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
          className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]"
        >
          {[project.role, project.year].filter(Boolean).join(' · ') || 'Project'}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="mt-4 text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl"
        >
          <GradientText>{project.title}</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          {project.detail}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.26, ease: EASE }}
          className="mt-10 flex flex-wrap gap-3"
        >
          {project.href && (
            <a
              href={project.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-105"
            >
              Visit live
            </a>
          )}
          {project.repo && (
            <a
              href={project.repo}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              View source
            </a>
          )}
        </motion.div>
      </header>

      {/* META */}
      <section className="mx-auto w-full max-w-4xl px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {project.role && <Meta label="Role" value={project.role} />}
          {project.timeframe && <Meta label="Timeframe" value={project.timeframe} />}
          <Meta label="Stack" value={project.stack.join(', ')} />
        </div>
      </section>

      {/* SECTIONS */}
      {project.sections && project.sections.length > 0 && (
        <section className="mx-auto w-full max-w-4xl px-6 py-20">
          <div className="grid gap-14">
            {project.sections.map((s, i) => (
              <Reveal key={s.heading} delay={i * 0.03}>
                <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:gap-10">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/40">{s.heading}</h2>
                  <p className="max-w-2xl text-lg leading-relaxed text-white/70">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* PREV / NEXT */}
      <Divider />
      <nav aria-label="More work" className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
          <Link
            to={`/work/${prev.slug}`}
            className="group flex-1 rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/25"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Previous</span>
            <div className="mt-2 text-2xl font-bold text-white/85 transition-colors group-hover:text-white">
              {prev.title}
            </div>
          </Link>
          <Link
            to={`/work/${next.slug}`}
            className="group flex-1 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-right transition-colors hover:border-white/25"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Next</span>
            <div className="mt-2 text-2xl font-bold text-white/85 transition-colors group-hover:text-white">
              {next.title}
            </div>
          </Link>
        </div>
      </nav>
    </article>
  )
}
