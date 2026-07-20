import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Text rendered to a canvas that shears into analog signal-fuzz — each
// horizontal scanline of the word is offset by a small, lively amount every
// frame, so the glyphs read like type caught on a detuned screen. Distinct
// from the site's other text motion (DecryptedText scrambles glyphs,
// LetterGlitch flickers a whole field, SplitFlap hinges, ASCIIText renders an
// ASCII field, GradientText shines): this one tears clean type sideways and
// intensifies under the pointer. The word is drawn once into an offscreen
// buffer, then blitted back row-by-row with a horizontal jitter — no per-frame
// randomness from `Math.random` (a self-contained xorshift stream keeps it
// lively yet deterministic-safe), DPR-aware, one RAF loop cleaned up on
// unmount. Honest to assistive tech via `role="img"` + the real string as
// `aria-label`. Under reduced motion it paints one crisp, still frame with no
// loop or listeners.
export function FuzzyText({
  text,
  fontSize = 120,
  // Fraunces' variable subset is weight-capped at 700; keep display weights <= 700.
  fontWeight = 700,
  color = '#ffffff',
  fontFamily = '"Fraunces", ui-serif, Georgia, serif',
  // resting shear (share of the jitter margin); hover swells it toward chaos
  baseIntensity = 0.05,
  hoverIntensity = 0.34,
  enableHover = true,
  className = '',
}: {
  text: string
  fontSize?: number
  fontWeight?: number
  color?: string
  fontFamily?: string
  baseIntensity?: number
  hoverIntensity?: number
  enableHover?: boolean
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  // bump to force a redraw once the self-hosted webfont finishes loading, so
  // canvas metrics + glyphs are measured against the real face, not a fallback.
  const [fontTick, setFontTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts
    fonts?.ready?.then(() => {
      if (!cancelled) setFontTick((t) => t + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !text) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const font = `${fontWeight} ${fontSize}px ${fontFamily}`

    // measure the clean word
    ctx.font = font
    ctx.textBaseline = 'alphabetic'
    const metrics = ctx.measureText(text)
    const asc = metrics.actualBoundingBoxAscent ?? fontSize * 0.8
    const desc = metrics.actualBoundingBoxDescent ?? fontSize * 0.2
    const textW = Math.ceil(metrics.width) + 2
    const textH = Math.ceil(asc + desc) + 2
    // horizontal room on each side for the scanlines to slide into
    const margin = Math.max(14, Math.ceil(fontSize * 0.14))
    const extW = textW + margin * 2

    // offscreen buffer: the crisp word, once
    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.floor(textW * dpr))
    off.height = Math.max(1, Math.floor(textH * dpr))
    const octx = off.getContext('2d')
    if (!octx) return
    octx.scale(dpr, dpr)
    octx.font = font
    octx.textBaseline = 'alphabetic'
    octx.fillStyle = color
    octx.fillText(text, 1, asc + 1)

    // visible canvas (device-pixel backing store, CSS-sized to the extended box)
    canvas.width = Math.floor(extW * dpr)
    canvas.height = off.height
    canvas.style.width = `${extW}px`
    canvas.style.height = `${textH}px`
    ctx.imageSmoothingEnabled = false

    const H = off.height
    const M = Math.floor(margin * dpr)

    let hovering = false
    // self-contained xorshift: lively per-frame jitter without Math.random
    let seed = 0x9e3779b9 >>> 0
    const rand = () => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) / 4294967296
    }

    const drawFrame = (intensity: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const range = intensity * margin * 2 * dpr
      for (let j = 0; j < H; j++) {
        const dx = Math.round((rand() - 0.5) * range)
        ctx.drawImage(off, 0, j, off.width, 1, M + dx, j, off.width, 1)
      }
    }

    if (reduce) {
      // one clean, still frame — no shear, no loop, no listeners
      ctx.drawImage(off, M, 0)
      return
    }

    let raf = 0
    const loop = () => {
      drawFrame(hovering ? hoverIntensity : baseIntensity)
      raf = requestAnimationFrame(loop)
    }
    loop()

    const within = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      return x >= margin && x <= margin + textW && y >= 0 && y <= textH
    }
    const onMove = (e: PointerEvent) => {
      hovering = within(e.clientX, e.clientY)
    }
    const onLeave = () => {
      hovering = false
    }
    if (enableHover) {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
    }

    return () => {
      cancelAnimationFrame(raf)
      if (enableHover) {
        canvas.removeEventListener('pointermove', onMove)
        canvas.removeEventListener('pointerleave', onLeave)
      }
    }
  }, [text, fontSize, fontWeight, color, fontFamily, baseIntensity, hoverIntensity, enableHover, reduce, fontTick])

  return <canvas ref={ref} role="img" aria-label={text} className={className} />
}
