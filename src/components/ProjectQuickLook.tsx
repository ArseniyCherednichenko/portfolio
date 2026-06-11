import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './Modal'
import { getProject, type Project } from '../data/projects'

// Global "quick look" dialog for a project. Instead of leaving the page to read
// a full case study, a visitor gets an in-place preview: the role, the summary,
// the stack, the opening of the write-up, and the links — with a clear path on
// to the full study. It opens anywhere via a window "open-project" CustomEvent
// carrying the slug, mirroring the site's open-<name> popup convention. Use the
// openProjectQuickLook helper rather than dispatching by hand.
const EVENT = 'open-project'

export function openProjectQuickLook(slug: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { slug } }))
}

export function ProjectQuickLook() {
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)

  useEffect(() => {
    function onOpen(e: Event) {
      const slug = (e as CustomEvent<{ slug?: string }>).detail?.slug
      const found = getProject(slug)
      // Placeholder cards have nothing to show; ignore them gracefully.
      if (found && !found.soon) setProject(found)
    }
    window.addEventListener(EVENT, onOpen)
    return () => window.removeEventListener(EVENT, onOpen)
  }, [])

  const open = project !== null
  const meta = [project?.role, project?.timeframe || project?.year].filter(Boolean).join(' · ')
  // Preview the opening of the write-up without dumping the whole case study.
  const preview = project?.sections?.slice(0, 2) ?? []

  function readFull() {
    if (!project) return
    setProject(null)
    navigate(`/work/${project.slug}`)
  }

  return (
    <Modal open={open} onClose={() => setProject(null)} size="lg">
      {project && (
        <div>
          {meta && (
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">{meta}</p>
          )}
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{project.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/65">{project.detail}</p>

          {project.stack.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {project.stack.map((s) => (
                <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  {s}
                </span>
              ))}
            </div>
          )}

          {preview.length > 0 && (
            <div className="mt-7 space-y-5 border-t border-white/10 pt-6">
              {preview.map((s) => (
                <div key={s.heading}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-white/45">{s.heading}</h3>
                  <p className="mt-2 leading-relaxed text-white/70">{s.body}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={readFull}
              className="rounded-full bg-[#DCF87C] px-6 py-3 font-semibold text-black transition hover:brightness-105"
            >
              Read the full case study
            </button>
            {project.href && (
              <a
                href={project.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition-colors hover:border-white/30"
              >
                Visit live
              </a>
            )}
            {project.repo && (
              <a
                href={project.repo}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-white/45 transition-colors hover:text-white"
              >
                Source
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
