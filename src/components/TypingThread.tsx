import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// A small conversation surface that stages the one piece of choreography every
// modern messaging and assistant interface rides on and that nothing else in
// this library draws: a message *arriving*. A line from the other side does not
// simply appear — first the three-dot indicator holds the beat while a reply is
// composed, then the words stream in a few at a time behind a caret, and the
// thread scrolls to keep the newest line in view. It is deliberately NOT the
// typewriter (TextType types one fixed line character by character and erases
// it) or the decode (DecryptedText resolves glyphs out of noise): the subject
// here is the *turn-taking* — your line snapping in whole, the pause, the
// other side's line precipitating word by word — not a single animated string.
//
// Honest about what it is: a motion study of the interaction, not a transcript
// of any real product. The default script is two short turns about the effect
// itself, so it never pretends to be a conversation it is not.
//
// Honest to the machine: one self-rescheduling timeout advances a tiny state
// machine (your turn settles at once; their turn goes typing -> streaming ->
// settled, one word per tick), cleared on unmount. No per-frame React state.
//
// Honest to assistive tech: the streamed internals are aria-hidden and the
// whole surface carries a single descriptive label, so a reader is told what
// the demo is rather than fed half of a word as it arrives.
//
// Reduced motion drops the entire machine: every turn renders in full at once,
// no dots, no streaming, no caret, no auto-scroll animation.

export interface ThreadTurn {
  /** 'you' springs in whole (an already-sent line); 'them' types then streams. */
  from: 'you' | 'them'
  /** The line's text. 'them' lines are streamed word by word. */
  text: string
}

export interface TypingThreadProps {
  /** The exchange, in order. Defaults to a short two-turn study of the effect. */
  turns?: ThreadTurn[]
  /** Milliseconds the three-dot indicator holds before a reply streams. */
  typingMs?: number
  /** Milliseconds per word while a 'them' line streams in. */
  wordMs?: number
  /** Milliseconds a completed line rests before the next turn begins. */
  holdMs?: number
  /** Milliseconds the finished thread rests before it replays (when looping). */
  loopPauseMs?: number
  /** Replay forever (default). When false the thread settles and stays. */
  loop?: boolean
  className?: string
}

const DEFAULT_TURNS: ThreadTurn[] = [
  { from: 'you', text: 'How do you make a reply feel alive?' },
  { from: 'them', text: 'Three dots to hold the beat, then the words arrive a few at a time, never all at once.' },
]

type Phase = 'typing' | 'streaming' | 'settled'

interface Cursor {
  /** Index of the turn currently arriving. */
  turn: number
  phase: Phase
  /** How many words of a streaming 'them' line are shown. */
  words: number
}

// A pulsing three-dot "composing" indicator. Only ever mounted with motion on,
// so the dots animate unconditionally; reduced motion never reaches this path.
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-white/50"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

function Bubble({ turn, children }: { turn: ThreadTurn; children: React.ReactNode }) {
  const mine = turn.from === 'you'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 460, damping: 32 }}
      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed sm:text-sm ${
          mine
            ? 'rounded-br-md bg-[#DCF87C] font-medium text-black'
            : 'rounded-bl-md bg-white/[0.06] text-white/85'
        }`}
      >
        {children}
      </div>
    </motion.div>
  )
}

export function TypingThread({
  turns = DEFAULT_TURNS,
  typingMs = 950,
  wordMs = 115,
  holdMs = 750,
  loopPauseMs = 2600,
  loop = true,
  className = '',
}: TypingThreadProps) {
  const reduce = useReducedMotion()
  const [cursor, setCursor] = useState<Cursor>({ turn: 0, phase: 'typing', words: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the script current without making it a dep (an inline array would
  // otherwise reset the machine on every parent render).
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const key = turns.map((t) => `${t.from}:${t.text}`).join('␞')

  // The state machine: one timeout schedules the next transition, then clears.
  useEffect(() => {
    if (reduce) return
    const list = turnsRef.current
    if (list.length === 0) return
    const { turn, phase, words } = cursor
    const current = list[turn]
    if (!current) return

    let delay: number
    let next: Cursor

    if (current.from === 'you') {
      // Your line is already sent: it springs in whole, then the next turn runs.
      if (turn + 1 < list.length) {
        delay = holdMs
        next = { turn: turn + 1, phase: 'typing', words: 0 }
      } else if (loop) {
        delay = loopPauseMs
        next = { turn: 0, phase: 'typing', words: 0 }
      } else {
        return
      }
    } else if (phase === 'typing') {
      // Composing: hold the dots, then start streaming words.
      delay = typingMs
      next = { turn, phase: 'streaming', words: 0 }
    } else if (phase === 'streaming') {
      const total = current.text.split(' ').length
      if (words < total) {
        delay = wordMs
        next = { turn, phase: 'streaming', words: words + 1 }
      } else {
        delay = 0
        next = { turn, phase: 'settled', words: total }
      }
    } else {
      // A completed 'them' line: rest, then advance or replay.
      if (turn + 1 < list.length) {
        delay = holdMs
        next = { turn: turn + 1, phase: 'typing', words: 0 }
      } else if (loop) {
        delay = loopPauseMs
        next = { turn: 0, phase: 'typing', words: 0 }
      } else {
        return
      }
    }

    const id = window.setTimeout(() => setCursor(next), delay)
    return () => window.clearTimeout(id)
    // key stands in for the turns array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, reduce, key, typingMs, wordMs, holdMs, loopPauseMs, loop])

  // Keep the newest line in view as the thread grows.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [cursor, reduce])

  // Which turns to render, and how much of the arriving one.
  const shownCount = reduce ? turns.length : cursor.turn + 1

  function restart() {
    setCursor({ turn: 0, phase: 'typing', words: 0 })
  }

  const label =
    'A demo conversation showing a message arriving: a question, a typing indicator, and a reply that streams in word by word.'

  return (
    <div className={`w-full ${className}`}>
      <div
        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.015]"
        role="img"
        aria-label={label}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#DCF87C]" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            A reply, arriving
          </span>
        </div>

        <div ref={scrollRef} aria-hidden className="flex h-48 flex-col gap-2.5 overflow-y-auto px-4 py-4">
          {turns.slice(0, shownCount).map((turn, i) => {
            const isArriving = !reduce && i === cursor.turn
            // A 'them' line that is still arriving shows dots, then its words.
            if (turn.from === 'them' && isArriving && cursor.phase !== 'settled') {
              if (cursor.phase === 'typing') {
                return (
                  <Bubble key={i} turn={turn}>
                    <TypingDots />
                  </Bubble>
                )
              }
              const words = turn.text.split(' ')
              const shown = words.slice(0, cursor.words).join(' ')
              return (
                <Bubble key={i} turn={turn}>
                  <span>
                    {shown}
                    <span
                      className="text-type-caret ml-[1px] inline-block h-[1em] w-[2px] translate-y-[0.12em] rounded-[1px] bg-white/50 align-baseline"
                      aria-hidden
                    />
                  </span>
                </Bubble>
              )
            }
            return (
              <Bubble key={i} turn={turn}>
                {turn.text}
              </Bubble>
            )
          })}
        </div>
      </div>

      {!reduce && loop && (
        <div className="mt-3 flex justify-center">
          <AnimatePresence>
            <motion.button
              type="button"
              onClick={restart}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-medium uppercase tracking-[0.15em] text-white/35 transition-colors hover:text-[#DCF87C]"
            >
              Replay
            </motion.button>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default TypingThread
