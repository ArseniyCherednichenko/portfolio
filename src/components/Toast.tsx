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
import { createPortal } from 'react-dom'

// A site-wide toast system. A provider owns a small queue of transient
// messages; anything under it calls useToast() -> toast(...) to raise one.
// Toasts stack at the bottom-centre, spring up glass-cardded, count down a thin
// lime meter, pause when hovered or focused, and can be flicked away or
// dismissed. The stack is an aria-live region so a screen reader hears each
// message. Reduced-motion aware: no drift, no travelling meter, just a clean
// fade — the auto-dismiss timing is unchanged so nothing lingers.

const EASE = [0.16, 1, 0.3, 1] as const
const DEFAULT_DURATION = 2600
const MAX_VISIBLE = 3

export type ToastTone = 'default' | 'success' | 'error'

export interface ToastOptions {
  /** Optional short label above nothing — kept minimal; the message carries it. */
  tone?: ToastTone
  /** Milliseconds before auto-dismiss. Pass 0 to keep it until dismissed. */
  duration?: number
}

interface ToastItem extends Required<Pick<ToastOptions, 'tone' | 'duration'>> {
  id: number
  message: string
}

type Ctx = {
  /** Raise a toast. Returns its id so it can be dismissed early if needed. */
  toast: (message: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<Ctx | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = nextId.current++
    const item: ToastItem = {
      id,
      message,
      tone: options.tone ?? 'default',
      duration: options.duration ?? DEFAULT_DURATION,
    }
    // Keep the stack shallow: newest lives at the end (nearest the edge), and
    // anything past the cap falls off the top so the corner never fills up.
    setItems((list) => [...list, item].slice(-MAX_VISIBLE))
    return id
  }, [])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function Toaster({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[200] flex flex-col items-center gap-2.5 px-4 sm:bottom-8"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const reduce = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const accent = toast.tone === 'error' ? '#f4a4a4' : '#DCF87C'
  const timed = toast.duration > 0
  // With motion, the countdown meter IS the clock: one CSS animation both
  // depletes the bar and, on its end, dismisses the toast — so the two can
  // never drift, and pausing the animation pauses the dismissal too. Under
  // reduced motion there is no travelling bar, so a plain paused-aware timer
  // stands in.
  const meterDriven = timed && !reduce

  useEffect(() => {
    if (!timed || meterDriven || paused) return
    const t = window.setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => window.clearTimeout(t)
  }, [timed, meterDriven, paused, toast.duration, toast.id, onDismiss])

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.32, ease: EASE }}
      drag={reduce ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500) onDismiss(toast.id)
      }}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="pointer-events-auto relative w-full max-w-sm cursor-grab overflow-hidden rounded-2xl border border-white/12 bg-[#141414]/85 pl-4 pr-3 py-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl active:cursor-grabbing"
      role="status"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <ToastIcon tone={toast.tone} />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-white/90">
          {toast.message}
        </p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Countdown meter — depletes over the toast's lifetime and freezes on
          hover/focus. When motion is allowed the bar's own animation drives the
          dismissal (onAnimationEnd), so meter and clock are the same thing;
          under reduced motion it holds as a static accent rule while a plain
          timer handles the timing. */}
      {timed && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06]">
          {meterDriven ? (
            <span
              className="block h-full origin-left will-change-transform"
              style={{
                backgroundColor: accent,
                animation: `toastMeter ${toast.duration}ms linear forwards`,
                animationPlayState: paused ? 'paused' : 'running',
              }}
              onAnimationEnd={() => onDismiss(toast.id)}
            />
          ) : (
            <span className="block h-full w-full" style={{ backgroundColor: accent, opacity: 0.5 }} />
          )}
        </span>
      )}
    </motion.div>
  )
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (tone === 'error') {
    return (
      <svg {...common}>
        <path d="M12 8v5M12 16.5v.5" />
      </svg>
    )
  }
  // default + success both read as a confirmation tick
  return (
    <svg {...common}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}
