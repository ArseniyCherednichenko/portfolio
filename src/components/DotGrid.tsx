import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// An interactive canvas of dots that react to the cursor: dots near the pointer
// brighten toward the lime accent and ease away from it, then settle back. A
// hand-built, dependency-free interaction (no particle library). Under reduced
// motion it renders a calm static grid with no pointer reaction.
export function DotGrid({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const GAP = 26 // px between dots
    const BASE_R = 1.4 // resting dot radius
    const RADIUS = 120 // cursor influence radius
    const PUSH = 26 // max px a dot is pushed away

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    type Dot = { ox: number; oy: number; x: number; y: number }
    let dots: Dot[] = []
    const pointer = { x: -9999, y: -9999, active: false }
    let raf = 0

    function build() {
      const rect = canvas!.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.floor(width * dpr)
      canvas!.height = Math.floor(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      dots = []
      const cols = Math.ceil(width / GAP)
      const rows = Math.ceil(height / GAP)
      const offsetX = (width - (cols - 1) * GAP) / 2
      const offsetY = (height - (rows - 1) * GAP) / 2
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ox = offsetX + c * GAP
          const oy = offsetY + r * GAP
          dots.push({ ox, oy, x: ox, y: oy })
        }
      }
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, width, height)
      for (const d of dots) {
        ctx!.beginPath()
        ctx!.arc(d.ox, d.oy, BASE_R, 0, Math.PI * 2)
        ctx!.fillStyle = 'rgba(255,255,255,0.12)'
        ctx!.fill()
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height)
      for (const d of dots) {
        let tx = d.ox
        let ty = d.oy
        let glow = 0
        if (pointer.active) {
          const dx = d.ox - pointer.x
          const dy = d.oy - pointer.y
          const dist = Math.hypot(dx, dy)
          if (dist < RADIUS) {
            const f = 1 - dist / RADIUS // 0..1, strongest near pointer
            const ang = Math.atan2(dy, dx)
            tx = d.ox + Math.cos(ang) * PUSH * f
            ty = d.oy + Math.sin(ang) * PUSH * f
            glow = f
          }
        }
        // ease toward target so dots spring back smoothly
        d.x += (tx - d.x) * 0.15
        d.y += (ty - d.y) * 0.15

        const radius = BASE_R + glow * 1.6
        ctx!.beginPath()
        ctx!.arc(d.x, d.y, radius, 0, Math.PI * 2)
        if (glow > 0.02) {
          // blend white -> lime as the dot lights up
          const a = 0.12 + glow * 0.7
          ctx!.fillStyle = `rgba(220,248,124,${a})`
        } else {
          ctx!.fillStyle = 'rgba(255,255,255,0.12)'
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
    const ro = new ResizeObserver(() => {
      build()
      if (reduce) drawStatic()
    })
    ro.observe(canvas)

    if (reduce) {
      drawStatic()
    } else {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce])

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} aria-hidden />
}
