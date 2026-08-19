import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Maze — a perfect maze that carves itself, then solves itself, on an endless
// loop. Two classic algorithms run back to back on the same grid, and the whole
// point is to watch the shape of each one:
//
//   1. CARVE. A randomized depth-first search (the "recursive backtracker")
//      starts in one corner and walks to a random unvisited neighbour, knocking
//      down the wall between them, until it hits a dead end — then it backtracks
//      along its own trail until it finds a cell with somewhere new to go, and
//      pushes on from there. When the stack empties, every cell has been visited
//      exactly once and there is exactly one path between any two cells: a
//      "perfect" maze, no loops, no islands. The long, sweeping corridors you
//      see are the signature of DFS — it commits hard to a direction before it
//      ever comes back.
//
//   2. SOLVE. A breadth-first flood then starts at the entrance and spreads one
//      ring at a time, tinting every cell by its distance from the start, so you
//      watch a wavefront wash across the whole maze at equal speed in all
//      legal directions. Because BFS reaches every cell by its shortest route,
//      following the recorded parents back from the exit hands you the single
//      shortest path for free — and that path lights bright and pulses once the
//      flood arrives.
//
// Then the maze fades and a fresh one carves in its place. The head cell glows
// while carving; the backtrack trail cools behind it; the flood reads as a dim
// lime gradient; the solution is the one bright thread through it. Press or drag
// anywhere to abandon the current maze and grow a new one from scratch — the
// click point seeds the next layout, so a maze never repeats but nothing is left
// to the wall clock.
//
// Everything is drawn to a single 2D canvas at device resolution. The grid is
// held as a Uint8Array of wall bitmasks (one byte per cell, four wall bits), so
// carving is just clearing bits and the solver just reads them. No Math.random
// on the hot path: a seeded mulberry32 places every carve choice, so the maze is
// deterministic per seed and stable across resizes and reduced-motion renders.
// Decorative, so aria-hidden. Under prefers-reduced-motion the animation never
// runs — one maze is carved and solved instantly and painted once, still.

const CELL = 26 // target px per maze cell
const MIN_COLS = 6
const CARVE_EVERY = 1 // frames between carve steps
const FLOOD_EVERY = 1 // frames between flood rings
const HOLD = 90 // frames the solved maze holds before it fades
const FADE = 40 // frames of cross-fade into the next maze

// Wall bits: each cell records which of its four walls still stand.
const N = 1
const E = 2
const S = 4
const W = 8
const OPP = { [N]: S, [E]: W, [S]: N, [W]: E } as Record<number, number>
const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 } as Record<number, number>
const DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 } as Record<number, number>
const DIRS = [N, E, S, W]

// mulberry32 — a tiny deterministic PRNG so every carve choice is placed without
// Math.random on the hot path. Reseeded per maze from the pointer.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Maze({
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
    let ox = 0 // left inset so the grid centres in the canvas
    let oy = 0
    let step = CELL // actual px per cell after fitting

    // Per-cell state.
    let walls = new Uint8Array(0) // standing-wall bitmask per cell
    let visited = new Uint8Array(0) // carve: cell reached yet
    let dist = new Int32Array(0) // solve: BFS distance from start (-1 = unreached)
    let parent = new Int32Array(0) // solve: predecessor cell for path recovery
    let onPath = new Uint8Array(0) // solve: cell is on the shortest path

    // Carve bookkeeping.
    let stack: number[] = []
    let head = 0 // current carve cell
    let carveTrail = new Float32Array(0) // how recently each cell was the head → cooling glow

    // Flood bookkeeping.
    let ring: number[] = [] // current BFS frontier
    let floodMax = 1 // largest distance seen, for the tint gradient

    type Phase = 'carve' | 'flood' | 'trace' | 'hold' | 'fade'
    let phase: Phase = 'carve'
    let frame = 0
    let phaseFrame = 0
    let raf = 0
    let seedBase = 0x1a2b3c4d
    let rand = mulberry32(seedBase)

    const idx = (x: number, y: number) => y * cols + x

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      cols = Math.max(MIN_COLS, Math.round(w / CELL))
      rows = Math.max(MIN_COLS, Math.round(h / CELL))
      // Fit square cells inside the canvas and centre the grid.
      step = Math.min(w / cols, h / rows)
      ox = (w - step * cols) / 2
      oy = (h - step * rows) / 2

      const n = cols * rows
      walls = new Uint8Array(n)
      visited = new Uint8Array(n)
      dist = new Int32Array(n)
      parent = new Int32Array(n)
      onPath = new Uint8Array(n)
      carveTrail = new Float32Array(n)
    }

    // Reset all grids and begin carving a fresh maze from the top-left corner.
    function beginMaze() {
      walls.fill(N | E | S | W) // every wall stands
      visited.fill(0)
      carveTrail.fill(0)
      dist.fill(-1)
      parent.fill(-1)
      onPath.fill(0)
      head = 0
      visited[0] = 1
      carveTrail[0] = 1
      stack = [0]
      phase = 'carve'
      phaseFrame = 0
    }

    // One step of the recursive backtracker: from the head, pick a random
    // unvisited neighbour, knock down the wall between, and advance; if boxed in,
    // pop the stack and back up.
    function carveStep() {
      if (stack.length === 0) {
        beginSolve()
        return
      }
      const cx = head % cols
      const cy = (head / cols) | 0
      // Collect unvisited neighbours.
      const choices: number[] = []
      for (const d of DIRS) {
        const nx = cx + DX[d]
        const ny = cy + DY[d]
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        if (!visited[idx(nx, ny)]) choices.push(d)
      }
      if (choices.length === 0) {
        stack.pop()
        head = stack.length ? stack[stack.length - 1] : head
        return
      }
      const d = choices[(rand() * choices.length) | 0]
      const nx = cx + DX[d]
      const ny = cy + DY[d]
      const ni = idx(nx, ny)
      walls[head] &= ~d // drop this cell's wall
      walls[ni] &= ~OPP[d] // and the neighbour's matching wall
      visited[ni] = 1
      carveTrail[ni] = 1
      head = ni
      stack.push(ni)
    }

    // Start the BFS flood from the top-left, aiming for the bottom-right.
    function beginSolve() {
      dist.fill(-1)
      parent.fill(-1)
      onPath.fill(0)
      const start = 0
      dist[start] = 0
      ring = [start]
      floodMax = 1
      phase = 'flood'
      phaseFrame = 0
    }

    // Expand the BFS frontier by one ring: every cell in the current frontier
    // reaches each open neighbour it has not seen, recording distance and parent.
    function floodStep() {
      if (ring.length === 0) {
        traceSolution()
        return
      }
      const nextRing: number[] = []
      for (const c of ring) {
        const cx = c % cols
        const cy = (c / cols) | 0
        const nd = dist[c] + 1
        for (const d of DIRS) {
          if (walls[c] & d) continue // wall blocks this move
          const nx = cx + DX[d]
          const ny = cy + DY[d]
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          const ni = idx(nx, ny)
          if (dist[ni] !== -1) continue
          dist[ni] = nd
          parent[ni] = c
          if (nd > floodMax) floodMax = nd
          nextRing.push(ni)
        }
      }
      ring = nextRing
    }

    // Walk parents back from the exit to light the shortest path.
    function traceSolution() {
      let c = cols * rows - 1
      while (c !== -1) {
        onPath[c] = 1
        c = parent[c]
      }
      phase = 'trace'
      phaseFrame = 0
    }

    // Carve and solve the whole maze with no animation — used for the first
    // paint under reduced motion and to keep resizes instant.
    function solveInstant() {
      beginMaze()
      let guard = cols * rows * 4
      while (stack.length && guard-- > 0) carveStep()
      beginSolve()
      guard = cols * rows * 4
      while (ring.length && guard-- > 0) floodStep()
      traceSolution()
    }

    // Blend two rgb-ish triples by t.
    function paint() {
      ctx!.clearRect(0, 0, w, h)

      const half = step / 2
      const gx = (x: number) => ox + x * step
      const gy = (y: number) => oy + y * step

      // Fill cells first (distance tint + path + carve glow), then stroke walls
      // on top so the walls read crisp over the fills.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = idx(x, y)
          const px = gx(x)
          const py = gy(y)
          let r = 0
          let g = 0
          let b = 0
          let a = 0

          if (phase === 'carve') {
            // Cells cool from the carve head: a dim lime that fades behind the walk.
            const t = carveTrail[i]
            if (t > 0.01) {
              a = t * 0.5
              r = ar
              g = ag
              b = ab
            }
          } else {
            // Solve phases: tint every reached cell by its distance from start.
            const d = dist[i]
            if (d >= 0) {
              const u = floodMax > 0 ? d / floodMax : 0
              // Near the start reads deep and dim, the far reaches brighten.
              const base = 0.1 + u * 0.32
              a = base
              r = ar * (0.35 + u * 0.4)
              g = ag * (0.35 + u * 0.4)
              b = ab * (0.35 + u * 0.4)
            }
            if ((phase === 'trace' || phase === 'hold' || phase === 'fade') && onPath[i]) {
              // The solution thread: bright, with a soft pulse in the trace/hold.
              const pulse =
                phase === 'trace' || phase === 'hold'
                  ? 0.72 + 0.28 * Math.sin((frame + i) * 0.12)
                  : 0.9
              a = 0.85 * pulse
              r = Math.min(255, ar + 40)
              g = Math.min(255, ag + 40)
              b = Math.min(255, ab)
            }
          }

          if (a > 0.004) {
            ctx!.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(3)})`
            ctx!.fillRect(px, py, step + 0.5, step + 0.5)
          }
        }
      }

      // Walls. Only draw the top and left wall of each cell (plus the far edges)
      // so shared walls are stroked once, not twice.
      ctx!.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = idx(x, y)
          const px = gx(x)
          const py = gy(y)
          if (walls[i] & N) {
            ctx!.moveTo(px, py)
            ctx!.lineTo(px + step, py)
          }
          if (walls[i] & W) {
            ctx!.moveTo(px, py)
            ctx!.lineTo(px, py + step)
          }
          if (x === cols - 1 && walls[i] & E) {
            ctx!.moveTo(px + step, py)
            ctx!.lineTo(px + step, py + step)
          }
          if (y === rows - 1 && walls[i] & S) {
            ctx!.moveTo(px, py + step)
            ctx!.lineTo(px + step, py + step)
          }
        }
      }
      ctx!.stroke()

      // The carve head, bright while it walks.
      if (phase === 'carve') {
        const hx = ox + (head % cols) * step + half
        const hy = oy + ((head / cols) | 0) * step + half
        const grd = ctx!.createRadialGradient(hx, hy, 0, hx, hy, step * 1.2)
        grd.addColorStop(0, `rgba(${ar},${ag},${ab},0.9)`)
        grd.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
        ctx!.fillStyle = grd
        ctx!.fillRect(hx - step * 1.2, hy - step * 1.2, step * 2.4, step * 2.4)
      }

      // Entrance and exit markers.
      const mark = (cx: number, cy: number) => {
        ctx!.fillStyle = `rgba(${ar},${ag},${ab},0.9)`
        ctx!.fillRect(ox + cx * step + half - 2, oy + cy * step + half - 2, 4, 4)
      }
      mark(0, 0)
      mark(cols - 1, rows - 1)

      // Fade veil into the next maze.
      if (phase === 'fade') {
        const v = phaseFrame / FADE
        ctx!.fillStyle = `rgba(4,4,4,${(v * 0.9).toFixed(3)})`
        ctx!.fillRect(0, 0, w, h)
      }
    }

    layout()

    if (reduce) {
      solveInstant()
      paint()
      const ro = new ResizeObserver(() => {
        layout()
        solveInstant()
        paint()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    beginMaze()

    function tick() {
      frame++
      phaseFrame++

      if (phase === 'carve') {
        if (frame % CARVE_EVERY === 0) {
          // A couple of carve steps per frame keeps the walk brisk on big grids.
          carveStep()
          carveStep()
        }
        // Cool the carve trail so the walk leaves a fading comet, not a solid fill.
        for (let i = 0; i < carveTrail.length; i++) {
          if (carveTrail[i] > 0) carveTrail[i] *= 0.94
        }
      } else if (phase === 'flood') {
        if (frame % FLOOD_EVERY === 0) floodStep()
      } else if (phase === 'trace') {
        if (phaseFrame > 60) {
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
          rand = mulberry32((seedBase = (seedBase * 1664525 + 1013904223) | 0))
          beginMaze()
        }
      }

      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Press or drag to abandon the current maze and grow a new one; the pointer
    // position folds into the seed so each restart carves a different maze.
    function reseedFrom(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = Math.round(e.clientX - rect.left)
      const y = Math.round(e.clientY - rect.top)
      seedBase = ((seedBase ^ (x * 73856093) ^ (y * 19349663)) | 0) || 1
      rand = mulberry32(seedBase)
      beginMaze()
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
      beginMaze()
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
