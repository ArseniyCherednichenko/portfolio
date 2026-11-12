import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useReducedMotion } from 'framer-motion'

// SpotlightGrid — a grid of cards that share ONE cursor-tracked spotlight, so
// the light reads as a single pane the pointer reveals rather than a set of
// cards each lighting on its own. It is the surface family's missing idea: the
// spotlight card lights the one card under the cursor and the glow card hands
// its own border to the pointer, but both are local — the light stops at the
// card edge. Here the glow is a single radial field positioned in the grid's
// own coordinates and painted identically by every cell, so a bright arc of
// border and a soft lime wash cross the gaps between cards without a seam: move
// the cursor over the gutter and the two facing edges light together, like a
// torch passing behind framed glass. In the spirit of Aceternity / Evervault's
// grid reveal, rebuilt by hand.
//
// How it stays cheap and continuous. The container writes the pointer position,
// in container pixels, into two CSS custom properties (`--gx`, `--gy`) on one
// requestAnimationFrame per move, plus an on/off flag (`--on`) that fades the
// whole field. Every cell records its own offset within the grid into `--ox`,
// `--oy` and paints its gradients at `calc(var(--gx) - var(--ox))` — i.e. the
// same point in grid space, clipped to the cell. Because the maths is identical
// across cells, the field is truly continuous, and because it is all CSS
// variables the pointer never triggers a React render. The border highlight is
// the standard padding-box / content-box mask trick, so the light rides the 1px
// frame, not a wash over the whole card.
//
// The offset is read from `offsetLeft`/`offsetTop`, measured against the cell's
// own `offsetParent` — which is the container, since it is the nearest
// positioned ancestor. That deliberately avoids reading the container through a
// ref: on mount, a parent's ref is attached only AFTER its children's layout
// effects run (refs commit bottom-up), so a cell cannot rely on the container
// ref being set yet. `offsetLeft` needs no such ref and is correct the moment
// the cell is in the DOM.
//
// Honest about the keyboard and reduced motion. A cell brightens on
// `focus-within`, so tabbing through the content lights the card the same way a
// hover would, with no pointer. Under prefers-reduced-motion the container never
// wires the pointer and the field stays dark; each cell keeps a calm static
// border that warms a touch on hover and focus. Decorative layers are
// aria-hidden and pointer-events-none throughout.

export function SpotlightGrid({
  children,
  className = '',
  /** Radius of the shared spotlight, in px. */
  radius = 280,
}: {
  children: ReactNode
  className?: string
  radius?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion() ?? false
  const frame = useRef(0)

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduce) return
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--gx', `${x}px`)
      el.style.setProperty('--gy', `${y}px`)
      el.style.setProperty('--on', '1')
    })
  }

  function onLeave() {
    cancelAnimationFrame(frame.current)
    containerRef.current?.style.setProperty('--on', '0')
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-spotlight-grid=""
      style={{ '--on': '0', '--r': `${radius}px` } as CSSProperties}
      className={`relative grid gap-3 ${className}`}
    >
      {children}
    </div>
  )
}

export function SpotlightGridCell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Record this cell's offset within the grid into --ox / --oy, once and on any
  // resize, so its gradients can be positioned in grid space. The reference is
  // the grid container, found by walking up the DOM (closest) rather than
  // through a React ref: on mount a parent's ref is attached only AFTER its
  // children's layout effects run (refs commit bottom-up), so the ref would be
  // null here — closest() reads the live DOM and is correct the moment the cell
  // is mounted. Measuring against the container's own box (not offsetParent)
  // keeps --ox in the same coordinate space as the pointer, which the container
  // reads from its getBoundingClientRect.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const container =
      (el.closest('[data-spotlight-grid]') as HTMLElement | null) ??
      (el.offsetParent as HTMLElement | null) ??
      el.parentElement
    const measure = () => {
      const base = container ?? el
      const cr = base.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      el.style.setProperty('--ox', `${er.left - cr.left}px`)
      el.style.setProperty('--oy', `${er.top - cr.top}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (container) ro.observe(container)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const fieldAt =
    'radial-gradient(var(--r,280px) circle at calc(var(--gx,-9999px) - var(--ox,0px)) calc(var(--gy,-9999px) - var(--oy,0px)),'

  return (
    <div
      ref={ref}
      className={`group/cell relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-colors duration-300 hover:border-white/20 focus-within:border-[#DCF87C]/40 ${className}`}
    >
      {/* Soft lime wash, continuous across the grid. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          background: `${fieldAt} rgba(220,248,124,0.10), transparent 62%)`,
          opacity: 'var(--on,0)',
        }}
      />
      {/* Bright border arc riding the 1px frame (padding/content-box mask). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          padding: '1px',
          background: `${fieldAt} rgba(220,248,124,0.65), rgba(255,255,255,0.12) 55%, transparent 72%)`,
          opacity: 'var(--on,0)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'exclude',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
