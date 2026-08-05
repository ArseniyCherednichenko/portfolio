import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A living topographic map. A smooth scalar elevation field — a handful of soft
// hills drifting on their own lissajous paths — is sampled onto a grid every
// frame, then traced into iso-lines with marching squares, the same contour a
// real map uses to draw elevation. Where hills overlap the rings merge like a
// saddle between two peaks; the higher a ring sits, the more it warms from cool
// white to lime, so the peaks glow. The pointer is a hill of its own: it eases
// under the cursor and swells while the pointer is down over the field, raising
// a bright lime bullseye that the surrounding land bends around. One RAF loop
// writing straight to a canvas, DPR-aware and ResizeObserver-driven, no per-line
// React state. Under reduced motion there is no loop and no pointer — the frozen
// field is contoured once into a calm, balanced relief. Decorative, so aria-hidden.

// Deterministic per-index generator (mulberry32) so a given hill count always
// renders the same relief, matching the repo's no-Math.random convention.
function seeded(i: number): () => number {
  let s = ((i + 1) * 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Hill {
  fx: number // base x, fraction of width
  fy: number // base y, fraction of height
  amp: number // elevation contribution
  fsig: number // radius, fraction of the smaller side
  ax: number // drift amplitude x, fraction of width
  ay: number // drift amplitude y, fraction of height
  wx: number // angular speed x (rad/s)
  wy: number // angular speed y (rad/s)
  phx: number // phase x
  phy: number // phase y
}

function makeHills(count: number): Hill[] {
  const hills: Hill[] = []
  for (let i = 0; i < count; i++) {
    const rnd = seeded(i)
    hills.push({
      fx: 0.16 + rnd() * 0.68,
      fy: 0.18 + rnd() * 0.64,
      amp: 0.7 + rnd() * 0.5,
      fsig: 0.16 + rnd() * 0.12,
      ax: 0.05 + rnd() * 0.09,
      ay: 0.05 + rnd() * 0.08,
      wx: 0.1 + rnd() * 0.26,
      wy: 0.1 + rnd() * 0.26,
      phx: rnd() * Math.PI * 2,
      phy: rnd() * Math.PI * 2,
    })
  }
  return hills
}

export function Contour({
  className = '',
  accent = '220,248,124',
  count = 5,
  step = 20,
  levels = 11,
}: {
  className?: string
  /** Peak line colour as an "r,g,b" string. */
  accent?: string
  /** Number of drifting hills that build the elevation field. */
  count?: number
  /** Grid spacing in CSS pixels — smaller is smoother and heavier. */
  step?: number
  /** Number of iso-lines between the lowland and the highest peaks. */
  levels?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    const hills = makeHills(count)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    let field = new Float32Array(0)
    let raf = 0

    // The pointer hill: an elevation bump that eases under the cursor and swells
    // in while the pointer is over the field, fading out when it leaves.
    const cur = { x: 0, y: 0, tx: 0, ty: 0, amp: 0, tamp: 0, active: false }
    // Reference elevation the level ladder and the lime warming are scaled against.
    const REF = 1.7

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.max(1, Math.ceil(w / step))
      rows = Math.max(1, Math.ceil(h / step))
      field = new Float32Array((cols + 1) * (rows + 1))
      if (!cur.active) {
        cur.x = cur.tx = w / 2
        cur.y = cur.ty = h / 2
      }
    }

    // Fill the grid with the elevation field at time t. Each hill is a Gaussian
    // bump; the pointer adds one more where the cursor rests.
    function sample(t: number) {
      const min = Math.min(w, h)
      // Precompute each hill's current centre and falloff for this frame.
      const cx: number[] = []
      const cy: number[] = []
      const inv: number[] = []
      const amp: number[] = []
      for (let i = 0; i < hills.length; i++) {
        const b = hills[i]
        cx[i] = (b.fx + b.ax * Math.sin(t * b.wx + b.phx)) * w
        cy[i] = (b.fy + b.ay * Math.cos(t * b.wy + b.phy)) * h
        const sig = b.fsig * min
        inv[i] = 1 / (2 * sig * sig)
        amp[i] = b.amp
      }
      const psig = min * 0.17
      const pinv = 1 / (2 * psig * psig)

      let k = 0
      for (let r = 0; r <= rows; r++) {
        const py = r * step
        for (let c = 0; c <= cols; c++) {
          const px = c * step
          let v = 0
          for (let i = 0; i < hills.length; i++) {
            const dx = px - cx[i]
            const dy = py - cy[i]
            v += amp[i] * Math.exp(-(dx * dx + dy * dy) * inv[i])
          }
          if (cur.amp > 0.001) {
            const dx = px - cur.x
            const dy = py - cur.y
            v += cur.amp * Math.exp(-(dx * dx + dy * dy) * pinv)
          }
          field[k++] = v
        }
      }
    }

    // Marching squares for one iso level. Linear edge interpolation gives the
    // smooth, map-like curve; saddles (cases 5 and 10) draw both segments.
    function contour(level: number) {
      const strideCols = cols + 1
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * strideCols + c
          const tl = field[i]
          const tr = field[i + 1]
          const br = field[i + 1 + strideCols]
          const bl = field[i + strideCols]
          let idx = 0
          if (tl > level) idx |= 8
          if (tr > level) idx |= 4
          if (br > level) idx |= 2
          if (bl > level) idx |= 1
          if (idx === 0 || idx === 15) continue

          const x = c * step
          const y = r * step
          // Edge crossing points, interpolated only when a case needs them.
          const top = () => x + step * ((level - tl) / (tr - tl))
          const bottom = () => x + step * ((level - bl) / (br - bl))
          const left = () => y + step * ((level - tl) / (bl - tl))
          const right = () => y + step * ((level - tr) / (br - tr))

          switch (idx) {
            case 1: ctx!.moveTo(x, left()); ctx!.lineTo(bottom(), y + step); break
            case 2: ctx!.moveTo(bottom(), y + step); ctx!.lineTo(x + step, right()); break
            case 3: ctx!.moveTo(x, left()); ctx!.lineTo(x + step, right()); break
            case 4: ctx!.moveTo(top(), y); ctx!.lineTo(x + step, right()); break
            case 5:
              ctx!.moveTo(x, left()); ctx!.lineTo(top(), y)
              ctx!.moveTo(bottom(), y + step); ctx!.lineTo(x + step, right()); break
            case 6: ctx!.moveTo(top(), y); ctx!.lineTo(bottom(), y + step); break
            case 7: ctx!.moveTo(x, left()); ctx!.lineTo(top(), y); break
            case 8: ctx!.moveTo(top(), y); ctx!.lineTo(x, left()); break
            case 9: ctx!.moveTo(top(), y); ctx!.lineTo(bottom(), y + step); break
            case 10:
              ctx!.moveTo(top(), y); ctx!.lineTo(x + step, right())
              ctx!.moveTo(x, left()); ctx!.lineTo(bottom(), y + step); break
            case 11: ctx!.moveTo(top(), y); ctx!.lineTo(x + step, right()); break
            case 12: ctx!.moveTo(x, left()); ctx!.lineTo(x + step, right()); break
            case 13: ctx!.moveTo(bottom(), y + step); ctx!.lineTo(x + step, right()); break
            case 14: ctx!.moveTo(x, left()); ctx!.lineTo(bottom(), y + step); break
          }
        }
      }
    }

    // Draw every iso-line for the current field. Higher rings warm toward lime
    // and thicken slightly, so peaks and the pointer's bullseye read as elevation.
    function render() {
      ctx!.fillStyle = '#09090b'
      ctx!.fillRect(0, 0, w, h)
      for (let l = 1; l <= levels; l++) {
        const level = (l / (levels + 1)) * REF
        const frac = Math.min(1, level / REF)
        const rr = Math.round(255 + (ar - 255) * frac)
        const gg = Math.round(255 + (ag - 255) * frac)
        const bb = Math.round(255 + (ab - 255) * frac)
        ctx!.beginPath()
        contour(level)
        ctx!.strokeStyle = `rgba(${rr},${gg},${bb},${0.1 + frac * 0.5})`
        ctx!.lineWidth = 0.8 + frac * 1.1
        ctx!.stroke()
      }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tx = e.clientX - rect.left
      cur.ty = e.clientY - rect.top
      cur.active = true
      cur.tamp = 1.15
    }
    function onLeave() {
      cur.active = false
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      // Still relief: freeze the field at t = 0, no pointer, and contour once.
      const draw = () => {
        sample(0)
        render()
      }
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
      cur.amp += (cur.tamp - cur.amp) * 0.08
      sample(t * 0.35)
      render()
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
  }, [reduce, accent, count, step, levels])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
