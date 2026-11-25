import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const EASE = [0.16, 1, 0.3, 1] as const

/** What an action is handed when it runs: the plain selected text and the live
 * Range it came from (cloned, so it stays valid after the selection collapses). */
export interface SelectionContext {
  text: string
  range: Range
}

export interface SelectionAction {
  /** Stable id, also used as the React key. */
  id: string
  /** Accessible label for the button (and its default visible content). */
  label: string
  /** Optional custom button content; defaults to the label. */
  render?: () => ReactNode
  /** Do the thing. Receives the selected text and a cloned Range. */
  run: (ctx: SelectionContext) => void
  /** Keep the selection (and the bar) after running. Defaults to false, which
   * collapses the selection so the bar gets out of the way. */
  keepSelection?: boolean
}

export interface SelectionToolbarProps {
  /** The content whose selections raise the bar. */
  children: ReactNode
  /** The buttons the bar offers for a selection. */
  actions: SelectionAction[]
  /** Accessible name for the floating toolbar. */
  label?: string
  /** Extra classes for the wrapping element. */
  className?: string
  /** Minimum selected-character count before the bar shows. Default 1. */
  minLength?: number
}

interface Coords {
  x: number
  y: number
  place: 'top' | 'bottom'
}

const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(v, hi))

/**
 * SelectionToolbar — a floating bubble menu anchored to a live text selection.
 *
 * This is the Overlays family's missing member. The `Popover` anchors a panel to
 * a **trigger element** and the `ContextMenu` opens one at the **pointer**; this
 * one has no trigger at all — it watches for a text selection inside its content
 * and floats a small bar of actions above it, the way a reader (Medium) or an
 * editor (Notion, Linear, Google Docs) raises a format bar over whatever you just
 * highlighted. It shares the family's proven positioning: the bar is rendered
 * through a **portal** as `position: fixed`, measured from the selection's own
 * bounding rect, so no `overflow-hidden` ancestor clips it; it sits above the
 * selection and **flips below** when there is no room, then **clamps** inside the
 * viewport, and it re-measures the live Range on scroll and resize so it rides
 * the text rather than drifting off it.
 *
 * The one detail a lazy version gets wrong is losing the selection the instant
 * you reach for the bar — a `mousedown` on a button moves focus and the browser
 * drops the highlight before the click lands. So every button cancels its own
 * `mousedown`, keeping the selection intact until the action fires. Actions are
 * handed the plain text and a cloned Range (valid even after the selection
 * collapses). Escape dismisses the bar and clears the selection; the actions are
 * real `<button>`s in a `role="toolbar"`, and a polite live region names what the
 * last one did. Under reduced motion the bar appears without the pop or travel.
 */
export function SelectionToolbar({
  children,
  actions,
  label = 'Selection actions',
  className = '',
  minLength = 1,
}: SelectionToolbarProps) {
  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<Range | null>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [mounted, setMounted] = useState(false)
  const [announce, setAnnounce] = useState('')
  const id = useId()

  // Portals need a client DOM; guard the first paint.
  useEffect(() => setMounted(true), [])

  const clear = useCallback(() => {
    rangeRef.current = null
    setVisible(false)
    setCoords(null)
  }, [])

  // Measure the live Range and the (mounted) bar, place the bar above the
  // selection, flip below when the top would clip, and clamp to the viewport.
  const place = useCallback(() => {
    const bar = barRef.current
    const range = rangeRef.current
    if (!bar || !range) return
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      clear()
      return
    }
    const w = bar.offsetWidth
    const h = bar.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const GAP = 10
    const M = 8
    let p: 'top' | 'bottom' = 'top'
    if (rect.top - GAP - h < M) p = 'bottom'
    const cx = rect.left + rect.width / 2
    const x = clamp(M, cx - w / 2, vw - M - w)
    const y =
      p === 'top'
        ? clamp(M, rect.top - GAP - h, vh - M - h)
        : clamp(M, rect.bottom + GAP, vh - M - h)
    setCoords({ x, y, place: p })
  }, [clear])

  // Read the current selection; show the bar only for a non-collapsed selection
  // that lives wholly inside this container and clears the length floor.
  const read = useCallback(() => {
    const container = containerRef.current
    const sel = window.getSelection()
    if (!container || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
      clear()
      return
    }
    const { anchorNode, focusNode } = sel
    if (!anchorNode || !focusNode || !container.contains(anchorNode) || !container.contains(focusNode)) {
      clear()
      return
    }
    const text = sel.toString().trim()
    if (text.length < minLength) {
      clear()
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      clear()
      return
    }
    rangeRef.current = range.cloneRange()
    setVisible(true)
  }, [clear, minLength])

  // The selection changes constantly during a drag, so coalesce reads into one
  // per frame. A pointerdown on the bar cancels its own default (below), so it
  // never collapses the selection and never fires this toward a hide.
  useEffect(() => {
    let raf = 0
    const onChange = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(read)
    }
    document.addEventListener('selectionchange', onChange)
    return () => {
      document.removeEventListener('selectionchange', onChange)
      cancelAnimationFrame(raf)
    }
  }, [read])

  // Place on show, then keep the bar riding the live Range while the page moves.
  useLayoutEffect(() => {
    if (!visible) {
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
  }, [visible, place])

  // Escape dismisses the bar and lets go of the selection.
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        window.getSelection()?.removeAllRanges()
        clear()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, clear])

  const fire = useCallback(
    (action: SelectionAction) => {
      const range = rangeRef.current
      if (!range) return
      action.run({ text: range.toString(), range })
      setAnnounce(`${action.label} applied to selection`)
      if (!action.keepSelection) {
        window.getSelection()?.removeAllRanges()
        clear()
      } else {
        // The content may have reflowed (e.g. a mark drawn under it); re-seat.
        requestAnimationFrame(place)
      }
    },
    [clear, place],
  )

  return (
    <div ref={containerRef} className={className}>
      {children}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {visible && (
              <motion.div
                ref={barRef}
                role="toolbar"
                aria-label={label}
                aria-controls={id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: coords?.place === 'bottom' ? -6 : 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: coords?.place === 'bottom' ? -4 : 4 }}
                transition={{ duration: reduce ? 0.12 : 0.18, ease: EASE }}
                style={{
                  position: 'fixed',
                  left: coords?.x ?? 0,
                  top: coords?.y ?? 0,
                  zIndex: 130,
                  visibility: coords ? 'visible' : 'hidden',
                }}
                className="flex items-center gap-0.5 rounded-xl border border-white/12 bg-[#141414]/97 p-1 shadow-2xl shadow-black/60 backdrop-blur-md"
              >
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    // The crucial detail: cancel mousedown so the selection
                    // survives the press and the action has something to act on.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => fire(action)}
                    aria-label={action.label}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                  >
                    {action.render ? action.render() : action.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}

export default SelectionToolbar
