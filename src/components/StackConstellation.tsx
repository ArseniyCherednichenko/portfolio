import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { TOOLKIT } from '../data/toolkit'

// A living map of the stack: every tool I reach for, drawn as a node and tethered
// to the discipline it belongs to — languages, interface, backend, craft — so the
// picture is not a flat wall of logos but the shape of how the work actually
// connects. Four group hubs sit on a slow ring; each tool springs to its hub, and
// the whole graph breathes on one requestAnimationFrame loop. Move the pointer and
// the nearest nodes warm toward lime and lean in — the same "fields warm toward
// the cursor" language the rest of the library speaks. No per-node React state,
// DPR-aware, ResizeObserver-driven, and under reduced motion the simulation is
// settled once and painted as a single still frame with no loop and no pointer.

// A tiny seeded PRNG (mulberry32) so the scatter is natural yet identical every
// mount — no Math.random reaching for entropy while the graph is alive.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  /** True for a group hub, false for a tool leaf. */
  hub: boolean
  /** Index into the hub list this node is tethered to. */
  group: number
  label: string
  /** Pointer warmth, eased 0..1. */
  heat: number
  /** Phase offset so idle breathing is out of step across nodes. */
  phase: number
}

const LIME = '220,248,124'

export function StackConstellation({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    let t = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pointer = { x: -9999, y: -9999, active: false }
    const rand = rng(0x51ed270b)

    // Build the graph once from the real toolkit: a hub per discipline, a leaf
    // per tool. Positions are filled in on the first resize.
    const hubs = TOOLKIT.map((g) => g.label)
    const nodes: Node[] = []
    hubs.forEach((label, gi) => {
      nodes.push({ x: 0, y: 0, vx: 0, vy: 0, hub: true, group: gi, label, heat: 0, phase: rand() * Math.PI * 2 })
    })
    TOOLKIT.forEach((g, gi) => {
      g.tools.forEach((tool) => {
        nodes.push({ x: 0, y: 0, vx: 0, vy: 0, hub: false, group: gi, label: tool.name, heat: 0, phase: rand() * Math.PI * 2 })
      })
    })
    const hubOf = (gi: number) => nodes[gi]

    // Rest anchor for each hub: an even share of a slow ring around the centre.
    let cx = 0
    let cy = 0
    let ringR = 0

    function place() {
      hubs.forEach((_, gi) => {
        const a = (gi / hubs.length) * Math.PI * 2 - Math.PI / 2
        const hub = hubOf(gi)
        hub.x = cx + Math.cos(a) * ringR
        hub.y = cy + Math.sin(a) * ringR
        hub.vx = hub.vy = 0
      })
      // Seed leaves in a small scatter around their hub so nothing starts stacked.
      for (const n of nodes) {
        if (n.hub) continue
        const hub = hubOf(n.group)
        const a = rand() * Math.PI * 2
        const r = 26 + rand() * 34
        n.x = hub.x + Math.cos(a) * r
        n.y = hub.y + Math.sin(a) * r
        n.vx = n.vy = 0
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      ringR = Math.max(70, Math.min(w, h) * 0.3)
      place()
    }

    // One integration step. `alive` folds in the idle breathing that a settled
    // still frame leaves out.
    function step(alive: boolean) {
      const restLen = Math.min(88, ringR * 0.62)
      // Hubs ease back to their (gently breathing) ring anchor.
      hubs.forEach((_, gi) => {
        const hub = hubOf(gi)
        const a = (gi / hubs.length) * Math.PI * 2 - Math.PI / 2
        const wob = alive ? Math.sin(t * 0.0006 + hub.phase) * 10 : 0
        const ax = cx + Math.cos(a) * (ringR + wob)
        const ay = cy + Math.sin(a) * (ringR + wob)
        hub.vx += (ax - hub.x) * 0.02
        hub.vy += (ay - hub.y) * 0.02
      })
      // Leaves are tethered to their hub at a rest length (pulled in if too far,
      // pushed out if crowding it).
      for (const n of nodes) {
        if (n.hub) continue
        const hub = hubOf(n.group)
        let dx = n.x - hub.x
        let dy = n.y - hub.y
        const d = Math.hypot(dx, dy) || 0.001
        const f = (d - restLen) * -0.02
        n.vx += (dx / d) * f
        n.vy += (dy / d) * f
        if (alive) {
          // A faint orbital breath so the cluster is never perfectly still.
          n.vx += Math.cos(t * 0.0007 + n.phase) * 0.03
          n.vy += Math.sin(t * 0.0007 + n.phase) * 0.03
        }
      }
      // Soft mutual repulsion so labels and dots keep their distance (n is small).
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          const min = 44
          if (d2 < min * min && d2 > 0.01) {
            const d = Math.sqrt(d2)
            const push = ((min - d) / d) * 0.06
            a.vx += dx * push
            a.vy += dy * push
            b.vx -= dx * push
            b.vy -= dy * push
          }
        }
      }
      // Pointer warmth: nearby nodes lean in and heat up toward lime.
      for (const n of nodes) {
        let target = 0
        if (alive && pointer.active) {
          const dx = pointer.x - n.x
          const dy = pointer.y - n.y
          const dist = Math.hypot(dx, dy)
          const R = 150
          if (dist < R) {
            target = 1 - dist / R
            n.vx += (dx / (dist || 1)) * target * 0.5
            n.vy += (dy / (dist || 1)) * target * 0.5
          }
        }
        n.heat += (target - n.heat) * 0.12
        // Gentle centring so nothing drifts off the box.
        n.vx += (cx - n.x) * 0.0009
        n.vy += (cy - n.y) * 0.0009
        n.vx *= 0.86
        n.vy *= 0.86
        n.x += n.vx
        n.y += n.vy
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.lineCap = 'round'

      // Edges: hub-to-hub ring first (faint), then each leaf to its hub.
      ctx!.lineWidth = 1
      for (let gi = 0; gi < hubs.length; gi++) {
        const a = hubOf(gi)
        const b = hubOf((gi + 1) % hubs.length)
        ctx!.strokeStyle = `rgba(255,255,255,${0.05 + Math.max(a.heat, b.heat) * 0.12})`
        ctx!.beginPath()
        ctx!.moveTo(a.x, a.y)
        ctx!.lineTo(b.x, b.y)
        ctx!.stroke()
      }
      for (const n of nodes) {
        if (n.hub) continue
        const hub = hubOf(n.group)
        const heat = Math.max(n.heat, hub.heat)
        ctx!.strokeStyle =
          heat > 0.2 ? `rgba(${LIME},${0.12 + heat * 0.4})` : `rgba(255,255,255,${0.07 + heat * 0.2})`
        ctx!.beginPath()
        ctx!.moveTo(hub.x, hub.y)
        ctx!.lineTo(n.x, n.y)
        ctx!.stroke()
      }

      // Nodes and labels.
      ctx!.textBaseline = 'middle'
      for (const n of nodes) {
        const heat = n.heat
        if (n.hub) {
          const r = 4.5 + heat * 2
          const glow = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3)
          glow.addColorStop(0, `rgba(${LIME},${0.5 + heat * 0.4})`)
          glow.addColorStop(1, `rgba(${LIME},0)`)
          ctx!.fillStyle = glow
          ctx!.beginPath()
          ctx!.arc(n.x, n.y, r * 3, 0, Math.PI * 2)
          ctx!.fill()
          ctx!.fillStyle = `rgba(${LIME},0.95)`
          ctx!.beginPath()
          ctx!.arc(n.x, n.y, r, 0, Math.PI * 2)
          ctx!.fill()
          ctx!.font =
            '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
          ctx!.fillStyle = `rgba(${LIME},0.9)`
          ctx!.textAlign = 'center'
          ctx!.fillText(n.label, n.x, n.y - r - 9)
        } else {
          const r = 2.6 + heat * 1.6
          ctx!.fillStyle = heat > 0.2 ? `rgba(${LIME},${0.7 + heat * 0.3})` : 'rgba(255,255,255,0.55)'
          ctx!.beginPath()
          ctx!.arc(n.x, n.y, r, 0, Math.PI * 2)
          ctx!.fill()
          ctx!.font =
            '500 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
          ctx!.fillStyle =
            heat > 0.15 ? `rgba(${LIME},${0.55 + heat * 0.45})` : `rgba(255,255,255,${0.34 + heat * 0.4})`
          ctx!.textAlign = 'left'
          ctx!.fillText(n.label, n.x + r + 5, n.y)
        }
      }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    resize()

    if (reduce) {
      // No loop: settle the graph with a burst of quiet steps, then paint once.
      const settle = () => {
        for (let i = 0; i < 260; i++) step(false)
        draw()
      }
      settle()
      const ro = new ResizeObserver(() => {
        resize()
        settle()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Warm-start so the graph opens already formed rather than snapping together.
    for (let i = 0; i < 120; i++) step(false)

    function frame(now: number) {
      t = now
      step(true)
      draw()
      raf = requestAnimationFrame(frame)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
