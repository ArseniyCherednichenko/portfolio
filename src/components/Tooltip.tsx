import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

// Per-placement geometry: where the bubble sits relative to the trigger, the
// direction it drifts in from, and where the little arrow tucks against it.
const GEOMETRY: Record<
  TooltipPlacement,
  { wrap: string; offset: { x: number; y: number }; arrow: string }
> = {
  top: {
    wrap: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    offset: { x: 0, y: 6 },
    arrow: 'left-1/2 top-full -translate-x-1/2 -mt-1',
  },
  bottom: {
    wrap: 'top-full left-1/2 -translate-x-1/2 mt-2',
    offset: { x: 0, y: -6 },
    arrow: 'left-1/2 bottom-full -translate-x-1/2 -mb-1',
  },
  left: {
    wrap: 'right-full top-1/2 -translate-y-1/2 mr-2',
    offset: { x: 6, y: 0 },
    arrow: 'top-1/2 left-full -translate-y-1/2 -ml-1',
  },
  right: {
    wrap: 'left-full top-1/2 -translate-y-1/2 ml-2',
    offset: { x: -6, y: 0 },
    arrow: 'top-1/2 right-full -translate-y-1/2 -mr-1',
  },
}

/**
 * A small, accessible, spring-animated tooltip. Wrap any trigger — a button, a
 * link, a chip — and a labelled bubble rises on hover and on keyboard focus,
 * drifting in from the trigger's edge. It closes on leave, blur, and Escape.
 *
 * The trigger carries `aria-describedby` pointing at the bubble (`role=
 * "tooltip"`), so assistive tech announces the hint with the control rather
 * than losing it. A short open delay keeps it from flickering as the cursor
 * passes through; the close is immediate so it never lingers in the way. Under
 * reduced motion it simply fades, with no travel.
 *
 * Positioning is wrapper-relative (no portal), which keeps it dependency-free
 * and correct inside normal flow; give edge-hugging triggers a `placement`
 * that points inward so the bubble stays on-screen.
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 240,
  className = '',
}: {
  /** The hint shown in the bubble. Keep it short. */
  content: ReactNode
  /** The trigger the tooltip describes. */
  children: ReactNode
  placement?: TooltipPlacement
  /** Milliseconds to wait before opening on hover. Focus opens instantly. */
  delay?: number
  /** Extra classes for the inline wrapper span. */
  className?: string
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const id = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  // Hover waits out the delay; focus (keyboard) shows at once so tabbing is
  // never sluggish.
  const show = useCallback(
    (immediate: boolean) => {
      clear()
      if (immediate) return setOpen(true)
      timer.current = setTimeout(() => setOpen(true), delay)
    },
    [clear, delay],
  )
  const hide = useCallback(() => {
    clear()
    setOpen(false)
  }, [clear])

  useEffect(() => clear, [clear])

  // Escape dismisses the open bubble without moving focus, matching the rest
  // of the site's overlays.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  const geo = GEOMETRY[placement]

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onFocusCapture={() => show(true)}
      onBlurCapture={hide}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            id={id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, ...geo.offset }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, ...geo.offset }}
            transition={{ duration: reduce ? 0.12 : 0.24, ease: EASE }}
            className={`pointer-events-none absolute z-50 w-max max-w-[15rem] rounded-lg border border-white/10 bg-[#161616]/95 px-3 py-1.5 text-center text-xs font-medium leading-snug text-white/80 shadow-xl shadow-black/40 backdrop-blur-md ${geo.wrap}`}
          >
            {content}
            {/* Arrow: a rotated square nub tucked against the matching edge,
                filled to the bubble colour so it reads as one shape. */}
            <span
              aria-hidden
              className={`absolute h-2 w-2 rotate-45 bg-[#161616] ${geo.arrow}`}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
