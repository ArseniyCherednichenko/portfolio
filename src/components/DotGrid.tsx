import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

type Dot = {
  ox: number // origin x
  oy: number // origin y
  x: number
  y: number
  vx: number
  vy: number
}

// Interactive canvas dot grid: dots are pushed away from the cursor with a
// spring return, and brighten toward lime the closer the pointer gets. Pure
// canvas for smoothness; static, evenly-lit grid when reduced-motion is set.
export function DotGrid({
  className = '',
  gap = 26,
  dotSize = 2,
  proximity = 120,
  push = 140,
}: {
  className?: string
  gap?: number
  dotSize?: number
  proximity?: number
  push?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dots: Dot[] = []
    let raf = 0
    let w = 0
    let h = 0
    const pointer = { x: -9999, y: -9999, active: false }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      dots = []
      const cols = Math.floor(w / gap)
      const rows = Math.floor(h / gap)
      const offX = (w - (cols - 1) * gap) / 2
      const offY = (h - (rows - 1) * gap) / 2
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offX + c * gap
          const y = offY + r * gap
          dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0 })
        }
      }
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h)
      for (const d of dots) {
        ctx!.beginPath()
        ctx!.arc(d.ox, d.oy, dotSize, 0, Math.PI * 2)
        ctx!.fillStyle = 'rgba(255,255,255,0.16)'
        ctx!.fill()
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h)
      for (const d of dots) {
        const dx = d.x - pointer.x
        const dy = d.y - pointer.y
        const dist = Math.hypot(dx, dy)

        if (pointer.active && dist < proximity) {
          const force = (1 - dist / proximity) * push
          const ang = Math.atan2(dy, dx)
          d.vx += Math.cos(ang) * force * 0.02
          d.vy += Math.sin(ang) * force * 0.02
        }

        // spring back to origin
        d.vx += (d.ox - d.x) * 0.08
        d.vy += (d.oy - d.y) * 0.08
        d.vx *= 0.82
        d.vy *= 0.82
        d.x += d.vx
        d.y += d.vy

        const near = pointer.active ? Math.max(0, 1 - dist / proximity) : 0
        const size = dotSize + near * 1.8
        ctx!.beginPath()
        ctx!.arc(d.x, d.y, size, 0, Math.PI * 2)
        if (near > 0.02) {
          ctx!.fillStyle = `rgba(220,248,124,${0.18 + near * 0.7})`
        } else {
          ctx!.fillStyle = 'rgba(255,255,255,0.14)'
        }
        ctx!.fill()
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
  }, [reduce, gap, dotSize, proximity, push])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
