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
import { createPortal } from 'react-dom'
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from 'framer-motion'

// A small, self-contained toast system — the site's transient-feedback
// primitive. One provider mounts a single portal viewport on the body; anything
// under it calls `useToast()` and fires a toast for an action that would
// otherwise happen silently (an email copied, a draft handed to the mail app).
//
// Deliberately distinct from the site's other overlays: the `Modal` demands
// attention and traps focus, this never does. Toasts are polite — announced to
// assistive tech via an `aria-live` region, dismissable, auto-expiring, and
// pausing the moment the pointer rests on the stack so nothing vanishes while
// being read. Under reduced motion they cross-fade in place with no slide and
// no sweeping progress bar, but still behave identically.

export type ToastVariant = 'default' | 'success' | 'error'

export interface ToastOptions {
  /** Secondary line under the title. Keep it short and honest. */
  description?: string
  variant?: ToastVariant
  /** Milliseconds on screen before auto-dismiss. Defaults to 3800. */
  duration?: number
}

interface ToastItem extends Required<Omit<ToastOptions, 'description'>> {
  id: number
  message: string
  description?: string
}

interface ToastContextValue {
  /** Show a toast. Returns its id so it can be dismissed early. */
  toast: (message: string, options?: ToastOptions) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 3800

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = nextId.current++
    const item: ToastItem = {
      id,
      message,
      description: options.description,
      variant: options.variant ?? 'default',
      duration: options.duration ?? DEFAULT_DURATION,
    }
    // Newest first; cap the stack so a burst of actions never floods the corner.
    setToasts((current) => [item, ...current].slice(0, 4))
    return id
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      // A polite live region: announced after the user's current task, never
      // interrupting. Pointer-events off on the wrapper so it never blocks the
      // page; each card re-enables them for its own controls.
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

const ACCENT: Record<ToastVariant, string> = {
  default: '#DCF87C',
  success: '#DCF87C',
  error: '#F8A0A0',
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const reduce = useReducedMotion()
  const bar = useAnimationControls()
  // Remaining time is tracked so hovering can pause the countdown and resume it
  // with exactly the time that was left, rather than restarting the full clock.
  const remaining = useRef(toast.duration)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const run = useCallback(
    (ms: number) => {
      clear()
      startedAt.current = Date.now()
      remaining.current = ms
      timer.current = setTimeout(onDismiss, ms)
      if (!reduce) {
        bar.set({ scaleX: remaining.current / toast.duration })
        bar.start({
          scaleX: 0,
          transition: { duration: ms / 1000, ease: 'linear' },
        })
      }
    },
    [bar, clear, onDismiss, reduce, toast.duration],
  )

  const pause = useCallback(() => {
    clear()
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
    if (!reduce) bar.stop()
  }, [bar, clear, reduce])

  useEffect(() => {
    run(toast.duration)
    return clear
    // Runs once per toast; `run`/`clear` are stable for this card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const accent = ACCENT[toast.variant]

  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      onMouseEnter={pause}
      onMouseLeave={() => run(remaining.current)}
      onFocusCapture={pause}
      onBlurCapture={() => run(remaining.current)}
      className="pointer-events-auto relative w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#101010]/95 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md"
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <ToastIcon variant={toast.variant} accent={accent} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-white/90">{toast.message}</p>
          {toast.description && (
            <p className="mt-0.5 text-[13px] leading-snug text-white/45">{toast.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/5 hover:text-white/80"
        >
          <span aria-hidden className="text-lg leading-none">&times;</span>
        </button>
      </div>
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px origin-left"
          style={{ background: accent }}
          initial={{ scaleX: 1 }}
          animate={bar}
        />
      )}
    </motion.div>
  )
}

function ToastIcon({ variant, accent }: { variant: ToastVariant; accent: string }) {
  const common = 'mt-0.5 h-5 w-5 shrink-0'
  if (variant === 'success') {
    return (
      <svg className={common} viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="9" stroke={accent} strokeOpacity="0.4" strokeWidth="1.4" />
        <path d="M6 10.4l2.6 2.6L14 7.6" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (variant === 'error') {
    return (
      <svg className={common} viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="9" stroke={accent} strokeOpacity="0.4" strokeWidth="1.4" />
        <path d="M10 6v5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10" cy="14" r="0.9" fill={accent} />
      </svg>
    )
  }
  return (
    <svg className={common} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke={accent} strokeOpacity="0.4" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.4" fill={accent} />
    </svg>
  )
}
