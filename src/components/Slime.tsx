import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Slime — a Physarum simulation, and this family's answer to the question the
// boids beside it don't ask: how does a thing with no brain, no map, and no
// centre build a network that looks designed? Each agent is almost nothing —
// a position, a heading, and one instinct. It sniffs the trail just ahead of
// it, a little to the left and a little to the right, turns toward whichever
// smells strongest, takes a step, and leaves a little trail of its own where
// it lands. That is the whole program. Thousands of them running it at once,
// on a map that slowly blurs and fades, and out of it comes the reticulate,
// vein-like mesh a real slime mould grows to connect its food — the same
// creature that, given oats laid out like Tokyo's suburbs, reinvented the rail
// network. Emergence you can watch assemble itself.
//
// The map is a single field of scent — a Float32Array the size of a coarse
// grid, blurred and decayed a touch every frame so old trails soften and die
// unless they're kept fed. Agents read three samples from it and write one
// back; the field does the rest. Nothing here is placed by hand: every agent's
// start and heading, and the small random turn it takes when the trail ahead is
// flat, come from a fixed integer hash of its index and the step count, so the
// same mesh grows every load and it never touches Math.random. The pointer is
// food: move across it and scent pools under your cursor, so the veins reach
// toward you and thicken; press to drop a richer bloom they race to colonise.
//
// One canvas, two scent buffers swapped each frame, the network rendered by
// mapping scent through a black → teal → lime ramp and blitting the coarse
// grid up soft. Under prefers-reduced-motion the loop never starts: the sim is
// stepped forward once to a settled network, drawn a single time, and held
// still, re-settling only on resize. Decorative, so aria-hidden.

const CELL_PX = 3 // one scent cell per this many CSS px (coarser = faster)
const MAX_GW = 340 // cap the grid so the per-frame blur stays cheap
const DENSITY = 0.2 // agents per scent cell
const MAX_AGENTS = 6200

const SENSOR_DIST = 9 // how far ahead an agent smells, in cells
const SENSOR_ANGLE = 0.5 // left/right sniff offset, radians
const TURN = 0.5 // how hard it turns toward the stronger side, radians
const STEP = 1.0 // cells moved per step
const DEPOSIT = 0.85 // scent dropped where an agent lands
const DECAY = 0.09 // fraction of scent lost each frame
const NORM = 3.2 // scent value that reads as full-bright lime
const TAU = Math.PI * 2

// A fast, deterministic integer hash → a number in [0, 1). Stands in for a PRNG
// so every agent's seed and its idle jitter are fixed by index and step, never
// rolled at runtime.
function hash(n: number): number {
  let x = n | 0
  x = (x ^ 61) ^ (x >>> 16)
  x = x + (x << 3)
  x = x ^ (x >>> 4)
  x = Math.imul(x, 0x27d4eb2d)
  x = x ^ (x >>> 15)
  return (x >>> 0) / 4294967296
}

export function Slime({
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

    // A small offscreen canvas holds the coarse scent field as pixels; the main
    // canvas blits it up soft, which is what gives the veins their glow.
    const off = document.createElement('canvas')
    const octx = off.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0
    let gh = 0
    let trail = new Float32Array(0)
    let next = new Float32Array(0)
    let img: ImageData | null = null
    let ax = new Float32Array(0)
    let ay = new Float32Array(0)
    let aa = new Float32Array(0)
    let count = 0
    // A ramp lookup so the per-pixel colour mapping is three array reads, not
    // three lerps: index by scent bucket 0..255.
    const rampR = new Uint8ClampedArray(256)
    const rampG = new Uint8ClampedArray(256)
    const rampB = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i++) {
      // black → teal → lime, with a soft toe so faint trails still register.
      const t = Math.pow(i / 255, 0.72)
      let r: number
      let g: number
      let b: number
      if (t < 0.5) {
        const u = t / 0.5
        r = 6 + u * (40 - 6)
        g = 8 + u * (118 - 8)
        b = 7 + u * (96 - 7)
      } else {
        const u = (t - 0.5) / 0.5
        r = 40 + u * (ar - 40)
        g = 118 + u * (ag - 118)
        b = 96 + u * (ab - 96)
      }
      rampR[i] = r
      rampG[i] = g
      rampB[i] = b
    }

    function seedAgents() {
      count = Math.min(MAX_AGENTS, Math.floor(gw * gh * DENSITY))
      ax = new Float32Array(count)
      ay = new Float32Array(count)
      aa = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        // Scatter across the field with a fixed heading — deterministic per
        // index, so the same mesh grows every time.
        ax[i] = hash(i * 3 + 1) * gw
        ay[i] = hash(i * 3 + 2) * gh
        aa[i] = hash(i * 3 + 3) * TAU
      }
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.imageSmoothingEnabled = true

      gw = Math.min(MAX_GW, Math.max(2, Math.round(w / CELL_PX)))
      gh = Math.max(2, Math.round(gw * (h / w)))
      off.width = gw
      off.height = gh
      trail = new Float32Array(gw * gh)
      next = new Float32Array(gw * gh)
      img = octx.createImageData(gw, gh)
      seedAgents()
    }
    layout()

    // Read scent at a grid point, wrapping at the edges so the field is a torus
    // and agents never pile up on a wall.
    function sample(gx: number, gy: number): number {
      let ix = gx | 0
      let iy = gy | 0
      ix = ((ix % gw) + gw) % gw
      iy = ((iy % gh) + gh) % gh
      return trail[iy * gw + ix]
    }

    // One tick of the whole colony: every agent senses, turns, moves, deposits;
    // then the field is blurred and decayed. `step` seeds the idle jitter.
    function tick(step: number) {
      for (let i = 0; i < count; i++) {
        const a = aa[i]
        const x = ax[i]
        const y = ay[i]
        const fx = Math.cos(a)
        const fy = Math.sin(a)
        // Three sniffs: straight ahead, and rotated to either side.
        const cx = x + fx * SENSOR_DIST
        const cy = y + fy * SENSOR_DIST
        const la = a - SENSOR_ANGLE
        const ra = a + SENSOR_ANGLE
        const c = sample(cx, cy)
        const l = sample(x + Math.cos(la) * SENSOR_DIST, y + Math.sin(la) * SENSOR_DIST)
        const r = sample(x + Math.cos(ra) * SENSOR_DIST, y + Math.sin(ra) * SENSOR_DIST)

        let na = a
        if (c >= l && c >= r) {
          // straight ahead is strongest — hold course
        } else if (l > r) {
          na = a - TURN
        } else if (r > l) {
          na = a + TURN
        } else {
          // trail ahead is flat — a small deterministic wander
          na = a + (hash(i * 131 + step) - 0.5) * TURN
        }

        let nx = x + Math.cos(na) * STEP
        let ny = y + Math.sin(na) * STEP
        nx = ((nx % gw) + gw) % gw
        ny = ((ny % gh) + gh) % gh
        aa[i] = na
        ax[i] = nx
        ay[i] = ny

        // Drop scent where it landed.
        const idx = (ny | 0) * gw + (nx | 0)
        trail[idx] += DEPOSIT
      }

      // Diffuse (3×3 box blur) and decay into the second buffer, then swap.
      const keep = 1 - DECAY
      for (let y = 0; y < gh; y++) {
        const ym = ((y - 1 + gh) % gh) * gw
        const yc = y * gw
        const yp = ((y + 1) % gh) * gw
        for (let x = 0; x < gw; x++) {
          const xm = (x - 1 + gw) % gw
          const xp = (x + 1) % gw
          const sum =
            trail[ym + xm] + trail[ym + x] + trail[ym + xp] +
            trail[yc + xm] + trail[yc + x] + trail[yc + xp] +
            trail[yp + xm] + trail[yp + x] + trail[yp + xp]
          next[yc + x] = (sum * 0.11111111) * keep
        }
      }
      const tmp = trail
      trail = next
      next = tmp
    }

    // Feed scent under the pointer — a soft gaussian-ish blob the veins grow
    // toward. `strength` scales the bloom (a press drops a richer one).
    function feed(gx: number, gy: number, radius: number, strength: number) {
      const r2 = radius * radius
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const d2 = dx * dx + dy * dy
          if (d2 > r2) continue
          const ix = ((((gx + dx) | 0) % gw) + gw) % gw
          const iy = ((((gy + dy) | 0) % gh) + gh) % gh
          trail[iy * gw + ix] += strength * (1 - d2 / r2)
        }
      }
    }

    function paint() {
      const data = img!.data
      for (let i = 0, p = 0; i < trail.length; i++, p += 4) {
        let v = (trail[i] / NORM) * 255
        if (v > 255) v = 255
        const b = v | 0
        data[p] = rampR[b]
        data[p + 1] = rampG[b]
        data[p + 2] = rampB[b]
        data[p + 3] = 255
      }
      octx.putImageData(img!, 0, 0)
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(off, 0, 0, gw, gh, 0, 0, w, h)
    }

    if (reduce) {
      // Step the colony forward to a settled network, draw it once, hold still.
      const settle = () => {
        for (let i = 0; i < gw * gh; i++) trail[i] = 0
        seedAgents()
        for (let s = 0; s < 80; s++) tick(s)
        paint()
      }
      settle()
      const ro = new ResizeObserver(() => {
        layout()
        settle()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // The pointer feeds the field. We track it and drip scent each frame so the
    // network reaches toward the cursor; a press blooms a richer patch.
    let px = -1
    let py = -1
    let boost = 0
    function toGrid(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      px = ((e.clientX - rect.left) / rect.width) * gw
      py = ((e.clientY - rect.top) / rect.height) * gh
    }
    function onMove(e: PointerEvent) {
      toGrid(e)
    }
    function onLeave() {
      px = -1
      py = -1
    }
    function onDown(e: PointerEvent) {
      toGrid(e)
      boost = 1
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)

    let raf = 0
    let last = -1
    let acc = 0 // accumulated ms, for a fixed-rate sim
    let step = 0
    const STEP_MS = 1000 / 60

    function frame(now: number) {
      if (last < 0) last = now
      let dt = now - last
      last = now
      if (dt > 100) dt = 100 // clamp after a tab-away
      acc += dt

      // Fixed-timestep sim: run whole ticks, at most a few per frame so a long
      // stall never spirals.
      let steps = 0
      while (acc >= STEP_MS && steps < 3) {
        if (px >= 0) feed(px, py, 5, 0.9)
        if (boost > 0) {
          feed(px < 0 ? gw / 2 : px, py < 0 ? gh / 2 : py, 10, 2.2)
          boost = 0
        }
        tick(step++)
        acc -= STEP_MS
        steps++
      }
      paint()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [reduce, accent])

  return <canvas ref={ref} aria-hidden className={`block touch-none select-none ${className}`} />
}
