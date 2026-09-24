import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

// SplitPane — a resizable split view with a draggable divider, the control the
// "hard native thing, rebuilt honestly" family was still missing. Every code
// editor, mail client, and file manager has one; HTML never shipped it. The
// divider is a real WAI-ARIA `role="separator"`: it carries aria-orientation
// and a live aria-valuenow (the first pane's percentage), so a screen reader
// hears "separator, 50 percent" and the whole thing is drivable by keyboard —
// arrow keys nudge it, Shift jumps in bigger steps, Home/End slam it to the
// limits, and Enter (or a double-click) snaps it back to its default. The drag
// is one number: the first pane's flex-basis as a percentage of the container,
// so there is nothing to measure per frame and the two panes can never disagree.
//
// Motion is honest and minimal: a drag is strictly 1:1 (no transition, or the
// divider would lag the finger), while a keyboard nudge or a reset eases the
// basis so the jump reads as a move rather than a teleport. Under
// prefers-reduced-motion even that easing is dropped — the layout still resizes,
// it just cuts rather than glides.

export type SplitOrientation = 'horizontal' | 'vertical'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function SplitPane({
  first,
  second,
  orientation = 'horizontal',
  defaultSplit = 50,
  min = 18,
  max = 82,
  step = 2,
  bigStep = 10,
  label = 'Resize the two panes',
  onSplitChange,
  className = '',
}: {
  /** Content of the first pane (left, or top when vertical). */
  first: ReactNode
  /** Content of the second pane (right, or bottom when vertical). */
  second: ReactNode
  orientation?: SplitOrientation
  /** First pane's starting size, as a percentage of the container. */
  defaultSplit?: number
  /** Smallest the first pane may shrink to, in percent. */
  min?: number
  /** Largest the first pane may grow to, in percent. */
  max?: number
  /** Arrow-key nudge, in percent. */
  step?: number
  /** Shift+arrow / PageUp-PageDown nudge, in percent. */
  bigStep?: number
  /** Accessible name for the divider. */
  label?: string
  /** Notified with the first pane's rounded percentage whenever it changes. */
  onSplitChange?: (percent: number) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const horizontal = orientation === 'horizontal'
  const containerRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const [split, setSplit] = useState(() => clamp(defaultSplit, min, max))
  const [dragging, setDragging] = useState(false)

  // The divider stays 1:1 with the pointer, so read the container's live size
  // each move and map the pointer's position along the split axis to a percent.
  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const raw = horizontal
        ? ((clientX - rect.left) / rect.width) * 100
        : ((clientY - rect.top) / rect.height) * 100
      setSplit(clamp(raw, min, max))
    },
    [horizontal, min, max],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      setDragging(true)
      applyFromPointer(e.clientX, e.clientY)
    },
    [applyFromPointer],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      applyFromPointer(e.clientX, e.clientY)
    },
    [dragging, applyFromPointer],
  )

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLDivElement
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    setDragging(false)
  }, [])

  // While a drag is live the whole page cursor should read as resize, even if
  // the pointer strays off the thin divider between frames.
  useEffect(() => {
    if (!dragging) return
    const prev = document.body.style.cursor
    document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prev
      document.body.style.userSelect = ''
    }
  }, [dragging, horizontal])

  const nudge = useCallback(
    (delta: number) => setSplit((s) => clamp(s + delta, min, max)),
    [min, max],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const dec = horizontal ? 'ArrowLeft' : 'ArrowUp'
      const inc = horizontal ? 'ArrowRight' : 'ArrowDown'
      switch (e.key) {
        case dec:
          e.preventDefault()
          nudge(-(e.shiftKey ? bigStep : step))
          break
        case inc:
          e.preventDefault()
          nudge(e.shiftKey ? bigStep : step)
          break
        case 'PageUp':
          e.preventDefault()
          nudge(-bigStep)
          break
        case 'PageDown':
          e.preventDefault()
          nudge(bigStep)
          break
        case 'Home':
          e.preventDefault()
          setSplit(min)
          break
        case 'End':
          e.preventDefault()
          setSplit(max)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          setSplit(clamp(defaultSplit, min, max))
          break
      }
    },
    [horizontal, nudge, step, bigStep, min, max, defaultSplit],
  )

  const rounded = Math.round(split)
  useEffect(() => {
    onSplitChange?.(rounded)
  }, [rounded, onSplitChange])
  // A drag must be instant; a keyboard nudge or reset eases, unless motion is off.
  const eased = !dragging && !reduce
  const basisTransition = eased ? 'flex-basis 220ms cubic-bezier(0.16,1,0.3,1)' : 'none'

  return (
    <div
      ref={containerRef}
      className={`flex ${horizontal ? 'flex-row' : 'flex-col'} overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] ${className}`}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flexBasis: `${split}%`, flexGrow: 0, flexShrink: 0, transition: basisTransition }}
      >
        {first}
      </div>

      <div
        role="separator"
        tabIndex={0}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={rounded}
        aria-valuetext={`First pane ${rounded}%`}
        aria-labelledby={labelId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setSplit(clamp(defaultSplit, min, max))}
        className={`group relative flex shrink-0 items-center justify-center outline-none transition-colors ${
          horizontal ? 'w-2.5 cursor-col-resize' : 'h-2.5 cursor-row-resize'
        } ${dragging ? 'bg-[#DCF87C]/20' : 'bg-white/[0.04] hover:bg-white/[0.08]'} focus-visible:bg-[#DCF87C]/15`}
      >
        <span id={labelId} className="sr-only">
          {label}
        </span>
        {/* The grabber: a short run of dots, lit and grown when active or focused. */}
        <span
          aria-hidden
          className={`pointer-events-none flex ${horizontal ? 'flex-col' : 'flex-row'} gap-1 rounded-full px-0.5 py-0.5 transition-colors ${
            dragging ? 'text-[#DCF87C]' : 'text-white/30 group-hover:text-white/60 group-focus-visible:text-[#DCF87C]'
          }`}
        >
          <span className="block h-1 w-1 rounded-full bg-current" />
          <span className="block h-1 w-1 rounded-full bg-current" />
          <span className="block h-1 w-1 rounded-full bg-current" />
        </span>
        {/* A hairline down the centre of the rail so the seam reads even at rest. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute ${
            horizontal ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
          } transition-colors ${dragging ? 'bg-[#DCF87C]/50' : 'bg-white/10 group-hover:bg-white/20'}`}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  )
}
