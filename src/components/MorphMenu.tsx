import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

// MorphMenu — the Overlays family's morphing menu. Where the Popover anchors a
// single fixed panel and the ContextMenu opens one flat list, this one holds a
// *stack* of panels and treats moving between them as the whole show: pick a row
// that owns a sub-panel and the card does not swap abruptly or push a second
// menu on top — it morphs. The container springs its height from the old panel's
// to the new one's while the outgoing panel slides off one way and the incoming
// slides in from the other, so a tall "root" easing down to a short "sub" (or
// back up) reads as one continuous object changing shape rather than two screens
// cutting. It is the dynamic-island / "Family drawer" idea — content-driven size,
// animated — applied to an ordinary settings menu.
//
// The height is real, not guessed: each panel's natural height is measured off
// the DOM (and re-measured by a ResizeObserver, so a panel whose content changes
// live still fits), and the card animates to whichever panel is active. Width is
// fixed so only the height tells the story.
//
// It is a genuine menu, not a flourish. The trigger carries aria-haspopup and
// aria-expanded; each card is a labelled role=menu of role=menuitem rows with a
// single roving tabindex the arrow keys walk (Home/End to the ends); Enter or
// Space fires a row; ArrowRight or Enter descends into a row that owns a panel,
// ArrowLeft or Backspace climbs back; Escape or an outside click closes and
// hands focus back to the trigger. Rows can be internal Links, external anchors,
// or callbacks, and a row can be marked danger for a destructive tint.
//
// Under prefers-reduced-motion the morph and the slide are dropped: the height
// snaps and panels cross-cut with no travel, every control intact.

const EASE = [0.16, 1, 0.3, 1] as const

export interface MorphMenuItem {
  id: string
  label: string
  /** Secondary text shown right-aligned and dimmed (e.g. a current value). */
  hint?: string
  /** A small leading glyph/icon node. */
  icon?: ReactNode
  /** The id of another panel to morph into when this row is chosen. */
  panel?: string
  /** Internal route (react-router). Ignored if `panel` is set. */
  to?: string
  /** External link. Ignored if `panel` or `to` is set. */
  href?: string
  /** Fired on select for rows that are neither a panel nor a link. */
  onSelect?: () => void
  /** Tints the row for a destructive action. */
  danger?: boolean
  /** Closes the menu after the row fires. Defaults to true for links/actions,
   * false for rows that descend into a panel. */
  closeOnSelect?: boolean
}

export interface MorphMenuPanel {
  id: string
  /** Header title; sub-panels show it beside a back control. The root panel
   * may omit it for a cleaner top edge. */
  title?: string
  items: MorphMenuItem[]
}

export interface MorphMenuProps {
  /** Trigger contents. A plain string is wrapped in the default pill button. */
  trigger: ReactNode
  panels: MorphMenuPanel[]
  /** Which panel opens first. Defaults to the first in `panels`. */
  rootId?: string
  /** Anchor edge the panel aligns to under the trigger. */
  align?: 'start' | 'end'
  /** Fixed panel width in px. */
  width?: number
  className?: string
}

export function MorphMenu({
  trigger,
  panels,
  rootId,
  align = 'start',
  width = 288,
  className,
}: MorphMenuProps) {
  const reduce = useReducedMotion()
  const rootPanelId = rootId ?? panels[0]?.id ?? ''

  const [open, setOpen] = useState(false)
  // The navigation stack of panel ids; last entry is the active panel.
  const [stack, setStack] = useState<string[]>([rootPanelId])
  // +1 descending (slide in from the right), -1 climbing back.
  const [dir, setDir] = useState(1)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const [activeIndex, setActiveIndex] = useState(0)

  const activeId = stack[stack.length - 1] ?? rootPanelId
  const activePanel = panels.find((p) => p.id === activeId) ?? panels[0]
  const atRoot = stack.length <= 1

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  const close = useCallback(() => {
    setOpen(false)
    // Return the cursor to the trigger, where the user left it.
    triggerRef.current?.focus()
  }, [])

  // Reset the stack to root whenever the menu is re-opened, so it never
  // re-appears halfway down a branch from last time.
  useEffect(() => {
    if (open) {
      setStack([rootPanelId])
      setDir(1)
      setActiveIndex(0)
    }
  }, [open, rootPanelId])

  // Measure the active panel and drive the card's height to it. A
  // ResizeObserver keeps it honest if the panel's own content changes size.
  useLayoutEffect(() => {
    if (!open) return
    const el = panelRef.current
    if (!el) return
    const apply = () => setHeight(el.offsetHeight)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, activeId])

  // Move roving focus onto the first row whenever the active panel changes.
  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    // Defer a frame so the incoming panel's rows are mounted and measurable.
    const t = window.setTimeout(() => itemRefs.current[0]?.focus(), reduce ? 0 : 60)
    return () => window.clearTimeout(t)
  }, [open, activeId, reduce])

  // Dismiss on an outside pointer press or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const descend = useCallback((panelId: string) => {
    setDir(1)
    setStack((s) => [...s, panelId])
  }, [])

  const goBack = useCallback(() => {
    setDir(-1)
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  const fire = useCallback(
    (item: MorphMenuItem) => {
      if (item.panel) {
        descend(item.panel)
        return
      }
      item.onSelect?.()
      const shouldClose = item.closeOnSelect ?? true
      // Links navigate via their own element; just close the surface.
      if (shouldClose) close()
    },
    [descend, close],
  )

  const items = activePanel?.items ?? []

  const onPanelKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const count = items.length
      if (count === 0) return
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const next = (activeIndex + 1) % count
          setActiveIndex(next)
          itemRefs.current[next]?.focus()
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prev = (activeIndex - 1 + count) % count
          setActiveIndex(prev)
          itemRefs.current[prev]?.focus()
          break
        }
        case 'Home': {
          e.preventDefault()
          setActiveIndex(0)
          itemRefs.current[0]?.focus()
          break
        }
        case 'End': {
          e.preventDefault()
          setActiveIndex(count - 1)
          itemRefs.current[count - 1]?.focus()
          break
        }
        case 'ArrowRight': {
          const item = items[activeIndex]
          if (item?.panel) {
            e.preventDefault()
            descend(item.panel)
          }
          break
        }
        case 'ArrowLeft':
        case 'Backspace': {
          if (!atRoot) {
            e.preventDefault()
            goBack()
          }
          break
        }
        default:
          break
      }
    },
    [items, activeIndex, atRoot, descend, goBack],
  )

  const title = activePanel?.title

  return (
    <div ref={wrapRef} className={`relative inline-block ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        {typeof trigger === 'string' ? <span>{trigger}</span> : trigger}
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className="text-white/50"
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="presentation"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={reduce ? { duration: 0.12 } : { duration: 0.2, ease: EASE }}
            style={{
              width,
              transformOrigin: align === 'end' ? 'top right' : 'top left',
              [align === 'end' ? 'right' : 'left']: 0,
            }}
            className="absolute top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/12 bg-[#0c0c0e]/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            {/* The morphing box: its height is driven to the measured active
                panel, and the panels cross-slide inside it. */}
            <motion.div
              className="relative"
              animate={{ height }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 40, mass: 0.9 }}
            >
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div
                  key={activeId}
                  ref={panelRef}
                  custom={dir}
                  role="menu"
                  aria-label={title ?? (typeof trigger === 'string' ? trigger : 'Menu')}
                  aria-orientation="vertical"
                  onKeyDown={onPanelKeyDown}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 26 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -26 }}
                  transition={reduce ? { duration: 0.1 } : { duration: 0.26, ease: EASE }}
                  className="absolute inset-x-0 top-0 p-1.5"
                >
                  {title && (
                    <div className="flex items-center gap-1 px-1 pb-1.5 pt-1">
                      {!atRoot && (
                        <button
                          type="button"
                          onClick={goBack}
                          aria-label="Back"
                          className="grid h-7 w-7 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                            <path d="M8.5 3 4.5 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                        {title}
                      </span>
                    </div>
                  )}

                  <ul className="flex flex-col" role="none">
                    {items.map((item, i) => {
                      const isPanel = Boolean(item.panel)
                      const common = {
                        role: 'menuitem' as const,
                        tabIndex: i === activeIndex ? 0 : -1,
                        'data-active': i === activeIndex || undefined,
                        onFocus: () => setActiveIndex(i),
                        className: rowClass(item.danger),
                      }
                      const inner = (
                        <RowBody item={item} isPanel={isPanel} />
                      )

                      if (item.to && !isPanel) {
                        return (
                          <li key={item.id} role="none">
                            <Link
                              {...common}
                              to={item.to}
                              ref={(el: HTMLAnchorElement | null) => {
                                itemRefs.current[i] = el
                              }}
                              onClick={() => fire(item)}
                            >
                              {inner}
                            </Link>
                          </li>
                        )
                      }
                      if (item.href && !isPanel) {
                        return (
                          <li key={item.id} role="none">
                            <a
                              {...common}
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                              ref={(el: HTMLAnchorElement | null) => {
                                itemRefs.current[i] = el
                              }}
                              onClick={() => fire(item)}
                            >
                              {inner}
                            </a>
                          </li>
                        )
                      }
                      return (
                        <li key={item.id} role="none">
                          <button
                            {...common}
                            type="button"
                            aria-haspopup={isPanel ? 'menu' : undefined}
                            ref={(el: HTMLButtonElement | null) => {
                              itemRefs.current[i] = el
                            }}
                            onClick={() => fire(item)}
                          >
                            {inner}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function rowClass(danger?: boolean) {
  return [
    'group/row flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
    'focus-visible:outline-none',
    danger
      ? 'text-rose-300/90 hover:bg-rose-500/10 data-[active]:bg-rose-500/10'
      : 'text-white/80 hover:bg-white/[0.06] data-[active]:bg-white/[0.06]',
  ].join(' ')
}

function RowBody({ item, isPanel }: { item: MorphMenuItem; isPanel: boolean }) {
  return (
    <>
      {item.icon != null && (
        <span className="grid h-5 w-5 shrink-0 place-items-center text-white/55 group-hover/row:text-white/80">
          {item.icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
      {item.hint && <span className="shrink-0 text-xs text-white/40">{item.hint}</span>}
      {isPanel ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden
          className="shrink-0 text-white/35 transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-white/60"
        >
          <path d="M5.5 3 9.5 7l-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        item.href && (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0 text-white/30">
            <path d="M3.5 3.5h5v5M8 4 4 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      )}
    </>
  )
}

export default MorphMenu
