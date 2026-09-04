import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { Modal } from './Modal'
import { Eyebrow } from './Eyebrow'

// Site-wide viewer preferences. Right now it governs one honest, meaningful
// thing: motion. The site already respects prefers-reduced-motion everywhere
// (every animated component reads useReducedMotion), so the cleanest way to put
// that control in the visitor's hands is to sit a single MotionConfig above the
// whole tree and let this panel steer its reducedMotion value. Framer's
// useReducedMotion reads from that context, so one choice here cascades to all
// ~180 hand-built components at once — no per-component wiring, no drift.
//
//   System — reducedMotion="user":   follow the device's OS setting (default).
//   Calm   — reducedMotion="always": ease every non-essential animation off.
//   Full   — reducedMotion="never":  keep all motion on, even if the OS asks
//                                     to reduce it (an explicit visitor opt-in).
//
// The choice persists per browser. A provider owns it and exposes
// usePreferences(); the Nav button and the command palette open the same panel.

export type MotionPref = 'system' | 'calm' | 'full'

const STORAGE_KEY = 'pf:prefs:motion'

// Each preference maps straight onto a MotionConfig reducedMotion value.
const REDUCED_MOTION: Record<MotionPref, 'user' | 'always' | 'never'> = {
  system: 'user',
  calm: 'always',
  full: 'never',
}

const OPTIONS: ReadonlyArray<{ value: MotionPref; label: string; blurb: string }> = [
  {
    value: 'system',
    label: 'System',
    blurb: 'Follow your device. If it asks to reduce motion, so does the site.',
  },
  {
    value: 'calm',
    label: 'Calm',
    blurb: 'Ease every non-essential animation off. Content still reveals — it just stops moving.',
  },
  {
    value: 'full',
    label: 'Full',
    blurb: 'Keep every animation on, even if your device asks to reduce it.',
  },
]

function isMotionPref(v: unknown): v is MotionPref {
  return v === 'system' || v === 'calm' || v === 'full'
}

function loadMotion(): MotionPref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isMotionPref(raw)) return raw
  } catch {
    /* storage blocked (private mode) — fall back to the honest default */
  }
  return 'system'
}

// Reactively read whether the OS currently asks to reduce motion, so the panel
// can tell the visitor what "System" resolves to right now.
function useOsReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

type Ctx = {
  open: () => void
  motion: MotionPref
  setMotion: (m: MotionPref) => void
}

const PreferencesContext = createContext<Ctx | null>(null)

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pref, setPref] = useState<MotionPref>(loadMotion)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const setMotion = useCallback((m: MotionPref) => {
    setPref(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* storage blocked — the choice still applies for this session */
    }
  }, [])

  const value = useMemo<Ctx>(() => ({ open, motion: pref, setMotion }), [open, pref, setMotion])

  return (
    <PreferencesContext.Provider value={value}>
      {/* One MotionConfig above the entire tree. Every component's
          useReducedMotion() reads its reducedMotion, so this single value is the
          whole site's motion switch. */}
      <MotionConfig reducedMotion={REDUCED_MOTION[pref]}>
        {children}
        <PreferencesDialog open={isOpen} onClose={close} pref={pref} onSelect={setMotion} />
      </MotionConfig>
    </PreferencesContext.Provider>
  )
}

function PreferencesDialog({
  open,
  onClose,
  pref,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  pref: MotionPref
  onSelect: (m: MotionPref) => void
}) {
  const osReduced = useOsReducedMotion()
  const active = OPTIONS.find((o) => o.value === pref) ?? OPTIONS[0]

  // What is actually in force right now, spelled out plainly.
  const effective =
    pref === 'system'
      ? osReduced
        ? 'Your device asks to reduce motion, so the site is calm.'
        : 'Your device allows motion, so the site runs full.'
      : pref === 'calm'
        ? 'Animation is eased off across the whole site.'
        : 'All motion is on across the whole site.'

  return (
    <Modal open={open} onClose={onClose} label="Preferences">
      <Eyebrow>Preferences</Eyebrow>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Tune the motion.</h2>
      <p className="mt-3 max-w-sm leading-relaxed text-white/60">
        This whole site moves. If that is not what you want, it does not have to — the setting rides
        every animation at once, and it is remembered on this device.
      </p>

      <div className="mt-7">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">Motion</span>
          <span className="text-xs text-white/30">{active.label}</span>
        </div>
        <Segmented value={pref} onChange={onSelect} />
        <p className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-white/55">{active.blurb}</p>
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <span
          aria-hidden
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
            effective.includes('calm') || effective.includes('eased')
              ? 'bg-white/40'
              : 'bg-[#DCF87C]'
          }`}
        />
        <p className="text-sm leading-relaxed text-white/60">{effective}</p>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-white/30">
        Every component here is hand-built to respect this — content always stays readable, only the
        movement changes.
      </p>
    </Modal>
  )
}

// A three-way segmented radiogroup with a sliding lime pill. Real radio
// semantics: arrow keys move the selection, the pill tracks the active option
// with a shared layoutId (which snaps rather than glides the instant motion is
// eased off — the control demonstrating its own setting).
function Segmented({ value, onChange }: { value: MotionPref; onChange: (m: MotionPref) => void }) {
  const reduce = useReducedMotion()
  const index = OPTIONS.findIndex((o) => o.value === value)

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = (index + dir + OPTIONS.length) % OPTIONS.length
    onChange(OPTIONS[next].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Motion"
      onKeyDown={onKeyDown}
      className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1"
    >
      {OPTIONS.map((o) => {
        const isActive = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 ${
              isActive ? 'text-black' : 'text-white/60 hover:text-white/90'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="prefs-motion-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-[#DCF87C]"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                }
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
