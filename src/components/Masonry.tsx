import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export interface MasonryItem {
  /** Stable identity — drives the key and the height cache. */
  id: string
  content: ReactNode
}

interface Placement {
  x: number
  y: number
  w: number
}

const SPRING = { type: 'spring', stiffness: 240, damping: 30, mass: 0.9 } as const

/**
 * A measured, animated masonry wall. Distinct from the site's CSS grids: every
 * item is absolutely positioned into the currently-shortest column from its own
 * measured height, so nothing is forced onto a fixed row and content of any
 * height packs tight with no gaps.
 *
 * Column count is derived from the container width and `minColWidth`; a single
 * ResizeObserver watches the container and each item, so a viewport resize (or
 * the column count changing) reflows the whole wall on a spring instead of a
 * hard snap, and each tile lifts in the first time it lands.
 *
 * No per-frame React state on a hot path — layout is a memo over measured
 * heights, recomputed only when a height or the width actually changes. Reduced
 * motion drops the springs and the reveal: the same packed layout, placed
 * instantly.
 */
export function Masonry({
  items,
  minColWidth = 240,
  gap = 20,
  className = '',
}: {
  items: MasonryItem[]
  minColWidth?: number
  gap?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [heights, setHeights] = useState<Record<string, number>>({})

  // Map every observed element back to its item id, both ways, so the observer
  // callback can look up an id and the ref callback can unobserve a stale node.
  const nodeToId = useRef(new Map<Element, string>())
  const idToNode = useRef(new Map<string, Element>())

  // Create the item observer eagerly during render (before ref callbacks fire
  // in commit) so the very first mounted tiles are measured. Guarded for SSR.
  const roRef = useRef<ResizeObserver | null>(null)
  if (roRef.current === null && typeof ResizeObserver !== 'undefined') {
    roRef.current = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let changed = false
        const next = { ...prev }
        for (const entry of entries) {
          const id = nodeToId.current.get(entry.target)
          if (id === undefined) continue
          const h = (entry.target as HTMLElement).offsetHeight
          if (next[id] !== h) {
            next[id] = h
            changed = true
          }
        }
        return changed ? next : prev
      })
    })
  }

  // Track container width with its own observer.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth((prev) => (prev !== w ? w : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const ro = roRef.current
    return () => ro?.disconnect()
  }, [])

  const setItemRef = (id: string) => (node: HTMLDivElement | null) => {
    const ro = roRef.current
    const prev = idToNode.current.get(id)
    if (prev && prev !== node) {
      ro?.unobserve(prev)
      nodeToId.current.delete(prev)
      idToNode.current.delete(id)
    }
    if (node) {
      idToNode.current.set(id, node)
      nodeToId.current.set(node, id)
      ro?.observe(node)
    }
  }

  const { placements, totalHeight } = useMemo(() => {
    if (width <= 0) {
      return { placements: {} as Record<string, Placement>, totalHeight: 0 }
    }
    const cols = Math.max(1, Math.floor((width + gap) / (minColWidth + gap)))
    const colW = (width - gap * (cols - 1)) / cols
    const colHeights = new Array<number>(cols).fill(0)
    const placements: Record<string, Placement> = {}
    for (const item of items) {
      let c = 0
      for (let i = 1; i < cols; i++) {
        if (colHeights[i] < colHeights[c]) c = i
      }
      const x = c * (colW + gap)
      const y = colHeights[c]
      placements[item.id] = { x, y, w: colW }
      const h = heights[item.id] ?? 0
      colHeights[c] = y + h + gap
    }
    const tallest = colHeights.reduce((m, v) => (v > m ? v : m), 0)
    return { placements, totalHeight: Math.max(0, tallest - gap) }
  }, [width, gap, minColWidth, items, heights])

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ height: totalHeight || undefined }}
    >
      {items.map((item, i) => {
        const p = placements[item.id]
        const measured = p !== undefined && heights[item.id] !== undefined
        return (
          <motion.div
            key={item.id}
            ref={setItemRef(item.id)}
            className="absolute left-0 top-0"
            style={{ width: p ? p.w : '100%', willChange: 'transform' }}
            initial={false}
            animate={{
              x: p?.x ?? 0,
              y: p?.y ?? 0,
              opacity: measured ? 1 : 0,
              scale: reduce ? 1 : measured ? 1 : 0.97,
            }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    ...SPRING,
                    opacity: { duration: 0.45, delay: measured ? Math.min(i * 0.035, 0.35) : 0 },
                    scale: { duration: 0.45 },
                  }
            }
          >
            {item.content}
          </motion.div>
        )
      })}
    </div>
  )
}
