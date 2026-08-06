import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Ballpit: a bin of shaded spheres that fall, pile, and can be grabbed and
// tossed. The site already has one hand-rolled physics piece — Gravity — but
// that one is DOM pills resolved as axis-aligned boxes. This is a deliberately
// different simulation: round bodies on a canvas, resolved with real
// circle-circle collision (separation along the contact normal, an impulse
// exchanged along it with restitution), and drawn as volumetric spheres with a
// lit highlight and a cast shadow rather than flat labels. So the two read as
// distinct crafts — one is contact between rectangles, this is contact between
// circles, and it looks like a physical thing rather than a tag cloud.
//
// One <canvas>, one RAF loop, DPR-aware and ResizeObserver-driven. No React
// state on the hot path — the physics live in refs. Seeded initial scatter so
// the drop is lively but identical each mount. dt is clamped so a backgrounded
// tab can never explode the sim. Pointer grab uses capture and carries a
// smoothed throw velocity into the release. Purely decorative (aria-hidden).
// Under reduced motion the loop never starts — the balls are laid out once as a
// calm, settled arrangement and simply redrawn on resize.

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** 0 = neutral glass, 1 = lime accent. */
  accent: number
  held: boolean
}

const GRAVITY = 2400 // px/s^2
const REST = 0.55 // wall/ball bounciness
const AIR = 0.995 // per-step air drag
const MAX_DT = 1 / 30 // clamp so a tab-out never explodes the sim
const MAX_DPR = 2

export function Ballpit({
  count = 22,
  accent = '220,248,124', // lime, as "r,g,b"
  className = '',
}: {
  /** How many balls to drop into the bin. */
  count?: number
  /** Accent colour as an "r,g,b" string, matched to the host panel. */
  accent?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0
    let H = 0
    let dpr = 1
    let raf = 0
    let last = 0
    const balls: Ball[] = []

    // Seeded PRNG (mulberry32-ish) so the scatter is identical every mount and
    // never pulls per-frame entropy.
    let seed = 20260806
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    function build() {
      const base = Math.max(14, Math.min(W, H) * 0.052)
      for (let i = 0; i < count; i++) {
        const r = base * (0.72 + rand() * 0.85)
        balls.push({
          x: r + rand() * Math.max(1, W - r * 2),
          y: -r - rand() * H * 1.1 - i * 20, // staggered above the bin
          vx: (rand() - 0.5) * 160,
          vy: 0,
          r,
          // Roughly a third lime, the rest neutral glass — lime-led, not gaudy.
          accent: rand() < 0.34 ? 1 : 0,
          held: false,
        })
      }
    }

    function layoutStill() {
      // Reduced-motion / initial calm arrangement: a tidy settled pile along the
      // floor, packed left-to-right in rows, no simulation.
      const base = Math.max(14, Math.min(W, H) * 0.052)
      let cx = base
      let cy = H - base
      let rowMax = 0
      for (let i = 0; i < count; i++) {
        const r = base * (0.72 + rand() * 0.85)
        if (cx + r * 2 > W) {
          cx = base
          cy -= rowMax * 2 + 6
          rowMax = 0
        }
        balls.push({
          x: cx + r,
          y: cy - r,
          vx: 0,
          vy: 0,
          r,
          accent: rand() < 0.34 ? 1 : 0,
          held: false,
        })
        cx += r * 2 + 6
        rowMax = Math.max(rowMax, r)
      }
    }

    function measure() {
      const rect = wrap!.getBoundingClientRect()
      W = rect.width
      H = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas!.width = Math.round(W * dpr)
      canvas!.height = Math.round(H * dpr)
      canvas!.style.width = `${W}px`
      canvas!.style.height = `${H}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Keep everyone inside after a resize.
      for (const b of balls) {
        b.r = Math.min(b.r, Math.min(W, H) / 2 - 2)
        b.x = Math.min(Math.max(b.x, b.r), Math.max(b.r, W - b.r))
        b.y = Math.min(b.y, H - b.r)
      }
    }

    function clampWalls(b: Ball) {
      if (b.x - b.r < 0) {
        b.x = b.r
        b.vx = Math.abs(b.vx) * REST
      } else if (b.x + b.r > W) {
        b.x = W - b.r
        b.vx = -Math.abs(b.vx) * REST
      }
      if (b.y + b.r > H) {
        b.y = H - b.r
        if (b.vy > 0) b.vy = -b.vy * REST
        b.vx *= 0.92 // floor friction so piles settle
        if (Math.abs(b.vy) < 22) b.vy = 0
      }
      // Top stays open so balls can be lifted out and dropped back in.
    }

    // Circle-circle: separate along the contact normal by the penetration
    // (split between the pair unless one is held), then exchange an impulse
    // along that normal so they bounce apart with restitution. Mass ~ area, so
    // a big ball shoves a small one more than the reverse.
    function resolvePair(a: Ball, b: Ball) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const minD = a.r + b.r
      let d2 = dx * dx + dy * dy
      if (d2 >= minD * minD || d2 === 0) return
      let d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d
      const pen = minD - d
      const ma = a.r * a.r
      const mb = b.r * b.r
      const inv = 1 / (ma + mb)
      // positional correction, weighted by the other's mass
      if (!a.held) {
        a.x -= nx * pen * (mb * inv)
        a.y -= ny * pen * (mb * inv)
      }
      if (!b.held) {
        b.x += nx * pen * (ma * inv)
        b.y += ny * pen * (ma * inv)
      }
      // relative velocity along the normal
      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const vn = rvx * nx + rvy * ny
      if (vn > 0) return // already separating
      const j = (-(1 + REST) * vn) * (ma * mb) * inv
      const jx = j * nx
      const jy = j * ny
      if (!a.held) {
        a.vx -= jx / ma
        a.vy -= jy / ma
      }
      if (!b.held) {
        b.vx += jx / mb
        b.vy += jy / mb
      }
    }

    function step(dt: number) {
      for (const b of balls) {
        if (b.held) continue
        b.vy += GRAVITY * dt
        b.vx *= AIR
        b.vy *= AIR
        b.x += b.vx * dt
        b.y += b.vy * dt
        clampWalls(b)
      }
      // A couple of relaxation passes keep stacks from jittering apart.
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            resolvePair(balls[i], balls[j])
          }
        }
      }
      for (const b of balls) clampWalls(b)
    }

    function drawBall(b: Ball) {
      const { x, y, r } = b
      // soft cast shadow beneath
      ctx!.beginPath()
      ctx!.ellipse(x, Math.min(y + r * 0.92, H - 1), r * 0.82, r * 0.28, 0, 0, Math.PI * 2)
      ctx!.fillStyle = 'rgba(0,0,0,0.28)'
      ctx!.fill()

      // volumetric body: radial gradient lit from the upper-left
      const lx = x - r * 0.36
      const ly = y - r * 0.4
      const g = ctx!.createRadialGradient(lx, ly, r * 0.1, x, y, r)
      if (b.accent) {
        g.addColorStop(0, `rgba(${accent},1)`)
        g.addColorStop(0.55, `rgba(${accent},0.62)`)
        g.addColorStop(1, `rgba(${accent},0.14)`)
      } else {
        g.addColorStop(0, 'rgba(240,240,245,0.9)')
        g.addColorStop(0.5, 'rgba(120,124,140,0.42)')
        g.addColorStop(1, 'rgba(30,32,40,0.5)')
      }
      ctx!.beginPath()
      ctx!.arc(x, y, r, 0, Math.PI * 2)
      ctx!.fillStyle = g
      ctx!.fill()

      // rim to seat it against the dark bin
      ctx!.beginPath()
      ctx!.arc(x, y, r - 0.5, 0, Math.PI * 2)
      ctx!.strokeStyle = b.accent ? `rgba(${accent},0.5)` : 'rgba(255,255,255,0.14)'
      ctx!.lineWidth = 1
      ctx!.stroke()

      // specular highlight
      ctx!.beginPath()
      ctx!.arc(lx, ly, r * 0.22, 0, Math.PI * 2)
      ctx!.fillStyle = 'rgba(255,255,255,0.55)'
      ctx!.fill()
    }

    function paint() {
      ctx!.clearRect(0, 0, W, H)
      for (const b of balls) drawBall(b)
    }

    function frame(t: number) {
      if (!last) last = t
      const dt = Math.min((t - last) / 1000, MAX_DT)
      last = t
      if (dt > 0) step(dt)
      paint()
      raf = requestAnimationFrame(frame)
    }

    // --- pointer grab -------------------------------------------------------
    const held = new Map<number, { ball: Ball; lastX: number; lastY: number; lastT: number }>()

    function localPoint(e: PointerEvent) {
      const rect = wrap!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function pick(x: number, y: number): Ball | null {
      // Topmost (last-drawn) ball under the point wins.
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]
        const dx = x - b.x
        const dy = y - b.y
        if (dx * dx + dy * dy <= b.r * b.r) return b
      }
      return null
    }

    function onDown(e: PointerEvent) {
      const p = localPoint(e)
      const b = pick(p.x, p.y)
      if (!b) return
      e.preventDefault()
      canvas!.setPointerCapture(e.pointerId)
      b.held = true
      b.vx = 0
      b.vy = 0
      held.set(e.pointerId, { ball: b, lastX: p.x, lastY: p.y, lastT: e.timeStamp })
      canvas!.style.cursor = 'grabbing'
    }

    function onMove(e: PointerEvent) {
      const h = held.get(e.pointerId)
      if (!h) {
        // hover affordance: grab cursor over a ball
        const p = localPoint(e)
        canvas!.style.cursor = pick(p.x, p.y) ? 'grab' : 'default'
        return
      }
      const p = localPoint(e)
      const b = h.ball
      b.x = Math.min(Math.max(p.x, b.r), Math.max(b.r, W - b.r))
      b.y = Math.max(p.y, b.r)
      const dt = Math.max((e.timeStamp - h.lastT) / 1000, 1 / 240)
      b.vx = (p.x - h.lastX) / dt
      b.vy = (p.y - h.lastY) / dt
      h.lastX = p.x
      h.lastY = p.y
      h.lastT = e.timeStamp
    }

    function endDrag(e: PointerEvent) {
      const h = held.get(e.pointerId)
      if (!h) return
      h.ball.held = false
      const cap = 2600
      h.ball.vx = Math.max(-cap, Math.min(cap, h.ball.vx))
      h.ball.vy = Math.max(-cap, Math.min(cap, h.ball.vy))
      held.delete(e.pointerId)
      canvas!.style.cursor = 'grab'
    }

    if (reduce) {
      measure()
      layoutStill()
      paint()
      const roStill = new ResizeObserver(() => {
        balls.length = 0
        seed = 20260806
        measure()
        layoutStill()
        paint()
      })
      roStill.observe(wrap)
      return () => roStill.disconnect()
    }

    build()
    measure()
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)
    const ro = new ResizeObserver(() => measure())
    ro.observe(wrap)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      ro.disconnect()
    }
  }, [reduce, count, accent])

  return (
    <div ref={wrapRef} className={`relative touch-none select-none overflow-hidden ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  )
}
