import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Live ASCII art of a word. The text is rendered once into a tiny offscreen
// buffer at grid resolution, so every cell already knows how much of a letter
// it covers; the visible canvas then paints one monospace glyph per cell,
// picking a denser character (and warming toward lime) the brighter the cell.
// A slow travelling shimmer keeps the field breathing at rest, and the cursor
// is a torch: cells near the pointer brighten, so a background haze of faint
// dots resolves into lit type as the pointer sweeps across the word. One
// canvas, no per-cell React state. Reduced motion paints a single still frame.
export function ASCIIText({
  text,
  className = '',
  // pixel size of one ASCII cell on screen; smaller = finer, denser letters
  cell = 11,
  // dark -> light coverage ramp. First char is "empty", last is "solid".
  ramp = ' .:-=+*#%@',
  // where the cursor is read from: the canvas itself, or the whole window
  listen = 'canvas',
}: {
  text: string
  className?: string
  cell?: number
  ramp?: string
  listen?: 'canvas' | 'window'
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // offscreen buffer sampled at exactly one pixel per ASCII cell
    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d', { willReadFrequently: true })
    if (!bctx) return

    const LIME: [number, number, number] = [220, 248, 124]
    const DIM: [number, number, number] = [92, 96, 104]

    const cw = cell * 0.62 // monospace cell advance
    const ch = cell * 1.02 // cell line height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let cols = 0
    let rows = 0
    let w = 0
    let h = 0
    // base coverage per cell, 0..1, from the rendered word
    let cover = new Float32Array(0)
    let raf = 0
    let start = 0

    // pointer in cell space; off-canvas until it moves
    let px = -1e4
    let py = -1e4

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      if (w === 0 || h === 0) return
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.font = `${cell}px ui-monospace, "SF Mono", Menlo, monospace`
      ctx!.textBaseline = 'top'

      cols = Math.max(1, Math.floor(w / cw))
      rows = Math.max(1, Math.floor(h / ch))

      // render the word into the grid-resolution buffer, fitted to the width
      buf.width = cols
      buf.height = rows
      bctx!.clearRect(0, 0, cols, rows)
      bctx!.fillStyle = '#fff'
      bctx!.textAlign = 'center'
      bctx!.textBaseline = 'middle'
      // find the largest font that keeps the word inside the buffer width
      let fs = rows
      bctx!.font = `900 ${fs}px Inter, system-ui, sans-serif`
      const margin = cols * 0.04
      const target = cols - margin * 2
      const measure = () => bctx!.measureText(text).width
      let guard = 0
      while (measure() > target && fs > 2 && guard++ < 400) {
        fs -= 1
        bctx!.font = `900 ${fs}px Inter, system-ui, sans-serif`
      }
      // and keep it within the height
      while (fs > rows * 0.92 && fs > 2) {
        fs -= 1
      }
      bctx!.font = `900 ${fs}px Inter, system-ui, sans-serif`
      bctx!.fillText(text, cols / 2, rows / 2)

      const data = bctx!.getImageData(0, 0, cols, rows).data
      cover = new Float32Array(cols * rows)
      for (let i = 0; i < cols * rows; i++) {
        cover[i] = data[i * 4 + 3] / 255 // alpha coverage
      }
    }

    function paint(t: number) {
      ctx!.clearRect(0, 0, w, h)
      const time = (t - start) / 1000
      const rampLast = ramp.length - 1
      const torch = cell * 6 // torch radius in px
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c
          const base = cover[idx]
          const x = c * cw
          const y = r * ch

          // ambient breathing haze so the field is alive at rest
          const wave = 0.05 * (0.5 + 0.5 * Math.sin(c * 0.35 - r * 0.12 - time * 1.6))

          // cursor torch
          let boost = 0
          if (px > -1e3) {
            const dx = x - px
            const dy = y - py
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < torch) boost = (1 - d / torch) * 0.85
          }

          const bright = base + wave + boost
          if (bright < 0.08) continue

          const q = Math.min(1, bright)
          const char = ramp[Math.min(rampLast, Math.max(0, Math.round(q * rampLast)))]
          if (char === ' ') continue

          // letter cells and torch-lit cells warm toward lime; faint haze stays dim
          const heat = Math.min(1, base * 0.9 + boost)
          const rr = DIM[0] + (LIME[0] - DIM[0]) * heat
          const gg = DIM[1] + (LIME[1] - DIM[1]) * heat
          const bb = DIM[2] + (LIME[2] - DIM[2]) * heat
          const alpha = base > 0.1 ? 0.55 + 0.45 * q : 0.16 + 0.5 * boost
          ctx!.fillStyle = `rgba(${rr | 0},${gg | 0},${bb | 0},${alpha.toFixed(3)})`
          ctx!.fillText(char, x, y)
        }
      }
    }

    function frame(t: number) {
      if (!start) start = t
      paint(t)
      raf = requestAnimationFrame(frame)
    }

    const target = listen === 'window' ? window : canvas
    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      px = e.clientX - rect.left
      py = e.clientY - rect.top
    }
    function onLeave() {
      px = -1e4
      py = -1e4
    }

    build()

    if (reduce) {
      // one still frame: the word resolved, no shimmer or torch
      if (cover.length) paint(0)
      const ro = new ResizeObserver(() => {
        build()
        if (cover.length) paint(0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    ;(target as HTMLElement | Window).addEventListener('pointermove', onMove as EventListener)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => {
      build()
      start = 0
    })
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      ;(target as HTMLElement | Window).removeEventListener('pointermove', onMove as EventListener)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, text, cell, ramp, listen])

  return <canvas ref={ref} className={`h-full w-full ${className}`} role="img" aria-label={text} />
}
