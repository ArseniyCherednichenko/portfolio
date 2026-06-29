import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

type Cell = {
  char: string
  // current rgb, eased toward target each frame for a smooth color drift
  r: number
  g: number
  b: number
  tr: number
  tg: number
  tb: number
}

// A canvas of monospace glyphs that flicker and recolor in place, like a
// terminal mid-decode. Most cells sit in cool grays; a few warm to lime. The
// glitch runs on batches: every `glitchInterval` ms a slice of random cells get
// a new glyph and target color, then ease toward it. One canvas, no per-cell
// React state. Reduced-motion paints a single calm static frame instead.
export function LetterGlitch({
  className = '',
  glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>[]{}/\\=+*#%@&',
  fontSize = 16,
  // milliseconds between glitch batches
  glitchInterval = 90,
  // share of cells refreshed per batch (0..1)
  churn = 0.06,
  // share of cells that may warm toward the lime accent
  accent = 0.12,
}: {
  className?: string
  glyphs?: string
  fontSize?: number
  glitchInterval?: number
  churn?: number
  accent?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // cool grays, with the lime accent reserved for a minority of cells
    const GRAYS: ReadonlyArray<[number, number, number]> = [
      [54, 54, 58],
      [78, 80, 86],
      [110, 114, 122],
      [150, 156, 166],
    ]
    const LIME: [number, number, number] = [220, 248, 124]

    const cw = fontSize * 0.62 // monospace cell width
    const ch = fontSize * 1.18 // cell height (line)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let cells: Cell[] = []
    let cols = 0
    let rows = 0
    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let acc = 0

    const rand = (n: number) => Math.floor(Math.random() * n)
    const glyph = () => glyphs[rand(glyphs.length)]

    function pickTarget(): [number, number, number] {
      if (Math.random() < accent) return LIME
      return GRAYS[rand(GRAYS.length)]
    }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.font = `${fontSize}px ui-monospace, "SF Mono", Menlo, monospace`
      ctx!.textBaseline = 'top'
      cols = Math.max(1, Math.ceil(w / cw))
      rows = Math.max(1, Math.ceil(h / ch))
      cells = []
      for (let i = 0; i < cols * rows; i++) {
        const [r, g, b] = pickTarget()
        cells.push({ char: glyph(), r, g, b, tr: r, tg: g, tb: b })
      }
    }

    function paint() {
      ctx!.clearRect(0, 0, w, h)
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]
        const x = (i % cols) * cw
        const y = Math.floor(i / cols) * ch
        ctx!.fillStyle = `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`
        ctx!.fillText(c.char, x, y)
      }
    }

    function glitch() {
      const n = Math.max(1, Math.floor(cells.length * churn))
      for (let k = 0; k < n; k++) {
        const c = cells[rand(cells.length)]
        c.char = glyph()
        const [tr, tg, tb] = pickTarget()
        c.tr = tr
        c.tg = tg
        c.tb = tb
      }
    }

    function frame(t: number) {
      if (!last) last = t
      const dt = t - last
      last = t
      acc += dt
      while (acc >= glitchInterval) {
        glitch()
        acc -= glitchInterval
      }
      // ease each cell toward its target color
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]
        c.r += (c.tr - c.r) * 0.12
        c.g += (c.tg - c.g) * 0.12
        c.b += (c.tb - c.b) * 0.12
      }
      paint()
      raf = requestAnimationFrame(frame)
    }

    build()

    if (reduce) {
      // one calm static frame: glyphs at their target colors, no flicker
      for (const c of cells) {
        c.r = c.tr
        c.g = c.tg
        c.b = c.tb
      }
      paint()
      const ro = new ResizeObserver(() => {
        build()
        for (const c of cells) {
          c.r = c.tr
          c.g = c.tg
          c.b = c.tb
        }
        paint()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const ro = new ResizeObserver(() => {
      build()
      last = 0
      acc = 0
    })
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reduce, glyphs, fontSize, glitchInterval, churn, accent])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
