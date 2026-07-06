import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

export interface GalleryItem {
  /** Short lime kicker. */
  tag: string
  title: string
  body: string
  /** Internal route for the card's CTA (takes precedence over href). */
  to?: string
  /** External link for the card's CTA. */
  href?: string
  /** CTA label; defaults to "Open". */
  cta?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// Coverflow transform for a card sitting `offset` positions from centre.
// Fractional offsets (mid-drag) interpolate smoothly through the same curve.
function pose(offset: number) {
  const clamped = Math.max(-3, Math.min(3, offset))
  const abs = Math.abs(clamped)
  return {
    x: `${clamped * 52}%`,
    rotateY: clamped * -32,
    scale: 1 - abs * 0.13,
    opacity: abs > 2.3 ? 0 : 1 - abs * 0.2,
    filter: `brightness(${Math.max(0.4, 1 - abs * 0.26)})`,
    zIndex: 100 - Math.round(abs * 10),
  }
}

/**
 * A draggable 3D coverflow. Cards fan out in perspective around a centred,
 * upright active card; side cards rotate away and recede. Drive it by dragging
 * (pointer or touch), the wheel, arrow keys, the prev/next arrows, the dots, or
 * by clicking a side card to bring it to the front. The active card's CTA is a
 * real link; side cards are inert until centred. Under reduced motion it drops
 * the perspective entirely and becomes a calm, fully readable snap-scroll row.
 */
export function CircularGallery({
  items,
  className = '',
}: {
  items: GalleryItem[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const n = items.length
  const [active, setActive] = useState(0)
  const stage = useRef<HTMLDivElement>(null)

  // Live drag state. `drag` is a fractional card offset applied on top of
  // `active` while a gesture is in flight; it resets to 0 (snapping) on release.
  const [drag, setDrag] = useState(0)
  const dragging = useRef(false)
  const startX = useRef(0)
  const stride = useRef(1)
  const moved = useRef(0)

  const clamp = useCallback((i: number) => Math.max(0, Math.min(n - 1, i)), [n])

  const measure = useCallback(() => {
    // One card-step is a little under half the stage — matches the 52% x pose.
    stride.current = Math.max(1, (stage.current?.clientWidth ?? 600) * 0.46)
  }, [])

  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const onPointerDown = (e: React.PointerEvent) => {
    if (reduce) return
    dragging.current = true
    startX.current = e.clientX
    moved.current = 0
    measure()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - startX.current
    moved.current = Math.max(moved.current, Math.abs(dx))
    // Drag right (dx > 0) reveals the earlier card, so offset moves negative.
    let next = -dx / stride.current
    // Rubber-band past the ends so it never feels rigid.
    const proj = active + next
    if (proj < 0) next = -active + proj * 0.35
    else if (proj > n - 1) next = n - 1 - active + (proj - (n - 1)) * 0.35
    setDrag(next)
  }

  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    setActive((a) => clamp(Math.round(a + drag)))
    setDrag(0)
  }

  const onWheel = (e: React.WheelEvent) => {
    if (reduce) return
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(d) < 8) return
    setActive((a) => clamp(a + (d > 0 ? 1 : -1)))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActive((a) => clamp(a + 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActive((a) => clamp(a - 1))
    }
  }

  // Reduced motion / no-JS-flair path: a plain, honest horizontal snap row.
  if (reduce) {
    return (
      <div
        className={`flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 ${className}`}
        role="list"
      >
        {items.map((it) => (
          <div
            key={it.title}
            role="listitem"
            className="w-[80%] shrink-0 snap-center sm:w-[46%] lg:w-[32%]"
          >
            <GalleryCard item={it} active />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        ref={stage}
        role="group"
        aria-roledescription="carousel"
        aria-label="Featured experiments"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className="relative mx-auto h-[340px] w-full max-w-2xl cursor-grab touch-pan-y select-none [perspective:1400px] focus-visible:outline-none active:cursor-grabbing sm:h-[300px]"
      >
        {items.map((it, i) => {
          const offset = i - active - drag
          const isCentre = Math.round(active + drag) === i
          return (
            <motion.div
              key={it.title}
              className="absolute inset-x-0 top-0 mx-auto h-full w-[74%] [transform-style:preserve-3d] will-change-transform sm:w-[52%]"
              style={{ transformOrigin: 'center center' }}
              initial={false}
              animate={pose(offset)}
              transition={
                dragging.current
                  ? { duration: 0 }
                  : { duration: 0.6, ease: EASE }
              }
              onClick={() => {
                // Ignore the click that ends a real drag.
                if (moved.current > 6) return
                if (!isCentre) setActive(i)
              }}
              aria-hidden={!isCentre}
            >
              <GalleryCard item={it} active={isCentre} />
            </motion.div>
          )
        })}
      </div>

      {/* CONTROLS */}
      <div className="mt-8 flex items-center justify-center gap-5">
        <ArrowButton
          dir="prev"
          disabled={active === 0}
          onClick={() => setActive((a) => clamp(a - 1))}
        />
        <div className="flex items-center gap-2.5">
          {items.map((it, i) => (
            <button
              key={it.title}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show ${it.title}`}
              aria-current={i === active}
              className="group relative h-2.5 w-2.5"
            >
              <span
                className={`absolute inset-0 rounded-full transition-colors ${
                  i === active ? 'bg-[#DCF87C]' : 'bg-white/20 group-hover:bg-white/40'
                }`}
              />
            </button>
          ))}
        </div>
        <ArrowButton
          dir="next"
          disabled={active === n - 1}
          onClick={() => setActive((a) => clamp(a + 1))}
        />
      </div>
    </div>
  )
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous' : 'Next'}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-white/70 transition-colors hover:border-[#DCF87C]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:text-white/70"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function GalleryCard({ item, active }: { item: GalleryItem; active: boolean }) {
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[28px] border p-8 text-left shadow-2xl shadow-black/50 backdrop-blur-sm transition-colors ${
        active ? 'border-[#DCF87C]/30' : 'border-white/10'
      } bg-gradient-to-b from-[#181818] to-[#0c0c0c]`}
    >
      {/* Ambient lime wash, brighter on the active card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#DCF87C]/20 blur-3xl transition-opacity duration-500"
        style={{ opacity: active ? 0.7 : 0.25 }}
      />
      <span className="relative text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">
        {item.tag}
      </span>
      <div className="relative">
        <h3 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{item.body}</p>
        <div className="mt-5 h-6">
          {active && (item.to || item.href) && (
            <CardCta item={item} />
          )}
        </div>
      </div>
    </div>
  )
}

function CardCta({ item }: { item: GalleryItem }) {
  const label = item.cta ?? 'Open'
  const inner = (
    <>
      {label}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12h14M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  )
  const cls =
    'inline-flex items-center gap-1.5 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:underline'
  if (item.to) {
    return (
      <Link to={item.to} className={cls}>
        {inner}
      </Link>
    )
  }
  return (
    <a href={item.href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  )
}
