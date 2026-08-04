import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A list you can actually put in order — grab a row and drag it, and the others
// spring out of the way to make room, settling into the gap the moment you let
// go. Not a passive stack (CardStack) or a reveal (AnimatedList): here you drive
// the order by hand and the layout re-solves live under the pointer. Rows are
// laid out absolutely by index, so the whole reorder is one number — index ×
// ROW — and the dragged row simply tracks the pointer while every other row
// animates to its new slot. Honest to a11y: each row is a real reorder control
// with an aria-label and arrow-key travel, a polite live region announces the
// new position, and under reduced motion the rows jump rather than glide but the
// list reorders exactly the same by keyboard or by drag.

interface SortableProps {
  /** The rows, top to bottom. Order is local state you can rearrange. */
  items?: string[]
  className?: string
}

// A demo order — a way of working, not a claim. Rearrange it however you like.
const DEFAULT_ITEMS = ['Understand', 'Sketch', 'Prototype', 'Build', 'Refine', 'Ship']

// Row pitch in px: the visual row is shorter than this, and the difference is
// the gap between rows. One constant drives every position.
const ROW = 58
const CARD = 48

function reorder(list: string[], from: number, to: number) {
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function Sortable({ items = DEFAULT_ITEMS, className = '' }: SortableProps) {
  const reduce = useReducedMotion()
  const [order, setOrder] = useState(items)
  const [dragId, setDragId] = useState<string | null>(null)
  // Live y (px) of the dragged row while a pointer holds it. Absolute in the
  // list, so it stays under the finger no matter how the order re-solves.
  const [dragY, setDragY] = useState(0)
  const [announce, setAnnounce] = useState('')
  const uid = useId()

  // Grab bookkeeping — kept in a ref so pointermove reads live values without
  // forcing a render on every frame.
  const grab = useRef({ pointerStartY: 0, baseY: 0 })

  const spring = { type: 'spring' as const, stiffness: 520, damping: 40, mass: 0.6 }

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLLIElement>, row: string) => {
      if (reduce) return
      const index = order.indexOf(row)
      e.currentTarget.setPointerCapture(e.pointerId)
      grab.current = { pointerStartY: e.clientY, baseY: index * ROW }
      setDragY(index * ROW)
      setDragId(row)
    },
    [order, reduce],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLLIElement>, row: string) => {
      if (dragId !== row) return
      const y = grab.current.baseY + (e.clientY - grab.current.pointerStartY)
      setDragY(y)
      const current = order.indexOf(row)
      const target = clamp(Math.round(y / ROW), 0, order.length - 1)
      if (target !== current) setOrder((o) => reorder(o, current, target))
    },
    [dragId, order],
  )

  const endDrag = useCallback((e: React.PointerEvent<HTMLLIElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    setDragId(null)
  }, [])

  // Keyboard reorder: ArrowUp / ArrowDown move the focused row one slot and
  // announce where it landed. Home / End send it to the ends.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLLIElement>, row: string) => {
      const current = order.indexOf(row)
      let target = current
      if (e.key === 'ArrowUp') target = current - 1
      else if (e.key === 'ArrowDown') target = current + 1
      else if (e.key === 'Home') target = 0
      else if (e.key === 'End') target = order.length - 1
      else return
      e.preventDefault()
      target = clamp(target, 0, order.length - 1)
      if (target === current) return
      setOrder((o) => reorder(o, current, target))
      setAnnounce(`${row}, now position ${target + 1} of ${order.length}`)
    },
    [order],
  )

  return (
    <div className={`w-full max-w-sm ${className}`}>
      <ul
        className="relative mx-auto select-none"
        style={{ height: order.length * ROW - (ROW - CARD) }}
        aria-label="Sortable list. Focus a row and use the arrow keys to reorder it."
      >
        {order.map((row) => {
          const index = order.indexOf(row)
          const isDrag = dragId === row
          return (
            <motion.li
              key={row}
              role="button"
              tabIndex={0}
              aria-label={`${row}. Position ${index + 1} of ${order.length}. Use arrow keys to move.`}
              onPointerDown={(e) => onPointerDown(e, row)}
              onPointerMove={(e) => onPointerMove(e, row)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(e) => onKeyDown(e, row)}
              className={`absolute left-0 right-0 flex items-center gap-3 rounded-xl border px-4 outline-none transition-colors ${
                isDrag
                  ? 'z-20 cursor-grabbing border-[#DCF87C]/45 bg-[#141712] shadow-[0_22px_50px_-20px_rgba(0,0,0,0.85)]'
                  : 'z-10 cursor-grab border-white/10 bg-white/[0.03] hover:border-white/20'
              } focus-visible:border-[#DCF87C]/60 focus-visible:ring-1 focus-visible:ring-[#DCF87C]/40`}
              style={{ height: CARD, touchAction: 'none' }}
              animate={{
                y: isDrag ? dragY : index * ROW,
                scale: isDrag ? 1.03 : 1,
              }}
              transition={reduce || isDrag ? { duration: 0 } : spring}
            >
              {/* Grip — the affordance that says "pick me up" */}
              <span aria-hidden className="grid grid-cols-2 gap-x-[3px] gap-y-[3px]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-[3px] w-[3px] rounded-full ${
                      isDrag ? 'bg-[#DCF87C]/70' : 'bg-white/25'
                    }`}
                  />
                ))}
              </span>
              <span
                aria-hidden
                className={`w-5 text-right text-xs font-semibold tabular-nums ${
                  isDrag ? 'text-[#DCF87C]' : 'text-white/40'
                }`}
              >
                {index + 1}
              </span>
              <span className="font-display text-base font-medium text-white/90">{row}</span>
            </motion.li>
          )
        })}
      </ul>
      <p id={`${uid}-hint`} className="mt-4 text-center text-xs text-white/40">
        {reduce ? 'Focus a row and use the arrow keys to reorder.' : 'Drag a row, or focus one and use the arrow keys.'}
      </p>
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}
