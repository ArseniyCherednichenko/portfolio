import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Caustics — the dancing net of light on the floor of a sunlit pool, in the
// site's single accent. Where the Plasma folds soft lime light and the Dither
// quantises it to a hard stipple, this one does the third demoscene-field
// thing: it focuses. Sunlight bent by a rippling water surface converges into
// thin, bright, branching filaments over a dark ground, and that is exactly
// what a sharpened interference field gives you.
//
// Per pixel: the coordinates are domain-warped twice (each pass displaces them
// by a sine read of the other axis, so a plain grid turns into drifting organic
// cells), then two interfering wavefronts are multiplied into one scalar. A
// plain summed field would read as soft plasma; raising it to a high power is
// what thins the bright regions into caustic lines — most of the panel falls to
// dark water and only the crests survive as a lit web. A 256-entry colour
// lookup maps that to deep water -> lime -> specular white, so the inner loop
// never interpolates stops.
//
// It computes on a deliberately coarse offscreen buffer (one pixel per `scale`
// screen pixels) and upscales with smoothing on, so the per-pixel warp stays
// cheap while the result looks continuous. DPR is irrelevant to a buffer that
// is coarse on purpose. One RAF loop, ResizeObserver-driven. The pointer drops
// a spreading ripple source that bends the light where it passes, like a finger
// touched to the surface.
//
// Under reduced motion there is no loop and no pointer: the net is painted once
// at t = 0 and only redrawn on resize.
export function Caustics({
  className = '',
  speed = 1,
  scale = 5,
  /** Spatial frequency of the light net — bigger is a finer mesh. */
  density = 1,
  /** How sharply the bright regions thin into filaments. Higher = thinner. */
  sharpness = 6,
  accent = '220,248,124',
  interactive = true,
}: {
  className?: string
  speed?: number
  scale?: number
  density?: number
  sharpness?: number
  accent?: string
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

    // Ramp: deep water ink -> cool teal shadow -> lime caustic -> specular white
    // crest. Kept in the single-accent language so the net never reads rainbow.
    const STOPS: [number, number, number, number][] = [
      [0.0, 6, 10, 14],
      [0.38, 12, 30, 34],
      [0.6, Math.round(ar * 0.44), Math.round(ag * 0.58), Math.round(ab * 0.42)],
      [0.84, ar, ag, ab],
      [1.0, 246, 255, 220],
    ]
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
      // Work in a square-ish uv so the mesh is not stretched on wide panels.
      const inv = (density * 7) / Math.max(bw, bh)
      const px = pointer.active ? (pointer.x / w) * bw : -9999
      const py = pointer.active ? (pointer.y / h) * bh : -9999
      let i = 0
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          let ux = x * inv
          let uy = y * inv
          // Two domain-warp passes: each axis is pushed by a sine of the other,
          // turning the grid into drifting, branching cells.
          const wx = ux + 0.9 * Math.sin(uy * 1.3 + t)
          const wy = uy + 0.9 * Math.cos(ux * 1.1 - t * 0.9)
          ux = wx + 0.6 * Math.sin(wy * 1.7 - t * 1.1)
          uy = wy + 0.6 * Math.cos(wx * 1.5 + t * 0.7)
          // Two interfering wavefronts multiplied into one scalar in [0,1].
          let f =
            Math.sin(ux) * Math.sin(uy) * 0.5 +
            0.5 +
            0.35 * Math.sin((ux + uy) * 0.6 + t * 0.8)
          if (pointer.active) {
            // A finger on the surface: a spreading ring that bends the net.
            const d = Math.hypot(x - px, y - py)
            f += 0.9 * Math.sin(d * 0.3 - t * 2.4) * Math.exp(-(d * d) / 900)
          }
          f = f < 0 ? 0 : f > 1 ? 1 : f
          // Sharpen: only the crests survive as bright filaments.
          const c = Math.pow(f, sharpness)
          const idx = ((c * 255) | 0) * 3
          data[i] = LUT[idx]
          data[i + 1] = LUT[idx + 1]
          data[i + 2] = LUT[idx + 2]
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
  }, [reduce, speed, scale, density, sharpness, accent, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
