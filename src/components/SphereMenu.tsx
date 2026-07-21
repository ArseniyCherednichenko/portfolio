import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

export interface SphereItem {
  label: string
  /** Internal route (renders a router Link). */
  to?: string
  /** External URL (renders a new-tab anchor). */
  href?: string
  /** Short muted sub-label shown under the label. */
  hint?: string
}

interface SphereMenuProps {
  items: SphereItem[]
  /** Fallback square size in px; the field is responsive and clamps to its container width. */
  size?: number
  className?: string
}

/**
 * SphereMenu — a draggable 3D sphere of billboarded links, a "tag cloud" you
 * grab and spin. Deliberately distinct from CircularGallery (a flat coverflow):
 * here the points live on a real sphere and are projected to 2D each frame, so
 * the labels always face you (billboards) while depth dims and shrinks the ones
 * turned away. The classic spherical-cloud motion the site did not have.
 *
 * No CSS 3D and no per-item React state on the hot path: base points sit on a
 * Fibonacci sphere, one RAF loop rotates every point by the current angles,
 * projects it, and writes transform/opacity/z-index straight onto the node.
 * Drag spins it (with release inertia); left alone it drifts on a gentle idle
 * spin so the field always has life. Under reduced motion the whole mechanism
 * is dropped for a plain, fully legible flex-wrap of the same real links.
 */
export function SphereMenu({ items, size = 460, className = '' }: SphereMenuProps) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<(HTMLElement | null)[]>([])

  // Rotation state + velocity live in refs so the loop never re-renders React.
  const rot = useRef({ x: -0.35, y: 0 })
  const vel = useRef({ x: 0, y: 0 })
  const drag = useRef({ active: false, id: -1, lastX: 0, lastY: 0, moved: 0 })
  const geom = useRef({ cx: size / 2, cy: size / 2, r: size * 0.41 })

  // Deterministic Fibonacci-sphere distribution: even coverage, stable order.
  const base = useRef(
    items.map((_, i) => {
      const n = items.length
      const phi = Math.acos(1 - (2 * (i + 0.5)) / n)
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5)
      return {
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
      }
    }),
  )

  useEffect(() => {
    if (reduce) return
    const wrap = wrapRef.current
    if (!wrap) return

    let raf = 0
    const BASE_SPIN = 0.0022 // gentle idle drift on the Y axis
    const FRICTION = 0.94

    const measure = () => {
      const w = Math.min(wrap.clientWidth, size)
      geom.current = { cx: w / 2, cy: w / 2, r: w * 0.41 }
      wrap.style.height = `${w}px`
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)

    const frame = () => {
      if (!drag.current.active) {
        vel.current.x *= FRICTION
        vel.current.y *= FRICTION
        rot.current.x += vel.current.x
        rot.current.y += vel.current.y + BASE_SPIN
      }
      // Keep the poles from tipping fully over — reads best kept near upright.
      rot.current.x = Math.max(-1.15, Math.min(1.15, rot.current.x))

      const { x: ax, y: ay } = rot.current
      const sinY = Math.sin(ay)
      const cosY = Math.cos(ay)
      const sinX = Math.sin(ax)
      const cosX = Math.cos(ax)
      const { cx, cy, r } = geom.current

      for (let i = 0; i < base.current.length; i++) {
        const node = nodeRefs.current[i]
        if (!node) continue
        const p = base.current[i]
        // Rotate around Y, then X.
        const x1 = p.x * cosY + p.z * sinY
        const z1 = -p.x * sinY + p.z * cosY
        const y2 = p.y * cosX - z1 * sinX
        const z2 = p.y * sinX + z1 * cosX
        const depth = (z2 + 1) / 2 // 0 (back) .. 1 (front)
        const scale = 0.62 + depth * 0.54
        node.style.transform = `translate(-50%,-50%) translate(${cx + x1 * r}px, ${cy + y2 * r}px) scale(${scale})`
        node.style.opacity = `${0.32 + depth * 0.68}`
        node.style.zIndex = `${Math.round(depth * 1000)}`
        // Pointer events only on the front hemisphere so back labels never
        // steal a click from a nearer one sitting over them.
        node.style.pointerEvents = z2 > -0.15 ? 'auto' : 'none'
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reduce, size])

  // Pointer drag → rotation. Kept off the render path entirely.
  const onPointerDown = (e: React.PointerEvent) => {
    if (reduce) return
    drag.current = { active: true, id: e.pointerId, lastX: e.clientX, lastY: e.clientY, moved: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d.active || e.pointerId !== d.id) return
    const dx = e.clientX - d.lastX
    const dy = e.clientY - d.lastY
    d.lastX = e.clientX
    d.lastY = e.clientY
    d.moved += Math.abs(dx) + Math.abs(dy)
    const k = 0.006
    rot.current.y += dx * k
    rot.current.x -= dy * k
    vel.current.y = dx * k
    vel.current.x = -dy * k
  }
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current.id !== e.pointerId) return
    drag.current.active = false
  }

  if (reduce) {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
        {items.map((it) => (
          <ItemLink key={it.label} item={it} className="relative" />
        ))}
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      className={`relative mx-auto w-full touch-none select-none [cursor:grab] active:[cursor:grabbing] ${className}`}
      style={{ maxWidth: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="group"
      aria-label="Explore the site — drag to spin"
    >
      {items.map((it, i) => (
        <div
          key={it.label}
          ref={(el) => {
            nodeRefs.current[i] = el
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ opacity: 0 }}
        >
          <ItemLink
            item={it}
            // Swallow the click if the pointer was dragging the sphere.
            onClickCapture={(e) => {
              if (drag.current.moved > 6) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          />
        </div>
      ))}
    </div>
  )
}

function ItemLink({
  item,
  className = '',
  onClickCapture,
}: {
  item: SphereItem
  className?: string
  onClickCapture?: (e: React.MouseEvent) => void
}) {
  const inner = (
    <span className="pointer-events-none flex flex-col items-center leading-tight">
      <span className="font-display text-[15px] font-medium text-white sm:text-base">{item.label}</span>
      {item.hint ? <span className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">{item.hint}</span> : null}
    </span>
  )
  const cls =
    'inline-flex whitespace-nowrap rounded-full border border-white/10 bg-[#0A0A0A]/70 px-4 py-2 backdrop-blur-sm transition-colors duration-200 hover:border-[#DCF87C]/50 hover:bg-[#DCF87C]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 ' +
    className

  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={cls} onClickCapture={onClickCapture} data-cursor>
        {inner}
      </a>
    )
  }
  if (item.to) {
    return (
      <Link to={item.to} className={cls} onClickCapture={onClickCapture} data-cursor>
        {inner}
      </Link>
    )
  }
  return <span className={cls}>{inner}</span>
}
