import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// An ordered-dither light field — the demoscene's other classic, and the
// deliberate opposite of the Plasma beside it. Where Plasma computes a smooth
// field and upscales it *soft* into continuous light, this computes the same
// kind of slow travelling field and renders it the way a 1-bit display or a
// risograph would: quantised to a handful of tones and ordered-dithered through
// a Bayer threshold matrix, then upscaled with smoothing OFF so every cell stays
// a crisp block. The result is light built out of a grid of dots — a moving
// gradient you can see the arithmetic of — kin to the site's digital-display
// family (DotMatrix, FlipDot, Nixie, Vfd) rather than to a shader.
//
// The trick that makes ordered dithering read as more tones than it has: for a
// field value that lands between two palette levels, each pixel picks the higher
// level only if its fixed Bayer threshold (a value in [0,1) that tiles across the
// screen in an 8x8 cell) is below the fractional part. So a region halfway
// between two tones becomes a 50/50 checker of them, and the eye integrates it
// back into the in-between tone — depth from a handful of values and a
// disciplined grid, which is the whole aesthetic.
//
// Cheap like the Plasma: it computes on a coarse offscreen buffer (one pixel per
// SCALE screen pixels), builds a small palette LUT once, and the inner loop is a
// couple of sines plus one table index. One RAF loop, ResizeObserver-driven,
// DPR irrelevant because the buffer is deliberately coarse and nearest-neighbour
// upscaled. The pointer lifts the field locally so a bright bloom of denser dots
// follows the cursor.
//
// Under reduced motion there is no loop and no pointer: the field is painted once
// at t = 0 and only re-drawn on resize.

// Bayer 8x8 ordered-dither matrix (values 0..63). Normalised to [0,1) at use.
// The classic recursive construction — each pass quadruples the matrix — giving
// the least-clustered threshold pattern, which is why ordered dithering looks
// like a fine even stipple rather than blotches.
const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]

export function Dither({
  className = '',
  speed = 1,
  scale = 4,
  levels = 5,
  accent = '220,248,124',
  interactive = true,
}: {
  className?: string
  /** Time multiplier for the drifting field. */
  speed?: number
  /** Screen pixels per computed buffer pixel — bigger is coarser, chunkier dots. */
  scale?: number
  /** How many palette tones the field is quantised to before dithering. */
  levels?: number
  /** Highlight colour as an "r,g,b" string. */
  accent?: string
  /** Let the pointer lift a bloom of denser dots where it passes. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10) || 0)
    const steps = Math.max(2, Math.round(levels))

    // Colour ramp: ink -> deep olive -> lime -> near-white specular. Same
    // single-accent language as the Plasma so the two read as a pair, never as
    // rainbow. Quantised down to `steps` tones so the dither has few levels to
    // weave between — the banding is the point.
    const STOPS: [number, number, number, number][] = [
      [0.0, 8, 8, 11],
      [0.4, 22, 36, 26],
      [0.66, Math.round(ar * 0.5), Math.round(ag * 0.62), Math.round(ab * 0.4)],
      [0.85, ar, ag, ab],
      [1.0, 245, 255, 214],
    ]
    const sample = (v: number): [number, number, number] => {
      let s = 0
      while (s < STOPS.length - 1 && v > STOPS[s + 1][0]) s++
      const [t0, r0, g0, b0] = STOPS[s]
      const [t1, r1, g1, b1] = STOPS[Math.min(s + 1, STOPS.length - 1)]
      const f = t1 === t0 ? 0 : (v - t0) / (t1 - t0)
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f]
    }
    // Palette LUT: `steps` evenly spaced tones along the ramp.
    const PAL = new Uint8ClampedArray(steps * 3)
    for (let i = 0; i < steps; i++) {
      const [r, g, b] = sample(i / (steps - 1))
      PAL[i * 3] = r
      PAL[i * 3 + 1] = g
      PAL[i * 3 + 2] = b
    }

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
      // Nearest-neighbour upscale — the dither cells must stay crisp blocks,
      // the exact opposite of the Plasma's soft bilinear upscale.
      ctx!.imageSmoothingEnabled = false
    }

    function render(t: number) {
      if (!img) return
      const data = img.data
      // A slow bloom centre that drifts, so the bright band wanders the panel
      // rather than pulsing in place.
      const bx = bw * (0.5 + 0.3 * Math.sin(t * 0.23))
      const by = bh * (0.5 + 0.26 * Math.cos(t * 0.19))
      const px = pointer.active ? (pointer.x / w) * bw : -9999
      const py = pointer.active ? (pointer.y / h) * bh : -9999
      const maxEdge = Math.max(bw, bh) || 1
      let i = 0
      for (let y = 0; y < bh; y++) {
        const row = (y & 7) * 8
        for (let x = 0; x < bw; x++) {
          // Travelling diagonal bands + a breathing radial bloom -> one scalar.
          let s =
            0.5 +
            0.42 * Math.sin(x * 0.09 - y * 0.05 + t * 0.5) +
            0.33 * Math.sin(Math.hypot(x - bx, y - by) * 0.055 - t * 0.7)
          if (pointer.active) {
            const dx = x - px
            const dy = y - py
            s += 0.9 * Math.exp(-(dx * dx + dy * dy) / (maxEdge * 2.2))
          }
          // Clamp, then gamma toward dark so the panel stays mostly ink with
          // lime only at the crests — legible under centred copy.
          let v = s < 0 ? 0 : s > 1 ? 1 : s
          v = v * v
          // Ordered dither: choose between the two nearest palette tones by the
          // pixel's fixed Bayer threshold.
          const scaled = v * (steps - 1)
          let low = scaled | 0
          if (low > steps - 1) low = steps - 1
          const frac = scaled - low
          const thr = BAYER8[row + (x & 7)] / 64
          let lvl = frac > thr ? low + 1 : low
          if (lvl > steps - 1) lvl = steps - 1
          const idx = lvl * 3
          data[i] = PAL[idx]
          data[i + 1] = PAL[idx + 1]
          data[i + 2] = PAL[idx + 2]
          data[i + 3] = 255
          i += 4
        }
      }
      bctx!.putImageData(img, 0, 0)
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
  }, [reduce, speed, scale, levels, accent, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
