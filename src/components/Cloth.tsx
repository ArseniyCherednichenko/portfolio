import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Cloth: a hanging sheet of fabric, pinned along the top and left to sag,
// ripple, and be pushed aside by the pointer. The site already has three
// hand-rolled physics pieces — Gravity (DOM boxes), Ballpit (canvas circles),
// and the Murmuration (boids) — but every one of those is a cloud of separate
// bodies. This is the opposite kind of simulation: a single connected soft
// body. A grid of point masses is integrated with Verlet (position and its
// previous position, no stored velocity) and held together by distance
// constraints relaxed over several passes each frame — the classic way to make
// cloth. So it reads as its own craft: not contact between things, but tension
// within one thing, a surface that folds and swings as a whole.
//
// The top edge is pinned in scallops (every few nodes), so the sheet drapes
// into soft valances like hung bunting rather than a flat curtain. A slow
// ambient breeze keeps it alive with no pointer; the pointer drags the weave
// with it and shoves it open. Drawn as shaded lime quads — each cell darkened
// where the fabric compresses into a fold and lifted where it stretches flat —
// over a faint thread weave, so folds catch the light like real cloth.
//
// One <canvas>, one RAF loop, DPR-aware and ResizeObserver-driven. No React
// state on the hot path — the nodes live in a ref array. dt is fixed per
// substep so the constraint solve stays stable regardless of frame rate, and a
// backgrounded tab can never explode the sheet. Purely decorative (aria-hidden).
// Under reduced motion the loop never starts — the cloth is relaxed once into a
// settled drape and simply redrawn on resize.

interface Node {
  x: number
  y: number
  /** Previous position — Verlet integration reads velocity as (x - px). */
  px: number
  py: number
  pinX: number
  pinY: number
  pinned: boolean
}

interface Link {
  a: Node
  b: Node
  rest: number
}

const GRAVITY = 1100 // px/s^2, pulling the sheet down
const DAMP = 0.99 // velocity retained per step — a little air drag
const CONSTRAINT_PASSES = 4 // relaxation iterations; more = stiffer weave
const MAX_DPR = 2
const TARGET_SPACING = 30 // px between nodes; grid size derives from this
const PIN_EVERY = 4 // pin every Nth top node → scalloped drape
const POINTER_R = 96 // px radius the pointer disturbs
const FIXED_DT = 1 / 60 // fixed physics step for a stable solve

export function Cloth({
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
    let windOn = true // suppressed while settling into the resting drape
    let cols = 0
    let rows = 0
    let spacing = TARGET_SPACING
    let nodes: Node[] = []
    let links: Link[] = []

    // Pointer state, sampled in local canvas space. active flips off when the
    // pointer leaves so the sheet settles back on its own.
    const pointer = { x: 0, y: 0, dx: 0, dy: 0, active: false }

    function build() {
      // Fit a grid to the panel with roughly TARGET_SPACING between nodes; the
      // sheet spans the full width and hangs from a little above the top.
      cols = Math.max(6, Math.round(W / TARGET_SPACING) + 1)
      rows = Math.max(6, Math.round(H / TARGET_SPACING) + 1)
      spacing = W / (cols - 1)
      const top = Math.max(6, H * 0.04)
      nodes = []
      links = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacing
          const y = top + r * spacing
          // Pin the top row in scallops — both ends always, plus every Nth —
          // so the sheet drapes into soft valances between the pins.
          const pinned = r === 0 && (c % PIN_EVERY === 0 || c === cols - 1)
          nodes.push({ x, y, px: x, py: y, pinX: x, pinY: y, pinned })
        }
      }
      // Structural links: each node tied to its right and lower neighbour, so
      // the whole grid resolves into one connected weave.
      const at = (r: number, c: number) => nodes[r * cols + c]
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (c < cols - 1) links.push({ a: at(r, c), b: at(r, c + 1), rest: spacing })
          if (r < rows - 1) links.push({ a: at(r, c), b: at(r + 1, c), rest: spacing })
        }
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
      // A slow, wide breeze: a low-frequency horizontal gust whose phase drifts
      // down the sheet, so folds travel through the fabric rather than the whole
      // thing shoving at once.
      const gust = windOn ? Math.sin(elapsed * 0.7) * 26 + Math.sin(elapsed * 1.9 + 1.3) * 14 : 0
      for (const n of nodes) {
        if (n.pinned) {
          n.x = n.pinX
          n.y = n.pinY
          continue
        }
        const vx = (n.x - n.px) * DAMP
        const vy = (n.y - n.py) * DAMP
        n.px = n.x
        n.py = n.y
        const rowPhase = Math.sin(elapsed * 1.4 + n.y * 0.02)
        const wind = gust * (0.6 + 0.4 * rowPhase)
        n.x += vx + wind * dt * dt * 60
        n.y += vy + GRAVITY * dt * dt
      }
    }

    function applyPointer() {
      if (!pointer.active) return
      const r2 = POINTER_R * POINTER_R
      for (const n of nodes) {
        if (n.pinned) continue
        const dx = n.x - pointer.x
        const dy = n.y - pointer.y
        const d2 = dx * dx + dy * dy
        if (d2 > r2) continue
        const d = Math.sqrt(d2) || 1
        const falloff = 1 - d / POINTER_R
        // Drag the weave along with the pointer, and shove it radially open.
        n.x += pointer.dx * falloff * 0.9 + (dx / d) * falloff * 6
        n.y += pointer.dy * falloff * 0.9 + (dy / d) * falloff * 6
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
          // Only pull when over-stretched, and only softly when compressed —
          // fabric resists stretch far more than it resists folding.
          const diff = (d - l.rest) / d
          const k = d > l.rest ? 0.5 : 0.25
          const ox = dx * diff * k
          const oy = dy * diff * k
          if (!a.pinned) {
            a.x += ox
            a.y += oy
          }
          if (!b.pinned) {
            b.x -= ox
            b.y -= oy
          }
        }
      }
    }

    function step(dt: number) {
      elapsed += dt
      integrate(dt)
      applyPointer()
      pointer.dx = 0
      pointer.dy = 0
      solve()
    }

    // Cell shading: darken where the fabric compresses horizontally into a fold,
    // lift where it stretches flat, and fade a little toward the bottom so the
    // sheet has weight. Reads as folds catching an overhead light.
    function cellAlpha(a: Node, b: Node, yMid: number) {
      const w = Math.abs(b.x - a.x)
      const ratio = Math.max(0.2, Math.min(1.5, w / spacing))
      // Compression (ratio < 1) is a fold and drops toward transparent so the
      // dark panel shows through the creases; a stretched-flat cell catches the
      // light. A gentle top-to-bottom falloff lights it from the pinned edge, so
      // the sheet reads as translucent fabric hung in a room rather than a wall.
      const fold = ratio - 0.55
      const light = 0.42 - Math.min(1, yMid / H) * 0.22
      return Math.max(0.04, Math.min(0.72, light + fold * 0.34))
    }

    function paint() {
      ctx!.clearRect(0, 0, W, H)
      const at = (r: number, c: number) => nodes[r * cols + c]
      // Filled quads first — the body of the cloth.
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const p00 = at(r, c)
          const p10 = at(r, c + 1)
          const p11 = at(r + 1, c + 1)
          const p01 = at(r + 1, c)
          const yMid = (p00.y + p11.y) * 0.5
          const alpha = cellAlpha(p00, p10, yMid)
          ctx!.beginPath()
          ctx!.moveTo(p00.x, p00.y)
          ctx!.lineTo(p10.x, p10.y)
          ctx!.lineTo(p11.x, p11.y)
          ctx!.lineTo(p01.x, p01.y)
          ctx!.closePath()
          ctx!.fillStyle = `rgba(${accent},${alpha})`
          ctx!.fill()
        }
      }
      // A faint weave over the top: every few threads, so the surface reads as
      // fabric rather than a flat gradient without drowning the folds.
      ctx!.strokeStyle = `rgba(${accent},0.14)`
      ctx!.lineWidth = 1
      ctx!.beginPath()
      for (let r = 0; r < rows; r += 2) {
        for (let c = 0; c < cols; c++) {
          const n = at(r, c)
          if (c === 0) ctx!.moveTo(n.x, n.y)
          else ctx!.lineTo(n.x, n.y)
        }
      }
      for (let c = 0; c < cols; c += 2) {
        for (let r = 0; r < rows; r++) {
          const n = at(r, c)
          if (r === 0) ctx!.moveTo(n.x, n.y)
          else ctx!.lineTo(n.x, n.y)
        }
      }
      ctx!.stroke()
      // Pins: small bright studs where the sheet is held at the top.
      for (let c = 0; c < cols; c++) {
        const n = at(0, c)
        if (!n.pinned) continue
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, 2.4, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${accent},0.9)`
        ctx!.fill()
      }
    }

    function frame(t: number) {
      if (!last) last = t
      let dt = (t - last) / 1000
      last = t
      if (dt > 0.25) dt = 0.25 // a long tab-out settles in one clamped chunk
      acc += dt
      // Fixed-step integration so the solve is frame-rate independent.
      let guard = 0
      while (acc >= FIXED_DT && guard < 5) {
        step(FIXED_DT)
        acc -= FIXED_DT
        guard++
      }
      if (guard === 5) acc = 0 // never spiral if we fell far behind
      paint()
      raf = requestAnimationFrame(frame)
    }

    // Relax the cloth into its resting drape by running the solver headless a
    // number of times — used for the first paint and the reduced-motion still.
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

    function onMove(e: PointerEvent) {
      const p = localPoint(e)
      if (pointer.active) {
        pointer.dx = p.x - pointer.x
        pointer.dy = p.y - pointer.y
      }
      pointer.x = p.x
      pointer.y = p.y
      pointer.active = true
    }

    function onLeave() {
      pointer.active = false
      pointer.dx = 0
      pointer.dy = 0
    }

    if (reduce) {
      measure()
      build()
      settle(120)
      paint()
      const roStill = new ResizeObserver(() => {
        measure()
        build()
        settle(120)
        paint()
      })
      roStill.observe(wrap)
      return () => roStill.disconnect()
    }

    measure()
    build()
    settle(30) // open on an already-draped sheet, not a flat grid dropping in
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => {
      measure()
      build()
      settle(20)
    })
    ro.observe(wrap)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, accent])

  return (
    <div ref={wrapRef} className={`relative touch-none select-none overflow-hidden ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  )
}
