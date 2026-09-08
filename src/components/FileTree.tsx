import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useMemo, useRef, useState } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

/** One node in the tree. A directory carries `children`; a file is a leaf.
 *  `note` is an honest one-line aside shown dim on the right; `count` badges a
 *  directory whose children are summarised rather than fully listed. */
export interface FileNode {
  name: string
  kind: 'dir' | 'file'
  note?: string
  count?: number
  children?: FileNode[]
}

// A stable path id for a node, so open-state and focus survive re-renders
// without leaning on array indices (which shift when a branch collapses).
type Flat = { node: FileNode; path: string; depth: number; parent: string | null }

// Walk the tree in visible (depth-first) order, honouring which directories are
// currently open. Only rows the user can actually see end up here, which is
// exactly the set the roving tabindex and the arrow keys move across.
function flatten(nodes: FileNode[], open: Set<string>): Flat[] {
  const out: Flat[] = []
  const walk = (list: FileNode[], depth: number, prefix: string, parent: string | null) => {
    list.forEach((node) => {
      const path = `${prefix}/${node.name}`
      out.push({ node, path, depth, parent })
      if (node.kind === 'dir' && node.children && open.has(path)) {
        walk(node.children, depth + 1, path, path)
      }
    })
  }
  walk(nodes, 0, '', null)
  return out
}

// The set of directory paths open on first paint: everything at the top level
// plus anything the caller flags. Deeper branches stay closed so the tree opens
// tidy and invites a click rather than dumping the whole repo at once.
function initialOpen(nodes: FileNode[]): Set<string> {
  const open = new Set<string>()
  nodes.forEach((n) => {
    if (n.kind === 'dir') open.add(`/${n.name}`)
  })
  return open
}

function Chevron({ open, reduce }: { open: boolean; reduce: boolean }) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-white/40"
      initial={false}
      animate={{ rotate: open ? 90 : 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE }}
    >
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  )
}

/**
 * An accessible, collapsible file tree. Built for the Colophon so the repository
 * itself can be browsed as a small proof of "made, not assembled" — every node
 * here names something that genuinely exists in `src/`.
 *
 * A real `role="tree"`: one roving tab stop, arrow keys walk the visible rows
 * (Right opens a closed dir or steps into it, Left closes an open one or steps
 * out to its parent, Up/Down move, Home/End jump), Enter/Space toggles a
 * directory. Each row carries `aria-level`, `aria-setsize`, `aria-posinset`, and
 * directories carry `aria-expanded`. Under reduced motion the chevron and the
 * branch reveal drop to instant swaps.
 */
export function FileTree({
  nodes,
  className = '',
  label = 'File tree',
}: {
  nodes: FileNode[]
  className?: string
  label?: string
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<Set<string>>(() => initialOpen(nodes))
  const [focused, setFocused] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const rows = useMemo(() => flatten(nodes, open), [nodes, open])
  // Sibling counts per parent, for aria-setsize / aria-posinset.
  const siblings = useMemo(() => {
    const map = new Map<string | null, Flat[]>()
    rows.forEach((r) => {
      const arr = map.get(r.parent) ?? []
      arr.push(r)
      map.set(r.parent, arr)
    })
    return map
  }, [rows])

  // The row that owns the single tab stop: whatever is focused, else the first.
  const tabPath = focused && rows.some((r) => r.path === focused) ? focused : rows[0]?.path ?? null

  const toggle = useCallback((path: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const focus = useCallback((path: string | null) => {
    if (!path) return
    setFocused(path)
    // Let React commit the roving tabindex before we move the DOM focus.
    requestAnimationFrame(() => rowRefs.current.get(path)?.focus())
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, flat: Flat) => {
      const i = rows.findIndex((r) => r.path === flat.path)
      if (i < 0) return
      const { node, path, parent } = flat
      const isOpen = open.has(path)
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          focus(rows[Math.min(i + 1, rows.length - 1)]?.path ?? null)
          break
        case 'ArrowUp':
          e.preventDefault()
          focus(rows[Math.max(i - 1, 0)]?.path ?? null)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (node.kind === 'dir' && node.children?.length) {
            if (!isOpen) toggle(path)
            else focus(rows[i + 1]?.path ?? null)
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (node.kind === 'dir' && isOpen) toggle(path)
          else if (parent) focus(parent)
          break
        case 'Enter':
        case ' ':
          if (node.kind === 'dir' && node.children?.length) {
            e.preventDefault()
            toggle(path)
          }
          break
        case 'Home':
          e.preventDefault()
          focus(rows[0]?.path ?? null)
          break
        case 'End':
          e.preventDefault()
          focus(rows[rows.length - 1]?.path ?? null)
          break
      }
    },
    [rows, open, toggle, focus],
  )

  return (
    <div
      role="tree"
      aria-label={label}
      className={`overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2 font-mono text-sm sm:p-3 ${className}`}
    >
      <AnimatePresence initial={false}>
        {rows.map((flat) => {
          const { node, path, depth } = flat
          const isOpen = open.has(path)
          const isDir = node.kind === 'dir'
          const group = siblings.get(flat.parent) ?? []
          const posinset = group.findIndex((g) => g.path === path) + 1
          return (
            <motion.div
              key={path}
              ref={(el: HTMLDivElement | null) => {
                if (el) rowRefs.current.set(path, el)
                else rowRefs.current.delete(path)
              }}
              layout={reduce ? false : 'position'}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: EASE }}
              role="treeitem"
              aria-level={depth + 1}
              aria-setsize={group.length}
              aria-posinset={posinset}
              aria-expanded={isDir ? isOpen : undefined}
              tabIndex={path === tabPath ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, flat)}
              onClick={(e) => {
                e.stopPropagation()
                focus(path)
                if (isDir && node.children?.length) toggle(path)
              }}
              className="group/row flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-2 outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
              style={{ paddingLeft: `${0.5 + depth * 1.15}rem` }}
            >
              {isDir && node.children?.length ? (
                <Chevron open={isOpen} reduce={!!reduce} />
              ) : (
                <span aria-hidden className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <span className="h-1 w-1 rounded-full bg-white/30" />
                </span>
              )}

              <span
                className={`truncate ${
                  isDir ? 'font-semibold text-[#DCF87C]/90' : 'text-white/60'
                } group-hover/row:text-white`}
              >
                {node.name}
                {isDir && <span className="text-[#DCF87C]/40">/</span>}
              </span>

              {typeof node.count === 'number' && (
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-white/45">
                  {node.count}
                </span>
              )}

              {node.note && (
                <span className="ml-auto hidden truncate pl-4 text-right text-xs font-sans text-white/35 sm:block">
                  {node.note}
                </span>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
