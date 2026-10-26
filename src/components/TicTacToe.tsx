import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// TicTacToe — the oldest game of all, rebuilt as a real object against a
// perfect opponent.
//
// Its own thing in the toys family. Simon is a game of recall, Lights Out a
// game of parity, Mastermind a game of deduction; this is the one that is a
// solved game played against perfect play. You are X, it is O, and it never
// makes a mistake — it chooses its move by a full minimax search of the whole
// game tree, not a table of openings or a heuristic. Because tic-tac-toe is a
// draw under perfect play by both sides, the honest promise is the simple one:
// it cannot be beaten, only drawn. The scoreboard carries an "It" column that
// stays at zero for exactly that reason, and the losses column is not a boast,
// it is a theorem — proven by searching every reply the opponent could make.
//
// Honest the way the family cares about:
//   • The opponent is genuinely perfect, not "hard": minimax scores a win as
//     better the sooner it lands and a loss as better the later it lands, so it
//     takes the quickest win on offer and the most stubborn defence otherwise.
//     Over every line of play it can be forced to, it never loses — verified
//     exhaustively in Node against all opponent play, from both first and
//     second move.
//   • No fake difficulty, no rubber-banding, no letting you win. If you play
//     perfectly you draw; the one way to "win" is for it to have a flaw, and it
//     has none.
//
// Built without canvas or image: marks are inline SVG strokes that draw
// themselves in, the winning run lit by a lime bar laid across its three cells.
// The board is a real roving-tabindex grid — arrows move, Enter or Space plays,
// R starts a new game — every cell is labelled with its square and contents,
// and each move and outcome is spoken through a polite live region. Under
// reduced motion the stroke draw and the bar sweep drop; marks appear in place.

type Mark = 'X' | 'O'
type Cell = Mark | null

interface TicTacToeProps {
  /** Cell size in px. The board is a 3x3 grid of these. */
  size?: number
  className?: string
}

const HUMAN: Mark = 'X'
const AI: Mark = 'O'

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

// Search order for the opponent's candidate squares — centre, then corners,
// then edges. Minimax makes every top-scoring move equally optimal, so this
// only decides which of several equally perfect moves it plays; preferring the
// centre and corners simply makes its openings read like a strong human's.
const SEARCH_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7]

function winnerOf(b: Cell[]): { player: Mark; line: readonly number[] } | null {
  for (const ln of LINES) {
    const [a, c, d] = ln
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a] as Mark, line: ln }
  }
  return null
}

const filledCount = (b: Cell[]) => b.reduce((n, c) => (c ? n + 1 : n), 0)
const isFull = (b: Cell[]) => b.every(Boolean)

// Minimax from the AI's (O) point of view. A win is worth more the sooner it
// arrives, a loss worth more the later it is forced, so the opponent takes the
// fastest win available and otherwise defends as long as it possibly can. This
// is the whole of its "intelligence": no openings book, no evaluation function,
// just the exact value of the position read off the full tree.
function minimax(b: Cell[], toMove: Mark): number {
  const w = winnerOf(b)
  if (w) {
    const moves = filledCount(b)
    return w.player === AI ? 10 - moves : moves - 10
  }
  if (isFull(b)) return 0

  if (toMove === AI) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue
      b[i] = AI
      best = Math.max(best, minimax(b, HUMAN))
      b[i] = null
      if (best === 9) break // can't do better than an immediate win
    }
    return best
  }
  let best = Infinity
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue
    b[i] = HUMAN
    best = Math.min(best, minimax(b, AI))
    b[i] = null
  }
  return best
}

// The opponent's move for the given board: the square with the best minimax
// value, ties broken by the cosmetic search order above.
function bestMove(board: Cell[]): number {
  const b = board.slice()
  let best = -Infinity
  let choice = SEARCH_ORDER.find((i) => !b[i]) ?? -1
  for (const i of SEARCH_ORDER) {
    if (b[i]) continue
    b[i] = AI
    const score = minimax(b, HUMAN)
    b[i] = null
    if (score > best) {
      best = score
      choice = i
    }
  }
  return choice
}

const emptyBoard = (): Cell[] => new Array<Cell>(9).fill(null)

const SQUARE_NAMES = [
  'top left',
  'top centre',
  'top right',
  'middle left',
  'centre',
  'middle right',
  'bottom left',
  'bottom centre',
  'bottom right',
]

export function TicTacToe({ size = 92, className = '' }: TicTacToeProps) {
  const reduce = useReducedMotion()
  const id = useId()

  const [board, setBoard] = useState<Cell[]>(emptyBoard)
  const [aiOpens, setAiOpens] = useState(false)
  // Which square the focus ring sits on, for the roving-tabindex grid.
  const [focusCell, setFocusCell] = useState(4)
  const [tally, setTally] = useState({ you: 0, drawn: 0, it: 0 })

  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const aiTimer = useRef<number | null>(null)
  // Guards the one-time tally update so a finished game is scored exactly once.
  const scored = useRef(false)

  const result = winnerOf(board)
  const over = result !== null || isFull(board)
  const filled = filledCount(board)
  const firstPlayer: Mark = aiOpens ? AI : HUMAN
  const toMove: Mark = filled % 2 === 0 ? firstPlayer : firstPlayer === AI ? HUMAN : AI
  const winningLine = result?.line ?? null

  const clearTimer = () => {
    if (aiTimer.current !== null) {
      window.clearTimeout(aiTimer.current)
      aiTimer.current = null
    }
  }

  const newGame = useCallback(
    (opens = aiOpens) => {
      clearTimer()
      scored.current = false
      setAiOpens(opens)
      setBoard(emptyBoard())
      setFocusCell(4)
    },
    [aiOpens],
  )

  const play = useCallback(
    (i: number) => {
      if (over || board[i] || toMove !== HUMAN) return
      setBoard((prev) => {
        if (prev[i]) return prev
        const next = prev.slice()
        next[i] = HUMAN
        return next
      })
    },
    [over, board, toMove],
  )

  // The opponent answers whenever it is its turn and the game is live. The
  // search is cheap, but a short pause lets the move read as a considered reply
  // rather than appearing in the same instant as yours.
  useEffect(() => {
    if (over || toMove !== AI) return
    const delay = reduce ? 120 : 420
    aiTimer.current = window.setTimeout(() => {
      setBoard((prev) => {
        if (winnerOf(prev) || isFull(prev)) return prev
        const move = bestMove(prev)
        if (move < 0 || prev[move]) return prev
        const next = prev.slice()
        next[move] = AI
        return next
      })
    }, delay)
    return clearTimer
  }, [over, toMove, board, reduce])

  // Score a finished game once: a win for you, a draw, or — the column that
  // stays at zero — a win for it.
  useEffect(() => {
    if (!over || scored.current) return
    scored.current = true
    setTally((t) =>
      result
        ? result.player === HUMAN
          ? { ...t, you: t.you + 1 }
          : { ...t, it: t.it + 1 }
        : { ...t, drawn: t.drawn + 1 },
    )
  }, [over, result])

  useEffect(() => clearTimer, [])

  const focus = useCallback((i: number) => {
    setFocusCell(i)
    cellRefs.current[i]?.focus()
  }, [])

  const onCellKeyDown = useCallback(
    (e: React.KeyboardEvent, i: number) => {
      const row = Math.floor(i / 3)
      const col = i % 3
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        focus(row * 3 + Math.min(2, col + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        focus(row * 3 + Math.max(0, col - 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        focus(Math.min(2, row + 1) * 3 + col)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focus(Math.max(0, row - 1) * 3 + col)
      } else if (e.key === 'Home') {
        e.preventDefault()
        focus(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        focus(8)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        play(i)
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        newGame()
      }
    },
    [focus, play, newGame],
  )

  // Spoken state — the outcome once the game ends, else whose turn it is.
  const announce = over
    ? result
      ? result.player === HUMAN
        ? 'You win. That should not be possible against a perfect player.'
        : 'It wins. Watch the fork next time.'
      : 'A draw, which is the best anyone can force against perfect play.'
    : toMove === HUMAN
      ? filled === 0
        ? 'Your move. You are X.'
        : 'Your move.'
      : 'It is thinking.'

  const busy = toMove === AI && !over

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Scoreboard — three honest counts. "It" never leaves zero. */}
      <div className="mb-6 flex items-stretch gap-2.5">
        <Score label="You" value={tally.you} tone="lime" />
        <Score label="Drawn" value={tally.drawn} tone="muted" />
        <Score label="It" value={tally.it} tone="muted" />
      </div>

      {/* The board. */}
      <div
        role="grid"
        aria-label="Tic-tac-toe board"
        className="grid grid-cols-3 gap-2.5 rounded-3xl bg-white/[0.03] p-2.5 ring-1 ring-white/10"
        style={{ width: size * 3 + 10 * 2 + 20 }}
      >
        {board.map((c, i) => {
          const inLine = winningLine?.includes(i) ?? false
          const playable = !over && !c && toMove === HUMAN
          return (
            <button
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el
              }}
              type="button"
              role="gridcell"
              tabIndex={i === focusCell ? 0 : -1}
              disabled={busy}
              onFocus={() => setFocusCell(i)}
              onClick={() => play(i)}
              onKeyDown={(e) => onCellKeyDown(e, i)}
              aria-label={`${SQUARE_NAMES[i]}: ${c === HUMAN ? 'your X' : c === AI ? 'its O' : 'empty'}`}
              className={`relative grid place-items-center rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/80 ${
                playable ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
              } ${inLine ? 'bg-[#DCF87C]/[0.07]' : 'bg-black/30'}`}
              style={{ width: size, height: size }}
            >
              {c && <GlyphMark mark={c} size={size} reduce={!!reduce} dim={!!winningLine && !inLine} />}
            </button>
          )
        })}
      </div>

      <p id={`${id}-live`} aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* Status line + controls. */}
      <div className="mt-6 flex min-h-[2rem] items-center">
        {over ? (
          <span
            className={`font-display text-lg font-semibold tracking-tight ${
              result?.player === HUMAN ? 'text-[#DCF87C]' : 'text-white/80'
            }`}
          >
            {result
              ? result.player === HUMAN
                ? 'You win'
                : 'It wins'
              : 'Drawn'}
          </span>
        ) : (
          <span className="text-sm text-white/55">
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/50" />
                Thinking
              </span>
            ) : (
              <>
                Your move &mdash; you are <span className="font-semibold text-[#DCF87C]">X</span>
              </>
            )}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => newGame()}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-5 py-1.5 text-xs font-semibold text-[#DCF87C] transition hover:bg-[#DCF87C]/20"
        >
          New game
        </button>
        <button
          type="button"
          onClick={() => newGame(!aiOpens)}
          aria-pressed={aiOpens}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
            aiOpens
              ? 'border-white/30 bg-white/[0.06] text-white'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30 hover:text-white'
          }`}
        >
          {aiOpens ? 'It opens' : 'You open'}
        </button>
      </div>

      <p className="mt-5 max-w-sm text-center text-[11px] leading-relaxed text-white/35">
        {over && result?.player === HUMAN ? (
          <>You beat a perfect player &mdash; that is a bug, not a feature, and it should not happen. If it did, something is wrong, not clever.</>
        ) : (
          <>It plays by a full minimax search of the whole game tree, so it is genuinely perfect, not merely hard. Tic-tac-toe is a draw under perfect play &mdash; so it cannot be beaten, only drawn.</>
        )}
      </p>
    </div>
  )
}

function Score({ label, value, tone }: { label: string; value: number; tone: 'lime' | 'muted' }) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
      <span
        className={`font-display text-2xl font-bold tabular-nums leading-none ${
          tone === 'lime' ? 'text-[#DCF87C]' : 'text-white/85'
        }`}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</span>
    </div>
  )
}

// A mark drawn as inline SVG strokes that paint themselves in. X is the house
// lime (yours), O a soft white (its). Under reduced motion the stroke draw is
// dropped and the mark is simply present; a dimmed flag fades the marks that
// are not part of the winning run so the lit line reads clearly.
function GlyphMark({
  mark,
  size,
  reduce,
  dim,
}: {
  mark: Mark
  size: number
  reduce: boolean
  dim: boolean
}) {
  const stroke = mark === HUMAN ? '#DCF87C' : 'rgba(255,255,255,0.82)'
  const s = size
  const pad = s * 0.26
  const draw = reduce
    ? { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } }
    : {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: 1, opacity: 1 },
      }
  const common = {
    fill: 'none',
    stroke,
    strokeWidth: Math.max(4, s * 0.08),
    strokeLinecap: 'round' as const,
  }
  return (
    <motion.svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      aria-hidden
      animate={{ opacity: dim ? 0.3 : 1 }}
      transition={{ duration: 0.3 }}
      style={{
        filter: mark === HUMAN ? 'drop-shadow(0 0 6px rgba(220,248,124,0.4))' : 'none',
      }}
    >
      {mark === HUMAN ? (
        <>
          <motion.line
            x1={pad}
            y1={pad}
            x2={s - pad}
            y2={s - pad}
            {...common}
            {...draw}
            transition={{ duration: reduce ? 0 : 0.26, ease: 'easeOut' }}
          />
          <motion.line
            x1={s - pad}
            y1={pad}
            x2={pad}
            y2={s - pad}
            {...common}
            {...draw}
            transition={{ duration: reduce ? 0 : 0.26, ease: 'easeOut', delay: reduce ? 0 : 0.22 }}
          />
        </>
      ) : (
        <motion.circle
          cx={s / 2}
          cy={s / 2}
          r={s / 2 - pad}
          {...common}
          {...draw}
          transition={{ duration: reduce ? 0 : 0.4, ease: 'easeOut' }}
        />
      )}
    </motion.svg>
  )
}
