import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

export interface InfiniteScrollItem {
  /** Stable key for the item. */
  key: string
  /** What the row renders. Keep it non-interactive — the loop duplicates it. */
  content: ReactNode
}

// A vertical column of cards that scrolls forever and never seams. A single
// RAF loop drifts the track at a steady speed and wraps it by exactly one
// sequence height, so the same content re-enters from the opposite edge with
// no pop. Grab it and it scrubs under your finger; let go and the throw carries
// on a decaying momentum before easing back into the drift. Deliberately a
// different primitive from Marquee (horizontal, CSS-only, no drag) and
// CircularGallery (a coverflow that snaps) — this is a plain, tactile,
// endlessly-looping list.
//
// No per-item React state: one loop writes `translateY` straight onto the track
// ref, so a dense list stays cheap. The wrap unit is measured off the real DOM
// (the offset between the first item of the first copy and the first of the
// second), so it holds at any font size or gap. Under reduced motion the loop
// is dropped entirely for a plain, natively-scrollable column — nothing is ever
// gated behind the motion, and the duplicated copies never reach assistive tech
// (only the first copy is announced; the rest are aria-hidden).
export function InfiniteScroll({
  items,
  speed = 42,
  direction = 'up',
  gap = 14,
  tilt = 0,
  pauseOnHover = true,
  className = '',
  itemClassName = '',
  height = 440,
}: {
  items: InfiniteScrollItem[]
  /** Auto-drift speed in px/s. 0 holds still until dragged. */
  speed?: number
  direction?: 'up' | 'down'
  /** Vertical gap between rows, in px. */
  gap?: number
  /** A small 3D lean of the whole column, in degrees. 0 keeps it upright. */
  tilt?: number
  pauseOnHover?: boolean
  className?: string
  /** Applied to each row wrapper — pass the card chrome here. */
  itemClassName?: string
  /** Viewport height in px. */
  height?: number
}) {
  const reduce = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const firstA = useRef<HTMLDivElement>(null)
  const firstB = useRef<HTMLDivElement>(null)

  // How many copies of the list to stack. Enough that one sequence always
  // overflows the viewport (so a wrap never shows a gap); nudged up once the
  // real heights are known.
  const [copies, setCopies] = useState(3)

  // Live mutable state kept off React so the loop never triggers a render.
  const state = useRef({
    y: 0,
    vel: 0, // momentum on top of the drift (px/s)
    unit: 0, // one sequence height, measured
    dragging: false,
    paused: false,
    lastY: 0,
    lastT: 0,
  })

  const dirSign = direction === 'up' ? -1 : 1

  // Measure the wrap unit and make sure we have enough copies to cover.
  useLayoutEffect(() => {
    if (reduce) return
    const measure = () => {
      const a = firstA.current
      const b = firstB.current
      const vp = viewportRef.current
      if (!a || !b || !vp) return
      const unit = b.offsetTop - a.offsetTop
      if (unit <= 0) return
      state.current.unit = unit
      const need = Math.ceil(vp.clientHeight / unit) + 2
      setCopies((c) => (need > c ? need : c))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (viewportRef.current) ro.observe(viewportRef.current)
    if (trackRef.current) ro.observe(trackRef.current)
    return () => ro.disconnect()
  }, [reduce, items, copies, gap])

  // The single animation loop.
  useEffect(() => {
    if (reduce) return
    const track = trackRef.current
    if (!track) return
    let raf = 0
    let prev = 0
    const s = state.current

    const frame = (t: number) => {
      if (!prev) prev = t
      let dt = (t - prev) / 1000
      prev = t
      if (dt > 0.05) dt = 0.05 // a tabbed-out gap must not lurch the column

      if (!s.dragging && s.unit > 0) {
        // Momentum from a throw decays toward rest.
        s.vel *= Math.exp(-dt * 3.4)
        if (Math.abs(s.vel) < 0.02) s.vel = 0
        const auto = s.paused ? 0 : speed * dirSign
        s.y += (auto + s.vel) * dt
      }

      // Wrap into (-unit, 0] so the loop is seamless in both directions.
      if (s.unit > 0) {
        while (s.y <= -s.unit) s.y += s.unit
        while (s.y > 0) s.y -= s.unit
      }
      track.style.transform = `translate3d(0, ${s.y}px, 0)`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduce, speed, dirSign])

  if (reduce) {
    // Calm, honest fallback: one copy, natively scrollable, fully legible.
    return (
      <div
        className={`relative overflow-y-auto overscroll-contain ${maskClass} ${className}`}
        style={{ height }}
      >
        <div className="flex flex-col" style={{ gap, padding: '8px 0' }}>
          {items.map((it) => (
            <div key={it.key} className={itemClassName}>
              {it.content}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const s = state.current
    s.dragging = true
    s.vel = 0
    s.lastY = e.clientY
    s.lastT = e.timeStamp
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current
    if (!s.dragging) return
    const dy = e.clientY - s.lastY
    s.y += dy
    const dt = (e.timeStamp - s.lastT) / 1000
    if (dt > 0) {
      const inst = dy / dt
      // Smooth the throw velocity so a jittery last event can't fling it.
      s.vel = s.vel * 0.7 + inst * 0.3
    }
    s.lastY = e.clientY
    s.lastT = e.timeStamp
  }
  const endDrag = (e: React.PointerEvent) => {
    const s = state.current
    if (!s.dragging) return
    s.dragging = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  return (
    <div
      ref={viewportRef}
      className={`relative select-none overflow-hidden ${maskClass} ${className}`}
      style={{ height, perspective: tilt ? 900 : undefined, cursor: 'grab', touchAction: 'pan-x' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => {
        if (pauseOnHover) state.current.paused = true
      }}
      onPointerLeave={() => {
        state.current.paused = false
      }}
    >
      <div
        ref={trackRef}
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        style={{ gap, transform: tilt ? `rotateX(${tilt}deg)` : undefined, transformOrigin: 'center top' }}
      >
        {Array.from({ length: copies }).map((_, c) =>
          items.map((it, i) => (
            <div
              key={`${c}-${it.key}`}
              ref={c === 0 && i === 0 ? firstA : c === 1 && i === 0 ? firstB : undefined}
              className={itemClassName}
              aria-hidden={c > 0 || undefined}
            >
              {it.content}
            </div>
          )),
        )}
      </div>
    </div>
  )
}

// Soft top/bottom fade so rows dissolve at the edges instead of clipping hard.
const maskClass =
  '[mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]'
