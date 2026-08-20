import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Aggregate — a frost crystal that grows itself out of pure chance, one particle
// at a time. It runs Diffusion-Limited Aggregation live, and, like the Slime
// mesh and the self-carving Maze it sits beside, the whole point is to watch a
// structure with no blueprint assemble itself:
//
//   1. A SEED is frozen in place — a single stuck cell (or a few, wherever you
//      press).
//
//   2. WALKERS drift. Each is a particle doing a pure random walk — one cell in
//      a random direction every step, a drunkard staggering across the field
//      with no idea the crystal exists.
//
//   3. STICK. The instant a walker stumbles up against anything already frozen,
//      it freezes too, right where it stands, and a fresh walker is launched to
//      wander in after it.
//
// That is the entire rule, and out of it comes the branching, fern-like, six-of-
// nothing lace of a real frost crystal — because a walker approaching the cluster
// is overwhelmingly likely to brush a tip long before it can drift into a
// sheltered inner bay. The tips catch everything; the crevices starve. Growth is
// its own shield, so the thing reaches outward in fingers rather than filling in,
// and the fractal (dimension ≈ 1.7, never a solid disc) falls straight out of the
// randomness with nothing shaped by hand.
//
// Each cell is tinted by *when* it froze, so the crystal reads as growth rings:
// a deep teal core out to a lime growth front, the live walkers drawn as a faint
// drifting haze around it — the diffusion you can actually see. When the frost
// reaches the edges it holds, dissolves, and a new seed starts over. Press or
// drag to freeze a new nucleus under the pointer and watch a second crystal race
// the first for the open field.
//
// One 2D canvas. Occupancy is a single Uint8Array; the crystal is accumulated
// straight into one ImageData that persists between frames (a freeze writes four
// bytes, never a full repaint), then blitted up soft for the glow. No Math.random
// anywhere: a fixed integer hash indexed by a running counter places every step
// and every launch, so the same lace grows every load and it stays stable across
// resizes. Decorative, so aria-hidden. Under prefers-reduced-motion the loop
// never runs — one crystal is grown to completion in a single synchronous pass,
// painted once, and held still.

const CELL_PX = 3 // one occupancy cell per this many CSS px (coarser = faster)
const MAX_GW = 300 // cap the grid so the per-step neighbour scan stays cheap
const WALK_DENSITY = 0.011 // concurrent walkers per cell
const MAX_WALKERS = 620
const STEPS_PER_FRAME = 7 // random-walk steps each walker takes per frame
const MARGIN = 6 // cells of slack around the cluster the walkers may roam
const HOLD = 150 // frames the finished crystal holds before it dissolves
const FADE = 44 // frames of dissolve into the next crystal
const TAU = Math.PI * 2

// A fast, deterministic integer hash → a number in [0, 1). Stands in for a PRNG
// so every walk step and launch is fixed by a running counter, never rolled at
// runtime — the same crystal grows every load.
function hash(n: number): number {
  let x = n | 0
  x = (x ^ 61) ^ (x >>> 16)
  x = x + (x << 3)
  x = x ^ (x >>> 4)
  x = Math.imul(x, 0x27d4eb2d)
  x = x ^ (x >>> 15)
  return (x >>> 0) / 4294967296
}

export function Aggregate({
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

    // The offscreen holds the crystal at grid resolution; the main canvas blits
    // it up soft, which is what gives the frost its glow.
    const off = document.createElement('canvas')
    const octx = off.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0
    let gh = 0
    let occ = new Uint8Array(0) // 1 where a cell is frozen
    let img: ImageData | null = null // persistent crystal pixels

    // Walker state — grid positions and a per-walker age, so a walker that never
    // finds the cluster is recycled rather than roaming forever.
    let wx = new Int32Array(0)
    let wy = new Int32Array(0)
    let wage = new Int32Array(0)
    let nwalk = 0

    // Cluster bounding box (in cells) — walkers are launched into a band just
    // outside it and killed if they stray too far, so they stay where the action
    // is even as a pointer-seeded nucleus drags the box wider.
    let bx0 = 0
    let by0 = 0
    let bx1 = 0
    let by1 = 0
    let frozen = 0
    let ctr = 1 // running hash counter — the only source of "randomness"
    let done = false // crystal has reached the edges; holding/dissolving

    // A colour ramp indexed by growth progress 0..255: deep teal core → lime
    // front, with the newest tips brightest. Three array reads per freeze, not
    // three lerps.
    const rampR = new Uint8ClampedArray(256)
    const rampG = new Uint8ClampedArray(256)
    const rampB = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i++) {
      const t = i / 255
      let r: number
      let g: number
      let b: number
      if (t < 0.5) {
        const u = t / 0.5
        r = 26 + u * (46 - 26)
        g = 70 + u * (150 - 70)
        b = 92 + u * (120 - 92)
      } else {
        const u = (t - 0.5) / 0.5
        r = 46 + u * (ar - 46)
        g = 150 + u * (ag - 150)
        b = 120 + u * (ab - 120)
      }
      rampR[i] = r
      rampG[i] = g
      rampB[i] = b
    }

    // How far the crystal has grown, 0..1, from the seed to filling the field —
    // drives the colour of the next cell to freeze so the rings read outward.
    function progress(): number {
      const span = Math.max(bx1 - bx0, by1 - by0)
      const full = Math.min(gw, gh)
      const p = span / full
      return p > 1 ? 1 : p
    }

    function freeze(cx: number, cy: number) {
      const idx = cy * gw + cx
      if (occ[idx]) return
      occ[idx] = 1
      frozen++
      if (cx < bx0) bx0 = cx
      if (cx > bx1) bx1 = cx
      if (cy < by0) by0 = cy
      if (cy > by1) by1 = cy
      // Tint by growth progress; the running counter adds a hair of sparkle so
      // the front shimmers rather than banding.
      const b = Math.min(255, ((progress() * 0.86 + 0.12) * 255) | 0)
      const p = idx * 4
      const d = img!.data
      d[p] = rampR[b]
      d[p + 1] = rampG[b]
      d[p + 2] = rampB[b]
      d[p + 3] = 255
    }

    // Is any of the four neighbours of (cx,cy) already frozen?
    function touching(cx: number, cy: number): boolean {
      return (
        (cx > 0 && occ[cy * gw + cx - 1] === 1) ||
        (cx < gw - 1 && occ[cy * gw + cx + 1] === 1) ||
        (cy > 0 && occ[(cy - 1) * gw + cx] === 1) ||
        (cy < gh - 1 && occ[(cy + 1) * gw + cx] === 1)
      )
    }

    // Launch a walker onto a ring just outside the cluster, at a random angle —
    // near enough to find the frost quickly, far enough not to spawn on top of
    // it. Deterministic in the running counter.
    function launch(i: number) {
      const midx = (bx0 + bx1) * 0.5
      const midy = (by0 + by1) * 0.5
      const rad = Math.max(bx1 - bx0, by1 - by0) * 0.5 + MARGIN
      const a = hash(ctr++) * TAU
      let x = Math.round(midx + Math.cos(a) * rad)
      let y = Math.round(midy + Math.sin(a) * rad)
      if (x < 0) x = 0
      else if (x > gw - 1) x = gw - 1
      if (y < 0) y = 0
      else if (y > gh - 1) y = gh - 1
      wx[i] = x
      wy[i] = y
      wage[i] = 0
    }

    function seedWalkers() {
      nwalk = Math.min(MAX_WALKERS, Math.max(16, Math.floor(gw * gh * WALK_DENSITY)))
      wx = new Int32Array(nwalk)
      wy = new Int32Array(nwalk)
      wage = new Int32Array(nwalk)
      for (let i = 0; i < nwalk; i++) launch(i)
    }

    // Reset to a single central seed and a fresh cloud of walkers.
    function reset() {
      occ = new Uint8Array(gw * gh)
      img = octx.createImageData(gw, gh)
      frozen = 0
      done = false
      const cx = gw >> 1
      const cy = gh >> 1
      bx0 = bx1 = cx
      by0 = by1 = cy
      freeze(cx, cy)
      seedWalkers()
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.imageSmoothingEnabled = true

      gw = Math.min(MAX_GW, Math.max(8, Math.round(w / CELL_PX)))
      gh = Math.max(8, Math.round(gw * (h / w)))
      off.width = gw
      off.height = gh
      reset()
    }
    layout()

    // Has the crystal reached the field edges? Then it is finished growing.
    function reachedEdge(): boolean {
      return bx0 <= 1 || by0 <= 1 || bx1 >= gw - 2 || by1 >= gh - 2
    }

    // One tick: every walker takes STEPS_PER_FRAME random steps, sticking the
    // moment it brushes the cluster; strays and stragglers are relaunched. The
    // roam band expands with the cluster (plus generous MARGIN slack).
    function tick() {
      if (done) return
      const roam = Math.max(bx1 - bx0, by1 - by0) * 0.5 + MARGIN * 2
      const midx = (bx0 + bx1) * 0.5
      const midy = (by0 + by1) * 0.5
      const maxAge = (roam * roam * 2.2) | 0
      for (let i = 0; i < nwalk; i++) {
        let x = wx[i]
        let y = wy[i]
        for (let s = 0; s < STEPS_PER_FRAME; s++) {
          if (touching(x, y)) {
            freeze(x, y)
            launch(i)
            x = wx[i]
            y = wy[i]
            continue
          }
          // One of four cardinal steps, deterministic in the counter.
          const dir = (hash(ctr++) * 4) | 0
          if (dir === 0) x++
          else if (dir === 1) x--
          else if (dir === 2) y++
          else y--
          wage[i]++
          const dx = x - midx
          const dy = y - midy
          if (
            x < 0 || x > gw - 1 || y < 0 || y > gh - 1 ||
            dx * dx + dy * dy > roam * roam ||
            wage[i] > maxAge
          ) {
            launch(i)
            x = wx[i]
            y = wy[i]
          }
        }
        wx[i] = x
        wy[i] = y
      }
      if (reachedEdge() || frozen > gw * gh * 0.35) done = true
    }

    // Freeze a nucleus under the pointer — a small cross so a fresh crystal takes
    // hold immediately and grows its own fingers into the open field.
    function seedAt(gx: number, gy: number) {
      const cx = Math.max(1, Math.min(gw - 2, gx | 0))
      const cy = Math.max(1, Math.min(gh - 2, gy | 0))
      freeze(cx, cy)
      freeze(cx - 1, cy)
      freeze(cx + 1, cy)
      freeze(cx, cy - 1)
      freeze(cx, cy + 1)
      done = false
    }

    function paintCrystal() {
      octx.putImageData(img!, 0, 0)
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(off, 0, 0, gw, gh, 0, 0, w, h)
    }

    if (reduce) {
      // Grow one crystal to completion synchronously, paint it once, hold still.
      const settle = () => {
        reset()
        let guard = 0
        while (!done && guard++ < 120000) tick()
        paintCrystal()
      }
      settle()
      const ro = new ResizeObserver(() => {
        layout()
        settle()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // The pointer drops new nuclei. We track it and seed each frame while pressed
    // so a drag lays a trail of crystals.
    let px = -1
    let py = -1
    let pressing = false
    function toGrid(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      px = ((e.clientX - rect.left) / rect.width) * gw
      py = ((e.clientY - rect.top) / rect.height) * gh
    }
    function onDown(e: PointerEvent) {
      toGrid(e)
      pressing = true
      seedAt(px, py)
    }
    function onMove(e: PointerEvent) {
      if (!pressing) return
      toGrid(e)
      seedAt(px, py)
    }
    function onUp() {
      pressing = false
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onUp)

    let raf = 0
    let last = -1
    let acc = 0
    let holdLeft = 0
    let fadeLeft = 0
    const STEP_MS = 1000 / 60

    function frame(now: number) {
      if (last < 0) last = now
      let dt = now - last
      last = now
      if (dt > 100) dt = 100
      acc += dt

      let steps = 0
      while (acc >= STEP_MS && steps < 3) {
        if (!done) {
          tick()
          if (done) holdLeft = HOLD
        } else if (holdLeft > 0) {
          holdLeft--
          if (holdLeft === 0) fadeLeft = FADE
        } else if (fadeLeft > 0) {
          // Dissolve: bleed the crystal's alpha down, then start fresh.
          const d = img!.data
          const k = 1 - 1 / fadeLeft
          for (let p = 3; p < d.length; p += 4) d[p] = d[p] * k
          fadeLeft--
          if (fadeLeft === 0) reset()
        }
        acc -= STEP_MS
        steps++
      }

      paintCrystal()

      // Draw the live walkers as a faint drifting haze — the diffusion made
      // visible. Skipped once the crystal is done and just holding.
      if (!done) {
        const sx = w / gw
        const sy = h / gh
        ctx!.fillStyle = `rgba(${ar},${ag},${ab},0.16)`
        const r = Math.max(1, sx * 0.6)
        for (let i = 0; i < nwalk; i++) {
          ctx!.fillRect(wx[i] * sx, wy[i] * sy, r, r)
        }
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onUp)
    }
  }, [reduce, accent])

  return <canvas ref={ref} aria-hidden className={`block touch-none select-none ${className}`} />
}
