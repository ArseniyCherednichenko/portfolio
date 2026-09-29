import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A sheet of bubble wrap you can actually pop. No reason, no score, no reward —
// just the small, universal good feeling of a dome giving way under a fingertip.
// It is the odd one out even among the toys: not a simulation like the Ballpit
// or the Cloth, not a plotter like the Harmonograph, not a mechanism kept honest
// to its mechanics like the linkages. It is pure tactility, and the whole craft
// is in the feel of the single pop.
//
// The single source of truth is one boolean per cell: popped or not. Everything
// else is derived — the count, the progress bar, the "whole sheet" line all read
// off that one array, so they can never disagree with what is on screen.
//
// Popping is geometry, not per-bubble handlers: the grid captures the pointer on
// press and, on every move, maps the pointer straight to a row and column from
// the container rect. That is what makes a *drag* pop a whole swath cleanly, on
// touch as much as with a mouse, without the pointer-capture tearing off as the
// finger crosses from one bubble to the next. The keyboard gets the same sheet
// as a real role="grid": one tab stop, the arrows walking a roving focus, and
// Enter or Space popping the bubble under it.
//
// Reduced motion keeps every pop — it is direct manipulation, not decoration —
// but drops the springy collapse and the expanding ring for an instant, quiet
// state change.

const ROWS = 8
const MIN_COLS = 6
const MAX_COLS = 14
const CELL_PX = 46 // target bubble size; columns are fit to the width

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

export function BubbleWrap({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const pressing = useRef(false)

  const [cols, setCols] = useState(MAX_COLS)
  const [popped, setPopped] = useState<boolean[]>(() => Array(ROWS * MAX_COLS).fill(false))
  const [focus, setFocus] = useState(0)
  const [announce, setAnnounce] = useState('')

  const total = ROWS * cols
  const count = popped.reduce((n, p) => (p ? n + 1 : n), 0)
  const done = count === total && total > 0

  // Fit the column count to the available width. A change of column count is a
  // change of sheet, so it starts fresh — resizing is rare, and a clean sheet is
  // the honest outcome rather than a half-popped grid reflowed into nonsense.
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const next = clamp(Math.round(w / CELL_PX), MIN_COLS, MAX_COLS)
      setCols((prev) => {
        if (prev === next) return prev
        setPopped(Array(ROWS * next).fill(false))
        setFocus((f) => Math.min(f, ROWS * next - 1))
        return next
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const popAt = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= ROWS * cols) return
      setPopped((prev) => {
        if (prev[idx]) return prev
        const next = prev.slice()
        next[idx] = true
        return next
      })
    },
    [cols],
  )

  const popAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = gridRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cw = r.width / cols
      const ch = r.height / ROWS
      const c = Math.floor((clientX - r.left) / cw)
      const row = Math.floor((clientY - r.top) / ch)
      if (c < 0 || c >= cols || row < 0 || row >= ROWS) return
      const idx = row * cols + c
      popAt(idx)
      setFocus(idx)
    },
    [cols, popAt],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return
      pressing.current = true
      gridRef.current?.setPointerCapture?.(e.pointerId)
      popAtPoint(e.clientX, e.clientY)
    },
    [popAtPoint],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pressing.current) return
      popAtPoint(e.clientX, e.clientY)
    },
    [popAtPoint],
  )

  const endPress = useCallback((e: React.PointerEvent) => {
    pressing.current = false
    if (gridRef.current?.hasPointerCapture?.(e.pointerId)) {
      gridRef.current.releasePointerCapture(e.pointerId)
    }
  }, [])

  // Roving-focus keyboard model over the sheet.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const row = Math.floor(focus / cols)
      const col = focus % cols
      let next = focus
      switch (e.key) {
        case 'ArrowRight':
          next = row * cols + Math.min(col + 1, cols - 1)
          break
        case 'ArrowLeft':
          next = row * cols + Math.max(col - 1, 0)
          break
        case 'ArrowDown':
          next = Math.min(row + 1, ROWS - 1) * cols + col
          break
        case 'ArrowUp':
          next = Math.max(row - 1, 0) * cols + col
          break
        case 'Home':
          next = e.ctrlKey ? 0 : row * cols
          break
        case 'End':
          next = e.ctrlKey ? total - 1 : row * cols + (cols - 1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          popAt(focus)
          return
        default:
          return
      }
      e.preventDefault()
      if (next !== focus) setFocus(next)
    },
    [focus, cols, total, popAt],
  )

  // Keep DOM focus on the roving cell while the sheet is being driven by keys.
  useEffect(() => {
    const el = cellRefs.current[focus]
    if (el && gridRef.current?.contains(document.activeElement) && document.activeElement !== el) {
      el.focus()
    }
  }, [focus])

  const popAll = useCallback(() => {
    setPopped(Array(total).fill(true))
    setAnnounce('Whole sheet popped.')
  }, [total])

  const reset = useCallback(() => {
    setPopped(Array(total).fill(false))
    setAnnounce('A fresh sheet.')
  }, [total])

  useEffect(() => {
    if (done) setAnnounce('That is the whole sheet — every bubble popped.')
  }, [done])

  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div className={className}>
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/30 p-5 sm:p-7">
        <div
          ref={gridRef}
          role="grid"
          aria-label="Bubble wrap — press or drag to pop"
          aria-rowcount={ROWS}
          aria-colcount={cols}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onKeyDown={onKeyDown}
          className="grid select-none"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, touchAction: 'none' }}
        >
          {popped.map((isPopped, idx) => {
            const row = Math.floor(idx / cols)
            const col = idx % cols
            return (
              <button
                key={idx}
                ref={(el) => {
                  cellRefs.current[idx] = el
                }}
                type="button"
                role="gridcell"
                aria-label={`Row ${row + 1}, column ${col + 1}, ${isPopped ? 'popped' : 'unpopped'}`}
                aria-pressed={isPopped}
                tabIndex={idx === focus ? 0 : -1}
                className="relative aspect-square rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-0"
              >
                <motion.span
                  aria-hidden
                  className="absolute inset-[12%] rounded-full border"
                  animate={
                    isPopped
                      ? { scale: 0.8, borderColor: 'rgba(255,255,255,0.05)' }
                      : { scale: 1, borderColor: 'rgba(255,255,255,0.14)' }
                  }
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 26 }}
                  style={{
                    background: isPopped
                      ? 'radial-gradient(circle at 50% 62%, rgba(0,0,0,0.42), rgba(255,255,255,0.02) 72%)'
                      : 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92), rgba(220,248,124,0.12) 44%, rgba(255,255,255,0.03) 74%)',
                    boxShadow: isPopped
                      ? 'inset 0 2px 5px rgba(0,0,0,0.5)'
                      : 'inset 0 1px 1px rgba(255,255,255,0.5), 0 2px 5px rgba(0,0,0,0.35)',
                  }}
                />
                {isPopped && !reduce && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-[12%] rounded-full"
                    initial={{ scale: 0.5, opacity: 0.55 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 0.42, ease: 'easeOut' }}
                    style={{ border: '1px solid rgba(220,248,124,0.6)' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Progress + count, both derived from the one array. */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-[9rem] flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-[#DCF87C]"
                animate={{ width: `${pct}%` }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 26 }}
              />
            </div>
            <p className="mt-2 text-sm text-white/55">
              <span className="font-semibold text-white/85">{count}</span> / {total} popped
              {done && <span className="text-[#DCF87C]"> — that is the whole sheet.</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={popAll}
              disabled={done}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Pop all
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={count === 0}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Fresh sheet
            </button>
          </div>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  )
}

export default BubbleWrap
