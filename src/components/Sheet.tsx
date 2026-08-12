import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

// An iOS-style bottom sheet with detents — the native pattern behind Apple's
// UISheetPresentationController, rebuilt for the web. The sheet rests at one of
// several heights (its "detents"); you drag the grabber to move between them and
// it snaps to the nearest on release, throwing to the closest with a flick.
// Drag it below the smallest detent and it dismisses. A backdrop dims in step
// with how far the sheet is raised.
//
// Why a separate component from Modal: Modal is a single centred/bottom card
// that is either open or closed. This is a *resizable* surface — the height
// change, the detent snapping, and the drag-to-dismiss are the whole point, and
// they need their own motion model. It reinforces the native-iOS side of the
// work with a real product control, not an abstract demo.
//
// Honest to a11y: role="dialog" + aria-modal, a labelled grabber that also
// cycles detents from the keyboard, Escape to close, focus moved in on open and
// restored on close, a Tab trap, and body-scroll lock while open. Under reduced
// motion the drag comes off entirely — the detent segmented control and the
// grabber still move the sheet, but instantly, with no throw and no spring.

const SPRING = { type: 'spring', stiffness: 520, damping: 46, mass: 0.9 } as const
// How far past the smallest detent a release must land before it dismisses.
const DISMISS_SLOP = 0.11
// A flick's velocity is projected this many seconds ahead when picking a stop.
const THROW = 0.22

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rest heights as fractions of the viewport, given small to large.
   *  Defaults to a peek / half / full trio. Clamped to [0.15, 0.96]. */
  detents?: number[]
  /** Index into `detents` to open at. Defaults to the smallest. */
  initialDetent?: number
  /** Accessible title, shown in the header. */
  title?: string
  children?: ReactNode
}

export function Sheet({
  open,
  onOpenChange,
  detents = [0.4, 0.72, 0.94],
  initialDetent = 0,
  title,
  children,
}: SheetProps) {
  const reduce = useReducedMotion()
  const dragControls = useDragControls()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  // Detent fractions, sorted small -> large and clamped so the tallest never
  // quite fills the screen (a sliver of backdrop always reads as "a sheet").
  const stops = useMemo(() => {
    const cleaned = detents
      .map((d) => Math.min(0.96, Math.max(0.15, d)))
      .sort((a, b) => a - b)
    return cleaned.length ? cleaned : [0.4]
  }, [detents])
  const maxFrac = stops[stops.length - 1]

  // The viewport height in px, tracked so the sheet re-measures on resize /
  // orientation change. Zero until mounted, which keeps SSR/first paint safe.
  const [vh, setVh] = useState(0)
  useEffect(() => {
    const read = () => setVh(window.innerHeight)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  // The panel element is `maxFrac` of the viewport tall. Showing a shorter
  // detent means translating it *down* by the difference, so a detent's rest
  // offset is (maxFrac - fraction) * vh; fully closed is one whole panel down.
  const sheetH = maxFrac * vh
  const offsetFor = useCallback(
    (i: number) => (maxFrac - stops[i]) * vh,
    [maxFrac, stops, vh],
  )

  const [detent, setDetent] = useState(() =>
    Math.min(Math.max(0, initialDetent), stops.length - 1),
  )

  // The sheet stays in the tree only while open or animating closed, so it
  // costs nothing at rest.
  const [mounted, setMounted] = useState(false)

  // The sheet's vertical translate. Seeded off-screen the first time vh is read.
  const y = useMotionValue(0)
  const seeded = useRef(false)
  useEffect(() => {
    if (vh && !seeded.current) {
      y.set(sheetH)
      seeded.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vh])

  // Backdrop opacity tracks how raised the sheet is: full at the top, gone when
  // fully dismissed. `clamp` (default) keeps it in range during rubber-banding.
  const backdrop = useTransform(y, [0, sheetH || 1], [1, 0])

  // Open / close and detent changes resolve to a target offset here. Opening
  // mounts; a finished close unmounts.
  useEffect(() => {
    if (!vh) return
    if (open) {
      setMounted(true)
      if (reduce) y.set(offsetFor(detent))
      else animate(y, offsetFor(detent), SPRING)
    } else if (mounted) {
      if (reduce) {
        y.set(sheetH)
        setMounted(false)
      } else {
        animate(y, sheetH, { ...SPRING, onComplete: () => setMounted(false) })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detent, vh])

  // Body-scroll lock, Escape, focus move-in + restore, and a Tab trap — all
  // scoped to while the sheet is open.
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

  // On release: project the flick forward, then snap to the nearest detent — or
  // dismiss if it landed past the smallest one (or nearest the closed stop).
  function onDragEnd(_: unknown, info: { velocity: { y: number } }) {
    const projected = y.get() + info.velocity.y * THROW
    let bestI = 0
    let bestDist = Infinity
    stops.forEach((_s, i) => {
      const dist = Math.abs(projected - offsetFor(i))
      if (dist < bestDist) {
        bestDist = dist
        bestI = i
      }
    })
    const smallestOffset = offsetFor(0)
    const distClosed = Math.abs(projected - sheetH)
    if (projected > smallestOffset + DISMISS_SLOP * vh || distClosed < bestDist) {
      onOpenChange(false)
      return
    }
    // Snap here even when the detent index is unchanged (the effect won't refire).
    if (bestI === detent) animate(y, offsetFor(bestI), { ...SPRING, velocity: info.velocity.y })
    else setDetent(bestI)
  }

  // The grabber doubles as a keyboard control: click / Enter cycles up through
  // the detents and wraps back to the smallest, so it is reachable without drag.
  function cycleDetent() {
    setDetent((d) => (d + 1) % stops.length)
  }

  const startDrag = (e: ReactPointerEvent) => {
    if (reduce) return
    dragControls.start(e)
  }

  if (!mounted) return null

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px]"
      style={{ opacity: backdrop }}
      initial={false}
      onPointerDown={() => onOpenChange(false)}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Sheet'}
        tabIndex={-1}
        drag={reduce ? false : 'y'}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: sheetH }}
        dragElastic={{ top: 0.02, bottom: 0.14 }}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ y, height: sheetH || '90vh', touchAction: 'none' }}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-b-0 border-white/10 bg-[#101010] shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.8)] outline-none"
      >
        {/* Grab region — the only part that starts a drag, so content below can
            scroll on its own. Also a real button for keyboard users. */}
        <div
          onPointerDown={startDrag}
          className="shrink-0 cursor-grab pt-3 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <button
            type="button"
            onClick={cycleDetent}
            aria-label="Resize sheet"
            className="mx-auto flex h-6 w-full max-w-[8rem] items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          >
            <span className="h-1.5 w-11 rounded-full bg-white/25" />
          </button>
          <div className="flex items-center justify-between gap-4 px-6 pb-4 pt-2">
            {title ? (
              <h3 className="font-display text-lg font-semibold tracking-tight text-white">
                {title}
              </h3>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close sheet"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            >
              <span aria-hidden className="text-xl leading-none">
                &times;
              </span>
            </button>
          </div>
          {/* Detent segmented control — an explicit, always-there way to move
              between rest heights (and the whole path under reduced motion). */}
          {stops.length > 1 && (
            <div
              className="mx-6 mb-3 flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
              role="group"
              aria-label="Sheet height"
            >
              {stops.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDetent(i)}
                  aria-pressed={i === detent}
                  className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    i === detent
                      ? 'bg-[#DCF87C] text-black'
                      : 'text-white/55 hover:bg-white/[0.06] hover:text-white/85'
                  }`}
                >
                  {i === 0 ? 'Peek' : i === stops.length - 1 ? 'Full' : 'Half'}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Content scrolls independently of the drag handle. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-10"
          style={{ touchAction: 'pan-y' }}
        >
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}
