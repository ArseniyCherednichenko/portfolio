import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Modal } from './Modal'
import { GradientText } from './GradientText'
import { ProjectPoster } from './ProjectPoster'
import type { Project } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

// A fast, in-page preview of a project — the "quick look" that sits alongside
// the full case study. It reads from the same honest project data (poster,
// role, blurb, stack, highlights, links) and always offers a way through to
// the full write-up, so nothing here is a dead end or a duplicate.
//
// The last-shown project is cached locally so the modal's exit animation still
// has content to render after the parent clears its selection.
export function ProjectQuickLook({
  project,
  onClose,
}: {
  project: Project | null
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState<Project | null>(project)

  // Keep the most recent project on screen through the close transition.
  useEffect(() => {
    if (project) setShown(project)
  }, [project])

  const p = shown
  const open = project !== null

  // Stagger the body a touch so the panel feels composed, not dumped in.
  const item = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0 : 0.4, delay: reduce ? 0 : 0.06 + i * 0.05, ease: EASE },
  })

  return (
    <Modal open={open} onClose={onClose}>
      {p && (
        <div>
          <motion.div {...item(0)} className="overflow-hidden rounded-2xl">
            <ProjectPoster project={p} className="aspect-[16/9] w-full" rounded="rounded-2xl" />
          </motion.div>

          <motion.div {...item(1)} className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {p.role && <span className="font-semibold text-[#DCF87C]">{p.role}</span>}
            {p.role && p.year && <span aria-hidden className="text-white/20">·</span>}
            {p.year && <span className="text-white/50">{p.year}</span>}
          </motion.div>

          <motion.h2 {...item(2)} className="mt-2 pr-8 font-display text-3xl font-bold tracking-tight">
            <GradientText>{p.title}</GradientText>
          </motion.h2>

          <motion.p {...item(3)} className="mt-3 text-[15px] leading-relaxed text-white/65">
            {p.detail || p.blurb}
          </motion.p>

          {p.stack.length > 0 && (
            <motion.div {...item(4)} className="mt-5 flex flex-wrap gap-2">
              {p.stack.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60"
                >
                  {s}
                </span>
              ))}
            </motion.div>
          )}

          {p.highlights && p.highlights.length > 0 && (
            <motion.ul {...item(5)} className="mt-6 space-y-2.5">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-sm leading-relaxed text-white/70">
                  <span aria-hidden className="mt-2 h-1 w-3 shrink-0 rounded-full bg-[#DCF87C]" />
                  <span>{h}</span>
                </li>
              ))}
            </motion.ul>
          )}

          <motion.div {...item(6)} className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to={`/work/${p.slug}`}
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5"
            >
              Read the full case study
              <span aria-hidden>-&gt;</span>
            </Link>
            {p.href && (
              <a
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-white/60 transition-colors hover:text-white"
              >
                Visit live
              </a>
            )}
            {p.repo && (
              <a
                href={p.repo}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-white/60 transition-colors hover:text-white"
              >
                View source
              </a>
            )}
          </motion.div>
        </div>
      )}
    </Modal>
  )
}
