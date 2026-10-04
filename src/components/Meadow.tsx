import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A meadow — a field of grass blades rooted along the floor that ripples with a
// simulated breeze and parts around the cursor like a hand brushed through it,
// each blade springing back when the hand moves on. It sits apart from the other
// living fields in the Playground: Murmuration is a flock of free agents, Slime
// an emergent trail network, FlowField a drift of particles read off a noise
// field. This is none of those — it is a rooted field. Every blade is anchored
// at the ground and can only lean; what moves through it is wind, not the blades
// themselves, so the motion reads as a surface disturbed rather than a swarm.
//
// The wind is a travelling gust, not per-blade jitter: a blade's lean is the sum
// of two slow sines whose phase is offset by the blade's position across the
// field, so a crest of bend sweeps left to right and the whole meadow ripples in
// coherent waves the way real grass does under a breeze. The cursor adds a local
// push — blades within a radius lean away from the pointer, hardest nearest it —
// carried on a little critically-damped spring per blade so they bend as the hand
// arrives and ease back to the wind's rest once it leaves, never snapping. Near
// the cursor a blade also warms from its sage green toward the site's lime, the
// shared "fields warm toward the cursor" language used across the Playground.
//
// Depth is faked by sorting: back blades are drawn first and are shorter, thinner
// and darker; front blades are taller, wider and lighter, so the field reads as
// layered rather than flat. One canvas, one rAF loop off the frame delta, DPR
// capped at 2, the blade state written straight to a typed array off the React
// render path, the canvas decorative and aria-hidden.
//
// Reduced motion: no loop, no wind, no cursor. The meadow paints a single still
// frame — every blade at its base lean plus the gust sampled at t=0, so the field
// keeps a gentle frozen ripple — and re-renders only on resize. The look without
// the motion.

export type MeadowProps = {
  className?: string
  style?: React.CSSProperties
  /** Number of blades. Clamped to 40..400. */
  count?: number
  /** 0..1 — how hard the breeze drives the field. Live via a ref, so a control
   * can slide it without restarting the loop. */
  wind?: number
  /** Blade colour at the base (near the ground). Any #rgb / #rrggbb. */
  base?: string
  /** Blade colour at the tip. */
  tip?: string
  /** Warm accent blades lean toward near the cursor. */
  accent?: string
}

type Blade = {
  rx: number // root x, fraction of width 0..1
  h: number // height, fraction of canvas height
  w: number // base width in px
  depth: number // 0 back .. 1 front
  lean: number // static base lean in px (per-blade character)
  phase: number // individual phase offset into the gust
  bend: number // live cursor-driven tip offset in px (spring state)
  vbend: number // spring velocity
  col: [number, number, number] // resolved solid colour for this blade
}

// mulberry32 — a small deterministic PRNG so the same blade index always starts
// the same way (the repo's no-Math.random convention for reproducible art).
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

// Parse a CSS hex colour to [r,g,b]; falls back to the given triple for anything
// that is not a #rgb / #rrggbb string, so a named colour never throws.
function toRgb(color: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return fallback
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const n = parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function Meadow({
  className,
  style,
  count = 220,
  wind = 0.55,
  base = '#1f3a1c',
  tip = '#6f9e46',
  accent = '#DCF87C',
}: MeadowProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduce = useReducedMotion()
  // Live wind without restarting the loop — a control can slide it freely.
  const windRef = useRef(wind)
  windRef.current = wind

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const baseRgb = toRgb(base, [31, 58, 28])
    const tipRgb = toRgb(tip, [111, 158, 70])
    const accentRgb = toRgb(accent, [220, 248, 124])
    const n = Math.max(40, Math.min(400, Math.round(count)))

    // Seed the field. Each blade gets a depth; back blades (low depth) are
    // shorter, thinner and darker, front blades taller, wider and lighter, so a
    // depth sort paints a layered meadow rather than a flat comb. The blade's
    // solid colour is the base→tip ramp taken at its depth, so the back of the
    // field recedes into the ground.
    const rnd = seeded(0x6d3a1f05)
    const blades: Blade[] = Array.from({ length: n }, (): Blade => {
      const depth = rnd()
      const c: [number, number, number] = [
        Math.round(lerp(baseRgb[0], tipRgb[0], depth)),
        Math.round(lerp(baseRgb[1], tipRgb[1], depth)),
        Math.round(lerp(baseRgb[2], tipRgb[2], depth)),
      ]
      return {
        rx: rnd(),
        h: (0.34 + depth * 0.5) * (0.82 + rnd() * 0.36),
        w: 2.4 + depth * 4.6,
        depth,
        lean: (rnd() - 0.5) * 10,
        phase: rnd() * Math.PI * 2,
        bend: 0,
        vbend: 0,
        col: c,
      }
    })
    // Back-to-front so nearer blades overlap farther ones.
    blades.sort((a, b) => a.depth - b.depth)

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

    // Pointer tracking, in CSS pixels relative to the canvas. `active` falls to
    // 0 when the pointer leaves so the field eases back to the wind's rest
    // instead of freezing mid-push.
    let mx = 0
    let my = 0
    let active = 0 // 0..1, eased

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mx = e.clientX - rect.left
      my = e.clientY - rect.top
      active = 1
    }
    const onLeave = () => {
      active = 0
    }

    // The lean the gust imposes on a blade at time t, in px of tip offset. Two
    // slow sines with the root position folded into the phase make a crest that
    // travels across the field, so the meadow ripples in coherent waves.
    const gustAt = (b: Blade, t: number, strength: number) => {
      const g =
        Math.sin(t * 0.9 + b.rx * 7.5) * 0.62 +
        Math.sin(t * 1.7 - b.rx * 3.3 + b.phase) * 0.38
      // Taller blades catch more wind; scale the offset by blade height.
      return (b.lean + g * strength * 46) * (0.5 + b.h)
    }

    const paintBlade = (b: Blade, baseY: number, tipDx: number, warm: number) => {
      const hpx = b.h * height
      const rx = b.rx * width
      const tipX = rx + tipDx
      const tipY = baseY - hpx
      // Control point bows the blade and leads the tip, so the bend curves
      // rather than hinging at the root.
      const ctrlX = rx + tipDx * 0.55
      const ctrlY = baseY - hpx * 0.55
      const hw = b.w / 2

      let r = b.col[0]
      let g = b.col[1]
      let bl = b.col[2]
      if (warm > 0) {
        r = Math.round(lerp(r, accentRgb[0], warm))
        g = Math.round(lerp(g, accentRgb[1], warm))
        bl = Math.round(lerp(bl, accentRgb[2], warm))
      }
      ctx.fillStyle = `rgb(${r},${g},${bl})`

      ctx.beginPath()
      ctx.moveTo(rx - hw, baseY)
      ctx.quadraticCurveTo(ctrlX - hw * 0.4, ctrlY, tipX, tipY)
      ctx.quadraticCurveTo(ctrlX + hw * 0.4, ctrlY, rx + hw, baseY)
      ctx.closePath()
      ctx.fill()
    }

    const PUSH = 34 // px a blade is shoved at the cursor's centre
    const R = 120 // px radius of the cursor's influence

    const paint = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // A soft ground shadow so the blades root into darkness instead of a hard
      // edge.
      const ground = ctx.createLinearGradient(0, height * 0.72, 0, height)
      ground.addColorStop(0, 'rgba(0,0,0,0)')
      ground.addColorStop(1, 'rgba(0,0,0,0.38)')
      ctx.fillStyle = ground
      ctx.fillRect(0, height * 0.72, width, height * 0.28)

      const strength = windRef.current
      const baseY = height + 2 // root just below the frame so bottoms are hidden

      for (const b of blades) {
        const windDx = gustAt(b, t, strength)
        const tipDx = windDx + b.bend
        let warm = 0
        if (active > 0) {
          const bx = b.rx * width + tipDx * 0.5
          const by = baseY - b.h * height * 0.5
          const dx = bx - mx
          const dy = by - my
          const d = Math.hypot(dx, dy)
          if (d < R) {
            const fall = 1 - d / R
            warm = fall * fall * active * 0.7
          }
        }
        paintBlade(b, baseY, tipDx, warm)
      }
    }

    let raf = 0
    let start = performance.now()
    let last = start

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - start) / 1000

      const strength = windRef.current
      const baseY = height + 2
      for (const b of blades) {
        // Target cursor push: blades within the radius lean away from the
        // pointer, hardest nearest it, measured from the blade's mid-height.
        let target = 0
        if (active > 0) {
          const windDx = gustAt(b, t, strength)
          const bx = b.rx * width + windDx * 0.5
          const by = baseY - b.h * height * 0.5
          const dx = bx - mx
          const dy = by - my
          const d = Math.hypot(dx, dy)
          if (d < R) {
            const fall = 1 - d / R
            const dir = dx >= 0 ? 1 : -1
            target = dir * fall * fall * PUSH * active
          }
        }
        // Critically-damped-ish spring toward the target, so the blade bends in
        // as the hand arrives and eases back to the wind rest (target 0) once it
        // leaves rather than snapping.
        b.vbend += ((target - b.bend) * 46 - b.vbend * 11) * dt
        b.bend += b.vbend * dt
      }

      paint(t)
      raf = requestAnimationFrame(step)
    }

    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) paint(0)
    })
    ro.observe(canvas)

    if (reduce) {
      paint(0)
    } else {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
      start = performance.now()
      last = start
      raf = requestAnimationFrame(step)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, count, base, tip, accent])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  )
}
