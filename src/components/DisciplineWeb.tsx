import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Discipline } from '../data/disciplines'

// A relationship web for the /range page: the disciplines as nodes on a ring,
// wired together by the honest structural links already declared in
// disciplines.ts (`related`). It is the visual argument the page makes in
// words — that the range is not five separate skills but one connected way of
// working, where the backend feeds the native app, motion lives inside the
// frontend, and applied AI leans on both the data and the surface.
//
// HONESTY: every edge is a real `related` pair from the data, deduplicated into
// undirected links. Nothing here is invented — the web only draws connections
// the site already claims elsewhere. The per-discipline accent tints its node;
// the house lime stays the site accent.
//
// It is a companion to the keyboard tablist on the page, not a replacement:
// clicking a node selects that discipline (driving the same `active` state), so
// the two controls stay in lockstep. Reduced motion strips the draw-in, the
// dash flow, and the idle pulse, leaving a still, composed diagram.

const EASE = [0.16, 1, 0.3, 1] as const

// Ring geometry in a 0..100 square. Nodes sit on a circle; the first node is at
// the top and the rest step clockwise, so the layout is deterministic for any
// count rather than hand-placed for exactly five.
const CENTER = 50
const RADIUS = 35

interface Node {
  index: number
  d: Discipline
  x: number
  y: number
}

interface Edge {
  a: number
  b: number
  key: string
}

function layout(disciplines: readonly Discipline[]): { nodes: Node[]; edges: Edge[] } {
  const n = disciplines.length
  const idToIndex = new Map(disciplines.map((d, i) => [d.id, i]))
  const nodes: Node[] = disciplines.map((d, i) => {
    // Start at -90deg (top) and walk clockwise.
    const angle = (-90 + (i * 360) / n) * (Math.PI / 180)
    return {
      index: i,
      d,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    }
  })

  // Collapse the directed `related` lists into a unique set of undirected edges,
  // so a frontend->motion and a motion->frontend never draw the same line twice.
  const seen = new Set<string>()
  const edges: Edge[] = []
  disciplines.forEach((d, i) => {
    d.related.forEach((relId) => {
      const j = idToIndex.get(relId)
      if (j === undefined || j === i) return
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (seen.has(key)) return
      seen.add(key)
      edges.push({ a: Math.min(i, j), b: Math.max(i, j), key })
    })
  })
  return { nodes, edges }
}

export function DisciplineWeb({
  disciplines,
  active,
  onSelect,
}: {
  disciplines: readonly Discipline[]
  active: number
  onSelect: (index: number) => void
}) {
  const reduce = useReducedMotion()
  const { nodes, edges } = useMemo(() => layout(disciplines), [disciplines])

  // Which node indices are directly wired to the active one — used to keep the
  // active node's neighbourhood lit while everything else recedes.
  const neighbours = useMemo(() => {
    const set = new Set<number>()
    edges.forEach((e) => {
      if (e.a === active) set.add(e.b)
      if (e.b === active) set.add(e.a)
    })
    return set
  }, [edges, active])

  const activeAccent = disciplines[active]?.accent ?? '#DCF87C'

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-md"
      role="group"
      aria-label="How the disciplines connect"
    >
      {/* Edge layer, beneath the nodes. preserveAspectRatio="none" lets the
          0..100 space stretch to the square box; non-scaling strokes keep line
          weights crisp regardless of the rendered size. */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {edges.map((e, i) => {
          const na = nodes[e.a]
          const nb = nodes[e.b]
          const touchesActive = e.a === active || e.b === active
          return (
            <motion.line
              key={e.key}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={touchesActive ? activeAccent : '#ffffff'}
              strokeWidth={touchesActive ? 1.1 : 0.6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              // Active edges flow with a marching dash toward the node; the rest
              // sit as faint static links. Reduced motion holds them all still.
              strokeDasharray={touchesActive && !reduce ? '3 4' : undefined}
              initial={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: touchesActive ? 0.85 : 0.12,
                strokeDashoffset: touchesActive && !reduce ? [0, -7] : 0,
              }}
              transition={{
                pathLength: { duration: reduce ? 0 : 0.7, ease: EASE, delay: reduce ? 0 : 0.1 + i * 0.05 },
                opacity: { duration: 0.4, ease: EASE },
                strokeDashoffset: reduce
                  ? { duration: 0 }
                  : { duration: 0.9, repeat: Infinity, ease: 'linear' },
              }}
            />
          )
        })}
      </svg>

      {/* Node layer — real, focusable buttons positioned over the edges. */}
      {nodes.map((node) => {
        const isActive = node.index === active
        const isNeighbour = neighbours.has(node.index)
        const dim = !isActive && !isNeighbour
        return (
          <button
            key={node.d.id}
            type="button"
            onClick={() => onSelect(node.index)}
            aria-pressed={isActive}
            aria-label={`${node.d.tag} — ${node.d.lede}`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-2xl px-2 py-1.5 text-center outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              opacity: dim ? 0.45 : 1,
            }}
          >
            {/* The dot. Active swells and glows in its accent; a neighbour keeps
                a coloured rim; a dimmed node is a quiet outline. */}
            <motion.span
              aria-hidden
              className="relative grid h-11 w-11 place-items-center rounded-full border"
              style={{
                borderColor: isActive || isNeighbour ? node.d.accent : 'rgba(255,255,255,0.18)',
                backgroundColor: isActive ? `${node.d.accent}22` : 'rgba(255,255,255,0.03)',
              }}
              animate={
                reduce
                  ? { scale: isActive ? 1.12 : 1 }
                  : {
                      scale: isActive ? [1.12, 1.18, 1.12] : 1,
                    }
              }
              transition={
                reduce
                  ? { duration: 0.3, ease: EASE }
                  : isActive
                    ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.3, ease: EASE }
              }
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: isActive || isNeighbour ? node.d.accent : 'rgba(255,255,255,0.35)',
                  boxShadow: isActive ? `0 0 16px 2px ${node.d.accent}` : 'none',
                }}
              />
            </motion.span>
            <span
              className="max-w-[7rem] text-[0.7rem] font-semibold leading-tight tracking-tight transition-colors sm:text-xs"
              style={{ color: isActive ? '#ffffff' : dim ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)' }}
            >
              {node.d.tag}
            </span>
          </button>
        )
      })}

      {/* Quiet centre mark — the through-line that all the disciplines share. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/25"
      >
        one craft
      </span>
    </div>
  )
}
