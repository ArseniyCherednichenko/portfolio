import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Ribbons: a small set of flowing, tapered trails that snake after the cursor.
// Each ribbon is a chain of points — the head eases toward a target and every
// following point eases toward the one ahead of it, so the body lags into a
// smooth, whip-like trail that fans out and settles. When the pointer is idle
// the ribbons drift on their own gentle lissajous paths, so the field always
// has life. Deliberately distinct from the site's other pointer fields: DotGrid
// springs round dots, MagnetLines turns needles, Threads bends fixed waves,
// Beams leans light shafts, MetaBalls fuses blobs, PixelTrail ignites a grid.
// This one is a flowing tapered line that chases the cursor.
//
// One canvas, one RAF loop, no per-point React state on the hot path. DPR-capped
// at 2, ResizeObserver-driven, cleaned up on unmount. Under reduced motion it
// paints a single calm static set of arcs with no loop or listeners.
// aria-hidden, purely decorative.

// Deterministic per-ribbon jitter (no Math.random, so it stays stable across
// renders and never breaks a resumed workflow). A tiny hash of the index.
function seed(i: number): number {
  const s = Math.sin(i * 78.233 + 12.9898) * 43758.5453
  return s - Math.floor(s)
}

const TAU = Math.PI * 2

export function Ribbons({
  className = '',
  /** Number of ribbons layered over one another. */
  count = 4,
  /** Trail colour as an "r,g,b" string. */
  color = '220,248,124',
  /** Points per ribbon — more points = a longer, smoother trail. */
  points = 26,
  /** Width of a ribbon at its head, px (tapers to nothing at the tail). */
  width = 30,
  /**
   * Where to read the pointer. `'self'` listens on the canvas (an interactive
   * panel). `'window'` listens globally, so the canvas can stay
   * `pointer-events-none` behind selectable copy as an ambient layer.
   */
  listen = 'self',
}: {
  className?: string
  count?: number
  color?: string
  points?: number
  width?: number
  listen?: 'self' | 'window'
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pointer = { x: 0, y: 0, active: false }

    type Node = { x: number; y: number }
    const ribbons = Array.from({ length: count }, (_, i) => {
      const r = seed(i)
      const r2 = seed(i + 11)
      return {
        pts: [] as Node[],
        // Head chase speed and how tightly the body follows it.
        ease: 0.16 + r * 0.12,
        follow: 0.32 + (i / Math.max(1, count)) * 0.14,
        // Where this ribbon's head sits relative to the cursor, so heads fan
        // out around the pointer instead of stacking on one spot.
        angle: (i / Math.max(1, count)) * TAU,
        spread: 18 + r2 * 26,
        // Idle drift — a per-ribbon lissajous so the field lives without input.
        idleFreq: 0.18 + r * 0.16,
        idlePhase: i * 1.7,
        idleAmpX: 0.16 + r2 * 0.12,
        idleAmpY: 0.12 + r * 0.12,
        // Base opacity, so layered ribbons read as depth.
        base: 0.5 + (i % 3) * 0.14,
      }
    })

    function seedPoints() {
      const cx = w / 2
      const cy = h / 2
      for (const rb of ribbons) {
        if (rb.pts.length === points) continue
        rb.pts = Array.from({ length: points }, () => ({ x: cx, y: cy }))
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedPoints()
    }

    // Draw one ribbon as a tapered, glowing stroke: widest and brightest at the
    // head, thinning and fading toward the tail. Round caps knit the straight
    // segments into a smooth line.
    function drawRibbon(pts: Node[], base: number) {
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      for (let k = 1; k < pts.length; k++) {
        const p = 1 - (k - 1) / (pts.length - 1) // 1 at head -> 0 at tail
        const a = (p * p) * 0.55 * base
        if (a < 0.008) continue
        ctx!.beginPath()
        ctx!.moveTo(pts[k - 1].x, pts[k - 1].y)
        ctx!.lineTo(pts[k].x, pts[k].y)
        ctx!.lineWidth = Math.max(0.4, width * p)
        ctx!.strokeStyle = `rgba(${color},${a.toFixed(3)})`
        // A soft bloom near the head lifts it off the surface.
        ctx!.shadowBlur = p * 12
        ctx!.shadowColor = `rgba(${color},${(a * 0.9).toFixed(3)})`
        ctx!.stroke()
      }
      ctx!.shadowBlur = 0
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      // Lay each ribbon out as a calm horizontal arc, offset per index, and
      // paint it once. No motion, still legible as ribbons.
      for (let i = 0; i < ribbons.length; i++) {
        const rb = ribbons[i]
        const off = (i - (ribbons.length - 1) / 2) * 26
        for (let k = 0; k < rb.pts.length; k++) {
          const f = k / (rb.pts.length - 1)
          rb.pts[k].x = cx + (f - 0.5) * w * 0.66
          rb.pts[k].y = cy + off + Math.sin(f * Math.PI + i) * (h * 0.06)
        }
        drawRibbon(rb.pts, rb.base * 0.8)
      }
    }

    function frame(t: number) {
      ctx!.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const reach = Math.min(w, h)
      for (let i = 0; i < ribbons.length; i++) {
        const rb = ribbons[i]
        // Target: fan around the cursor when active, else drift idly.
        let tx: number
        let ty: number
        if (pointer.active) {
          tx = pointer.x + Math.cos(rb.angle) * rb.spread
          ty = pointer.y + Math.sin(rb.angle) * rb.spread
        } else {
          tx = cx + Math.sin(t * rb.idleFreq + rb.idlePhase) * reach * rb.idleAmpX
          ty = cy + Math.cos(t * rb.idleFreq * 1.3 + rb.idlePhase) * reach * rb.idleAmpY
        }
        const head = rb.pts[0]
        head.x += (tx - head.x) * rb.ease
        head.y += (ty - head.y) * rb.ease
        for (let k = 1; k < rb.pts.length; k++) {
          rb.pts[k].x += (rb.pts[k - 1].x - rb.pts[k].x) * rb.follow
          rb.pts[k].y += (rb.pts[k - 1].y - rb.pts[k].y) * rb.follow
        }
        drawRibbon(rb.pts, rb.base)
      }
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
    }

    resize()

    if (reduce) {
      drawStatic()
      const ro = new ResizeObserver(() => {
        resize()
        drawStatic()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const target: Window | HTMLCanvasElement = listen === 'window' ? window : canvas
    target.addEventListener('pointermove', onMove as EventListener)
    target.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const startedAt = performance.now()
    function loop(now: number) {
      frame((now - startedAt) / 1000)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, count, color, points, width, listen])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
