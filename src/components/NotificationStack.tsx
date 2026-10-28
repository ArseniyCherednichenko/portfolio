import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react'

// The notification pile every phone lock screen and every app's bell-icon
// dropdown has, rebuilt by hand — and deliberately the *persistent* counterpart
// to the Toast that already lives in this library. A Toast is ephemeral: it
// slides in, counts down, and dismisses itself, and you are not meant to manage
// it. This is the opposite surface: notifications that pile up and wait, that
// you collapse into a tidy deck or fan out into a readable list, that you clear
// one at a time with a swipe or all at once — the small, unglamorous product
// craft of an inbox rather than a decoration.
//
// Three details carry it, and all three are the kind a bare list skips. The
// COLLAPSE: more than one notification stacks into a single deck — the front
// card whole, the two behind it scaled back and peeking below like real paper —
// so a busy surface stays one card tall until you choose to open it. The SWIPE:
// a card is a drag handle, and throwing it past a threshold dismisses it while a
// soft "clear" wash warms in behind it to say what the gesture will do; let go
// short of the threshold and it springs home. And the ARRIVAL: a new
// notification springs in from above and pushes the rest down on a layout
// spring, so the stack visibly makes room rather than snapping.
//
// Honest about the content: the notifications here are generic product samples
// — a passing build, a calendar nudge, a review request — illustrating the
// pattern, not a feed of anything real.
//
// Reachable without a pointer or a steady hand: the whole thing is a labelled
// region, every card is focusable and dismissible with Backspace or Delete (the
// swipe is an enhancement, never the only way out), every control is a real
// button, and each arrival, dismissal and clear is announced through a polite
// live region. Under prefers-reduced-motion the drag, the arrival spring and
// the exit slide are all dropped — cards appear and leave in place — so the
// surface behaves identically with nothing moving.

const EASE = [0.16, 1, 0.3, 1] as const

export interface Notif {
  id: string
  /** Short source label shown in the glyph tile, e.g. "CI", "Cal". */
  app: string
  /** Per-source accent for the tile — a visual token, not a claim. */
  accent: string
  title: string
  body: string
  /** A relative time string; purely illustrative. */
  time: string
}

// The sample feed. Generic UI notifications, clearly illustrative — no real
// account, inbox, or event is implied. `New notification` walks this pool.
const POOL: readonly Omit<Notif, 'id'>[] = [
  { app: 'CI', accent: '#DCF87C', title: 'Build passed', body: 'main is green — 312 tests in 48s', time: 'now' },
  { app: 'Cal', accent: '#8CC2FF', title: 'Stand-up at 10:00', body: 'Starts in 15 minutes', time: '9m' },
  { app: 'Git', accent: '#C6A8FF', title: 'Review requested', body: 'Someone asked for your eyes on a PR', time: '22m' },
  { app: 'Mail', accent: '#FFB38C', title: 'New message', body: 'A reply just landed in your inbox', time: '34m' },
  { app: 'Pay', accent: '#7FE0C0', title: 'Payment received', body: 'An invoice was settled', time: '1h' },
  { app: 'Note', accent: '#F58CB0', title: 'Draft saved', body: 'Your changes are safe', time: '3h' },
]

let seq = 0
function makeNotif(source: Omit<Notif, 'id'>): Notif {
  seq += 1
  return { ...source, id: `n${seq}` }
}

/** The small rounded source tile — a monogram over a tinted field. */
function Glyph({ app, accent }: { app: string; accent: string }) {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold tracking-tight text-black"
      style={{ backgroundColor: accent }}
    >
      {app}
    </span>
  )
}

function DismissIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// One notification, rendered as a draggable card. The drag writes its own x,
// and past the threshold the card leaves to that side; a "clear" wash warms in
// proportionally as it travels so the gesture reads before it commits.
function Card({
  notif,
  onDismiss,
  reduce,
}: {
  notif: Notif
  onDismiss: (id: string) => void
  reduce: boolean | null
}) {
  const [bg, setBg] = useState(0) // 0..1 — how far toward a dismiss the drag is
  const THRESHOLD = 96

  function onDrag(_e: unknown, info: PanInfo) {
    setBg(Math.min(1, Math.abs(info.offset.x) / THRESHOLD))
  }
  function onDragEnd(_e: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > THRESHOLD || Math.abs(info.velocity.x) > 500) {
      onDismiss(notif.id)
    } else {
      setBg(0)
    }
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      onDismiss(notif.id)
    }
  }

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 0, scale: 0.9, transition: { duration: 0.2, ease: EASE } }}
      transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 34 }}
      drag={reduce ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.5}
      dragConstraints={{ left: 0, right: 0 }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label={`${notif.title}. ${notif.body}. Press Backspace to dismiss.`}
      className="group/notif relative flex cursor-grab items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#141414] px-3.5 py-3 shadow-lg shadow-black/30 outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 active:cursor-grabbing"
    >
      {/* The dismiss wash, lit by how far the swipe has travelled. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/25"
        style={{ opacity: bg }}
      />
      <Glyph app={notif.app} accent={notif.accent} />
      <div className="relative min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="truncate font-display text-[15px] font-semibold leading-tight text-white/90">{notif.title}</h4>
          <span className="shrink-0 text-[11px] tabular-nums text-white/35">{notif.time}</span>
        </div>
        <p className="mt-0.5 truncate text-[13px] leading-snug text-white/55">{notif.body}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(notif.id)}
        aria-label={`Dismiss: ${notif.title}`}
        className="relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/40 opacity-0 transition-all hover:bg-white/10 hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 group-hover/notif:opacity-100"
      >
        <DismissIcon />
      </button>
    </motion.div>
  )
}

// The collapsed deck: the front card whole, the next two scaled back and
// peeking below like a short pile of paper. The whole deck is one button that
// fans the list open.
function Deck({
  items,
  onExpand,
  reduce,
}: {
  items: Notif[]
  onExpand: () => void
  reduce: boolean | null
}) {
  const front = items[0]
  const behind = Math.min(items.length - 1, 2)
  return (
    <motion.button
      type="button"
      layout={!reduce}
      onClick={onExpand}
      aria-label={`Show all ${items.length} notifications`}
      className="relative block w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
    >
      {/* The peeking cards behind, drawn as plain bars so the count reads at a
          glance without competing with the front card's content. */}
      {Array.from({ length: behind }).map((_, i) => {
        const depth = i + 1
        return (
          <span
            key={depth}
            aria-hidden
            className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2 rounded-2xl border border-white/10 bg-[#101010] shadow-lg shadow-black/30"
            style={{
              transform: `translate(-50%, ${depth * 9}px) scale(${1 - depth * 0.05})`,
              zIndex: -depth,
              opacity: 1 - depth * 0.28,
            }}
          />
        )
      })}
      <div className="relative flex items-start gap-3 rounded-2xl border border-white/12 bg-[#161616] px-3.5 py-3 text-left shadow-xl shadow-black/40">
        <Glyph app={front.app} accent={front.accent} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate font-display text-[15px] font-semibold leading-tight text-white/90">{front.title}</h4>
            <span className="shrink-0 text-[11px] tabular-nums text-white/35">{front.time}</span>
          </div>
          <p className="mt-0.5 truncate text-[13px] leading-snug text-white/55">{front.body}</p>
        </div>
      </div>
      {/* A hint, offset to sit under the peeking stack. */}
      <span
        className="mt-5 block text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40"
        style={{ marginTop: behind * 9 + 10 }}
      >
        {items.length} notifications · tap to open
      </span>
    </motion.button>
  )
}

export function NotificationStack({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const [items, setItems] = useState<Notif[]>(() => POOL.slice(0, 3).map(makeNotif))
  const [expanded, setExpanded] = useState(false)
  const [announce, setAnnounce] = useState('')
  const poolIndex = useRef(3)
  const listId = useId()

  const dismiss = useCallback((id: string) => {
    setItems((prev) => {
      const gone = prev.find((n) => n.id === id)
      if (gone) setAnnounce(`Dismissed: ${gone.title}`)
      const next = prev.filter((n) => n.id !== id)
      if (next.length <= 1) setExpanded(false)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    setExpanded(false)
    setAnnounce('All notifications cleared')
  }, [])

  const push = useCallback(() => {
    const source = POOL[poolIndex.current % POOL.length]
    poolIndex.current += 1
    const n = makeNotif(source)
    setItems((prev) => [n, ...prev])
    setAnnounce(`New notification: ${n.title}. ${n.body}`)
  }, [])

  const showList = expanded || items.length <= 1

  return (
    <div className={`w-full max-w-sm ${className}`}>
      {/* Polite live region — announces every arrival, dismissal, and clear. */}
      <p className="sr-only" aria-live="polite" role="status">
        {announce}
      </p>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/55">Notifications</h3>
          <AnimatePresence mode="popLayout" initial={false}>
            {items.length > 0 && (
              <motion.span
                key={items.length}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="grid h-5 min-w-5 place-items-center rounded-full bg-[#DCF87C] px-1.5 text-[11px] font-bold tabular-nums text-black"
              >
                {items.length}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1.5">
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls={listId}
                className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:border-white/25 hover:text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
              >
                {expanded ? 'Collapse' : 'Show all'}
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:border-red-400/40 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div id={listId} role="region" aria-label="Notifications" className="relative">
        {items.length === 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="grid place-items-center rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center"
          >
            <span aria-hidden className="mb-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 text-[#DCF87C]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <p className="text-sm font-medium text-white/60">You&rsquo;re all caught up</p>
            <p className="mt-1 text-xs text-white/35">No notifications waiting.</p>
          </motion.div>
        ) : showList ? (
          <motion.div layout={!reduce} className="flex flex-col gap-2.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((n) => (
                <Card key={n.id} notif={n} onDismiss={dismiss} reduce={reduce} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Deck items={items} onExpand={() => setExpanded(true)} reduce={reduce} />
        )}
      </div>

      {/* Demo controls — this is a live showcase, so it carries the affordance
          to watch an arrival land and the stack make room. */}
      <div className="mt-5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={push}
          className="rounded-full bg-[#DCF87C] px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-[#e6ff9a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
        >
          New notification
        </button>
        <span className="text-xs text-white/35">Swipe a card, or press Backspace on a focused one.</span>
      </div>
    </div>
  )
}
