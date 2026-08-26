import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// DisciplineDemo — a small, honest, interactive demonstration for each of the
// five /range disciplines. The detail pages state a craft "through-line" but
// never *show* it; this closes that gap. Each demo embodies the exact belief a
// discipline claims — the frontend one cycles the empty/loading/loaded states
// it says it sweats, the AI one withholds the answer to ask a question instead,
// and so on. Nothing here fabricates a fact or a metric; each is a live piece of
// interface, tinted with the discipline's own accent, and every one collapses to
// a calm, legible static state under prefers-reduced-motion.

const EASE = [0.16, 1, 0.3, 1] as const

// ---------------------------------------------------------------------------
// Frontend — "Sweat the states nobody documents: the empty, the loading, the
// just-tapped." The demo is those states, made switchable.
// ---------------------------------------------------------------------------
type FeState = 'empty' | 'loading' | 'loaded'
const FE_STATES: { key: FeState; label: string }[] = [
  { key: 'empty', label: 'Empty' },
  { key: 'loading', label: 'Loading' },
  { key: 'loaded', label: 'Loaded' },
]
const FE_ROWS = ['Shipped the range pages', 'Redrew the type scale', 'Tuned the page transition']

function FrontendDemo({ accent }: { accent: string }) {
  const reduce = useReducedMotion()
  const [state, setState] = useState<FeState>('loaded')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Picking "loading" walks on to "loaded" so the transition itself is on show —
  // the honest point being that loading is a state you design, not a gap.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (state === 'loading' && !reduce) {
      timer.current = setTimeout(() => setState('loaded'), 1300)
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state, reduce])

  return (
    <div>
      <div className="flex gap-1.5" role="tablist" aria-label="Interface state">
        {FE_STATES.map((s) => {
          const on = state === s.key
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setState(s.key)}
              className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
              style={{
                borderColor: on ? accent : 'rgba(255,255,255,0.12)',
                color: on ? '#0A0A0A' : 'rgba(255,255,255,0.6)',
                backgroundColor: on ? accent : 'transparent',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 min-h-[132px] rounded-2xl border border-white/10 bg-black/30 p-4">
        {state === 'empty' && (
          <div className="flex min-h-[104px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 text-center">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-full border text-sm"
              style={{ borderColor: `${accent}59`, color: accent }}
            >
              +
            </span>
            <p className="mt-2 text-sm text-white/60">Nothing here yet</p>
            <p className="text-xs text-white/35">The first thing you ship lands here.</p>
          </div>
        )}

        {state === 'loading' && (
          <ul className="space-y-3" aria-label="Loading">
            {FE_ROWS.map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-white/10" />
                <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  {!reduce && (
                    <motion.span
                      className="absolute inset-y-0 w-1/3 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${accent}40, transparent)`,
                      }}
                      animate={{ x: ['-120%', '320%'] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'linear', delay: i * 0.12 }}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {state === 'loaded' && (
          <ul className="space-y-2.5">
            {FE_ROWS.map((row, i) => (
              <motion.li
                key={row}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: i * 0.07 }}
                className="flex items-center gap-3 text-sm text-white/80"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                {row}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Native iOS — "The platform conventions you only notice when they are
// missing." A drag that rubber-bands at the edge and springs home, the way a
// native scroll view resists rather than stops dead.
// ---------------------------------------------------------------------------
function IosDemo({ accent }: { accent: string }) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className="flex min-h-[132px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
        <div
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-black"
          style={{ backgroundColor: accent }}
        >
          Rubber-band scroll
        </div>
        <p className="mt-3 text-xs text-white/40">
          A native list resists past its edge and eases back, instead of stopping dead.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <motion.div drag dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} dragElastic={0.35}
        whileTap={{ cursor: 'grabbing' }}
        className="mx-auto flex min-h-[104px] max-w-[220px] cursor-grab select-none flex-col items-center justify-center rounded-2xl px-5 py-4 text-center"
        style={{ backgroundColor: `${accent}1a`, border: `1px solid ${accent}59` }}
      >
        <span className="text-sm font-semibold" style={{ color: accent }}>
          Drag me anywhere
        </span>
        <span className="mt-1 text-xs text-white/45">
          It resists, then springs back — like a native list past its edge.
        </span>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Backend and data — "Web and native never drift." One source of truth; a
// change on either client travels through it to the other. The honest shape of
// the Guided setup, drawn small.
// ---------------------------------------------------------------------------
function BackendDemo({ accent }: { accent: string }) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(3)
  const [from, setFrom] = useState<'web' | 'ios' | null>(null)

  function bump(source: 'web' | 'ios') {
    setFrom(source)
    setCount((c) => c + 1)
  }

  const Client = ({ id, label }: { id: 'web' | 'ios'; label: string }) => (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums" style={{ color: accent }}>
        {count}
      </span>
      <button
        type="button"
        onClick={() => bump(id)}
        className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-white/70 transition-colors hover:text-white"
        style={{ borderColor: `${accent}40` }}
      >
        +1 here
      </button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-2">
        <Client id="web" label="Web" />
        {/* Shared source of truth, with a pulse that shows the write propagating. */}
        <div className="relative flex flex-col items-center px-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white/30">sync</span>
          <div className="relative my-1 h-8 w-14">
            <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-white/15" />
            <div
              className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <AnimatePresence>
              {from && !reduce && (
                <motion.span
                  key={`${from}-${count}`}
                  className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: accent }}
                  initial={{ left: from === 'web' ? '0%' : '100%', opacity: 0 }}
                  animate={{ left: '50%', opacity: 1 }}
                  exit={{ left: from === 'web' ? '100%' : '0%', opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  onAnimationComplete={() => setFrom(null)}
                />
              )}
            </AnimatePresence>
          </div>
          <span className="text-[0.6rem] text-white/30">one store</span>
        </div>
        <Client id="ios" label="iOS" />
      </div>
      <p className="mt-3 text-center text-xs text-white/40">
        Bump either client — both read the same number. Nothing drifts.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Applied AI — "Restraint as a feature: withhold the answer so the
// understanding is earned." A switch between handing over the answer and asking
// the next question, the Socratic model at the heart of Guided.
// ---------------------------------------------------------------------------
const AI_QUESTION = 'A student asks: what is 15% of 80?'
const AI_ANSWER = 'It is 12.'
const AI_SOCRATIC = 'What is 10% of 80 — and what would half of that be?'

function AiDemo({ accent }: { accent: string }) {
  const reduce = useReducedMotion()
  const [ask, setAsk] = useState(true)
  const reply = ask ? AI_SOCRATIC : AI_ANSWER

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-white/45">Response mode</span>
        <div className="flex gap-1.5">
          {[
            { key: true, label: 'Ask instead' },
            { key: false, label: 'Just answer' },
          ].map((m) => {
            const on = ask === m.key
            return (
              <button
                key={String(m.key)}
                type="button"
                onClick={() => setAsk(m.key)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                style={{
                  borderColor: on ? accent : 'rgba(255,255,255,0.12)',
                  color: on ? '#0A0A0A' : 'rgba(255,255,255,0.6)',
                  backgroundColor: on ? accent : 'transparent',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/70">
          {AI_QUESTION}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={String(ask)}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm font-medium text-black"
            style={{ backgroundColor: accent }}
          >
            {reply}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-xs text-white/40">
        {ask
          ? 'The tutor asks the next question. The student does the thinking.'
          : 'Handing the answer over ends the learning. Guided does the opposite.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Motion and design — "The things people feel but cannot name: timing." The
// same travel, run twice at once: naive linear against the considered ease this
// site uses. You feel the difference before you can name it.
// ---------------------------------------------------------------------------
function MotionDemo({ accent }: { accent: string }) {
  const reduce = useReducedMotion()
  const [run, setRun] = useState(0)

  const tracks = [
    { label: 'Linear', ease: 'linear' as const, tint: 'rgba(255,255,255,0.4)' },
    { label: 'Considered', ease: EASE, tint: accent },
  ]

  if (reduce) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm text-white/60">
          Two dots, one distance: a flat linear rate against a considered ease that starts fast and
          settles. The gap between them is the part people feel but cannot name.
        </p>
        <div className="mt-4 space-y-3">
          {tracks.map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-white/45">{t.label}</span>
              <div className="relative h-2 flex-1 rounded-full bg-white/[0.06]">
                <span
                  className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: t.tint }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="space-y-3">
        {tracks.map((t) => (
          <div key={t.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-white/45">{t.label}</span>
            <div className="relative h-2 flex-1 rounded-full bg-white/[0.06]">
              <motion.span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: t.tint }}
                initial={{ left: '0%' }}
                animate={{ left: run % 2 === 0 ? '0%' : 'calc(100% - 0.875rem)' }}
                transition={{ duration: 1.15, ease: t.ease }}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        className="mt-4 rounded-full border px-4 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:text-white"
        style={{ borderColor: `${accent}40` }}
      >
        {run === 0 ? 'Send them across' : 'Send them back'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dispatcher + shared chrome.
// ---------------------------------------------------------------------------
type DemoDef = {
  title: string
  hint: string
  render: (accent: string) => React.ReactNode
}

const DEMOS: Record<string, DemoDef> = {
  frontend: {
    title: 'Every state, designed',
    hint: 'The empty, the loading, the loaded — switch between them.',
    render: (a) => <FrontendDemo accent={a} />,
  },
  ios: {
    title: 'A gesture that resists',
    hint: 'Drag it, and feel it rubber-band home.',
    render: (a) => <IosDemo accent={a} />,
  },
  backend: {
    title: 'One source of truth',
    hint: 'Change either client; both stay in sync.',
    render: (a) => <BackendDemo accent={a} />,
  },
  ai: {
    title: 'Ask, do not answer',
    hint: 'Flip the mode, and watch the reply change shape.',
    render: (a) => <AiDemo accent={a} />,
  },
  motion: {
    title: 'Timing you can feel',
    hint: 'Run the two eases at once, and watch the gap.',
    render: (a) => <MotionDemo accent={a} />,
  },
}

/**
 * A live, discipline-specific demonstration for a /range detail page. Returns
 * null for an unknown id so the page simply omits the section.
 */
export function DisciplineDemo({ id, accent }: { id: string; accent: string }) {
  const def = DEMOS[id]
  if (!def) return null
  return (
    <div
      className="rounded-3xl border bg-white/[0.02] p-6 sm:p-8"
      style={{ borderColor: `${accent}26` }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-lg font-semibold tracking-tight text-white/90">{def.title}</h3>
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
          Live
        </span>
      </div>
      <p className="mt-1.5 text-sm text-white/45">{def.hint}</p>
      <div className="mt-6">{def.render(accent)}</div>
    </div>
  )
}
