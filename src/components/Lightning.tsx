import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A field of electric filaments — a handful of jagged bolts that wriggle
// continuously between drifting anchors, glow lime with additive blending, and
// carry a bright pulse that travels their length like a charge. The cursor is a
// magnet: nearby bolts reach their far end toward the pointer and brighten as it
// approaches. Deliberately distinct from the site's calmer canvas fields (the
// soft shafts of `Beams`, the whipping trails of `Ribbons`, the heat grid of
// `PixelTrail`): here it reads as live current, not light or ink.
//
// The wriggle is driven by summed seeded sines, not per-frame randomness, so it
// never strobes — a continuous plasma flicker rather than a photosensitive
// strike. One RAF loop, DPR-aware, ResizeObserver-driven, cleaned up on unmount.
// Under reduced motion it paints a single static set of dim bolts, no loop or
// listeners. Purely decorative, so `aria-hidden`.

// Deterministic per-bolt jitter (no Math.random, so it stays stable across
// renders and never breaks resume). A tiny hash of two indices.
function seed(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// Points along a bolt. More points = finer jag; the ends are pinned so the
// filament stays anchored while the middle wriggles.
const SEGMENTS = 12

export function Lightning({
  className = '',
  /** Number of filaments. */
  count = 5,
  /** Glow colour as an "r,g,b" string. */
  accent = '220,248,124',
  /**
   * Where to read the pointer. `'self'` listens on the canvas (an interactive
   * panel). `'window'` listens globally, so the canvas can sit behind other
   * content and still react while staying `pointer-events-none`.
   */
  listen = 'self',
  /** Overall brightness multiplier, 0..1-ish. Lower for behind-text ambience. */
  intensity = 1,
}: {
  className?: string
  count?: number
  accent?: string
  listen?: 'self' | 'window'
  intensity?: number
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
    const pointer = { x: -9999, y: -9999, active: false }

    // Per-bolt constants, seeded off the index so the field looks organic with
    // no per-frame randomness. Each bolt drifts its two anchors on slow
    // lissajous paths and wriggles its body on two summed sines.
    const bolts = Array.from({ length: count }, (_, i) => {
      const r = (k: number) => seed(i + 1, k)
      return {
        // Anchor drift: base position (fraction of canvas) + orbit radius/phase.
        ax: 0.12 + r(0) * 0.28,
        ay: 0.15 + r(1) * 0.7,
        bx: 0.62 + r(2) * 0.3,
        by: 0.15 + r(3) * 0.7,
        driftR: 0.03 + r(4) * 0.05, // anchor orbit radius (fraction)
        driftS: 0.1 + r(5) * 0.18, // anchor orbit speed
        driftP: r(6) * Math.PI * 2, // anchor orbit phase
        wig1: 0.8 + r(7) * 1.4, // wriggle freq A
        wig2: 1.8 + r(8) * 2.4, // wriggle freq B
        wigP: r(9) * Math.PI * 2, // wriggle phase
        amp: 0.05 + r(10) * 0.06, // wriggle amplitude (fraction of length)
        pulseS: 0.25 + r(11) * 0.5, // charge-pulse travel speed
        pulseP: r(12), // charge-pulse phase offset
        breathS: 0.4 + r(13) * 0.6, // brightness breathing speed
        base: 0.22 + r(14) * 0.18, // resting brightness
      }
    })

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Draw one bolt as a glowing jagged polyline with a travelling bright pulse.
    function drawBolt(b: (typeof bolts)[number], t: number) {
      const diag = Math.hypot(w, h)

      // Anchors drift on their orbits.
      const ax = (b.ax + Math.cos(t * b.driftS + b.driftP) * b.driftR) * w
      const ay = (b.ay + Math.sin(t * b.driftS * 0.9 + b.driftP) * b.driftR) * h
      let bx = (b.bx + Math.sin(t * b.driftS + b.driftP) * b.driftR) * w
      let by = (b.by + Math.cos(t * b.driftS * 1.1 + b.driftP) * b.driftR) * h

      // Cursor magnetism: the far end reaches toward the pointer, and the whole
      // bolt brightens as the pointer nears its span.
      let lit = 0
      if (pointer.active) {
        const midx = (ax + bx) / 2
        const midy = (ay + by) / 2
        const d = Math.hypot(pointer.x - midx, pointer.y - midy)
        lit = Math.exp(-(d * d) / (diag * 0.32) ** 2)
        bx += (pointer.x - bx) * lit * 0.6
        by += (pointer.y - by) * lit * 0.6
      }

      // Perpendicular of the anchor line, for the wriggle offset.
      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy) || 1
      const px = -dy / len
      const py = dx / len
      const amp = b.amp * len

      // Brightness: a slow breath plus the cursor lift.
      const breath = 0.5 + 0.5 * Math.sin(t * b.breathS + b.wigP)
      const bright = (b.base + breath * 0.22 + lit * 0.7) * intensity

      // The travelling charge — a bright band moving 0->1 along the bolt.
      const pulse = ((t * b.pulseS + b.pulseP) % 1 + 1) % 1

      // Build the jagged points.
      const pts: { x: number; y: number }[] = []
      for (let s = 0; s <= SEGMENTS; s++) {
        const u = s / SEGMENTS
        const x = ax + dx * u
        const y = ay + dy * u
        // Taper the wriggle to zero at both ends so the filament stays pinned.
        const taper = Math.sin(u * Math.PI)
        const off =
          (Math.sin(u * b.wig1 * Math.PI * 2 + t * 2.2 + b.wigP) +
            0.6 * Math.sin(u * b.wig2 * Math.PI * 2 - t * 1.4 + b.wigP)) *
          amp *
          taper
        pts.push({ x: x + px * off, y: y + py * off })
      }

      // Soft outer glow pass, then a crisp core, then the bright pulse node.
      ctx!.lineJoin = 'round'
      ctx!.lineCap = 'round'
      ctx!.shadowColor = `rgba(${accent},${(0.6 * bright).toFixed(3)})`

      // Outer halo.
      ctx!.shadowBlur = 18
      ctx!.strokeStyle = `rgba(${accent},${(0.18 * bright).toFixed(3)})`
      ctx!.lineWidth = 3.4
      stroke(pts)

      // Core filament.
      ctx!.shadowBlur = 8
      ctx!.strokeStyle = `rgba(${accent},${Math.min(0.95, 0.7 * bright + 0.15).toFixed(3)})`
      ctx!.lineWidth = 1.2
      stroke(pts)

      // The charge node: a bright dot riding the bolt at `pulse`.
      const seg = pulse * SEGMENTS
      const i0 = Math.min(SEGMENTS, Math.floor(seg))
      const i1 = Math.min(SEGMENTS, i0 + 1)
      const f = seg - i0
      const cx = pts[i0].x + (pts[i1].x - pts[i0].x) * f
      const cy = pts[i0].y + (pts[i1].y - pts[i0].y) * f
      const node = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 14)
      node.addColorStop(0, `rgba(${accent},${Math.min(0.9, bright).toFixed(3)})`)
      node.addColorStop(1, `rgba(${accent},0)`)
      ctx!.shadowBlur = 0
      ctx!.fillStyle = node
      ctx!.beginPath()
      ctx!.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx!.fill()
    }

    function stroke(pts: { x: number; y: number }[]) {
      ctx!.beginPath()
      ctx!.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx!.lineTo(pts[i].x, pts[i].y)
      ctx!.stroke()
    }

    function render(t: number) {
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'
      for (let i = 0; i < bolts.length; i++) drawBolt(bolts[i], t)
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.shadowBlur = 0
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // For a window listener, ignore points outside the canvas box.
      if (listen === 'window' && (x < 0 || y < 0 || x > w || y > h)) {
        pointer.active = false
        return
      }
      pointer.x = x
      pointer.y = y
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    resize()

    if (reduce) {
      render(0.6)
      const ro = new ResizeObserver(() => {
        resize()
        render(0.6)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const target: Window | HTMLCanvasElement = listen === 'window' ? window : canvas
    const start = performance.now()
    function frame(now: number) {
      render((now - start) / 1000)
      raf = requestAnimationFrame(frame)
    }
    target.addEventListener('pointermove', onMove as EventListener)
    target.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, count, accent, listen, intensity])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
