import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Kbd } from './Kbd'

interface ShortcutRecorderProps {
  /** The binding shown at rest, as display tokens, e.g. ['⌘', '⇧', 'K']. */
  defaultKeys?: string[]
  /** Fired with the committed chord whenever a new binding is recorded. */
  onChange?: (keys: string[]) => void
  /** Field label, read by assistive tech and printed above the well. */
  label?: string
  className?: string
}

// KeyboardEvent.key → the glyph a keycap should show. Modifiers map to the
// mac-style symbols the rest of the site already uses (⌘⌥⇧⌃); the common
// editing keys get their legends; anything else is upper-cased as-is.
const DISPLAY: Record<string, string> = {
  meta: '⌘',
  control: '⌃',
  alt: '⌥',
  shift: '⇧',
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  delete: '⌦',
  tab: '⇥',
  ' ': '␣',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  capslock: '⇪',
}

// The four modifiers, in the order a chord reads them — Control, Option, Shift,
// Command — so a recorded binding always prints in the same canonical order
// however the keys were actually pressed.
const MOD_ORDER = ['control', 'alt', 'shift', 'meta'] as const
type Mod = (typeof MOD_ORDER)[number]

const MOD_FLAG: Record<Mod, keyof Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>> = {
  control: 'ctrlKey',
  alt: 'altKey',
  shift: 'shiftKey',
  meta: 'metaKey',
}

function glyph(key: string): string {
  const low = key.toLowerCase()
  if (DISPLAY[low]) return DISPLAY[low]
  return key.length === 1 ? key.toUpperCase() : key
}

/** Build the ordered display chord from the event: canonical modifiers, then
 * the main key. Returns null while only modifiers are held — a chord is not
 * finished until a non-modifier lands. */
function chordFrom(e: KeyboardEvent): string[] | null {
  const low = e.key.toLowerCase()
  if ((MOD_ORDER as readonly string[]).includes(low)) return null
  const mods = MOD_ORDER.filter((m) => e[MOD_FLAG[m]]).map((m) => DISPLAY[m])
  return [...mods, glyph(e.key)]
}

/**
 * ShortcutRecorder — the keybinding-capture control from a real settings panel
 * (VS Code, Linear, a DAW). Focus the well, or press Record, and it listens:
 * hold any modifiers, strike a key, and the live chord freezes into a row of
 * keycaps. It is a genuine control, not a depiction — while recording it
 * swallows the keystroke (so Cmd-S records instead of saving the page) and
 * commits the moment a non-modifier key lands. Escape cancels and restores the
 * previous binding; a Clear button empties it. Each committed chord is
 * announced through a polite live region and handed to `onChange`.
 *
 * The caps reuse the site's Kbd primitive, so a recorded binding reads exactly
 * like every printed legend elsewhere on the site. The recording state carries
 * a slow pulse on the status dot and a brief lime confirm-flash when a chord
 * commits; both are dropped under reduced motion, where the state changes read
 * through colour and copy alone.
 */
export function ShortcutRecorder({
  defaultKeys = [],
  onChange,
  label = 'Keyboard shortcut',
  className = '',
}: ShortcutRecorderProps) {
  const reduce = useReducedMotion()
  const [keys, setKeys] = useState<string[]>(defaultKeys)
  const [recording, setRecording] = useState(false)
  // The chord being built this instant, shown live as the keys go down.
  const [live, setLive] = useState<string[]>([])
  // A short-lived announcement + flash key bumped on every commit.
  const [flash, setFlash] = useState(0)
  const wellRef = useRef<HTMLButtonElement>(null)

  const stop = useCallback(() => {
    setRecording(false)
    setLive([])
  }, [])

  // While recording, the window-level capture listener owns every keystroke:
  // it previews the chord on each modifier, commits on the first non-modifier,
  // and never lets the browser act on the combination.
  useEffect(() => {
    if (!recording) return

    const onKeyDown = (e: KeyboardEvent) => {
      // Escape bails without committing — the binding stays as it was.
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        stop()
        wellRef.current?.blur()
        return
      }
      e.preventDefault()
      const chord = chordFrom(e)
      if (chord) {
        // A real key landed: commit the finished chord and leave recording.
        setKeys(chord)
        setLive([])
        setRecording(false)
        setFlash((f) => f + 1)
        onChange?.(chord)
      } else {
        // Only modifiers so far — preview them so the well fills as you hold.
        const mods = MOD_ORDER.filter((m) => e[MOD_FLAG[m]]).map((m) => DISPLAY[m])
        setLive(mods)
      }
    }

    // Releasing a modifier before the main key thins the live preview back out.
    const onKeyUp = (e: KeyboardEvent) => {
      e.preventDefault()
      const mods = MOD_ORDER.filter((m) => e[MOD_FLAG[m]]).map((m) => DISPLAY[m])
      setLive(mods)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', stop)
    }
  }, [recording, onChange, stop])

  const shown = recording ? live : keys
  const empty = shown.length === 0

  const announce = recording
    ? 'Recording. Press a key combination.'
    : keys.length
      ? `Shortcut set to ${keys.join(' ')}`
      : 'No shortcut set'

  return (
    <div className={`w-full max-w-sm ${className}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{label}</span>
        {keys.length > 0 && !recording && (
          <button
            type="button"
            onClick={() => {
              setKeys([])
              onChange?.([])
            }}
            className="text-xs font-medium text-white/40 underline-offset-2 transition-colors hover:text-white/70 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <button
        ref={wellRef}
        type="button"
        aria-label={label}
        onClick={() => (recording ? stop() : setRecording(true))}
        onFocus={() => setRecording(true)}
        onBlur={stop}
        className={`relative flex min-h-[3.5rem] w-full items-center gap-2 overflow-hidden rounded-xl border px-4 py-3 text-left outline-none transition-colors duration-200 ${
          recording
            ? 'border-[#DCF87C]/50 bg-[#DCF87C]/[0.06]'
            : 'border-white/12 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05] focus-visible:border-[#DCF87C]/50'
        }`}
      >
        {/* Commit flash — a lime wash that sweeps once when a chord lands. */}
        <AnimatePresence>
          {flash > 0 && !reduce && (
            <motion.span
              key={flash}
              aria-hidden
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 bg-[#DCF87C]/20"
            />
          )}
        </AnimatePresence>

        <span className="relative flex flex-1 flex-wrap items-center gap-1.5">
          {empty ? (
            <span className="text-sm text-white/35">
              {recording ? 'Listening — strike a combination' : 'Click to record a shortcut'}
            </span>
          ) : (
            shown.map((k, i) => (
              <Kbd key={`${k}-${i}`} size="lg">
                {k}
              </Kbd>
            ))
          )}
        </span>

        {/* Status dot — pulses while listening, steady lime once a chord is set. */}
        <span className="relative flex items-center gap-2">
          {recording ? (
            <motion.span
              aria-hidden
              className="block h-2 w-2 rounded-full bg-[#DCF87C]"
              animate={reduce ? {} : { scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <span aria-hidden className={`block h-2 w-2 rounded-full ${keys.length ? 'bg-[#DCF87C]/70' : 'bg-white/20'}`} />
          )}
        </span>
      </button>

      <p className="mt-2 text-xs text-white/35">
        {recording ? 'Press Escape to cancel.' : 'Focus the field or click it, then press your keys.'}
      </p>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  )
}
