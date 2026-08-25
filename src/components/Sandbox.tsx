import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Sandbox — a falling-sand cellular automaton, the granular cousin of the
// Game of Life beside it. Where Life is discrete cells flicking on and off by
// four rules, this is matter with weight: a grid where every cell is empty,
// sand, water, or wall, and each frame every grain tries to fall. There is no
// physics engine here and no forces — just four local rules run bottom-up over
// the grid, and out of them fall real piles, real pours, and real flow.
//
//   • sand falls straight down; if blocked it slides down-left or down-right,
//     so it heaps into a slope and finds its angle of repose
//   • sand is denser than water, so it sinks through it — a grain over water
//     swaps places with the drop beneath it
//   • water falls the same way, but if it cannot fall it also spreads sideways,
//     so it always seeks its own level and pools flat
//   • wall never moves — it is the one solid the flow has to go around
//
// The field never sits still: two emitters at the top drip sand and water, and
// a drain at the bottom centre pulls the pile down through it, so material
// pours, heaps, and streams out the middle in a slow closed loop. Drag the
// pointer and you paint walls straight into the flow — build a ledge and the
// pour splits around it, funnel it and the stream narrows and speeds up, dam
// the drain and the basin floods and finds its level. Every wall you draw
// re-routes what is already falling, live.
//
// The look is deliberately not smoothed: crisp grains, one pixel per cell,
// scaled up with smoothing off so it reads as pixel sand rather than a blur.
// Each grain carries a fixed shade set when it is born, so a pour has grain and
// a pool has depth instead of one flat colour. The hot loop touches the grid
// once per frame — a few tens of thousands of cells, plain integer branches,
// no allocation — and paints a grid-sized buffer the GPU blows up to full size.
//
// No Date.now, no Math.random on the hot path: a seeded PRNG breaks every tie
// (which way a grain slides, where a shade lands), so the field is stable
// across resizes and reduced-motion renders. Decorative, so aria-hidden. Under
// prefers-reduced-motion the loop never starts — a seeded fill is settled to a
// still heap and painted once.

const CELL = 6 // target px per grid cell before the buffer is scaled up
const MAX_CELLS = 26000 // clamp the grid so the bottom-up sweep stays cheap
const DRAIN_FRAC = 0.16 // width of the bottom drain, as a fraction of the grid
const EMIT_EVERY = 2 // frames between emitter drips
const EMIT_R = 2 // radius of each emitter mouth in cells

// Cell kinds. Packed one byte per cell.
const EMPTY = 0
const SAND = 1
const WATER = 2
const WALL = 3

// mulberry32 — a tiny deterministic PRNG so grains break ties and pick shades
// without touching Math.random on the hot path.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Sandbox({
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
    // Water rides a cooler teal so the two materials never read as one; walls
    // are a neutral graphite that sits back behind the lit grains.
    const wr = 96
    const wg = 202
    const wb = 214

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Offscreen grid-sized buffer: grains render here at 1px/cell, then the main
    // canvas scales it up with smoothing OFF, so the sand stays crisp.
    const grid = document.createElement('canvas')
    const gctx = grid.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0 // grid columns
    let gh = 0 // grid rows
    let cell = new Uint8Array(0) // kind per cell
    let shade = new Float32Array(0) // fixed per-grain brightness, 0.62..1
    let moved = new Uint8Array(0) // per-frame guard so a grain hops once
    let img: ImageData | null = null
    let raf = 0
    let frame = 0
    const rand = mulberry32(0x5a11d0c5) // fixed seed → deterministic field

    // Pointer state: paint walls along the drag path.
    let px = -1
    let py = -1
    let painting = false

    function idx(x: number, y: number) {
      return y * gw + x
    }

    // Drop a grain of `kind` at (x,y) if the cell is empty, giving it a seeded
    // shade so pours have grain and pools have depth.
    function place(x: number, y: number, kind: number) {
      if (x < 0 || x >= gw || y < 0 || y >= gh) return
      const i = idx(x, y)
      if (cell[i] !== EMPTY) return
      cell[i] = kind
      shade[i] = 0.62 + rand() * 0.38
    }

    // Paint a disc of walls at grid (cx, cy) — the pointer's brush. Walls
    // overwrite anything, so you can carve a barrier straight through a pour.
    function paintWall(cx: number, cy: number, r: number) {
      const r2 = r * r
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue
          const x = Math.round(cx) + dx
          const y = Math.round(cy) + dy
          if (x < 0 || x >= gw || y < 0 || y >= gh) continue
          const i = idx(x, y)
          cell[i] = WALL
          shade[i] = 0.5 + rand() * 0.18
        }
      }
    }

    // Paint walls along the segment from (ax,ay) to (bx,by) in canvas px, so a
    // fast drag lays a continuous ledge and not a dotted line.
    function paintLine(ax: number, ay: number, bx: number, by: number) {
      const acx = (ax / w) * gw
      const acy = (ay / h) * gh
      const bcx = (bx / w) * gw
      const bcy = (by / h) * gh
      const dist = Math.hypot(bcx - acx, bcy - acy)
      const steps = Math.max(1, Math.round(dist))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        paintWall(acx + (bcx - acx) * t, acy + (bcy - acy) * t, 2)
      }
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      let cols = Math.max(48, Math.round(w / CELL))
      let rows = Math.max(48, Math.round(h / CELL))
      if (cols * rows > MAX_CELLS) {
        const s = Math.sqrt(MAX_CELLS / (cols * rows))
        cols = Math.max(48, Math.round(cols * s))
        rows = Math.max(48, Math.round(rows * s))
      }
      gw = cols
      gh = rows
      grid.width = gw
      grid.height = gh
      cell = new Uint8Array(gw * gh)
      shade = new Float32Array(gw * gh)
      moved = new Uint8Array(gw * gh)
      img = gctx.createImageData(gw, gh)
    }

    // The two emitter mouths and the drain, in grid coordinates. Kept as
    // fractions so they survive a resize.
    function sandX() {
      return Math.round(gw * 0.34)
    }
    function waterX() {
      return Math.round(gw * 0.66)
    }
    function drainLo() {
      return Math.round(gw * (0.5 - DRAIN_FRAC / 2))
    }
    function drainHi() {
      return Math.round(gw * (0.5 + DRAIN_FRAC / 2))
    }

    // Drip both emitters: a small mouth of grains at the top, only where there
    // is room, so a backed-up emitter simply stops rather than overflowing.
    function emit() {
      const sx = sandX()
      const wx = waterX()
      for (let dx = -EMIT_R; dx <= EMIT_R; dx++) {
        if (rand() < 0.7) place(sx + dx, 1, SAND)
        if (rand() < 0.7) place(wx + dx, 1, WATER)
      }
    }

    // Open the drain: clear the bottom row across the drain mouth so the pile
    // streams out the middle and the loop never clogs. Walls the user painted
    // over the drain are left alone, so you really can dam it.
    function drain() {
      const lo = drainLo()
      const hi = drainHi()
      const y = gh - 1
      for (let x = lo; x <= hi; x++) {
        const i = idx(x, y)
        if (cell[i] === SAND || cell[i] === WATER) {
          cell[i] = EMPTY
        }
      }
    }

    // One frame of the automaton. Sweep bottom-up so a grain that falls is not
    // re-processed on the same frame; alternate the horizontal scan direction
    // by frame parity so neither side of a heap is favoured.
    function step() {
      moved.fill(0)
      const flip = (frame & 1) === 1
      for (let y = gh - 2; y >= 0; y--) {
        for (let k = 0; k < gw; k++) {
          const x = flip ? gw - 1 - k : k
          const i = idx(x, y)
          const kind = cell[i]
          if (kind === EMPTY || kind === WALL || moved[i]) continue

          const below = i + gw
          const bkind = cell[below]

          // Straight down into empty space.
          if (bkind === EMPTY) {
            cell[below] = kind
            shade[below] = shade[i]
            cell[i] = EMPTY
            moved[below] = 1
            continue
          }

          // Sand is denser than water: it sinks, swapping with the drop below.
          if (kind === SAND && bkind === WATER && !moved[below]) {
            cell[below] = SAND
            const s = shade[below]
            shade[below] = shade[i]
            cell[i] = WATER
            shade[i] = s
            moved[below] = 1
            moved[i] = 1
            continue
          }

          // Blocked straight down: try the two diagonals, order chosen by a
          // seeded coin so a symmetric pile does not lean.
          const dir = rand() < 0.5 ? -1 : 1
          let slid = false
          for (let t = 0; t < 2 && !slid; t++) {
            const dx = t === 0 ? dir : -dir
            const nx = x + dx
            if (nx < 0 || nx >= gw) continue
            const dl = idx(nx, y + 1)
            const dkind = cell[dl]
            if (dkind === EMPTY) {
              cell[dl] = kind
              shade[dl] = shade[i]
              cell[i] = EMPTY
              moved[dl] = 1
              slid = true
            } else if (kind === SAND && dkind === WATER && !moved[dl]) {
              cell[dl] = SAND
              const s = shade[dl]
              shade[dl] = shade[i]
              cell[i] = WATER
              shade[i] = s
              moved[dl] = 1
              moved[i] = 1
              slid = true
            }
          }
          if (slid) continue

          // Water that cannot fall spreads sideways to seek its own level.
          if (kind === WATER) {
            const nx = x + dir
            const nx2 = x - dir
            if (nx >= 0 && nx < gw && cell[idx(nx, y)] === EMPTY) {
              const s = idx(nx, y)
              cell[s] = WATER
              shade[s] = shade[i]
              cell[i] = EMPTY
              moved[s] = 1
            } else if (nx2 >= 0 && nx2 < gw && cell[idx(nx2, y)] === EMPTY) {
              const s = idx(nx2, y)
              cell[s] = WATER
              shade[s] = shade[i]
              cell[i] = EMPTY
              moved[s] = 1
            }
          }
        }
      }
    }

    function render() {
      const data = img!.data
      const n = gw * gh
      for (let i = 0; i < n; i++) {
        const kind = cell[i]
        const p = i * 4
        if (kind === EMPTY) {
          data[p + 3] = 0
          continue
        }
        const s = shade[i]
        if (kind === SAND) {
          data[p] = Math.min(255, ar * s)
          data[p + 1] = Math.min(255, ag * s)
          data[p + 2] = Math.min(255, ab * s)
          data[p + 3] = 255
        } else if (kind === WATER) {
          data[p] = Math.min(255, wr * s)
          data[p + 1] = Math.min(255, wg * s)
          data[p + 2] = Math.min(255, wb * s)
          data[p + 3] = 205 // a touch translucent so pools read as liquid
        } else {
          // Wall: neutral graphite, sitting back behind the lit grains.
          const g = 78 * s + 34
          data[p] = g
          data[p + 1] = g + 3
          data[p + 2] = g + 8
          data[p + 3] = 255
        }
      }
      gctx.putImageData(img!, 0, 0)
      ctx!.imageSmoothingEnabled = false // crisp grains, not a blur
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
    }

    // Settle the field by running the emitter/step/drain loop off-screen for a
    // fixed number of iterations — used to reach an opening state and to build
    // the reduced-motion still.
    function settle(iterations: number) {
      for (let s = 0; s < iterations; s++) {
        if (s % EMIT_EVERY === 0) emit()
        step()
        drain()
      }
    }

    layout()

    if (reduce) {
      // A settled still: pour a while into a fixed field, then paint it once.
      settle(420)
      render()
      const ro = new ResizeObserver(() => {
        layout()
        settle(420)
        render()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Open on a partly-poured field so there is matter on screen immediately.
    settle(160)

    function tick() {
      frame++
      if (frame % EMIT_EVERY === 0) emit()
      step()
      drain()
      render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function toLocal(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function onMove(e: PointerEvent) {
      if (!painting) return
      const { x, y } = toLocal(e)
      if (px >= 0) paintLine(px, py, x, y)
      else paintWall((x / w) * gw, (y / h) * gh, 2)
      px = x
      py = y
    }
    function onDown(e: PointerEvent) {
      const { x, y } = toLocal(e)
      painting = true
      px = x
      py = y
      paintWall((x / w) * gw, (y / h) * gh, 2)
      canvas!.setPointerCapture?.(e.pointerId)
    }
    function onUp() {
      painting = false
      px = -1
      py = -1
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onUp)

    const ro = new ResizeObserver(() => {
      layout()
      settle(160)
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onUp)
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
