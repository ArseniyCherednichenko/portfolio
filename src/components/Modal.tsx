import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

// Focusable elements a Tab trap should cycle through — the standard set, minus
// anything explicitly removed from the tab order or disabled.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible animated modal. The foundation every popup on the site is built
 * on — the project quick-look, the command surfaces, the contact dialog — so
 * the care lives here once and every consumer inherits it:
 *
 * - **Focus trap.** Tab and Shift+Tab cycle within the panel; focus can't fall
 *   back to the page behind an open dialog.
 * - **Focus handoff and restore.** On open, focus moves into the dialog (unless
 *   a consumer has already claimed it — e.g. an autofocused input wins); on
 *   close, it returns to whatever was focused when the dialog opened, so a
 *   keyboard user never loses their place.
 * - **Reduced motion.** The slide-and-scale collapses to a plain fade when the
 *   viewer asks for less motion.
 * - **No layout shift.** Locking the body scroll pads out the vanished
 *   scrollbar's width, so the page underneath doesn't jump as the dialog opens.
 * - **Tall content scrolls.** The panel caps its height and scrolls its body,
 *   with the close button pinned outside the scroll region.
 * - **A real accessible name.** `role="dialog"` sits on the panel with an
 *   `aria-label` (or `aria-labelledby`), not stranded on the backdrop.
 */
export function Modal({
  open,
  onClose,
  children,
  label = 'Dialog',
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Accessible name for the dialog. Ignored when `labelledBy` is given. */
  label?: string
  /** id of an element inside that titles the dialog — preferred over `label`. */
  labelledBy?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  // The element focused before the dialog opened, restored to on close.
  const restoreRef = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()

  // Escape to close, plus body-scroll lock with scrollbar-width compensation so
  // the page behind never shifts sideways when the scrollbar is removed.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const { body, documentElement } = document
    const prevOverflow = body.style.overflow
    const prevPad = body.style.paddingRight
    const barWidth = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (barWidth > 0) body.style.paddingRight = `${barWidth}px`
    return () => {
      document.removeEventListener('keydown', onKey)
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPad
    }
  }, [open, onClose])

  // Move focus into the dialog on open, and return it on close. A consumer that
  // autofocuses its own field wins — we only step in if focus is still loose
  // after the panel has mounted (checked on the next frame, so child effects
  // and browser autofocus run first).
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel || panel.contains(document.activeElement)) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    })
    return () => {
      cancelAnimationFrame(raf)
      // Restore only if focus is still inside the closing dialog, so we never
      // yank it away from wherever the user has since moved.
      const panel = panelRef.current
      const restore = restoreRef.current
      if (restore && panel && panel.contains(document.activeElement)) {
        restore.focus?.()
      }
    }
  }, [open])

  // Keep Tab within the panel while the dialog is open.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
    if (items.length === 0) {
      // Nothing to land on but the panel — hold focus there.
      e.preventDefault()
      panel.focus()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first || active === panel) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: 40, opacity: 0, scale: 0.98 },
        animate: { y: 0, opacity: 1, scale: 1 },
        exit: { y: 20, opacity: 0, scale: 0.98 },
      }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={labelledBy ? undefined : label}
            aria-labelledby={labelledBy ?? undefined}
            tabIndex={-1}
            className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-[#101010] outline-none sm:max-h-[88dvh] sm:rounded-3xl"
            {...enter}
            transition={{ duration: reduce ? 0.15 : 0.3, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            >
              <span aria-hidden className="text-2xl leading-none">&times;</span>
            </button>
            {/* The body scrolls when it outgrows the panel; the close button
                above stays pinned because it lives outside this region. */}
            <div className="overflow-y-auto overscroll-contain p-8">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
