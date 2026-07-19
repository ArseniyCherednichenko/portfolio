import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// The colour ramp the scalar field is read through: a near-black navy that
// climbs through indigo and sky to a teal-green and finally the site's lime.
// Kept on-brand on purpose so the sheen reads as *this* site's palette rather
// than a generic rainbow oil-slick.
const RAMP: [number, number, number][] = [
  [10, 15, 26], // near-black navy
  [27, 43, 107], // indigo
  [47, 123, 214], // sky
  [47, 191, 155], // teal-green
  [220, 248, 124], // lime
]

// Sample the ramp at t in [0,1] with linear interpolation between stops.
function ramp(t: number): [number, number, number] {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t
  const seg = clamped * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(seg))
  const f = seg - i
  const a = RAMP[i]
  const b = RAMP[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

// A breathing iridescent field. A handful of overlapping sine waves are summed
// into a scalar at every pixel of a small offscreen buffer, read through the
// ramp above, then scaled up smoothly to fill the surface — so the whole thing
// costs a few thousand pixels a frame, not a few million. The cursor adds a
// travelling ripple centred on the pointer, warming the field toward lime where
// it passes. Under reduced-motion it paints a single calm frame and holds it.
export function Iridescence({
  className = '',
  speed = 1,
  scale = 11,
  interactive = true,
}: {
  className?: string
  /** Multiplier on the drift speed. */
  speed?: number
  /** Display pixels per buffer cell; larger is cheaper and softer. */
  scale?: number
  /** Whether the pointer adds a travelling ripple. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Offscreen low-res buffer. The field is computed here at cell resolution
    // and blown up onto the visible canvas with smoothing left on.
    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d')
    if (!bctx) return

    let raf = 0
    let w = 0
    let h = 0
    let bw = 0
    let bh = 0
    let image: ImageData | null = null
    // Pointer in buffer space, normalised roughly to the shorter side.
    const pointer = { x: -9999, y: -9999, active: false }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas!.width = Math.round(w)
      canvas!.height = Math.round(h)
      bw = Math.max(2, Math.round(w / scale))
      bh = Math.max(2, Math.round(h / scale))
      buf.width = bw
      buf.height = bh
      image = bctx!.createImageData(bw, bh)
      ctx!.imageSmoothingEnabled = true
    }

    function render(time: number) {
      if (!image) return
      const t = time * 0.001 * speed
      const data = image.data
      const px = pointer.active ? pointer.x : -9999
      const py = pointer.active ? pointer.y : -9999
      for (let y = 0; y < bh; y++) {
        const ny = y / bh
        for (let x = 0; x < bw; x++) {
          const nx = x / bw
          // Three drifting plane waves plus a slow diagonal give a field that
          // never quite repeats.
          let v =
            Math.sin(nx * 3.4 + t * 0.6) +
            Math.sin(ny * 3.9 - t * 0.45) +
            Math.sin((nx + ny) * 2.6 + t * 0.8) +
            Math.sin((nx - ny) * 4.2 - t * 0.3)
          // Travelling ripple centred on the pointer, warming the field nearby.
          if (px > -9998) {
            const dx = nx - px
            const dy = ny - py
            const d = Math.sqrt(dx * dx + dy * dy)
            v += 1.6 * Math.cos(d * 22 - t * 3) * Math.exp(-d * 3.5)
          }
          // Map summed field (roughly [-4,4]) into [0,1], biased so lime only
          // shows at the crests.
          const tt = Math.pow((v + 4) / 8, 1.35)
          const [r, g, b] = ramp(tt)
          const idx = (y * bw + x) * 4
          data[idx] = r
          data[idx + 1] = g
          data[idx + 2] = b
          data[idx + 3] = 255
        }
      }
      bctx!.putImageData(image, 0, 0)
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(buf, 0, 0, bw, bh, 0, 0, w, h)
    }

    function frame(time: number) {
      render(time)
      raf = requestAnimationFrame(frame)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.x = (e.clientX - rect.left) / rect.width
      pointer.y = (e.clientY - rect.top) / rect.height
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
    }

    build()

    if (reduce) {
      render(6000)
      const ro = new ResizeObserver(() => {
        build()
        render(6000)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    if (interactive) {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
    }
    const ro = new ResizeObserver(() => build())
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, speed, scale, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
