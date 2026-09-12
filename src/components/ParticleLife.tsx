import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// ParticleLife — "Clusters" (Jeffrey Ventrella, 2010), the emergence model the
// generative shelf did not have. Its neighbours each grow structure out of one
// mechanism: the Morphogen out of two reacting chemicals, the Slime out of a
// trail thousands of agents share, the Frost out of pure chance, the Murmuration
// out of the three flocking rules every bird obeys. This grows life out of the
// simplest possible physics — a handful of coloured species, and a table that
// says how strongly each species is pulled toward every other. Nothing in that
// table describes a cell, a membrane, or a chaser; every structure you see is
// emergent, and the whole surprise of the model is how much comes out of so
// little.
//
// The rule, per particle, per frame: look at every other particle within rMax,
// and add up a force. Below a short beta radius the force is a HARD, universal
// repulsion (particles cannot pass through each other, whatever their colours) —
// that single term is what stops the whole field collapsing to a point. Beyond
// beta and out to rMax the force is set by the attraction table for the two
// colours, peaking mid-range and easing to zero at the edge. The table is
// asymmetric on purpose: lime may chase mint while mint flees lime, which is
// exactly what produces the endlessly circling "chasers" and the slow-breathing
// cells. Velocity integrates the force under heavy friction (a half-life, so it
// is frame-rate independent), positions wrap toroidally, and the field settles
// into a moving equilibrium that never quite repeats.
//
// Cheap by the shelf's discipline: an O(N) uniform spatial hash (a head/next
// linked list rebuilt each frame, cell = rMax, minimum-image wrap) replaces the
// naive O(N²) all-pairs sum, so hundreds of particles cost a few neighbour cells
// each; positions live in flat Float32Arrays off the React render path; the face
// is dimmed rather than cleared, so each body drags a short phosphor trail. The
// pointer is a gentle attractor — the field leans toward your hand, the shared
// "fields warm toward the cursor" language. Palette stays inside the site's
// restrained accent world (lime, mint, amber, a cool near-white). Seeded PRNG
// throughout, so the species table and the opening scatter are identical every
// mount. Under reduced motion there is no loop and no pointer: the same sim is
// run forward a few hundred quiet steps until the clusters form, then painted
// once as a single still frame, re-settled only on resize.
export function ParticleLife({
  className = '',
  species = 4,
  interactive = true,
}: {
  className?: string
  /** Number of colour species (2–4). */
  species?: number
  /** Let the pointer draw the field toward the cursor. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const K = Math.max(2, Math.min(4, Math.round(species)))
    // Restrained accent tints — lime, mint, amber, cool near-white. The same
    // within-accent language the Newton fractal uses, never a foreign rainbow.
    const TINTS = [
      [220, 248, 124],
      [124, 214, 198],
      [232, 196, 122],
      [206, 214, 222],
    ].slice(0, K)
    const FILL = TINTS.map(([r, g, b]) => `rgb(${r},${g},${b})`)

    // Deterministic PRNG so the species table and opening scatter never change.
    function mulberry32(a: number) {
      return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }
    let rng = mulberry32(0x9e37)

    // The asymmetric attraction table. Diagonal (a species toward its own kind)
    // is biased positive so colours clump into cells; the off-diagonal is free to
    // be positive or negative, which is what breeds chasers and membranes. Kept
    // inside [-1,1] and, with the universal short-range repulsion, always bounded.
    let attract = new Float32Array(K * K)
    function buildTable() {
      rng = mulberry32(0x9e37)
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          attract[i * K + j] =
            i === j ? 0.25 + rng() * 0.55 : rng() * 2 - 1
        }
      }
    }

    // Simulation constants (world units are CSS pixels).
    const R_MAX = 92 // interaction radius
    const BETA = 0.3 // fraction of rMax below which force is pure repulsion
    const FORCE = 5.2 // overall force strength
    const FRICTION_HALFLIFE = 0.045 // velocity half-life in seconds
    const CURSOR_R = 150 // pointer influence radius
    const CURSOR_PULL = 3.4 // pointer attraction strength
    const MAX_DT = 0.033

    let w = 0
    let h = 0
    let dpr = 1
    let N = 0
    let px = new Float32Array(0)
    let py = new Float32Array(0)
    let vx = new Float32Array(0)
    let vy = new Float32Array(0)
    let type = new Uint8Array(0)

    // Uniform spatial hash, cell size = rMax, rebuilt each frame as a linked list.
    let cols = 1
    let rows = 1
    let cellW = R_MAX
    let cellH = R_MAX
    let head = new Int32Array(0)
    let next = new Int32Array(0)

    let raf = 0
    let lastDraw = 0
    // Pointer, in world px; cx < 0 means "not over the field".
    let cx = -1
    let cy = -1

    function seed() {
      // Density scaled to area, clamped so a phone and a wide desktop both stay
      // lively and affordable.
      N = Math.max(90, Math.min(640, Math.round((w * h) / 2400)))
      px = new Float32Array(N)
      py = new Float32Array(N)
      vx = new Float32Array(N)
      vy = new Float32Array(N)
      type = new Uint8Array(N)
      next = new Int32Array(N)
      for (let i = 0; i < N; i++) {
        px[i] = rng() * w
        py[i] = rng() * h
        vx[i] = 0
        vy[i] = 0
        type[i] = (rng() * K) | 0
      }
    }

    function rebuildGrid() {
      cols = Math.max(1, Math.floor(w / R_MAX))
      rows = Math.max(1, Math.floor(h / R_MAX))
      cellW = w / cols
      cellH = h / rows
      if (head.length !== cols * rows) head = new Int32Array(cols * rows)
      head.fill(-1)
      for (let i = 0; i < N; i++) {
        let gx = (px[i] / cellW) | 0
        let gy = (py[i] / cellH) | 0
        if (gx < 0) gx = 0
        else if (gx >= cols) gx = cols - 1
        if (gy < 0) gy = 0
        else if (gy >= rows) gy = rows - 1
        const c = gy * cols + gx
        next[i] = head[c]
        head[c] = i
      }
    }

    // The force curve: universal repulsion below beta, then the table's pull
    // peaking mid-range and easing to zero at the edge. r is 0..1 (d / rMax).
    function force(r: number, a: number) {
      if (r < BETA) return r / BETA - 1
      if (r < 1) return a * (1 - Math.abs(2 * r - 1 - BETA) / (1 - BETA))
      return 0
    }

    function step(dt: number) {
      rebuildGrid()
      const frictionFactor = Math.pow(0.5, dt / FRICTION_HALFLIFE)
      const halfW = w / 2
      const halfH = h / 2
      const r2 = R_MAX * R_MAX
      for (let i = 0; i < N; i++) {
        const xi = px[i]
        const yi = py[i]
        const ti = type[i]
        const gx = Math.min(cols - 1, Math.max(0, (xi / cellW) | 0))
        const gy = Math.min(rows - 1, Math.max(0, (yi / cellH) | 0))
        let fx = 0
        let fy = 0
        // Only the cell and its eight neighbours can hold a particle within rMax.
        for (let oy = -1; oy <= 1; oy++) {
          let ny = gy + oy
          if (rows > 2) ny = (ny + rows) % rows
          else if (ny < 0 || ny >= rows) continue
          for (let ox = -1; ox <= 1; ox++) {
            let nx = gx + ox
            if (cols > 2) nx = (nx + cols) % cols
            else if (nx < 0 || nx >= cols) continue
            let j = head[ny * cols + nx]
            while (j !== -1) {
              if (j !== i) {
                // Minimum-image displacement across the toroidal wrap.
                let dx = px[j] - xi
                let dy = py[j] - yi
                if (dx > halfW) dx -= w
                else if (dx < -halfW) dx += w
                if (dy > halfH) dy -= h
                else if (dy < -halfH) dy += h
                const d2 = dx * dx + dy * dy
                if (d2 > 0 && d2 < r2) {
                  const d = Math.sqrt(d2)
                  const f = force(d / R_MAX, attract[ti * K + type[j]])
                  fx += (dx / d) * f
                  fy += (dy / d) * f
                }
              }
              j = next[j]
            }
          }
        }
        fx *= R_MAX * FORCE
        fy *= R_MAX * FORCE
        // Pointer: a soft attractor that leans nearby bodies toward the hand.
        if (cx >= 0) {
          let dx = cx - xi
          let dy = cy - yi
          if (dx > halfW) dx -= w
          else if (dx < -halfW) dx += w
          if (dy > halfH) dy -= h
          else if (dy < -halfH) dy += h
          const d2 = dx * dx + dy * dy
          if (d2 > 0 && d2 < CURSOR_R * CURSOR_R) {
            const d = Math.sqrt(d2)
            const g = (1 - d / CURSOR_R) * CURSOR_PULL * R_MAX
            fx += (dx / d) * g
            fy += (dy / d) * g
          }
        }
        vx[i] = vx[i] * frictionFactor + fx * dt
        vy[i] = vy[i] * frictionFactor + fy * dt
      }
      // Integrate positions after all forces, then wrap toroidally.
      for (let i = 0; i < N; i++) {
        let x = px[i] + vx[i] * dt
        let y = py[i] + vy[i] * dt
        if (x < 0) x += w
        else if (x >= w) x -= w
        if (y < 0) y += h
        else if (y >= h) y -= h
        px[i] = x
        py[i] = y
      }
    }

    function draw(trail: boolean) {
      // Dim rather than clear, so each body drags a short phosphor tail.
      if (trail) {
        ctx!.fillStyle = 'rgba(5,6,6,0.30)'
        ctx!.fillRect(0, 0, w * dpr, h * dpr)
      } else {
        ctx!.fillStyle = '#050606'
        ctx!.fillRect(0, 0, w * dpr, h * dpr)
      }
      const rad = 2.1 * dpr
      const tau = Math.PI * 2
      for (let k = 0; k < K; k++) {
        ctx!.fillStyle = FILL[k]
        ctx!.beginPath()
        for (let i = 0; i < N; i++) {
          if (type[i] !== k) continue
          const x = px[i] * dpr
          const y = py[i] * dpr
          ctx!.moveTo(x + rad, y)
          ctx!.arc(x, y, rad, 0, tau)
        }
        ctx!.fill()
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      rng = mulberry32(0x9e37)
      buildTable()
      seed()
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cx = e.clientX - rect.left
      cy = e.clientY - rect.top
    }
    function onLeave() {
      cx = -1
      cy = -1
    }

    resize()

    if (reduce) {
      // Run the sim forward until the clusters form, then hold one still frame.
      const settle = () => {
        for (let s = 0; s < 320; s++) step(0.02)
        draw(false)
      }
      settle()
      const ro = new ResizeObserver(() => {
        resize()
        settle()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Warm-start a little so it opens already alive, not from a flat scatter.
    for (let s = 0; s < 90; s++) step(0.02)

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const dt = lastDraw ? Math.min(MAX_DT, (now - lastDraw) / 1000) : 0.016
      if (now - lastDraw < 24) return // ~40fps ceiling
      lastDraw = now
      step(dt)
      draw(true)
    }

    if (interactive) {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, species, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
