import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A board you move work across — cards dragged from one column into another,
// the columns re-solving live underneath. The companion to Sortable: that one
// reorders a single list, this one carries a card *between* lists, which is a
// different problem (a target column and a target slot, not one index). The
// dragged card is lifted out of the columns entirely into a single floating
// clone that tracks the pointer, and a dashed placeholder shows the exact slot
// it will drop into; the columns themselves never reparent the moving node, so
// pointer capture (held on the board, not the card) stays unbroken across a
// column hop. Honest to a11y: every card is a real control with a full arrow-key
// travel (up/down within a column, left/right across columns) and a polite live
// region that reads where it landed, so it moves exactly the same by keyboard as
// by hand. Under reduced motion the drag is off and the springs snap, but the
// keyboard board is fully usable.

interface Card {
  id: string
  text: string
}

interface Column {
  id: string
  title: string
  cards: Card[]
}

interface KanbanBoardProps {
  columns?: Column[]
  className?: string
}

// A demo board — a way of working, not a task list. There are no real tickets,
// clients, or dates here; it is the shape of how a small thing gets made, laid
// out so it can be rearranged. Move the cards however you like.
const DEFAULT_COLUMNS: Column[] = [
  {
    id: 'ideas',
    title: 'Ideas',
    cards: [
      { id: 'k1', text: 'Sketch the idea' },
      { id: 'k2', text: 'Name the feeling' },
      { id: 'k3', text: 'Find the one detail' },
    ],
  },
  {
    id: 'making',
    title: 'Making',
    cards: [
      { id: 'k4', text: 'Build the smallest version' },
      { id: 'k5', text: 'Make it move' },
    ],
  },
  {
    id: 'shipped',
    title: 'Shipped',
    cards: [
      { id: 'k6', text: 'Cut what is not needed' },
      { id: 'k7', text: 'Ship it' },
    ],
  },
]

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// Deep-ish clone that is enough for our moves (arrays are rebuilt, cards shared).
function cloneCols(cols: Column[]): Column[] {
  return cols.map((c) => ({ ...c, cards: c.cards.slice() }))
}

// Move a card from (fromCol, fromIdx) to (toCol, toIdx) and return new columns.
function moveCard(
  cols: Column[],
  fromCol: number,
  fromIdx: number,
  toCol: number,
  toIdx: number,
): Column[] {
  const next = cloneCols(cols)
  const [moved] = next[fromCol].cards.splice(fromIdx, 1)
  if (!moved) return cols
  const index = clamp(toIdx, 0, next[toCol].cards.length)
  next[toCol].cards.splice(index, 0, moved)
  return next
}

export function KanbanBoard({ columns = DEFAULT_COLUMNS, className = '' }: KanbanBoardProps) {
  const reduce = useReducedMotion()
  const [cols, setCols] = useState<Column[]>(columns)

  // The card currently lifted out of the columns, plus its captured size, or
  // null when nothing is being dragged.
  const [drag, setDrag] = useState<{ card: Card; from: string; w: number; h: number } | null>(null)
  // Where the lifted card would drop: a column id and an insertion index.
  const [place, setPlace] = useState<{ col: string; index: number } | null>(null)
  // Top-left of the floating clone in viewport px while a pointer holds it.
  const [clone, setClone] = useState({ x: 0, y: 0 })
  const [announce, setAnnounce] = useState('')

  const uid = useId()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const colRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const cardEls = useRef<Map<string, HTMLElement>>(new Map())
  const grab = useRef({ dx: 0, dy: 0 })
  // A card id to move keyboard focus onto after the next columns render.
  const pendingFocus = useRef<string | null>(null)

  const spring = { type: 'spring' as const, stiffness: 560, damping: 42, mass: 0.6 }

  const setColRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) colRefs.current.set(id, el)
      else colRefs.current.delete(id)
    },
    [],
  )

  const setCardRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) cardEls.current.set(id, el)
      else cardEls.current.delete(id)
    },
    [],
  )

  // After a keyboard move re-renders the columns, return focus to the card that
  // moved so a run of arrow presses keeps driving the same card.
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    cardEls.current.get(id)?.focus()
  }, [cols])

  // Given a viewport point, decide which column it is over and which slot in
  // that column it would drop into. Columns are few and their card rows are
  // read fresh from the DOM, so the target tracks the live layout as it
  // re-solves under the pointer.
  const computeTarget = useCallback(
    (x: number, y: number): { col: string; index: number } | null => {
      const entries = Array.from(colRefs.current.entries())
      if (!entries.length) return null
      let hitId: string | null = null
      let nearestId = entries[0][0]
      let nearestDist = Infinity
      for (const [id, el] of entries) {
        const r = el.getBoundingClientRect()
        if (x >= r.left && x <= r.right) hitId = id
        const cx = r.left + r.width / 2
        const dist = Math.abs(x - cx)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestId = id
        }
      }
      const colId = hitId ?? nearestId
      const colEl = colRefs.current.get(colId)
      if (!colEl) return null
      const nodes = colEl.querySelectorAll<HTMLElement>('[data-card]')
      let index = 0
      nodes.forEach((n) => {
        const r = n.getBoundingClientRect()
        if (y > r.top + r.height / 2) index += 1
      })
      return { col: colId, index }
    },
    [],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, card: Card, colId: string) => {
      if (reduce) return
      const rect = e.currentTarget.getBoundingClientRect()
      const board = boardRef.current
      if (!board) return
      grab.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
      try {
        board.setPointerCapture(e.pointerId)
      } catch {
        /* capture is best-effort */
      }
      const colIndex = cols.findIndex((c) => c.id === colId)
      const cardIndex = colIndex >= 0 ? cols[colIndex].cards.findIndex((c) => c.id === card.id) : -1
      // Lift the card out of the columns; a floating clone now represents it.
      setCols((cs) => cs.map((c) => (c.id === colId ? { ...c, cards: c.cards.filter((k) => k.id !== card.id) } : c)))
      setDrag({ card, from: colId, w: rect.width, h: rect.height })
      setPlace({ col: colId, index: Math.max(0, cardIndex) })
      setClone({ x: rect.left, y: rect.top })
    },
    [cols, reduce],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag) return
      setClone({ x: e.clientX - grab.current.dx, y: e.clientY - grab.current.dy })
      const target = computeTarget(e.clientX, e.clientY)
      if (target) setPlace(target)
    },
    [drag, computeTarget],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag) return
      if (boardRef.current?.hasPointerCapture(e.pointerId)) {
        try {
          boardRef.current.releasePointerCapture(e.pointerId)
        } catch {
          /* no-op */
        }
      }
      const target = place
      const card = drag.card
      setCols((cs) => {
        if (!target) {
          // Nowhere to drop — return the card to the column it left.
          return cs.map((c) => (c.id === drag.from ? { ...c, cards: [...c.cards, card] } : c))
        }
        return cs.map((c) =>
          c.id === target.col
            ? { ...c, cards: [...c.cards.slice(0, target.index), card, ...c.cards.slice(target.index)] }
            : c,
        )
      })
      setDrag(null)
      setPlace(null)
    },
    [drag, place],
  )

  // Keyboard travel: move the focused card without a pointer. Up/Down walk it
  // inside its column, Left/Right carry it to the neighbouring column at the
  // same-ish slot, Home/End send it to the ends of its column.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, card: Card, colId: string) => {
      const fromCol = cols.findIndex((c) => c.id === colId)
      if (fromCol < 0) return
      const fromIdx = cols[fromCol].cards.findIndex((c) => c.id === card.id)
      if (fromIdx < 0) return
      let toCol = fromCol
      let toIdx = fromIdx
      if (e.key === 'ArrowUp') toIdx = fromIdx - 1
      else if (e.key === 'ArrowDown') toIdx = fromIdx + 1
      else if (e.key === 'Home') toIdx = 0
      else if (e.key === 'End') toIdx = cols[fromCol].cards.length - 1
      else if (e.key === 'ArrowLeft') toCol = fromCol - 1
      else if (e.key === 'ArrowRight') toCol = fromCol + 1
      else return
      e.preventDefault()
      if (toCol < 0 || toCol >= cols.length) return
      if (toCol === fromCol) {
        toIdx = clamp(toIdx, 0, cols[fromCol].cards.length - 1)
        if (toIdx === fromIdx) return
      } else {
        // Landing in a new column: keep the row height, clamped to its length.
        toIdx = clamp(fromIdx, 0, cols[toCol].cards.length)
      }
      pendingFocus.current = card.id
      setCols((cs) => moveCard(cs, fromCol, fromIdx, toCol, toIdx))
      const dest = cols[toCol]
      setAnnounce(
        `${card.text}, moved to ${dest.title}, position ${
          (toCol === fromCol ? toIdx : clamp(fromIdx, 0, dest.cards.length)) + 1
        }`,
      )
    },
    [cols],
  )

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={boardRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible"
        aria-label="Kanban board. Focus a card and use the arrow keys to move it between columns."
      >
        {cols.map((col) => {
          const isPlaceCol = drag != null && place?.col === col.id
          const count = col.cards.length + (isPlaceCol ? 1 : 0)
          return (
            <div
              key={col.id}
              ref={setColRef(col.id)}
              className="flex w-[220px] shrink-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:w-auto"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                  {col.title}
                </span>
                <span
                  aria-hidden
                  className="grid h-5 min-w-5 place-items-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-semibold tabular-nums text-white/50"
                >
                  {count}
                </span>
              </div>
              <div className="flex min-h-[64px] flex-1 flex-col gap-2">
                {col.cards.map((card, i) => (
                  <Fragment key={card.id}>
                    {isPlaceCol && place?.index === i && (
                      <div
                        aria-hidden
                        className="rounded-xl border border-dashed border-[#DCF87C]/45 bg-[#DCF87C]/[0.05]"
                        style={{ height: drag?.h ?? 44 }}
                      />
                    )}
                    <motion.div
                      layout={!reduce}
                      transition={reduce ? { duration: 0 } : spring}
                      ref={setCardRef(card.id)}
                      data-card
                      role="button"
                      tabIndex={0}
                      aria-label={`${card.text}. In ${col.title}, position ${i + 1} of ${col.cards.length}. Use arrow keys to move; left and right change column.`}
                      onPointerDown={(e) => onPointerDown(e, card, col.id)}
                      onKeyDown={(e) => onKeyDown(e, card, col.id)}
                      style={{ touchAction: 'none' }}
                      className="flex cursor-grab items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 outline-none transition-colors hover:border-white/20 focus-visible:border-[#DCF87C]/60 focus-visible:ring-1 focus-visible:ring-[#DCF87C]/40 active:cursor-grabbing"
                    >
                      <span aria-hidden className="grid grid-cols-2 gap-x-[3px] gap-y-[3px]">
                        {Array.from({ length: 6 }).map((_, g) => (
                          <span key={g} className="h-[3px] w-[3px] rounded-full bg-white/25" />
                        ))}
                      </span>
                      <span className="text-sm font-medium leading-snug text-white/85">{card.text}</span>
                    </motion.div>
                  </Fragment>
                ))}
                {isPlaceCol && place?.index === col.cards.length && (
                  <div
                    aria-hidden
                    className="rounded-xl border border-dashed border-[#DCF87C]/45 bg-[#DCF87C]/[0.05]"
                    style={{ height: drag?.h ?? 44 }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* The floating clone — a single node at board level, so a column hop
          never reparents (and so never drops) the node being dragged. */}
      {drag && (
        <motion.div
          aria-hidden
          initial={false}
          animate={{ scale: 1.03, rotate: -1.5 }}
          className="pointer-events-none fixed z-50 flex items-center gap-2.5 rounded-xl border border-[#DCF87C]/45 bg-[#141712] px-3 py-3 shadow-[0_26px_60px_-24px_rgba(0,0,0,0.9)]"
          style={{ left: clone.x, top: clone.y, width: drag.w }}
        >
          <span className="grid grid-cols-2 gap-x-[3px] gap-y-[3px]">
            {Array.from({ length: 6 }).map((_, g) => (
              <span key={g} className="h-[3px] w-[3px] rounded-full bg-[#DCF87C]/70" />
            ))}
          </span>
          <span className="text-sm font-medium leading-snug text-white">{drag.card.text}</span>
        </motion.div>
      )}

      <p id={`${uid}-hint`} className="mt-4 text-center text-xs text-white/40">
        {reduce
          ? 'Focus a card and use the arrow keys — up and down within a column, left and right across.'
          : 'Drag a card between columns, or focus one and use the arrow keys.'}
      </p>
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}
