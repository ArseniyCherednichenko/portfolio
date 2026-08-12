import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A ripple tank — a real shallow-water surface solved on a grid. Where the
// Pendulum wave beside it is one row of oscillators timed into a travelling
// wave, this is the two-dimensional case: a field where a disturbance spreads
// as a widening ring, meets the tank walls, bounces, and interferes with every
// other ring in flight. Drag the pointer and you draw a wake; press and you
// drop a stone. Left alone it keeps a slow deterministic drip going so the
// surface is never dead.
//
// The physics is the honest 2D wave equation, discretised with the five-point
// Laplacian:
//
//   next = 2·cur − prev + c²·(∇²cur),   ∇²cur = Σ neighbours − 4·cur
//
// on two height buffers that leapfrog each frame. c² is held at 0.28 — safely
// under the 0.5 stability ceiling for this stencil — and a hair of damping per
// step lets old rings fade so the tank settles between drops. The edges are
// held fixed, so waves reflect off the walls the way they do in a real tank;
// that is where the interference lattice comes from. The height field is shaded
// by its own slope (a fake grazing light) into lime caustics, painted once to a
// grid-sized offscreen buffer and let the GPU smooth it up to full size — so
// the hot loop touches ~10k cells, not a million pixels.
//
// No Date.now, no Math.random on the hot path: idle drips are timed off the
// frame counter and placed by a seeded PRNG, so the whole thing is stable
// across resizes and reduced-motion renders. Decorative, so aria-hidden. Under
// prefers-reduced-motion the loop never starts — a few drops are stepped to a
// frozen interference pattern and painted in a single still frame.

const CELL = 7 // target px per grid cell before smoothing
const MAX_CELLS = 12000 // clamp the grid so the solver stays cheap
const C2 = 0.28 // wave speed² (Courant term); must stay < 0.5 for this stencil
const DAMP = 0.995 // per-step energy loss so rings fade and the tank settles
const SPONGE = 8 // cells of absorbing margin at the walls (a soft boundary)
const SPONGE_MIN = 0.9 // damping at the very edge — soaks reflections so the tank stays calm
const IDLE_EVERY = 78 // frames between automatic drips when nothing is touched

// mulberry32 — a tiny deterministic PRNG so idle drips wander without Math.random.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function RippleTank({
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

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Offscreen grid-sized buffer: the sim renders here at 1px/cell, then the
    // main canvas scales it up with smoothing on, giving free interpolation.
    const grid = document.createElement('canvas')
    const gctx = grid.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0 // grid columns
    let gh = 0 // grid rows
    let cur = new Float32Array(0)
    let prev = new Float32Array(0)
    let next = new Float32Array(0)
    let damp = new Float32Array(0) // per-cell damping — a sponge layer at the walls
    let img: ImageData | null = null
    let raf = 0
    let frame = 0
    const rand = mulberry32(0x1a2b3c) // fixed seed → deterministic idle drips
    let idleX = 0.5
    let idleY = 0.5

    // Pointer trail: we drop along the path between the last and current point
    // so a fast drag still draws a continuous wake, not a dotted line.
    let px = -1
    let py = -1
    let touching = false

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Size the grid to CELL px, then scale both dims down together if the
      // cell budget is blown, so a wide card never explodes the solver.
      let cols = Math.max(24, Math.round(w / CELL))
      let rows = Math.max(24, Math.round(h / CELL))
      if (cols * rows > MAX_CELLS) {
        const s = Math.sqrt(MAX_CELLS / (cols * rows))
        cols = Math.max(24, Math.round(cols * s))
        rows = Math.max(24, Math.round(rows * s))
      }
      gw = cols
      gh = rows
      grid.width = gw
      grid.height = gh
      cur = new Float32Array(gw * gh)
      prev = new Float32Array(gw * gh)
      next = new Float32Array(gw * gh)
      // Damping field: DAMP across the interior, ramping down to SPONGE_MIN
      // within SPONGE cells of any wall. That soft absorbing margin soaks most
      // of the reflected energy, so rings fade near the walls instead of bouncing
      // back into a saturated standing plaid — the tank reads as expanding rings
      // that meet and settle, not a strobing lattice.
      damp = new Float32Array(gw * gh)
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const edge = Math.min(x, y, gw - 1 - x, gh - 1 - y)
          let d = DAMP
          if (edge < SPONGE) {
            const t = edge / SPONGE // 0 at the wall, 1 at the sponge's inner edge
            d = SPONGE_MIN + (DAMP - SPONGE_MIN) * (t * t)
          }
          damp[y * gw + x] = d
        }
      }
      img = gctx.createImageData(gw, gh)
    }

    // Drop a smooth bump into both buffers at grid cell (cx, cy). Adding to cur
    // and prev equally starts the disturbance at rest, so it expands as a clean
    // symmetric ring rather than lurching to one side.
    function drop(cx: number, cy: number, amp: number, r: number) {
      const r2 = r * r
      const x0 = Math.max(1, Math.floor(cx - r))
      const x1 = Math.min(gw - 2, Math.ceil(cx + r))
      const y0 = Math.max(1, Math.floor(cy - r))
      const y1 = Math.min(gh - 2, Math.ceil(cy + r))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx
          const dy = y - cy
          const d2 = dx * dx + dy * dy
          if (d2 > r2) continue
          // A raised cosine bump — soft edges make a rounder ring than a spike.
          const f = 0.5 + 0.5 * Math.cos((Math.sqrt(d2) / r) * Math.PI)
          const v = amp * f
          const i = y * gw + x
          cur[i] += v
          prev[i] += v
        }
      }
    }

    // Drop along the segment from (ax,ay) to (bx,by) in canvas px, so a drag
    // lays down a continuous wake.
    function dropLine(ax: number, ay: number, bx: number, by: number, amp: number) {
      const gax = (ax / w) * gw
      const gay = (ay / h) * gh
      const gbx = (bx / w) * gw
      const gby = (by / h) * gh
      const dist = Math.hypot(gbx - gax, gby - gay)
      const steps = Math.max(1, Math.round(dist / 1.5))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        drop(gax + (gbx - gax) * t, gay + (gby - gay) * t, amp, 2.2)
      }
    }

    function step() {
      // Leapfrog the wave equation over the interior; edges stay fixed at 0 so
      // waves reflect off the tank walls.
      for (let y = 1; y < gh - 1; y++) {
        const row = y * gw
        for (let x = 1; x < gw - 1; x++) {
          const i = row + x
          const lap = cur[i - 1] + cur[i + 1] + cur[i - gw] + cur[i + gw] - 4 * cur[i]
          next[i] = (2 * cur[i] - prev[i] + C2 * lap) * damp[i]
        }
      }
      // Rotate buffers: prev <- cur <- next, reusing prev as the new scratch.
      const tmp = prev
      prev = cur
      cur = next
      next = tmp
    }

    function render() {
      const data = img!.data
      for (let y = 0; y < gh; y++) {
        const row = y * gw
        for (let x = 0; x < gw; x++) {
          const i = row + x
          const hgt = cur[i]
          // Slope-based grazing light: the horizontal + vertical derivatives
          // stand in for a surface normal lit from the upper-left, which is what
          // turns a flat height field into caustics.
          const sx = x > 0 && x < gw - 1 ? cur[i + 1] - cur[i - 1] : 0
          const sy = y > 0 && y < gh - 1 ? cur[i + gw] - cur[i - gw] : 0
          const spec = (sx + sy) * 2.6
          let e = hgt * 3.4 + spec
          if (e < 0) e = 0
          else if (e > 1) e = 1
          // A soft toe keeps the dark water dark and lets the caustics bloom in
          // the upper range, so the field reads as light on water, not a flat map.
          e = e * e * (3 - 2 * e) // smoothstep
          const lime = 0.045 + e * 0.9
          const p = i * 4
          // Only the brightest ridges tip toward white, and gently, so crests
          // sparkle without the whole surface blowing out.
          const white = e * e * e * 0.4
          data[p] = Math.min(255, ar * lime + 255 * white)
          data[p + 1] = Math.min(255, ag * lime + 255 * white)
          data[p + 2] = Math.min(255, ab * lime + 255 * white)
          data[p + 3] = 255
        }
      }
      gctx.putImageData(img!, 0, 0)
      ctx!.imageSmoothingEnabled = true
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
    }

    layout()

    if (reduce) {
      // A frozen interference pattern: a handful of fixed drops stepped to a
      // settled lattice, painted once. No loop, no motion.
      drop(gw * 0.3, gh * 0.4, 3.2, 3)
      drop(gw * 0.68, gh * 0.35, 3.0, 3)
      drop(gw * 0.5, gh * 0.72, 2.6, 3)
      for (let s = 0; s < 90; s++) step()
      render()
      const ro = new ResizeObserver(() => {
        layout()
        drop(gw * 0.3, gh * 0.4, 3.2, 3)
        drop(gw * 0.68, gh * 0.35, 3.0, 3)
        drop(gw * 0.5, gh * 0.72, 2.6, 3)
        for (let s = 0; s < 90; s++) step()
        render()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function tick() {
      frame++
      // Idle life: when nothing is being touched, drip on a slow interval at a
      // wandering point so the tank keeps breathing on its own.
      if (!touching && frame % IDLE_EVERY === 0) {
        if (frame % (IDLE_EVERY * 3) === 0) {
          idleX = 0.15 + rand() * 0.7
          idleY = 0.15 + rand() * 0.7
        }
        drop(gw * idleX, gh * idleY, 2.4, 2.6)
      }
      // Two solver sub-steps per frame keep the wave speed lively without
      // pushing C2 near the stability edge.
      step()
      step()
      render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function toLocal(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function onMove(e: PointerEvent) {
      const { x, y } = toLocal(e)
      if (px >= 0) dropLine(px, py, x, y, touching ? 1.1 : 0.55)
      px = x
      py = y
    }
    function onDown(e: PointerEvent) {
      const { x, y } = toLocal(e)
      touching = true
      px = x
      py = y
      drop((x / w) * gw, (y / h) * gh, 3.4, 3)
    }
    function onUp() {
      touching = false
    }
    function onLeave() {
      px = -1
      py = -1
      touching = false
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => layout())
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
      className={`h-full w-full cursor-pointer touch-none ${className}`}
    />
  )
}
