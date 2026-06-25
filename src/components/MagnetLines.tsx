import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

type Line = {
  cx: number // cell centre x
  cy: number // cell centre y
  angle: number // current angle (radians), eased toward the pointer
}

// Shortest signed difference between two angles, kept in (-PI, PI].
function angleDelta(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

// Interactive canvas grid of small lines ("needles") that all rotate to point
// at the cursor, easing smoothly and brightening toward lime the closer the
// pointer gets. Pure canvas for smoothness across a dense grid. Under
// reduced-motion it draws a calm, static radial composition (every needle
// angled toward the grid centre) with no animation loop.
export function MagnetLines({
  className = '',
  gap = 36,
  length = 18,
  proximity = 200,
}: {
  className?: string
  /** Spacing between needle centres, in px. */
  gap?: number
  /** Length of each needle, in px. */
  length?: number
  /** Radius within which needles light toward lime. */
  proximity?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lines: Line[] = []
    let raf = 0
    let w = 0
    let h = 0
    const pointer = { x: -9999, y: -9999, active: false }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function build(initialAngle: (cx: number, cy: number) => number) {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      lines = []
      const cols = Math.max(1, Math.floor(w / gap))
      const rows = Math.max(1, Math.floor(h / gap))
      const offX = (w - (cols - 1) * gap) / 2
      const offY = (h - (rows - 1) * gap) / 2
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = offX + c * gap
          const cy = offY + r * gap
          lines.push({ cx, cy, angle: initialAngle(cx, cy) })
        }
      }
    }

    function drawLine(l: Line, brightness: number) {
      const hx = (Math.cos(l.angle) * length) / 2
      const hy = (Math.sin(l.angle) * length) / 2
      ctx!.beginPath()
      ctx!.moveTo(l.cx - hx, l.cy - hy)
      ctx!.lineTo(l.cx + hx, l.cy + hy)
      if (brightness > 0.02) {
        ctx!.strokeStyle = `rgba(220,248,124,${0.22 + brightness * 0.7})`
        ctx!.lineWidth = 1.4 + brightness * 1.1
      } else {
        ctx!.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx!.lineWidth = 1.4
      }
      ctx!.stroke()
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.lineCap = 'round'
      for (const l of lines) drawLine(l, 0)
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.lineCap = 'round'
      for (const l of lines) {
        const dx = pointer.x - l.cx
        const dy = pointer.y - l.cy
        const dist = Math.hypot(dx, dy)
        if (pointer.active) {
          const target = Math.atan2(dy, dx)
          l.angle += angleDelta(l.angle, target) * 0.16
        }
        const near = pointer.active ? Math.max(0, 1 - dist / proximity) : 0
        drawLine(l, near)
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
      pointer.x = -9999
      pointer.y = -9999
    }

    if (reduce) {
      // Calm static radial: every needle aimed at the grid centre.
      build((cx, cy) => {
        const rect = canvas!.getBoundingClientRect()
        return Math.atan2(rect.height / 2 - cy, rect.width / 2 - cx)
      })
      drawStatic()
      const ro = new ResizeObserver(() => {
        build((cx, cy) => {
          const rect = canvas!.getBoundingClientRect()
          return Math.atan2(rect.height / 2 - cy, rect.width / 2 - cx)
        })
        drawStatic()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Start needles aimed gently outward from the centre so the first frame is calm.
    build((cx, cy) => Math.atan2(cy - h / 2, cx - w / 2))
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => build((cx, cy) => Math.atan2(cy - h / 2, cx - w / 2)))
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, gap, length, proximity])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
