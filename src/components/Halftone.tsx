import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A halftone screen — the oldest trick in print, made a pointer field. A photo
// on a page has no grey ink: it is a regular lattice of solid dots that grow
// where the picture is light and shrink to nothing where it is dark, and the
// eye fuses them back into a tone. Here there is no photograph underneath, only
// a scalar brightness field — a few soft lights drifting on their own lissajous
// paths — sampled onto that lattice, so each dot swells and warms toward the
// light and starves to a pinprick in the shadows between. The pointer is a
// light of its own: it eases under the cursor and flares while the pointer is
// down, opening a bright lime bloom the surrounding dots grow to meet, the way
// a spotlight would rake across a printed screen. One RAF loop writing straight
// to a canvas, DPR-aware and ResizeObserver-driven, no per-dot React state.
// Under reduced motion there is no loop and no pointer — the frozen field is
// screened once into a calm, balanced still. Decorative, so aria-hidden.

// Deterministic per-index generator (mulberry32) so a given light count always
// renders the same field, matching the repo's no-Math.random convention.
function seeded(i: number): () => number {
  let s = ((i + 1) * 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Light {
  fx: number // base x, fraction of width
  fy: number // base y, fraction of height
  amp: number // brightness contribution
  fsig: number // radius, fraction of the smaller side
  ax: number // drift amplitude x, fraction of width
  ay: number // drift amplitude y, fraction of height
  wx: number // angular speed x (rad/s)
  wy: number // angular speed y (rad/s)
  phx: number // phase x
  phy: number // phase y
}

function makeLights(count: number): Light[] {
  const lights: Light[] = []
  for (let i = 0; i < count; i++) {
    const rnd = seeded(i)
    lights.push({
      fx: 0.18 + rnd() * 0.64,
      fy: 0.2 + rnd() * 0.6,
      amp: 0.8 + rnd() * 0.5,
      fsig: 0.16 + rnd() * 0.12,
      ax: 0.06 + rnd() * 0.1,
      ay: 0.05 + rnd() * 0.09,
      wx: 0.11 + rnd() * 0.24,
      wy: 0.11 + rnd() * 0.24,
      phx: rnd() * Math.PI * 2,
      phy: rnd() * Math.PI * 2,
    })
  }
  return lights
}

export function Halftone({
  className = '',
  accent = '220,248,124',
  count = 4,
  gap = 16,
}: {
  className?: string
  /** The lit colour dots warm toward, as an "r,g,b" string. */
  accent?: string
  /** Number of drifting lights that build the brightness field. */
  count?: number
  /** Dot lattice spacing in CSS pixels — smaller is a finer screen and heavier. */
  gap?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    const lights = makeLights(count)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    let raf = 0

    // The pointer light: a brightness bump that eases under the cursor and
    // swells while the pointer is over the field, fading out when it leaves.
    const cur = { x: 0, y: 0, tx: 0, ty: 0, amp: 0, tamp: 0, active: false }
    // Reference brightness the dot growth and the lime warming are scaled against.
    const REF = 1.9
    const maxR = gap * 0.62 // peak dots just kiss their neighbours

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.max(1, Math.ceil(w / gap))
      rows = Math.max(1, Math.ceil(h / gap))
      if (!cur.active) {
        cur.x = cur.tx = w / 2
        cur.y = cur.ty = h / 2
      }
    }

    // Brightness of the field at one point and time. Each light is a Gaussian
    // bloom; the pointer adds one more where the cursor rests.
    function brightnessAt(px: number, py: number, cx: number[], cy: number[], inv: number[], amp: number[], pinv: number) {
      let v = 0
      for (let i = 0; i < lights.length; i++) {
        const dx = px - cx[i]
        const dy = py - cy[i]
        v += amp[i] * Math.exp(-(dx * dx + dy * dy) * inv[i])
      }
      if (cur.amp > 0.001) {
        const dx = px - cur.x
        const dy = py - cur.y
        v += cur.amp * Math.exp(-(dx * dx + dy * dy) * pinv)
      }
      return v
    }

    // Smoothstep so dot growth eases in and out of the light rather than ramping
    // linearly — the classic screened-tone falloff.
    function smooth(x: number) {
      const c = x < 0 ? 0 : x > 1 ? 1 : x
      return c * c * (3 - 2 * c)
    }

    // Paint the whole dot screen for the current field. Brighter nodes grow a
    // larger dot and warm from a cool ink through lime to white; the dimmest
    // stay a faint pinprick so the screen is always faintly there at rest.
    function render(t: number) {
      ctx!.fillStyle = '#09090b'
      ctx!.fillRect(0, 0, w, h)

      const min = Math.min(w, h)
      const cx: number[] = []
      const cy: number[] = []
      const inv: number[] = []
      const amp: number[] = []
      for (let i = 0; i < lights.length; i++) {
        const b = lights[i]
        cx[i] = (b.fx + b.ax * Math.sin(t * b.wx + b.phx)) * w
        cy[i] = (b.fy + b.ay * Math.cos(t * b.wy + b.phy)) * h
        const sig = b.fsig * min
        inv[i] = 1 / (2 * sig * sig)
        amp[i] = b.amp
      }
      const psig = min * 0.16
      const pinv = 1 / (2 * psig * psig)

      for (let r = 0; r <= rows; r++) {
        const py = r * gap
        for (let c = 0; c <= cols; c++) {
          const px = c * gap
          const v = brightnessAt(px, py, cx, cy, inv, amp, pinv)
          const frac = smooth(Math.min(1, v / REF))
          // A faint baseline screen at rest, filling to touching dots at the peaks.
          const rad = maxR * (0.08 + 0.92 * frac)
          if (rad < 0.35) continue
          // Cool ink -> lime -> white as brightness climbs.
          let rr: number
          let gg: number
          let bb: number
          if (frac < 0.62) {
            const k = frac / 0.62
            rr = Math.round(90 + (ar - 90) * k)
            gg = Math.round(140 + (ag - 140) * k)
            bb = Math.round(150 + (ab - 150) * k)
          } else {
            const k = (frac - 0.62) / 0.38
            rr = Math.round(ar + (255 - ar) * k)
            gg = Math.round(ag + (255 - ag) * k)
            bb = Math.round(ab + (255 - ab) * k)
          }
          ctx!.beginPath()
          ctx!.fillStyle = `rgba(${rr},${gg},${bb},${0.22 + frac * 0.72})`
          ctx!.arc(px, py, rad, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tx = e.clientX - rect.left
      cur.ty = e.clientY - rect.top
      cur.active = true
      cur.tamp = 1.25
    }
    function onDown() {
      cur.tamp = 1.9
    }
    function onUp() {
      cur.tamp = cur.active ? 1.25 : 0
    }
    function onLeave() {
      cur.active = false
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      // Still screen: freeze the field at t = 0, no pointer, and paint once.
      const draw = () => render(0)
      draw()
      const ro = new ResizeObserver(() => {
        resize()
        draw()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const start = performance.now()
    function frame(now: number) {
      const t = (now - start) / 1000
      cur.x += (cur.tx - cur.x) * 0.16
      cur.y += (cur.ty - cur.y) * 0.16
      cur.amp += (cur.tamp - cur.amp) * 0.09
      render(t * 0.4)
      raf = requestAnimationFrame(frame)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, accent, count, gap])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
