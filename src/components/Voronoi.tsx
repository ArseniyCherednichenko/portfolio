import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Voronoi — a living tessellation, rebuilt as a pointer field. Scatter a set of
// points across a plane and the plane divides itself: every location belongs to
// whichever point is nearest, and the borders between those territories are the
// Voronoi diagram. It is the geometry behind how cells pack, how cracks run, how
// a phone finds its closest tower — one of those structures that shows up
// everywhere once you know its shape.
//
// The cells here are alive. Each site drifts on its own slow heading and bounces
// off the four walls, so the borders breathe and re-knit without ever tearing.
// The pointer is a site too: move it and a cell forms around your cursor, shoving
// its neighbours aside as it travels; press to drop a fresh seed and watch the
// tessellation re-partition around the new point.
//
// The look is glowing seams on black, not filled polygons. The trick is to skip
// the polygons entirely and read the distance field: for every point on a
// coarse grid, measure the distance to the nearest site AND to the second
// nearest. Deep inside a cell those two distances are very different; exactly on
// a border they are equal. So (d2 - d1) is a signed distance to the nearest
// Voronoi edge — smoothstep it and the borders light up as clean lime seams with
// no polygon clipping, no aliasing, and a soft core glow at each site where d1
// falls to zero. The field is painted to a grid-sized offscreen buffer at one
// pixel per cell and the GPU smooths it up to full size, so the hot loop touches
// ~12k cells against ~30 sites, not a million pixels.
//
// No Date.now and no Math.random on the hot path: every site's heading is fixed
// by a seeded PRNG at layout, so the drift is stable across resizes and the
// reduced-motion still is deterministic. Decorative, so aria-hidden. Under
// prefers-reduced-motion nothing moves — a seeded arrangement is painted once.

const CELL = 7 // target px per grid cell before smoothing
const MAX_CELLS = 14000 // clamp the buffer so the two-nearest pass stays cheap
const EDGE = 1.35 // seam half-width, in buffer cells — how fat the borders glow
const CORE = 2.6 // site core radius, in buffer cells — the bright dot at a seed
const DRIFT = 0.05 // site speed, buffer cells per frame
const MAX_SITES = 30 // hard cap so the inner loop never blows up
const SITES_PER_MP = 22 // site density: seeds per megapixel of canvas

// mulberry32 — a tiny deterministic PRNG so the seeds and their headings wander
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

export function Voronoi({
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
    // Offscreen grid-sized buffer: the distance field renders here at 1px/cell,
    // then the main canvas scales it up with smoothing on, so the seams bloom.
    const grid = document.createElement('canvas')
    const gctx = grid.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0 // buffer columns
    let gh = 0 // buffer rows
    let img: ImageData | null = null
    let raf = 0

    // Sites are held in buffer coordinates. `sb` is a per-site brightness so the
    // seeds and their cell interiors vary a touch and the field reads with depth
    // instead of a flat lattice. The pointer, when present, is the last site.
    let sx = new Float32Array(0)
    let sy = new Float32Array(0)
    let vx = new Float32Array(0)
    let vy = new Float32Array(0)
    let sb = new Float32Array(0)
    let count = 0 // active drifting sites (excludes the pointer)

    const rand = mulberry32(0x900d5eed) // fixed seed → deterministic scatter

    // Pointer state, in buffer coordinates. When `pointer` is on, an extra site
    // rides at (mx,my); its weight is boosted a little so its cell reads as yours.
    let mx = 0
    let my = 0
    let pointer = false

    function seedSites() {
      const px = w * h
      let n = Math.round((px / 1_000_000) * SITES_PER_MP)
      n = Math.max(8, Math.min(MAX_SITES - 1, n)) // leave one slot for the pointer
      const cap = MAX_SITES
      sx = new Float32Array(cap)
      sy = new Float32Array(cap)
      vx = new Float32Array(cap)
      vy = new Float32Array(cap)
      sb = new Float32Array(cap)
      count = n
      for (let i = 0; i < n; i++) {
        sx[i] = rand() * gw
        sy[i] = rand() * gh
        const a = rand() * Math.PI * 2
        vx[i] = Math.cos(a) * DRIFT
        vy[i] = Math.sin(a) * DRIFT
        sb[i] = 0.45 + rand() * 0.55
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
      img = gctx.createImageData(gw, gh)
      seedSites()
    }

    // Advance every drifting site by its heading and bounce it off the walls, so
    // the tessellation keeps moving but the seeds never wander off the plane.
    function move() {
      for (let i = 0; i < count; i++) {
        sx[i] += vx[i]
        sy[i] += vy[i]
        if (sx[i] < 0) {
          sx[i] = -sx[i]
          vx[i] = -vx[i]
        } else if (sx[i] > gw) {
          sx[i] = 2 * gw - sx[i]
          vx[i] = -vx[i]
        }
        if (sy[i] < 0) {
          sy[i] = -sy[i]
          vy[i] = -vy[i]
        } else if (sy[i] > gh) {
          sy[i] = 2 * gh - sy[i]
          vy[i] = -vy[i]
        }
      }
    }

    // Paint the distance field. For each buffer cell we track the nearest and
    // second-nearest site; (d2 - d1) is distance to the nearest Voronoi seam, and
    // d1 gives the core glow. Everything stays lime; only brightness carries the
    // structure, so it sits inside the site's single-hue rule.
    function render() {
      const data = img!.data
      const n = pointer ? count + 1 : count
      if (pointer) {
        sx[count] = mx
        sy[count] = my
        sb[count] = 1
      }
      for (let gy = 0; gy < gh; gy++) {
        const rowBase = gy * gw
        for (let gx = 0; gx < gw; gx++) {
          let d1 = 1e9
          let d2 = 1e9
          let near = 0
          for (let k = 0; k < n; k++) {
            const dx = gx - sx[k]
            const dy = gy - sy[k]
            // Weight the pointer's cell so it pushes a touch past its neighbours.
            const wgt = pointer && k === count ? 0.82 : 1
            const d = (dx * dx + dy * dy) * wgt
            if (d < d1) {
              d2 = d1
              d1 = d
              near = k
            } else if (d < d2) {
              d2 = d
            }
          }
          const s1 = Math.sqrt(d1)
          const s2 = Math.sqrt(d2)
          // Seam: bright where the two nearest distances are equal (on a border),
          // dark inside a cell. A smoothstep keeps the line soft, not aliased.
          const t = Math.min(1, Math.max(0, (s2 - s1) / EDGE))
          const seam = 1 - t * t * (3 - 2 * t)
          // Core: a soft dot of light at each seed, falling off within CORE cells.
          const core = s1 < CORE ? (1 - s1 / CORE) * (1 - s1 / CORE) : 0
          const bright = sb[near]
          // Faint interior wash so cells aren't pure black; seams and cores lift.
          const wash = 0.05 * bright
          let e = wash + seam * (0.5 + 0.45 * bright) + core * 0.9 * bright
          if (e <= 0.004) {
            data[(rowBase + gx) * 4 + 3] = 0
            continue
          }
          if (e > 1) e = 1
          // Lime, tipping toward white-hot at the brightest points (seam crossings
          // and seed cores) so intersections read as sparks.
          const white = e > 0.7 ? (e - 0.7) / 0.3 : 0
          const wl = white * white * 0.6
          const p = (rowBase + gx) * 4
          data[p] = Math.min(255, ar * (0.3 + e * 0.7) + 255 * wl)
          data[p + 1] = Math.min(255, ag * (0.3 + e * 0.7) + 255 * wl)
          data[p + 2] = Math.min(255, ab * (0.3 + e * 0.7) + 255 * wl)
          data[p + 3] = Math.round(Math.min(1, e * 1.1) * 255)
        }
      }
      gctx.putImageData(img!, 0, 0)
      ctx!.imageSmoothingEnabled = true
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
    }

    layout()

    if (reduce) {
      // A still tessellation: seeded scatter, painted once, no drift.
      render()
      const ro = new ResizeObserver(() => {
        layout()
        render()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function tick() {
      move()
      render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function toBuffer(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return {
        x: ((e.clientX - rect.left) / rect.width) * gw,
        y: ((e.clientY - rect.top) / rect.height) * gh,
      }
    }
    function onMove(e: PointerEvent) {
      const { x, y } = toBuffer(e)
      mx = x
      my = y
      pointer = true
    }
    // Press drops a fresh drifting seed at the pointer, recycling the oldest once
    // the cap is reached, so the tessellation re-partitions under your hand.
    function onDown(e: PointerEvent) {
      const { x, y } = toBuffer(e)
      const i = count < MAX_SITES - 1 ? count++ : (count % (MAX_SITES - 1))
      sx[i] = x
      sy[i] = y
      const a = rand() * Math.PI * 2
      vx[i] = Math.cos(a) * DRIFT
      vy[i] = Math.sin(a) * DRIFT
      sb[i] = 0.6 + rand() * 0.4
    }
    function onLeave() {
      pointer = false
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
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
