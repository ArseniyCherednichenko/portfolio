import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Rope: a length of cord strung between two pins, hanging in a catenary, that
// you can grab anywhere along its span and whip. The library already has two
// hand-rolled soft bodies — the Cloth (a 2D sheet) and, next door, the
// Catenary, which *draws* the ideal hanging-chain curve as pure maths. This is
// the third kind: not a sheet and not a drawn curve but the live, one-
// dimensional physical thing — a chain of point masses that happens to settle
// into exactly that catenary on its own, and swings away from it the instant
// you touch it.
//
// It is Verlet, like the Cloth: each node remembers only where it was last
// frame, velocity is read as the gap between then and now, and the links are
// distance constraints relaxed over many passes each frame. A rope barely
// stretches, so the pass count is high and the solve runs taut — pull the
// middle down and the slack is drawn evenly from both shoulders rather than
// one link ballooning. Both ends are pinned; grab a node and it rides the
// pointer while the rest of the cord lashes and trails, and the throw you were
// making when you let go is carried into the swing because the grabbed node
// keeps its last position as its velocity. A slow ambient breeze keeps it
// breathing at rest.
//
// One <canvas>, one RAF loop, DPR-aware and ResizeObserver-driven, with no
// React state on the hot path — the nodes live in a ref-held array and dt is
// fixed per substep so the solve is frame-rate independent and a backgrounded
// tab can never fling it apart. Purely decorative (aria-hidden). Under reduced
// motion the loop never starts: the cord is relaxed once into its resting
// catenary and simply redrawn on resize.

interface Node {
  x: number
  y: number
  /** Previous position — Verlet reads velocity as (x - px). */
  px: number
  py: number
  pinX: number
  pinY: number
  /** Held fast to its anchor (the two ends). */
  pinned: boolean
  /** Currently carried by the pointer. */
  grab: boolean
  /** Latest frame speed, for the glow; px moved since last step. */
  v: number
}

interface Link {
  a: Node
  b: Node
  rest: number
}

const GRAVITY = 1200 // px/s^2, the sag
const DAMP = 0.992 // velocity retained per step — a touch of air drag
const CONSTRAINT_PASSES = 28 // high: a rope resists stretch, so the solve runs taut
const MAX_DPR = 2
const TARGET_SPACING = 20 // px between nodes along the cord
const SAG = 1.42 // rope length as a multiple of the anchor span → how deep it hangs
const ANCHOR_INSET = 0.12 // anchors sit this far in from each edge
const ANCHOR_TOP = 0.22 // …and this far down from the top
const GRAB_R = 46 // px: how near the pointer must come to take hold of the cord
const FIXED_DT = 1 / 60

export function Rope({
  accent = '220,248,124', // lime, as "r,g,b"
  className = '',
}: {
  /** Accent colour as an "r,g,b" string, matched to the host panel. */
  accent?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0
    let H = 0
    let dpr = 1
    let raf = 0
    let last = 0
    let acc = 0 // fixed-step accumulator
    let elapsed = 0 // seconds, for the ambient breeze phase
    let windOn = true // suppressed while settling into the resting catenary
    let nodes: Node[] = []
    let links: Link[] = []

    // Pointer state, sampled in local canvas space. `near` is the nearest node
    // within reach when nothing is held yet — drawn as a faint grab cue.
    const pointer = { x: 0, y: 0, active: false, down: false, near: -1 }

    function build() {
      const ax = Math.max(8, W * ANCHOR_INSET)
      const span = W - ax * 2
      const top = Math.max(8, H * ANCHOR_TOP)
      const ropeLen = span * SAG
      const count = Math.max(16, Math.round(ropeLen / TARGET_SPACING))
      const rest = ropeLen / count
      nodes = []
      links = []
      // Start the cord strung dead straight between the two pins; the solver
      // relaxes it into its sag before the first paint, so it never drops in.
      for (let i = 0; i <= count; i++) {
        const t = i / count
        const x = ax + span * t
        const y = top
        const pinned = i === 0 || i === count
        nodes.push({ x, y, px: x, py: y, pinX: x, pinY: y, pinned, grab: false, v: 0 })
      }
      for (let i = 0; i < count; i++) {
        links.push({ a: nodes[i], b: nodes[i + 1], rest })
      }
    }

    function measure() {
      const rect = wrap!.getBoundingClientRect()
      W = rect.width
      H = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas!.width = Math.round(W * dpr)
      canvas!.height = Math.round(H * dpr)
      canvas!.style.width = `${W}px`
      canvas!.style.height = `${H}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function integrate(dt: number) {
      // A slow, wide gust whose phase drifts along the cord, so a travelling
      // wave ripples through it rather than the whole thing shoving at once.
      const gust = windOn ? Math.sin(elapsed * 0.8) * 16 + Math.sin(elapsed * 2.1 + 0.7) * 8 : 0
      for (const n of nodes) {
        if (n.pinned) {
          n.x = n.pinX
          n.y = n.pinY
          n.v = 0
          continue
        }
        if (n.grab) {
          // Ride the pointer, but keep last position so the throw is carried
          // into the swing the moment the node is let go.
          const dx = pointer.x - n.x
          const dy = pointer.y - n.y
          n.px = n.x
          n.py = n.y
          n.x = pointer.x
          n.y = pointer.y
          n.v = Math.sqrt(dx * dx + dy * dy)
          continue
        }
        const vx = (n.x - n.px) * DAMP
        const vy = (n.y - n.py) * DAMP
        n.px = n.x
        n.py = n.y
        const phase = Math.sin(elapsed * 1.5 + n.x * 0.02)
        const wind = gust * (0.6 + 0.4 * phase)
        n.x += vx + wind * dt * dt * 60
        n.y += vy + GRAVITY * dt * dt
        n.v = Math.sqrt(vx * vx + vy * vy)
      }
    }

    function solve() {
      for (let pass = 0; pass < CONSTRAINT_PASSES; pass++) {
        for (const l of links) {
          const a = l.a
          const b = l.b
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d = Math.sqrt(dx * dx + dy * dy) || 1e-6
          const diff = ((d - l.rest) / d) * 0.5
          const ox = dx * diff
          const oy = dy * diff
          // A pinned or grabbed node is immovable, so its neighbour takes the
          // whole correction — that is what makes the cord follow the hand.
          const aFixed = a.pinned || a.grab
          const bFixed = b.pinned || b.grab
          if (aFixed && bFixed) continue
          if (!aFixed && !bFixed) {
            a.x += ox
            a.y += oy
            b.x -= ox
            b.y -= oy
          } else if (aFixed) {
            b.x -= ox * 2
            b.y -= oy * 2
          } else {
            a.x += ox * 2
            a.y += oy * 2
          }
        }
      }
    }

    function step(dt: number) {
      elapsed += dt
      integrate(dt)
      solve()
    }

    // Nearest free node to the pointer, and the distance to it, for grabbing
    // and for the hover cue.
    function nearest(x: number, y: number) {
      let best = -1
      let bestD = Infinity
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.pinned) continue
        const dx = n.x - x
        const dy = n.y - y
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return { index: best, dist: Math.sqrt(bestD) }
    }

    function paint() {
      ctx!.clearRect(0, 0, W, H)
      if (nodes.length < 2) return

      // How lively the cord is right now, for the glow — the fastest-moving
      // node drives it, so a whip flares and a resting cord barely glimmers.
      let vmax = 0
      for (const n of nodes) if (n.v > vmax) vmax = n.v
      const heat = Math.min(1, vmax / 16)

      // Build one smooth path through the nodes using quadratic segments that
      // pass through each midpoint — a cord, not a dot-to-dot polyline.
      const trace = () => {
        ctx!.beginPath()
        ctx!.moveTo(nodes[0].x, nodes[0].y)
        for (let i = 1; i < nodes.length - 1; i++) {
          const mx = (nodes[i].x + nodes[i + 1].x) * 0.5
          const my = (nodes[i].y + nodes[i + 1].y) * 0.5
          ctx!.quadraticCurveTo(nodes[i].x, nodes[i].y, mx, my)
        }
        const n = nodes[nodes.length - 1]
        ctx!.lineTo(n.x, n.y)
      }

      ctx!.lineJoin = 'round'
      ctx!.lineCap = 'round'

      // Soft underglow — wider and blurred, brightening with the cord's motion.
      ctx!.save()
      ctx!.shadowColor = `rgba(${accent},${0.5 + heat * 0.4})`
      ctx!.shadowBlur = 10 + heat * 26
      ctx!.strokeStyle = `rgba(${accent},${0.1 + heat * 0.22})`
      ctx!.lineWidth = 8
      trace()
      ctx!.stroke()
      ctx!.restore()

      // Bright core — lerps from a cool off-white at rest toward full lime as it
      // moves, so the cord reads as catching light when it swings.
      const r = Math.round(210 + 10 * (1 - heat))
      const g = Math.round(220 + 28 * heat)
      const b = Math.round(160 - 36 * heat)
      ctx!.strokeStyle = `rgba(${r},${g},${b},0.95)`
      ctx!.lineWidth = 2.4
      trace()
      ctx!.stroke()

      // Pins at the two ends: a dark stud ringed in lime, so the cord reads as
      // hung from something rather than floating.
      for (const n of nodes) {
        if (!n.pinned) continue
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, 5, 0, Math.PI * 2)
        ctx!.fillStyle = '#0A0A0A'
        ctx!.fill()
        ctx!.lineWidth = 2
        ctx!.strokeStyle = `rgba(${accent},0.9)`
        ctx!.stroke()
      }

      // Grab / hover cue: a ring on the node under the pointer, filled while held.
      const cue = pointer.down ? nodes.findIndex((n) => n.grab) : pointer.near
      if (cue >= 0 && pointer.active) {
        const n = nodes[cue]
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, pointer.down ? 7 : 6, 0, Math.PI * 2)
        if (pointer.down) {
          ctx!.fillStyle = `rgba(${accent},0.95)`
          ctx!.fill()
        } else {
          ctx!.lineWidth = 2
          ctx!.strokeStyle = `rgba(${accent},0.7)`
          ctx!.stroke()
        }
      }
    }

    function frame(t: number) {
      if (!last) last = t
      let dt = (t - last) / 1000
      last = t
      if (dt > 0.25) dt = 0.25 // a long tab-out settles in one clamped chunk
      acc += dt
      let guard = 0
      while (acc >= FIXED_DT && guard < 5) {
        step(FIXED_DT)
        acc -= FIXED_DT
        guard++
      }
      if (guard === 5) acc = 0 // never spiral if we fell far behind
      // Keep the hover cue current even when the pointer is still.
      if (pointer.active && !pointer.down) {
        const { index, dist } = nearest(pointer.x, pointer.y)
        pointer.near = dist <= GRAB_R ? index : -1
      }
      paint()
      raf = requestAnimationFrame(frame)
    }

    // Relax the cord into its resting catenary by running the solver headless —
    // the first paint and the reduced-motion still both start from the sag.
    function settle(iterations: number) {
      windOn = false
      for (let i = 0; i < iterations; i++) {
        integrate(FIXED_DT)
        solve()
      }
      windOn = true
    }

    function localPoint(e: PointerEvent) {
      const rect = wrap!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function onDown(e: PointerEvent) {
      const p = localPoint(e)
      pointer.x = p.x
      pointer.y = p.y
      pointer.active = true
      const { index, dist } = nearest(p.x, p.y)
      if (index >= 0 && dist <= GRAB_R) {
        pointer.down = true
        nodes[index].grab = true
        canvas!.setPointerCapture?.(e.pointerId)
      }
    }

    function onMove(e: PointerEvent) {
      const p = localPoint(e)
      pointer.x = p.x
      pointer.y = p.y
      pointer.active = true
    }

    function release() {
      pointer.down = false
      for (const n of nodes) n.grab = false
    }

    function onUp(e: PointerEvent) {
      release()
      canvas!.releasePointerCapture?.(e.pointerId)
    }

    function onLeave() {
      pointer.active = false
      pointer.near = -1
      release()
    }

    if (reduce) {
      measure()
      build()
      settle(400)
      paint()
      const roStill = new ResizeObserver(() => {
        measure()
        build()
        settle(400)
        paint()
      })
      roStill.observe(wrap)
      return () => roStill.disconnect()
    }

    measure()
    build()
    settle(80) // open on an already-hung cord, not a straight line snapping down
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => {
      measure()
      build()
      settle(60)
    })
    ro.observe(wrap)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, accent])

  return (
    <div ref={wrapRef} className={`relative touch-none select-none overflow-hidden ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full cursor-grab active:cursor-grabbing" />
    </div>
  )
}
