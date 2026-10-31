import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// 2048 — the sliding-tile game, rebuilt by hand as a real object against the
// real rules, and the one toy in the Objects & toys family whose subject is
// *motion*: every move is a slide, every merge a pop, so the game is a standing
// demo of the site's own animation craft rather than a static board. Simon is
// recall, Mastermind deduction, tic-tac-toe perfect play, peg solitaire a
// solved puzzle; this is the one you play by feel, swiping a whole board at a
// time and watching it settle.
//
// Honest the way the family cares. (1) The rules are the real ones, enforced by
// one `slide()`: tiles travel to the wall, equal neighbours merge once per move
// into their doubled sum, a spawn of a 2 (90%) or a 4 (10%) drops into a random
// empty cell after any move that actually changed the board, and the game ends
// only when the board is full AND no adjacent pair can still merge in any
// direction — the true game-over test, not just "no empty cells". (2) The score
// is the plain sum of every merge, and the best is the honest max across games,
// persisted per-browser so a good run survives a reload.
//
// The animation is the signature. Each tile carries a stable id, so Framer
// animates it from its old cell to its new one on every move (a real slide, not
// a repaint); a merged survivor pops its doubled value, the consumed tile slides
// under it and exits, and a fresh tile springs in. Positions are percentages of
// a square board, so the whole thing is fluid from a phone to a wide column with
// no fixed pixel grid. Reduced motion drops the slide, the pop and the spring —
// tiles cut straight to their new cells — and the game plays identically.

const SIZE = 4
const WIN_VALUE = 2048
const SLIDE_MS = 130
const BEST_KEY = 'pg-2048-best'

type Dir = 'up' | 'down' | 'left' | 'right'

interface Tile {
  id: number
  value: number
  r: number
  c: number
  /** Doubled this move — triggers the merge pop. */
  justMerged?: boolean
  /** Spawned this move — triggers the entrance spring. */
  isNew?: boolean
  /** Absorbed this move — slides under its survivor, then exits. */
  dying?: boolean
}

// Board-fraction geometry: a 3% gutter between cells, so four cells + five
// gutters fill the square exactly. Everything positions off these, so the board
// scales with its container and never needs a pixel grid.
const GAP = 0.03
const CELL = (1 - GAP * (SIZE + 1)) / SIZE // ≈ 0.2125

function leftPct(c: number) {
  return (GAP + c * (CELL + GAP)) * 100
}
function topPct(r: number) {
  return (GAP + r * (CELL + GAP)) * 100
}

// The tile ramp: dark and quiet at the bottom, warming into the house lime as
// the value climbs, the text flipping to ink once the fill is bright enough to
// carry it. Values past 2048 reuse the brightest tier.
interface TileStyle {
  bg: string
  fg: string
  glow?: boolean
}
const TILE_STYLES: Record<number, TileStyle> = {
  2: { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.72)' },
  4: { bg: 'rgba(255,255,255,0.11)', fg: 'rgba(255,255,255,0.82)' },
  8: { bg: 'rgba(220,248,124,0.14)', fg: '#DCF87C' },
  16: { bg: 'rgba(220,248,124,0.22)', fg: '#DCF87C' },
  32: { bg: 'rgba(220,248,124,0.32)', fg: '#eaffb0' },
  64: { bg: 'rgba(220,248,124,0.44)', fg: '#0a0a0a' },
  128: { bg: 'rgba(220,248,124,0.56)', fg: '#0a0a0a' },
  256: { bg: 'rgba(220,248,124,0.68)', fg: '#0a0a0a' },
  512: { bg: 'rgba(220,248,124,0.8)', fg: '#0a0a0a' },
  1024: { bg: 'rgba(220,248,124,0.92)', fg: '#0a0a0a', glow: true },
  2048: { bg: '#DCF87C', fg: '#0a0a0a', glow: true },
}
function styleFor(value: number): TileStyle {
  return TILE_STYLES[value] ?? TILE_STYLES[2048]
}
// Fewer digits can be larger; a four-digit value has to shrink to fit the cell.
function fontClass(value: number) {
  const digits = String(value).length
  if (digits <= 2) return 'text-[clamp(1.5rem,7vw,2.1rem)]'
  if (digits === 3) return 'text-[clamp(1.2rem,5.5vw,1.7rem)]'
  return 'text-[clamp(0.95rem,4.5vw,1.35rem)]'
}

function readBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}
function writeBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n))
  } catch {
    /* private mode / blocked storage — the in-memory best still stands */
  }
}

let nextId = 1
function makeTile(value: number, r: number, c: number, isNew = false): Tile {
  return { id: nextId++, value, r, c, isNew }
}

function emptyCells(tiles: Tile[]): Array<{ r: number; c: number }> {
  const taken = new Set(tiles.filter((t) => !t.dying).map((t) => t.r * SIZE + t.c))
  const out: Array<{ r: number; c: number }> = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (!taken.has(r * SIZE + c)) out.push({ r, c })
  return out
}

function spawnTile(tiles: Tile[]): Tile | null {
  const cells = emptyCells(tiles)
  if (cells.length === 0) return null
  const cell = cells[Math.floor(Math.random() * cells.length)]
  const value = Math.random() < 0.9 ? 2 : 4
  return makeTile(value, cell.r, cell.c, true)
}

// One line of the board in the order tiles travel toward the wall, as [r,c].
function lineCoords(dir: Dir, index: number): Array<{ r: number; c: number }> {
  const out: Array<{ r: number; c: number }> = []
  for (let i = 0; i < SIZE; i++) {
    if (dir === 'left') out.push({ r: index, c: i })
    else if (dir === 'right') out.push({ r: index, c: SIZE - 1 - i })
    else if (dir === 'up') out.push({ r: i, c: index })
    else out.push({ r: SIZE - 1 - i, c: index })
  }
  return out
}

interface SlideResult {
  survivors: Tile[]
  consumed: Tile[]
  moved: boolean
  gained: number
}

// The whole of the rules. Returns the surviving tiles at their new cells, the
// consumed tiles re-homed onto their survivor's cell (for the slide-under), the
// score gained, and whether anything actually moved (so we only spawn then).
function slide(tiles: Tile[], dir: Dir): SlideResult {
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Tile | null),
  )
  for (const t of tiles) grid[t.r][t.c] = t

  const survivors: Tile[] = []
  const consumed: Tile[] = []
  let gained = 0
  let moved = false

  for (let index = 0; index < SIZE; index++) {
    const coords = lineCoords(dir, index)
    const line = coords.map(({ r, c }) => grid[r][c]).filter((t): t is Tile => t != null)
    let out = 0
    let i = 0
    while (i < line.length) {
      const t = line[i]
      const dest = coords[out]
      if (i + 1 < line.length && line[i + 1].value === t.value) {
        // Merge: the front tile survives, doubled; the next slides under it.
        const value = t.value * 2
        survivors.push({ id: t.id, value, r: dest.r, c: dest.c, justMerged: true })
        consumed.push({ ...line[i + 1], r: dest.r, c: dest.c, dying: true })
        gained += value
        moved = true
        i += 2
      } else {
        if (t.r !== dest.r || t.c !== dest.c) moved = true
        survivors.push({ id: t.id, value: t.value, r: dest.r, c: dest.c })
        i += 1
      }
      out += 1
    }
  }
  return { survivors, consumed, moved, gained }
}

function hasMoves(tiles: Tile[]): boolean {
  if (emptyCells(tiles).length > 0) return true
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as Tile | null),
  )
  for (const t of tiles) if (!t.dying) grid[t.r][t.c] = t
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c]?.value
      if (v == null) continue
      if (c + 1 < SIZE && grid[r][c + 1]?.value === v) return true
      if (r + 1 < SIZE && grid[r + 1][c]?.value === v) return true
    }
  return false
}

function freshBoard(): Tile[] {
  const tiles: Tile[] = []
  const a = spawnTile(tiles)
  if (a) tiles.push(a)
  const b = spawnTile(tiles)
  if (b) tiles.push(b)
  return tiles.map((t) => ({ ...t, isNew: false }))
}

export function Game2048({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const [tiles, setTiles] = useState<Tile[]>(() => freshBoard())
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => readBest())
  const [status, setStatus] = useState<'playing' | 'won' | 'over'>('playing')
  const [announce, setAnnounce] = useState('Four by four board, two tiles to start. Use the arrow keys.')

  const animating = useRef(false)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current)
    },
    [],
  )

  const commitBest = useCallback(
    (next: number) => {
      setBest((prev) => {
        if (next > prev) {
          writeBest(next)
          return next
        }
        return prev
      })
    },
    [],
  )

  const reset = useCallback(() => {
    if (pending.current) clearTimeout(pending.current)
    animating.current = false
    setTiles(freshBoard())
    setScore(0)
    setStatus('playing')
    setAnnounce('New game. Two tiles on the board.')
  }, [])

  const move = useCallback(
    (dir: Dir) => {
      if (animating.current || status === 'over') return
      setTiles((current) => {
        const live = current.filter((t) => !t.dying)
        const { survivors, consumed, moved, gained } = slide(live, dir)
        if (!moved) return current

        if (gained > 0) {
          setScore((s) => {
            const ns = s + gained
            commitBest(ns)
            return ns
          })
        }

        const reachedWin = survivors.some((t) => t.value >= WIN_VALUE)

        if (reduce) {
          // No slide to show: land survivors, drop consumed, spawn at once.
          const spawned = spawnTile(survivors)
          const nextTiles = spawned ? [...survivors, spawned] : survivors
          finish(nextTiles, reachedWin, gained)
          return nextTiles.map((t) => ({ ...t, justMerged: false }))
        }

        // Keep consumed tiles in the DOM at their survivor's cell so Framer
        // slides them there; the next tick drops them (exit) and spawns.
        animating.current = true
        pending.current = setTimeout(() => {
          setTiles((mid) => {
            const kept = mid.filter((t) => !t.dying).map((t) => ({ ...t, justMerged: false, isNew: false }))
            const spawned = spawnTile(kept)
            const nextTiles = spawned ? [...kept, spawned] : kept
            animating.current = false
            finish(nextTiles, reachedWin, gained)
            return nextTiles
          })
        }, SLIDE_MS)

        return [...survivors, ...consumed]
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, reduce, commitBest],
  )

  // Shared tail of a move: set the win/over status and the live announcement.
  function finish(nextTiles: Tile[], reachedWin: boolean, gained: number) {
    setStatus((prev) => {
      if (prev === 'playing' && reachedWin) {
        setAnnounce('You reached 2048. Keep going for a higher tile, or start a new game.')
        return 'won'
      }
      if (!hasMoves(nextTiles)) {
        setAnnounce('No moves left. Game over. Press New game to play again.')
        return 'over'
      }
      if (gained > 0) setAnnounce(`Merged for ${gained}.`)
      return prev
    })
  }

  // Keyboard: arrows and WASD, with page scroll suppressed on the game keys.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
      W: 'up',
      S: 'down',
      A: 'left',
      D: 'right',
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      reset()
      return
    }
    const dir = map[e.key]
    if (!dir) return
    e.preventDefault()
    move(dir)
  }

  // Pointer: a swipe past the threshold on the dominant axis is a move.
  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragStart.current
    dragStart.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (Math.max(adx, ady) < 28) return
    if (adx > ady) move(dx > 0 ? 'right' : 'left')
    else move(dy > 0 ? 'down' : 'up')
  }

  const slideSpring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.6 }

  return (
    <div className={`mx-auto w-full max-w-sm ${className}`}>
      {/* Scoreboard */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex gap-3">
          <Readout label="Score" value={score} />
          <Readout label="Best" value={best} muted />
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
        >
          New game
        </button>
      </div>

      {/* Board */}
      <div
        role="grid"
        tabIndex={0}
        aria-label="2048. A four by four board. Use the arrow keys or swipe to slide the tiles; equal tiles merge. Press R for a new game."
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className="relative aspect-square w-full touch-none select-none rounded-2xl border border-white/10 bg-white/[0.02] p-[3%] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        {/* Empty cell wells */}
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const r = Math.floor(i / SIZE)
          const c = i % SIZE
          return (
            <div
              key={i}
              aria-hidden
              className="absolute rounded-xl bg-white/[0.035]"
              style={{
                left: `${leftPct(c)}%`,
                top: `${topPct(r)}%`,
                width: `${CELL * 100}%`,
                height: `${CELL * 100}%`,
              }}
            />
          )
        })}

        {/* Tiles */}
        <AnimatePresence>
          {tiles.map((t) => {
            const s = styleFor(t.value)
            return (
              <motion.div
                key={t.id}
                aria-hidden
                initial={
                  t.isNew && !reduce
                    ? { scale: 0.1, opacity: 0, left: `${leftPct(t.c)}%`, top: `${topPct(t.r)}%` }
                    : false
                }
                animate={{
                  left: `${leftPct(t.c)}%`,
                  top: `${topPct(t.r)}%`,
                  scale: t.justMerged && !reduce ? [1, 1.16, 1] : 1,
                  opacity: 1,
                }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={{
                  left: slideSpring,
                  top: slideSpring,
                  scale: reduce ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: reduce ? 0 : 0.12 },
                }}
                className={`absolute flex items-center justify-center rounded-xl font-display font-bold tabular-nums ${fontClass(
                  t.value,
                )}`}
                style={{
                  width: `${CELL * 100}%`,
                  height: `${CELL * 100}%`,
                  background: s.bg,
                  color: s.fg,
                  boxShadow: s.glow ? '0 0 20px 1px rgba(220,248,124,0.5)' : undefined,
                  zIndex: t.dying ? 1 : 2,
                }}
              >
                {t.value}
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Win / game-over veil */}
        <AnimatePresence>
          {status === 'over' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-black/70 backdrop-blur-sm"
            >
              <p className="font-display text-3xl font-bold text-white">No moves left</p>
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Play again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-4 text-center text-sm text-white/40">
        Slide with the arrow keys, or swipe. Equal tiles merge into one.
      </p>

      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}

function Readout({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="min-w-[4.5rem] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
      <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</span>
      <span
        className={`block font-display text-xl font-bold tabular-nums ${muted ? 'text-white/70' : 'text-[#DCF87C]'}`}
      >
        {value}
      </span>
    </div>
  )
}
