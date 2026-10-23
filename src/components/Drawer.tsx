import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

// A Drawer — the edge-anchored side panel every product reaches for: the
// settings panel, the filter tray, the shopping cart, the details pane that
// slides in from the rim and leaves the page behind it in place. It is the
// Overlays family's third surface, and deliberately its own component beside
// the two it sits between:
//
//   • Modal is a centred card — it has no edge and no travel, it just appears.
//   • Sheet rises from the bottom and is *resizable* — detents, snapping, a
//     height you drag between. The size change is its whole point.
//   • MobileMenu is a full-screen nav takeover tied to one job.
//
// A Drawer is none of those: a fixed-width column pinned to the left or right
// edge, full height, a single open/closed state, that slides in along one axis
// and is pulled back out the same way. The motion model is a horizontal twin of
// the Sheet's — one motion value the drag writes directly, a backdrop that dims
// in step with how far in the panel is, and a flick that throws it open or shut
// against the way it was barely moving — but it never resizes.
//
// Honest to a11y: role="dialog" + aria-modal, a labelled title, Escape to
// close, focus moved onto the panel on open and restored to the opener on
// close, a Tab trap, and body-scroll lock while open. Under reduced motion the
// drag comes off entirely and the panel cuts in and out with no slide, no
// spring, no backdrop fade — the same control, no movement.

const SPRING = { type: 'spring', stiffness: 520, damping: 46, mass: 0.9 } as const
// A flick's velocity is projected this many seconds ahead when picking a stop.
const THROW = 0.22
// Past this fraction of the panel's width (toward the edge) a release dismisses.
const DISMISS_FRAC = 0.4

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which edge the drawer is pinned to. Defaults to the right. */
  side?: 'left' | 'right'
  /** Panel width in px. Clamped so it never exceeds the viewport on a phone. */
  width?: number
  /** Accessible title, shown in the header. */
  title?: string
  /** An optional line under the title. */
  description?: string
  children?: ReactNode
}

export function Drawer({
  open,
  onOpenChange,
  side = 'right',
  width = 380,
  title,
  description,
  children,
}: DrawerProps) {
  const reduce = useReducedMotion()
  const dragControls = useDragControls()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  // The viewport width in px, tracked so the panel re-measures on resize and
  // never grows wider than the screen (leaving a sliver of backdrop to tap).
  const [vw, setVw] = useState(0)
  useEffect(() => {
    const read = () => setVw(window.innerWidth)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  const panelW = vw ? Math.min(width, vw - 40) : width
  // Closed means the panel is shifted one whole width off its edge: positive
  // (rightward) for a right-hand drawer, negative for a left-hand one.
  const closedX = side === 'right' ? panelW : -panelW

  // The sheet stays in the tree only while open or animating closed, so it
  // costs nothing at rest.
  const [mounted, setMounted] = useState(false)

  // The panel's horizontal translate. Seeded off-screen the first time vw reads.
  const x = useMotionValue(0)
  const seeded = useRef(false)
  useEffect(() => {
    if (vw && !seeded.current) {
      x.set(closedX)
      seeded.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vw])

  // Backdrop opacity tracks how far in the panel is: full when open (x at 0),
  // gone when fully off-edge. `clamp` (default) holds it in range mid-drag.
  const backdrop = useTransform(x, [0, closedX || 1], [1, 0])

  // Open / close resolves to a target translate here. Opening mounts; a
  // finished close unmounts.
  useEffect(() => {
    if (!vw) return
    if (open) {
      setMounted(true)
      if (reduce) x.set(0)
      else animate(x, 0, SPRING)
    } else if (mounted) {
      if (reduce) {
        x.set(closedX)
        setMounted(false)
      } else {
        animate(x, closedX, { ...SPRING, onComplete: () => setMounted(false) })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vw])

  // Body-scroll lock, Escape, focus move-in + restore, and a Tab trap — all
  // scoped to while the drawer is open.
  useEffect(() => {
    if (!open) return
    restoreFocus.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => panelRef.current?.focus())

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onOpenChange(false)
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey && (activeEl === first || activeEl === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      restoreFocus.current?.focus?.()
    }
  }, [open, onOpenChange])

  // On release: project the flick forward along x, then either dismiss (it
  // landed far enough toward the edge, or was flicked that way) or spring home.
  function onDragEnd(_: unknown, info: { velocity: { x: number } }) {
    const projected = x.get() + info.velocity.x * THROW
    const towardEdge =
      side === 'right' ? projected > panelW * DISMISS_FRAC : projected < -panelW * DISMISS_FRAC
    if (towardEdge) {
      onOpenChange(false)
      return
    }
    // Snap back open (the effect won't refire while `open` is unchanged).
    animate(x, 0, { ...SPRING, velocity: info.velocity.x })
  }

  const startDrag = (e: ReactPointerEvent) => {
    if (reduce) return
    dragControls.start(e)
  }

  if (!mounted) return null

  const edgeClass = side === 'right' ? 'right-0 border-l' : 'left-0 border-r'
  const radiusClass = side === 'right' ? 'rounded-l-[1.5rem]' : 'rounded-r-[1.5rem]'
  // Rubber-band only on the side that would pull the panel *further open* than
  // flush; the dismissing direction drags one-to-one with the finger.
  const dragConstraints =
    side === 'right' ? { left: 0, right: closedX } : { left: closedX, right: 0 }
  const dragElastic = side === 'right' ? { left: 0.04, right: 0.02 } : { left: 0.02, right: 0.04 }

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px]"
      style={{ opacity: reduce ? 1 : backdrop }}
      initial={false}
      onPointerDown={() => onOpenChange(false)}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Drawer'}
        tabIndex={-1}
        drag={reduce ? false : 'x'}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={dragConstraints}
        dragElastic={dragElastic}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ x, width: panelW, touchAction: 'none' }}
        className={`absolute inset-y-0 ${edgeClass} ${radiusClass} flex max-w-full flex-col overflow-hidden border-white/10 bg-[#101010] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] outline-none`}
      >
        {/* Header doubles as the drag region, so content below can scroll on its
            own. A thin grip bar hints the pull. */}
        <div
          onPointerDown={startDrag}
          className="shrink-0 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              {title && (
                <h3 className="font-display text-lg font-semibold tracking-tight text-white">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-sm leading-relaxed text-white/45">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close drawer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            >
              <span aria-hidden className="text-xl leading-none">
                &times;
              </span>
            </button>
          </div>
          <div className="mx-6 h-px bg-white/10" />
        </div>
        {/* Content scrolls independently of the drag handle. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-5"
          style={{ touchAction: 'pan-y' }}
        >
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}
