import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Modal } from './Modal'
import { GradientText } from './GradientText'

// Site-wide keyboard navigation system.
//
// Two layers, both honest about what they do:
//  - "Go to" chords: tap `g`, then a destination key (h/w/a/t/p/c) to jump
//    between pages without reaching for the mouse — a small badge shows the
//    chord is armed, and it disarms after a short window or on any other key.
//  - A shortcuts help dialog, opened with `?`, that documents every shortcut
//    the site responds to (this, the command palette, escape).
//
// Global key handling bails whenever the user is typing in a field or any
// modal is open (detected via an `[aria-modal="true"]` element), so it never
// fights the command palette, contact dialog, or lightbox. Reduced-motion
// aware throughout.

type GoTarget = { key: string; to: string; label: string }

// Single source of truth for the "go to" chords, reused by the help dialog.
export const GO_TARGETS: GoTarget[] = [
  { key: 'h', to: '/', label: 'Home' },
  { key: 'w', to: '/work', label: 'Work' },
  { key: 'a', to: '/about', label: 'About' },
  { key: 't', to: '/toolkit', label: 'Toolkit' },
  { key: 'p', to: '/playground', label: 'Playground' },
  { key: 'n', to: '/now', label: 'Now' },
  { key: 'c', to: '/contact', label: 'Contact' },
  { key: 'l', to: '/colophon', label: 'Colophon' },
]

const CHORD_WINDOW_MS = 1400

type Ctx = { openShortcuts: () => void }
const KeyboardContext = createContext<Ctx | null>(null)

export function useShortcuts() {
  const ctx = useContext(KeyboardContext)
  if (!ctx) throw new Error('useShortcuts must be used within KeyboardProvider')
  return ctx
}

// True when a global shortcut should be ignored: the user is typing into a
// form control / contenteditable, or a modal surface is currently open.
function shouldIgnore(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true
  const t = e.target as HTMLElement | null
  if (t) {
    const tag = t.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return true
  }
  if (document.querySelector('[aria-modal="true"]')) return true
  return false
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const armedRef = useRef(false)
  const timerRef = useRef<number | undefined>(undefined)

  const openShortcuts = useCallback(() => setHelpOpen(true), [])
  const closeShortcuts = useCallback(() => setHelpOpen(false), [])

  const disarm = useCallback(() => {
    armedRef.current = false
    setArmed(false)
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (shouldIgnore(e)) return

      // Second keystroke of a chord: resolve a destination, otherwise disarm.
      if (armedRef.current) {
        const key = e.key.toLowerCase()
        const target = GO_TARGETS.find((g) => g.key === key)
        disarm()
        if (target) {
          e.preventDefault()
          navigate(target.to)
        }
        return
      }

      // `?` (shift + /) opens the help dialog.
      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
        return
      }

      // `g` arms the "go to" chord.
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault()
        armedRef.current = true
        setArmed(true)
        if (timerRef.current) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(disarm, CHORD_WINDOW_MS)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [navigate, disarm])

  const value = useMemo(() => ({ openShortcuts }), [openShortcuts])

  return (
    <KeyboardContext.Provider value={value}>
      {children}
      <ChordHint armed={armed} />
      <ShortcutsDialog open={helpOpen} onClose={closeShortcuts} />
    </KeyboardContext.Provider>
  )
}

// A small badge that confirms the "go to" chord is armed and waiting for a
// destination key — disappears the moment it resolves or times out.
function ChordHint({ armed }: { armed: boolean }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {armed && (
        <motion.div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[130] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#0E0E0E]/90 px-3.5 py-2 text-xs text-white/60 shadow-2xl shadow-black/50 backdrop-blur-sm"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <Key>g</Key>
          <span className="text-white/35">then</span>
          <span className="text-white/55">a page key</span>
          <span aria-hidden className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#DCF87C]" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type Row = { keys: string[]; label: string; chain?: boolean }
type Section = { title: string; rows: Row[] }

const SECTIONS: Section[] = [
  {
    title: 'Go to',
    rows: GO_TARGETS.map((g) => ({ keys: ['g', g.key], label: g.label, chain: true })),
  },
  {
    title: 'Command',
    rows: [
      { keys: ['⌘', 'K'], label: 'Open the command palette' },
      { keys: ['?'], label: 'Show this shortcuts panel' },
      { keys: ['esc'], label: 'Close any open dialog' },
    ],
  },
]

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion()
  return (
    <Modal open={open} onClose={onClose}>
      <div className="pr-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/80">
          Keyboard
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          <GradientText>Shortcuts</GradientText>
        </h2>
        <p className="mt-2 text-sm text-white/45">
          This site is built to be driven from the keyboard. Tap{' '}
          <Key>g</Key> then a page key to move around.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {SECTIONS.map((section, si) => (
          <div key={section.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.rows.map((row, ri) => (
                <motion.li
                  key={row.label}
                  className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]"
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: reduce ? 0 : 0.28,
                    delay: reduce ? 0 : 0.04 * (si * 4 + ri),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <span className="text-sm text-white/70">{row.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {row.keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-[10px] text-white/25">
                            {row.chain ? 'then' : ''}
                          </span>
                        )}
                        <Key>{k}</Key>
                      </span>
                    ))}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-1.5 py-1 text-[11px] font-medium text-white/65 shadow-[0_1px_0_rgba(0,0,0,0.4)]">
      {children}
    </kbd>
  )
}
