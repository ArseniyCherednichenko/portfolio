import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

// The controls family has every picker that keeps one value — the Select, the
// Combobox, the Wheel, the segmented control — and every picker that keeps a
// scalar — the sliders, the stepper, the rating. What it was missing is the one
// that keeps a SET and lets you compose it: the transfer list, two listboxes
// with a channel of arrows between them, the control a design system reaches for
// when a person has to pull a handful of things out of a longer roster (columns
// to show, people to invite, permissions to grant) and SEE both what they took
// and what they left. It is a genuinely hard control — two real multi-select
// listboxes, a filter over each, batch moves and move-all, and items that have
// to travel believably from one side to the other — which is exactly why it
// earns a place here rather than reading as another checkbox grid.
//
// The craft is the TRAVEL. Every other control in the family lights or glides a
// thing that stays put; here an item leaves one list and arrives in the other,
// so the signature is a shared-layout spring: the row you move doesn't blink out
// of the left pane and blink into the right, it springs across under its own
// weight (framer `layout` + a per-value `layoutId`), while the rows it left
// behind close the gap. Hue stays the single lime — a checked row is lime-tinted
// and lime-barred, nothing else competes — so the eye reads STATE (checked vs
// not, here vs there), never a decorative palette.
//
// It is two real WAI-ARIA listboxes. Each pane is role="listbox"
// aria-multiselectable; each row role="option" with aria-selected; a roving
// tabindex makes each pane a single tab stop. Arrow keys move the active row,
// Space toggles its check (for a batch move), Enter sends it across on its own,
// Home/End jump the ends, and Ctrl/Cmd+A checks every visible row. The move
// buttons read their counts aloud, and an aria-live line narrates each transfer
// so the change is never only visual. Under prefers-reduced-motion the spring
// comes off and rows cut to their new pane instantly — still fully usable.

export interface TransferItem {
  /** Stable value reported through onChange and used as the row key. */
  value: string
  /** What the row shows. Falls back to `value`. */
  label?: ReactNode
  /** A plain-text form used for filtering and the live announcements. */
  text?: string
  disabled?: boolean
}

type Side = 'source' | 'target'

function plain(it: TransferItem): string {
  return it.text ?? (typeof it.label === 'string' ? it.label : it.value)
}

/**
 * A transfer list (dual listbox): pull items from a source roster into a target
 * set and back. Controlled (`target` + `onChange`) or uncontrolled
 * (`defaultTarget`). Two real multi-select listboxes with per-pane filtering,
 * batch and move-all, full keyboard support, and a shared-layout spring that
 * carries each moved row across. Reduced motion drops the spring.
 */
export function TransferList({
  items,
  target: controlledTarget,
  defaultTarget = [],
  onChange,
  sourceLabel = 'Available',
  targetLabel = 'Selected',
  searchable = true,
  className = '',
}: {
  items: TransferItem[]
  /** Controlled: the values currently on the target side. */
  target?: string[]
  /** Initial target values when uncontrolled. */
  defaultTarget?: string[]
  onChange?: (target: string[]) => void
  sourceLabel?: string
  targetLabel?: string
  searchable?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const baseId = useId()

  const isControlled = controlledTarget !== undefined
  const [uncontrolled, setUncontrolled] = useState<string[]>(defaultTarget)
  const targetValues = useMemo(
    () => new Set(isControlled ? controlledTarget : uncontrolled),
    [isControlled, controlledTarget, uncontrolled],
  )

  // Checked (highlighted) rows per pane, and the roving-tabindex active row.
  const [checked, setChecked] = useState<Record<Side, Set<string>>>({
    source: new Set(),
    target: new Set(),
  })
  const [active, setActive] = useState<Record<Side, string | null>>({ source: null, target: null })
  const [query, setQuery] = useState<Record<Side, string>>({ source: '', target: '' })
  const [announce, setAnnounce] = useState('')

  const listRefs = useRef<Record<Side, HTMLUListElement | null>>({ source: null, target: null })

  // The rows that live on each side, in the original roster order.
  const sideItems = useCallback(
    (side: Side) => items.filter((it) => (side === 'target') === targetValues.has(it.value)),
    [items, targetValues],
  )
  // Those, narrowed by the pane's filter.
  const visible = useCallback(
    (side: Side) => {
      const q = query[side].trim().toLowerCase()
      const rows = sideItems(side)
      return q ? rows.filter((it) => plain(it).toLowerCase().includes(q)) : rows
    },
    [sideItems, query],
  )

  const setTarget = useCallback(
    (next: string[]) => {
      if (!isControlled) setUncontrolled(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  // Move a set of values to the opposite side (toward = where they end up).
  const moveValues = useCallback(
    (values: string[], toward: Side) => {
      const movable = values.filter((v) => {
        const it = items.find((i) => i.value === v)
        return it && !it.disabled
      })
      if (movable.length === 0) return
      const moving = new Set(movable)
      const nextTarget =
        toward === 'target'
          ? [...targetValues, ...movable.filter((v) => !targetValues.has(v))]
          : [...targetValues].filter((v) => !moving.has(v))
      setTarget(nextTarget)
      // Clear just-moved rows out of the origin pane's checked set.
      const from: Side = toward === 'target' ? 'source' : 'target'
      setChecked((c) => {
        const nf = new Set(c[from])
        movable.forEach((v) => nf.delete(v))
        return { ...c, [from]: nf }
      })
      const names = movable
        .map((v) => plain(items.find((i) => i.value === v)!))
        .slice(0, 3)
        .join(', ')
      const extra = movable.length > 3 ? ` and ${movable.length - 3} more` : ''
      setAnnounce(
        `Moved ${movable.length} ${movable.length === 1 ? 'item' : 'items'} to ${
          toward === 'target' ? targetLabel : sourceLabel
        }: ${names}${extra}.`,
      )
    },
    [items, targetValues, setTarget, sourceLabel, targetLabel],
  )

  const moveChecked = useCallback(
    (from: Side) => moveValues([...checked[from]], from === 'source' ? 'target' : 'source'),
    [checked, moveValues],
  )
  const moveAll = useCallback(
    (from: Side) => moveValues(visible(from).map((it) => it.value), from === 'source' ? 'target' : 'source'),
    [visible, moveValues],
  )

  const toggleCheck = useCallback((side: Side, value: string) => {
    setChecked((c) => {
      const next = new Set(c[side])
      next.has(value) ? next.delete(value) : next.add(value)
      return { ...c, [side]: next }
    })
  }, [])

  // Keep the active row valid as panes and filters change; default to the first
  // visible row so the first arrow press has somewhere to land.
  useEffect(() => {
    ;(['source', 'target'] as Side[]).forEach((side) => {
      setActive((a) => {
        const rows = visible(side)
        if (rows.length === 0) return a[side] === null ? a : { ...a, [side]: null }
        if (a[side] && rows.some((r) => r.value === a[side])) return a
        return { ...a, [side]: rows[0].value }
      })
    })
  }, [visible])

  function focusRow(side: Side, value: string) {
    const el = listRefs.current[side]?.querySelector<HTMLLIElement>(`[data-value="${CSS.escape(value)}"]`)
    el?.focus()
  }

  function onListKeyDown(e: ReactKeyboardEvent<HTMLUListElement>, side: Side) {
    const rows = visible(side)
    if (rows.length === 0) return
    const idx = Math.max(0, rows.findIndex((r) => r.value === active[side]))
    const go = (i: number) => {
      const v = rows[i].value
      setActive((a) => ({ ...a, [side]: v }))
      focusRow(side, v)
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        go(Math.min(rows.length - 1, idx + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        go(Math.max(0, idx - 1))
        break
      case 'Home':
        e.preventDefault()
        go(0)
        break
      case 'End':
        e.preventDefault()
        go(rows.length - 1)
        break
      case ' ':
        e.preventDefault()
        if (!rows[idx].disabled) toggleCheck(side, rows[idx].value)
        break
      case 'Enter':
        e.preventDefault()
        if (!rows[idx].disabled) moveValues([rows[idx].value], side === 'source' ? 'target' : 'source')
        break
      case 'a':
      case 'A':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          setChecked((c) => ({ ...c, [side]: new Set(rows.filter((r) => !r.disabled).map((r) => r.value)) }))
        }
        break
    }
  }

  const spring = reduce
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 520, damping: 42, mass: 0.8 } as const)

  // Rendered via a plain call ({renderPane('source')}), NOT as <Pane/>: a
  // component declared inside render is a new type every render, so React would
  // remount both panes on each keystroke — the filter input would lose focus and
  // the shared-layout springs would never match across a move. A call keeps the
  // JSX inline in TransferList's own tree, so focus and layoutIds stay stable.
  function renderPane(side: Side) {
    const rows = visible(side)
    const total = sideItems(side).length
    const checkedCount = rows.filter((r) => checked[side].has(r.value)).length
    const label = side === 'source' ? sourceLabel : targetLabel
    const listId = `${baseId}-${side}`
    return (
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <span id={`${listId}-label`} className="text-sm font-semibold text-white/85">
            {label}
          </span>
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/55">
            {checkedCount > 0 ? `${checkedCount} / ${total}` : total}
          </span>
        </div>

        {searchable && (
          <div className="border-b border-white/10 px-3 py-2">
            <input
              type="text"
              value={query[side]}
              onChange={(e) => setQuery((q) => ({ ...q, [side]: e.target.value }))}
              placeholder={`Filter ${label.toLowerCase()}`}
              aria-label={`Filter ${label}`}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/85 outline-none placeholder:text-white/30 focus-visible:border-[#DCF87C]/50 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40"
            />
          </div>
        )}

        <ul
          ref={(el) => {
            listRefs.current[side] = el
          }}
          role="listbox"
          aria-multiselectable
          aria-labelledby={`${listId}-label`}
          onKeyDown={(e) => onListKeyDown(e, side)}
          className="m-0 max-h-64 min-h-[9rem] list-none overflow-y-auto p-1.5"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-white/30">
              {query[side] ? 'No matches' : 'Nothing here'}
            </li>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map((it) => {
                const isChecked = checked[side].has(it.value)
                const isActive = active[side] === it.value
                return (
                  <motion.li
                    key={it.value}
                    layoutId={reduce ? undefined : `transfer-${baseId}-${it.value}`}
                    layout={!reduce}
                    transition={spring}
                    data-value={it.value}
                    role="option"
                    aria-selected={isChecked}
                    aria-disabled={it.disabled || undefined}
                    tabIndex={isActive ? 0 : -1}
                    onFocus={() => setActive((a) => ({ ...a, [side]: it.value }))}
                    onClick={() => !it.disabled && toggleCheck(side, it.value)}
                    onDoubleClick={() =>
                      !it.disabled && moveValues([it.value], side === 'source' ? 'target' : 'source')
                    }
                    className={`group relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors ${
                      it.disabled
                        ? 'cursor-not-allowed text-white/25'
                        : isChecked
                          ? 'bg-[#DCF87C]/[0.12] text-white'
                          : 'text-white/70 hover:bg-white/[0.04] hover:text-white/90'
                    } focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60`}
                  >
                    {/* The lime bar that marks a checked row. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#DCF87C] transition-opacity ${
                        isChecked ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked ? 'border-[#DCF87C] bg-[#DCF87C] text-black' : 'border-white/25 text-transparent'
                      }`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="min-w-0 truncate">{it.label ?? it.value}</span>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          )}
        </ul>
      </div>
    )
  }

  const srcChecked = visible('source').filter((r) => checked.source.has(r.value)).length
  const tgtChecked = visible('target').filter((r) => checked.target.has(r.value)).length
  const srcAny = visible('source').some((r) => !r.disabled)
  const tgtAny = visible('target').some((r) => !r.disabled)

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        {renderPane('source')}

        {/* The channel of moves. A row on small screens, a column on wide. */}
        <div className="flex shrink-0 items-center justify-center gap-2 sm:flex-col">
          <MoveButton onClick={() => moveAll('source')} disabled={!srcAny} title={`Move all to ${targetLabel}`}>
            <Chevrons dir="right" />
          </MoveButton>
          <MoveButton
            onClick={() => moveChecked('source')}
            disabled={srcChecked === 0}
            title={`Move ${srcChecked || ''} checked to ${targetLabel}`.replace('  ', ' ')}
          >
            <Chevron dir="right" />
          </MoveButton>
          <MoveButton
            onClick={() => moveChecked('target')}
            disabled={tgtChecked === 0}
            title={`Move ${tgtChecked || ''} checked to ${sourceLabel}`.replace('  ', ' ')}
          >
            <Chevron dir="left" />
          </MoveButton>
          <MoveButton onClick={() => moveAll('target')} disabled={!tgtAny} title={`Move all to ${sourceLabel}`}>
            <Chevrons dir="left" />
          </MoveButton>
        </div>

        {renderPane('target')}
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  )
}

// One move button: a direction glyph with an accessible name carrying its live
// count. Hoisted to module scope so it is a stable component type across renders.
function MoveButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled: boolean
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-white/[0.03] text-white/70 outline-none transition-colors enabled:hover:border-[#DCF87C]/50 enabled:hover:text-[#DCF87C] focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 disabled:opacity-25"
    >
      {children}
    </button>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={dir === 'left' ? 'rotate-180 sm:rotate-0' : 'sm:rotate-0'}
      aria-hidden
    >
      <path d={dir === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  )
}

function Chevrons({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === 'right' ? <path d="M7 6l6 6-6 6M13 6l6 6-6 6" /> : <path d="M17 6l-6 6 6 6M11 6l-6 6 6 6" />}
    </svg>
  )
}
