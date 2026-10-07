import { motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// The controls family had every way of picking a *value* — Select, Combobox,
// Wheel, the sliders, the Switch — but nothing for moving through a *set* of
// pages, the one navigation primitive every long list or table leans on. This
// fills that gap. The signature is the same one the Select and the Calendar
// speak: a single lime pill that *glides* between positions on a shared
// layoutId rather than blinking from one page to the next, so the eye follows
// the current page as it travels and the control feels like one object moving,
// not a row of lamps switching on and off. The number range truncates the MUI
// way — a run of boundary pages, a window of siblings around the current page,
// and an ellipsis bridging the gap — so a hundred pages still fit one tidy row
// and the layout never reflows as you walk across it. It is honest to assistive
// tech: a labelled <nav>, a real <button> per control, aria-current="page" on
// the active one, the arrows disabled at the ends, and a live region that
// narrates each move. Under prefers-reduced-motion the gliding pill drops to an
// instant swap; everything else stays exactly as usable.

const SPRING = { type: 'spring' as const, stiffness: 520, damping: 40, mass: 0.7 }

type Slot = number | 'start-ellipsis' | 'end-ellipsis'

/**
 * Build the visible slot list: the first `boundaryCount` pages, the last
 * `boundaryCount` pages, and a window of `siblingCount` pages either side of the
 * current one, bridged by at most one ellipsis on each side. A gap of exactly
 * one hidden page is shown as that page rather than a dot (an ellipsis hiding a
 * single number would be a lie that costs more space than it saves).
 */
function buildRange(
  page: number,
  count: number,
  siblingCount: number,
  boundaryCount: number,
): Slot[] {
  // Everything fits — no truncation needed.
  const total = boundaryCount * 2 + siblingCount * 2 + 3
  if (count <= total) return range(1, count)

  const startPages = range(1, boundaryCount)
  const endPages = range(count - boundaryCount + 1, count)

  // The sibling window, clamped so it never overruns the boundary runs.
  const siblingsStart = Math.max(
    Math.min(page - siblingCount, count - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  )
  const siblingsEnd = Math.min(
    Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : count - 1,
  )

  const slots: Slot[] = [...startPages]

  if (siblingsStart > boundaryCount + 2) slots.push('start-ellipsis')
  else if (boundaryCount + 1 < count - boundaryCount) slots.push(boundaryCount + 1)

  slots.push(...range(siblingsStart, siblingsEnd))

  if (siblingsEnd < count - boundaryCount - 1) slots.push('end-ellipsis')
  else if (count - boundaryCount > boundaryCount) slots.push(count - boundaryCount)

  slots.push(...endPages)
  return slots
}

function range(start: number, end: number): number[] {
  const out: number[] = []
  for (let i = start; i <= end; i += 1) out.push(i)
  return out
}

export interface PaginationProps {
  /** Total number of pages (>= 1). */
  count: number
  /** Controlled current page, 1-indexed. When set, changes report via onChange. */
  page?: number
  /** Initial page when uncontrolled. */
  defaultPage?: number
  onChange?: (page: number) => void
  /** Pages shown either side of the current one. */
  siblingCount?: number
  /** Pages always shown at the very start and very end. */
  boundaryCount?: number
  /** Show jump-to-first / jump-to-last double arrows outside the prev/next ones. */
  showEdges?: boolean
  /** Accessible name for the nav landmark. */
  label?: string
  className?: string
}

/**
 * An accessible page navigator. Click a number, or the prev/next arrows; the
 * lime pill glides to the chosen page. Focus any control and the arrows do not
 * hijack typing — but Left/Right on the nav itself step the page, and Home/End
 * jump to the first/last.
 *
 * Controlled (`page` + `onChange`) or uncontrolled (`defaultPage`). A real
 * labelled `<nav>` of `<button>`s with `aria-current="page"` on the active page
 * and a live region narrating each move. Under prefers-reduced-motion the
 * gliding pill becomes an instant swap.
 */
export function Pagination({
  count,
  page: controlledPage,
  defaultPage = 1,
  onChange,
  siblingCount = 1,
  boundaryCount = 1,
  showEdges = false,
  label = 'Pagination',
  className = '',
}: PaginationProps) {
  const reduce = useReducedMotion()
  const pageCount = Math.max(1, Math.floor(count))
  const isControlled = controlledPage != null
  const [uncontrolled, setUncontrolled] = useState(() => clamp(defaultPage, pageCount))
  const current = clamp(isControlled ? (controlledPage as number) : uncontrolled, pageCount)
  const navRef = useRef<HTMLElement | null>(null)

  const go = useCallback(
    (next: number) => {
      const target = clamp(next, pageCount)
      if (target === current) return
      if (!isControlled) setUncontrolled(target)
      onChange?.(target)
    },
    [current, isControlled, onChange, pageCount],
  )

  const slots = useMemo(
    () => buildRange(current, pageCount, siblingCount, boundaryCount),
    [current, pageCount, siblingCount, boundaryCount],
  )

  // A stable layoutId per mounted pager so two on one page never fight over the
  // same gliding pill.
  const pillId = useMemo(() => `pagination-pill-${Math.random().toString(36).slice(2, 8)}`, [])

  const onNavKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          go(current - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          go(current + 1)
          break
        case 'Home':
          e.preventDefault()
          go(1)
          break
        case 'End':
          e.preventDefault()
          go(pageCount)
          break
        default:
      }
    },
    [current, go, pageCount],
  )

  const atStart = current <= 1
  const atEnd = current >= pageCount

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 ${className}`}
      onKeyDown={onNavKeyDown}
    >
      {/* Live region: what just changed, spoken once per move. */}
      <span className="sr-only" aria-live="polite">
        Page {current} of {pageCount}
      </span>

      {showEdges && (
        <Arrow label="First page" disabled={atStart} onClick={() => go(1)}>
          <Chevron double dir="left" />
        </Arrow>
      )}
      <Arrow label="Previous page" disabled={atStart} onClick={() => go(current - 1)}>
        <Chevron dir="left" />
      </Arrow>

      <ul className="flex items-center gap-1" role="list">
        {slots.map((slot, i) => {
          if (slot === 'start-ellipsis' || slot === 'end-ellipsis') {
            return (
              <li key={`${slot}-${i}`} aria-hidden className="px-1.5 text-white/30 select-none">
                &#8230;
              </li>
            )
          }
          const selected = slot === current
          return (
            <li key={slot} className="relative">
              {selected && (
                <motion.span
                  layoutId={reduce ? undefined : pillId}
                  transition={reduce ? { duration: 0 } : SPRING}
                  className="absolute inset-0 rounded-xl bg-[#DCF87C]"
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => go(slot)}
                aria-current={selected ? 'page' : undefined}
                aria-label={`Go to page ${slot}`}
                className={`relative grid h-10 min-w-[2.5rem] place-items-center rounded-xl px-2 text-sm font-semibold tabular-nums transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 ${
                  selected
                    ? 'text-black'
                    : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {slot}
              </button>
            </li>
          )
        })}
      </ul>

      <Arrow label="Next page" disabled={atEnd} onClick={() => go(current + 1)}>
        <Chevron dir="right" />
      </Arrow>
      {showEdges && (
        <Arrow label="Last page" disabled={atEnd} onClick={() => go(pageCount)}>
          <Chevron double dir="right" />
        </Arrow>
      )}
    </nav>
  )
}

function Arrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/70 transition-colors duration-200 hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/20 disabled:hover:border-white/5"
    >
      {children}
    </button>
  )
}

function Chevron({ dir, double = false }: { dir: 'left' | 'right'; double?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={dir === 'left' ? '' : 'rotate-180'}
    >
      <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {double && (
        <path d="M13.5 3.5 9 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

function clamp(n: number, max: number): number {
  if (Number.isNaN(n)) return 1
  return Math.min(Math.max(Math.round(n), 1), Math.max(1, max))
}
