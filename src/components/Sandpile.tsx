import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Sandpile — the Abelian sandpile model (Bak-Tang-Wiesenfeld, 1987), the
// original toy of self-organised criticality, rebuilt as a phosphor pointer
// field. It is the odd one out among the automata beside it: the Game of Life
// makes gliders out of birth-and-death, the Cyclic space winds spirals out of a
// chase, the falling Sandbox pours grains under gravity. This one has no gravity
// and no clock rule — only a single, almost trivial law of local balance, and
// out of it falls a power law.
//
// Every cell holds a small pile of grains. A pile is *stable* while it holds
// fewer than four; the instant it reaches four it *topples*, shedding one grain
// to each of its four orthogonal neighbours and keeping the rest. A neighbour
// that tips over four then topples in turn, so one added grain can set off a
// chain — an avalanche — that ripples outward as an expanding front and shakes
// loose the whole pile. Grains that topple off the edge of the world are simply
// lost, so the sand can shed as fast as it is fed and the field never blows up.
//
// The remarkable part is what the pile organises itself into. Drip grains onto
// one point forever and the surface climbs to a critical slope and then holds
// there, poised on the edge of collapse everywhere at once — and from that
// state a single grain triggers an avalanche of *no typical size*: most are
// tiny, a few are enormous, and their frequency follows a straight line on a
// log-log plot. No parameter is tuned to sit at that edge; the system walks
// itself there. That is "self-organised criticality", and it is the cleanest
// argument there is for why the same scale-free statistics turn up in real
// avalanches, earthquakes, and forest fires. The famous four-colour fractal is
// the fingerprint of the rule: it is the stable pile left when you drop a huge
// heap on one cell and let it settle — deterministic, always identical, and
// nowhere near round. The reduced-motion still paints exactly that.
//
// It is drawn on the same phosphor screen as the Life, Cyclic, and Ripple
// fields, so the family reads as one. A cool teal band tints each cell by how
// many grains it holds, so the terraced slopes of the pile are always faintly
// there; on top of that a `heat` field flares to full wherever a cell toppled
// *this step* and bleeds off over the next few, so the leading edge of every
// avalanche — the cells collapsing now — glows lime-white and you watch the
// wave travel. Press or drag to pour a heap under the cursor and set off your
// own avalanche.
//
// No Date.now and no Math.random on the hot path: the idle drip site and its
// wander come from a seeded PRNG, and timing runs off the frame counter, so the
// field is deterministic and stable across resizes. It is pure integer
// arithmetic — no floats in the rule, nothing to drift or blow up. Grains live
// in one typed array per cell and render to a grid-sized buffer the GPU smooths
// up, so the hot loop touches ~14k cells, not a million pixels. Decorative, so
// aria-hidden. Under prefers-reduced-motion the loop never starts — a large heap
// is dropped on the centre, stabilised in full, and the fractal painted once.

const CELL = 6 // target px per grid cell before smoothing
const MAX_CELLS = 15000 // clamp the grid so a sweep stays cheap
const DECAY = 0.6 // per-step heat bleed → thin, bright avalanche fronts
const DRIP = 3 // grains fed to the source each frame while at rest
const SETTLE_HEAP = 26000 // reduced-motion: grains dropped on the centre
const SETTLE_SWEEPS = 20000 // safety cap on the reduced-motion stabilisation
const IDLE_EVERY = 150 // frames between the source wandering to a new spot

// A cool teal for the terraced slopes; the accent lime rides the toppling front.
const TEAL = [54, 178, 170]

// mulberry32 — a tiny deterministic PRNG so the drip site wanders without
// Math.random on the hot path.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Sandpile({
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
    const [tr, tg, tb] = TEAL

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Offscreen grid-sized buffer: the field renders here at 1px/cell, then the
    // main canvas scales it up with smoothing on, so the fronts bloom.
    const grid = document.createElement('canvas')
    const gctx = grid.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0 // grid columns
    let gh = 0 // grid rows
    let pile = new Int32Array(0) // grains per cell
    let next = new Int32Array(0)
    let heat = new Float32Array(0)
    let img: ImageData | null = null
    let raf = 0
    let frame = 0
    const rand = mulberry32(0x2545f491) // fixed seed → deterministic drip wander

    // The source the idle drip feeds, in grid cells; it wanders now and then so
    // the pile is rebuilt from a fresh point and never settles into one shape.
    let srcx = 0
    let srcy = 0

    // Pointer trail so a fast drag lays down a continuous ridge, not a dotted one.
    let px = -1
    let py = -1
    let touching = false

    // Add `amount` grains to grid cell (cx, cy), clamped to the field.
    function drop(cx: number, cy: number, amount: number) {
      const x = cx | 0
      const y = cy | 0
      if (x < 0 || x >= gw || y < 0 || y >= gh) return
      pile[y * gw + x] += amount
    }

    // Pour a small heap along the segment (ax,ay)→(bx,by) in canvas px, so a
    // drag lays a continuous ridge that avalanches as it grows.
    function pourLine(ax: number, ay: number, bx: number, by: number) {
      const dist = Math.hypot(bx - ax, by - ay)
      const steps = Math.max(1, Math.round((dist / w) * gw))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const gx = ((ax + (bx - ax) * t) / w) * gw
        const gy = ((ay + (by - ay) * t) / h) * gh
        drop(gx, gy, 4)
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
      pile = new Int32Array(gw * gh)
      next = new Int32Array(gw * gh)
      heat = new Float32Array(gw * gh)
      img = gctx.createImageData(gw, gh)
      srcx = (gw / 2) | 0
      srcy = (gh / 2) | 0
    }

    // One synchronous toppling sweep. Every cell holding four or more grains
    // topples once — losing four and sending one to each orthogonal neighbour —
    // and every cell gains one grain for each toppling neighbour it has. Grains
    // sent past the edge are lost, so the boundary is open and the pile can shed.
    // Because the sandpile is *abelian*, the order of topples never changes the
    // final stable pile; sweeping all of them at once just makes the avalanche
    // front visible as it expands. Returns whether anything toppled.
    function sweep() {
      let any = false
      for (let y = 0; y < gh; y++) {
        const yMid = y * gw
        const yUp = y > 0 ? yMid - gw : -1
        const yDn = y < gh - 1 ? yMid + gw : -1
        for (let x = 0; x < gw; x++) {
          const i = yMid + x
          const g = pile[i]
          let v = g
          if (g >= 4) {
            v -= 4
            any = true
            heat[i] = 1
          } else {
            heat[i] *= DECAY
          }
          // Receive one grain from each orthogonal neighbour that is toppling.
          if (x > 0 && pile[i - 1] >= 4) v++
          if (x < gw - 1 && pile[i + 1] >= 4) v++
          if (yUp >= 0 && pile[yUp + x] >= 4) v++
          if (yDn >= 0 && pile[yDn + x] >= 4) v++
          next[i] = v
        }
      }
      const tmp = pile
      pile = next
      next = tmp
      return any
    }

    function render() {
      const data = img!.data
      for (let i = 0; i < gw * gh; i++) {
        const p = i * 4
        // The terraced slopes: a cell holding more grains sits brighter, so the
        // four stable levels read as four teal bands across the pile.
        const g = pile[i]
        const level = (g > 3 ? 3 : g) / 3
        const baseA = 0.08 + level * 0.32
        const bandR = tr * baseA
        const bandG = tg * baseA
        const bandB = tb * baseA
        // The toppling front: a cell that collapsed this step flares to full and
        // cools, so the leading edge of every avalanche glows lime-white.
        const e = heat[i]
        const s = e * e * (3 - 2 * e)
        const white = s * s * 0.4
        data[p] = Math.min(255, bandR + ar * s * 0.9 + 255 * white)
        data[p + 1] = Math.min(255, bandG + ag * s * 0.9 + 255 * white)
        data[p + 2] = Math.min(255, bandB + ab * s * 0.9 + 255 * white)
        data[p + 3] = Math.round(Math.min(1, baseA + s * 0.95) * 255)
      }
      gctx.putImageData(img!, 0, 0)
      ctx!.imageSmoothingEnabled = true
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
    }

    layout()

    if (reduce) {
      // The canonical still: drop a single large heap on the centre and topple
      // until nothing is left unstable, so the deterministic four-colour fractal
      // is painted once. Re-settle on resize. The loop never runs.
      function settle() {
        pile.fill(0)
        heat.fill(0)
        pile[srcy * gw + srcx] = SETTLE_HEAP
        let guard = 0
        while (sweep() && guard++ < SETTLE_SWEEPS) {
          /* topple to stability */
        }
        heat.fill(0)
        render()
      }
      settle()
      const ro = new ResizeObserver(() => {
        layout()
        settle()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Seed a modest heap so the pile is already terraced and avalanching from
    // the first frames rather than climbing from flat.
    pile[srcy * gw + srcx] = 1200

    function tick() {
      frame++
      // Feed the source unless the pointer is pouring its own heap, so the pile
      // is perpetually driven back to its critical slope and keeps avalanching.
      if (!touching) drop(srcx, srcy, DRIP)

      // Move the source to a fresh spot now and then, so the field is rebuilt
      // from a new point and never settles into one fixed shape.
      if (!touching && frame % IDLE_EVERY === 0) {
        srcx = (gw * (0.28 + rand() * 0.44)) | 0
        srcy = (gh * (0.28 + rand() * 0.44)) | 0
      }

      // One toppling sweep advances any avalanche in progress by a single ring,
      // so the front is watchable rather than resolving in an instant.
      sweep()
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
      if (touching && px >= 0) pourLine(px, py, x, y)
      px = x
      py = y
    }
    function onDown(e: PointerEvent) {
      const { x, y } = toLocal(e)
      touching = true
      px = x
      py = y
      // A concentrated heap under the cursor, guaranteed to tip and cascade.
      drop((x / w) * gw, (y / h) * gh, 160)
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
