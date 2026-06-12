import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { Breadcrumb } from '../components/Breadcrumb'
import { MagneticButton } from '../components/MagneticButton'
import { openProjectQuickLook } from '../components/ProjectQuickLook'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useMeta } from '../hooks/useMeta'
import { PROJECTS, type Project } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const
const ALL = 'All'

// One project as an editorial index row: a big number, the title, year, role,
// and stack, with an arrow on hover. A different presentation from the home
// cards on purpose — this is the archive, read like a table of contents.
function IndexRow({ project, n }: { project: Project; n: number }) {
  const num = String(n).padStart(2, '0')

  if (project.soon) {
    return (
      <div className="flex items-center gap-5 border-t border-dashed border-white/10 py-7 text-white/35 sm:gap-8 sm:py-9">
        <span className="font-mono text-sm tabular-nums sm:text-base">{num}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-2xl font-bold sm:text-3xl">{project.title}</h3>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em]">In progress</span>
          </div>
          <p className="mt-2 text-sm text-white/30">{project.blurb}</p>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => openProjectQuickLook(project.slug)}
      className="group/row flex w-full items-center gap-5 border-t border-white/10 py-7 text-left transition-colors hover:border-white/25 sm:gap-8 sm:py-9"
    >
      <span className="font-mono text-sm tabular-nums text-white/30 transition-colors group-hover/row:text-[#DCF87C] sm:text-base">
        {num}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-2xl font-bold transition-colors group-hover/row:text-[#DCF87C] sm:text-3xl">
            {project.title}
          </h3>
          <span className="shrink-0 text-sm text-white/40">{project.year}</span>
        </div>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/55">{project.blurb}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {project.role && (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{project.role}</span>
          )}
          {project.role && project.stack.length > 0 && <span className="text-white/20">·</span>}
          {project.stack.map((s) => (
            <span key={s} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/50">
              {s}
            </span>
          ))}
        </div>
      </div>
      <span
        aria-hidden
        className="shrink-0 text-xl text-white/30 transition-all duration-300 group-hover/row:translate-x-1 group-hover/row:text-[#DCF87C]"
      >
        -&gt;
      </span>
    </button>
  )
}

export default function Work() {
  useDocumentTitle('Work — Arseniy Cherednichenko')
  useMeta(
    'The work archive of Arseniy Cherednichenko. Products, open-source, and experiments built in React, TypeScript, and SwiftUI.',
  )
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState<string>(ALL)

  // Filter chips are derived from the stacks the real projects actually use, so
  // the archive scales as new work lands without touching this component.
  const tags = useMemo(() => {
    const set = new Set<string>()
    PROJECTS.forEach((p) => p.stack.forEach((s) => set.add(s)))
    return [ALL, ...Array.from(set)]
  }, [])

  const shown = useMemo(() => {
    if (filter === ALL) return PROJECTS
    // Placeholders carry no stack, so they only show under "All".
    return PROJECTS.filter((p) => p.stack.includes(filter))
  }, [filter])

  return (
    <article id="main" tabIndex={-1} className="outline-none">
      <header className="mx-auto w-full max-w-4xl px-6 pb-10 pt-36 sm:pt-44">
        <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Work' }]} />
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-8 text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl"
        >
          The <GradientText>work</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          A working archive of what I build, products, open-source, and the experiments in between. Every entry is real;
          the ones still in progress are marked as such. Pick one to look inside.
        </motion.p>
      </header>

      {/* FILTER */}
      <section className="mx-auto w-full max-w-4xl px-6">
        <Reveal>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter projects by technology">
            {tags.map((t) => {
              const active = t === filter
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilter(t)}
                  aria-pressed={active}
                  className={`relative rounded-full px-4 py-1.5 text-sm transition-colors ${
                    active ? 'text-black' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={reduce ? undefined : 'work-filter'}
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-[#DCF87C]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10 font-medium">{t}</span>
                </button>
              )
            })}
          </div>
        </Reveal>
      </section>

      {/* INDEX */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-16 pt-6">
        <motion.div layout={!reduce} className="border-b border-white/10">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((p, i) => (
              <motion.div
                key={p.slug}
                layout={!reduce}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <IndexRow project={p} n={i + 1} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        {shown.length === 0 && (
          <p className="py-12 text-center text-white/40">Nothing here yet under that filter.</p>
        )}
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-28 pt-4 text-center">
        <Reveal>
          <p className="text-2xl font-medium leading-snug text-white/80 sm:text-3xl">
            More is on the way. If you want to build something together, the door is open.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              onClick={(e) => {
                e.preventDefault()
                window.dispatchEvent(new Event('open-contact'))
              }}
              className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
            >
              Get in touch
            </MagneticButton>
            <Link
              to="/playground"
              className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/5"
            >
              See the playground
            </Link>
          </div>
        </Reveal>
      </section>
    </article>
  )
}
