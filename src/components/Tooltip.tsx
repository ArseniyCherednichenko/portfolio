import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const EASE = [0.16, 1, 0.3, 1] as const

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

interface Coords {
  x: number
  y: number
  /** The placement actually used after any viewport flip. */
  place: TooltipPlacement
  /** Arrow offset (px) along the bubble's edge, toward the trigger's centre. */
  ax: number
  ay: number
}

// The direction the bubble drifts in from as it opens, per resolved placement —
// always away from the trigger, so it feels like it grows out of the control.
const ENTER: Record<TooltipPlacement, { x?: number; y?: number }> = {
  top: { y: 6 },
  bottom: { y: -6 },
  left: { x: 6 },
  right: { x: -6 },
}

/**
 * A small, accessible, spring-eased tooltip. Wrap any trigger — a button, a
 * link, a chip — and a labelled bubble rises on hover and on keyboard focus,
 * drifting in from the trigger's edge, then closes on leave, blur, or Escape.
 *
 * Unlike a naive wrapper-relative hint, the bubble is rendered through a
 * **portal** as `position: fixed` and positioned from the trigger's measured
 * rect, so it is never clipped by an `overflow-hidden` ancestor or trapped
 * under a lower stacking context. It also **flips to the opposite side** when
 * the preferred placement would run off the viewport and clamps itself inside
 * the edges, with the arrow tracking the trigger's centre — so an edge-hugging
 * control (a nav button, a corner chip) still gets a fully visible hint.
 *
 * Accessibility: the trigger carries `aria-describedby` pointing at the bubble
 * (`role="tooltip"`), so assistive tech announces the hint with the control.
 * A short open delay on hover keeps it from flickering as the cursor passes
 * through; focus opens it instantly and the close is immediate. Under reduced
 * motion it simply fades, with no travel.
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
  /** Preferred side; the bubble flips to the opposite side if it would clip. */
  placement?: TooltipPlacement
  /** Milliseconds to wait before opening on hover. Focus opens instantly. */
  delay?: number
  /** Extra classes for the inline wrapper span. */
  className?: string
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [mounted, setMounted] = useState(false)
  const id = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trigRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  // Portals need a client DOM; guard SSR / first paint.
  useEffect(() => setMounted(true), [])

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

  // Measure the trigger and the (already-mounted) bubble, choose a placement
  // that fits the viewport, and clamp the bubble inside the edges.
  const place = useCallback(() => {
    const trig = trigRef.current
    const bubble = bubbleRef.current
    if (!trig || !bubble) return
    const tr = trig.getBoundingClientRect()
    const w = bubble.offsetWidth
    const h = bubble.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const GAP = 8
    const M = 8 // keep this much clear of every viewport edge

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
    // never past the bubble's rounded corners.
    const ax = Math.max(10, Math.min(cx - x - 4, w - 18))
    const ay = Math.max(10, Math.min(cy - y - 4, h - 18))
    setCoords({ x, y, place: p, ax, ay })
  }, [placement])

  // Position on open (after the bubble is in the DOM so it can be measured),
  // and keep it pinned while scrolling / resizing.
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    place()
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, place])

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

  const resolved = coords?.place ?? placement
  const enter = ENTER[resolved]
  const arrowStyle: CSSProperties =
    resolved === 'top'
      ? { bottom: -4, left: coords?.ax ?? 0 }
      : resolved === 'bottom'
        ? { top: -4, left: coords?.ax ?? 0 }
        : resolved === 'left'
          ? { right: -4, top: coords?.ay ?? 0 }
          : { left: -4, top: coords?.ay ?? 0 }

  return (
    <span
      ref={trigRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onFocusCapture={() => show(true)}
      onBlurCapture={hide}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={bubbleRef}
                role="tooltip"
                id={id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.12 : 0.2, ease: EASE }}
                style={{
                  position: 'fixed',
                  left: coords?.x ?? 0,
                  top: coords?.y ?? 0,
                  zIndex: 120,
                  // Hidden until measured, so it never flashes at the corner.
                  visibility: coords ? 'visible' : 'hidden',
                }}
                className="pointer-events-none"
              >
                <motion.div
                  initial={reduce ? { opacity: 1 } : { scale: 0.94, ...enter }}
                  animate={{ scale: 1, x: 0, y: 0 }}
                  exit={reduce ? { opacity: 1 } : { scale: 0.96, ...enter }}
                  transition={{ duration: reduce ? 0.12 : 0.24, ease: EASE }}
                  className="relative w-max max-w-[15rem] rounded-lg border border-white/10 bg-[#161616]/95 px-3 py-1.5 text-center text-xs font-medium leading-snug text-white/80 shadow-xl shadow-black/40 backdrop-blur-md"
                >
                  {content}
                  {/* Arrow: a rotated square nub tucked against the near edge,
                      filled to the bubble colour so it reads as one shape. */}
                  <span
                    aria-hidden
                    style={arrowStyle}
                    className="absolute h-2 w-2 rotate-45 border border-white/10 bg-[#161616]"
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
