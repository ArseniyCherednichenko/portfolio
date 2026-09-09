import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A real-time plasma field — the demoscene classic, in the site's palette.
// Several travelling sine surfaces (horizontal, vertical, diagonal, and a
// radial ripple from the centre) are summed into one scalar field, and that
// value is mapped through a dark-ink -> lime -> near-white ramp so the whole
// panel reads as slow, folding lime light rather than a flat gradient.
//
// It computes on a small offscreen buffer (one pixel per SCALE screen pixels)
// via ImageData, then upscales that buffer onto the visible canvas with
// smoothing on, so the maths stays cheap while the result looks soft and
// continuous. One RAF loop, ResizeObserver-driven, DPR is irrelevant because
// the buffer is deliberately coarse. The pointer injects a moving ripple
// source that warms the field toward lime where it passes.
//
// Under reduced motion there is no loop and no pointer: the field is painted
// once at t = 0 and only re-drawn on resize.
export function Plasma({
  className = '',
  speed = 1,
  scale = 5,
  accent = '220,248,124',
  interactive = true,
}: {
  className?: string
  /** Time multiplier for the folding motion. */
  speed?: number
  /** Screen pixels per computed buffer pixel — bigger is coarser and faster. */
  scale?: number
  /** Highlight colour as an "r,g,b" string. */
  accent?: string
  /** Let the pointer inject a warming ripple source. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Parse the accent once; the ramp leans toward it in the bright band.
    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10) || 0)

    // Colour ramp: ink -> muted olive -> lime -> near-white specular. Kept in
    // the site's single-accent language so the plasma never reads as rainbow.
    const STOPS: [number, number, number, number][] = [
      [0.0, 8, 8, 11],
      [0.42, 24, 40, 28],
      [0.68, Math.round(ar * 0.5), Math.round(ag * 0.62), Math.round(ab * 0.4)],
      [0.86, ar, ag, ab],
      [1.0, 245, 255, 214],
    ]

    // Precompute a 256-entry lookup so the per-pixel inner loop never
    // interpolates stops — it just indexes the table.
    const LUT = new Uint8ClampedArray(256 * 3)
    for (let i = 0; i < 256; i++) {
      const v = i / 255
      let s = 0
      while (s < STOPS.length - 1 && v > STOPS[s + 1][0]) s++
      const [t0, r0, g0, b0] = STOPS[s]
      const [t1, r1, g1, b1] = STOPS[Math.min(s + 1, STOPS.length - 1)]
      const f = t1 === t0 ? 0 : (v - t0) / (t1 - t0)
      LUT[i * 3] = r0 + (r1 - r0) * f
      LUT[i * 3 + 1] = g0 + (g1 - g0) * f
      LUT[i * 3 + 2] = b0 + (b1 - b0) * f
    }

    // Offscreen coarse buffer we compute into, then upscale onto the canvas.
    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d')
    if (!bctx) return

    let w = 0
    let h = 0
    let bw = 0
    let bh = 0
    let img: ImageData | null = null
    let raf = 0
    const pointer = { x: -9999, y: -9999, active: false }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas!.width = w
      canvas!.height = h
      bw = Math.max(1, Math.ceil(w / scale))
      bh = Math.max(1, Math.ceil(h / scale))
      buf.width = bw
      buf.height = bh
      img = bctx!.createImageData(bw, bh)
      ctx!.imageSmoothingEnabled = true
    }

    function render(t: number) {
      if (!img) return
      const data = img.data
      const cx = bw / 2
      const cy = bh / 2
      // Pointer mapped into buffer space (or off-field when inactive).
      const px = pointer.active ? (pointer.x / w) * bw : -9999
      const py = pointer.active ? (pointer.y / h) * bh : -9999
      let i = 0
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          // Sum of travelling surfaces -> one scalar field.
          let s =
            Math.sin(x * 0.14 + t) +
            Math.sin(y * 0.12 - t * 0.9) +
            Math.sin((x + y) * 0.08 + t * 0.7) +
            Math.sin(Math.hypot(x - cx, y - cy) * 0.13 - t * 1.05)
          let terms = 4
          if (pointer.active) {
            const d = Math.hypot(x - px, y - py)
            // A ripple source that also lifts the field near the cursor, so the
            // passing pointer both distorts and brightens the plasma.
            s += 1.6 * Math.sin(d * 0.22 - t * 2.2) + Math.exp(-(d * d) / 260)
            terms += 1.6
          }
          // Normalise the summed sines (range ~[-terms, terms]) into [0,1].
          const v = 0.5 + s / (terms * 2)
          const idx = (v < 0 ? 0 : v > 1 ? 255 : (v * 255) | 0) * 3
          data[i] = LUT[idx]
          data[i + 1] = LUT[idx + 1]
          data[i + 2] = LUT[idx + 2]
          data[i + 3] = 255
          i += 4
        }
      }
      bctx!.putImageData(img, 0, 0)
      // Upscale the coarse buffer onto the visible canvas; smoothing softens
      // the block edges into a continuous field.
      ctx!.drawImage(buf, 0, 0, bw, bh, 0, 0, w, h)
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
      render(((now - start) / 1000) * speed)
      raf = requestAnimationFrame(frame)
    }
    if (interactive) {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, speed, scale, accent, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
