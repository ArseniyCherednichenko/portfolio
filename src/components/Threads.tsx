import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Flowing field of horizontal "threads": each is a smooth polyline carrying a
// travelling sine wave, and where the pointer comes near, the nearest threads
// bulge away from it and warm toward lime. Pure canvas with a single RAF loop
// (DPR-aware, ResizeObserver-driven), so it stays smooth across a dense field.
// Under reduced motion it draws one calm static set of waves with no loop.
export function Threads({
  className = '',
  count = 14,
  amplitude = 12,
  accent = '220,248,124',
}: {
  className?: string
  /** Number of horizontal threads. */
  count?: number
  /** Resting wave height, in px. */
  amplitude?: number
  /** Highlight colour as an "r,g,b" string. */
  accent?: string
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
    // Per-thread phase + frequency so the field never reads as a single ribbon.
    const phases = Array.from({ length: count }, (_, i) => i * 1.7)
    const freqs = Array.from({ length: count }, (_, i) => 0.006 + (i % 4) * 0.0016)

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Draw one thread as a sampled polyline. `t` advances the travelling wave;
    // pass t = 0 for the static (reduced-motion) frame.
    function drawThread(i: number, t: number) {
      const baseY = ((i + 0.5) / count) * h
      const phase = phases[i]
      const freq = freqs[i]
      const step = Math.max(6, w / 160)
      let lit = 0 // strongest pointer proximity along this thread, for colour

      ctx!.beginPath()
      for (let x = 0; x <= w + step; x += step) {
        let y = baseY + Math.sin(x * freq + phase + t) * amplitude
        if (pointer.active) {
          const dx = x - pointer.x
          const dy = y - pointer.y
          const d2 = dx * dx + dy * dy
          const fall = Math.exp(-d2 / 9000) // ~95px radius of influence
          if (fall > lit) lit = fall
          // Push the line vertically away from the pointer for a soft bulge.
          y += Math.sign(dy || 1) * fall * 26
        }
        if (x === 0) ctx!.moveTo(x, y)
        else ctx!.lineTo(x, y)
      }
      ctx!.strokeStyle =
        lit > 0.02
          ? `rgba(${accent},${0.1 + lit * 0.75})`
          : 'rgba(255,255,255,0.07)'
      ctx!.lineWidth = 1 + lit * 1.4
      ctx!.stroke()
    }

    function render(t: number) {
      ctx!.clearRect(0, 0, w, h)
      ctx!.lineCap = 'round'
      for (let i = 0; i < count; i++) drawThread(i, t)
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

    resize()

    if (reduce) {
      render(0)
      const ro = new ResizeObserver(() => {
        resize()
        render(0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const start = performance.now()
    function frame(now: number) {
      render(((now - start) / 1000) * 1.1)
      raf = requestAnimationFrame(frame)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, count, amplitude, accent])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
