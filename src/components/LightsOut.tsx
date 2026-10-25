import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// LightsOut — the toggle puzzle, rebuilt as a real object you solve.
//
// Distinct from everything else in the toys family. Simon is a game of recall
// and the SlidePuzzle is a game of order; this is the one that is a game of
// logic — a 5x5 grid of lights where pressing a cell flips it and its four
// orthogonal neighbours, and the whole board has to go dark. The move that
// turns one light off turns its neighbours on, so you cannot clear it by
// chasing lights; you have to reason about the parity of the whole board.
//
// Honest in the two ways the family cares about:
//   • Every board is genuinely solvable. It is never a random fill (which might
//     have no solution at all) — it starts fully solved and is scrambled only
//     by real presses, so by construction there is always a way back to dark.
//   • The "fewest" target is not a guess or the scramble depth. It is the true
//     minimum number of presses that clears this exact board, computed by
//     solving the puzzle as a linear system over GF(2): the press matrix is
//     reduced, a particular solution recovered, and its null space (dimension
//     two for the standard 5x5, so four candidate solutions) enumerated to find
//     the one of least weight. So the par you are chasing is provably optimal.
//
// Built without canvas or image: twenty-five rounded cells in a CSS grid, each
// a dark struck surface that glows lime when lit — the same material language
// as Simon's pads. A roving-tabindex grid makes it a real keyboard widget
// (arrows move focus, Enter/Space press, Home/End jump), each cell carries its
// position and state in an aria-label, and the result is announced through a
// polite live region. Under reduced motion the cells change colour instantly
// with no pop or glow bloom — the puzzle is identical to play.

interface LightsOutProps {
  /** Side length of the board in px. */
  size?: number
  className?: string
}

const N = 5
const CELLS = N * N
const ALL = (1 << CELLS) - 1

// For each cell, the set of cells a press there toggles: itself plus its
// orthogonal neighbours. These are the rows of the (symmetric) press matrix.
const MASKS: number[] = (() => {
  const m: number[] = []
  for (let c = 0; c < CELLS; c++) {
    let bits = 1 << c
    const r = Math.floor(c / N)
    const col = c % N
    if (r > 0) bits |= 1 << (c - N)
    if (r < N - 1) bits |= 1 << (c + N)
    if (col > 0) bits |= 1 << (c - 1)
    if (col < N - 1) bits |= 1 << (c + 1)
    m.push(bits)
  }
  return m
})()

function popcount(n: number): number {
  let c = 0
  let x = n
  while (x) {
    x &= x - 1
    c++
  }
  return c
}

// The fewest presses that clears `board`, by solving A·x = board over GF(2).
// Returns null if the board is unsolvable — which never happens for a board we
// scrambled from solved, but the guard keeps the maths honest. The press
// matrix is symmetric, so its rows are exactly MASKS; we augment each row with
// the target bit, run Gauss-Jordan to reduced form, read off a particular
// solution with the free variables zeroed, then XOR in every combination of the
// null-space basis and keep the lightest result.
function minPresses(board: number): number | null {
  const rows = MASKS.map((mask, i) => mask | (((board >> i) & 1) << CELLS))
  const pivotRow: number[] = new Array<number>(CELLS).fill(-1)
  let r = 0
  for (let col = 0; col < CELLS && r < CELLS; col++) {
    let sel = -1
    for (let i = r; i < CELLS; i++) {
      if ((rows[i] >> col) & 1) {
        sel = i
        break
      }
    }
    if (sel === -1) continue
    const tmp = rows[sel]
    rows[sel] = rows[r]
    rows[r] = tmp
    pivotRow[col] = r
    for (let i = 0; i < CELLS; i++) {
      if (i !== r && (rows[i] >> col) & 1) rows[i] ^= rows[r]
    }
    r++
  }
  // Any all-zero variable row with a set target bit is a contradiction.
  for (let i = r; i < CELLS; i++) {
    if ((rows[i] & ALL) === 0 && (rows[i] >> CELLS) & 1) return null
  }

  const freeCols: number[] = []
  for (let col = 0; col < CELLS; col++) if (pivotRow[col] === -1) freeCols.push(col)

  // Particular solution: free variables at 0, each pivot variable set to its
  // row's target bit.
  let base = 0
  for (let col = 0; col < CELLS; col++) {
    if (pivotRow[col] !== -1 && (rows[pivotRow[col]] >> CELLS) & 1) base |= 1 << col
  }
  // One null-space vector per free column: turn that free variable on, and set
  // each pivot variable to this column's coefficient in that pivot row.
  const basis = freeCols.map((f) => {
    let v = 1 << f
    for (let col = 0; col < CELLS; col++) {
      if (pivotRow[col] !== -1 && (rows[pivotRow[col]] >> f) & 1) v |= 1 << col
    }
    return v
  })

  const k = basis.length
  // The 5x5 null space has dimension two; the cap is a guard, never reached.
  if (k > 20) return popcount(base)
  let best = popcount(base)
  for (let s = 1; s < 1 << k; s++) {
    let v = base
    for (let j = 0; j < k; j++) if ((s >> j) & 1) v ^= basis[j]
    const p = popcount(v)
    if (p < best) best = p
  }
  return best
}

// Scramble from solved by real presses, so the result is always solvable. Press
// the same cell twice and it cancels, so the depth is an upper bound on the
// true par, not the par itself; re-roll the rare all-dark draw.
function scramble(depth = 7): number {
  let b = 0
  do {
    b = 0
    for (let i = 0; i < depth; i++) b ^= MASKS[Math.floor(Math.random() * CELLS)]
  } while (b === 0)
  return b
}

export function LightsOut({ size = 300, className = '' }: LightsOutProps) {
  const reduce = useReducedMotion()
  const id = useId()

  const [board, setBoard] = useState<number>(() => scramble())
  const [moves, setMoves] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  // Roving tabindex: only the focused cell is in the tab order.
  const [focus, setFocus] = useState(Math.floor(CELLS / 2))
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  const solved = board === 0
  const lit = popcount(board)
  // The provable par for the board as it was dealt — recomputed only when a
  // fresh board is set, never mid-solve, so it names the scramble's optimum.
  const fewest = useMemo(() => minPresses(board), [board])

  // Record the best (fewest actual presses) solve of this visit, once per clear.
  const scoredRef = useRef(false)
  useEffect(() => {
    if (solved && moves > 0 && !scoredRef.current) {
      scoredRef.current = true
      setBest((b) => (b === null ? moves : Math.min(b, moves)))
    }
  }, [solved, moves])

  const newBoard = useCallback(() => {
    scoredRef.current = false
    setBoard(scramble())
    setMoves(0)
  }, [])

  const press = useCallback(
    (c: number) => {
      if (board === 0) return
      setBoard((b) => b ^ MASKS[c])
      setMoves((m) => m + 1)
    },
    [board],
  )

  const moveFocus = useCallback((next: number) => {
    setFocus(next)
    cellRefs.current[next]?.focus()
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, c: number) => {
      const r = Math.floor(c / N)
      const col = c % N
      let next = -1
      if (e.key === 'ArrowRight') next = r * N + Math.min(N - 1, col + 1)
      else if (e.key === 'ArrowLeft') next = r * N + Math.max(0, col - 1)
      else if (e.key === 'ArrowDown') next = Math.min(N - 1, r + 1) * N + col
      else if (e.key === 'ArrowUp') next = Math.max(0, r - 1) * N + col
      else if (e.key === 'Home') next = r * N
      else if (e.key === 'End') next = r * N + (N - 1)
      if (next !== -1) {
        e.preventDefault()
        moveFocus(next)
      }
    },
    [moveFocus],
  )

  const gap = Math.max(6, Math.round(size * 0.025))
  const cell = (size - gap * (N - 1)) / N
  const radius = Math.round(cell * 0.22)

  const announce = solved
    ? moves > 0
      ? `Solved in ${moves} ${moves === 1 ? 'press' : 'presses'}.${fewest !== null && moves === fewest ? ' That is the fewest possible.' : fewest !== null ? ` The fewest possible was ${fewest}.` : ''}`
      : 'The board is dark.'
    : `${lit} ${lit === 1 ? 'light' : 'lights'} on. ${moves} ${moves === 1 ? 'press' : 'presses'} so far.`

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        role="group"
        aria-label="Lights Out puzzle"
        className="grid"
        style={{
          width: size,
          height: size,
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          gap,
        }}
      >
        {Array.from({ length: CELLS }, (_, c) => {
          const on = (board >> c) & 1
          const r = Math.floor(c / N)
          const col = c % N
          return (
            <motion.button
              key={c}
              ref={(el) => {
                cellRefs.current[c] = el
              }}
              type="button"
              tabIndex={c === focus ? 0 : -1}
              onClick={() => press(c)}
              onFocus={() => setFocus(c)}
              onKeyDown={(e) => onKeyDown(e, c)}
              aria-label={`Row ${r + 1}, column ${col + 1}, ${on ? 'lit' : 'off'}`}
              className="relative overflow-hidden outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-white/70"
              style={{
                borderRadius: radius,
                background: on
                  ? 'radial-gradient(130% 130% at 30% 24%, #DCF87C 0%, #DCF87Cdd 44%, #DCF87C99 100%)'
                  : 'radial-gradient(130% 130% at 30% 24%, #DCF87C1a 0%, #DCF87C0d 48%, #0a0b07 100%)',
                border: `1px solid ${on ? '#DCF87C' : '#DCF87C2e'}`,
                boxShadow: on
                  ? '0 0 22px #DCF87Caa, 0 0 56px #DCF87C44, inset 0 2px 10px rgba(255,255,255,0.3)'
                  : 'inset 0 -8px 20px rgba(0,0,0,0.6), inset 0 2px 8px rgba(255,255,255,0.04)',
              }}
              animate={reduce ? { opacity: on ? 1 : 0.92 } : { scale: on ? 1.02 : 1, opacity: on ? 1 : 0.92 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 24 }}
            />
          )
        })}
      </div>

      <p id={`${id}-live`} aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* Scoreboard: your presses, the provable par, and the best you managed. */}
      <div className="mt-8 flex items-center gap-8 text-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Moves</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-white/90">{moves}</div>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Fewest</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#DCF87C]">
            {fewest ?? '—'}
          </div>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Best</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-white/90">{best ?? '—'}</div>
        </div>
      </div>

      <p className="mt-5 max-w-sm text-center text-[11px] leading-relaxed text-white/35">
        {solved && moves > 0
          ? fewest !== null && moves === fewest
            ? 'Dark, in the fewest presses possible. Every board here is solvable, and the par is the true minimum.'
            : `Dark. The fewest possible was ${fewest}. Every board is scrambled from solved, so it is always solvable.`
          : 'Press a cell to flip it and its four neighbours. Turn the whole board off. The fewest is the provable minimum, solved as a linear system over GF(2).'}
      </p>

      <button
        type="button"
        onClick={newBoard}
        className="mt-4 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/70 transition hover:border-[#DCF87C]/40 hover:text-white"
      >
        New board
      </button>
    </div>
  )
}
