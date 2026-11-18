import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// Minesweeper — the field of hidden mines, rebuilt as a real object you reason on.
//
// The games family already holds recall (Simon), parity (Lights Out), deduction
// from feedback (Mastermind), perfect play (tic-tac-toe), a solved puzzle (peg
// solitaire) and motion (2048). This is the one that is deduction from NUMBERS
// under uncertainty: every revealed square tells you how many of its eight
// neighbours are mined, and the whole game is reading those counts against one
// another to decide what must be safe, what must be a mine, and — honestly —
// where the field leaves you no choice but to guess. It is the only toy in the
// family where correct play can still lose, and the piece says so rather than
// pretending otherwise.
//
// Honest the two ways this family cares about:
//   • The first click is always safe, and it opens a region. Mines are not laid
//     until after the first reveal, and never on the clicked cell or its eight
//     neighbours, so the opening move can never be a loss and never a lone 8 —
//     the standard "first click is an opening" rule, not a reshuffle under you.
//   • Every number is the exact count of mined neighbours, computed once when
//     the mines are placed and never nudged. The board is never rearranged to
//     keep you guessing, and the Deduce button only ever plays FORCED moves —
//     cells the current numbers prove are safe or prove are mined, never a
//     guess — so it is a proof that the numbers are real constraints, not a
//     solver that cheats by reading the hidden board.
//
// Built without canvas or image: a CSS grid of struck tiles, numbers stepped
// along the single house lime from a dim 1 to a near-white 8 so count reads as
// brightness and the palette stays one hue. A roving-tabindex grid makes it a
// real keyboard widget — arrows move, Enter or Space reveals, F flags, Home and
// End jump the row — every cell carries its position and state in a label, and
// each reveal, flag and outcome is announced through a polite live region.
// Under reduced motion the flood opens with no ripple or pop; the game is
// identical to play.

interface Level {
  id: string
  label: string
  cols: number
  rows: number
  mines: number
}

const LEVELS: readonly Level[] = [
  { id: 'beginner', label: 'Beginner', cols: 9, rows: 9, mines: 10 },
  { id: 'intermediate', label: 'Intermediate', cols: 12, rows: 12, mines: 24 },
]

// The single hue, stepped by neighbour count: dim lime at 1 climbing to white at
// 8, so the number reads as brightness and nothing new is introduced to the
// palette. Index by count; 0 never renders a glyph.
const NUM_COLOR: readonly string[] = [
  '',
  'rgba(220,248,124,0.55)',
  'rgba(220,248,124,0.70)',
  'rgba(224,250,140,0.82)',
  'rgba(228,252,160,0.92)',
  'rgba(234,253,182,0.97)',
  'rgba(242,254,204,1)',
  'rgba(248,255,226,1)',
  '#ffffff',
]

type Status = 'playing' | 'won' | 'lost'

interface MinesweeperProps {
  className?: string
}

export function Minesweeper({ className = '' }: MinesweeperProps) {
  const reduce = useReducedMotion()
  const id = useId()

  const [level, setLevel] = useState<Level>(LEVELS[0])
  const { cols, rows, mines: mineCount } = level
  const total = cols * rows

  // Board state. `placed` gates mine-laying until the first reveal so it can be
  // made safe; `counts` is the exact adjacent-mine tally per cell.
  const [mine, setMine] = useState<boolean[]>(() => Array(total).fill(false))
  const [counts, setCounts] = useState<number[]>(() => Array(total).fill(0))
  const [revealed, setRevealed] = useState<boolean[]>(() => Array(total).fill(false))
  const [flagged, setFlagged] = useState<boolean[]>(() => Array(total).fill(false))
  const [placed, setPlaced] = useState(false)
  const [status, setStatus] = useState<Status>('playing')
  const [exploded, setExploded] = useState(-1)
  const [flagMode, setFlagMode] = useState(false)
  // Per-cell reveal delay, for the opening ripple (0 under reduced motion).
  const delayRef = useRef<number[]>(Array(total).fill(0))

  // Roving tabindex: only the focused cell sits in the tab order.
  const [focus, setFocus] = useState(0)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Timer: starts on the first reveal, stops when the game ends.
  const [started, setStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startAt = useRef(0)
  useEffect(() => {
    if (!started || status !== 'playing') return
    const tick = () => setElapsed(Math.min(999, Math.floor((performance.now() - startAt.current) / 1000)))
    const t = window.setInterval(tick, 250)
    return () => window.clearInterval(t)
  }, [started, status])

  const neighbours = useCallback(
    (c: number): number[] => {
      const r = Math.floor(c / cols)
      const col = c % cols
      const out: number[] = []
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = col + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          out.push(nr * cols + nc)
        }
      }
      return out
    },
    [cols, rows],
  )

  const reset = useCallback(
    (lv: Level) => {
      const t = lv.cols * lv.rows
      setMine(Array(t).fill(false))
      setCounts(Array(t).fill(0))
      setRevealed(Array(t).fill(false))
      setFlagged(Array(t).fill(false))
      delayRef.current = Array(t).fill(0)
      setPlaced(false)
      setStatus('playing')
      setExploded(-1)
      setStarted(false)
      setElapsed(0)
      setFocus(0)
    },
    [],
  )

  const chooseLevel = useCallback(
    (lv: Level) => {
      setLevel(lv)
      reset(lv)
    },
    [reset],
  )

  // Lay the mines after the first reveal, keeping the clicked cell and its eight
  // neighbours clear so the opening move always flood-opens a region. Returns the
  // freshly built mine + count arrays so the triggering reveal can run against
  // them synchronously rather than waiting for state to settle.
  const layMines = useCallback(
    (safe: number): { mine: boolean[]; counts: number[] } => {
      const forbidden = new Set<number>([safe, ...neighbours(safe)])
      const pool: number[] = []
      for (let i = 0; i < total; i++) if (!forbidden.has(i)) pool.push(i)
      // Fisher–Yates over the eligible cells, take the first `mineCount`.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      const m = Array(total).fill(false)
      for (let i = 0; i < mineCount && i < pool.length; i++) m[pool[i]] = true
      const c = Array(total).fill(0)
      for (let i = 0; i < total; i++) {
        if (m[i]) continue
        c[i] = neighbours(i).reduce((a, n) => a + (m[n] ? 1 : 0), 0)
      }
      return { mine: m, counts: c }
    },
    [neighbours, total, mineCount],
  )

  // Flood-reveal from `start` against the given board, mutating a copy of the
  // revealed array. Zero-count cells open their neighbours; numbered cells stop
  // the flood. A Chebyshev-distance delay from the seed gives the opening its
  // ripple (flattened to 0 under reduced motion).
  const flood = useCallback(
    (start: number, m: boolean[], c: number[], rev: boolean[], flags: boolean[]): boolean[] => {
      const next = rev.slice()
      const delays = delayRef.current.slice()
      const sr = Math.floor(start / cols)
      const sc = start % cols
      const queue = [start]
      while (queue.length) {
        const cur = queue.shift() as number
        if (next[cur] || flags[cur]) continue
        next[cur] = true
        const dr = Math.abs(Math.floor(cur / cols) - sr)
        const dc = Math.abs((cur % cols) - sc)
        delays[cur] = reduce ? 0 : Math.min(0.012 * Math.max(dr, dc), 0.26)
        if (c[cur] === 0 && !m[cur]) {
          for (const n of neighbours(cur)) if (!next[n] && !flags[n]) queue.push(n)
        }
      }
      delayRef.current = delays
      return next
    },
    [cols, neighbours, reduce],
  )

  const checkWin = useCallback(
    (rev: boolean[], m: boolean[]): boolean => {
      for (let i = 0; i < total; i++) if (!m[i] && !rev[i]) return false
      return true
    },
    [total],
  )

  const reveal = useCallback(
    (c: number) => {
      if (status !== 'playing' || revealed[c] || flagged[c]) return

      let m = mine
      let cnt = counts
      if (!placed) {
        const laid = layMines(c)
        m = laid.mine
        cnt = laid.counts
        setMine(m)
        setCounts(cnt)
        setPlaced(true)
        setStarted(true)
        startAt.current = performance.now()
      }

      if (m[c]) {
        // Struck a mine: reveal the whole field and end the game.
        setExploded(c)
        setRevealed(Array(total).fill(true))
        setStatus('lost')
        return
      }

      const next = flood(c, m, cnt, revealed, flagged)
      setRevealed(next)
      if (checkWin(next, m)) {
        // Flag every remaining mine for a tidy finish, stop the clock.
        setFlagged((f) => f.map((v, i) => v || m[i]))
        setStatus('won')
      }
    },
    [status, revealed, flagged, mine, counts, placed, layMines, flood, checkWin, total],
  )

  const toggleFlag = useCallback(
    (c: number) => {
      if (status !== 'playing' || revealed[c]) return
      setFlagged((f) => {
        const next = f.slice()
        next[c] = !next[c]
        return next
      })
    },
    [status, revealed],
  )

  // Chord / primary action on a cell, honouring flag mode for touch.
  const primary = useCallback(
    (c: number) => {
      if (flagMode) toggleFlag(c)
      else reveal(c)
    },
    [flagMode, toggleFlag, reveal],
  )

  // Deduce — one pass of single-point logic, trusting your flags as the mines.
  // For each revealed number: if its flagged neighbours already equal its count,
  // every other hidden neighbour is provably safe (reveal them); if its hidden
  // plus flagged neighbours equal its count, every hidden neighbour is provably
  // a mine (flag them). Only forced moves — never a guess.
  const [deduceNote, setDeduceNote] = useState('')
  const deduce = useCallback(() => {
    if (status !== 'playing') return
    const toReveal = new Set<number>()
    const toFlag = new Set<number>()
    for (let c = 0; c < total; c++) {
      if (!revealed[c] || mine[c] || counts[c] === 0) continue
      const ns = neighbours(c)
      const hidden = ns.filter((n) => !revealed[n] && !flagged[n])
      if (hidden.length === 0) continue
      const flags = ns.filter((n) => flagged[n]).length
      if (flags === counts[c]) hidden.forEach((n) => toReveal.add(n))
      else if (flags + hidden.length === counts[c]) hidden.forEach((n) => toFlag.add(n))
    }
    if (toFlag.size === 0 && toReveal.size === 0) {
      setDeduceNote('No forced move — this position needs a guess.')
      return
    }
    if (toFlag.size > 0) {
      setFlagged((f) => {
        const next = f.slice()
        toFlag.forEach((n) => {
          next[n] = true
        })
        return next
      })
    }
    // Reveal the proven-safe cells one at a time so each flood runs correctly.
    toReveal.forEach((n) => reveal(n))
    const parts: string[] = []
    if (toFlag.size) parts.push(`flagged ${toFlag.size} forced ${toFlag.size === 1 ? 'mine' : 'mines'}`)
    if (toReveal.size) parts.push(`opened ${toReveal.size} proven-safe ${toReveal.size === 1 ? 'cell' : 'cells'}`)
    setDeduceNote(`Deduced: ${parts.join(', ')}.`)
  }, [status, total, revealed, mine, counts, flagged, neighbours, reveal])

  // Clear the deduce note whenever the player acts or the board resets.
  useEffect(() => {
    setDeduceNote('')
  }, [placed, level])

  const flagsUsed = useMemo(() => flagged.reduce((a, v) => a + (v ? 1 : 0), 0), [flagged])
  const remaining = mineCount - flagsUsed

  const moveFocus = useCallback((next: number) => {
    setFocus(next)
    cellRefs.current[next]?.focus()
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, c: number) => {
      const r = Math.floor(c / cols)
      const col = c % cols
      let next = -1
      if (e.key === 'ArrowRight') next = r * cols + Math.min(cols - 1, col + 1)
      else if (e.key === 'ArrowLeft') next = r * cols + Math.max(0, col - 1)
      else if (e.key === 'ArrowDown') next = Math.min(rows - 1, r + 1) * cols + col
      else if (e.key === 'ArrowUp') next = Math.max(0, r - 1) * cols + col
      else if (e.key === 'Home') next = r * cols
      else if (e.key === 'End') next = r * cols + (cols - 1)
      else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFlag(c)
        return
      }
      if (next !== -1) {
        e.preventDefault()
        moveFocus(next)
      }
    },
    [cols, rows, moveFocus, toggleFlag],
  )

  // The announcement that rides the live region.
  const announce =
    status === 'won'
      ? `Cleared. Every safe cell is open, in ${elapsed} ${elapsed === 1 ? 'second' : 'seconds'}.`
      : status === 'lost'
        ? 'Struck a mine. The field is revealed.'
        : deduceNote ||
          `${remaining} ${Math.abs(remaining) === 1 ? 'mine' : 'mines'} unflagged. ${
            started ? `${elapsed} ${elapsed === 1 ? 'second' : 'seconds'}.` : 'Reveal any cell to begin.'
          }`

  const cellLabel = (c: number): string => {
    const r = Math.floor(c / cols) + 1
    const col = (c % cols) + 1
    const where = `Row ${r}, column ${col}`
    if (flagged[c] && !revealed[c]) return `${where}, flagged`
    if (!revealed[c]) return `${where}, hidden`
    if (mine[c]) return `${where}, mine`
    if (counts[c] === 0) return `${where}, clear`
    return `${where}, ${counts[c]} ${counts[c] === 1 ? 'mine' : 'mines'} adjacent`
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Status rail: mines left, the clock, and the live state. */}
      <div className="mb-6 flex items-center gap-6 text-center">
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/40">Mines</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#DCF87C]">{remaining}</div>
        </div>
        <div className="h-9 w-px bg-white/10" />
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/40">Time</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-white/90">
            {String(elapsed).padStart(3, '0')}
          </div>
        </div>
        <div className="h-9 w-px bg-white/10" />
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/40">State</div>
          <div
            className={`mt-1 font-display text-2xl font-semibold ${
              status === 'won' ? 'text-[#DCF87C]' : status === 'lost' ? 'text-white/50' : 'text-white/90'
            }`}
          >
            {status === 'won' ? 'Clear' : status === 'lost' ? 'Hit' : 'Live'}
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label={`Minesweeper, ${level.label}, ${cols} by ${rows}, ${mineCount} mines`}
        className="grid w-full max-w-[min(92vw,420px)] touch-manipulation select-none"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: Math.max(3, Math.round(300 / cols / 9)) }}
      >
        {Array.from({ length: total }, (_, c) => {
          const isRev = revealed[c]
          const isMine = mine[c]
          const isFlag = flagged[c]
          const n = counts[c]
          const wrongFlag = status === 'lost' && isFlag && !isMine
          const hitMine = c === exploded
          return (
            <motion.button
              key={c}
              ref={(el) => {
                cellRefs.current[c] = el
              }}
              type="button"
              tabIndex={c === focus ? 0 : -1}
              onClick={() => primary(c)}
              onContextMenu={(e) => {
                e.preventDefault()
                toggleFlag(c)
              }}
              onFocus={() => setFocus(c)}
              onKeyDown={(e) => onKeyDown(e, c)}
              aria-label={cellLabel(c)}
              aria-pressed={isRev}
              className="relative flex aspect-square items-center justify-center rounded-[18%] text-[clamp(0.7rem,2.6vw,1.05rem)] font-bold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/70"
              style={{
                background: isRev
                  ? hitMine
                    ? 'radial-gradient(130% 130% at 30% 24%, #DCF87C 0%, #DCF87Ccc 50%, #8a9a3e 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.28))'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))',
                border: isRev ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.09)',
                boxShadow: isRev
                  ? hitMine
                    ? '0 0 20px #DCF87Caa, inset 0 1px 6px rgba(255,255,255,0.3)'
                    : 'inset 0 2px 7px rgba(0,0,0,0.45)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -3px 8px rgba(0,0,0,0.4)',
                color: isRev && !isMine && n > 0 ? NUM_COLOR[n] : undefined,
              }}
              initial={false}
              animate={
                reduce
                  ? undefined
                  : isRev && !isMine
                    ? { scale: [0.86, 1] }
                    : undefined
              }
              transition={reduce ? { duration: 0 } : { duration: 0.2, delay: delayRef.current[c] ?? 0 }}
            >
              {isRev && isMine ? (
                <Mine dim={!hitMine} />
              ) : isRev && n > 0 ? (
                n
              ) : isFlag ? (
                <Flag wrong={wrongFlag} />
              ) : null}
            </motion.button>
          )
        })}
      </div>

      <p id={`${id}-live`} aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* Controls: difficulty, flag mode (for touch), Deduce, and a new field. */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label="Difficulty">
          {LEVELS.map((lv) => (
            <button
              key={lv.id}
              type="button"
              onClick={() => chooseLevel(lv)}
              aria-pressed={lv.id === level.id}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                lv.id === level.id ? 'bg-[#DCF87C] text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              {lv.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFlagMode((v) => !v)}
          aria-pressed={flagMode}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            flagMode
              ? 'border-[#DCF87C]/50 bg-[#DCF87C]/10 text-[#DCF87C]'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:text-white'
          }`}
        >
          {flagMode ? 'Flagging' : 'Flag mode'}
        </button>
        <button
          type="button"
          onClick={deduce}
          disabled={status !== 'playing' || !placed}
          className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/70 transition hover:border-[#DCF87C]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Deduce
        </button>
        <button
          type="button"
          onClick={() => reset(level)}
          className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/70 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          New field
        </button>
      </div>

      <p className="mt-5 max-w-sm text-center text-[11px] leading-relaxed text-white/35" aria-hidden>
        {status === 'won'
          ? 'Cleared — every safe cell open, no mine touched. The first click is always safe, and every number is the exact count of mined neighbours.'
          : status === 'lost'
            ? 'A mine. New field to try again. Deduce only ever plays forced moves, so when it says you must guess, you must — this is the one game here where correct play can still lose.'
            : deduceNote ||
              'Reveal cells, read the numbers — each counts its eight mined neighbours — and flag what must be a mine. Right-click or F to flag; Deduce plays only what the numbers force.'}
      </p>
    </div>
  )
}

// A mine: a filled lime disc with short spokes, drawn as line art (no image).
function Mine({ dim }: { dim: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" aria-hidden style={{ opacity: dim ? 0.8 : 1 }}>
      <g stroke="#0a0b07" strokeWidth={2} strokeLinecap="round">
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
      </g>
      <circle cx="12" cy="12" r="5.4" fill={dim ? '#DCF87C' : '#0a0b07'} />
      <circle cx="10.2" cy="10.2" r="1.5" fill={dim ? '#0a0b07' : '#DCF87C'} />
    </svg>
  )
}

// A flag: a lime pennant on a stem. On a wrong flag at a loss, it is dimmed and
// struck through so a misread reads as a mistake at a glance.
function Flag({ wrong }: { wrong: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" aria-hidden style={{ opacity: wrong ? 0.4 : 1 }}>
      <line x1="8" y1="4" x2="8" y2="20" stroke={wrong ? '#ffffff' : '#DCF87C'} strokeWidth={2} strokeLinecap="round" />
      <path d="M8 4.5 L17 8 L8 11.5 Z" fill={wrong ? '#ffffff' : '#DCF87C'} />
      {wrong && <line x1="3" y1="21" x2="21" y2="3" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />}
    </svg>
  )
}
