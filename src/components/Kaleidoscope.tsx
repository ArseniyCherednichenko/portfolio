import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Kaleidoscope: a living mandala painted by the pointer's own motion.
//
// Deliberately distinct from the site's other pointer fields, which all react
// *locally* at the cursor — DotGrid springs the nearest dots, MagnetLines turns
// needles, Threads bulges fixed waves, Ribbons chase the pointer, MetaBalls
// fuse blobs, PixelTrail ignites a grid. This one does not nudge a field: it
// takes the path the pointer traces and reflects it into N-fold rotational
// *and* mirror symmetry, accumulating the strokes into a slowly-fading,
// self-composing figure. Move slowly and you draw deliberate petals; sweep fast
// and you fling bright arms out to the rim. When the pointer is idle a gentle
// lissajous keeps the figure blooming on its own, so it is never empty.
//
// The mechanism: each frame a short segment (previous draw point -> current) is
// drawn once per slice through a rotated context, then drawn again mirrored, so
// one gesture lands as `segments * 2` symmetric strokes. A translucent fill of
// the background colour decays the whole surface every frame (the trail), and
// the fresh strokes are composited with `'lighter'` so crossings build into
// light. One canvas, one RAF loop, no per-point React state on the hot path,
// DPR-capped at 2, ResizeObserver-driven, cleaned up on unmount. The hue drifts
// gently along an on-brand lime -> teal -> sky ramp so the mandala stays warm
// and lime-led rather than a rainbow. Under reduced motion it paints a single
// still, seeded mandala once (no loop, no listeners). aria-hidden, decorative.

const TAU = Math.PI * 2

// On-brand hue ramp, lime-led. Arranged so a drifting phase passes mostly
// through lime and teal, only grazing sky, keeping the field warm.
const RAMP: [number, number, number][] = [
  [220, 248, 124], // lime
  [150, 226, 180], // teal
  [140, 200, 255], // sky
  [150, 226, 180], // teal (return, so the loop is seamless)
]

function ramp(p: number): [number, number, number] {
  const n = RAMP.length
  const f = ((p % 1) + 1) % 1
  const x = f * n
  const i = Math.floor(x) % n
  const j = (i + 1) % n
  const t = x - Math.floor(x)
  const a = RAMP[i]
  const b = RAMP[j]
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

export function Kaleidoscope({
  className = '',
  /** How many rotational slices; the mirror pass doubles the visible symmetry. */
  segments = 6,
  /** Background colour to fade toward, as an "r,g,b" string. Match the host panel. */
  background = '9,9,11',
  /**
   * Where to read the pointer. `'self'` listens on the canvas (an interactive
   * panel). `'window'` listens globally, so the canvas can stay
   * `pointer-events-none` behind other content as an ambient layer.
   */
  listen = 'self',
}: {
  className?: string
  segments?: number
  background?: string
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
    const seg = TAU / segments

    // Pointer position (canvas-relative) and whether it is currently over us.
    const pointer = { x: 0, y: 0, active: false }
    // The last point we drew from, in centre-relative coords, plus a guard so a
    // jump (the idle<->pointer handover, or the pointer re-entering) never draws
    // a stray line across the figure.
    let prevX = 0
    let prevY = 0
    let hasPrev = false

    function fillOpaque() {
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.fillStyle = `rgb(${background})`
      ctx!.fillRect(0, 0, w, h)
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      fillOpaque()
      hasPrev = false
    }

    // Draw one short segment (centre-relative a -> b) reflected into every slice
    // and its mirror. Assumes the caller has set stroke style/width/composite.
    function symmetric(ax: number, ay: number, bx: number, by: number) {
      const cx = w / 2
      const cy = h / 2
      for (let k = 0; k < segments; k++) {
        ctx!.save()
        ctx!.translate(cx, cy)
        ctx!.rotate(k * seg)
        ctx!.beginPath()
        ctx!.moveTo(ax, ay)
        ctx!.lineTo(bx, by)
        ctx!.stroke()
        // Mirror across the x-axis of this slice for a true kaleidoscope fold.
        ctx!.beginPath()
        ctx!.moveTo(ax, -ay)
        ctx!.lineTo(bx, -by)
        ctx!.stroke()
        ctx!.restore()
      }
    }

    // The idle pen: an incommensurate lissajous around the centre, so with no
    // input the figure keeps composing a slowly-turning rose.
    function idlePoint(t: number): [number, number] {
      const reach = Math.min(w, h) * 0.32
      return [
        Math.sin(t * 0.9) * reach + Math.sin(t * 2.3) * reach * 0.35,
        Math.cos(t * 1.3) * reach + Math.cos(t * 3.1) * reach * 0.3,
      ]
    }

    function frame(t: number) {
      // Decay the whole surface toward the background — this is the trail.
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.fillStyle = `rgba(${background},0.055)`
      ctx!.fillRect(0, 0, w, h)

      // Current pen point, in centre-relative coords.
      let px: number
      let py: number
      if (pointer.active) {
        px = pointer.x - w / 2
        py = pointer.y - h / 2
      } else {
        const [ix, iy] = idlePoint(t)
        px = ix
        py = iy
      }

      if (hasPrev) {
        const dx = px - prevX
        const dy = py - prevY
        const v = Math.hypot(dx, dy)
        // Skip an implausibly long jump (a handover / re-entry), just re-anchor.
        if (v < Math.min(w, h) * 0.6) {
          const [r, g, b] = ramp(t * 0.06 + Math.atan2(py, px) / TAU)
          const width = 1.3 + Math.min(v * 0.06, 4.2)
          const alpha = 0.32 + Math.min(v * 0.012, 0.4)
          ctx!.globalCompositeOperation = 'lighter'
          ctx!.lineCap = 'round'
          ctx!.lineJoin = 'round'
          ctx!.lineWidth = width
          ctx!.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
          ctx!.shadowBlur = 10
          ctx!.shadowColor = `rgba(${r},${g},${b},${(alpha * 0.8).toFixed(3)})`
          // Sub-step a fast stroke so it stays a continuous arc, not a chord.
          const steps = Math.max(1, Math.min(6, Math.round(v / 14)))
          for (let s = 1; s <= steps; s++) {
            const a0 = (s - 1) / steps
            const a1 = s / steps
            symmetric(
              prevX + dx * a0,
              prevY + dy * a0,
              prevX + dx * a1,
              prevY + dy * a1,
            )
          }
          ctx!.shadowBlur = 0
        }
      }

      prevX = px
      prevY = py
      hasPrev = true

      raf = requestAnimationFrame(loop)
    }

    let startedAt = 0
    function loop(now: number) {
      if (!startedAt) startedAt = now
      frame((now - startedAt) / 1000)
    }

    // A still, seeded mandala for reduced motion: sample the idle lissajous over
    // a fixed span and lay it down once, symmetric, at a calm brightness.
    function drawStatic() {
      fillOpaque()
      ctx!.globalCompositeOperation = 'lighter'
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      const N = 220
      let ax = 0
      let ay = 0
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * 7
        const [bx, by] = idlePoint(t)
        if (i > 0) {
          const [r, g, b] = ramp(t * 0.06 + Math.atan2(by, bx) / TAU)
          ctx!.lineWidth = 1.4
          ctx!.strokeStyle = `rgba(${r},${g},${b},0.34)`
          symmetric(ax, ay, bx, by)
        }
        ax = bx
        ay = by
      }
      ctx!.globalCompositeOperation = 'source-over'
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      if (!pointer.active) hasPrev = false // clean handover from idle
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
      hasPrev = false // clean handover back to idle
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
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, segments, background, listen])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
