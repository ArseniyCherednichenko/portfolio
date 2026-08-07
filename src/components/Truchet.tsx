import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A woven field of Truchet tiles. Each cell of the grid draws one of two things:
// a pair of quarter-circle arcs joining its top edge to its left and its bottom
// to its right, or the mirror of that joining top to right and bottom to left.
// Lay those two tiles at random across a grid and the arcs meet edge-to-edge
// into long flowing curves, loops, and knots — the oldest trick in generative
// pattern, from Sébastien Truchet's 1704 study of a single divided square.
//
// Here the weave is alive. A slow scalar field of drifting sine waves decides
// each tile's orientation, so the maze re-threads itself as the waves pass —
// each tile flips on its own beat, never in lockstep, and every flip cross-fades
// from the old arcs to the new so the pattern breathes rather than snaps. The
// pointer is a rotating pinwheel pressed into the field: tiles near the cursor
// bend toward it and warm from cool white to lime, brightest at the centre and
// falling off with distance, so a lit domain follows the pointer across the
// weave. One canvas, one RAF loop, DPR-aware and ResizeObserver-driven; the
// orientation, previous orientation, and per-tile flip progress live in flat
// typed arrays with no per-tile React state. Under reduced motion there is no
// loop and no pointer — the field is frozen once into a single calm, balanced
// weave. Decorative, so aria-hidden.

export function Truchet({
  className = '',
  accent = '220,248,124',
  cell = 46,
}: {
  className?: string
  /** Lit-tile colour as an "r,g,b" string. */
  accent?: string
  /** Tile size in CSS pixels — smaller is denser and heavier. */
  cell?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    // Cool base tint the unlit weave sits at, warming toward the accent near the pointer.
    const br = 205
    const bg = 210
    const bb = 220
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    // Current target orientation per tile, the orientation it is leaving, and the
    // 0..1 cross-fade progress from the old to the new (1 = fully settled).
    let orient = new Uint8Array(0)
    let prev = new Uint8Array(0)
    let prog = new Float32Array(0)
    let raf = 0

    // The pointer: eases under the cursor and swells in while it is over the weave.
    const cur = { x: 0, y: 0, tx: 0, ty: 0, amp: 0, tamp: 0, active: false }
    // How long a single tile takes to cross-fade after it flips (seconds).
    const FLIP = 0.4
    // Wave numbers and speeds for the orientation field.
    const KX = 0.55
    const KY = 0.5

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.max(1, Math.ceil(w / cell))
      rows = Math.max(1, Math.ceil(h / cell))
      const n = cols * rows
      orient = new Uint8Array(n)
      prev = new Uint8Array(n)
      prog = new Float32Array(n).fill(1)
      if (!cur.active) {
        cur.x = cur.tx = w / 2
        cur.y = cur.ty = h / 2
      }
    }

    // The orientation field at tile (c,r) and time t: three drifting sine waves
    // plus the pointer pinwheel. Returns a signed scalar; positive picks tile B.
    function field(c: number, r: number, t: number): number {
      let f =
        Math.sin(c * KX + t * 0.6) +
        Math.sin(r * KY - t * 0.5) +
        0.8 * Math.sin((c + r) * 0.34 + t * 0.3)
      if (cur.amp > 0.001) {
        const cx = (c + 0.5) * cell
        const cy = (r + 0.5) * cell
        const dx = cx - cur.x
        const dy = cy - cur.y
        const sig = cell * 3.2
        const g = cur.amp * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig))
        // A rotating four-lobe pinwheel, so the weave curls around the cursor
        // rather than flattening into one orientation under it.
        f += g * 1.8 * Math.sin(2 * Math.atan2(dy, dx) + t)
      }
      return f
    }

    // How lit a tile is (0..1) — pure pointer proximity, driving colour warmth,
    // stroke weight, and opacity so a bright domain trails the cursor.
    function litAt(c: number, r: number): number {
      if (cur.amp < 0.001) return 0
      const cx = (c + 0.5) * cell
      const cy = (r + 0.5) * cell
      const dx = cx - cur.x
      const dy = cy - cur.y
      const sig = cell * 3
      return cur.amp * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig))
    }

    // Trace one tile's two arcs into the current path. o=0 joins top→left and
    // bottom→right; o=1 joins top→right and bottom→left.
    function traceTile(x: number, y: number, o: number) {
      const rad = cell / 2
      if (o === 0) {
        ctx!.moveTo(x + rad, y)
        ctx!.arc(x, y, rad, 0, Math.PI / 2)
        ctx!.moveTo(x + rad, y + cell)
        ctx!.arc(x + cell, y + cell, rad, Math.PI, Math.PI * 1.5)
      } else {
        ctx!.moveTo(x + rad, y)
        ctx!.arc(x + cell, y, rad, Math.PI / 2, Math.PI)
        ctx!.moveTo(x, y + rad)
        ctx!.arc(x, y + cell, rad, Math.PI * 1.5, Math.PI * 2)
      }
    }

    function stroke(x: number, y: number, o: number, lit: number, alpha: number) {
      const rr = Math.round(br + (ar - br) * lit)
      const gg = Math.round(bg + (ag - bg) * lit)
      const bbv = Math.round(bb + (ab - bb) * lit)
      ctx!.strokeStyle = `rgba(${rr},${gg},${bbv},${alpha})`
      ctx!.lineWidth = 1 + lit * 1.6
      ctx!.beginPath()
      traceTile(x, y, o)
      ctx!.stroke()
    }

    // Advance every tile's target orientation and cross-fade, then draw the weave.
    function render(t: number, dt: number) {
      ctx!.fillStyle = '#09090b'
      ctx!.fillRect(0, 0, w, h)
      ctx!.lineCap = 'round'
      let i = 0
      for (let r = 0; r < rows; r++) {
        const y = r * cell
        for (let c = 0; c < cols; c++, i++) {
          const f = field(c, r, t)
          // A dead-band around zero so a tile hovering at the crossing does not
          // flap; it commits only once the field clears the band.
          const target = f > 0.12 ? 1 : f < -0.12 ? 0 : orient[i]
          if (target !== orient[i]) {
            prev[i] = orient[i]
            orient[i] = target
            prog[i] = 0
          }
          if (prog[i] < 1) prog[i] = Math.min(1, prog[i] + dt / FLIP)

          const x = c * cell
          const lit = litAt(c, r)
          const base = 0.16 + lit * 0.5
          const p = prog[i]
          if (p < 1 && prev[i] !== orient[i]) {
            stroke(x, y, prev[i], lit, base * (1 - p))
            stroke(x, y, orient[i], lit, base * p)
          } else {
            stroke(x, y, orient[i], lit, base)
          }
        }
      }
    }

    function seedField(t: number) {
      let i = 0
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++, i++) {
          orient[i] = field(c, r, t) > 0 ? 1 : 0
          prev[i] = orient[i]
          prog[i] = 1
        }
      }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tx = e.clientX - rect.left
      cur.ty = e.clientY - rect.top
      cur.active = true
      cur.tamp = 1
    }
    function onLeave() {
      cur.active = false
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      // Still weave: freeze the field at t = 0, no pointer, and draw once.
      const draw = () => {
        seedField(0)
        render(0, 0)
      }
      draw()
      const ro = new ResizeObserver(() => {
        resize()
        draw()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    seedField(0)
    let last = performance.now()
    const start = last
    function frame(now: number) {
      const t = (now - start) / 1000
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      cur.x += (cur.tx - cur.x) * 0.16
      cur.y += (cur.ty - cur.y) * 0.16
      cur.amp += (cur.tamp - cur.amp) * 0.08
      render(t, dt)
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
  }, [reduce, accent, cell])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
