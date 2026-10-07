import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A generative skyline under a sky that follows the local hour in Berlin.
//
// This is the quiet, human counterpart to the site's warp fields and physics
// toys: not a system you poke at, but a place that simply *is* — a hand-drawn
// city at whatever time it happens to be there. The whole scene is keyed off a
// single `hour` prop (0..23.999, fractional for smoothness). The sky colour,
// the star brightness, the lit windows, and the position of the sun or moon all
// read from that one number, so at three in the afternoon the city is bright and
// empty and at two in the morning it is dark with a scatter of late windows and
// a high moon. It is an illustration that tracks the hour, not an astronomical
// instrument — the prose on the page says as much — so nothing here claims a
// precision it does not have.
//
// Everything is deterministic: a seeded mulberry32 lays down the skyline, the
// window grid, and the star field once, so the city is the same every mount and
// never trips the "no Math.random on the hot path" convention the other canvas
// pieces hold to. One RAF loop, DPR-clamped, ResizeObserver-driven, no React
// state on the hot path, `aria-hidden` (it is atmosphere, described in the page
// copy beside it). Under prefers-reduced-motion the loop never starts: the scene
// is painted once at the current hour and left still, re-painted on resize.

function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type RGB = [number, number, number]

// Sky anchors keyed to the hour, interpolated circularly so the gradient drifts
// continuously through the day rather than snapping between four states. Each is
// a top-of-sky and horizon colour; the city glow at the horizon is added on top.
const SKY: { h: number; top: RGB; bottom: RGB }[] = [
  { h: 2, top: [10, 12, 24], bottom: [26, 24, 44] }, // deep night
  { h: 6, top: [38, 36, 66], bottom: [120, 86, 92] }, // dawn
  { h: 9, top: [86, 120, 170], bottom: [196, 182, 168] }, // morning
  { h: 14, top: [96, 140, 196], bottom: [206, 214, 222] }, // day
  { h: 18, top: [70, 96, 150], bottom: [224, 166, 118] }, // golden
  { h: 20.5, top: [44, 46, 92], bottom: [168, 92, 96] }, // dusk
  { h: 23, top: [12, 14, 30], bottom: [34, 30, 52] }, // night
]

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}
function rgb([r, g, b]: RGB, alpha = 1) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`
}

// The sky colour at a fractional hour, wrapping across midnight.
function skyAt(hour: number): { top: RGB; bottom: RGB } {
  const n = SKY.length
  for (let i = 0; i < n; i++) {
    const a = SKY[i]
    const b = SKY[(i + 1) % n]
    let span = b.h - a.h
    if (span <= 0) span += 24
    let d = hour - a.h
    if (d < 0) d += 24
    if (d <= span) {
      const t = span === 0 ? 0 : d / span
      return { top: mix(a.top, b.top, t), bottom: mix(a.bottom, b.bottom, t) }
    }
  }
  return { top: SKY[0].top, bottom: SKY[0].bottom }
}

// How "night" it is, 0 (full day) → 1 (deep night). Drives stars and the share
// of lit windows. Smooth ramps around dawn (~5–8) and dusk (~18–21).
function nightness(hour: number): number {
  if (hour >= 8 && hour <= 17) return 0
  if (hour > 17 && hour < 21) return (hour - 17) / 4 // 0 → 1 across dusk
  if (hour >= 21 || hour < 5) return 1
  // 5..8 dawn
  return 1 - (hour - 5) / 3
}

export function SkylineScene({
  className = '',
  hour = 21,
  accent = '220,248,124',
}: {
  className?: string
  /** Local hour, 0..23.999 (fractional for a smooth celestial arc). */
  hour?: number
  /** Window / highlight colour as an "r,g,b" string. */
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  // The live hour is read through a ref so the heavy setup effect runs once and
  // never tears down on each per-second tick from the page.
  const hourRef = useRef(hour)
  hourRef.current = hour

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas!.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const [ar, ag, ab] = accent.split(',').map(Number)

    // Seeded scene geometry, laid once and reused across resizes (positions are
    // stored in 0..1 space and scaled at draw time), so the city is stable.
    const rng = makeRng(0x8e1b03)

    // Stars: fixed unit positions in the upper sky, each with a twinkle phase.
    const STAR_COUNT = 150
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: rng(),
      y: rng() * 0.62, // keep them above the skyline band
      r: 0.4 + rng() * 1.1,
      base: 0.35 + rng() * 0.65,
      phase: rng() * Math.PI * 2,
      speed: 0.6 + rng() * 1.6,
    }))

    // Buildings: a run of silhouettes across the base, each with a window grid.
    // One taller spire with a ball near the top nods to the Fernsehturm, a real
    // Berlin landmark — a stylised nod, not a literal drawing.
    type Building = {
      x: number // left, unit
      wdt: number // width, unit
      top: number // top y, unit (smaller = taller)
      cols: number
      rows: number
      lit: number[] // per-cell deterministic 0..1 "wants to be lit" value
      spire?: boolean
    }
    const buildings: Building[] = []
    let cx = -0.02
    const spireAt = 0.2 + rng() * 0.5
    while (cx < 1.02) {
      const wdt = 0.045 + rng() * 0.07
      const isSpire = !buildings.some((b) => b.spire) && cx >= spireAt
      const top = isSpire ? 0.18 + rng() * 0.05 : 0.5 + rng() * 0.34
      const cols = Math.max(2, Math.round(wdt / 0.018))
      const rows = Math.max(3, Math.round((0.98 - top) / 0.03))
      const lit: number[] = []
      for (let i = 0; i < cols * rows; i++) lit.push(rng())
      buildings.push({ x: cx, wdt, top, cols, rows, lit, spire: isSpire })
      cx += wdt + 0.006 + rng() * 0.02
    }

    // Clouds: a few soft bands that drift slowly across the sky.
    const clouds = Array.from({ length: 5 }, () => ({
      x: rng(),
      y: 0.1 + rng() * 0.34,
      scale: 0.6 + rng() * 0.9,
      speed: 0.004 + rng() * 0.008,
    }))

    function draw(now: number) {
      const hr = hourRef.current
      const sky = skyAt(hr)
      const night = nightness(hr)
      const horizonY = h * 0.72

      // Sky gradient.
      const g = ctx!.createLinearGradient(0, 0, 0, horizonY)
      g.addColorStop(0, rgb(sky.top))
      g.addColorStop(1, rgb(sky.bottom))
      ctx!.fillStyle = g
      ctx!.fillRect(0, 0, w, horizonY)
      // Fill below horizon with the darker ground tone.
      const groundTone = mix(sky.bottom, [8, 8, 16], 0.55)
      ctx!.fillStyle = rgb(groundTone)
      ctx!.fillRect(0, horizonY, w, h - horizonY)

      // Stars — only visible at night, twinkling if motion is allowed.
      if (night > 0.02) {
        for (const s of stars) {
          const tw = reduce ? 1 : 0.6 + 0.4 * Math.sin(now * 0.001 * s.speed + s.phase)
          const a = s.base * night * tw
          if (a <= 0.02) continue
          ctx!.beginPath()
          ctx!.arc(s.x * w, s.y * horizonY, s.r * dpr * 0.5 + s.r * 0.5, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(234,238,250,${a})`
          ctx!.fill()
        }
      }

      // Sun or moon: travels a shallow arc across the sky. Daytime ~6→20 draws a
      // sun; the rest of the clock draws a moon. Purely illustrative placement.
      const isDay = hr >= 6 && hr < 20
      const frac = isDay ? (hr - 6) / 14 : ((hr < 6 ? hr + 24 : hr) - 20) / 10
      const bx = frac * w
      const by = horizonY - Math.sin(Math.max(0, Math.min(1, frac)) * Math.PI) * horizonY * 0.72
      if (isDay) {
        const glow = ctx!.createRadialGradient(bx, by, 0, bx, by, 90 * dpr)
        glow.addColorStop(0, 'rgba(255,240,200,0.9)')
        glow.addColorStop(0.4, 'rgba(255,224,160,0.4)')
        glow.addColorStop(1, 'rgba(255,224,160,0)')
        ctx!.fillStyle = glow
        ctx!.beginPath()
        ctx!.arc(bx, by, 90 * dpr, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(bx, by, 18 * dpr, 0, Math.PI * 2)
        ctx!.fillStyle = 'rgba(255,248,224,0.98)'
        ctx!.fill()
      } else {
        const glow = ctx!.createRadialGradient(bx, by, 0, bx, by, 60 * dpr)
        glow.addColorStop(0, `rgba(226,232,248,${0.35 * night})`)
        glow.addColorStop(1, 'rgba(226,232,248,0)')
        ctx!.fillStyle = glow
        ctx!.beginPath()
        ctx!.arc(bx, by, 60 * dpr, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(bx, by, 13 * dpr, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(236,240,250,${0.5 + 0.5 * night})`
        ctx!.fill()
        // A shadow bite to read as a gibbous moon.
        ctx!.beginPath()
        ctx!.arc(bx + 6 * dpr, by - 3 * dpr, 13 * dpr, 0, Math.PI * 2)
        ctx!.fillStyle = rgb(sky.top, 0.92)
        ctx!.fill()
      }

      // Clouds — soft, low-contrast; drift unless reduced motion.
      for (const c of clouds) {
        if (!reduce) c.x = (c.x + c.speed * 0.016) % 1.25
        const px = (c.x - 0.12) * w
        const py = c.y * horizonY
        const cw = 150 * c.scale * dpr
        const ch = 34 * c.scale * dpr
        const cg = ctx!.createRadialGradient(px, py, 0, px, py, cw)
        const cloudTone = mix(sky.bottom, [255, 255, 255], 0.35 * (1 - night))
        cg.addColorStop(0, rgb(cloudTone, 0.28 * (1 - night * 0.6)))
        cg.addColorStop(1, rgb(cloudTone, 0))
        ctx!.save()
        ctx!.translate(px, py)
        ctx!.scale(1, ch / cw)
        ctx!.fillStyle = cg
        ctx!.beginPath()
        ctx!.arc(0, 0, cw, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.restore()
      }

      // City glow sitting just above the skyline, warmer and stronger at night.
      const cityGlow = ctx!.createLinearGradient(0, horizonY - h * 0.22, 0, horizonY)
      cityGlow.addColorStop(0, 'rgba(0,0,0,0)')
      cityGlow.addColorStop(1, `rgba(${ar},${ag},${ab},${0.05 + 0.13 * night})`)
      ctx!.fillStyle = cityGlow
      ctx!.fillRect(0, horizonY - h * 0.22, w, h * 0.22)

      // Buildings and their windows.
      const litShare = 0.12 + night * 0.5 // how many windows glow
      for (const b of buildings) {
        const bx0 = b.x * w
        const bw = b.wdt * w
        const bTop = b.top * horizonY
        // Silhouette.
        ctx!.fillStyle = rgb(mix([6, 7, 14], sky.top, 0.12 * (1 - night)))
        ctx!.fillRect(bx0, bTop, bw, horizonY - bTop + 2)
        if (b.spire) {
          // Antenna mast + sphere above the shaft.
          const mx = bx0 + bw / 2
          ctx!.fillRect(mx - 1.2 * dpr, bTop - h * 0.14, 2.4 * dpr, h * 0.14)
          ctx!.beginPath()
          ctx!.arc(mx, bTop - h * 0.07, 8 * dpr, 0, Math.PI * 2)
          ctx!.fillStyle = rgb(mix([6, 7, 14], sky.top, 0.12 * (1 - night)))
          ctx!.fill()
          // Red aircraft light at the tip, always a little alive.
          const blink = reduce ? 0.8 : 0.5 + 0.5 * Math.sin(now * 0.004)
          ctx!.beginPath()
          ctx!.arc(mx, bTop - h * 0.14, 2.2 * dpr, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(255,90,80,${0.4 + 0.5 * blink})`
          ctx!.fill()
        }
        // Windows.
        const pad = Math.min(bw * 0.16, 6 * dpr)
        const gw = (bw - pad * 2) / b.cols
        const gh = (horizonY - bTop - pad * 2) / b.rows
        const cellW = gw * 0.62
        const cellH = gh * 0.52
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            const v = b.lit[r * b.cols + c]
            const on = v < litShare
            if (!on && night > 0.02) {
              // faint dark pane
              ctx!.fillStyle = 'rgba(255,255,255,0.025)'
            } else if (on) {
              // Lit — warm amber, a few in the accent, gentle deterministic flicker.
              const accentPane = v < litShare * 0.16
              const flick = reduce ? 1 : 0.85 + 0.15 * Math.sin(now * 0.002 + v * 40)
              ctx!.fillStyle = accentPane
                ? `rgba(${ar},${ag},${ab},${(0.5 + 0.4 * night) * flick})`
                : `rgba(255,208,130,${(0.45 + 0.45 * night) * flick})`
            } else {
              continue
            }
            const wx = bx0 + pad + c * gw + (gw - cellW) / 2
            const wy = bTop + pad + r * gh + (gh - cellH) / 2
            ctx!.fillRect(wx, wy, cellW, cellH)
          }
        }
      }

      if (!reduce) raf = requestAnimationFrame(draw)
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width * dpr))
      h = Math.max(1, Math.floor(rect.height * dpr))
      canvas!.width = w
      canvas!.height = h
      if (reduce) draw(0) // repaint the single still frame at the new size
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    if (!reduce) raf = requestAnimationFrame(draw)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
