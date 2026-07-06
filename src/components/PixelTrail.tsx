import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// PixelTrail: a grid of small squares that ignite lime as the cursor sweeps
// across them, then cool and fade — leaving a glowing trail in the pointer's
// wake. Deliberately distinct from the site's other pointer fields: DotGrid
// springs round dots, MagnetLines turns needles, Threads bends waves, Beams
// leans light shafts, MetaBalls fuses blobs. This one lights pixels on contact
// and lets them decay, so the field remembers where you have been.
//
// One canvas, one RAF loop. Heat is a flat Float32Array (one value per cell);
// the pointer paints heat along its path (interpolated between frames so fast
// sweeps stay continuous), the loop decays every cell and redraws only the warm
// ones. No per-cell React state on the hot path. DPR-capped at 2,
// ResizeObserver-driven, cleaned up on unmount. Under reduced motion it paints
// a single calm static grid with no loop or listeners. aria-hidden, decorative.
export function PixelTrail({
  className = '',
  gap = 24,
  size = 8,
  radius = 42,
  decay = 0.9,
  color = '220,248,124',
  listen = 'self',
}: {
  className?: string
  /** Distance between pixel centres, px. */
  gap?: number
  /** Side length of each pixel square, px. */
  size?: number
  /** How far from the pointer path a pixel catches light, px. */
  radius?: number
  /** Per-frame heat multiplier (closer to 1 = a longer-lasting trail). */
  decay?: number
  /** Ignited pixel colour as an "r,g,b" string. */
  color?: string
  /**
   * Where to read the pointer. `'self'` listens on the canvas (an interactive
   * panel). `'window'` listens globally, so the canvas can stay
   * `pointer-events-none` behind selectable copy as an ambient layer.
   */
  listen?: 'self' | 'window'
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    let offX = 0
    let offY = 0
    let heat = new Float32Array(0)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const half = size / 2

    // Pointer path: last known point, so we can interpolate the segment the
    // cursor travelled between two events and ignite every cell along it.
    const pointer = { x: -9999, y: -9999, has: false }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.max(1, Math.floor(w / gap))
      rows = Math.max(1, Math.floor(h / gap))
      offX = (w - (cols - 1) * gap) / 2
      offY = (h - (rows - 1) * gap) / 2
      heat = new Float32Array(cols * rows)
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.fillStyle = 'rgba(255,255,255,0.06)'
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx!.fillRect(offX + c * gap - half, offY + r * gap - half, size, size)
        }
      }
    }

    // Paint heat onto every cell within `radius` of a single point.
    function ignite(px: number, py: number) {
      const reach = Math.ceil(radius / gap)
      const cx = Math.round((px - offX) / gap)
      const cy = Math.round((py - offY) / gap)
      for (let r = cy - reach; r <= cy + reach; r++) {
        if (r < 0 || r >= rows) continue
        for (let c = cx - reach; c <= cx + reach; c++) {
          if (c < 0 || c >= cols) continue
          const dx = offX + c * gap - px
          const dy = offY + r * gap - py
          const d = Math.hypot(dx, dy)
          if (d > radius) continue
          const v = 1 - d / radius
          const i = r * cols + c
          if (v > heat[i]) heat[i] = v
        }
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          let v = heat[i]
          const x = offX + c * gap - half
          const y = offY + r * gap - half
          if (v > 0.02) {
            v *= decay
            heat[i] = v
            // Warm pixels bloom a touch larger and gain a soft glow.
            const s = size + v * 4
            const o = half - s / 2
            ctx!.shadowBlur = v * 14
            ctx!.shadowColor = `rgba(${color},${v})`
            ctx!.fillStyle = `rgba(${color},${0.15 + v * 0.85})`
            ctx!.fillRect(x + o, y + o, s, s)
            ctx!.shadowBlur = 0
          } else {
            heat[i] = 0
            // Resting grid: a barely-there dot so the field reads as a surface.
            ctx!.fillStyle = 'rgba(255,255,255,0.05)'
            ctx!.fillRect(x, y, size, size)
          }
        }
      }
      raf = requestAnimationFrame(frame)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (pointer.has) {
        // Interpolate across the segment so a fast sweep leaves no gaps.
        const dx = x - pointer.x
        const dy = y - pointer.y
        const dist = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.round(dist / (gap * 0.5)))
        for (let s = 1; s <= steps; s++) {
          ignite(pointer.x + (dx * s) / steps, pointer.y + (dy * s) / steps)
        }
      } else {
        ignite(x, y)
      }
      pointer.x = x
      pointer.y = y
      pointer.has = true
    }
    function onLeave() {
      pointer.has = false
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

    const target: Window | HTMLCanvasElement = listen === 'window' ? window : canvas
    target.addEventListener('pointermove', onMove as EventListener)
    target.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => build())
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, gap, size, radius, decay, color, listen])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
