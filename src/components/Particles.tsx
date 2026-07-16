import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

/**
 * Particles — a drifting constellation field.
 *
 * A cloud of points floats on a slow, wrapping drift. Whenever two points come
 * within `link` pixels of each other a line is drawn between them, fading as
 * the gap widens, so the field reads as a shifting web rather than loose dots.
 * The cursor is a gentle attractor: points inside `pull` radius lean toward it
 * and warm from white toward lime, and the links they share warm with them, so
 * moving the pointer drags a brighter knot of the web along with it.
 *
 * Pure canvas — no per-frame React state — and DPR-aware so the lines stay
 * crisp. Density scales with area (capped) so a wide band and a small tile both
 * look right. Under reduced motion the drift and the cursor pull are dropped and
 * a single static, evenly-spaced web is painted once (and re-painted on resize).
 */
export function Particles({
  className = '',
  density = 0.00011,
  maxCount = 90,
  link = 116,
  pull = 130,
  speed = 0.22,
}: {
  className?: string
  /** Points per square pixel; the real count is area × density, capped. */
  density?: number
  maxCount?: number
  /** Distance under which two points are joined by a line. */
  link?: number
  /** Cursor influence radius. */
  pull?: number
  /** Base drift speed. */
  speed?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let parts: Particle[] = []
    let raf = 0
    let w = 0
    let h = 0
    const pointer = { x: -9999, y: -9999, active: false }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const link2 = link * link

    // A deterministic PRNG seeded from the index keeps the layout stable across
    // rebuilds (resize) instead of reshuffling — and avoids Math.random.
    function rand(seed: number) {
      const s = Math.sin(seed * 12.9898) * 43758.5453
      return s - Math.floor(s)
    }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.max(8, Math.min(maxCount, Math.round(w * h * density)))
      parts = []
      for (let i = 0; i < count; i++) {
        const a = rand(i + 1)
        const b = rand(i + 7.3)
        const c = rand(i + 13.7)
        const d = rand(i + 21.1)
        parts.push({
          x: a * w,
          y: b * h,
          vx: (c - 0.5) * speed,
          vy: (d - 0.5) * speed,
          r: 0.9 + rand(i + 31.9) * 1.4,
        })
      }
    }

    // Shared line-drawing pass. `animate` gates the cursor warmth so the static
    // render can reuse the exact same web geometry.
    function drawLinks(animate: boolean) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]
        for (let j = i + 1; j < parts.length; j++) {
          const q = parts[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const d2 = dx * dx + dy * dy
          if (d2 > link2) continue
          const t = 1 - Math.sqrt(d2) / link
          let warm = 0
          if (animate && pointer.active) {
            const mx = (p.x + q.x) / 2 - pointer.x
            const my = (p.y + q.y) / 2 - pointer.y
            warm = Math.max(0, 1 - Math.hypot(mx, my) / pull)
          }
          ctx!.beginPath()
          ctx!.moveTo(p.x, p.y)
          ctx!.lineTo(q.x, q.y)
          if (warm > 0.02) {
            ctx!.strokeStyle = `rgba(220,248,124,${(0.1 + warm * 0.5) * t})`
          } else {
            ctx!.strokeStyle = `rgba(255,255,255,${0.12 * t})`
          }
          ctx!.lineWidth = 1
          ctx!.stroke()
        }
      }
    }

    function drawDots(animate: boolean) {
      for (const p of parts) {
        let warm = 0
        if (animate && pointer.active) {
          warm = Math.max(0, 1 - Math.hypot(p.x - pointer.x, p.y - pointer.y) / pull)
        }
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r + warm * 1.4, 0, Math.PI * 2)
        if (warm > 0.02) {
          ctx!.fillStyle = `rgba(220,248,124,${0.35 + warm * 0.55})`
        } else {
          ctx!.fillStyle = 'rgba(255,255,255,0.4)'
        }
        ctx!.fill()
      }
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h)
      drawLinks(false)
      drawDots(false)
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h)
      for (const p of parts) {
        if (pointer.active) {
          const dx = pointer.x - p.x
          const dy = pointer.y - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < pull && dist > 0.01) {
            const force = (1 - dist / pull) * 0.06
            p.vx += (dx / dist) * force
            p.vy += (dy / dist) * force
          }
        }
        // gentle damping keeps the cursor nudge from running away
        p.vx *= 0.99
        p.vy *= 0.99
        p.x += p.vx
        p.y += p.vy
        // wrap at the edges so the field never empties out
        if (p.x < -2) p.x = w + 2
        else if (p.x > w + 2) p.x = -2
        if (p.y < -2) p.y = h + 2
        else if (p.y > h + 2) p.y = -2
      }
      drawLinks(true)
      drawDots(true)
      raf = requestAnimationFrame(frame)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    build()

    if (reduce) {
      drawStatic()
      const ro = new ResizeObserver(() => {
        build()
        drawStatic()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => build())
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, density, maxCount, link, pull, speed])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
