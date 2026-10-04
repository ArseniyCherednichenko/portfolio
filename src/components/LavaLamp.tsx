import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A lava lamp — a self-contained object you look *at*, which is what sets it
// apart from the MetaBalls field beside it in the Playground. MetaBalls is a
// full-bleed gooey surface that chases the cursor and fuses blobs with a hard
// SVG threshold; this is a single lamp in a glass vessel, lit from below, whose
// wax rises and sinks on its own. Both are blobs, but one is a field you push
// around and the other is a thing sitting on a shelf, warming up.
//
// The look is backlit molten glow, not a crisp metaball silhouette: every blob
// is a warm radial gradient drawn in the 'lighter' (additive) blend over a dark
// vessel, so where two blobs overlap their light sums and they read as one
// glowing mass that necks and parts as they drift. That is a deliberate choice
// over a blur-plus-contrast hard threshold — wax in a real lamp is translucent
// and backlit, its edges soft, so additive glow is the more honest picture and
// it stays cheap enough to run every frame without a per-pixel field.
//
// The motion is a small, honest buoyancy loop rather than a scripted drift.
// Each blob carries a temperature that eases toward a target set by its height:
// hot at the base where the bulb sits, cool at the neck. Warm wax is less dense
// and floats up; cool wax sinks. So a blob heats at the bottom, rises, loses
// heat near the top, and falls back — the lamp's whole cycle falls out of that
// one rule, never a keyframed path. The honest simplification, noted plainly:
// blobs do not conserve volume by truly merging and pinching off (that needs a
// fluid solve); they pass through one another and the additive glow does the
// merging by eye. The physics writes straight to the blob array off the React
// render path; one canvas, one rAF loop off the frame delta, DPR capped at 2.
//
// Reduced motion: no loop and no heat cycle. The lamp paints a single composed
// still — the same wax, placed at a spread of rested heights and lit the same
// way — so the look survives and nothing moves.

export type LavaLampProps = {
  className?: string
  style?: React.CSSProperties
  /** 0..1 — how hard the base element drives the wax. More heat means the wax
   * runs taller and faster. The demo wires this to an accessible slider. */
  heat?: number
  /** Number of wax blobs in the vessel. */
  count?: number
  /** Wax colour. Any CSS colour; a warm lava amber by default. */
  wax?: string
  /** Backlight tint behind the wax, low in the vessel. */
  glow?: string
}

type Blob = {
  x: number // fraction of vessel width, 0..1
  y: number // fraction of vessel height, 0 = floor, 1 = ceiling
  r: number // radius, fraction of the smaller vessel side
  vy: number // vertical velocity, fraction/second (+ up)
  vx: number // small horizontal drift, fraction/second
  temp: number // 0..1, relaxes toward a height-set target
  sway: number // phase for a gentle horizontal wobble
}

// A small deterministic PRNG (mulberry32) so a given blob index always starts
// the same way — the repo's no-Math.random convention for reproducible art.
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Parse a CSS hex colour to [r,g,b]; falls back to the lava amber for anything
// that is not a #rgb / #rrggbb string, so a named colour never throws.
function toRgb(color: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return fallback
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const n = parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function LavaLamp({
  className,
  style,
  heat = 0.6,
  count = 7,
  wax = '#ff7a2f',
  glow = '#ff5e3a',
}: LavaLampProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduce = useReducedMotion()
  // Live heat without restarting the loop — the demo can slide it freely.
  const heatRef = useRef(heat)
  heatRef.current = heat

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const waxRgb = toRgb(wax, [255, 122, 47])
    const glowRgb = toRgb(glow, [255, 94, 58])
    const n = Math.max(3, Math.min(14, Math.round(count)))

    // Seed the wax. Blobs start spread through the lower half so the lamp looks
    // already warmed up on first paint rather than empty.
    const rnd = seeded(0x1a7a1a7a)
    const blobs: Blob[] = Array.from({ length: n }, (): Blob => {
      const r = 0.1 + rnd() * 0.11
      return {
        x: 0.22 + rnd() * 0.56,
        y: reduce ? rnd() * 0.9 + 0.03 : rnd() * 0.45,
        r,
        vy: 0,
        vx: 0,
        temp: reduce ? rnd() : 0.2 + rnd() * 0.3,
        sway: rnd() * Math.PI * 2,
      }
    })

    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    resize()

    // Vessel geometry, in CSS pixels. A tapered bottle: wider floor, narrower
    // neck, generous rounding, with a metal cap above and a base below. The wax
    // lives inside `inner`.
    const geometry = () => {
      const capH = Math.min(46, height * 0.11)
      const baseH = Math.min(58, height * 0.14)
      const glassTop = capH
      const glassBottom = height - baseH
      const glassH = glassBottom - glassTop
      const floorW = Math.min(width * 0.92, glassH * 0.62)
      const neckW = floorW * 0.46
      const cx = width / 2
      return { capH, baseH, glassTop, glassBottom, glassH, floorW, neckW, cx }
    }

    // The interior half-width at a given height fraction (0 floor → 1 ceiling):
    // the taper, eased so the shoulder is a soft curve, not a straight cone.
    const halfWidthAt = (yFrac: number, floorW: number, neckW: number) => {
      const t = Math.min(1, Math.max(0, yFrac))
      const eased = t * t * (3 - 2 * t) // smoothstep
      return (floorW - (floorW - neckW) * eased) / 2
    }

    const clear = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
    }

    // Draw the glass vessel body as a rounded, tapered silhouette path, used
    // both to paint the glass and to clip the wax to the interior.
    const vesselPath = (g: ReturnType<typeof geometry>, inset: number) => {
      const { glassTop, glassBottom, floorW, neckW, cx } = g
      const fw = floorW - inset * 2
      const nw = neckW - inset * 2
      const top = glassTop + inset
      const bottom = glassBottom - inset
      const h = bottom - top
      const p = new Path2D()
      // Walk the outline as a series of points mirrored across the centre line,
      // sampling the taper so the shoulder curves.
      const steps = 24
      const left: [number, number][] = []
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const yFrac = 1 - t // top of array = ceiling
        const half = ((fw - (fw - nw) * (yFrac * yFrac * (3 - 2 * yFrac))) / 2)
        const y = top + t * h
        left.push([cx - half, y])
      }
      p.moveTo(left[0][0], left[0][1])
      for (let i = 1; i < left.length; i++) p.lineTo(left[i][0], left[i][1])
      for (let i = left.length - 1; i >= 0; i--) p.lineTo(2 * cx - left[i][0], left[i][1])
      p.closePath()
      return p
    }

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w / 2, h / 2)
      const p = new Path2D()
      p.moveTo(x + rr, y)
      p.arcTo(x + w, y, x + w, y + h, rr)
      p.arcTo(x + w, y + h, x, y + h, rr)
      p.arcTo(x, y + h, x, y, rr)
      p.arcTo(x, y, x + w, y, rr)
      p.closePath()
      return p
    }

    const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

    const paint = () => {
      clear()
      const g = geometry()
      const { capH, baseH, glassTop, glassBottom, glassH, floorW, neckW, cx } = g

      // --- Glass body: a cool dark interior with a backlight pooling low. ---
      const glass = vesselPath(g, 0)
      ctx.save()
      const bg = ctx.createLinearGradient(0, glassTop, 0, glassBottom)
      bg.addColorStop(0, 'rgba(14,16,22,0.96)')
      bg.addColorStop(1, 'rgba(26,18,16,0.98)')
      ctx.fillStyle = bg
      ctx.fill(glass)
      // Backlight glow from the heating element at the floor.
      ctx.clip(glass)
      const light = ctx.createRadialGradient(cx, glassBottom, 4, cx, glassBottom, glassH * 0.95)
      light.addColorStop(0, rgba(glowRgb, 0.55))
      light.addColorStop(0.4, rgba(glowRgb, 0.16))
      light.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = light
      ctx.fillRect(0, glassTop, width, glassH)

      // --- Wax: additive radial blobs, clipped to the glass interior. ---
      ctx.globalCompositeOperation = 'lighter'
      const minSide = Math.min(floorW, glassH)
      for (const b of blobs) {
        const px = cx + (b.x - 0.5) * (halfWidthAt(b.y, floorW, neckW) * 2)
        const py = glassBottom - b.y * glassH
        const rad = b.r * minSide
        // Hotter wax glows brighter and whiter at its core.
        const heatGlow = 0.45 + b.temp * 0.4
        const grad = ctx.createRadialGradient(px, py - rad * 0.2, 1, px, py, rad)
        grad.addColorStop(0, rgba(waxRgb, heatGlow))
        grad.addColorStop(0.55, rgba(waxRgb, heatGlow * 0.5))
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px, py, rad, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.restore()

      // --- Glass rim highlight: a thin bright edge down one side. ---
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 1.5
      ctx.stroke(vesselPath(g, 1))
      // A soft vertical specular streak near the left wall.
      ctx.clip(glass)
      const streak = ctx.createLinearGradient(cx - floorW * 0.34, 0, cx - floorW * 0.18, 0)
      streak.addColorStop(0, 'rgba(255,255,255,0)')
      streak.addColorStop(0.5, 'rgba(255,255,255,0.07)')
      streak.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = streak
      ctx.fillRect(0, glassTop, width, glassH)
      ctx.restore()

      // --- Metal cap and base: brushed dark metal with a lit top edge. ---
      const metal = (y: number, h: number, w: number) => {
        const x = cx - w / 2
        const path = roundRect(x, y, w, h, Math.min(10, h / 2))
        const grad = ctx.createLinearGradient(x, y, x, y + h)
        grad.addColorStop(0, 'rgba(70,72,80,0.95)')
        grad.addColorStop(0.5, 'rgba(34,36,42,0.98)')
        grad.addColorStop(1, 'rgba(18,19,24,1)')
        ctx.fillStyle = grad
        ctx.fill(path)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 1
        ctx.stroke(path)
      }
      metal(glassTop - capH + 2, capH, neckW * 0.92)
      metal(glassBottom - 2, baseH, floorW * 1.06)
      // A warm sliver where the base element shows through the glass floor.
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const ember = ctx.createLinearGradient(0, glassBottom - 10, 0, glassBottom + 2)
      ember.addColorStop(0, 'rgba(0,0,0,0)')
      ember.addColorStop(1, rgba(glowRgb, 0.5))
      ctx.fillStyle = ember
      ctx.fillRect(cx - floorW / 2, glassBottom - 10, floorW, 12)
      ctx.restore()
    }

    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const h = heatRef.current

      for (const b of blobs) {
        // Target temperature by height: hottest at the floor, coolest at neck.
        // Heat drives how hot the floor gets and how far up the cool reaches.
        const floorTarget = 0.5 + h * 0.5
        const target = floorTarget * (1 - b.y) - b.y * 0.15
        b.temp += (target - b.temp) * Math.min(1, dt * 1.1)
        b.temp = Math.max(0, Math.min(1, b.temp))

        // Buoyancy: warm wax (above neutral) floats, cool sinks. Scaled by heat
        // so a cold lamp barely stirs and a hot one churns.
        const neutral = 0.42
        const buoyancy = (b.temp - neutral) * (0.5 + h * 1.1)
        b.vy += buoyancy * dt
        b.vy -= b.vy * Math.min(1, dt * 0.9) // viscous drag
        b.y += b.vy * dt

        // Gentle horizontal wobble, bounded by the taper so wax never clips the
        // glass wall.
        b.sway += dt * (0.3 + h * 0.4)
        b.x += Math.sin(b.sway) * dt * 0.04
        b.x = Math.max(0.12, Math.min(0.88, b.x))

        // Soft floor and ceiling: ease back in and shed velocity so wax pools
        // and spreads at the ends instead of bouncing like a ball.
        if (b.y < 0.02) {
          b.y = 0.02
          b.vy = Math.abs(b.vy) * 0.2
        } else if (b.y > 0.98) {
          b.y = 0.98
          b.vy = -Math.abs(b.vy) * 0.2
        }
      }

      paint()
      raf = requestAnimationFrame(step)
    }

    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) paint()
    })
    ro.observe(canvas)

    if (reduce) {
      paint()
    } else {
      last = performance.now()
      raf = requestAnimationFrame(step)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reduce, count, wax, glow])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  )
}
