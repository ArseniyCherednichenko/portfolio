import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// A scoped command-palette for the Playground. The page carries three dozen
// experiments down one very long scroll; this makes any of them reachable by
// name in a keystroke — search, arrow, enter — with a "surprise me" jump and an
// on-arrival lime flash so you never lose the one you picked. It reads the live
// DOM (every experiment card is tagged `data-experiment` / `data-category` by
// the page), so it can never drift from what is actually rendered.

/** Stable id for an experiment, shared with the page so deep links resolve.
 *  "3D tilt card" -> "3d-tilt-card". */
export function slugifyExperiment(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Bloom a brief lime ring around a card so a jump lands somewhere visible. */
export function flashExperiment(node: HTMLElement) {
  node.classList.remove('pg-flash')
  // Force a reflow so the animation restarts if the same card is picked twice.
  void node.offsetWidth
  node.classList.add('pg-flash')
  window.setTimeout(() => node.classList.remove('pg-flash'), 1600)
}

type Item = { id: string; name: string; category: string; node: HTMLElement }

// Read every tagged experiment card straight off the page, in DOM order (which
// is already category order, since the categories render in sequence).
function collect(): Item[] {
  if (typeof document === 'undefined') return []
  return Array.from(document.querySelectorAll<HTMLElement>('[data-experiment]')).map((node) => {
    const name = node.dataset.experiment ?? ''
    return {
      id: node.id || slugifyExperiment(name),
      name,
      category: node.closest<HTMLElement>('[data-category]')?.dataset.category ?? 'Other',
      node,
    }
  })
}

// Scroll a card into the middle of the viewport, flag the URL, and flash it.
function jumpTo(item: Item, reduce: boolean) {
  item.node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  // replaceState (not a hash navigation) so react-router's scroll manager does
  // not fight this smooth scroll or push a history entry per jump.
  if (item.id) history.replaceState(null, '', `#${item.id}`)
  flashExperiment(item.node)
}

export function PlaygroundFinder() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  // On direct load of /playground#some-experiment, wait for the (lazy) page to
  // paint, then centre and flash the target — the app-shell scroll manager runs
  // before these cards exist, so it can't do this for us.
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const id = window.setTimeout(() => {
      const found = collect().find((it) => it.id === hash)
      if (found) jumpTo(found, !!reduce)
    }, 260)
    return () => window.clearTimeout(id)
    // Run once on mount; reduce is stable enough for this one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open on "/" from anywhere on the page (unless typing or a modifier is held).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Refresh the list and reset state each time it opens; lock body scroll.
  useEffect(() => {
    if (!open) return
    setItems(collect())
    setQuery('')
    setActive(0)
    const focus = window.setTimeout(() => inputRef.current?.focus(), 10)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(focus)
      document.body.style.overflow = prev
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => `${it.name} ${it.category}`.toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Keep the active row in view while arrowing.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = useCallback(
    (item: Item | undefined) => {
      if (!item) return
      setOpen(false)
      // Let the overlay unmount and body scroll unlock before we scroll.
      window.setTimeout(() => jumpTo(item, !!reduce), reduce ? 0 : 130)
    },
    [reduce],
  )

  const surprise = useCallback(() => {
    const pool = filtered.length ? filtered : items
    if (!pool.length) return
    // Vary by list length + query so repeat taps don't stick on one card,
    // without reaching for Math.random in this render path.
    const seed = pool.length + query.length + active
    pick(pool[seed % pool.length])
  }, [filtered, items, query, active, pick])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (filtered.length ? (a - 1 + filtered.length) % filtered.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(filtered[active])
    }
  }

  let lastCategory = ''

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Find an experiment"
        className="group fixed bottom-6 left-6 z-[45] flex items-center gap-2 rounded-full border border-white/12 bg-[#0E0E0E]/85 px-4 py-2.5 text-sm text-white/70 shadow-lg shadow-black/40 backdrop-blur-md transition-colors hover:border-white/25 hover:text-white"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Find an experiment</span>
        <span className="sm:hidden">Find</span>
        <kbd className="ml-0.5 hidden rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/40 sm:inline">
          /
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm sm:pt-[16vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Find an experiment"
          >
            <motion.div
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0E0E0E]/95 shadow-2xl shadow-black/60"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKeyDown}
            >
              <div className="flex items-center gap-3 border-b border-white/10 px-4">
                <SearchIcon />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find an experiment by name..."
                  aria-label="Find an experiment"
                  role="combobox"
                  aria-expanded
                  aria-controls="playground-finder-list"
                  className="w-full bg-transparent py-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
                />
                <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/40 sm:block">
                  esc
                </kbd>
              </div>

              <div
                ref={listRef}
                id="playground-finder-list"
                role="listbox"
                className="max-h-[min(60vh,380px)] overflow-y-auto p-2"
              >
                {filtered.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-white/40">No experiment matches "{query}".</p>
                )}
                {filtered.map((it, i) => {
                  const showGroup = it.category !== lastCategory
                  lastCategory = it.category
                  const isActive = i === active
                  return (
                    <div key={it.id || it.name}>
                      {showGroup && (
                        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">
                          {it.category}
                        </p>
                      )}
                      <button
                        type="button"
                        data-index={i}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => pick(it)}
                        onMouseMove={() => setActive(i)}
                        className={`relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId={reduce ? undefined : 'pg-finder-active'}
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#DCF87C]"
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          />
                        )}
                        <span className={`text-sm ${isActive ? 'text-white' : 'text-white/75'}`}>{it.name}</span>
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-[11px] text-white/30">
                <span className="flex items-center gap-1.5">
                  <Kbd>up</Kbd>
                  <Kbd>down</Kbd>
                  <Kbd>enter</Kbd>
                  jump
                </span>
                <button
                  type="button"
                  onClick={surprise}
                  className="rounded-full border border-white/12 px-2.5 py-1 font-medium text-white/55 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
                >
                  Surprise me
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 font-medium text-white/40">
      {children}
    </kbd>
  )
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-white/40"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  )
}
