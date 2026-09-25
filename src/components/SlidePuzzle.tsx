import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// The classic 4x4 fifteen-puzzle. N tiles per side, N*N-1 numbered tiles and
// one empty slot. Kept small enough to stay square on a phone: TILE + GAP times
// four plus the outer frame lands well under 320px.
const N = 4
const COUNT = N * N
const TILE = 62
const GAP = 8
const PAD = 12
// A shuffle is a long random walk of legal slides from the solved board, so the
// scramble is always solvable (every legal move preserves the parity a solvable
// board needs) and never a trivial one- or two-move mess.
const SHUFFLE_MOVES = 120

// The solved board: 1..15 in reading order, then the empty slot (0) last.
const SOLVED: number[] = Array.from({ length: COUNT }, (_, i) => (i + 1) % COUNT)

const rowOf = (index: number) => Math.floor(index / N)
const colOf = (index: number) => index % N

// The four board positions that share an edge with `index` — the only tiles
// that can legally slide into an empty slot sitting there.
function neighbours(index: number): number[] {
  const r = rowOf(index)
  const c = colOf(index)
  const out: number[] = []
  if (r > 0) out.push(index - N)
  if (r < N - 1) out.push(index + N)
  if (c > 0) out.push(index - 1)
  if (c < N - 1) out.push(index + 1)
  return out
}

const isSolved = (b: number[]) => b.every((v, i) => v === SOLVED[i])

// Walk the board from solved by repeatedly sliding a random neighbour of the
// empty slot into it, never immediately undoing the previous slide, so the walk
// keeps wandering instead of shuffling in place. The result is always solvable
// and, for a long enough walk, never accidentally the solved board.
function scramble(): number[] {
  let board = SOLVED.slice()
  let empty = board.indexOf(0)
  let last = -1
  for (let step = 0; step < SHUFFLE_MOVES; step += 1) {
    const options = neighbours(empty).filter((n) => n !== last)
    const pick = options[Math.floor(Math.random() * options.length)]
    ;[board[empty], board[pick]] = [board[pick], board[empty]]
    last = empty
    empty = pick
  }
  if (isSolved(board)) return scramble()
  return board
}

/**
 * A fifteen-puzzle rebuilt as a real object, not a graphic. Fifteen numbered
 * tiles and one gap sit in a square frame; click any tile that shares an edge
 * with the gap and it slides in, or drive the whole board from the keyboard —
 * the arrow keys slide the tile on that side of the gap into it (ArrowUp pulls
 * the tile below the gap up, and so on, the way you would nudge the board with a
 * thumb). Every scramble is a long random walk of legal slides, so the board is
 * always solvable and never a trivial mess; a move counter tallies your slides
 * and the board locks to lime, announcing the count, the moment 1..15 fall back
 * into reading order.
 *
 * The tiles are the state: one array of sixteen values where 0 is the gap, and
 * every tile animates from its old cell to its new one on a spring, so a slide
 * reads as the tile travelling rather than blinking across. It is honest to a
 * screen reader — a labelled grid whose gap is a live status line — and under
 * prefers-reduced-motion the tiles cut straight to their cells with no travel,
 * the puzzle every bit as playable, just without the glide.
 */
export function SlidePuzzle({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [board, setBoard] = useState<number[]>(() => scramble())
  const [moves, setMoves] = useState(0)
  // Latch the win so the celebration and the announcement fire once, not on
  // every re-render while the board sits solved.
  const [won, setWon] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const solved = useMemo(() => isSolved(board), [board])
  useEffect(() => {
    if (solved && moves > 0) setWon(true)
  }, [solved, moves])

  // The empty slot's current position, and where each tile value currently sits.
  const empty = board.indexOf(0)

  // Slide the tile at board position `from` into the gap, if the two are
  // neighbours. Guards on the gap so a stale click after a reset is a no-op.
  const slide = useCallback((from: number) => {
    setBoard((prev) => {
      const gap = prev.indexOf(0)
      if (!neighbours(gap).includes(from)) return prev
      const next = prev.slice()
      ;[next[gap], next[from]] = [next[from], next[gap]]
      setMoves((m) => m + 1)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setBoard(scramble())
    setMoves(0)
    setWon(false)
  }, [])

  // Arrow keys slide the tile on that side of the gap into it: ArrowUp takes the
  // tile below the gap and pulls it up, ArrowLeft takes the tile to the right and
  // pulls it left, and so on. This matches the physical feel of nudging the
  // board rather than "moving the hole".
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const gap = board.indexOf(0)
      let from = -1
      if (e.key === 'ArrowUp' && rowOf(gap) < N - 1) from = gap + N
      else if (e.key === 'ArrowDown' && rowOf(gap) > 0) from = gap - N
      else if (e.key === 'ArrowLeft' && colOf(gap) < N - 1) from = gap + 1
      else if (e.key === 'ArrowRight' && colOf(gap) > 0) from = gap - 1
      else return
      e.preventDefault()
      slide(from)
    },
    [board, slide],
  )

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex w-full max-w-[300px] items-center justify-between px-1">
        <span className="text-sm text-white/45" aria-hidden="true">
          Moves
        </span>
        <span className="font-display text-xl font-bold tabular-nums text-white/90">{moves}</span>
      </div>

      <div
        ref={boardRef}
        role="grid"
        aria-labelledby={labelId}
        aria-rowcount={N}
        aria-colcount={N}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative mt-3 rounded-2xl border border-white/12 bg-white/[0.03] outline-none transition-colors focus-visible:border-[#DCF87C]/50"
        style={{
          width: N * TILE + (N - 1) * GAP + PAD * 2,
          height: N * TILE + (N - 1) * GAP + PAD * 2,
        }}
      >
        <span id={labelId} className="sr-only">
          Sliding tile puzzle. Click a tile next to the empty space to slide it, or use the arrow
          keys. Arrange the numbers one to fifteen in order.
        </span>

        {board.map((value, index) => {
          if (value === 0) return null
          const canMove = neighbours(empty).includes(index)
          const r = rowOf(index)
          const c = colOf(index)
          return (
            <motion.button
              key={value}
              type="button"
              onClick={() => slide(index)}
              aria-label={`Tile ${value}${canMove ? ', slide into place' : ''}`}
              disabled={!canMove || won}
              animate={{ x: PAD + c * (TILE + GAP), y: PAD + r * (TILE + GAP) }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }
              }
              whileTap={canMove && !reduce ? { scale: 0.94 } : undefined}
              className={`absolute left-0 top-0 grid place-items-center rounded-xl font-display text-2xl font-bold tabular-nums transition-colors ${
                won
                  ? 'border border-[#DCF87C]/60 bg-[#DCF87C]/15 text-[#DCF87C]'
                  : canMove
                    ? 'cursor-pointer border border-white/15 bg-white/[0.08] text-white/90 hover:border-[#DCF87C]/40 hover:text-[#DCF87C]'
                    : 'border border-white/10 bg-white/[0.05] text-white/70'
              }`}
              style={{ width: TILE, height: TILE }}
            >
              {value}
            </motion.button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
        >
          Shuffle
        </button>
        <span aria-live="polite" className="min-h-[1.25rem] text-sm text-[#DCF87C]">
          {won ? `Solved in ${moves} moves` : ''}
        </span>
      </div>
    </div>
  )
}

export default SlidePuzzle
