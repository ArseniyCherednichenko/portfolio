import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'

// SiteGraph — the whole site drawn as a living constellation.
//
// The site had a flat index (/contents) and a spun sphere of links (SphereMenu),
// but nothing that showed the *shape* of it: how the pages cluster into sections
// around one centre. This is a force-directed graph — a real physics layout, not
// a decoration bolted onto one. A central node anchors the middle; each section
// is a hub on a ring; each page is a leaf orbiting its hub. Every node repels
// every other (inverse-square), springs pull the edges toward a rest length, a
// weak gravity keeps the whole thing centred, and a tiny per-node ambient sway
// keeps the sky breathing after it settles. Grab any node and drag it — the rest
// re-solve around it and it reheats the sim; let go and it eases back into place.
//
// The point it makes is the site's own thesis, stated structurally: one project
// is a single star among many. Guided is a leaf, not the centre.
//
// No React state on the physics hot path — positions live in refs and the rAF
// loop writes transforms straight onto the DOM (node wrappers) and coordinates
// onto the SVG edge lines. Only the hover/focus highlight is React state, which
// changes at most once per pointer move over a node. Under reduced motion the
// solver runs headless to a settled layout, then the sky is drawn once and held
// still — hover still lights a cluster (pure CSS), and dragging is disabled.

export interface GraphLeaf {
  to: string
  title: string
  blurb: string
}

export interface GraphSection {
  label: string
  intro: string
  leaves: GraphLeaf[]
}

export interface SiteGraphProps {
  /** The sections and their pages, mapped from the site's real contents. */
  sections: GraphSection[]
  /** The centre node's label (a mark or short name). */
  rootLabel?: string
  /** One line describing the centre, shown when it is focused. */
  rootBlurb?: string
  className?: string
}

type Kind = 'root' | 'hub' | 'leaf'

interface GNode {
  id: string
  kind: Kind
  label: string
  blurb?: string
  to?: string
  /** For a leaf: the id of its hub. For a hub: its own id. */
  cluster: string
  charge: number
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  fixed: boolean
}

interface GEdge {
  a: number
  b: number
  rest: number
}

// A small deterministic PRNG so every mount lays the same opening sky — lively
// but not random frame to frame.
function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function SiteGraph({
  sections,
  rootLabel = 'AC',
  rootBlurb = 'The whole site, one centre. Every section radiates from here.',
  className = '',
}: SiteGraphProps) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const nodeElRefs = useRef<(HTMLElement | null)[]>([])
  const lineElRefs = useRef<(SVGLineElement | null)[]>([])
  const nodesRef = useRef<GNode[]>([])
  const edgesRef = useRef<GEdge[]>([])
  const sizeRef = useRef({ w: 0, h: 0 })
  const rafRef = useRef<number | null>(null)
  const alphaRef = useRef(1)
  const dragRef = useRef<{ i: number; moved: boolean; px: number; py: number } | null>(null)
  const movedRecentlyRef = useRef(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [active, setActive] = useState<string | null>(null)

  // Build the graph model once from the sections. Root → hubs → leaves.
  const { nodes, edges } = useMemo(() => {
    const ns: GNode[] = []
    const es: GEdge[] = []
    ns.push({
      id: 'root',
      kind: 'root',
      label: rootLabel,
      blurb: rootBlurb,
      cluster: 'root',
      charge: 3.2,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      phase: 0,
      fixed: true,
    })
    sections.forEach((s, si) => {
      const hubId = `hub-${si}`
      ns.push({
        id: hubId,
        kind: 'hub',
        label: s.label,
        blurb: s.intro,
        cluster: hubId,
        charge: 1.7,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        phase: si * 1.3,
        fixed: false,
      })
      const hubIndex = ns.length - 1
      es.push({ a: 0, b: hubIndex, rest: 1 })
      s.leaves.forEach((leaf, li) => {
        ns.push({
          id: `${hubId}-leaf-${li}`,
          kind: 'leaf',
          label: leaf.title,
          blurb: leaf.blurb,
          to: leaf.to,
          cluster: hubId,
          charge: 0.7,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          phase: si * 1.3 + li * 0.7,
          fixed: false,
        })
        es.push({ a: hubIndex, b: ns.length - 1, rest: 1 })
      })
    })
    return { nodes: ns, edges: es }
  }, [sections, rootLabel, rootBlurb])

  nodesRef.current = nodes
  edgesRef.current = edges

  // Which nodes / edges are lit for the current focus, and a lookup for dimming.
  const { litNodes, litEdges } = useMemo(() => {
    const litN = new Set<string>()
    const litE = new Set<number>()
    if (!active) return { litNodes: null as Set<string> | null, litEdges: litE }
    const node = nodes.find((n) => n.id === active)
    if (!node) return { litNodes: null as Set<string> | null, litEdges: litE }
    if (node.kind === 'root') {
      nodes.forEach((n) => {
        if (n.kind !== 'leaf') litN.add(n.id)
      })
      edges.forEach((e, ei) => {
        if (nodes[e.a].kind === 'root' || nodes[e.b].kind === 'root') litE.add(ei)
      })
    } else if (node.kind === 'hub') {
      litN.add(node.id)
      litN.add('root')
      nodes.forEach((n) => {
        if (n.kind === 'leaf' && n.cluster === node.id) litN.add(n.id)
      })
      edges.forEach((e, ei) => {
        if (nodes[e.a].id === node.id || nodes[e.b].id === node.id) litE.add(ei)
        if (
          (nodes[e.a].id === 'root' && nodes[e.b].id === node.id) ||
          (nodes[e.b].id === 'root' && nodes[e.a].id === node.id)
        )
          litE.add(ei)
      })
    } else {
      litN.add(node.id)
      litN.add(node.cluster)
      edges.forEach((e, ei) => {
        if (nodes[e.a].id === node.id || nodes[e.b].id === node.id) litE.add(ei)
      })
    }
    return { litNodes: litN, litEdges: litE }
  }, [active, nodes, edges])

  const activeNode = active ? nodes.find((n) => n.id === active) ?? null : null

  // Seed the opening layout for a given size: root centred, hubs on a ring,
  // leaves scattered near their hub. Deterministic.
  const seedLayout = useCallback(
    (w: number, h: number) => {
      const ns = nodesRef.current
      const rand = mulberry32(0x9e3779b9)
      const cx = w / 2
      const cy = h / 2
      const S = Math.min(w, h)
      const ring = S * 0.34
      const hubs = ns.filter((n) => n.kind === 'hub')
      ns.forEach((n) => {
        if (n.kind === 'root') {
          n.x = cx
          n.y = cy
        } else if (n.kind === 'hub') {
          const hi = hubs.indexOf(n)
          const a = (hi / hubs.length) * Math.PI * 2 - Math.PI / 2
          n.x = cx + Math.cos(a) * ring
          n.y = cy + Math.sin(a) * ring
        }
        n.vx = 0
        n.vy = 0
      })
      // leaves near their hub
      ns.forEach((n) => {
        if (n.kind !== 'leaf') return
        const hub = ns.find((m) => m.id === n.cluster)!
        const a = rand() * Math.PI * 2
        const r = S * 0.08 + rand() * S * 0.06
        n.x = hub.x + Math.cos(a) * r
        n.y = hub.y + Math.sin(a) * r
      })
      // rest lengths scale with size
      edgesRef.current.forEach((e) => {
        const ka = ns[e.a].kind
        const kb = ns[e.b].kind
        const isRoot = ka === 'root' || kb === 'root'
        e.rest = isRoot ? S * 0.3 : S * 0.11
      })
    },
    [],
  )

  // One physics step. dt is a fixed unit; constants are tuned against it.
  const step = useCallback(
    (t: number) => {
      const ns = nodesRef.current
      const es = edgesRef.current
      const { w, h } = sizeRef.current
      if (!w || !h) return
      const n = ns.length
      const S = Math.min(w, h)
      const REP = S * S * 0.9
      const STIFF = 0.045
      const GRAV = 0.006
      const DAMP = 0.82
      const AMB = reduce ? 0 : S * 0.00035
      const cx = w / 2
      const cy = h / 2
      const drag = dragRef.current
      const fx = new Float32Array(n)
      const fy = new Float32Array(n)

      // Pairwise repulsion, charge-weighted.
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = ns[i].x - ns[j].x
          let dy = ns[i].y - ns[j].y
          let d2 = dx * dx + dy * dy
          if (d2 < 1) d2 = 1
          const d = Math.sqrt(d2)
          const f = (REP * ns[i].charge * ns[j].charge) / d2
          const ux = dx / d
          const uy = dy / d
          fx[i] += f * ux
          fy[i] += f * uy
          fx[j] -= f * ux
          fy[j] -= f * uy
        }
      }

      // Edge springs pull toward rest length.
      for (let k = 0; k < es.length; k++) {
        const e = es[k]
        const a = e.a
        const b = e.b
        let dx = ns[b].x - ns[a].x
        let dy = ns[b].y - ns[a].y
        let d = Math.sqrt(dx * dx + dy * dy)
        if (d < 0.001) d = 0.001
        const diff = d - e.rest
        const f = STIFF * diff
        const ux = dx / d
        const uy = dy / d
        fx[a] += f * ux
        fy[a] += f * uy
        fx[b] -= f * ux
        fy[b] -= f * uy
      }

      // Weak centering + gentle ambient sway.
      for (let i = 0; i < n; i++) {
        fx[i] += (cx - ns[i].x) * GRAV
        fy[i] += (cy - ns[i].y) * GRAV
        if (AMB && ns[i].kind !== 'root') {
          fx[i] += Math.sin(t * 0.0006 + ns[i].phase) * AMB
          fy[i] += Math.cos(t * 0.0005 + ns[i].phase * 1.3) * AMB
        }
      }

      const alpha = alphaRef.current
      const pad = 26
      for (let i = 0; i < n; i++) {
        const node = ns[i]
        if (node.fixed) {
          node.x = cx
          node.y = cy
          continue
        }
        if (drag && drag.i === i) continue // dragged node is driven by the pointer
        node.vx = (node.vx + fx[i] * 0.02) * DAMP
        node.vy = (node.vy + fy[i] * 0.02) * DAMP
        node.x += node.vx * (0.35 + alpha)
        node.y += node.vy * (0.35 + alpha)
        if (node.x < pad) {
          node.x = pad
          node.vx *= -0.4
        } else if (node.x > w - pad) {
          node.x = w - pad
          node.vx *= -0.4
        }
        if (node.y < pad) {
          node.y = pad
          node.vy *= -0.4
        } else if (node.y > h - pad) {
          node.y = h - pad
          node.vy *= -0.4
        }
      }
      // cool down but never fully die (so ambient sway + drag reheat stay live)
      alphaRef.current = Math.max(0.02, alpha * 0.985)
    },
    [reduce],
  )

  // Write the current positions onto the DOM (node transforms + edge lines).
  const paint = useCallback(() => {
    const ns = nodesRef.current
    const els = nodeElRefs.current
    for (let i = 0; i < ns.length; i++) {
      const el = els[i]
      if (el) el.style.transform = `translate3d(${ns[i].x}px, ${ns[i].y}px, 0) translate(-50%, -50%)`
    }
    const es = edgesRef.current
    const lines = lineElRefs.current
    for (let k = 0; k < es.length; k++) {
      const ln = lines[k]
      if (!ln) continue
      const a = ns[es[k].a]
      const b = ns[es[k].b]
      ln.setAttribute('x1', String(a.x))
      ln.setAttribute('y1', String(a.y))
      ln.setAttribute('x2', String(b.x))
      ln.setAttribute('y2', String(b.y))
    }
  }, [])

  // Measure the container and (re)seed / rescale on resize.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      if (!w || !h) return
      const prev = sizeRef.current
      if (!prev.w) {
        sizeRef.current = { w, h }
        seedLayout(w, h)
      } else {
        // rescale existing positions so the map keeps its shape on resize
        const sx = w / prev.w
        const sy = h / prev.h
        nodesRef.current.forEach((nd) => {
          nd.x *= sx
          nd.y *= sy
        })
        sizeRef.current = { w, h }
        edgesRef.current.forEach((e) => {
          const S = Math.min(w, h)
          const isRoot = nodesRef.current[e.a].kind === 'root' || nodesRef.current[e.b].kind === 'root'
          e.rest = isRoot ? S * 0.3 : S * 0.11
        })
      }
      alphaRef.current = 1
      setSize({ w, h })
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [seedLayout])

  // The animation loop (or, under reduced motion, a headless settle + one paint).
  useEffect(() => {
    if (!size.w || !size.h) return
    if (reduce) {
      for (let s = 0; s < 480; s++) step(s * 16)
      paint()
      return
    }
    let last = 0
    const loop = (ts: number) => {
      if (!last) last = ts
      last = ts
      step(ts)
      paint()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [size.w, size.h, reduce, step, paint])

  // Drag handlers (skipped under reduced motion).
  const onPointerDown = (e: React.PointerEvent, i: number) => {
    if (reduce) return
    if (nodes[i].kind === 'root') return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { i, moved: false, px: e.clientX, py: e.clientY }
    movedRecentlyRef.current = false
    alphaRef.current = Math.max(alphaRef.current, 0.7)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const nx = e.clientX - rect.left
    const ny = e.clientY - rect.top
    const node = nodesRef.current[drag.i]
    node.x = Math.max(20, Math.min(rect.width - 20, nx))
    node.y = Math.max(20, Math.min(rect.height - 20, ny))
    node.vx = 0
    node.vy = 0
    if (Math.abs(e.clientX - drag.px) + Math.abs(e.clientY - drag.py) > 5) {
      drag.moved = true
      movedRecentlyRef.current = true
    }
    alphaRef.current = Math.max(alphaRef.current, 0.6)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* pointer may already be released */
    }
    dragRef.current = null
    // let the click guard see the drag, then clear it
    window.setTimeout(() => {
      movedRecentlyRef.current = false
    }, 0)
  }
  // Suppress the navigation click that follows a drag on a leaf link.
  const guardClick = (e: React.MouseEvent) => {
    if (movedRecentlyRef.current) {
      e.preventDefault()
    }
  }

  const nodeState = (id: string) => {
    if (!litNodes) return 'rest'
    if (litNodes.has(id)) return 'lit'
    return 'dim'
  }

  return (
    <div className={className}>
      <div
        ref={wrapRef}
        onPointerMove={onPointerMove}
        className="relative h-[68vh] min-h-[460px] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0d]"
        style={{
          backgroundImage:
            'radial-gradient(120% 90% at 50% 40%, rgba(220,248,124,0.05), transparent 60%)',
        }}
        role="group"
        aria-label="Interactive map of the site — sections and pages as a constellation"
      >
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          {edges.map((_edge, ei) => {
            const lit = litEdges.has(ei)
            const dim = litNodes && !lit
            return (
              <line
                key={ei}
                ref={(el) => {
                  lineElRefs.current[ei] = el
                }}
                stroke={lit ? 'rgba(220,248,124,0.55)' : 'rgba(255,255,255,0.10)'}
                strokeWidth={lit ? 1.4 : 1}
                style={{
                  opacity: dim ? 0.25 : 1,
                  transition: 'stroke 0.3s ease, opacity 0.3s ease',
                }}
              />
            )
          })}
        </svg>

        {nodes.map((n, i) => {
          const st = nodeState(n.id)
          const common =
            'absolute left-0 top-0 select-none will-change-transform ' +
            (st === 'dim' ? 'opacity-40 ' : 'opacity-100 ') +
            'transition-opacity duration-300'
          if (n.kind === 'root') {
            return (
              <div
                key={n.id}
                ref={(el) => {
                  nodeElRefs.current[i] = el
                }}
                className={common + ' z-20'}
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive((a) => (a === n.id ? null : a))}
              >
                <div className="flex flex-col items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[#DCF87C] font-display text-lg font-bold tracking-tight text-[#0A0A0A] shadow-[0_0_28px_rgba(220,248,124,0.4)]">
                    {n.label}
                  </span>
                </div>
              </div>
            )
          }
          if (n.kind === 'hub') {
            return (
              <button
                key={n.id}
                ref={(el) => {
                  nodeElRefs.current[i] = el
                }}
                type="button"
                className={common + ' z-10 cursor-grab active:cursor-grabbing'}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerUp={onPointerUp}
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive((a) => (a === n.id ? null : a))}
                onFocus={() => setActive(n.id)}
                onBlur={() => setActive((a) => (a === n.id ? null : a))}
                aria-label={`${n.label} — section, ${
                  sections.find((s) => s.label === n.label)?.leaves.length ?? 0
                } pages`}
              >
                <span
                  className={
                    'flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-display text-[13px] font-semibold uppercase tracking-[0.14em] transition-colors ' +
                    (st === 'lit'
                      ? 'border-[#DCF87C]/60 bg-[#DCF87C]/10 text-[#DCF87C]'
                      : 'border-white/15 bg-white/[0.04] text-white/85')
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#DCF87C]" />
                  {n.label}
                </span>
              </button>
            )
          }
          // leaf — a real link, with a label that appears when its cluster is lit
          const showLabel = st === 'lit'
          return (
            <Link
              key={n.id}
              to={n.to!}
              ref={(el) => {
                nodeElRefs.current[i] = el as unknown as HTMLElement
              }}
              className={common + ' z-10 flex items-center gap-2 cursor-grab active:cursor-grabbing'}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerUp={onPointerUp}
              onClick={guardClick}
              onMouseEnter={() => setActive(n.id)}
              onMouseLeave={() => setActive((a) => (a === n.id ? null : a))}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive((a) => (a === n.id ? null : a))}
              aria-label={`${n.label} — ${n.blurb}`}
            >
              <span
                className={
                  'block rounded-full transition-all duration-300 ' +
                  (st === 'lit'
                    ? 'h-3 w-3 bg-[#DCF87C] shadow-[0_0_14px_rgba(220,248,124,0.7)]'
                    : 'h-2 w-2 bg-white/55')
                }
              />
              <span
                className={
                  'whitespace-nowrap text-[13px] font-medium transition-all duration-300 ' +
                  (showLabel ? 'text-white opacity-100' : 'pointer-events-none -translate-x-1 opacity-0')
                }
              >
                {n.label}
              </span>
            </Link>
          )
        })}

        {/* legend / hint */}
        <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] uppercase tracking-[0.22em] text-white/30">
          {reduce ? 'Hover a star to read it' : 'Hover to read · drag to rearrange'}
        </p>
      </div>

      {/* focus read-out */}
      <div className="mt-4 min-h-[3.5rem]" aria-live="polite">
        {activeNode ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              {activeNode.label}
            </span>
            <span className="text-sm text-white/55">{activeNode.blurb}</span>
            {activeNode.to && (
              <Link
                to={activeNode.to}
                className="text-sm font-medium text-[#DCF87C] underline-offset-4 hover:underline"
              >
                Open -&gt;
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/45">
            A map of every page, clustered by section around one centre. Hover a star to read what
            it is; follow one to open it.
          </p>
        )}
      </div>
    </div>
  )
}
