import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Langton's Ant — the smallest possible argument for emergence. One ant walks a
// grid of cells under a rule so trivial you can hold it in your head: read the
// cell you stand on, turn a quarter turn (which way depends on the cell's
// state), flip the cell to its next state, step forward one square. That is the
// whole machine. For the classic two-state rule it looks like pure noise for
// ten thousand steps, a shapeless scribble — and then, with nothing added, the
// ant abruptly builds a "highway": a straight diagonal corridor it lays down
// forever. Order out of a rule with no notion of order in it.
//
// This is a *generalised* ant (a one-dimensional turmite): the rule is a string
// of turns, L or R, and the cell cycles through as many states as the string is
// long, indexing which turn to make. Two letters give Langton's original and
// its highway; longer strings give filled chaos, mirror-symmetric growth, and
// spiral cardioids — the same machine, wildly different attractors. The chips
// switch the rule; click the grid to drop the ant somewhere new on a clean
// board and watch it start over.
//
// It runs off the React render path: the board is a flat Uint8Array, the ant a
// pair of integers, and each step paints only the one cell that changed, so
// thousands of steps a frame cost almost nothing. Colour is a precomputed
// lime->white ramp keyed on cell state; the ant head is a bright lime spark.
// No wall clock, no randomness — the same rule from the same cell always draws
// the same thing. Under reduced motion nothing animates: the ant is run to a
// settled number of steps synchronously and the finished figure is held still.

interface LangtonsAntProps {
  className?: string
}

interface Rule {
  /** The turn string, e.g. "RL" for the classic ant. */
  turns: string
  /** Short honest label for what this rule grows into. */
  name: string
}

// Each is a real, well-known turmite rule; the note is what it actually does.
const RULES: Rule[] = [
  { turns: 'RL', name: 'Highway' },
  { turns: 'RLR', name: 'Chaos' },
  { turns: 'LLRR', name: 'Symmetry' },
  { turns: 'LRRRRRLLR', name: 'Growth' },
  { turns: 'LLRRRLRLRLLR', name: 'Spiral' },
]

// Direction indices: 0 up, 1 right, 2 down, 3 left. dx/dy indexed by direction.
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

// How many steps to fast-forward when motion is off, so a settled figure shows.
const STATIC_STEPS = 12000
// Live steps per animation frame — brisk enough to watch order arrive, calm
// enough that the corridor and spirals read as they lay themselves down.
const STEPS_PER_FRAME = 90

const BG = '#050505'

// Precompute the fill colours for each cell state: state 0 is the board, the
// rest ride a lime->white ramp so deeper (more-visited) states read brighter.
function buildPalette(k: number): string[] {
  const out = [BG]
  const lime = [220, 248, 124]
  for (let i = 1; i < k; i++) {
    const t = k <= 2 ? 0 : (i - 1) / (k - 2)
    const r = Math.round(lime[0] + (255 - lime[0]) * t)
    const g = Math.round(lime[1] + (255 - lime[1]) * t)
    const b = Math.round(lime[2] + (255 - lime[2]) * t)
    // Dim the very first band a touch so the freshest trail isn't pure glare.
    const a = i === 1 ? 0.82 : 0.9 + 0.1 * t
    out.push(`rgba(${r},${g},${b},${a})`)
  }
  return out
}

export function LangtonsAnt({ className = '' }: LangtonsAntProps) {
  const reduce = useReducedMotion()
  const liveId = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [ruleIdx, setRuleIdx] = useState(0)
  const ruleIdxRef = useRef(0)
  ruleIdxRef.current = ruleIdx
  const [steps, setSteps] = useState(0)

  // Simulation state kept in refs so the hot loop never touches React.
  const gridRef = useRef<Uint8Array | null>(null)
  const colsRef = useRef(0)
  const rowsRef = useRef(0)
  const cellRef = useRef(6)
  const dprRef = useRef(1)
  const antRef = useRef({ x: 0, y: 0, dir: 0 })
  const headRef = useRef({ x: 0, y: 0 })
  const paletteRef = useRef<string[]>(buildPalette(2))
  const rafRef = useRef<number | null>(null)
  const stepCountRef = useRef(0)
  // Where a click asked the next reset to seed the ant, in grid cells.
  const seedRef = useRef<{ x: number; y: number } | null>(null)

  const paintCell = useCallback(
    (ctx: CanvasRenderingContext2D, gx: number, gy: number, colour: string) => {
      const cell = cellRef.current
      ctx.fillStyle = colour
      ctx.fillRect(gx * cell, gy * cell, cell, cell)
    },
    [],
  )

  const drawHead = useCallback((ctx: CanvasRenderingContext2D) => {
    const cell = cellRef.current
    const { x, y } = antRef.current
    const cx = x * cell + cell / 2
    const cy = y * cell + cell / 2
    const r = Math.max(1.6, cell * 0.62)
    ctx.beginPath()
    ctx.fillStyle = 'rgba(220,248,124,0.28)'
    ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.fillStyle = '#eaffb0'
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    headRef.current = { x, y }
  }, [])

  // Advance the simulation by `n` steps, painting each changed cell. Returns the
  // number actually run (a torus, so it never stops).
  const advance = useCallback(
    (ctx: CanvasRenderingContext2D, n: number) => {
      const grid = gridRef.current
      if (!grid) return
      const cols = colsRef.current
      const rows = rowsRef.current
      const turns = RULES[ruleIdxRef.current].turns
      const k = turns.length
      const palette = paletteRef.current
      const ant = antRef.current
      for (let i = 0; i < n; i++) {
        const idx = ant.y * cols + ant.x
        const s = grid[idx]
        // Turn per the rule for the current cell state.
        ant.dir = turns[s] === 'R' ? (ant.dir + 1) & 3 : (ant.dir + 3) & 3
        const ns = (s + 1) % k
        grid[idx] = ns
        paintCell(ctx, ant.x, ant.y, palette[ns])
        // Step forward on a wrapped torus.
        ant.x = (ant.x + DX[ant.dir] + cols) % cols
        ant.y = (ant.y + DY[ant.dir] + rows) % rows
      }
      stepCountRef.current += n
    },
    [paintCell],
  )

  // Clear the board, place the ant (at a seed cell if a click set one, else
  // centre), and reset the palette for the current rule's state count.
  const reset = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const cols = colsRef.current
      const rows = rowsRef.current
      if (!cols || !rows) return
      gridRef.current = new Uint8Array(cols * rows)
      paletteRef.current = buildPalette(RULES[ruleIdxRef.current].turns.length)
      const seed = seedRef.current
      antRef.current = {
        x: seed ? Math.min(cols - 1, Math.max(0, seed.x)) : Math.floor(cols / 2),
        y: seed ? Math.min(rows - 1, Math.max(0, seed.y)) : Math.floor(rows / 2),
        dir: 0,
      }
      stepCountRef.current = 0
      const cell = cellRef.current
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, cols * cell, rows * cell)
    },
    [],
  )

  // Size the backing store, recompute the grid, and (re)start the ant. Called on
  // mount, on resize, on rule change, and after a click reseeds it.
  const setup = useCallback(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const w = Math.round(wrap.clientWidth)
    const h = Math.round(wrap.clientHeight)
    if (!w || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cell = Math.max(5, Math.round(w / 170))
    cellRef.current = cell
    dprRef.current = dpr
    colsRef.current = Math.floor(w / cell)
    rowsRef.current = Math.floor(h / cell)
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    reset(ctx)
    if (reduce) {
      // No loop: run to a settled figure once and hold it.
      advance(ctx, STATIC_STEPS)
      drawHead(ctx)
      setSteps(STATIC_STEPS)
    }
  }, [reset, advance, drawHead, reduce])

  // The animation loop (motion on). Repaints the cell under the old head to its
  // true state, runs a batch of steps, then draws the new head.
  useEffect(() => {
    if (reduce) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    let mounted = true
    let sinceReport = 0
    const tick = () => {
      if (!mounted) return
      const grid = gridRef.current
      if (grid) {
        const cols = colsRef.current
        const head = headRef.current
        const hidx = head.y * cols + head.x
        paintCell(ctx, head.x, head.y, paletteRef.current[grid[hidx]] ?? BG)
        advance(ctx, STEPS_PER_FRAME)
        drawHead(ctx)
        // Throttle the React step read-out so the count updates ~4x/second.
        sinceReport += STEPS_PER_FRAME
        if (sinceReport >= STEPS_PER_FRAME * 6) {
          setSteps(stepCountRef.current)
          sinceReport = 0
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      mounted = false
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [reduce, advance, drawHead, paintCell])

  // Size to the container and re-run whenever the box or the rule changes.
  useEffect(() => {
    setup()
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => setup())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [setup])

  // Click (or tap) reseeds the ant at that cell on a clean board.
  const onPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!wrap || !ctx) return
      const rect = wrap.getBoundingClientRect()
      const cell = cellRef.current
      seedRef.current = {
        x: Math.floor((e.clientX - rect.left) / cell),
        y: Math.floor((e.clientY - rect.top) / cell),
      }
      reset(ctx)
      if (reduce) {
        advance(ctx, STATIC_STEPS)
        drawHead(ctx)
        setSteps(STATIC_STEPS)
      } else {
        setSteps(0)
      }
      seedRef.current = null
    },
    [reset, advance, drawHead, reduce],
  )

  const pickRule = useCallback((i: number) => {
    seedRef.current = null
    setSteps(0)
    setRuleIdx(i)
  }, [])

  const rule = RULES[ruleIdx]

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div
        ref={wrapRef}
        onPointerDown={onPointer}
        className="absolute inset-0 cursor-crosshair"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0" />
      </div>

      {/* Rule chips + live step count, low on the field so the top caption is clear. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-center gap-2 p-4">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-sm">
          {RULES.map((r, i) => (
            <button
              key={r.turns}
              type="button"
              onClick={() => pickRule(i)}
              aria-pressed={i === ruleIdx}
              className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold tracking-wide transition-colors ${
                i === ruleIdx
                  ? 'bg-[#DCF87C] text-black'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title={`Rule ${r.turns}`}
            >
              {r.name}
            </button>
          ))}
        </div>
        <span className="pointer-events-none rounded-full border border-white/10 bg-black/40 px-3 py-1 font-mono text-[0.7rem] tabular-nums text-white/50 backdrop-blur-sm">
          {rule.turns} · {steps.toLocaleString()} steps
        </span>
      </div>

      <span id={liveId} aria-live="polite" className="sr-only">
        {`Langton's ant running rule ${rule.turns} (${rule.name}). ${
          reduce
            ? 'Shown as a settled figure. Pick a rule or click the grid to redraw from a new cell.'
            : 'Pick a rule or click the grid to restart the ant on a clean board.'
        }`}
      </span>
    </div>
  )
}
