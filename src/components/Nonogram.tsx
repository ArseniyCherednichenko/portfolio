import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// Nonogram — a picture deduced from the numbers in its margins.
//
// The games family already holds recall (Simon), parity (Lights Out),
// deduction from feedback (Mastermind), perfect play (tic-tac-toe), order (the
// slide puzzle), a solved puzzle (peg solitaire), motion (2048) and — the piece
// right before this one — deduction from numbers under UNCERTAINTY, where a
// Minesweeper field can leave you no choice but to guess and correct play can
// still lose. This is that game's complement: deduction from numbers with
// CERTAINTY. Every clue is the run-length summary of one row or column of a
// hidden picture, a well-formed puzzle has exactly one solution, and it is
// reachable by pure logic — a line at a time, intersecting every arrangement a
// clue still allows against what you already know — without ever guessing.
//
// Honest the two ways this family cares about:
//   • The clues are not authored by hand and trusted. Each puzzle is a small
//     hand-drawn PICTURE bitmap, and every number you see is COMPUTED from it —
//     the run lengths of filled cells down each column and across each row — so
//     the margins can never disagree with the answer. The picture is the single
//     source of truth; the numbers are derived.
//   • The Deduce button plays only FORCED moves, never a guess — exactly the
//     idiom the Minesweeper next door uses. For one line it enumerates every
//     placement of the clue consistent with the cells already known, and fills
//     or crosses only the cells that come out the same in ALL of them. It makes
//     no use of the hidden picture; it reads the numbers and your marks, the
//     way you would. One press advances the deductions that are currently
//     forced, so you can watch the logic close, step by step, to the one answer.
//
// Built without canvas or image: a CSS grid of struck tiles, filled cells the
// single house lime, empties marked with a quiet cross, the clue margins
// dimming as each line is satisfied. A roving-tabindex grid makes it a real
// keyboard widget — arrows move, Enter or Space fills, X crosses, Home and End
// jump the row — every cell carrying its coordinate and state in a label, and
// a pointer drag paints a streak for mouse and touch alike. Under reduced
// motion the fill pop and the solved shimmer are dropped; the puzzle is
// identical to solve.

interface Puzzle {
  id: string
  name: string
  /** Hand-drawn picture: '#' filled, anything else empty. One string per row. */
  art: readonly string[]
}

// Three curated pictures, small to large. The clue numbers are never written
// here — they are derived from these bitmaps at module load, so a typo in a
// clue is impossible by construction.
const PUZZLES: readonly Puzzle[] = [
  {
    id: 'heart',
    name: 'Heart',
    art: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  },
  {
    id: 'umbrella',
    name: 'Umbrella',
    art: [
      '....##....',
      '..######..',
      '.########.',
      '##########',
      '....#.....',
      '....#.....',
      '....#.....',
      '....#..#..',
      '....#.##..',
      '....###...',
    ],
  },
  {
    id: 'invader',
    name: 'Invader',
    art: [
      '..#.....#..',
      '...#...#...',
      '..#######..',
      '.##.###.##.',
      '###########',
      '#.#######.#',
      '#.#.....#.#',
      '...##.##...',
    ],
  },
]

// Cell marks. 0 unknown, 1 filled, 2 crossed (known empty). Crosses are the
// player's own bookkeeping — they never affect whether the puzzle is solved,
// which is decided purely by the filled set matching the picture.
const UNKNOWN = 0
const FILLED = 1
const CROSS = 2

interface Solved {
  rows: number
  cols: number
  /** Solution membership, row-major: true where the picture is filled. */
  sol: boolean[]
  rowClues: number[][]
  colClues: number[][]
}

/** Run-length clue of one line of booleans; an empty line reads as [0]. */
function runsOf(line: boolean[]): number[] {
  const out: number[] = []
  let run = 0
  for (const on of line) {
    if (on) run++
    else if (run) {
      out.push(run)
      run = 0
    }
  }
  if (run) out.push(run)
  return out.length ? out : [0]
}

/** Derive solution membership and both clue sets from a picture bitmap. */
function compile(p: Puzzle): Solved {
  const rows = p.art.length
  const cols = p.art[0].length
  const sol: boolean[] = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) sol.push(p.art[y][x] === '#')
  const rowClues: number[][] = []
  for (let y = 0; y < rows; y++) {
    const line: boolean[] = []
    for (let x = 0; x < cols; x++) line.push(sol[y * cols + x])
    rowClues.push(runsOf(line))
  }
  const colClues: number[][] = []
  for (let x = 0; x < cols; x++) {
    const line: boolean[] = []
    for (let y = 0; y < rows; y++) line.push(sol[y * cols + x])
    colClues.push(runsOf(line))
  }
  return { rows, cols, sol, rowClues, colClues }
}

// Every placement of a clue in a line of the given length, as boolean fill
// masks. Classic recursive layout: for each block in turn, slide it across the
// remaining room, always leaving room for the blocks still to come. Clue [0] is
// the empty line and yields a single all-false placement.
function placements(len: number, clue: number[]): boolean[][] {
  if (clue.length === 1 && clue[0] === 0) return [new Array(len).fill(false)]
  const out: boolean[][] = []
  const total = clue.reduce((a, b) => a + b, 0)
  const build = (idx: number, start: number, acc: boolean[]) => {
    if (idx === clue.length) {
      out.push(acc.slice())
      return
    }
    const block = clue[idx]
    // Room the remaining blocks (and their mandatory single gaps) still need.
    let restNeed = 0
    for (let i = idx; i < clue.length; i++) restNeed += clue[i]
    restNeed += clue.length - idx - 1
    for (let s = start; s + restNeed <= len; s++) {
      const next = acc.slice()
      for (let k = 0; k < block; k++) next[s + k] = true
      build(idx + 1, s + block + 1, next)
    }
  }
  if (total + clue.length - 1 <= len) build(0, 0, new Array(len).fill(false))
  return out
}

interface NonogramProps {
  className?: string
}

type Status = 'solving' | 'solved'

export function Nonogram({ className = '' }: NonogramProps) {
  const reduce = useReducedMotion()
  const uid = useId()

  const [puzzleId, setPuzzleId] = useState<string>(PUZZLES[0].id)
  const puzzle = useMemo(() => PUZZLES.find((p) => p.id === puzzleId) ?? PUZZLES[0], [puzzleId])
  const solved = useMemo(() => compile(puzzle), [puzzle])
  const { rows, cols, sol, rowClues, colClues } = solved
  const total = rows * cols

  const [marks, setMarks] = useState<number[]>(() => new Array(total).fill(UNKNOWN))
  const [mode, setMode] = useState<'fill' | 'cross'>('fill')
  const [status, setStatus] = useState<Status>('solving')
  const [focusIdx, setFocusIdx] = useState(0)
  const [announce, setAnnounce] = useState('')
  const [solveNonce, setSolveNonce] = useState(0)

  // Reset all transient state whenever the puzzle changes.
  useEffect(() => {
    setMarks(new Array(total).fill(UNKNOWN))
    setStatus('solving')
    setFocusIdx(0)
    setAnnounce('')
  }, [puzzleId, total])

  // Win is decided only by the filled set equalling the picture — crosses are
  // never consulted, exactly as in paper nonograms.
  useEffect(() => {
    if (status === 'solved') return
    let ok = true
    for (let i = 0; i < total; i++) {
      if (sol[i] !== (marks[i] === FILLED)) {
        ok = false
        break
      }
    }
    if (ok) {
      setStatus('solved')
      setSolveNonce((n) => n + 1)
      setAnnounce(`Solved — ${puzzle.name}.`)
    }
  }, [marks, sol, total, status, puzzle.name])

  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    cellRefs.current = cellRefs.current.slice(0, total)
  }, [total])

  const setCell = useCallback(
    (idx: number, value: number) => {
      setMarks((prev) => {
        if (prev[idx] === value) return prev
        const next = prev.slice()
        next[idx] = value
        return next
      })
    },
    [],
  )

  // One tap/click/keypress on a cell, toggling by the active mode.
  const toggle = useCallback(
    (idx: number, forceCross = false) => {
      if (status === 'solved') return
      const useCross = forceCross || mode === 'cross'
      setMarks((prev) => {
        const next = prev.slice()
        if (useCross) next[idx] = prev[idx] === CROSS ? UNKNOWN : CROSS
        else next[idx] = prev[idx] === FILLED ? UNKNOWN : FILLED
        return next
      })
    },
    [mode, status],
  )

  // --- Pointer drag painting -------------------------------------------------
  // A press decides a single target state from the first cell, and the drag
  // then stamps that same state onto every cell it crosses, for mouse and
  // touch alike (the grid takes touch-action:none so a drag paints, not
  // scrolls). elementFromPoint keeps touch working, where pointerenter does not.
  const paint = useRef<{ active: boolean; target: number } | null>(null)

  const applyPaint = useCallback(
    (idx: number) => {
      const p = paint.current
      if (!p || !p.active) return
      setCell(idx, p.target)
    },
    [setCell],
  )

  const onPointerDown = useCallback(
    (idx: number, e: React.PointerEvent) => {
      if (status === 'solved') return
      if (e.button === 2) {
        // Right button always crosses, and does not start a paint drag.
        toggle(idx, true)
        return
      }
      const useCross = mode === 'cross'
      const cur = marks[idx]
      let target: number
      if (useCross) target = cur === CROSS ? UNKNOWN : CROSS
      else target = cur === FILLED ? UNKNOWN : FILLED
      paint.current = { active: true, target }
      setCell(idx, target)
    },
    [marks, mode, status, toggle, setCell],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!paint.current?.active) return
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const holder = el?.closest('[data-cell]') as HTMLElement | null
      if (!holder) return
      const idx = Number(holder.getAttribute('data-cell'))
      if (Number.isFinite(idx)) applyPaint(idx)
    }
    const onUp = () => {
      paint.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [applyPaint])

  // --- Keyboard --------------------------------------------------------------
  const focusCell = useCallback((idx: number) => {
    setFocusIdx(idx)
    cellRefs.current[idx]?.focus()
  }, [])

  const onCellKey = useCallback(
    (idx: number, e: React.KeyboardEvent) => {
      const r = Math.floor(idx / cols)
      const c = idx % cols
      let handled = true
      switch (e.key) {
        case 'ArrowLeft':
          focusCell(r * cols + Math.max(0, c - 1))
          break
        case 'ArrowRight':
          focusCell(r * cols + Math.min(cols - 1, c + 1))
          break
        case 'ArrowUp':
          focusCell(Math.max(0, r - 1) * cols + c)
          break
        case 'ArrowDown':
          focusCell(Math.min(rows - 1, r + 1) * cols + c)
          break
        case 'Home':
          focusCell(r * cols)
          break
        case 'End':
          focusCell(r * cols + cols - 1)
          break
        case 'Enter':
        case ' ':
          toggle(idx)
          break
        case 'x':
        case 'X':
          toggle(idx, true)
          break
        default:
          handled = false
      }
      if (handled) e.preventDefault()
    },
    [cols, rows, focusCell, toggle],
  )

  // --- Deduce: one pass of only-forced line logic ----------------------------
  const deduce = useCallback(() => {
    if (status === 'solved') return
    setMarks((prev) => {
      const next = prev.slice()
      let changed = false

      const solveLine = (indices: number[], clue: number[]) => {
        const len = indices.length
        const known = indices.map((i) => prev[i]) // snapshot from the pass start
        const all = placements(len, clue)
        const fits = all.filter((mask) => {
          for (let k = 0; k < len; k++) {
            if (known[k] === FILLED && !mask[k]) return false
            if (known[k] === CROSS && mask[k]) return false
          }
          return true
        })
        if (fits.length === 0) return
        for (let k = 0; k < len; k++) {
          if (known[k] !== UNKNOWN) continue
          let allTrue = true
          let allFalse = true
          for (const mask of fits) {
            if (mask[k]) allFalse = false
            else allTrue = false
            if (!allTrue && !allFalse) break
          }
          if (allTrue && next[indices[k]] !== FILLED) {
            next[indices[k]] = FILLED
            changed = true
          } else if (allFalse && next[indices[k]] !== CROSS) {
            next[indices[k]] = CROSS
            changed = true
          }
        }
      }

      for (let y = 0; y < rows; y++) {
        const idxs: number[] = []
        for (let x = 0; x < cols; x++) idxs.push(y * cols + x)
        solveLine(idxs, rowClues[y])
      }
      for (let x = 0; x < cols; x++) {
        const idxs: number[] = []
        for (let y = 0; y < rows; y++) idxs.push(y * cols + x)
        solveLine(idxs, colClues[x])
      }

      if (!changed) {
        setAnnounce('No forced move left — the rest needs you.')
        return prev
      }
      setAnnounce('Filled every cell the numbers currently force.')
      return next
    })
  }, [rows, cols, rowClues, colClues, status])

  const reset = useCallback(() => {
    setMarks(new Array(total).fill(UNKNOWN))
    setStatus('solving')
    setAnnounce('Cleared.')
  }, [total])

  // A line's clue dims once its filled runs match the clue exactly — the
  // standard "this row is done" cue (unknown cells read as empty for the test).
  const rowDone = useMemo(() => {
    const out: boolean[] = []
    for (let y = 0; y < rows; y++) {
      const line: boolean[] = []
      for (let x = 0; x < cols; x++) line.push(marks[y * cols + x] === FILLED)
      out.push(sameRuns(runsOf(line), rowClues[y]))
    }
    return out
  }, [marks, rows, cols, rowClues])

  const colDone = useMemo(() => {
    const out: boolean[] = []
    for (let x = 0; x < cols; x++) {
      const line: boolean[] = []
      for (let y = 0; y < rows; y++) line.push(marks[y * cols + x] === FILLED)
      out.push(sameRuns(runsOf(line), colClues[x]))
    }
    return out
  }, [marks, rows, cols, colClues])

  const maxRowClue = useMemo(() => Math.max(1, ...rowClues.map((c) => c.length)), [rowClues])
  const maxColClue = useMemo(() => Math.max(1, ...colClues.map((c) => c.length)), [colClues])

  const filledCount = useMemo(() => marks.filter((m) => m === FILLED).length, [marks])
  const solTarget = useMemo(() => sol.filter(Boolean).length, [sol])

  // Cell size shrinks for the wider boards so every puzzle fits a phone.
  const cell = cols >= 11 ? 'clamp(20px, 6.6vw, 36px)' : cols >= 10 ? 'clamp(22px, 7vw, 38px)' : 'clamp(30px, 10vw, 52px)'

  return (
    <div className={className}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {PUZZLES.map((p) => {
            const active = p.id === puzzleId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPuzzleId(p.id)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? 'bg-[#DCF87C] text-black' : 'text-white/60 hover:text-white/90'
                }`}
              >
                {p.name}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setMode('fill')}
            aria-pressed={mode === 'fill'}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'fill' ? 'bg-[#DCF87C] text-black' : 'text-white/60 hover:text-white/90'
            }`}
          >
            Fill
          </button>
          <button
            type="button"
            onClick={() => setMode('cross')}
            aria-pressed={mode === 'cross'}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'cross' ? 'bg-white/80 text-black' : 'text-white/60 hover:text-white/90'
            }`}
          >
            Cross
          </button>
        </div>

        <button
          type="button"
          onClick={deduce}
          disabled={status === 'solved'}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-3.5 py-1.5 text-xs font-semibold text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Deduce
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:text-white/90"
        >
          Reset
        </button>
      </div>

      {/* Board */}
      <div className="mt-8 flex justify-center overflow-x-auto">
        <div
          className="inline-grid select-none"
          style={{
            gridTemplateColumns: `max-content repeat(${cols}, ${cell})`,
            gridTemplateRows: `max-content repeat(${rows}, ${cell})`,
            touchAction: 'none',
          }}
        >
          {/* Corner */}
          <div aria-hidden style={{ gridColumn: 1, gridRow: 1 }} />

          {/* Column clues */}
          {colClues.map((clue, x) => (
            <div
              key={`cc-${x}`}
              aria-hidden
              className="flex flex-col items-center justify-end gap-0.5 pb-1.5"
              style={{ gridColumn: x + 2, gridRow: 1, minHeight: `calc(${maxColClue} * 1.15em + 0.6rem)` }}
            >
              {clue.map((n, i) => (
                <span
                  key={i}
                  className={`text-[0.68rem] font-semibold leading-none tabular-nums transition-colors ${
                    colDone[x] ? 'text-[#DCF87C]/35' : 'text-white/70'
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
          ))}

          {/* Rows: left clue + cells */}
          {Array.from({ length: rows }).map((_, y) => (
            <RowFragment key={`row-${y}`}>
              <div
                aria-hidden
                className="flex items-center justify-end gap-1.5 pr-2"
                style={{ gridColumn: 1, gridRow: y + 2, minWidth: `calc(${maxRowClue} * 1.1em + 0.8rem)` }}
              >
                {rowClues[y].map((n, i) => (
                  <span
                    key={i}
                    className={`text-[0.72rem] font-semibold leading-none tabular-nums transition-colors ${
                      rowDone[y] ? 'text-[#DCF87C]/35' : 'text-white/70'
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>

              {Array.from({ length: cols }).map((_, x) => {
                const idx = y * cols + x
                const m = marks[idx]
                const label = `Row ${y + 1}, column ${x + 1}: ${
                  m === FILLED ? 'filled' : m === CROSS ? 'crossed empty' : 'unknown'
                }`
                // Group lines of five with a faintly heavier edge, the classic
                // nonogram guide — a 1px brighter border on every fifth boundary.
                const heavyL = x % 5 === 0 && x !== 0
                const heavyT = y % 5 === 0 && y !== 0
                return (
                  <button
                    key={idx}
                    ref={(el) => {
                      cellRefs.current[idx] = el
                    }}
                    type="button"
                    data-cell={idx}
                    tabIndex={idx === focusIdx ? 0 : -1}
                    aria-label={label}
                    aria-pressed={m === FILLED}
                    onPointerDown={(e) => onPointerDown(idx, e)}
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={(e) => onCellKey(idx, e)}
                    onFocus={() => setFocusIdx(idx)}
                    className="relative flex items-center justify-center border border-white/10 outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#DCF87C] focus-visible:ring-offset-0"
                    style={{
                      gridColumn: x + 2,
                      gridRow: y + 2,
                      borderLeftColor: heavyL ? 'rgba(255,255,255,0.28)' : undefined,
                      borderTopColor: heavyT ? 'rgba(255,255,255,0.28)' : undefined,
                      background: m === FILLED ? undefined : 'rgba(255,255,255,0.015)',
                    }}
                  >
                    {m === FILLED && (
                      <motion.span
                        className="absolute inset-[2px] rounded-[3px]"
                        style={{ background: '#DCF87C' }}
                        initial={reduce ? false : { scale: 0.4, opacity: 0.3 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 26 }}
                      />
                    )}
                    {m === CROSS && (
                      <span aria-hidden className="text-[0.8em] font-bold leading-none text-white/25">
                        &times;
                      </span>
                    )}
                  </button>
                )
              })}
            </RowFragment>
          ))}
        </div>
      </div>

      {/* Status line */}
      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        <motion.p
          key={`${puzzle.id}-${status}-${solveNonce}`}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`text-sm font-semibold ${status === 'solved' ? 'text-[#DCF87C]' : 'text-white/70'}`}
        >
          {status === 'solved'
            ? `Solved — it was ${article(puzzle.name)} ${puzzle.name.toLowerCase()}.`
            : `${filledCount} of ${solTarget} cells filled`}
        </motion.p>
        <p className="text-xs text-white/40">
          {status === 'solved'
            ? 'Every row and column agrees with its numbers.'
            : 'Fill the cells each row and column counts demand. Cross the ones you can rule out.'}
        </p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <p id={`${uid}-help`} className="sr-only">
        Grid of cells. Arrow keys move between cells, Enter or Space fills a cell, X crosses it as
        known-empty, Home and End jump to the ends of a row. The numbers beside each row and column
        are the lengths of the filled runs in the hidden picture.
      </p>
    </div>
  )
}

// A tiny fragment wrapper so each row's clue and cells sit directly in the grid
// (React fragments cannot carry the key in a .map and also hold grid children
// cleanly across TS, so this keeps the markup flat and typed).
function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function sameRuns(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}
