import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A fluid — real ink, stirred by the pointer. Everything else in the Objects &
// toys family pushes discrete bodies around (the Cloth's nodes, the Ballpit's
// spheres, the Cradle's bobs) or reads a fixed field (the Chladni plate); this
// is the one continuous medium in the room, a smoke that carries a swirl the way
// water carries a drop of dye. Drag through it and it parts, curls behind your
// hand, and folds the ink into the filaments and mushroom rolls a real fluid
// makes; press and it blooms.
//
// The maths is the honest one: Jos Stam's *stable fluids* (SIGGRAPH 1999), the
// solver that made real-time fluid possible by being unconditionally stable at
// any timestep. A velocity field and a dye field live on a coarse grid. Each
// frame the velocity is made divergence-free — a fluid cannot pile up or vanish,
// so a Gauss-Seidel relaxation solves for the pressure whose gradient cancels
// any net flow into a cell (a Hodge/Helmholtz projection) — and then both the
// velocity and the dye are *advected*: every cell traces its flow backward to
// where its contents came from a moment ago and samples there (semi-Lagrangian
// backtrace, bilinearly interpolated), which is what keeps the whole thing stable
// no matter how hard you stir. The ink fades a touch each step so the picture
// keeps breathing rather than silting up. The grid is coarse and blitted up soft,
// so what you read is not cells but a smoke — the interpolation does the smoothing.
//
// It is alive: two slow emitters wander figure-eights and lay down curling ink on
// their own, so the field is always folding even when untouched. MOVE THE POINTER
// to stir it — the ink is injected under your hand and pushed the way you are
// moving, so fast strokes shear it into filaments; PRESS to bloom a dense puff
// that the flow immediately runs away with. No wall clock: the step is a fixed
// timestep so the flow reads the same on any monitor and survives a resize. Under
// reduced motion the loop never starts — a few drops and a swirl are simmered in a
// tight batch of steps up front and the settled ink is painted still. Decorative,
// so aria-hidden.

const CELL = 12 // target grid cell in css px — grid resolution scales to the box
const MAX_CELLS = 8200 // hard cap on interior cells, so the solver stays real-time
const ITER = 14 // Gauss-Seidel sweeps per pressure solve
const DT = 0.13 // fixed sim timestep
const FADE = 0.985 // per-step dye retention (the ink slowly clears)
const DAMP = 0.999 // per-step velocity damping (the flow slowly stills)

export function Fluid({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    // Offscreen buffer the size of the interior grid; drawn up soft to the canvas.
    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d')
    if (!bctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let cssW = 0
    let cssH = 0

    // Grid, including a one-cell border. W,H are full dims; IW,IH the interior.
    let W = 0
    let H = 0
    let IW = 0
    let IH = 0
    let N = 1 // scale used by advection/projection
    let u = new Float32Array(0)
    let v = new Float32Array(0)
    let u0 = new Float32Array(0)
    let v0 = new Float32Array(0)
    let dens = new Float32Array(0)
    let dens0 = new Float32Array(0)
    let img: ImageData | null = null

    let raf = 0
    let last = -1
    let acc = 0
    let t = 0

    // Pointer state, in grid coordinates.
    let px = -1
    let py = -1
    let ppx = -1
    let ppy = -1
    let down = false

    const IX = (i: number, j: number) => i + j * W

    function allocate() {
      const rect = canvas!.getBoundingClientRect()
      cssW = Math.max(1, Math.floor(rect.width))
      cssH = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(cssW * dpr)
      canvas!.height = Math.floor(cssH * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.imageSmoothingEnabled = true

      // Interior grid from the box, capped so the solver stays real-time.
      IW = Math.max(24, Math.round(cssW / CELL))
      IH = Math.max(24, Math.round(cssH / CELL))
      if (IW * IH > MAX_CELLS) {
        const s = Math.sqrt(MAX_CELLS / (IW * IH))
        IW = Math.max(24, Math.round(IW * s))
        IH = Math.max(24, Math.round(IH * s))
      }
      W = IW + 2
      H = IH + 2
      N = Math.max(IW, IH)
      const size = W * H
      u = new Float32Array(size)
      v = new Float32Array(size)
      u0 = new Float32Array(size)
      v0 = new Float32Array(size)
      dens = new Float32Array(size)
      dens0 = new Float32Array(size)

      buf.width = IW
      buf.height = IH
      img = bctx!.createImageData(IW, IH)
    }

    // Reflect velocity off the walls, copy scalars, average the corners.
    function setBnd(b: number, x: Float32Array) {
      for (let i = 1; i <= IW; i++) {
        x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)]
        x[IX(i, H - 1)] = b === 2 ? -x[IX(i, H - 2)] : x[IX(i, H - 2)]
      }
      for (let j = 1; j <= IH; j++) {
        x[IX(0, j)] = b === 1 ? -x[IX(1, j)] : x[IX(1, j)]
        x[IX(W - 1, j)] = b === 1 ? -x[IX(W - 2, j)] : x[IX(W - 2, j)]
      }
      x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)])
      x[IX(0, H - 1)] = 0.5 * (x[IX(1, H - 1)] + x[IX(0, H - 2)])
      x[IX(W - 1, 0)] = 0.5 * (x[IX(W - 2, 0)] + x[IX(W - 1, 1)])
      x[IX(W - 1, H - 1)] = 0.5 * (x[IX(W - 2, H - 1)] + x[IX(W - 1, H - 2)])
    }

    // Semi-Lagrangian advection: each cell samples where its contents drifted from.
    function advect(b: number, d: Float32Array, d0: Float32Array, uu: Float32Array, vv: Float32Array) {
      const dt0 = DT * N
      for (let j = 1; j <= IH; j++) {
        for (let i = 1; i <= IW; i++) {
          let x = i - dt0 * uu[IX(i, j)]
          let y = j - dt0 * vv[IX(i, j)]
          if (x < 0.5) x = 0.5
          else if (x > IW + 0.5) x = IW + 0.5
          if (y < 0.5) y = 0.5
          else if (y > IH + 0.5) y = IH + 0.5
          const i0 = Math.floor(x)
          const i1 = i0 + 1
          const j0 = Math.floor(y)
          const j1 = j0 + 1
          const s1 = x - i0
          const s0 = 1 - s1
          const t1 = y - j0
          const t0 = 1 - t1
          d[IX(i, j)] =
            s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
            s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)])
        }
      }
      setBnd(b, d)
    }

    // Make the velocity field divergence-free (mass-conserving) via a pressure solve.
    function project(uu: Float32Array, vv: Float32Array, p: Float32Array, div: Float32Array) {
      const h = 1.0 / N
      for (let j = 1; j <= IH; j++) {
        for (let i = 1; i <= IW; i++) {
          div[IX(i, j)] =
            -0.5 * h * (uu[IX(i + 1, j)] - uu[IX(i - 1, j)] + vv[IX(i, j + 1)] - vv[IX(i, j - 1)])
          p[IX(i, j)] = 0
        }
      }
      setBnd(0, div)
      setBnd(0, p)
      for (let k = 0; k < ITER; k++) {
        for (let j = 1; j <= IH; j++) {
          for (let i = 1; i <= IW; i++) {
            p[IX(i, j)] =
              (div[IX(i, j)] +
                p[IX(i - 1, j)] +
                p[IX(i + 1, j)] +
                p[IX(i, j - 1)] +
                p[IX(i, j + 1)]) /
              4
          }
        }
        setBnd(0, p)
      }
      for (let j = 1; j <= IH; j++) {
        for (let i = 1; i <= IW; i++) {
          uu[IX(i, j)] -= (0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)])) / h
          vv[IX(i, j)] -= (0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)])) / h
        }
      }
      setBnd(1, uu)
      setBnd(2, vv)
    }

    // Lay a soft gaussian dab of ink and a push into the source buffers.
    function splat(gx: number, gy: number, fx: number, fy: number, amt: number, radius: number) {
      const r2 = radius * radius
      const i0 = Math.max(1, Math.floor(gx - radius))
      const i1 = Math.min(IW, Math.ceil(gx + radius))
      const j0 = Math.max(1, Math.floor(gy - radius))
      const j1 = Math.min(IH, Math.ceil(gy + radius))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = i - gx
          const dy = j - gy
          const q = (dx * dx + dy * dy) / r2
          if (q > 1) continue
          const g = Math.exp(-q * 2.4)
          const id = IX(i, j)
          dens0[id] += amt * g
          u0[id] += fx * g
          v0[id] += fy * g
        }
      }
    }

    // One fixed-timestep step of the whole solver.
    function step() {
      // velocity: add the frame's forces, project, advect, project again.
      for (let k = 0; k < u.length; k++) {
        u[k] += DT * u0[k]
        v[k] += DT * v0[k]
      }
      project(u, v, u0, v0)
      u0.set(u)
      v0.set(v)
      advect(1, u, u0, u0, v0)
      advect(2, v, v0, u0, v0)
      project(u, v, u0, v0)
      // dye: add this frame's ink, carry it along the flow, and fade a touch.
      for (let k = 0; k < dens.length; k++) dens[k] += DT * dens0[k]
      dens0.set(dens)
      advect(0, dens, dens0, u, v)
      for (let k = 0; k < dens.length; k++) dens[k] *= FADE
      for (let k = 0; k < u.length; k++) {
        u[k] *= DAMP
        v[k] *= DAMP
      }
    }

    // Clear the per-frame source buffers, then fill them from the idle emitters
    // and the pointer.
    function inject() {
      u0.fill(0)
      v0.fill(0)
      dens0.fill(0)

      if (!reduce && !down) {
        // Two emitters tracing offset figure-eights, laying curling ink.
        const rad = Math.max(2.5, Math.min(IW, IH) * 0.05)
        for (let e = 0; e < 2; e++) {
          const ph = e * Math.PI
          const ex = IW * (0.5 + 0.32 * Math.sin(t * 0.6 + ph))
          const ey = IH * (0.5 + 0.28 * Math.sin(t * 0.9 + ph * 1.5))
          const fx = Math.cos(t * 0.6 + ph) * 1.4
          const fy = Math.cos(t * 0.9 + ph * 1.5) * 1.2
          splat(ex, ey, fx, fy, 26, rad)
        }
      }

      if (px >= 0) {
        const rad = Math.max(3, Math.min(IW, IH) * (down ? 0.14 : 0.06))
        const dx = ppx >= 0 ? px - ppx : 0
        const dy = ppy >= 0 ? py - ppy : 0
        const drag = 5.5
        splat(px, py, dx * drag, dy * drag, down ? 240 : 90, rad)
        ppx = px
        ppy = py
      }
    }

    // Paint the dye field: a black-to-accent-to-white-hot ramp, blitted up soft.
    function draw() {
      if (!img) return
      const data = img.data
      for (let j = 0; j < IH; j++) {
        for (let i = 0; i < IW; i++) {
          const d = dens[IX(i + 1, j + 1)]
          const s = 1 - Math.exp(-d * 2.1) // saturating brightness 0..1
          const core = Math.max(0, s - 0.72) * 3.6 // white-hot centre
          let r = ar * s
          let g = ag * s
          let b = ab * s
          r += (255 - r) * Math.min(1, core)
          g += (255 - g) * Math.min(1, core)
          b += (255 - b) * Math.min(1, core)
          const p = (i + j * IW) * 4
          data[p] = r
          data[p + 1] = g
          data[p + 2] = b
          data[p + 3] = 255
        }
      }
      bctx!.putImageData(img, 0, 0)
      ctx!.clearRect(0, 0, cssW, cssH)
      ctx!.drawImage(buf, 0, 0, IW, IH, 0, 0, cssW, cssH)
    }

    function toGrid(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect()
      px = 1 + ((clientX - rect.left) / rect.width) * IW
      py = 1 + ((clientY - rect.top) / rect.height) * IH
    }

    allocate()

    if (reduce) {
      // No loop: simmer a few drops and a swirl, then hold the settled ink.
      const seeds: [number, number, number, number][] = [
        [IW * 0.4, IH * 0.55, 3, -1],
        [IW * 0.62, IH * 0.42, -3, 1],
        [IW * 0.5, IH * 0.68, 0, -2.4],
      ]
      for (const [sx, sy, fx, fy] of seeds) splat(sx, sy, fx, fy, 180, Math.min(IW, IH) * 0.1)
      for (let k = 0; k < 46; k++) {
        step()
        u0.fill(0)
        v0.fill(0)
        dens0.fill(0)
      }
      draw()
      const ro = new ResizeObserver(() => {
        allocate()
        for (const [sx, sy, fx, fy] of seeds) splat(sx, sy, fx, fy, 180, Math.min(IW, IH) * 0.1)
        for (let k = 0; k < 46; k++) {
          step()
          u0.fill(0)
          v0.fill(0)
          dens0.fill(0)
        }
        draw()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away
      acc += dt
      // Fixed-timestep: run whole steps so the flow is monitor-independent.
      let guard = 0
      while (acc >= 1 / 60 && guard < 3) {
        t += 1 / 60
        inject()
        step()
        acc -= 1 / 60
        guard++
      }
      if (guard === 0) {
        // Slow display — still advance one step so it never stalls.
        t += 1 / 60
        inject()
        step()
        acc = 0
      }
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function onMove(e: PointerEvent) {
      toGrid(e.clientX, e.clientY)
    }
    function onDown(e: PointerEvent) {
      down = true
      toGrid(e.clientX, e.clientY)
      ppx = px
      ppy = py
      canvas!.setPointerCapture?.(e.pointerId)
    }
    function onUp() {
      down = false
    }
    function onLeave() {
      px = -1
      py = -1
      ppx = -1
      ppy = -1
      down = false
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => allocate())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full cursor-crosshair touch-none ${className}`}
    />
  )
}
