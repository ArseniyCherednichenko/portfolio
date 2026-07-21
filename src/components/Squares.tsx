import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A slow, structural grid field: a lattice of square cells drawn on a single
// canvas. A soft diagonal "scan" of light drifts across the lattice forever,
// and the cell under the pointer — plus its immediate neighbours — warm toward
// lime and lift their stroke, so the grid reads as a live surface rather than a
// static ruling. Pure canvas with one RAF loop (DPR-aware, ResizeObserver-
// driven). Under reduced motion it draws a single calm frame with no loop and
// no scan, just the quiet lattice.
export function Squares({
  className = '',
  size = 44,
  accent = '220,248,124',
}: {
  className?: string
  /** Cell edge length in px. */
  size?: number
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
    let cols = 0
    let rows = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Pointer tracked in cell coordinates so proximity is grid-relative.
    const pointer = { cx: -99, cy: -99, active: false }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      cols = Math.ceil(w / size) + 1
      rows = Math.ceil(h / size) + 1
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Draw the whole lattice. `scan` is the moving band's position along the
    // diagonal (0..1 wrapping); pass scan < 0 for the static reduced-motion frame.
    function render(scan: number) {
      ctx!.clearRect(0, 0, w, h)
      const maxDiag = cols + rows

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * size
          const y = r * size

          // Diagonal scan: how close this cell is to the travelling band.
          let band = 0
          if (scan >= 0) {
            const along = (c + r) / maxDiag // 0..1 across the diagonal
            let d = Math.abs(along - scan)
            d = Math.min(d, 1 - d) // wrap so the band is seamless
            band = Math.max(0, 1 - d * 9)
          }

          // Pointer proximity in cell space, soft radial falloff.
          let near = 0
          if (pointer.active) {
            const dc = c - pointer.cx
            const dr = r - pointer.cy
            near = Math.exp(-(dc * dc + dr * dr) / 3.2)
          }

          const lit = Math.min(1, band * 0.55 + near)

          // Fill the hottest cells so the pointer leaves a warm bloom.
          if (near > 0.06) {
            ctx!.fillStyle = `rgba(${accent},${near * 0.14})`
            ctx!.fillRect(x, y, size, size)
          }

          ctx!.strokeStyle =
            lit > 0.04
              ? `rgba(${accent},${0.08 + lit * 0.6})`
              : 'rgba(255,255,255,0.05)'
          ctx!.lineWidth = 1 + lit * 0.8
          ctx!.strokeRect(x + 0.5, y + 0.5, size, size)
        }
      }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.cx = (e.clientX - rect.left) / size
      pointer.cy = (e.clientY - rect.top) / size
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
      pointer.cx = -99
      pointer.cy = -99
    }

    resize()

    if (reduce) {
      render(-1)
      const ro = new ResizeObserver(() => {
        resize()
        render(-1)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const start = performance.now()
    function frame(now: number) {
      // ~11s for the scan to cross the whole field once.
      const scan = (((now - start) / 11000) % 1 + 1) % 1
      render(scan)
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
  }, [reduce, size, accent])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
