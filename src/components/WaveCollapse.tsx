import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// WaveCollapse — a pipe network that assembles itself out of pure constraint, on
// an endless loop. It runs the Wave Function Collapse algorithm live, and, like
// the self-carving Maze it sits beside, the whole point is to watch the shape of
// the method:
//
//   1. SUPERPOSITION. Every cell of the grid starts holding *all* tiles at once
//      — straights, corners, T-junctions, a cross, blank. A cell is only "real"
//      once it has been forced down to a single tile; until then it is a faint
//      cloud of everything it could still become.
//
//   2. COLLAPSE. Each step finds the least-decided cell (the lowest entropy —
//      the fewest options left) and collapses it: one tile is chosen, weighted,
//      and locked in. Ties are broken by a seeded jitter so the front wanders.
//
//   3. PROPAGATE. Locking a cell ripples outward. Every tile edge is a socket —
//      a pipe either leaves that side or it does not — and two neighbours may
//      only touch if their shared sockets agree. So the moment a cell commits,
//      its neighbours drop every tile that no longer fits, and *their* neighbours
//      react in turn, a constraint wave washing across the grid (AC-3 style)
//      until everything is consistent again. Most collapses you never trigger a
//      single removal; now and then one decision cascades halfway across the
//      board.
//
// When every cell is decided, a continuous, seamless pipe network is left — no
// dead pipe ever meets a wall, because off-grid sides were forbidden a socket
// from the start. The finished network holds, then dissolves, and a fresh one
// begins collapsing in its place. Rarely a corner paints itself into a
// contradiction (a cell with no legal tile left); rather than fudge it, the grid
// simply restarts with the next seed — honest to how WFC actually behaves.
//
// Freshly-settled cells flare and cool, so you can read the collapse front as a
// travelling glow; pure corners are drawn as quarter-arcs and everything else as
// spokes to a centre node, so the result reads as plumbing, not a lattice.
// Press or drag to abandon the current weave and seed a new one from the pointer.
//
// Drawn to one 2D canvas at device resolution. Possibility sets are packed into a
// single Uint16Array bitmask per cell (one bit per tile), so collapse is masking
// and propagation is bit tests — no per-cell arrays on the hot path, and no
// Math.random: a seeded mulberry32 places every choice, deterministic per seed
// and stable across resizes. Decorative, so aria-hidden. Under
// prefers-reduced-motion the animation never runs — one network is solved
// instantly and painted once, still.

const CELL = 34 // target px per grid cell
const MIN_CELLS = 4
const HOLD = 150 // frames the finished weave holds before it dissolves
const FADE = 34 // frames of dissolve into the next weave

// Side bits — which sides a tile's pipe connects to.
const TN = 1
const TE = 2
const TS = 4
const TW = 8

// The tile set, each a 4-bit mask of connected sides, with a placement weight.
// Dead-end stubs (a single connection) are left out so no pipe trails off into
// nothing; blanks give the network room to breathe.
const TILES: { mask: number; weight: number }[] = [
  { mask: 0, weight: 1.1 }, // blank
  { mask: TN | TS, weight: 2 }, // straight |
  { mask: TE | TW, weight: 2 }, // straight —
  { mask: TN | TE, weight: 1.6 }, // corners
  { mask: TE | TS, weight: 1.6 },
  { mask: TS | TW, weight: 1.6 },
  { mask: TW | TN, weight: 1.6 },
  { mask: TN | TE | TS, weight: 0.7 }, // tees
  { mask: TE | TS | TW, weight: 0.7 },
  { mask: TS | TW | TN, weight: 0.7 },
  { mask: TW | TN | TE, weight: 0.7 },
  { mask: TN | TE | TS | TW, weight: 0.35 }, // cross
]
const NT = TILES.length
const ALL = (1 << NT) - 1 // possibility bitmask with every tile allowed

// Does tile t carry a pipe out of the given side?
const socket = (t: number, side: number) => (TILES[t].mask & side ? 1 : 0)

// Direction walk: bit -> delta and the opposite side that must agree.
const SIDES = [TN, TE, TS, TW]
const DX: Record<number, number> = { [TN]: 0, [TE]: 1, [TS]: 0, [TW]: -1 }
const DY: Record<number, number> = { [TN]: -1, [TE]: 0, [TS]: 1, [TW]: 0 }
const OPP: Record<number, number> = { [TN]: TS, [TE]: TW, [TS]: TN, [TW]: TE }

// mulberry32 — a tiny deterministic PRNG so every collapse choice is placed
// without Math.random on the hot path. Reseeded per weave from the pointer.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const popcount = (n: number) => {
  let c = 0
  while (n) {
    n &= n - 1
    c++
  }
  return c
}

export function WaveCollapse({
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

    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    let ox = 0
    let oy = 0
    let step = CELL

    // Per-cell state.
    let poss = new Uint16Array(0) // possibility bitmask over tiles
    let done = new Uint8Array(0) // cell collapsed to a single tile
    let settle = new Float32Array(0) // recent-collapse glow, cools each frame
    let remaining = 0 // undecided cells left

    type Phase = 'collapse' | 'hold' | 'fade'
    let phase: Phase = 'collapse'
    let frame = 0
    let phaseFrame = 0
    let raf = 0
    let seedBase = 0x51ed270b
    let rand = mulberry32(seedBase)

    const idx = (x: number, y: number) => y * cols + x

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      cols = Math.max(MIN_CELLS, Math.round(w / CELL))
      rows = Math.max(MIN_CELLS, Math.round(h / CELL))
      step = Math.min(w / cols, h / rows)
      ox = (w - step * cols) / 2
      oy = (h - step * rows) / 2

      const n = cols * rows
      poss = new Uint16Array(n)
      done = new Uint8Array(n)
      settle = new Float32Array(n)
    }

    // Seed every cell to full superposition, minus any tile whose pipe would run
    // off the edge of the grid — so the boundary can never leave a pipe hanging.
    function beginWeave() {
      const n = cols * rows
      done.fill(0)
      settle.fill(0)
      remaining = n
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let m = ALL
          for (let t = 0; t < NT; t++) {
            if (
              (socket(t, TN) && y === 0) ||
              (socket(t, TS) && y === rows - 1) ||
              (socket(t, TW) && x === 0) ||
              (socket(t, TE) && x === cols - 1)
            ) {
              m &= ~(1 << t)
            }
          }
          poss[idx(x, y)] = m
        }
      }
      // Propagating the boundary constraints inward settles the frame first.
      const seedCells: number[] = []
      for (let i = 0; i < n; i++) if (poss[i] !== ALL) seedCells.push(i)
      propagate(seedCells)
      phase = 'collapse'
      phaseFrame = 0
    }

    // Which socket values are still reachable on a given side of a cell, packed
    // as a 2-bit set: bit 0 = "some tile leaves this side closed", bit 1 = "open".
    function sideOptions(cell: number, side: number) {
      const m = poss[cell]
      let opts = 0
      for (let t = 0; t < NT; t++) {
        if (m & (1 << t)) opts |= 1 << socket(t, side)
        if (opts === 3) break
      }
      return opts
    }

    // AC-3: given cells whose possibilities just shrank, prune neighbours whose
    // tiles can no longer meet them, and follow the wave. Returns false on a
    // contradiction (a cell emptied of every option).
    function propagate(queue: number[]): boolean {
      while (queue.length) {
        const cell = queue.pop()!
        const cx = cell % cols
        const cy = (cell / cols) | 0
        for (const side of SIDES) {
          const nx = cx + DX[side]
          const ny = cy + DY[side]
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          const nb = idx(nx, ny)
          if (done[nb]) continue
          const allowed = sideOptions(cell, side) // socket values this side can offer
          const opp = OPP[side]
          const before = poss[nb]
          let after = before
          for (let t = 0; t < NT; t++) {
            if (!(after & (1 << t))) continue
            // neighbour tile t must expose a socket the current cell can meet
            if (!(allowed & (1 << socket(t, opp)))) after &= ~(1 << t)
          }
          if (after === before) continue
          if (after === 0) return false
          poss[nb] = after
          queue.push(nb)
        }
      }
      return true
    }

    // Collapse the least-decided cell to one weighted tile, then propagate. On a
    // contradiction the whole weave restarts under the next seed.
    function collapseStep() {
      // Find minimum entropy over undecided cells, jittered to break ties.
      let best = -1
      let bestScore = Infinity
      const n = cols * rows
      for (let i = 0; i < n; i++) {
        if (done[i]) continue
        const e = popcount(poss[i])
        const score = e + rand() * 0.6
        if (score < bestScore) {
          bestScore = score
          best = i
        }
      }
      if (best < 0) return
      // Weighted pick among the surviving tiles.
      const m = poss[best]
      let total = 0
      for (let t = 0; t < NT; t++) if (m & (1 << t)) total += TILES[t].weight
      let r = rand() * total
      let pick = -1
      for (let t = 0; t < NT; t++) {
        if (!(m & (1 << t))) continue
        r -= TILES[t].weight
        if (r <= 0) {
          pick = t
          break
        }
      }
      if (pick < 0) for (let t = NT - 1; t >= 0; t--) if (m & (1 << t)) { pick = t; break }
      poss[best] = 1 << pick
      done[best] = 1
      settle[best] = 1
      remaining--
      if (!propagate([best])) {
        reseed(((seedBase * 1664525 + 1013904223) | 0) || 1)
        return
      }
      // Any neighbour pruned to a single tile is now decided too.
      for (let i = 0; i < n; i++) {
        if (!done[i] && poss[i] && (poss[i] & (poss[i] - 1)) === 0) {
          done[i] = 1
          settle[i] = 1
          remaining--
        }
      }
    }

    function solveInstant() {
      beginWeave()
      let guard = cols * rows * 4 + 50
      while (remaining > 0 && guard-- > 0) collapseStep()
    }

    // Draw one settled tile as plumbing: pure corners as quarter-arcs, everything
    // else as spokes to a centre node.
    function drawTile(cx: number, cy: number, t: number, glow: number) {
      const px = ox + cx * step + step / 2
      const py = oy + cy * step + step / 2
      const r = step / 2
      const mask = TILES[t].mask
      if (mask === 0) return
      const deg = popcount(mask)
      const lw = Math.max(1.5, step * 0.11)
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      ctx!.lineWidth = lw
      const base = 0.32 + glow * 0.55
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${base})`
      if (glow > 0.02) ctx!.shadowColor = `rgba(${ar},${ag},${ab},${glow * 0.9})`
      ctx!.shadowBlur = glow > 0.02 ? step * 0.5 * glow : 0

      // Pure elbow -> smooth quarter-arc, centred on the tile corner the two open
      // sides share, so the pipe curves instead of turning a hard right angle.
      const arc: Record<number, [number, number, number, number]> = {
        // mask -> [centreX offset (±r), centreY offset (±r), start angle, end angle]
        [TN | TE]: [r, -r, Math.PI / 2, Math.PI],
        [TE | TS]: [r, r, Math.PI, (3 * Math.PI) / 2],
        [TS | TW]: [-r, r, -Math.PI / 2, 0],
        [TW | TN]: [-r, -r, 0, Math.PI / 2],
      }
      if (deg === 2 && arc[mask]) {
        const [dx, dy, a0, a1] = arc[mask]
        ctx!.beginPath()
        ctx!.arc(px + dx, py + dy, r, a0, a1)
        ctx!.stroke()
        ctx!.shadowBlur = 0
        return
      }

      // Spokes from centre to each open edge — straights, tees, and the cross.
      ctx!.beginPath()
      for (const side of SIDES) {
        if (!(mask & side)) continue
        const ex = px + (DX[side] * step) / 2
        const ey = py + (DY[side] * step) / 2
        ctx!.moveTo(px, py)
        ctx!.lineTo(ex, ey)
      }
      ctx!.stroke()

      // Centre node where the pipe branches (tees, cross), so joins read cleanly.
      if (deg >= 3) {
        ctx!.beginPath()
        ctx!.fillStyle = `rgba(${ar},${ag},${ab},${0.5 + glow * 0.5})`
        ctx!.arc(px, py, lw * 0.85, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.shadowBlur = 0
    }

    function paint() {
      ctx!.clearRect(0, 0, w, h)
      const n = cols * rows
      // Faint clouds for cells still in superposition — dimmer the more decided.
      for (let i = 0; i < n; i++) {
        if (done[i]) continue
        const e = popcount(poss[i])
        const x = i % cols
        const y = (i / cols) | 0
        const px = ox + x * step + step / 2
        const py = oy + y * step + step / 2
        const a = e === 0 ? 0 : 0.04 + (1 - e / NT) * 0.1
        ctx!.fillStyle = `rgba(${ar},${ag},${ab},${a})`
        const s = 1.6 + (1 - e / NT) * (step * 0.18)
        ctx!.beginPath()
        ctx!.arc(px, py, s, 0, Math.PI * 2)
        ctx!.fill()
      }
      // Settled tiles, brightest where they just locked in.
      for (let i = 0; i < n; i++) {
        if (!done[i]) continue
        const t = 31 - Math.clz32(poss[i]) // the single set bit
        drawTile(i % cols, (i / cols) | 0, t, settle[i])
      }
    }

    function reseed(seed: number) {
      seedBase = seed
      rand = mulberry32(seedBase)
      beginWeave()
    }

    layout()

    if (reduce) {
      solveInstant()
      paint()
      const roR = new ResizeObserver(() => {
        layout()
        solveInstant()
        paint()
      })
      roR.observe(canvas)
      return () => roR.disconnect()
    }

    beginWeave()

    function tick() {
      frame++
      phaseFrame++
      if (phase === 'collapse') {
        // A few collapses per frame keeps the front moving on large grids.
        const per = 1 + (cols * rows > 260 ? 2 : 1)
        for (let k = 0; k < per && remaining > 0; k++) collapseStep()
        if (remaining <= 0) {
          phase = 'hold'
          phaseFrame = 0
        }
      } else if (phase === 'hold') {
        if (phaseFrame > HOLD) {
          phase = 'fade'
          phaseFrame = 0
        }
      } else if (phase === 'fade') {
        if (phaseFrame > FADE) {
          reseed(((seedBase * 1664525 + 1013904223) | 0) || 1)
        }
      }
      // Cool the collapse glow so the settling front trails a fading light.
      for (let i = 0; i < settle.length; i++) if (settle[i] > 0) settle[i] *= 0.9
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function reseedFrom(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = Math.round(e.clientX - rect.left)
      const y = Math.round(e.clientY - rect.top)
      reseed((((seedBase ^ (x * 73856093) ^ (y * 19349663)) | 0) || 1) >>> 0)
    }
    let dragging = false
    function onDown(e: PointerEvent) {
      dragging = true
      reseedFrom(e)
    }
    function onMove(e: PointerEvent) {
      if (dragging) reseedFrom(e)
    }
    function onUp() {
      dragging = false
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onUp)

    const ro = new ResizeObserver(() => {
      layout()
      beginWeave()
    })
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

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full cursor-pointer touch-none ${className}`}
    />
  )
}
