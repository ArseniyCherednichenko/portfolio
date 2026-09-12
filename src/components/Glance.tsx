import { useRef, type MouseEvent } from 'react'
import { motion, useMotionValue, useMotionTemplate, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { GLANCE_FACETS, type GlanceFacet } from '../data/glance'

// Glance — the interactive "at a glance" panel that carries Home's About
// section. A bento grid of honest facets about the person, lit by a single lime
// spotlight that tracks the cursor across the whole panel (distinct from the
// per-card SpotlightCard glow used elsewhere — here one shared light unifies the
// grid, so it reads as one surface rather than a set of tiles). Each facet lifts
// and warms its border on hover; a linked facet reveals an arrow and routes into
// a deeper page. One facet shows the live Berlin clock so the panel feels
// present, never static. The whole thing de-centers any single project: Guided
// is one facet among place, stack, study, craft, and building-in-the-open.
//
// Reduced motion: the shared spotlight and the hover lift are dropped, the
// stagger becomes an instant appearance, and the clock still ticks (a live fact,
// not decoration) — a fully legible, fully honest panel with the travel removed.

const EASE = [0.16, 1, 0.3, 1] as const

// The live-clock facet. Reads the shared Europe/Berlin hook so it never drifts
// from the hero's own status chip, and shows an awake/asleep dot as soft context
// (never a hard promise of a reply).
function LiveValue() {
  const { time, awake } = useBerlinTime()
  const reduce = useReducedMotion()
  return (
    <span className="inline-flex items-baseline gap-2.5">
      <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
        {time}
      </span>
      <span className="relative inline-flex h-2 w-2 translate-y-[-0.15em]" aria-hidden>
        {awake && !reduce && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C] opacity-70" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/30'}`}
        />
      </span>
      <span className="sr-only">Local time in Berlin. {awake ? 'Likely around.' : 'Likely asleep.'}</span>
    </span>
  )
}

// One facet card. Renders as a link when the facet routes somewhere, otherwise a
// plain figure — either way it carries the same lift and warmth on hover.
function Facet({ facet, index }: { facet: GlanceFacet; index: number }) {
  const reduce = useReducedMotion()
  const inner = (
    <>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/40">{facet.label}</p>
      <div className="mt-2.5">
        {facet.live ? (
          <LiveValue />
        ) : (
          <span className="font-display text-xl font-semibold leading-tight tracking-tight text-white sm:text-2xl">
            {facet.value}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/50">{facet.detail}</p>
      {facet.to && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#DCF87C] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          Follow this
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
            -&gt;
          </span>
        </span>
      )}
    </>
  )

  const shell =
    'group relative flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-[transform,border-color,background-color] duration-300 hover:border-[#DCF87C]/30 hover:bg-white/[0.04]' +
    (reduce ? '' : ' hover:-translate-y-1')
  const span = facet.wide ? ' sm:col-span-2' : ''

  const body = facet.to ? (
    <Link
      to={facet.to}
      className={`${shell} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50`}
    >
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  )

  return (
    <motion.div
      className={`h-full${span}`}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: EASE }}
    >
      {body}
    </motion.div>
  )
}

export function Glance({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const x = useMotionValue(-9999)
  const y = useMotionValue(-9999)
  // One lime light shared by the whole panel, sitting above the tiles but below
  // their text — a masked radial that follows the cursor across the grid.
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${x}px ${y}px, rgba(220,248,124,0.10), transparent 62%)`

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    x.set(e.clientX - r.left)
    y.set(e.clientY - r.top)
  }
  function onLeave() {
    x.set(-9999)
    y.set(-9999)
  }

  return (
    <div
      ref={ref}
      onMouseMove={reduce ? undefined : onMove}
      onMouseLeave={reduce ? undefined : onLeave}
      className={`relative ${className}`}
    >
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-[1.75rem]"
          style={{ background: spotlight }}
        />
      )}
      <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GLANCE_FACETS.map((facet, i) => (
          <Facet key={facet.label} facet={facet} index={i} />
        ))}
      </div>
    </div>
  )
}
