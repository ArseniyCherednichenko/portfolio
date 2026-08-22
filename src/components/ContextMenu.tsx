import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const EASE = [0.16, 1, 0.3, 1] as const

/** One row in a context menu. A plain action, a divider, or a small caption. */
export type ContextMenuItem =
  | {
      kind?: 'item'
      /** Stable key + used for keyboard type-ahead is not needed; unique per menu. */
      id: string
      label: string
      /** Right-aligned hint, e.g. a shortcut ("C") or a tiny status ("Live"). */
      shortcut?: string
      /** A leading glyph/mark (kept small; honour the no-emoji rule in copy). */
      icon?: ReactNode
      /** Renders the row as a real anchor — use for external URLs. */
      href?: string
      /** Open an href in a new tab. */
      newTab?: boolean
      /** Called when the row is chosen (after any href navigation is left to the browser). */
      onSelect?: () => void
      /** Tints the row in the accent-danger red for destructive/leaving actions. */
      danger?: boolean
      disabled?: boolean
    }
  | { kind: 'separator'; id: string }
  | { kind: 'label'; id: string; label: string }

interface Origin {
  x: number
  y: number
  /** Which corner the panel grows from, for a natural bloom toward the pointer. */
  corner: 'tl' | 'tr' | 'bl' | 'br'
}

const CORNER: Record<Origin['corner'], string> = {
  tl: 'top left',
  tr: 'top right',
  bl: 'bottom left',
  br: 'bottom right',
}

function isActionable(i: ContextMenuItem): i is Extract<ContextMenuItem, { kind?: 'item' }> {
  return (i.kind ?? 'item') === 'item' && !(i as { disabled?: boolean }).disabled
}

/**
 * A right-click context menu for a surface. Wrap any region; a native-feeling,
 * fully keyboard-navigable menu opens at the pointer on `contextmenu`,
 * suppressing the browser's default menu **only over that region** (the rest of
 * the page keeps its normal right-click, so this is never a hostile global
 * hijack).
 *
 * It is the Overlays family's pointer-anchored sibling to `Popover` (click) and
 * `Tooltip` (hover): the panel is portalled as `position: fixed` at the cursor,
 * measured after mount, and **clamped** inside the viewport — flipping left of /
 * above the pointer near the right or bottom edge — with the bloom growing from
 * whichever corner faces the pointer. It also answers the keyboard context-menu
 * key (Shift+F10 / the Menu key): when that fires with no pointer coordinates,
 * the menu opens anchored to the surface's own rect.
 *
 * Accessibility: `role="menu"` with `role="menuitem"` rows (`separator` and a
 * caption `label` kind for grouping). Focus moves onto the first enabled row on
 * open and is a **roving** focus — Up/Down (wrapping), Home/End move it, Enter or
 * Space fire the row, Escape / Tab / an outside pointer close it, and focus
 * **returns to where it was**. Rows can be real anchors (`href`) or callbacks
 * (`onSelect`). Under reduced motion the panel simply fades — no scale or travel.
 */
export function ContextMenu({
  children,
  items,
  label = 'Actions',
  className = '',
  disabled = false,
}: {
  /** The surface. Right-clicking anywhere inside it opens the menu. */
  children: ReactNode
  /**
   * The rows. A function form receives the element the pointer was over, so a
   * caller can vary the menu by target; it is recomputed on every open.
   */
  items: ContextMenuItem[] | ((target: EventTarget | null) => ContextMenuItem[])
  /** Accessible name for the menu. */
  label?: string
  /** Extra classes for the inline wrapper. */
  className?: string
  /** When true the surface keeps the browser's native context menu. */
  disabled?: boolean
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ContextMenuItem[]>([])
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(0)
  const id = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const rawPt = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])

  const openAt = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      const next = typeof items === 'function' ? items(target) : items
      if (next.length === 0) return
      restoreRef.current = document.activeElement as HTMLElement | null
      rawPt.current = { x: clientX, y: clientY }
      setRows(next)
      // Land focus on the first actionable row.
      const first = next.findIndex(isActionable)
      setActive(first === -1 ? 0 : first)
      setOpen(true)
    },
    [items],
  )

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      // The keyboard menu key fires contextmenu with no real coordinates; anchor
      // to the surface's top-left in that case.
      if (e.clientX === 0 && e.clientY === 0) {
        const r = wrapRef.current?.getBoundingClientRect()
        openAt(r ? r.left + 12 : 0, r ? r.top + 12 : 0, e.target)
      } else {
        openAt(e.clientX, e.clientY, e.target)
      }
    },
    [disabled, openAt],
  )

  // Measure and clamp the panel to the viewport once it is in the DOM.
  useLayoutEffect(() => {
    if (!open) {
      setOrigin(null)
      return
    }
    const panel = panelRef.current
    if (!panel) return
    const w = panel.offsetWidth
    const h = panel.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const M = 8
    const { x: px, y: py } = rawPt.current
    const flipX = px + w + M > vw
    const flipY = py + h + M > vh
    let x = flipX ? px - w : px
    let y = flipY ? py - h : py
    x = Math.max(M, Math.min(x, vw - M - w))
    y = Math.max(M, Math.min(y, vh - M - h))
    const corner: Origin['corner'] = `${flipY ? 'b' : 't'}${flipX ? 'r' : 'l'}` as Origin['corner']
    setOrigin({ x, y, corner })
    panel.focus({ preventScroll: true })
  }, [open])

  // Reposition-closing: a menu should not float away from its anchor, so any
  // scroll or resize dismisses it (matches native behaviour).
  useEffect(() => {
    if (!open) return
    const onScroll = () => close()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, close])

  // Outside pointer / a second right-click elsewhere closes.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      close()
    }
    const onCtx = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      // Let the wrapper's own handler re-open at the new spot; just close here.
      close()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('contextmenu', onCtx, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('contextmenu', onCtx, true)
    }
  }, [open, close])

  // Return focus to where it was when the menu closes.
  useEffect(() => {
    if (open) return
    const back = restoreRef.current
    if (back && typeof back.focus === 'function') back.focus({ preventScroll: true })
  }, [open])

  const move = useCallback(
    (dir: 1 | -1) => {
      setActive((cur) => {
        const n = rows.length
        for (let step = 1; step <= n; step++) {
          const idx = (cur + dir * step + n * step) % n
          if (isActionable(rows[idx])) return idx
        }
        return cur
      })
    },
    [rows],
  )

  const edge = useCallback(
    (end: 'first' | 'last') => {
      const order = end === 'first' ? rows.map((_, i) => i) : rows.map((_, i) => rows.length - 1 - i)
      const found = order.find((i) => isActionable(rows[i]))
      if (found !== undefined) setActive(found)
    },
    [rows],
  )

  const choose = useCallback(
    (i: number) => {
      const row = rows[i]
      if (!row || !isActionable(row)) return
      close()
      row.onSelect?.()
    },
    [rows, close],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          move(1)
          break
        case 'ArrowUp':
          e.preventDefault()
          move(-1)
          break
        case 'Home':
          e.preventDefault()
          edge('first')
          break
        case 'End':
          e.preventDefault()
          edge('last')
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const row = rows[active]
          if (row && isActionable(row) && row.href) {
            // Let the anchor take the click so modifier-clicks / new tab work.
            const el = panelRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)
            el?.click()
          } else {
            choose(active)
          }
          break
        }
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          close()
          break
        case 'Tab':
          close()
          break
      }
    },
    [move, edge, choose, active, rows, close],
  )

  return (
    <div
      ref={wrapRef}
      onContextMenu={onContextMenu}
      aria-haspopup="menu"
      className={className}
    >
      {children}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                role="menu"
                id={id}
                aria-label={label}
                aria-orientation="vertical"
                tabIndex={-1}
                onKeyDown={onKeyDown}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ duration: reduce ? 0.12 : 0.16, ease: EASE }}
                style={
                  {
                    position: 'fixed',
                    left: origin?.x ?? 0,
                    top: origin?.y ?? 0,
                    transformOrigin: CORNER[origin?.corner ?? 'tl'],
                    zIndex: 130,
                    visibility: origin ? 'visible' : 'hidden',
                  } as CSSProperties
                }
                className="min-w-[13rem] max-w-[18rem] overflow-hidden rounded-xl border border-white/10 bg-[#131313]/97 p-1.5 text-sm text-white/80 shadow-2xl shadow-black/60 outline-none backdrop-blur-md"
              >
                {rows.map((row, i) => {
                  if (row.kind === 'separator') {
                    return <div key={row.id} role="separator" className="my-1 h-px bg-white/10" />
                  }
                  if (row.kind === 'label') {
                    return (
                      <div
                        key={row.id}
                        className="px-2.5 pb-1 pt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-white/35"
                      >
                        {row.label}
                      </div>
                    )
                  }
                  const isActive = i === active
                  const rowClass = [
                    'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                    row.disabled
                      ? 'cursor-not-allowed text-white/25'
                      : row.danger
                        ? isActive
                          ? 'bg-[#ff6b6b]/15 text-[#ff8f8f]'
                          : 'text-white/75 hover:bg-[#ff6b6b]/10'
                        : isActive
                          ? 'bg-[#DCF87C]/15 text-white'
                          : 'text-white/75 hover:bg-white/[0.06]',
                  ].join(' ')
                  const inner = (
                    <>
                      {row.icon != null && (
                        <span
                          aria-hidden
                          className={`grid h-4 w-4 shrink-0 place-items-center ${row.danger ? 'text-[#ff8f8f]' : isActive ? 'text-[#DCF87C]' : 'text-white/45'}`}
                        >
                          {row.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">{row.label}</span>
                      {row.shortcut && (
                        <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[0.62rem] uppercase tracking-wider text-white/40">
                          {row.shortcut}
                        </span>
                      )}
                    </>
                  )
                  const common = {
                    'data-row': i,
                    role: 'menuitem' as const,
                    tabIndex: -1,
                    'aria-disabled': row.disabled || undefined,
                    className: rowClass,
                    onMouseEnter: () => !row.disabled && setActive(i),
                  }
                  if (row.href && !row.disabled) {
                    return (
                      <a
                        key={row.id}
                        {...common}
                        href={row.href}
                        target={row.newTab ? '_blank' : undefined}
                        rel={row.newTab ? 'noreferrer noopener' : undefined}
                        onClick={() => {
                          close()
                          row.onSelect?.()
                        }}
                      >
                        {inner}
                      </a>
                    )
                  }
                  return (
                    <button
                      key={row.id}
                      type="button"
                      {...common}
                      disabled={row.disabled}
                      onClick={() => choose(i)}
                    >
                      {inner}
                    </button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
