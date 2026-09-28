import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'

export interface RollingItem {
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

// How fast the drum drifts on its own, in degrees per second, when idle.
const AUTO_DPS = 5
// Coast friction: fraction of angular velocity kept per frame (~60fps).
const FRICTION = 0.94
// Below this angular speed (deg/frame) the coast is spent and auto-spin resumes.
const COAST_FLOOR = 0.02
// A pointer drag of this many pixels turns the drum one full card step.
const PX_PER_STEP = 150
// Backward tilt of the whole drum, so you read the front cards looking slightly
// down onto the cylinder rather than dead-on — gives it a physical, seated look.
const TILT = 8

/**
 * A rolling 3D gallery: cards wrapped around the face of a cylinder that turns
 * on a vertical axis. It is the drum to CircularGallery's flat coverflow — where
 * that fans cards sideways in a plane, this seats them around a barrel so the
 * ones off-centre curve away into depth and the back of the drum is genuinely
 * behind. It drifts on its own by default; grab it (pointer or touch) to spin it
 * and let go to send it coasting on real momentum before the gentle drift takes
 * back over. The card facing front is the active one — its CTA is a live link
 * and it alone takes the pointer; the rest are inert until they come round.
 * Arrow keys step it one card at a time. Under reduced motion the drum is
 * dropped entirely for a calm, fully readable horizontal snap row.
 */
export function RollingGallery({
  items,
  className = '',
}: {
  items: RollingItem[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const n = items.length
  const step = 360 / Math.max(1, n)

  // Radius that seats `n` cards of the given face width around the cylinder with
  // no overlap: half the chord over tan(half the wedge). Recomputed on resize so
  // the drum stays snug on phones and roomy on wide screens.
  const [radius, setRadius] = useState(340)
  const [faceW, setFaceW] = useState(260)
  const stage = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    const w = stage.current?.clientWidth ?? 640
    const face = Math.max(200, Math.min(300, w * 0.42))
    setFaceW(face)
    // A little breathing room (1.16) between neighbours so faces never clip.
    const r = (face / 2) / Math.tan(Math.PI / Math.max(2, n)) * 1.16
    setRadius(Math.round(r))
  }, [n])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // The single source of truth: how far the drum has turned, in degrees, kept
  // unbounded so momentum and drift cross the 0/360 seam without a snap. Every
  // card's world angle, and the active index, are derived from it each frame.
  const rotation = useRef(0)
  const velocity = useRef(0) // deg/frame while coasting
  const dragging = useRef(false)
  const lastX = useRef(0)
  const lastT = useRef(0)
  const moved = useRef(0)
  const [, force] = useState(0)
  const [active, setActive] = useState(0)

  // One rAF loop owns all motion: drift when idle, coast after a fling, hold
  // while dragging. It never touches React state except to publish the active
  // index when it changes, so the heavy transform work stays off the render path.
  useEffect(() => {
    if (reduce) return
    let raf = 0
    let prev = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(48, now - prev) // clamp after a tab-away
      prev = now
      if (!dragging.current) {
        if (Math.abs(velocity.current) > COAST_FLOOR) {
          rotation.current += velocity.current * (dt / 16.67)
          velocity.current *= FRICTION
        } else {
          velocity.current = 0
          rotation.current += AUTO_DPS * (dt / 1000)
        }
      }
      // Active = the card whose world angle is nearest the front (0 deg).
      const idx = ((Math.round(-rotation.current / step) % n) + n) % n
      setActive((a) => (a === idx ? a : idx))
      force((f) => (f + 1) % 1_000_000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, step, n])

  const onPointerDown = (e: React.PointerEvent) => {
    if (reduce) return
    dragging.current = true
    velocity.current = 0
    lastX.current = e.clientX
    lastT.current = performance.now()
    moved.current = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastX.current
    const now = performance.now()
    const dt = Math.max(1, now - lastT.current)
    moved.current += Math.abs(dx)
    const dDeg = (dx / PX_PER_STEP) * step
    rotation.current += dDeg
    // Track instantaneous angular velocity for the fling, normalised to per-frame.
    velocity.current = (dDeg / dt) * 16.67
    lastX.current = e.clientX
    lastT.current = now
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    // Cap the fling so a violent swipe doesn't blur into a spin.
    velocity.current = Math.max(-14, Math.min(14, velocity.current))
  }

  const step1 = (dir: 1 | -1) => {
    velocity.current = 0
    // Snap to the neighbouring card's exact front angle.
    const target = Math.round(-rotation.current / step) - dir
    rotation.current = -target * step
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      step1(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step1(-1)
    }
  }

  // Reduced-motion path: a plain, honest horizontal snap row, no drum.
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
            <RollingCard item={it} active />
          </div>
        ))}
      </div>
    )
  }

  const rot = rotation.current

  return (
    <div className={className}>
      <div
        ref={stage}
        role="group"
        aria-roledescription="carousel"
        aria-label="Featured experiments, on a rolling drum"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="relative mx-auto h-[360px] w-full max-w-3xl cursor-grab touch-pan-y select-none [perspective:1600px] focus-visible:outline-none active:cursor-grabbing sm:h-[380px]"
      >
        <div
          className="absolute left-1/2 top-1/2 h-0 w-0 [transform-style:preserve-3d]"
          style={{ transform: `translate(-50%,-50%) rotateX(${TILT}deg) rotateY(${rot}deg)` }}
        >
          {items.map((it, i) => {
            // World angle of this face relative to the front (0 = dead centre).
            let world = ((i * step + rot) % 360 + 360) % 360
            if (world > 180) world -= 360
            const facing = Math.cos((world * Math.PI) / 180) // 1 front, -1 back
            const front = facing > 0
            const isActive = i === active
            return (
              <div
                key={it.title}
                className="absolute top-1/2 [backface-visibility:hidden] will-change-transform"
                style={{
                  width: faceW,
                  height: 300,
                  marginTop: -150,
                  left: -faceW / 2,
                  transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
                  opacity: front ? 0.35 + facing * 0.65 : 0,
                  filter: `brightness(${(0.5 + Math.max(0, facing) * 0.5).toFixed(3)})`,
                  pointerEvents: isActive ? 'auto' : 'none',
                  zIndex: Math.round((facing + 1) * 100),
                  transition: dragging.current ? 'none' : 'opacity 0.4s ease, filter 0.4s ease',
                }}
                aria-hidden={!isActive}
              >
                <RollingCard item={it} active={isActive} />
              </div>
            )
          })}
        </div>
      </div>

      {/* CONTROLS — dots double as a live position read of the drum. */}
      <div className="mt-8 flex items-center justify-center gap-5">
        <ArrowButton dir="prev" onClick={() => step1(-1)} />
        <div className="flex items-center gap-2.5">
          {items.map((it, i) => (
            <button
              key={it.title}
              type="button"
              onClick={() => {
                velocity.current = 0
                rotation.current = -i * step
              }}
              aria-label={`Roll to ${it.title}`}
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
        <ArrowButton dir="next" onClick={() => step1(1)} />
      </div>
    </div>
  )
}

function ArrowButton({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'prev' ? 'Roll to previous' : 'Roll to next'}
      className="grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/[0.03] text-white/70 transition-colors hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCF87C]"
    >
      <span aria-hidden className="text-lg leading-none">
        {dir === 'prev' ? '←' : '→'}
      </span>
    </button>
  )
}

function RollingCard({ item, active }: { item: RollingItem; active: boolean }) {
  const cta = item.cta ?? 'Open'
  return (
    <div
      className={`flex h-full w-full flex-col justify-between rounded-3xl border p-6 backdrop-blur-sm transition-colors ${
        active ? 'border-white/15 bg-white/[0.05]' : 'border-white/8 bg-white/[0.02]'
      }`}
    >
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#DCF87C]">
          {item.tag}
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-white">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{item.body}</p>
      </div>
      {item.to ? (
        <Link
          to={item.to}
          tabIndex={active ? 0 : -1}
          className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          {cta} <span aria-hidden>&rarr;</span>
        </Link>
      ) : item.href ? (
        <a
          href={item.href}
          target="_blank"
          rel="noreferrer"
          tabIndex={active ? 0 : -1}
          className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          {cta} <span aria-hidden>&rarr;</span>
        </a>
      ) : null}
    </div>
  )
}
