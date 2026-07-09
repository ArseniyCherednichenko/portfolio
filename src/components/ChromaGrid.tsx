import { useRef, type PointerEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

// A card in the grid. `to` links within the site (router), `href` links out.
export interface ChromaItem {
  title: string
  subtitle?: string
  tag?: string
  to?: string
  href?: string
}

/**
 * ChromaGrid — a torch-in-the-dark card grid.
 *
 * The grid is drawn twice, stacked: a fully lit layer underneath (lime edges,
 * warm wash, real links) and a dimmed, drained copy on top. A radial mask
 * punches a hole in the dim copy at the cursor, so moving the pointer sweeps a
 * spotlight across the grid and the cards it touches light up like a torch
 * passing over them. The lit layer carries the interactivity; the dim overlay
 * is purely visual (aria-hidden, pointer-transparent), so hovers and clicks
 * land cleanly on the cards beneath.
 *
 * No per-frame React state: pointer moves write two CSS variables (--mx/--my)
 * straight onto the container, and the mask reads them. Under reduced motion or
 * on a coarse pointer there is no torch to chase, so only the lit layer renders,
 * fully revealed and static.
 */
export function ChromaGrid({
  items,
  className = '',
  radius = 240,
}: {
  items: ChromaItem[]
  className?: string
  radius?: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
    el.style.setProperty('--chroma-on', '1')
  }

  function onLeave() {
    ref.current?.style.setProperty('--chroma-on', '0')
  }

  const grid =
    'grid grid-cols-1 gap-3 sm:grid-cols-2 ' +
    (items.length > 4 ? 'lg:grid-cols-3' : '')

  return (
    <div
      ref={ref}
      onPointerMove={reduce ? undefined : onMove}
      onPointerLeave={reduce ? undefined : onLeave}
      className={`relative ${className}`}
      style={
        {
          '--mx': '50%',
          '--my': '50%',
          '--chroma-on': '0',
          '--chroma-r': `${radius}px`,
        } as React.CSSProperties
      }
    >
      {/* Lit layer — the real, interactive cards, fully bright. */}
      <div className={grid}>
        {items.map((item) => (
          <ChromaCard key={item.title} item={item} lit />
        ))}
      </div>

      {/* Dim overlay — a drained copy with a spotlight hole at the cursor. */}
      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: 'var(--chroma-on)',
            WebkitMaskImage:
              'radial-gradient(circle var(--chroma-r) at var(--mx) var(--my), transparent 0%, transparent 12%, black 72%)',
            maskImage:
              'radial-gradient(circle var(--chroma-r) at var(--mx) var(--my), transparent 0%, transparent 12%, black 72%)',
          }}
        >
          <div className={grid}>
            {items.map((item) => (
              <ChromaCard key={item.title} item={item} lit={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChromaCard({ item, lit }: { item: ChromaItem; lit: boolean }) {
  const face = (
    <div
      className={
        'relative flex h-full min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-colors ' +
        (lit
          ? 'border-[#DCF87C]/35 bg-gradient-to-br from-[#DCF87C]/[0.14] via-white/[0.04] to-transparent'
          : 'border-white/10 bg-[#0c0c0c]')
      }
    >
      {/* Warm corner wash, only on the lit face. */}
      {lit && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#DCF87C]/25 blur-2xl"
        />
      )}
      <div className="relative flex items-center justify-between">
        {item.tag && (
          <span
            className={
              'text-[0.7rem] font-semibold uppercase tracking-[0.18em] ' +
              (lit ? 'text-[#DCF87C]' : 'text-white/30')
            }
          >
            {item.tag}
          </span>
        )}
        <span
          aria-hidden
          className={
            'text-lg transition-transform ' +
            (lit ? 'text-[#DCF87C]' : 'text-white/25')
          }
        >
          &#8599;
        </span>
      </div>
      <div className="relative">
        <h3
          className={
            'font-display text-xl font-semibold leading-tight ' +
            (lit ? 'text-white' : 'text-white/45')
          }
        >
          {item.title}
        </h3>
        {item.subtitle && (
          <p
            className={
              'mt-1.5 text-sm leading-snug ' + (lit ? 'text-white/60' : 'text-white/25')
            }
          >
            {item.subtitle}
          </p>
        )}
      </div>
    </div>
  )

  const shared =
    'group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60'

  // Only the lit layer is interactive; the dim overlay is inert scenery.
  if (!lit) return <div className="h-full">{face}</div>

  if (item.to)
    return (
      <Link to={item.to} className={shared}>
        {face}
      </Link>
    )
  if (item.href)
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={shared}>
        {face}
      </a>
    )
  return <div className="h-full">{face}</div>
}
