import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Life — Conway's Game of Life, rebuilt as a phosphor pointer field. Where the
// Ripple tank and Pendulum wave beside it are continuous physics, this is the
// most famous discrete system there is: a grid of cells that live or die each
// generation by four plain rules, and out of those rules come gliders, blinkers,
// and drifting soup that never repeats the same way twice.
//
//   • a live cell with 2 or 3 live neighbours survives            (S23)
//   • a dead cell with exactly 3 live neighbours is born          (B3)
//   • every other cell is dead next generation
//
// The board is a torus — the four edges wrap — so a glider that walks off the
// right side reappears on the left and keeps travelling forever, and nothing
// piles up against a wall. Drag the pointer and you paint living cells straight
// into the soup; press and you stamp a bright cluster and watch what it grows
// into. Left alone the board keeps itself alive: when the population thins out,
// a seeded blob of soup is dropped at a wandering point, and now and then a
// single glider is launched across the field.
//
// The look is a phosphor screen, not a checkerboard. Two fields ride the grid:
// `alive` (the honest 0/1 automaton) and `heat` (a decaying trail). A living
// cell pins its heat to full; when it dies the heat bleeds off over a few
// generations, so the board glows lime where life is and leaves cooling ghosts
// where it just was. The heat field is painted to a grid-sized offscreen buffer
// at one pixel per cell and the GPU smooths it up to full size, so live cells
// bloom into soft points of light and the hot loop touches ~10k cells, not a
// million pixels.
//
// No Date.now, no Math.random on the hot path: the initial soup and every idle
// drop are placed by a seeded PRNG, and generation timing is off the frame
// counter, so the field is stable across resizes and reduced-motion renders.
// Decorative, so aria-hidden. Under prefers-reduced-motion the loop never
// starts — a seeded board is stepped to a settled still and painted once.

const CELL = 9 // target px per grid cell before smoothing
const MAX_CELLS = 11000 // clamp the grid so the step stays cheap
const STEP_EVERY = 5 // frames between generations (~12 gen/s at 60fps)
const DECAY = 0.8 // per-generation heat bleed on dead cells → cooling trails
const IDLE_EVERY = 90 // frames between liveness checks when the board is thin
const MIN_FILL = 0.02 // reseed soup when the live fraction drops below this

// mulberry32 — a tiny deterministic PRNG so the soup and idle drops wander
// without Math.random on the hot path.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Life({
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
    // Offscreen grid-sized buffer: the heat field renders here at 1px/cell, then
    // the main canvas scales it up with smoothing on, so live cells bloom.
    const grid = document.createElement('canvas')
    const gctx = grid.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0 // grid columns
    let gh = 0 // grid rows
    let alive = new Uint8Array(0)
    let next = new Uint8Array(0)
    let heat = new Float32Array(0)
    let img: ImageData | null = null
    let raf = 0
    let frame = 0
    const rand = mulberry32(0x5eed11fe) // fixed seed → deterministic soup
    let idleX = 0.5
    let idleY = 0.5

    // Pointer trail: paint along the path between the last and current point so a
    // fast drag lays down continuous life, not a dotted line.
    let px = -1
    let py = -1
    let touching = false

    // Seed a disc of random live cells at grid (cx, cy). Density falls off toward
    // the rim so the blob reads as a soft cluster rather than a hard square.
    function seedBlob(cx: number, cy: number, r: number, density: number) {
      const r2 = r * r
      const x0 = Math.floor(cx - r)
      const x1 = Math.ceil(cx + r)
      const y0 = Math.floor(cy - r)
      const y1 = Math.ceil(cy + r)
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx
          const dy = y - cy
          const d2 = dx * dx + dy * dy
          if (d2 > r2) continue
          const gx = ((x % gw) + gw) % gw
          const gy = ((y % gh) + gh) % gh
          if (rand() < density * (1 - d2 / r2)) {
            const i = gy * gw + gx
            alive[i] = 1
            heat[i] = 1
          }
        }
      }
    }

    // Stamp a glider heading down-right at grid (cx, cy) so the idle board always
    // has something walking across it.
    function stampGlider(cx: number, cy: number) {
      const cells = [
        [1, 0],
        [2, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ]
      for (const [dx, dy] of cells) {
        const gx = ((Math.round(cx) + dx) % gw + gw) % gw
        const gy = ((Math.round(cy) + dy) % gh + gh) % gh
        const i = gy * gw + gx
        alive[i] = 1
        heat[i] = 1
      }
    }

    // Paint a small brush of life at canvas px (x, y).
    function brush(x: number, y: number, r: number) {
      const cx = (x / w) * gw
      const cy = (y / h) * gh
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const gx = ((Math.round(cx) + dx) % gw + gw) % gw
          const gy = ((Math.round(cy) + dy) % gh + gh) % gh
          const i = gy * gw + gx
          alive[i] = 1
          heat[i] = 1
        }
      }
    }

    // Paint along the segment from (ax,ay) to (bx,by) in canvas px.
    function brushLine(ax: number, ay: number, bx: number, by: number, r: number) {
      const dist = Math.hypot(bx - ax, by - ay)
      const steps = Math.max(1, Math.round((dist / w) * gw))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        brush(ax + (bx - ax) * t, ay + (by - ay) * t, r)
      }
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

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
      alive = new Uint8Array(gw * gh)
      next = new Uint8Array(gw * gh)
      heat = new Float32Array(gw * gh)
      img = gctx.createImageData(gw, gh)
    }

    // One generation of Conway's rules on a torus. Neighbours wrap at every edge,
    // so patterns travel forever and nothing collects against a wall.
    function step() {
      for (let y = 0; y < gh; y++) {
        const yUp = ((y - 1 + gh) % gh) * gw
        const yDn = ((y + 1) % gh) * gw
        const yMid = y * gw
        for (let x = 0; x < gw; x++) {
          const xl = (x - 1 + gw) % gw
          const xr = (x + 1) % gw
          const n =
            alive[yUp + xl] +
            alive[yUp + x] +
            alive[yUp + xr] +
            alive[yMid + xl] +
            alive[yMid + xr] +
            alive[yDn + xl] +
            alive[yDn + x] +
            alive[yDn + xr]
          const i = yMid + x
          const live = alive[i]
          // B3/S23: born on exactly 3, survives on 2 or 3.
          const nextLive = n === 3 || (live === 1 && n === 2) ? 1 : 0
          next[i] = nextLive
          if (nextLive) heat[i] = 1
          else heat[i] *= DECAY
        }
      }
      const tmp = alive
      alive = next
      next = tmp
    }

    function render() {
      const data = img!.data
      for (let i = 0; i < gw * gh; i++) {
        const e = heat[i]
        const p = i * 4
        if (e <= 0.003) {
          data[p + 3] = 0
          continue
        }
        // Live cells (heat pinned at 1) tip toward a white-hot core; cooling
        // ghosts glow pure lime and fade. A smoothstep keeps the trails soft.
        const s = e * e * (3 - 2 * e)
        const white = alive[i] ? 0.55 : e * e * e * 0.25
        data[p] = Math.min(255, ar * (0.35 + s * 0.75) + 255 * white)
        data[p + 1] = Math.min(255, ag * (0.35 + s * 0.75) + 255 * white)
        data[p + 2] = Math.min(255, ab * (0.35 + s * 0.75) + 255 * white)
        data[p + 3] = Math.round(Math.min(1, s * 1.15) * 255)
      }
      gctx.putImageData(img!, 0, 0)
      ctx!.imageSmoothingEnabled = true
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
    }

    function population() {
      let n = 0
      for (let i = 0; i < alive.length; i++) n += alive[i]
      return n
    }

    // Lay down an opening board: a couple of soup blobs plus a walking glider.
    function seedBoard() {
      seedBlob(gw * 0.32, gh * 0.4, Math.min(gw, gh) * 0.16, 0.5)
      seedBlob(gw * 0.68, gh * 0.62, Math.min(gw, gh) * 0.14, 0.5)
      stampGlider(gw * 0.12, gh * 0.12)
    }

    layout()
    seedBoard()

    if (reduce) {
      // A settled still: step the seeded board a few dozen generations so the
      // soup resolves into still-lifes and oscillators, then paint it once.
      for (let s = 0; s < 48; s++) step()
      render()
      const ro = new ResizeObserver(() => {
        layout()
        seedBoard()
        for (let s = 0; s < 48; s++) step()
        render()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function tick() {
      frame++
      // Advance the automaton on a slow interval so generations are watchable;
      // render every frame so the heat trails decay smoothly in between.
      if (frame % STEP_EVERY === 0) step()

      // Idle life: keep the board from dying out. On a slow interval, if the
      // population has thinned, drop a fresh blob at a wandering point; every so
      // often launch a glider regardless so something is always travelling.
      if (!touching && frame % IDLE_EVERY === 0) {
        if (population() < gw * gh * MIN_FILL) {
          idleX = 0.15 + rand() * 0.7
          idleY = 0.15 + rand() * 0.7
          seedBlob(gw * idleX, gh * idleY, Math.min(gw, gh) * 0.13, 0.5)
        } else if (frame % (IDLE_EVERY * 6) === 0) {
          stampGlider(gw * (0.05 + rand() * 0.1), gh * (0.05 + rand() * 0.1))
        }
      }

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
      if (px >= 0) brushLine(px, py, x, y, touching ? 2 : 1)
      px = x
      py = y
    }
    function onDown(e: PointerEvent) {
      const { x, y } = toLocal(e)
      touching = true
      px = x
      py = y
      brush(x, y, 3)
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
