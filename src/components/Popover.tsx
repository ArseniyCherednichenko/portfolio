import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const EASE = [0.16, 1, 0.3, 1] as const

export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right'

interface Coords {
  x: number
  y: number
  /** The placement actually used after any viewport flip. */
  place: PopoverPlacement
  /** Arrow offset (px) along the panel's edge, toward the trigger's centre. */
  ax: number
  ay: number
}

// The direction the panel drifts in from as it opens, per resolved placement —
// always away from the trigger, so it feels like it grows out of the control.
const ENTER: Record<PopoverPlacement, { x?: number; y?: number }> = {
  top: { y: 8 },
  bottom: { y: -8 },
  left: { x: 8 },
  right: { x: -8 },
}

/**
 * A small, accessible, click-triggered popover. Wrap any trigger element and a
 * panel of *rich, interactive* content opens on click, anchored to the trigger.
 *
 * This is the Overlays family's click-popover — the counterpart to the hover
 * `Tooltip`. Where a tooltip is a passive, hover/focus **hint** with plain text,
 * a popover is a **click** affordance holding real controls (links, buttons, a
 * mini form) that the pointer can travel into and operate. It shares the
 * Tooltip's proven positioning: the panel is rendered through a **portal** as
 * `position: fixed`, measured from the trigger's rect, so it is never clipped by
 * an `overflow-hidden` ancestor or trapped under a lower stacking context — and
 * it **flips** to the opposite side and **clamps** inside the viewport when the
 * preferred placement would run off an edge, with the arrow tracking the
 * trigger's centre.
 *
 * Accessibility: the trigger carries `aria-haspopup="dialog"` and
 * `aria-expanded`; the panel is a `role="dialog"` labelled by `label`. On open
 * focus moves into the panel and, on close, **returns to the trigger**. It
 * closes on Escape, on an outside click, and whenever a child calls the `close`
 * passed to a render-function child. Under reduced motion it simply fades, no
 * travel.
 */
export function Popover({
  trigger,
  children,
  label = 'More',
  placement = 'bottom',
  className = '',
  panelClassName = '',
  offset = 10,
}: {
  /** The clickable trigger — a single focusable element (button/link). */
  trigger: ReactElement
  /** Panel content. A function receives a `close()` to dismiss from inside. */
  children: ReactNode | ((close: () => void) => ReactNode)
  /** Accessible name for the panel dialog. */
  label?: string
  /** Preferred side; the panel flips to the opposite side if it would clip. */
  placement?: PopoverPlacement
  /** Extra classes for the inline trigger wrapper. */
  className?: string
  /** Extra classes for the floating panel (padding, width, etc.). */
  panelClassName?: string
  /** Gap in px between the trigger and the panel. */
  offset?: number
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [mounted, setMounted] = useState(false)
  const id = useId()
  const trigRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Where focus was before we opened, so we can hand it back on close.
  const restoreRef = useRef<HTMLElement | null>(null)

  // Portals need a client DOM; guard SSR / first paint.
  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])

  // Measure the trigger and the (already-mounted) panel, choose a placement
  // that fits the viewport, and clamp the panel inside the edges.
  const place = useCallback(() => {
    const trig = trigRef.current
    const panel = panelRef.current
    if (!trig || !panel) return
    const tr = trig.getBoundingClientRect()
    const w = panel.offsetWidth
    const h = panel.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const GAP = offset
    const M = 10 // keep this much clear of every viewport edge

    let p = placement
    if (p === 'top' && tr.top - GAP - h < M) p = 'bottom'
    else if (p === 'bottom' && tr.bottom + GAP + h > vh - M) p = 'top'
    else if (p === 'left' && tr.left - GAP - w < M) p = 'right'
    else if (p === 'right' && tr.right + GAP + w > vw - M) p = 'left'

    const cx = tr.left + tr.width / 2
    const cy = tr.top + tr.height / 2
    let x = 0
    let y = 0
    if (p === 'top') {
      y = tr.top - GAP - h
      x = cx - w / 2
    } else if (p === 'bottom') {
      y = tr.bottom + GAP
      x = cx - w / 2
    } else if (p === 'left') {
      x = tr.left - GAP - w
      y = cy - h / 2
    } else {
      x = tr.right + GAP
      y = cy - h / 2
    }
    x = Math.max(M, Math.min(x, vw - M - w))
    y = Math.max(M, Math.min(y, vh - M - h))

    // Arrow tucks against the near edge, aimed at the trigger's centre, but
    // never past the panel's rounded corners.
    const ax = Math.max(14, Math.min(cx - x - 5, w - 24))
    const ay = Math.max(14, Math.min(cy - y - 5, h - 24))
    setCoords({ x, y, place: p, ax, ay })
  }, [placement, offset])

  // Position on open (after the panel is in the DOM so it can be measured),
  // move focus in, and keep it pinned while scrolling / resizing.
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    place()
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    // Focus the first focusable control in the panel, or the panel itself.
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(
      'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
    )
    ;(first ?? panel)?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, place])

  // Remember where focus was as we open; return it there on close.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      return
    }
    const back = restoreRef.current
    if (back && typeof back.focus === 'function') back.focus({ preventScroll: true })
  }, [open])

  // Escape closes; an outside pointerdown closes. Both ignore the trigger and
  // the panel themselves, so a click inside operates normally.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (trigRef.current?.contains(t) || panelRef.current?.contains(t)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, close])

  const resolved = coords?.place ?? placement
  const enter = ENTER[resolved]
  const arrowStyle: CSSProperties =
    resolved === 'top'
      ? { bottom: -5, left: coords?.ax ?? 0 }
      : resolved === 'bottom'
        ? { top: -5, left: coords?.ax ?? 0 }
        : resolved === 'left'
          ? { right: -5, top: coords?.ay ?? 0 }
          : { left: -5, top: coords?.ay ?? 0 }

  // Attach behaviour + ARIA to the caller's trigger without wrapping it in an
  // extra interactive element (so aria-expanded lands on the real control).
  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        onClick: (e: React.MouseEvent) => {
          ;(trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e)
          toggle()
        },
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
      })
    : trigger

  return (
    <span ref={trigRef} className={`relative inline-flex ${className}`}>
      {triggerEl}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.12 : 0.18, ease: EASE }}
                style={{
                  position: 'fixed',
                  left: coords?.x ?? 0,
                  top: coords?.y ?? 0,
                  zIndex: 120,
                  // Hidden until measured, so it never flashes at the corner.
                  visibility: coords ? 'visible' : 'hidden',
                }}
              >
                <motion.div
                  ref={panelRef}
                  role="dialog"
                  id={id}
                  aria-label={label}
                  tabIndex={-1}
                  initial={reduce ? { opacity: 1 } : { scale: 0.96, ...enter }}
                  animate={{ scale: 1, x: 0, y: 0 }}
                  exit={reduce ? { opacity: 1 } : { scale: 0.97, ...enter }}
                  transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}
                  className={`relative w-max rounded-2xl border border-white/10 bg-[#161616]/97 text-sm text-white/80 shadow-2xl shadow-black/50 outline-none backdrop-blur-md ${panelClassName}`}
                >
                  {typeof children === 'function' ? children(close) : children}
                  {/* Arrow: a rotated square nub tucked against the near edge,
                      filled to the panel colour so it reads as one shape. */}
                  <span
                    aria-hidden
                    style={arrowStyle}
                    className="absolute h-2.5 w-2.5 rotate-45 border border-white/10 bg-[#161616]"
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  )
}
