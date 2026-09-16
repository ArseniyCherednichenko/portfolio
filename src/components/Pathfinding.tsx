import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Pathfinding — the search itself, laid bare on an open grid. Maze already
// carves a perfect maze and floods it, but a perfect maze has exactly one route
// between any two cells, so a solver there has nothing to choose: the flood just
// fills the only corridor. This is the opposite problem — an OPEN field with
// scattered walls, where there are many ways across and the interesting thing is
// which cells an algorithm bothers to look at on the way to the shortest one.
//
// So the whole point here is the HEURISTIC. Two searches run on the identical
// grid, and you switch between them to watch the difference:
//
//   • Dijkstra (uninformed) spends the same effort in every direction. It has no
//     idea where the goal is, so its frontier grows as an even disc around the
//     start — it will happily explore cells pointing away from the goal just as
//     eagerly as ones pointing toward it. Correct, thorough, wasteful.
//
//   • A* (informed) adds one thing: an estimate of how far each cell still is
//     from the goal (here the Manhattan distance, which never overestimates on a
//     4-connected grid, so the path it returns is still guaranteed shortest). It
//     spends its effort where that estimate is smallest, so its frontier is a
//     tight cone leaning toward the goal — the same shortest path, a fraction of
//     the cells looked at.
//
// Both are the real algorithms, run with a binary min-heap, not a canned answer.
// The expansion order is animated as a spreading lime stain (recent cells bright,
// older ones cooled), and when the frontier reaches the goal the shortest path
// lights as one bright thread traced back through the recorded parents. A live
// readout counts cells explored against the total, so the cost of not knowing
// where you are going is a number you can read, not just a shape.
//
// It is editable: click or drag a cell to raise or clear a wall and the search
// re-runs instantly on the new field, so you can wall the cone off and watch A*
// bend around it. "New walls" reseeds a fresh scatter. Reduced motion drops the
// spread and the trace — the explored set and the final path are simply present.

const COLS = 25
const ROWS = 15
const CELL = 26
const GAP = 2 // visual inset so cells read as tiles, in viewBox units
const VBW = COLS * CELL
const VBH = ROWS * CELL

const START = { c: 2, r: Math.floor(ROWS / 2) }
const GOAL = { c: COLS - 3, r: Math.floor(ROWS / 2) }
const START_I = START.r * COLS + START.c
const GOAL_I = GOAL.r * COLS + GOAL.c

const ACCENT = '220, 248, 124' // the site's single lime, as an rgb triple

type Mode = 'astar' | 'dijkstra'

// A small deterministic PRNG so a given seed always scatters the same walls —
// the grid is reproducible, never touching Math.random during a solve.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Scatter walls as a mix of single blocks and short bars, keeping the start and
// goal (and their immediate surroundings) clear so there is always somewhere to
// begin and end. Density is deliberately moderate: enough to force the searches
// to make choices, open enough that the cone/disc contrast stays legible.
function makeWalls(seed: number): boolean[] {
  const rnd = mulberry32(seed)
  const walls = new Array<boolean>(COLS * ROWS).fill(false)
  const clear = (c: number, r: number) => {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return
    walls[r * COLS + c] = false
  }
  const count = Math.round(COLS * ROWS * 0.16)
  for (let n = 0; n < count; n++) {
    const c = Math.floor(rnd() * COLS)
    const r = Math.floor(rnd() * ROWS)
    walls[r * COLS + c] = true
    // Roughly a third of the time, extend into a short bar so the field has
    // walls to route around, not just speckle.
    if (rnd() < 0.35) {
      const horiz = rnd() < 0.5
      const len = 1 + Math.floor(rnd() * 3)
      for (let k = 1; k <= len; k++) {
        const cc = horiz ? c + k : c
        const rr = horiz ? r : r + k
        if (cc < COLS && rr < ROWS) walls[rr * COLS + cc] = true
      }
    }
  }
  // Keep the endpoints and their neighbours open.
  for (const p of [START, GOAL]) {
    clear(p.c, p.r)
    clear(p.c - 1, p.r)
    clear(p.c + 1, p.r)
    clear(p.c, p.r - 1)
    clear(p.c, p.r + 1)
  }
  return walls
}

// A binary min-heap of cell indices, ordered by a score array the caller keeps.
// Ties break toward a smaller heuristic (so A* commits to the goal-ward cell and
// draws a crisp cone) and then toward insertion order (stable, deterministic).
class MinHeap {
  private heap: number[] = []
  constructor(
    private f: Float64Array,
    private h: Float64Array,
    private seq: Float64Array,
  ) {}
  get size() {
    return this.heap.length
  }
  private less(a: number, b: number) {
    if (this.f[a] !== this.f[b]) return this.f[a] < this.f[b]
    if (this.h[a] !== this.h[b]) return this.h[a] < this.h[b]
    return this.seq[a] < this.seq[b]
  }
  push(cell: number) {
    const h = this.heap
    h.push(cell)
    let i = h.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.less(h[i], h[p])) {
        ;[h[i], h[p]] = [h[p], h[i]]
        i = p
      } else break
    }
  }
  pop(): number {
    const h = this.heap
    const top = h[0]
    const last = h.pop() as number
    if (h.length > 0) {
      h[0] = last
      let i = 0
      const n = h.length
      for (;;) {
        const l = 2 * i + 1
        const r = 2 * i + 2
        let m = i
        if (l < n && this.less(h[l], h[m])) m = l
        if (r < n && this.less(h[r], h[m])) m = r
        if (m === i) break
        ;[h[i], h[m]] = [h[m], h[i]]
        i = m
      }
    }
    return top
  }
}

interface Solve {
  order: number[] // cells in the order they were expanded (popped + closed)
  path: number[] // the shortest path start→goal, or [] if unreachable
  reached: boolean
}

// Run the real search. Uniform step cost of 1, 4-connected. mode === 'astar'
// adds the Manhattan heuristic; 'dijkstra' zeroes it, which on a unit grid is an
// even-cost flood. Records the expansion order for the animation and rebuilds
// the path from the recorded parents.
function solve(walls: boolean[], mode: Mode): Solve {
  const N = COLS * ROWS
  const g = new Float64Array(N).fill(Infinity)
  const f = new Float64Array(N).fill(Infinity)
  const h = new Float64Array(N).fill(0)
  const seq = new Float64Array(N).fill(0)
  const came = new Int32Array(N).fill(-1)
  const closed = new Uint8Array(N)

  const heuristic = (i: number) => {
    if (mode === 'dijkstra') return 0
    const c = i % COLS
    const r = (i / COLS) | 0
    return Math.abs(c - GOAL.c) + Math.abs(r - GOAL.r)
  }

  const heap = new MinHeap(f, h, seq)
  let counter = 0
  g[START_I] = 0
  h[START_I] = heuristic(START_I)
  f[START_I] = h[START_I]
  seq[START_I] = counter++
  heap.push(START_I)

  const order: number[] = []
  let reached = false

  while (heap.size > 0) {
    const cur = heap.pop()
    if (closed[cur]) continue
    closed[cur] = 1
    order.push(cur)
    if (cur === GOAL_I) {
      reached = true
      break
    }
    const cc = cur % COLS
    const cr = (cur / COLS) | 0
    const neighbours = [
      [cc + 1, cr],
      [cc - 1, cr],
      [cc, cr + 1],
      [cc, cr - 1],
    ]
    for (const [nc, nr] of neighbours) {
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
      const ni = nr * COLS + nc
      if (walls[ni] || closed[ni]) continue
      const tentative = g[cur] + 1
      if (tentative < g[ni]) {
        came[ni] = cur
        g[ni] = tentative
        h[ni] = heuristic(ni)
        f[ni] = tentative + h[ni]
        seq[ni] = counter++
        heap.push(ni)
      }
    }
  }

  const path: number[] = []
  if (reached) {
    let node = GOAL_I
    while (node !== -1) {
      path.push(node)
      if (node === START_I) break
      node = came[node]
    }
    path.reverse()
  }
  return { order, path, reached }
}

export interface PathfindingProps {
  className?: string
  seed?: number
}

export function Pathfinding({ className, seed = 7 }: PathfindingProps) {
  const reduced = useReducedMotion()
  const [walls, setWalls] = useState<boolean[]>(() => makeWalls(seed))
  const [mode, setMode] = useState<Mode>('astar')
  const [progress, setProgress] = useState(0)
  const paintRef = useRef<boolean | null>(null) // true = raising walls, false = clearing
  const rafRef = useRef<number | null>(null)

  const result = useMemo(() => solve(walls, mode), [walls, mode])
  const total = useMemo(() => walls.filter((w) => !w).length, [walls])

  // Map each explored cell to the step it was reached at, so a single `progress`
  // number decides every cell's state without a per-cell timer.
  const stepOf = useMemo(() => {
    const m = new Int32Array(COLS * ROWS).fill(-1)
    result.order.forEach((cell, i) => {
      m[cell] = i
    })
    return m
  }, [result])
  const pathStep = useMemo(() => {
    const m = new Int32Array(COLS * ROWS).fill(-1)
    result.path.forEach((cell, i) => {
      m[cell] = i
    })
    return m
  }, [result])

  const maxStep = result.order.length + result.path.length

  // Drive the spread. Under reduced motion, jump straight to the finished state.
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (reduced) {
      setProgress(maxStep)
      return
    }
    setProgress(0)
    // Pace the whole run to roughly a second and a bit regardless of how many
    // cells were explored, so a wide Dijkstra disc and a slim A* cone finish in
    // comparable time and read as the same gesture at different widths.
    const perFrame = Math.max(1, Math.ceil(result.order.length / 72))
    let cur = 0
    const tick = () => {
      cur += cur < result.order.length ? perFrame : 1
      if (cur >= maxStep) {
        setProgress(maxStep)
        rafRef.current = null
        return
      }
      setProgress(cur)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [result, reduced, maxStep])

  const exploredCount = Math.min(progress, result.order.length)
  const pathProgress = Math.max(0, progress - result.order.length)

  function toggleAt(i: number, paint: boolean) {
    if (i === START_I || i === GOAL_I) return
    setWalls((prev) => {
      if (prev[i] === paint) return prev
      const next = prev.slice()
      next[i] = paint
      return next
    })
  }

  function fill(i: number): string {
    if (walls[i]) return 'rgba(255,255,255,0.10)'
    const ps = pathStep[i]
    if (ps !== -1 && ps < pathProgress) return `rgb(${ACCENT})`
    const s = stepOf[i]
    if (s !== -1 && s < exploredCount) {
      // Recency: the leading edge of the frontier is bright, older cells cool
      // toward a faint stain, so the shape of the search stays visible.
      const age = (exploredCount - s) / Math.max(1, exploredCount)
      const alpha = 0.32 - 0.24 * age
      return `rgba(${ACCENT}, ${alpha.toFixed(3)})`
    }
    return 'rgba(255,255,255,0.025)'
  }

  const done = progress >= maxStep
  const summary = result.reached
    ? `${mode === 'astar' ? 'A*' : 'Dijkstra'} explored ${result.order.length} of ${total} open cells to find a shortest path of ${result.path.length} cells.`
    : `${mode === 'astar' ? 'A*' : 'Dijkstra'} explored every reachable cell; the goal is walled off with no path to it.`

  return (
    <div className={`flex w-full flex-col items-center gap-5 ${className ?? ''}`}>
      <div
        role="group"
        aria-label="Search strategy"
        className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
      >
        {(['astar', 'dijkstra'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 ${
              mode === m
                ? 'bg-[#DCF87C] text-black'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {m === 'astar' ? 'A* (informed)' : 'Dijkstra (blind)'}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="w-full max-w-[640px] touch-none select-none rounded-lg border border-white/10 bg-black/30"
        role="img"
        aria-label={summary}
        style={{ aspectRatio: `${VBW} / ${VBH}` }}
        onPointerLeave={() => {
          paintRef.current = null
        }}
      >
        <title>{summary}</title>
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = i % COLS
          const r = (i / COLS) | 0
          const isEndpoint = i === START_I || i === GOAL_I
          return (
            <rect
              key={i}
              x={c * CELL + GAP / 2}
              y={r * CELL + GAP / 2}
              width={CELL - GAP}
              height={CELL - GAP}
              rx={3}
              fill={fill(i)}
              style={{ cursor: isEndpoint ? 'default' : 'pointer' }}
              onPointerDown={(e) => {
                if (isEndpoint) return
                ;(e.target as Element).releasePointerCapture?.(e.pointerId)
                const paint = !walls[i]
                paintRef.current = paint
                toggleAt(i, paint)
              }}
              onPointerEnter={() => {
                if (paintRef.current !== null) toggleAt(i, paintRef.current)
              }}
              onPointerUp={() => {
                paintRef.current = null
              }}
            />
          )
        })}

        {/* Start and goal markers — drawn last so they sit over the stain. */}
        <g pointerEvents="none">
          <rect
            x={START.c * CELL + GAP / 2}
            y={START.r * CELL + GAP / 2}
            width={CELL - GAP}
            height={CELL - GAP}
            rx={3}
            fill="none"
            stroke={`rgb(${ACCENT})`}
            strokeWidth={2}
          />
          <circle
            cx={START.c * CELL + CELL / 2}
            cy={START.r * CELL + CELL / 2}
            r={4}
            fill={`rgb(${ACCENT})`}
          />
          <rect
            x={GOAL.c * CELL + GAP / 2}
            y={GOAL.r * CELL + GAP / 2}
            width={CELL - GAP}
            height={CELL - GAP}
            rx={3}
            fill="none"
            stroke={`rgb(${ACCENT})`}
            strokeWidth={2}
          />
          <circle
            cx={GOAL.c * CELL + CELL / 2}
            cy={GOAL.r * CELL + CELL / 2}
            r={4}
            fill="none"
            stroke={`rgb(${ACCENT})`}
            strokeWidth={2}
          />
        </g>
      </svg>

      <div className="flex w-full max-w-[640px] flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-white/55" aria-live="polite">
          {result.reached ? (
            <>
              <span className="text-[#DCF87C]">{exploredCount}</span>
              <span className="text-white/35"> / {total} cells explored</span>
              {done && (
                <span className="text-white/35">
                  {' '}
                  · path <span className="text-[#DCF87C]">{result.path.length}</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-white/45">no path — goal walled off</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-white/35 sm:inline">
            click cells to draw walls
          </span>
          <button
            type="button"
            onClick={() => setWalls(makeWalls((seed + Math.floor(Math.random() * 1e6)) >>> 0))}
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:bg-white/[0.04] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          >
            New walls
          </button>
        </div>
      </div>
    </div>
  )
}

export default Pathfinding
