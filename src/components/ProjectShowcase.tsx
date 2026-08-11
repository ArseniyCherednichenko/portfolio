import { useRef, type PointerEvent } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { Link } from 'react-router-dom'
import { ProjectPoster } from './ProjectPoster'
import type { Project } from '../data/projects'

// A poster-forward, interactive showcase of the real projects, built for the
// home page's work band. Where the /work ledger is a dense row-by-row index,
// this is the front-door version: each project is a large generative-poster
// card that tilts toward the cursor under a lime spotlight, so the section
// reads as alive and crafted rather than a flat grid. Every card offers the
// same two honest ways in as the ledger — a quick-look modal and a link
// through to the full case study — so nothing here is a dead end or a
// duplicate of a screenshot the project does not have.
//
// The placeholder ("soon") project renders as a calm dashed invitation that
// spans the row: honest that more real work is coming without pretending it
// already exists.

const EASE = [0.16, 1, 0.3, 1] as const

function ProjectCard({
  project,
  onQuickLook,
}: {
  project: Project
  onQuickLook: (p: Project) => void
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // Pointer position within the card, 0..1 on each axis. Drives both the
  // spotlight glow (in px) and a subtle 3D tilt (in deg), spring-smoothed so
  // the card settles rather than snapping.
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const gx = useMotionValue(0)
  const gy = useMotionValue(0)

  const rx = useSpring(useTransform(py, [0, 1], [6, -6]), { stiffness: 150, damping: 18 })
  const ry = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 150, damping: 18 })
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${gx}px ${gy}px, rgba(220,248,124,0.16), transparent 62%)`

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
    gx.set(e.clientX - r.left)
    gy.set(e.clientY - r.top)
  }
  function onLeave() {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] transition-colors hover:border-[#DCF87C]/30"
    >
      {/* Cursor spotlight. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
      />
      {/* Lime edge that wipes down on hover, echoing the /work ledger. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 z-20 h-full w-[3px] origin-top scale-y-0 rounded-full bg-[#DCF87C] transition-transform duration-500 ease-out group-hover:scale-y-100"
      />

      {/* Poster — a quick-look trigger. Lifts a touch as the whole card tilts. */}
      <button
        type="button"
        onClick={() => onQuickLook(project)}
        aria-label={`Quick look at ${project.title}`}
        className="relative block w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-inset"
      >
        <ProjectPoster
          project={project}
          className="aspect-[16/10] w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          rounded="rounded-none"
        />
        <span className="pointer-events-none absolute right-4 top-4 z-10 inline-flex translate-y-1 items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-xs font-semibold text-white/80 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#DCF87C]" />
          Quick look
        </span>
      </button>

      {/* Body. */}
      <div className="relative z-20 flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-2xl font-bold leading-tight tracking-tight">
            <Link
              to={`/work/${project.slug}`}
              className="inline-block transition-transform duration-500 ease-out hover:text-white group-hover:translate-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {project.title}
            </Link>
          </h3>
          <span className="shrink-0 text-sm tabular-nums text-white/35">{project.year}</span>
        </div>

        {project.role && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            {project.role}
          </p>
        )}

        <p className="mt-3 leading-relaxed text-white/60">{project.blurb}</p>

        {project.stack.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {project.stack.map((s) => (
              <span
                key={s}
                className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/55"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
          <button
            type="button"
            onClick={() => onQuickLook(project)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:bg-white/[0.04] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          >
            Quick look
          </button>
          <Link
            to={`/work/${project.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            Case study
            <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
              -&gt;
            </span>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// A calm, honest placeholder that spans the row: real work is on the way, and
// the site says so plainly rather than faking a project.
function SoonCard({ project }: { project: Project }) {
  return (
    <div className="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl border border-dashed border-white/15 p-7 text-white/40 sm:flex-row sm:items-center">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
          In progress
        </span>
        <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-white/55">
          {project.title}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/35">{project.blurb}</p>
      </div>
      <Link
        to="/work"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
      >
        The full ledger
        <span aria-hidden>-&gt;</span>
      </Link>
    </div>
  )
}

export function ProjectShowcase({
  projects,
  onQuickLook,
  className = '',
}: {
  projects: Project[]
  onQuickLook: (p: Project) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const real = projects.filter((p) => !p.soon)
  const soon = projects.filter((p) => p.soon)

  return (
    <div className={className}>
      <div className="grid gap-6 sm:grid-cols-2">
        {real.map((p, i) => (
          <motion.div
            key={p.slug}
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: EASE, delay: Math.min(i * 0.08, 0.24) }}
            className="[perspective:1000px]"
          >
            <ProjectCard project={p} onQuickLook={onQuickLook} />
          </motion.div>
        ))}
      </div>

      {soon.length > 0 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="mt-6"
        >
          {soon.map((p) => (
            <SoonCard key={p.slug} project={p} />
          ))}
        </motion.div>
      )}
    </div>
  )
}
