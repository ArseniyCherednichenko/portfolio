import { motion, useReducedMotion } from 'framer-motion'
import { useId, useMemo, useState } from 'react'

// The catalogue had grown a full set of *value* controls and, lately, a run of
// physics and curve toys — but the one primitive every dashboard, admin panel
// and settings list is actually built on, a table you can sort, was missing.
// This fills that gap, and it does it in the house language: when you re-sort,
// the rows do not blink into their new order, they *glide* to it — the same
// signature the Select, the Calendar and the Pagination pill already speak,
// here applied to data. A single lime underline travels between column headers
// on a shared layoutId as the active sort moves, so the eye follows which
// column the table is ordered by. It is honest to assistive tech: a real
// <table> with a <caption>, scope="col" headers, aria-sort on the active
// column reflecting the live direction, and the sort toggles are real buttons
// reachable and operable from the keyboard. Under prefers-reduced-motion the
// gliding rows and the travelling underline drop to instant, correct swaps —
// the ordering is identical, only the motion is removed.

const SPRING = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.8 }

export type SortDir = 'asc' | 'desc'

export interface Column<T> {
  /** Stable key for this column; also the default sort field name. */
  key: string
  /** Header label. */
  header: string
  /** Right-align the cell (use for numbers). */
  align?: 'left' | 'right'
  /** Render the cell body. Defaults to String of the sort value. */
  render?: (row: T) => React.ReactNode
  /** The comparable value for sorting. Numbers sort numerically, strings by
   * locale. Omit to make the column unsortable (a plain label header). */
  sortValue?: (row: T) => number | string
  /** Fixed width hint, e.g. "6rem". */
  width?: string
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[]
  rows: readonly T[]
  /** Stable identity per row, so a re-sort animates the *same* row to its new
   * position rather than crossfading one row into another. */
  rowKey: (row: T) => string
  /** Starting sort. Omit to open in the rows' natural order. */
  initialSort?: { key: string; dir: SortDir }
  /** Accessible caption for the table. */
  caption: string
  className?: string
}

/**
 * A sortable data table. Click a sortable header to order by it; click again to
 * reverse; a third click returns to the rows' natural order. The sorted column
 * carries a lime underline that glides across as the sort moves, and the rows
 * spring to their new positions instead of jumping. A real `<table>` with a
 * caption, `scope="col"` headers and live `aria-sort`; reduced motion keeps the
 * ordering and drops only the animation.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  caption,
  className = '',
}: DataTableProps<T>) {
  const reduce = useReducedMotion()
  // A unique layoutId root per mounted table, so two tables on one page never
  // fight over the same gliding underline.
  const underlineId = useId()
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(
    initialSort ?? null,
  )

  const sorted = useMemo(() => {
    if (!sort) return rows.slice()
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows.slice()
    const get = col.sortValue
    const factor = sort.dir === 'asc' ? 1 : -1
    return rows.slice().sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv)) * factor
    })
  }, [rows, columns, sort])

  // Click a header: inactive -> asc -> desc -> natural order.
  function toggle(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-white/12">
            {columns.map((col) => {
              const sortable = !!col.sortValue
              const active = sort?.key === col.key
              const ariaSort = !sortable
                ? undefined
                : active
                  ? sort!.dir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-3 pb-3 align-bottom text-[0.7rem] font-semibold uppercase tracking-[0.14em] ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className={`group relative inline-flex items-center gap-1.5 rounded-md py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 ${
                        col.align === 'right' ? 'flex-row-reverse' : ''
                      } ${active ? 'text-[#DCF87C]' : 'text-white/45 hover:text-white/80'}`}
                    >
                      <span className="relative">
                        {col.header}
                        {active && (
                          <motion.span
                            layoutId={reduce ? undefined : `${underlineId}-underline`}
                            transition={reduce ? { duration: 0 } : SPRING}
                            className="absolute -bottom-1 left-0 right-0 h-px bg-[#DCF87C]"
                            aria-hidden
                          />
                        )}
                      </span>
                      <SortCaret active={active} dir={active ? sort!.dir : undefined} reduce={!!reduce} />
                    </button>
                  ) : (
                    <span className="inline-block py-0.5 text-white/45">{col.header}</span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        {/* `layout` on each row lets Framer translate it to its new slot on a
            re-sort, so the table reorders by motion rather than by a jump. The
            rows keep stable keys, so it is the same row moving. */}
        <tbody>
          {sorted.map((row) => (
            <motion.tr
              key={rowKey(row)}
              layout={reduce ? false : 'position'}
              transition={reduce ? { duration: 0 } : SPRING}
              className="border-b border-white/[0.06] last:border-0 transition-colors hover:bg-white/[0.03]"
            >
              {columns.map((col) => {
                const active = sort?.key === col.key
                return (
                  <td
                    key={col.key}
                    className={`px-3 py-3 ${
                      col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                    } ${active ? 'text-white' : 'text-white/70'}`}
                  >
                    {col.render ? col.render(row) : String(col.sortValue?.(row) ?? '')}
                  </td>
                )
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A compact up/down caret. Inactive columns show a faint, dimmed pair so the
// control reads as sortable; the active column shows one arrow that flips
// between ascending and descending (a spring rotation under full motion).
function SortCaret({
  active,
  dir,
  reduce,
}: {
  active: boolean
  dir?: SortDir
  reduce: boolean
}) {
  if (!active) {
    return (
      <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden className="shrink-0 text-white/25 opacity-0 transition-opacity group-hover:opacity-100">
        <path d="M5 1.5 2.5 4.5h5z" fill="currentColor" />
        <path d="M5 10.5 2.5 7.5h5z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <motion.svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      aria-hidden
      className="shrink-0 text-[#DCF87C]"
      animate={{ rotate: dir === 'desc' ? 180 : 0 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 32 }}
    >
      <path d="M5 2.5 1.5 7h7z" fill="currentColor" />
    </motion.svg>
  )
}
