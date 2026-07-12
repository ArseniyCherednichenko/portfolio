import { useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

export interface TagSphereProps {
  /** The words to arrange on the sphere. */
  items: readonly string[]
  /** Sphere radius in px (the field sizes itself to fit). Default 150. */
  radius?: number
  /** Words to paint lime (matched case-insensitively). */
  accent?: readonly string[]
  className?: string
}

/** Evenly distribute n points on a unit sphere (Fibonacci lattice). Deterministic. */
function fibSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + 0.5) * (2 / n) // -1 .. 1
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r])
  }
  return pts
}

/**
 * TagSphere — a 3D word sphere that turns on its own and can be grabbed and
 * spun. A kind of motion the set was missing: not a canvas field, card, or
 * text effect, but words distributed over a real sphere, depth-sorted and
 * projected each frame so the ones facing you sit large and bright while the
 * far side recedes and dims. It drifts on a slow auto-spin; a pointer drag
 * grabs it 1:1 and the release carries the throw as inertia that eases back
 * into the drift. No per-word React state on the hot path — one RAF loop
 * writes each label's transform/opacity directly. Under reduced motion it
 * drops the sphere entirely for a calm, fully legible flex-wrap of the words.
 */
export default function TagSphere({
  items,
  radius = 150,
  accent = [],
  className = '',
}: TagSphereProps) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const tagRefs = useRef<(HTMLSpanElement | null)[]>([])
  const base = useMemo(() => fibSphere(items.length), [items.length])
  const accentSet = useMemo(
    () => new Set(accent.map((a) => a.toLowerCase())),
    [accent],
  )

  useEffect(() => {
    if (reduce) return
    const wrap = wrapRef.current
    if (!wrap) return

    // Rotation angles and angular velocities (radians / frame at 60fps).
    let rx = -0.35
    let ry = 0
    const autoVX = 0.0009
    const autoVY = 0.0022
    let vx = autoVX
    let vy = autoVY

    let dragging = false
    let lastX = 0
    let lastY = 0
    let pointerId: number | null = null
    let raf = 0

    const project = () => {
      const cosX = Math.cos(rx)
      const sinX = Math.sin(rx)
      const cosY = Math.cos(ry)
      const sinY = Math.sin(ry)
      for (let i = 0; i < base.length; i++) {
        const el = tagRefs.current[i]
        if (!el) continue
        const [x, y, z] = base[i]
        // rotate about X, then about Y
        const y1 = y * cosX - z * sinX
        const z1 = y * sinX + z * cosX
        const x2 = x * cosY + z1 * sinY
        const z2 = -x * sinY + z1 * cosY
        const y2 = y1
        // z2 in [-1, 1]: 1 = facing the viewer
        const depth = (z2 + 1) / 2 // 0 (back) .. 1 (front)
        const scale = 0.55 + depth * 0.75
        const opacity = 0.22 + depth * 0.78
        el.style.transform = `translate(-50%, -50%) translate3d(${(
          x2 * radius
        ).toFixed(2)}px, ${(y2 * radius).toFixed(2)}px, 0) scale(${scale.toFixed(
          3,
        )})`
        el.style.opacity = opacity.toFixed(3)
        el.style.zIndex = String(Math.round(depth * 100))
        // only the front-facing labels take the pointer, so links stay reachable
        el.style.pointerEvents = z2 > -0.15 ? 'auto' : 'none'
        el.style.filter = depth < 0.4 ? `blur(${((0.4 - depth) * 3).toFixed(1)}px)` : 'none'
      }
    }

    const tick = () => {
      if (!dragging) {
        // ease velocity back toward the gentle auto-drift
        vx += (autoVX - vx) * 0.03
        vy += (autoVY - vy) * 0.03
      }
      rx += vx
      ry += vy
      project()
      raf = requestAnimationFrame(tick)
    }

    const onDown = (e: PointerEvent) => {
      dragging = true
      pointerId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      wrap.setPointerCapture(e.pointerId)
      wrap.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      const k = 0.006
      vy = dx * k
      vx = -dy * k
      ry += vy
      rx += vx
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      if (pointerId !== null && wrap.hasPointerCapture(pointerId)) {
        wrap.releasePointerCapture(pointerId)
      }
      pointerId = null
      wrap.style.cursor = 'grab'
    }

    wrap.addEventListener('pointerdown', onDown)
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerup', onUp)
    wrap.addEventListener('pointercancel', onUp)
    project()
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      wrap.removeEventListener('pointerdown', onDown)
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerup', onUp)
      wrap.removeEventListener('pointercancel', onUp)
    }
  }, [base, radius, reduce])

  if (reduce) {
    return (
      <div className={`flex flex-wrap justify-center gap-3 ${className}`}>
        {items.map((label) => (
          <span
            key={label}
            className={`rounded-full border px-4 py-2 text-sm ${
              accentSet.has(label.toLowerCase())
                ? 'border-[#DCF87C]/40 text-[#DCF87C]'
                : 'border-white/10 bg-white/[0.03] text-white/70'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    )
  }

  const size = radius * 2 + 120

  return (
    <div
      ref={wrapRef}
      className={`relative mx-auto touch-none select-none [cursor:grab] ${className}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
      role="group"
      aria-label="Interactive sphere of skills. Drag to spin."
    >
      {items.map((label, i) => {
        const isAccent = accentSet.has(label.toLowerCase())
        return (
          <span
            key={label}
            ref={(el) => {
              tagRefs.current[i] = el
            }}
            className={`absolute left-1/2 top-1/2 whitespace-nowrap text-[15px] font-medium leading-none tracking-tight transition-colors duration-200 will-change-transform sm:text-base ${
              isAccent ? 'text-[#DCF87C]' : 'text-white/80 hover:text-white'
            }`}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
