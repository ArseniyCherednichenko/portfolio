import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// Mastermind — the code-breaking game, rebuilt as a real object you reason on.
//
// Its own thing in the toys family. Simon is a game of recall, Lights Out is a
// game of parity, the slide puzzle is a game of order; this is the one that is
// a game of deduction. A hidden code of four coloured pegs sits behind the
// shield, and each guess comes back scored — a dark peg for every colour that
// is right and in the right place, a pale peg for every colour that is right
// but misplaced — never told which is which. You narrow it from the pattern of
// those answers, not from being shown anything.
//
// Honest the two ways the family cares about:
//   • The code is a fair Math.random() draw across the six colours (repeats
//     allowed, the standard game) made once at the start and never touched
//     again — nothing is nudged to keep you guessing, the board you are reading
//     is the real one from the first move.
//   • The score is provably correct, by the exact two-pass count the game is
//     defined by: exact hits first, then for the rest the per-colour minimum of
//     what the code still holds and what the guess still offers. So a pale peg
//     is a true "right colour, wrong slot", never an approximation.
//
// Built without canvas or image: coloured discs in a CSS grid, each carrying
// its own number so the game is legible to colour-blind players and maps one
// to one onto the number keys. The active row is a real roving-tabindex group
// (arrows move, 1-6 place a colour, Backspace clears, Enter checks), every peg
// and feedback cluster is labelled, and each result is spoken through a polite
// live region. Under reduced motion the place-pop and feedback stagger drop —
// pegs appear in place — and the game is identical to play.

interface MastermindProps {
  /** Peg diameter in px for the board rows. */
  size?: number
  className?: string
}

const SLOTS = 4
const COLORS = 6
const MAX_ROWS = 10

interface Swatch {
  /** 0-based colour index. */
  i: number
  name: string
  hex: string
}

// Lime leads; the rest are the site's restrained secondary hues, chosen to stay
// distinct from one another. Every peg also shows its number, so the colour is
// never the only thing carrying the identity.
const SWATCHES: Swatch[] = [
  { i: 0, name: 'Lime', hex: '#DCF87C' },
  { i: 1, name: 'Sky', hex: '#38BDF8' },
  { i: 2, name: 'Amber', hex: '#FBBF24' },
  { i: 3, name: 'Violet', hex: '#C4B5FD' },
  { i: 4, name: 'Rose', hex: '#FB7185' },
  { i: 5, name: 'Emerald', hex: '#34D399' },
]

type Guess = number[]
interface Scored {
  guess: Guess
  exact: number
  present: number
}

function randomCode(): Guess {
  return Array.from({ length: SLOTS }, () => Math.floor(Math.random() * COLORS))
}

// The exact Mastermind scoring. Exact hits (right colour, right slot) are
// counted first; then, over only the positions that were not exact, the pale
// count is the per-colour minimum of what the code still holds against what the
// guess still offers. This is the definition of the game, not an estimate.
function score(guess: Guess, code: Guess): { exact: number; present: number } {
  let exact = 0
  const codeLeft = new Array<number>(COLORS).fill(0)
  const guessLeft = new Array<number>(COLORS).fill(0)
  for (let i = 0; i < SLOTS; i++) {
    if (guess[i] === code[i]) exact++
    else {
      codeLeft[code[i]]++
      guessLeft[guess[i]]++
    }
  }
  let present = 0
  for (let c = 0; c < COLORS; c++) present += Math.min(codeLeft[c], guessLeft[c])
  return { exact, present }
}

function emptyRow(): Guess {
  return new Array<number>(SLOTS).fill(-1)
}

export function Mastermind({ size = 44, className = '' }: MastermindProps) {
  const reduce = useReducedMotion()
  const id = useId()

  const [code, setCode] = useState<Guess>(() => randomCode())
  const [rows, setRows] = useState<Scored[]>([])
  const [current, setCurrent] = useState<Guess>(() => emptyRow())
  const [active, setActive] = useState(0)
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing')

  const slotRefs = useRef<(HTMLButtonElement | null)[]>([])
  const full = current.every((c) => c >= 0)
  const over = status !== 'playing'

  const newGame = useCallback(() => {
    setCode(randomCode())
    setRows([])
    setCurrent(emptyRow())
    setActive(0)
    setStatus('playing')
  }, [])

  // Drop a colour into the focused slot and step to the next empty one, so a run
  // of number keys fills the row left to right without manual cursor moves.
  const place = useCallback(
    (color: number) => {
      if (over) return
      setCurrent((row) => {
        const next = row.slice()
        next[active] = color
        // Advance to the next still-empty slot, if any.
        const from = active
        let step = -1
        for (let k = 1; k <= SLOTS; k++) {
          const j = (from + k) % SLOTS
          if (next[j] < 0) {
            step = j
            break
          }
        }
        if (step !== -1) {
          setActive(step)
          slotRefs.current[step]?.focus()
        }
        return next
      })
    },
    [active, over],
  )

  const clearSlot = useCallback(
    (slot: number) => {
      if (over) return
      setCurrent((row) => {
        const next = row.slice()
        next[slot] = -1
        return next
      })
    },
    [over],
  )

  const submit = useCallback(() => {
    if (over || !full) return
    const s = score(current, code)
    setRows((prev) => [...prev, { guess: current.slice(), ...s }])
    if (s.exact === SLOTS) {
      setStatus('won')
      return
    }
    if (rows.length + 1 >= MAX_ROWS) {
      setStatus('lost')
      return
    }
    setCurrent(emptyRow())
    setActive(0)
    slotRefs.current[0]?.focus()
  }, [over, full, current, code, rows.length])

  const focusSlot = useCallback((slot: number) => {
    setActive(slot)
    slotRefs.current[slot]?.focus()
  }, [])

  const onSlotKeyDown = useCallback(
    (e: React.KeyboardEvent, slot: number) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        focusSlot(Math.min(SLOTS - 1, slot + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        focusSlot(Math.max(0, slot - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        focusSlot(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        focusSlot(SLOTS - 1)
      } else if (e.key >= '1' && e.key <= String(COLORS)) {
        e.preventDefault()
        place(Number(e.key) - 1)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        // Clear this slot if filled, else step back and clear that one.
        if (current[slot] >= 0) clearSlot(slot)
        else if (slot > 0) {
          clearSlot(slot - 1)
          focusSlot(slot - 1)
        }
      } else if (e.key === 'Delete') {
        e.preventDefault()
        clearSlot(slot)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      }
    },
    [focusSlot, place, clearSlot, current, submit],
  )

  // Spoken state. On game over it names the outcome and reveals the code once;
  // in play it reports the last score or prompts for the next move.
  const last = rows[rows.length - 1]
  const codeNames = code.map((c) => SWATCHES[c].name).join(', ')
  const announce = over
    ? status === 'won'
      ? `Solved in ${rows.length} ${rows.length === 1 ? 'guess' : 'guesses'}. The code was ${codeNames}.`
      : `Out of guesses. The code was ${codeNames}.`
    : last
      ? `${last.exact} exact, ${last.present} misplaced. ${MAX_ROWS - rows.length} ${MAX_ROWS - rows.length === 1 ? 'guess' : 'guesses'} left.`
      : `Place four colours and check. ${MAX_ROWS} guesses.`

  const peg = size
  const fb = Math.max(8, Math.round(size * 0.28))

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex flex-col items-center gap-2.5">
        {/* The shield: the hidden code, revealed only when the game ends. */}
        <CodeShield code={code} over={over} won={status === 'won'} peg={peg} reduce={!!reduce} />

        <div className="my-1 h-px w-28 bg-white/10" />

        {/* The board, most-recent guess at the bottom like the real game. */}
        <div className="flex flex-col gap-2.5" role="group" aria-label="Guesses">
          {Array.from({ length: MAX_ROWS }, (_, rowIndex) => {
            const scored = rows[rowIndex]
            const isCurrent = !over && rowIndex === rows.length
            return (
              <Row
                key={rowIndex}
                index={rowIndex}
                scored={scored}
                current={isCurrent ? current : undefined}
                active={isCurrent ? active : -1}
                peg={peg}
                fb={fb}
                reduce={!!reduce}
                slotRefs={slotRefs}
                onSlotFocus={setActive}
                onSlotClick={focusSlot}
                onSlotKeyDown={onSlotKeyDown}
              />
            )
          })}
        </div>
      </div>

      <p id={`${id}-live`} aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* The palette. A click drops that colour into the focused slot. */}
      {!over && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5" role="group" aria-label="Colours">
          {SWATCHES.map((s) => (
            <button
              key={s.i}
              type="button"
              onClick={() => place(s.i)}
              aria-label={`Place ${s.name} (key ${s.i + 1})`}
              className="relative grid place-items-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-white/70 hover:-translate-y-0.5"
              style={{
                width: peg,
                height: peg,
                background: `radial-gradient(130% 130% at 32% 26%, #ffffffcc 0%, ${s.hex} 36%, ${s.hex} 70%, #00000055 100%)`,
                boxShadow: `0 2px 10px ${s.hex}55, inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(0,0,0,0.35)`,
              }}
            >
              <span className="text-[11px] font-bold text-black/70">{s.i + 1}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {!over ? (
          <>
            <button
              type="button"
              onClick={submit}
              disabled={!full}
              className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-5 py-1.5 text-xs font-semibold text-[#DCF87C] transition hover:bg-[#DCF87C]/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-white/30"
            >
              Check
            </button>
            <button
              type="button"
              onClick={() => setCurrent(emptyRow())}
              className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Clear row
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={newGame}
            className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-1.5 text-xs font-medium text-white/70 transition hover:border-[#DCF87C]/40 hover:text-white"
          >
            New code
          </button>
        )}
      </div>

      <p className="mt-5 max-w-sm text-center text-[11px] leading-relaxed text-white/35">
        {over ? (
          status === 'won' ? (
            <>Cracked in {rows.length} {rows.length === 1 ? 'guess' : 'guesses'}. A new code is a fair draw across the six colours &mdash; nothing here is weighted against you.</>
          ) : (
            <>Out of guesses &mdash; the code is revealed above. It never changed while you played; the answers you read were honest from the first move.</>
          )
        ) : (
          <>Dark peg: right colour, right slot. Pale peg: right colour, wrong slot. You are never told which is which &mdash; deduce the code from the pattern.</>
        )}
      </p>
    </div>
  )
}

// The hidden code above the board — blanks behind a shield while you play, the
// real pegs turned face-up the moment the game ends.
function CodeShield({
  code,
  over,
  won,
  peg,
  reduce,
}: {
  code: Guess
  over: boolean
  won: boolean
  peg: number
  reduce: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">Code</span>
      {code.map((c, i) => {
        const s = SWATCHES[c]
        return (
          <div
            key={i}
            className="grid place-items-center rounded-full"
            style={{ width: peg, height: peg }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {over ? (
                <motion.div
                  key="face"
                  initial={reduce ? false : { rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 22, delay: i * 0.08 }}
                  className="grid h-full w-full place-items-center rounded-full"
                  style={{
                    background: `radial-gradient(130% 130% at 32% 26%, #ffffffcc 0%, ${s.hex} 36%, ${s.hex} 70%, #00000055 100%)`,
                    boxShadow: won
                      ? `0 0 16px ${s.hex}aa, inset 0 2px 6px rgba(255,255,255,0.4)`
                      : `inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(0,0,0,0.35)`,
                  }}
                >
                  <span className="text-[11px] font-bold text-black/70">{s.i + 1}</span>
                </motion.div>
              ) : (
                <motion.div
                  key="hidden"
                  initial={false}
                  className="grid h-full w-full place-items-center rounded-full"
                  style={{
                    background: 'radial-gradient(130% 130% at 30% 24%, #DCF87C14 0%, #0a0b07 72%)',
                    border: '1px solid #DCF87C22',
                    boxShadow: 'inset 0 -6px 14px rgba(0,0,0,0.6)',
                  }}
                >
                  <span className="text-white/25">?</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

function Row({
  index,
  scored,
  current,
  active,
  peg,
  fb,
  reduce,
  slotRefs,
  onSlotFocus,
  onSlotClick,
  onSlotKeyDown,
}: {
  index: number
  scored?: Scored
  current?: Guess
  active: number
  peg: number
  fb: number
  reduce: boolean
  slotRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>
  onSlotFocus: (slot: number) => void
  onSlotClick: (slot: number) => void
  onSlotKeyDown: (e: React.KeyboardEvent, slot: number) => void
}) {
  const guess = scored?.guess ?? current ?? emptyRow()
  const editable = !!current
  const isPast = !!scored

  // The feedback cluster: `exact` dark pegs first, then `present` pale pegs,
  // then empty holes — order carries no positional meaning (that is the game).
  const feedback: ('exact' | 'present' | 'empty')[] = []
  if (scored) {
    for (let k = 0; k < scored.exact; k++) feedback.push('exact')
    for (let k = 0; k < scored.present; k++) feedback.push('present')
    while (feedback.length < SLOTS) feedback.push('empty')
  }

  return (
    <div className={`flex items-center gap-3 ${editable ? 'rounded-2xl bg-white/[0.03] px-2 py-1 ring-1 ring-[#DCF87C]/25' : ''}`}>
      <span className="w-5 text-right text-[10px] font-medium tabular-nums text-white/25">{index + 1}</span>

      <div className="flex gap-2.5">
        {guess.map((c, slot) => {
          const s = c >= 0 ? SWATCHES[c] : null
          const filled = c >= 0
          const content = (
            <>
              {s ? <span className="text-[11px] font-bold text-black/70">{s.i + 1}</span> : null}
            </>
          )
          const style: React.CSSProperties = {
            width: peg,
            height: peg,
            background: s
              ? `radial-gradient(130% 130% at 32% 26%, #ffffffcc 0%, ${s.hex} 36%, ${s.hex} 70%, #00000055 100%)`
              : 'radial-gradient(130% 130% at 30% 24%, rgba(255,255,255,0.04) 0%, #0a0b07 74%)',
            boxShadow: s
              ? `inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(0,0,0,0.35)`
              : 'inset 0 -6px 14px rgba(0,0,0,0.55)',
            border: s ? 'none' : '1px solid rgba(255,255,255,0.08)',
          }

          if (editable) {
            return (
              <button
                key={slot}
                ref={(el) => {
                  slotRefs.current[slot] = el
                }}
                type="button"
                tabIndex={slot === active ? 0 : -1}
                onFocus={() => onSlotFocus(slot)}
                onClick={() => onSlotClick(slot)}
                onKeyDown={(e) => onSlotKeyDown(e, slot)}
                aria-label={`Slot ${slot + 1}: ${s ? s.name : 'empty'}`}
                className={`grid place-items-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-white/80 ${slot === active ? 'ring-1 ring-white/40' : ''}`}
                style={style}
              >
                {content}
              </button>
            )
          }

          const inner = (
            <div className="grid h-full w-full place-items-center rounded-full" style={style}>
              {content}
            </div>
          )
          return (
            <div
              key={slot}
              className="grid place-items-center rounded-full"
              style={{ width: peg, height: peg }}
              aria-hidden={!isPast}
            >
              {isPast && filled && !reduce ? (
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22, delay: slot * 0.05 }}
                  className="h-full w-full"
                >
                  {inner}
                </motion.div>
              ) : (
                inner
              )}
            </div>
          )
        })}
      </div>

      {/* Feedback cluster — a 2x2 of small pegs, only for a submitted row. */}
      <div
        className="grid shrink-0 grid-cols-2 gap-1"
        aria-hidden={!isPast}
      >
        {(isPast ? feedback : (['empty', 'empty', 'empty', 'empty'] as const)).map((kind, k) => (
          <motion.span
            key={k}
            initial={isPast && !reduce ? { scale: 0, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 24, delay: 0.25 + k * 0.06 }}
            className="rounded-full"
            style={{
              width: fb,
              height: fb,
              background:
                kind === 'exact'
                  ? 'radial-gradient(120% 120% at 32% 28%, #DCF87C 0%, #a7c94f 100%)'
                  : kind === 'present'
                    ? 'radial-gradient(120% 120% at 32% 28%, #ffffff 0%, #cfd3cb 100%)'
                    : 'transparent',
              border: kind === 'empty' ? '1px solid rgba(255,255,255,0.10)' : 'none',
              boxShadow:
                kind === 'exact'
                  ? '0 0 8px #DCF87C88'
                  : kind === 'present'
                    ? 'inset 0 1px 2px rgba(0,0,0,0.3)'
                    : 'none',
            }}
          />
        ))}
      </div>

      {isPast && (
        <span className="ml-1 hidden text-[10px] tabular-nums text-white/30 sm:inline">
          {scored.exact}&middot;{scored.present}
        </span>
      )}
    </div>
  )
}
