import { motion, useReducedMotion, animate } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

// The single-choice poll the controls family never had — the feedback widget
// a blog, a release note, or a product survey reaches for: a question, a short
// list of options, and, once you pick one, a set of result bars that grow in
// and count up to their share. It is the deliberate sibling of two pieces this
// library already carries. RadioCards is the pure "pick one" radiogroup and
// stops the moment you choose; Appreciate is the running tally of a single
// gesture. This joins the two — a radiogroup that commits to a vote and then
// reveals a tallied result — and it keeps the honesty both of those set: the
// baseline numbers are illustrative sample data, your vote is added only in
// this tab, and nothing is sent, stored, or read.
//
// Craft in three places a bare set of <div>s skips. (1) The choosing step keeps
// the real WAI-ARIA radiogroup contract — one tab stop, a roving tabindex,
// arrows that walk and select, Home/End — so it is operable by keyboard and
// announced by a screen reader exactly like native radios, not a grid of
// clickable boxes. (2) The reveal is measured motion, not decoration: each
// bar's fill springs to its share and the percentage counts up to meet it,
// staggered down the list, so a jump from nothing to a result reads as a
// direction rather than a cut. (3) It is reversible — "Change vote" returns to
// the choosing step from the same baseline, so the demo stays replayable.
// Reduced motion: no stagger, bars snap to their share and the numbers land at
// once, identical to use.

const EASE = [0.16, 1, 0.3, 1] as const

export interface PollOption {
  /** Stable id reported through onVote and used as the React key. */
  id: string
  /** The option's label. */
  label: ReactNode
  /** The illustrative baseline tally this option carries before your vote. */
  votes: number
}

export interface PollProps {
  /** The question above the options. */
  question: ReactNode
  /** The options and their illustrative baseline tallies. */
  options: PollOption[]
  /** Called with the chosen option id the moment a vote is cast. */
  onVote?: (id: string) => void
  /** An honest footnote under the result, e.g. that the counts are illustrative. */
  note?: ReactNode
  /** Accessible name for the choosing radiogroup (defaults to the question text
   * when that is a plain string; otherwise set this). */
  'aria-label'?: string
  className?: string
}

// A percentage that counts up to its target when the result is revealed. Honest
// about reduced motion: it lands on the final figure at once, no tween.
function Pct({ target, run, reduce }: { target: number; run: boolean; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? target : 0)
  useEffect(() => {
    if (!run) {
      setShown(0)
      return
    }
    if (reduce) {
      setShown(target)
      return
    }
    const controls = animate(0, target, {
      duration: 0.7,
      ease: EASE,
      onUpdate: (v) => setShown(v),
    })
    return () => controls.stop()
  }, [target, run, reduce])
  return <span className="tabular-nums">{Math.round(shown)}%</span>
}

/**
 * A single-choice poll: a radiogroup to choose, a Vote button to commit, and
 * animated result bars that reveal each option's share. Keyboard-operable and
 * reduced-motion aware; the tallies are illustrative and the vote lives only in
 * this tab.
 */
export function Poll({
  question,
  options,
  onVote,
  note,
  'aria-label': ariaLabel,
  className = '',
}: PollProps) {
  const reduce = useReducedMotion()
  const groupId = useId()
  const questionId = `${groupId}-q`
  const liveId = `${groupId}-live`
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [choice, setChoice] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)

  // The tallies shown in the result: the illustrative baselines plus your own
  // single vote on the option you picked. One source of truth, so the bars and
  // the total can never disagree.
  const tallies = useMemo(() => {
    return options.map((o) => ({
      ...o,
      count: o.votes + (voted && o.id === choice ? 1 : 0),
    }))
  }, [options, voted, choice])

  const total = tallies.reduce((n, o) => n + o.count, 0)
  const leadingCount = Math.max(...tallies.map((o) => o.count), 0)

  const selectedIndex = options.findIndex((o) => o.id === choice)
  // The single tab stop while choosing: the picked option, or the first one so
  // Tab always lands somewhere operable.
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0

  const select = useCallback(
    (id: string, focus = false) => {
      setChoice(id)
      if (focus) {
        const i = options.findIndex((o) => o.id === id)
        optionRefs.current[i]?.focus()
      }
    },
    [options],
  )

  // Walk to the next/previous option, wrapping, and select it — native radio
  // behaviour, where arrowing moves the selection.
  function step(dir: 1 | -1) {
    const n = options.length
    if (n === 0) return
    const from = selectedIndex >= 0 ? selectedIndex : dir === 1 ? -1 : 0
    const i = ((from + dir) % n + n) % n
    select(options[i].id, true)
  }

  function edge(which: 'first' | 'last') {
    if (options.length === 0) return
    select(which === 'first' ? options[0].id : options[options.length - 1].id, true)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (voted) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        step(1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        step(-1)
        break
      case 'Home':
        e.preventDefault()
        edge('first')
        break
      case 'End':
        e.preventDefault()
        edge('last')
        break
    }
  }

  function castVote() {
    if (!choice || voted) return
    setVoted(true)
    onVote?.(choice)
  }

  function changeVote() {
    setVoted(false)
  }

  const chosenLabel = options.find((o) => o.id === choice)?.label

  return (
    <div className={`w-full max-w-md ${className}`}>
      <p id={questionId} className="font-display text-lg font-semibold leading-snug text-white/90">
        {question}
      </p>

      {!voted ? (
        // CHOOSING — a real radiogroup.
        <>
          <div
            role="radiogroup"
            aria-labelledby={questionId}
            aria-label={ariaLabel}
            onKeyDown={onKeyDown}
            className="mt-4 flex flex-col gap-2.5"
          >
            {options.map((o, i) => {
              const selected = o.id === choice
              return (
                <button
                  key={o.id}
                  ref={(el) => {
                    optionRefs.current[i] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={i === tabbableIndex ? 0 : -1}
                  onClick={() => select(o.id)}
                  className={`group relative flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                    selected
                      ? 'border-[#DCF87C]/40 bg-[#DCF87C]/[0.06]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
                  }`}
                >
                  {/* The radio dot — border eases to lime, a disc springs up, and
                      a check draws itself in when picked. Same idiom as RadioCards. */}
                  <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
                    <span
                      aria-hidden
                      className={`absolute inset-0 rounded-full border transition-colors duration-200 ${
                        selected ? 'border-[#DCF87C]' : 'border-white/30 group-hover:border-white/50'
                      }`}
                    />
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-[#DCF87C]"
                      initial={false}
                      animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 640, damping: 34 }}
                      style={{ transformOrigin: 'center' }}
                    />
                    <svg
                      aria-hidden
                      viewBox="0 0 20 20"
                      width="20"
                      height="20"
                      fill="none"
                      className="pointer-events-none relative"
                    >
                      {selected && (
                        <motion.path
                          d="M5.5 10.5l3 3L15 7"
                          stroke="#0a0a0a"
                          strokeWidth={2.25}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: reduce ? 0 : 0.26, ease: EASE, delay: reduce ? 0 : 0.04 }}
                        />
                      )}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-white/85">
                    {o.label}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={castVote}
            disabled={!choice}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Vote
            <span aria-hidden>&rarr;</span>
          </button>
        </>
      ) : (
        // RESULT — the bars grow in and the numbers count up.
        <>
          <ul className="mt-4 flex flex-col gap-3" aria-describedby={liveId}>
            {tallies.map((o, i) => {
              const pct = total > 0 ? (o.count / total) * 100 : 0
              const isChoice = o.id === choice
              const isLeading = o.count === leadingCount && total > 0
              return (
                <li key={o.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span
                      className={`flex items-center gap-2 text-sm font-medium ${
                        isChoice ? 'text-[#DCF87C]' : 'text-white/75'
                      }`}
                    >
                      {o.label}
                      {isChoice && (
                        <span className="rounded-full border border-[#DCF87C]/30 bg-[#DCF87C]/[0.08] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#DCF87C]/85">
                          Your pick
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-sm font-semibold ${isLeading ? 'text-white' : 'text-white/55'}`}
                    >
                      <Pct target={pct} run={voted} reduce={!!reduce} />
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className={`h-full rounded-full ${
                        isChoice
                          ? 'bg-[#DCF87C]'
                          : isLeading
                            ? 'bg-[#DCF87C]/55'
                            : 'bg-white/25'
                      }`}
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 120, damping: 24, delay: 0.06 + i * 0.07 }
                      }
                    />
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-white/40">
              {total.toLocaleString()} {total === 1 ? 'vote' : 'votes'}
            </span>
            <button
              type="button"
              onClick={changeVote}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:border-[#DCF87C]/45 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            >
              <span aria-hidden>&larr;</span> Change vote
            </button>
          </div>

          {/* The result, spoken once, so a screen reader hears the outcome
              rather than inferring it from the bars. */}
          <p id={liveId} role="status" aria-live="polite" className="sr-only">
            {chosenLabel != null ? `You voted. ` : ''}
            {tallies
              .map((o) => `${typeof o.label === 'string' ? o.label : o.id}: ${Math.round(total > 0 ? (o.count / total) * 100 : 0)} percent`)
              .join(', ')}
            .
          </p>
        </>
      )}

      {note && <p className="mt-4 text-xs leading-relaxed text-white/35">{note}</p>}
    </div>
  )
}
