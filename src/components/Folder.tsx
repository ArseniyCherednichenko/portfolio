import { motion, useReducedMotion } from 'framer-motion'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'

// A tactile folder that opens to fan out its "papers". A kind of object the site
// did not have — not a field, card, or text effect but a *container that opens*:
// closed it reads as a slim dark folder with a tab; on hover the papers peek
// above the pocket, and a click lifts them out into a fanned hand of cards you
// can actually click through. Distinct from CircularGallery (a coverflow) and
// CardStack (an auto-advancing deck): here the papers live *inside* a pocket and
// emerge from it. Honest to a11y — the pocket is a real toggle button with
// aria-expanded, the papers are real links reachable only when open, and under
// reduced motion the whole thing degrades to a plain, fully legible list.

export interface FolderPaper {
  label: string
  hint?: string
  /** Internal route (renders a router Link). */
  to?: string
  /** External URL (renders a new-tab anchor). */
  href?: string
}

interface FolderProps {
  papers: FolderPaper[]
  /** Label shown on the pocket and used as the accessible name. */
  label?: string
  className?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// The face of a single paper — shared between the animated and reduced-motion
// paths so they never drift. Light, paper-like, popping against the dark folder.
function PaperFace({ paper }: { paper: FolderPaper }) {
  return (
    <span className="group/paper flex h-full w-full flex-col justify-between rounded-xl border border-black/10 bg-[#f2f1ea] p-3.5 text-left shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] ring-[#DCF87C] transition-shadow duration-300 hover:shadow-[0_16px_40px_-14px_rgba(0,0,0,0.8)] hover:ring-2">
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-black/45">
        {paper.hint ?? 'Open'}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="font-display text-lg font-bold leading-tight text-[#111]">{paper.label}</span>
        <span
          aria-hidden
          className="translate-x-0 text-[#111] transition-transform duration-300 group-hover/paper:translate-x-1"
        >
          -&gt;
        </span>
      </span>
    </span>
  )
}

function PaperLink({ paper, tabbable }: { paper: FolderPaper; tabbable: boolean }) {
  const common = 'block h-full w-full'
  const tab = tabbable ? undefined : -1
  if (paper.href) {
    return (
      <a href={paper.href} target="_blank" rel="noreferrer" tabIndex={tab} className={common}>
        <PaperFace paper={paper} />
      </a>
    )
  }
  if (paper.to) {
    return (
      <Link to={paper.to} tabIndex={tab} className={common}>
        <PaperFace paper={paper} />
      </Link>
    )
  }
  return (
    <span className={common}>
      <PaperFace paper={paper} />
    </span>
  )
}

export function Folder({ papers, label = 'Open me', className = '' }: FolderProps) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const id = useId()

  // Reduced-motion (and the same fallback touch users get if they prefer it):
  // no folding, no fan — a plain, fully legible labelled grid of the links.
  if (reduce) {
    return (
      <div className={className}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">{label}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {papers.map((p) => (
            <div key={p.label} className="h-24">
              <PaperLink paper={p} tabbable />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const n = papers.length
  const center = (n - 1) / 2

  // Per-paper target: hidden inside the pocket at rest, a sliver of a peek on
  // hover, a fanned hand-of-cards when open (ends dip slightly for the arc).
  const target = (i: number) => {
    const d = i - center
    if (open) {
      return { y: -150, x: d * 118, rotate: d * 7, opacity: 1, scale: 1 }
    }
    if (hovered) {
      return { y: -30, x: d * 7, rotate: d * 2, opacity: 1, scale: 0.98 }
    }
    return { y: 0, x: 0, rotate: 0, opacity: 1, scale: 0.96 }
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ perspective: 1200, width: 288, height: 224 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Back panel + tab */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-3 left-6 h-4 w-28 rounded-t-lg border-x border-t border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#151515]" />
        <div className="absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-[#161616] to-[#0f0f0f]" />
      </div>

      {/* Papers — behind the pocket at rest (z-10), lifted above it when open */}
      <div
        id={id}
        role="group"
        aria-label={label}
        className="absolute inset-0"
        style={{ zIndex: open ? 30 : 10, pointerEvents: open ? 'auto' : 'none' }}
      >
        {papers.map((p, i) => (
          <motion.div
            key={p.label}
            className="absolute bottom-3.5 left-1/2 h-[104px] w-[156px] -translate-x-1/2"
            style={{ transformOrigin: 'bottom center' }}
            initial={false}
            animate={target(i)}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: open ? i * 0.05 : 0 }}
          >
            <PaperLink paper={p} tabbable={open} />
          </motion.div>
        ))}
      </div>

      {/* Pocket front — the toggle. Tilts open a touch to let the papers out. */}
      <motion.button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="absolute inset-x-0 bottom-0 z-20 h-[132px] cursor-pointer rounded-2xl border border-white/10 bg-gradient-to-b from-[#242424] to-[#151515]"
        style={{ transformOrigin: 'bottom center' }}
        initial={false}
        animate={open ? { rotateX: 14, y: 6 } : { rotateX: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        {/* Lime top edge — the lip of the pocket */}
        <span className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#DCF87C]/60 to-transparent" />
        <span className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
            {open ? 'Close' : label}
          </span>
          <motion.span
            aria-hidden
            className="text-[#DCF87C]"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            &darr;
          </motion.span>
        </span>
      </motion.button>
    </div>
  )
}
