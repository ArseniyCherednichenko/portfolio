import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GO_TARGETS } from './Keyboard'

// A playable, on-screen keyboard that documents — and drives — the site's real
// keyboard-navigation system. Every cap that maps to a "go to" destination
// (tap `g`, then the key) glows lime and carries its destination label; click
// or focus-and-Enter a mapped cap to actually travel there, so the keyboard
// doubles as a physical site map. Pressing any real key on your keyboard
// depresses its cap live, and pressing the `g` leader arms the map exactly as
// the global shortcut does, lighting every reachable destination for the chord
// window so you can see where the next key would take you.
//
// The destinations are read straight from GO_TARGETS — the same single source
// of truth the command palette's help dialog and the global chord handler use —
// so this can never drift out of step with what the site actually responds to.
//
// Honest about motion: under reduced-motion the depress spring and the leader
// pulse both collapse to instant, legible colour changes, and nothing here
// moves on its own. The global chord handler still owns real navigation; this
// component only mirrors its state for the on-screen picture and offers the
// caps as ordinary links, so it never double-navigates or fights the provider.

const CHORD_WINDOW_MS = 1400

// The physical layout, row by row, as it sits under the hands. Only the letters
// and the single mapped digit matter for the go-chords; the rest are real caps
// so the board reads as a keyboard and not a sparse grid. Offsets stagger the
// rows the way a real staggered keyboard does.
const ROWS: { keys: string[]; offset: number }[] = [
  { keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], offset: 0 },
  { keys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], offset: 0.5 },
  { keys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], offset: 1 },
  { keys: ['z', 'x', 'c', 'v', 'b', 'n', 'm'], offset: 1.75 },
]

interface KeyboardMapProps {
  /** Notified when the leader is armed/disarmed, so a page caption can react. */
  onArmedChange?: (armed: boolean) => void
}

export function KeyboardMap({ onArmedChange }: KeyboardMapProps) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  // key -> destination, derived once from the shared source of truth.
  const destinations = useMemo(() => {
    const map = new Map<string, { to: string; label: string }>()
    for (const g of GO_TARGETS) map.set(g.key, { to: g.to, label: g.label })
    return map
  }, [])

  // The cap physically held down right now (visual depress), and whether the
  // `g` leader is armed (mirrors the global handler's chord window).
  const [pressed, setPressed] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const armTimer = useRef<number | undefined>(undefined)
  const pressTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    onArmedChange?.(armed)
  }, [armed, onArmedChange])

  useEffect(() => {
    function disarm() {
      setArmed(false)
      if (armTimer.current) window.clearTimeout(armTimer.current)
    }
    function onKeyDown(e: KeyboardEvent) {
      // Never mirror system chords or typing into a field — this is a passive
      // reflection of the real handler, so it stays out of the way exactly when
      // the real handler would.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      const key = e.key.toLowerCase()
      // Depress the matching cap briefly.
      setPressed(key)
      if (pressTimer.current) window.clearTimeout(pressTimer.current)
      pressTimer.current = window.setTimeout(() => setPressed(null), 140)

      if (key === 'g') {
        setArmed(true)
        if (armTimer.current) window.clearTimeout(armTimer.current)
        armTimer.current = window.setTimeout(() => setArmed(false), CHORD_WINDOW_MS)
      } else if (armed) {
        // The global handler is about to navigate; drop the armed lighting so
        // the picture matches the moment the chord resolves.
        disarm()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (armTimer.current) window.clearTimeout(armTimer.current)
      if (pressTimer.current) window.clearTimeout(pressTimer.current)
    }
  }, [armed])

  return (
    <div
      className="mx-auto w-full max-w-3xl select-none rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-6"
      role="group"
      aria-label="On-screen keyboard — the mapped keys link to their pages"
    >
      <div className="flex flex-col gap-1.5 sm:gap-2">
        {ROWS.map((row, ri) => (
          <div
            key={ri}
            className="flex justify-center gap-1.5 sm:gap-2"
            style={{ paddingLeft: `${row.offset * 1.5}rem` }}
          >
            {row.keys.map((k) => (
              <Cap
                key={k}
                cap={k}
                dest={destinations.get(k)}
                leader={k === 'g'}
                held={pressed === k}
                armed={armed}
                reduce={!!reduce}
                onGo={(to) => navigate(to)}
              />
            ))}
          </div>
        ))}
        {/* The bottom rail: the leader story in one line, plus the two caps that
            aren't part of the go-chords but are part of the same system. */}
        <div className="mt-1.5 flex items-center justify-center gap-1.5 sm:mt-2 sm:gap-2">
          <StaticCap label="esc" wide title="Close any dialog" />
          <StaticCap label="⌘ K" wide title="Command palette" />
          <StaticCap label="?" title="Shortcuts help" />
          <div
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-[0.7rem] uppercase tracking-[0.2em] text-white/25 sm:h-12"
            aria-hidden
          >
            space
          </div>
        </div>
      </div>
    </div>
  )
}

interface CapProps {
  cap: string
  dest?: { to: string; label: string }
  leader: boolean
  held: boolean
  armed: boolean
  reduce: boolean
  onGo: (to: string) => void
}

function Cap({ cap, dest, leader, held, armed, reduce, onGo }: CapProps) {
  const mapped = !!dest
  // A destination lights up when the leader is armed (its chord is now one key
  // away), or on the usual hover/focus. The leader cap itself carries the glow
  // whenever it is armed.
  const ready = mapped && armed

  const base =
    'group relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-medium transition-colors sm:h-14 sm:w-14'

  const tone = leader
    ? armed
      ? 'border-[#DCF87C] bg-[#DCF87C]/15 text-[#DCF87C]'
      : 'border-[#DCF87C]/50 bg-[#DCF87C]/10 text-[#DCF87C]/90'
    : mapped
      ? ready
        ? 'border-[#DCF87C]/70 bg-[#DCF87C]/12 text-[#DCF87C]'
        : 'border-white/15 bg-white/[0.05] text-white/80 hover:border-[#DCF87C]/50 hover:bg-[#DCF87C]/[0.06] hover:text-[#DCF87C]'
      : 'border-white/8 bg-white/[0.02] text-white/25'

  const depress = held && !reduce ? { y: 2, scale: 0.94 } : { y: 0, scale: 1 }
  const label = cap === '0' ? '0' : cap.toUpperCase()

  const content = (
    <>
      <span className="leading-none">{label}</span>
      {dest && (
        <span className="pointer-events-none absolute -bottom-4 whitespace-nowrap text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-white/30 transition-colors group-hover:text-[#DCF87C]/70">
          {dest.label}
        </span>
      )}
    </>
  )

  // Mapped caps are real links — click, or focus and press Enter, to travel.
  // The extra bottom margin makes room for the destination label beneath.
  if (dest) {
    return (
      <motion.button
        type="button"
        onClick={() => onGo(dest.to)}
        animate={depress}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 26 }}
        className={`${base} ${tone} mb-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70`}
        aria-label={`${label} — go to ${dest.label}`}
      >
        {content}
      </motion.button>
    )
  }

  return (
    <motion.div
      aria-hidden
      animate={depress}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 26 }}
      className={`${base} ${tone} ${leader ? 'mb-4' : ''}`}
    >
      {leader ? (
        <>
          <span className="leading-none">G</span>
          <span className="pointer-events-none absolute -bottom-4 whitespace-nowrap text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-[#DCF87C]/60">
            leader
          </span>
        </>
      ) : (
        content
      )}
    </motion.div>
  )
}

function StaticCap({ label, wide, title }: { label: string; wide?: boolean; title: string }) {
  return (
    <div
      title={title}
      className={`flex h-11 items-center justify-center rounded-lg border border-white/12 bg-white/[0.03] px-3 text-xs font-medium text-white/55 sm:h-12 ${
        wide ? 'min-w-[3.5rem]' : ''
      }`}
    >
      {label}
    </div>
  )
}
