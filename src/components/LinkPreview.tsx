import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
} from 'framer-motion'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getProject } from '../data/projects'
import { ProjectPoster } from './ProjectPoster'

const EASE = [0.16, 1, 0.3, 1] as const

// A small, stable hash so a title maps to a repeatable gradient — the same
// preview always looks the same, no per-render churn.
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// On-brand companion tones (lime always leads elsewhere; here two of these
// pair up behind a page glyph so previews stay in the family without repeating
// the poster art).
const TONES = ['#DCF87C', '#34D399', '#38BDF8', '#A78BFA', '#FB923C', '#F472B6']

/**
 * An inline link that floats a rich, hand-built preview card above itself on
 * hover and on keyboard focus. Distinct from the site's text `Tooltip` (a small
 * worded hint) — this reveals a *visual* card: either a project's generative
 * poster (`poster="slug"`) or a deterministic gradient glyph tile for a page.
 * The point of it is to pull a reader outward across the whole site from inside
 * a sentence, so no single project has to carry the prose alone.
 *
 * The link itself is the real, focusable element (a router `Link` for `to`, an
 * `<a>` for `href`); the card is `aria-hidden` decoration and `pointer-events
 * -none`, so it never intercepts a click and the destination is always spoken
 * once by the link. The card leans a few pixels toward the pointer as it moves
 * across the trigger, springed and clamped so it tracks without flying off.
 * Under `prefers-reduced-motion` the tracking, blur, and scale all drop for a
 * plain, instant appearance.
 */
export function LinkPreview({
  children,
  to,
  href,
  title,
  blurb,
  poster,
  glyph,
  className = '',
}: {
  /** The inline link text. */
  children: ReactNode
  /** Internal route (router Link). One of `to`/`href` is required. */
  to?: string
  /** External URL (opens in a new tab). */
  href?: string
  /** Card heading. */
  title: string
  /** One honest line under the heading. */
  blurb?: string
  /** A project slug — renders that project's poster as the card visual. */
  poster?: string
  /** Short label/letter for the glyph tile when there is no poster. */
  glyph?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  // Pointer-x parallax: normalised [-1, 1] across the trigger, springed, then
  // mapped to a small translate so the card leans toward the cursor.
  const px = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 260, damping: 26, mass: 0.4 })
  const lean = useTransform(sx, [-1, 1], [-12, 12])

  const project = poster ? getProject(poster) : undefined
  const [a, b] = tonesFor(title)

  function onEnter(e: React.PointerEvent) {
    if (e.pointerType === 'touch') return // taps navigate; no hover card
    setOpen(true)
  }
  function onMove(e: React.PointerEvent) {
    if (reduce) return
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const t = r.width ? ((e.clientX - r.left) / r.width) * 2 - 1 : 0
    px.set(Math.max(-1, Math.min(1, t)))
  }

  const cardMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: { opacity: 0, y: 8, scale: 0.96, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, y: 6, scale: 0.97, filter: 'blur(4px)' },
        transition: { duration: 0.26, ease: EASE },
      }

  const linkClass = `relative inline font-semibold text-[#DCF87C] underline decoration-[#DCF87C]/30 decoration-1 underline-offset-[3px] transition-colors hover:decoration-[#DCF87C]/70 focus-visible:outline-none focus-visible:decoration-[#DCF87C] ${className}`

  const linkInner = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={linkClass}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
    </a>
  ) : (
    <Link
      to={to ?? '#'}
      className={linkClass}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
    </Link>
  )

  return (
    <span
      ref={wrapRef}
      className="relative inline-block"
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={() => setOpen(false)}
    >
      {linkInner}

      <AnimatePresence>
        {open && (
          <motion.span
            aria-hidden
            role="presentation"
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 block w-64 -translate-x-1/2"
            style={{ x: reduce ? 0 : (lean as unknown as MotionStyle['x']) }}
            {...cardMotion}
          >
            <span className="block overflow-hidden rounded-2xl border border-white/12 bg-[#0B0B0B] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] ring-1 ring-black/40">
              {/* Visual — a project poster, or a deterministic glyph tile. */}
              {project ? (
                <ProjectPoster project={project} rounded="rounded-none" className="h-28 w-full" />
              ) : (
                <span
                  className="relative block h-28 w-full"
                  style={{
                    backgroundImage: `radial-gradient(120% 120% at 20% 0%, ${a}40, transparent 60%), radial-gradient(120% 120% at 90% 100%, ${b}38, transparent 55%), linear-gradient(160deg, #0d0d0d, #060606)`,
                  }}
                >
                  <span
                    className="absolute inset-0 opacity-[0.10]"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)',
                      backgroundSize: '26px 26px',
                      maskImage: 'radial-gradient(ellipse at center,#000 55%,transparent 100%)',
                      WebkitMaskImage: 'radial-gradient(ellipse at center,#000 55%,transparent 100%)',
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-2xl font-bold tracking-tight text-white/90">
                      {glyph ?? title}
                    </span>
                  </span>
                </span>
              )}

              {/* Caption. */}
              <span className="block border-t border-white/8 px-4 py-3">
                <span className="flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-white">
                  {title}
                  <span className="text-[#DCF87C]" aria-hidden>
                    &#8599;
                  </span>
                </span>
                {blurb && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{blurb}</span>
                )}
              </span>
            </span>

            {/* Pointer triangle seated on the card's bottom edge. */}
            <span
              className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-white/12 bg-[#0B0B0B]"
              aria-hidden
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

// Two stable tones for the glyph tile, seeded off the title. Lime leads when it
// happens to be drawn; otherwise two companions pair up — either way on-brand.
function tonesFor(title: string): [string, string] {
  const h = hash(title)
  const i = h % TONES.length
  const j = (i + 2 + ((h >>> 3) % (TONES.length - 1))) % TONES.length
  return [TONES[i], TONES[j === i ? (j + 1) % TONES.length : j]]
}
