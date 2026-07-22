import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A warp starfield — points streaming out of a vanishing point toward the
// viewer, each drawn as a short streak so the field reads as motion through
// space rather than a twinkle. Deliberately distinct from the site's other
// canvas fields: `Particles` webs a constellation, `Beams` throws soft light
// shafts, `Threads` flows horizontal waves, `DotGrid` holds a static lattice —
// here the points travel, accelerating as they near the edge and stretching
// into trails. The vanishing point eases toward the pointer, so the whole
// field banks the way you point, and the fastest streaks warm toward lime.
//
// Each star lives in a simple frustum: an (x, y) offset from the centre and a
// depth z that shrinks every frame (moving nearer); when it passes the near
// plane it respawns at the far plane with a fresh seeded offset. Projection is
// the classic x/z, y/z perspective divide, so nearer stars fan out faster and
// draw brighter, thicker trails. One RAF loop, DPR-clamped, ResizeObserver-
// driven, no React state on the hot path. Purely decorative, so `aria-hidden`.
//
// Under reduced motion it paints a single calm star lattice — points at rest,
// no streaks, no loop, no pointer listener. Nothing is ever gated behind
// motion; the field is background texture either way.

// A tiny seeded PRNG (mulberry32) so the initial scatter is identical across
// renders and never trips the "no Math.random" resume rules — the field looks
// alive but is fully deterministic.
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

export function Starfield({
  className = '',
  count = 220,
  speed = 1,
  listen = 'self',
  accent = '220,248,124',
}: {
  className?: string
  /** Number of streaming stars. */
  count?: number
  /** Warp speed multiplier — how fast depth closes each frame. */
  speed?: number
  /** Pointer source: the canvas itself, or the whole window (feels alive before you touch it). */
  listen?: 'self' | 'window'
  /** Highlight colour as an "r,g,b" string, for the nearest/fastest streaks. */
  accent?: string
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
    const FOCAL = 320 // perspective focal length in px — sets how hard stars fan out
    const FAR = 1000 // far plane depth
    const NEAR = 1 // near plane; below this a star respawns far away

    // The vanishing point, as a fraction of the frame from centre, and where it
    // eases toward (steered by the pointer). Kept in [-0.5, 0.5]-ish range and
    // multiplied by the frame size at draw time so it survives resizes.
    const vp = { x: 0, y: 0, tx: 0, ty: 0 }
    const pointer = { active: false }

    // Each star: x/y frustum offset (in the FOCAL/z projection space), depth z,
    // and its previous projected screen point so we can draw a streak to it.
    const rng = makeRng(0x51ee7)
    const stars = Array.from({ length: count }, () => ({
      x: (rng() - 0.5) * 2 * FOCAL,
      y: (rng() - 0.5) * 2 * FOCAL,
      z: rng() * FAR,
      px: 0,
      py: 0,
    }))

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Respawn a star at the far plane with a fresh seeded offset.
    function recycle(s: (typeof stars)[number]) {
      s.x = (rng() - 0.5) * 2 * FOCAL
      s.y = (rng() - 0.5) * 2 * FOCAL
      s.z = FAR
      s.px = 0
      s.py = 0
    }

    // Paint one frame. `dt` scales the depth step; pass dt = 0 for the static
    // (reduced-motion) frame, which draws dots at rest with no trails.
    function render(dt: number) {
      ctx!.clearRect(0, 0, w, h)
      // Ease the vanishing point toward its target (pointer-steered or centre).
      vp.x += (vp.tx - vp.x) * 0.06
      vp.y += (vp.ty - vp.y) * 0.06
      const cx = w / 2 + vp.x * w * 0.5
      const cy = h / 2 + vp.y * h * 0.5

      for (const s of stars) {
        if (dt > 0) {
          s.z -= dt
          if (s.z <= NEAR) {
            recycle(s)
            continue
          }
        }
        const k = FOCAL / s.z
        const sx = cx + s.x * k
        const sy = cy + s.y * k
        // Depth-based brightness/size: nearer (small z) is brighter and bigger.
        const near = 1 - s.z / FAR
        const size = 0.4 + near * near * 2.2

        if (dt > 0 && s.px !== 0) {
          // Streak from the previous projected point to the current one.
          const lit = near * near // the closest streaks warm to lime
          ctx!.strokeStyle =
            lit > 0.35
              ? `rgba(${accent},${0.35 + lit * 0.55})`
              : `rgba(255,255,255,${0.12 + near * 0.7})`
          ctx!.lineWidth = size
          ctx!.beginPath()
          ctx!.moveTo(s.px, s.py)
          ctx!.lineTo(sx, sy)
          ctx!.stroke()
        } else {
          // Static dot (first frame after spawn, or reduced motion).
          ctx!.fillStyle = `rgba(255,255,255,${0.12 + near * 0.6})`
          ctx!.beginPath()
          ctx!.arc(sx, sy, size * 0.6, 0, Math.PI * 2)
          ctx!.fill()
        }
        s.px = sx
        s.py = sy
      }
    }

    function pointFrom(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect()
      // Normalize pointer offset from frame centre to a gentle [-0.5, 0.5] steer.
      vp.tx = ((clientX - rect.left) / rect.width - 0.5) * 0.7
      vp.ty = ((clientY - rect.top) / rect.height - 0.5) * 0.7
      pointer.active = true
    }
    function onMove(e: PointerEvent) {
      pointFrom(e.clientX, e.clientY)
    }
    function onLeave() {
      pointer.active = false
      vp.tx = 0
      vp.ty = 0
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

    ctx.lineCap = 'round'
    const target = listen === 'window' ? window : canvas
    function frame() {
      render(4 * speed)
      raf = requestAnimationFrame(frame)
    }
    target.addEventListener('pointermove', onMove as EventListener)
    target.addEventListener('pointerleave', onLeave as EventListener)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerleave', onLeave as EventListener)
      ro.disconnect()
    }
  }, [reduce, count, speed, listen, accent])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
