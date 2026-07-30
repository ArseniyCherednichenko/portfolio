import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A meteor shower: a calm, directional rain of light streaks drawn on one
// canvas. It fills the gap the field family had — Starfield warps radially out
// of a vanishing point, Lightning wriggles jagged filaments, Beams throw hard
// volumetric shafts; this is the gentle diagonal kind, thin streaks with a
// bright head and a tail that fades to nothing, staggered so the sky is never
// empty and never marching in step. Each streak crosses the box along one fixed
// travel angle and, when it runs off the far edge, respawns on the entry line
// with a fresh length, speed, and cross-offset, its brightness enveloped over
// its run so a recycle is never a visible pop. Most streaks are cool white; a
// few carry the lime accent, and any streak whose head passes near the pointer
// warms toward lime and lengthens — the same "fields warm toward the cursor"
// language the rest of the library speaks. One RAF loop, no per-streak React
// state, DPR-aware and ResizeObserver-driven. Under reduced motion there is no
// loop at all: a single still frame lays a few faint diagonal streaks so the
// shape reads without any movement.

// A tiny seeded PRNG (mulberry32) so the shower looks naturally scattered yet
// renders the same every mount — no Math.random reaching for entropy per frame.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Meteor {
  /** Distance travelled along the entry line, in px from the anchor. */
  cross: number
  /** How far along its run the head is, in px from the entry point. */
  along: number
  /** Total run length before it recycles, in px. */
  span: number
  /** Speed, px per frame. */
  speed: number
  /** Trail length, px. */
  len: number
  /** Stroke thickness, px. */
  size: number
  /** Peak opacity for this run. */
  alpha: number
  /** True for the lime-accented minority. */
  lime: boolean
}

export function Meteors({
  className = '',
  count = 20,
  /** Travel direction in degrees (math convention, y down): 110 falls down-left. */
  angleDeg = 108,
  accent = '220,248,124',
  /** Roughly one streak in this many carries the lime accent instead of white. */
  limeEvery = 5,
}: {
  className?: string
  count?: number
  angleDeg?: number
  accent?: string
  limeEvery?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pointer = { x: -9999, y: -9999, active: false }

    const rad = (angleDeg * Math.PI) / 180
    // Unit travel vector, and the perpendicular the entry line is spread along.
    const ux = Math.cos(rad)
    const uy = Math.sin(rad)
    const perpx = -uy
    const perpy = ux

    const rand = rng(0x9e3779b9)
    let meteors: Meteor[] = []
    // Geometry recomputed on resize: where the entry line sits and how far a
    // streak runs before it has certainly crossed the whole box.
    let anchorX = 0
    let anchorY = 0
    let run = 0
    let spread = 0

    // Reset one streak to a fresh run. `initial` scatters it partway across on
    // the first fill so the sky starts full rather than sweeping in from a corner.
    function reset(m: Meteor, initial: boolean) {
      m.cross = (rand() - 0.5) * spread
      m.span = run
      m.speed = 3.2 + rand() * 4.6
      m.len = 90 + rand() * 170
      m.size = 0.8 + rand() * 1.1
      m.alpha = 0.28 + rand() * 0.5
      m.lime = rand() < 1 / limeEvery
      m.along = initial ? rand() * run : -m.len - rand() * 220
    }

    function build() {
      meteors = Array.from({ length: count }, () => {
        const m: Meteor = { cross: 0, along: 0, span: 0, speed: 0, len: 0, size: 0, alpha: 0, lime: false }
        reset(m, true)
        return m
      })
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const diag = Math.hypot(w, h)
      spread = diag * 1.15
      run = diag + 260
      // Anchor the entry line at box centre, pushed back against travel by half
      // the run so streaks enter from beyond one edge and exit beyond the other.
      anchorX = w / 2 - ux * (run / 2)
      anchorY = h / 2 - uy * (run / 2)
      build()
    }

    // Head position for a streak at its current `along`/`cross`.
    function headX(m: Meteor) {
      return anchorX + ux * m.along + perpx * m.cross
    }
    function headY(m: Meteor) {
      return anchorY + uy * m.along + perpy * m.cross
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

    // Draw a single streak: a bright head with a soft glow and a gradient trail
    // that fades to nothing behind it, warmed and lengthened by `heat`.
    function draw(m: Meteor, env: number, heat: number) {
      const hx = headX(m)
      const hy = headY(m)
      const len = m.len * (1 + heat * 0.5)
      const tx = hx - ux * len
      const ty = hy - uy * len
      const rgb = m.lime || heat > 0.35 ? accent : '255,255,255'
      const a = Math.min(1, m.alpha * env + heat * 0.4)

      const grad = ctx!.createLinearGradient(hx, hy, tx, ty)
      grad.addColorStop(0, `rgba(${rgb},${a})`)
      grad.addColorStop(1, `rgba(${rgb},0)`)
      ctx!.strokeStyle = grad
      ctx!.lineWidth = m.size + heat * 1.1
      ctx!.lineCap = 'round'
      ctx!.beginPath()
      ctx!.moveTo(hx, hy)
      ctx!.lineTo(tx, ty)
      ctx!.stroke()

      // A small round glow at the head, brighter when warmed by the pointer.
      const r = 2 + m.size + heat * 2.5
      const dot = ctx!.createRadialGradient(hx, hy, 0, hx, hy, r)
      dot.addColorStop(0, `rgba(${rgb},${Math.min(1, a + 0.25)})`)
      dot.addColorStop(1, `rgba(${rgb},0)`)
      ctx!.fillStyle = dot
      ctx!.beginPath()
      ctx!.arc(hx, hy, r, 0, Math.PI * 2)
      ctx!.fill()
    }

    resize()

    if (reduce) {
      // No loop: one still frame of a few faint streaks, redrawn on resize so
      // the shape is legible while nothing moves.
      const paint = () => {
        ctx!.clearRect(0, 0, w, h)
        for (const m of meteors) {
          m.along = m.span * (0.15 + ((m.cross + spread) % 0.7))
          draw(m, 0.5, 0)
        }
      }
      paint()
      const ro = new ResizeObserver(() => {
        resize()
        paint()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h)
      for (const m of meteors) {
        m.along += m.speed
        if (m.along - m.len > m.span) reset(m, false)

        // Brightness envelope: fade in over the first stretch of the run, hold,
        // then fade out near the end, so recycles are never a visible pop.
        const p = m.along / m.span
        const env = p < 0.12 ? p / 0.12 : p > 0.85 ? Math.max(0, (1 - p) / 0.15) : 1

        let heat = 0
        if (pointer.active) {
          const dx = headX(m) - pointer.x
          const dy = headY(m) - pointer.y
          const dist = Math.hypot(dx, dy)
          const R = 170
          if (dist < R) heat = 1 - dist / R
        }

        if (env > 0.001) draw(m, env, heat)
      }
      raf = requestAnimationFrame(frame)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, count, angleDeg, accent, limeEvery])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
