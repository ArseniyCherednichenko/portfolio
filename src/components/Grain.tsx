import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Grain — a film-grain / noise texture overlay.
//
// A small square of random grayscale bytes is scribbled into an offscreen tile
// a few times per second and painted across the surface as a repeating canvas
// pattern, so a full-viewport grain costs one tiny buffer of noise per refresh
// (not a per-pixel repaint of the whole screen every frame). The visible canvas
// sits under content via `mix-blend-mode` at a low opacity, so mid-gray noise
// reads as neutral, brighter specks lift and darker ones sink — the classic
// filmic texture rather than a flat wash. Honest brand texture: `pointer-events:
// none`, `aria-hidden`, and it never intercepts input.
//
// Two modes. `fixed` lays it over the whole viewport (the site-wide editorial
// grain, mounted once in Layout — it lends the dark theme a printed feel). The
// default `absolute` fills its positioned container (a Playground specimen, or
// any framed surface that wants texture). Under reduced motion it paints a
// single still frame and never starts the loop, so nothing flickers.

const TILE = 140 // px edge of the repeating noise tile

export function Grain({
  opacity = 0.055,
  fps = 24,
  blend = 'soft-light',
  fixed = false,
  className = '',
}: {
  /** Overall strength of the texture. Kept low site-wide; cranked in demos. */
  opacity?: number
  /** How many times a second the grain reshuffles. Lower reads choppier/filmic. */
  fps?: number
  /** CSS mix-blend-mode used to composite the grain over what is behind it. */
  blend?: string
  /** Cover the viewport (`fixed inset-0`) instead of the positioned parent. */
  fixed?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Offscreen tile we scribble noise into and repeat across the surface.
    const tile = document.createElement('canvas')
    tile.width = TILE
    tile.height = TILE
    const tctx = tile.getContext('2d')
    if (!tctx) return
    const image = tctx.createImageData(TILE, TILE)
    const buf = image.data

    const drawNoise = () => {
      if (!canvas.width || !canvas.height) return
      for (let i = 0; i < buf.length; i += 4) {
        const v = (Math.random() * 255) | 0
        buf[i] = v
        buf[i + 1] = v
        buf[i + 2] = v
        buf[i + 3] = 255
      }
      tctx.putImageData(image, 0, 0)
      const pattern = ctx.createPattern(tile, 'repeat')
      if (!pattern) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // The visible canvas is sized 1:1 in CSS pixels — grain wants to stay a
    // fine, crisp texture, and skipping DPR upscaling keeps the fill cheap.
    const resize = () => {
      const w = fixed ? window.innerWidth : canvas.clientWidth
      const h = fixed ? window.innerHeight : canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(w))
      canvas.height = Math.max(1, Math.floor(h))
      drawNoise()
    }

    let ro: ResizeObserver | null = null
    if (fixed) {
      window.addEventListener('resize', resize)
    } else {
      ro = new ResizeObserver(resize)
      ro.observe(canvas)
    }
    resize()

    let raf = 0
    if (!reduce) {
      const interval = 1000 / Math.max(1, fps)
      let last = performance.now()
      const loop = (now: number) => {
        if (now - last >= interval) {
          last = now
          drawNoise()
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ro?.disconnect()
    }
  }, [reduce, fps, fixed])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 ${className}`}
      style={{ opacity, mixBlendMode: blend as React.CSSProperties['mixBlendMode'] }}
    />
  )
}
