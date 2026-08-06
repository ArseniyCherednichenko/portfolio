import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Murmuration: a flock of darts that wheels, streams, and folds in on itself
// like starlings at dusk. It sits deliberately apart from every other field in
// the Playground's "Pointer fields" band. Those are all *fixed* fields the
// pointer perturbs locally: DotGrid springs the nearest dots, MagnetLines turns
// needles, FlowField advects particles down a frozen noise vector field,
// Threads bulges set waves, MetaBalls fuse blobs. Nothing about them is
// emergent — the field is authored and the cursor only bends it. This one has
// no field at all. Each boid steers only by the three classic Reynolds rules
// over the neighbours it can actually see — separation, alignment, cohesion —
// and the sweeping, self-composing shape of the flock is nobody's design; it
// falls out of a hundred agents each minding its own small neighbourhood. The
// cursor is a bird among them: hover and the flock leans toward you, press and
// you are a hawk and they scatter.
//
// One <canvas>, one RAF loop, DPR-aware and ResizeObserver-driven, the whole
// simulation in flat typed arrays with no React state on the hot path. Forces
// are accumulated from a read of the previous frame's state before any boid
// moves, so the flock updates in lockstep rather than in reading order. dt is
// clamped so a backgrounded tab can never explode the sim. Trails are eroded
// toward transparent with a destination-out wash so the panel's own gradient
// shows through and dense knots smear into light. Seeded scatter so the opening
// is lively but identical each mount. aria-hidden — purely decorative. Under
// reduced motion the loop never starts: the flock is settled by a fixed number
// of silent steps into one composed, still murmuration and drawn once.

const MAX_SPEED = 205 // px/s
const MIN_SPEED = 82 // px/s — a flock never stalls
const MAX_FORCE = 640 // px/s^2 cap on any single steering term
const PERCEPT2 = 66 * 66 // squared neighbour-sight radius
const SEP2 = 27 * 27 // squared personal-space radius
const W_ALIGN = 1.0
const W_COH = 0.85
const W_SEP = 1.75
const EDGE_MARGIN = 46
const EDGE_TURN = 900 // px/s^2 turn-in near the walls
const POINTER_R = 176
const POINTER_ATTRACT = 560 // px/s^2 lean toward a hovering cursor
const POINTER_REPEL = 1750 // px/s^2 scatter from a pressed cursor
const TRAIL_FADE = 0.16 // per-frame erosion of the trail toward transparent
const MAX_DT = 1 / 30
const MAX_DPR = 2

export function Murmuration({
  count = 110,
  accent = '220,248,124', // lime, as "r,g,b"
  className = '',
}: {
  /** How many birds are in the flock. */
  count?: number
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

    // Flat, allocation-free state for the whole flock.
    const px = new Float32Array(count)
    const py = new Float32Array(count)
    const vx = new Float32Array(count)
    const vy = new Float32Array(count)
    const ax = new Float32Array(count)
    const ay = new Float32Array(count)
    // 0 = neutral white, 1 = lime. Roughly a third lime so it reads lime-led.
    const lime = new Uint8Array(count)

    // Pointer, in local canvas coordinates. active = present, down = predator.
    const pointer = { x: 0, y: 0, active: false, down: false }

    // Seeded PRNG (mulberry32-ish) so the opening scatter is identical each
    // mount and never pulls per-frame entropy.
    let seed = 20260806
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    function build() {
      // Scatter the flock loosely around the centre with a shared drift, so it
      // opens already moving as a body rather than as random noise.
      const driftA = rand() * Math.PI * 2
      for (let i = 0; i < count; i++) {
        px[i] = W * (0.3 + rand() * 0.4)
        py[i] = H * (0.3 + rand() * 0.4)
        const a = driftA + (rand() - 0.5) * 1.6
        const s = MIN_SPEED + rand() * (MAX_SPEED - MIN_SPEED)
        vx[i] = Math.cos(a) * s
        vy[i] = Math.sin(a) * s
        lime[i] = rand() < 0.34 ? 1 : 0
      }
    }

    // One steering term: the acceleration that turns velocity (vX,vY) toward a
    // desired direction (dx,dy) at full speed, capped to MAX_FORCE.
    function steer(dx: number, dy: number, vX: number, vY: number, out: [number, number]) {
      const len = Math.hypot(dx, dy)
      if (len === 0) {
        out[0] = 0
        out[1] = 0
        return
      }
      let sx = (dx / len) * MAX_SPEED - vX
      let sy = (dy / len) * MAX_SPEED - vY
      const m = Math.hypot(sx, sy)
      if (m > MAX_FORCE) {
        sx = (sx / m) * MAX_FORCE
        sy = (sy / m) * MAX_FORCE
      }
      out[0] = sx
      out[1] = sy
    }

    const tmp: [number, number] = [0, 0]

    function accumulate() {
      for (let i = 0; i < count; i++) {
        let alignX = 0
        let alignY = 0
        let cohX = 0
        let cohY = 0
        let sepX = 0
        let sepY = 0
        let n = 0

        const xi = px[i]
        const yi = py[i]
        for (let j = 0; j < count; j++) {
          if (j === i) continue
          const dx = px[j] - xi
          const dy = py[j] - yi
          const d2 = dx * dx + dy * dy
          if (d2 > PERCEPT2) continue
          alignX += vx[j]
          alignY += vy[j]
          cohX += px[j]
          cohY += py[j]
          n++
          if (d2 < SEP2 && d2 > 0) {
            // push away, weighted by closeness so a near-collision dominates
            const inv = 1 / d2
            sepX -= dx * inv
            sepY -= dy * inv
          }
        }

        let accX = 0
        let accY = 0
        if (n > 0) {
          steer(alignX / n, alignY / n, vx[i], vy[i], tmp)
          accX += tmp[0] * W_ALIGN
          accY += tmp[1] * W_ALIGN
          steer(cohX / n - xi, cohY / n - yi, vx[i], vy[i], tmp)
          accX += tmp[0] * W_COH
          accY += tmp[1] * W_COH
        }
        if (sepX !== 0 || sepY !== 0) {
          steer(sepX, sepY, vx[i], vy[i], tmp)
          accX += tmp[0] * W_SEP
          accY += tmp[1] * W_SEP
        }

        // Soft turn-in near the walls — no hard bounce, they bank away.
        if (xi < EDGE_MARGIN) accX += EDGE_TURN * (1 - xi / EDGE_MARGIN)
        else if (xi > W - EDGE_MARGIN) accX -= EDGE_TURN * (1 - (W - xi) / EDGE_MARGIN)
        if (yi < EDGE_MARGIN) accY += EDGE_TURN * (1 - yi / EDGE_MARGIN)
        else if (yi > H - EDGE_MARGIN) accY -= EDGE_TURN * (1 - (H - yi) / EDGE_MARGIN)

        // The cursor: a companion to lean toward, a hawk to flee.
        if (pointer.active) {
          const dx = pointer.x - xi
          const dy = pointer.y - yi
          const d = Math.hypot(dx, dy)
          if (d < POINTER_R && d > 0.001) {
            const fall = 1 - d / POINTER_R
            if (pointer.down) {
              accX -= (dx / d) * POINTER_REPEL * fall
              accY -= (dy / d) * POINTER_REPEL * fall
            } else {
              accX += (dx / d) * POINTER_ATTRACT * fall
              accY += (dy / d) * POINTER_ATTRACT * fall
            }
          }
        }

        ax[i] = accX
        ay[i] = accY
      }
    }

    function integrate(dt: number) {
      for (let i = 0; i < count; i++) {
        vx[i] += ax[i] * dt
        vy[i] += ay[i] * dt
        let s = Math.hypot(vx[i], vy[i])
        if (s > MAX_SPEED) {
          vx[i] = (vx[i] / s) * MAX_SPEED
          vy[i] = (vy[i] / s) * MAX_SPEED
          s = MAX_SPEED
        } else if (s < MIN_SPEED && s > 0) {
          vx[i] = (vx[i] / s) * MIN_SPEED
          vy[i] = (vy[i] / s) * MIN_SPEED
        }
        px[i] += vx[i] * dt
        py[i] += vy[i] * dt
      }
    }

    function step(dt: number) {
      accumulate()
      integrate(dt)
    }

    function drawBird(i: number) {
      const x = px[i]
      const y = py[i]
      const a = Math.atan2(vy[i], vx[i])
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      // an oriented dart: nose ahead, two swept-back wings
      const L = 6.4
      const B = 3.4
      const nx = x + cos * L
      const ny = y + sin * L
      const bx = x - cos * L * 0.5
      const by = y - sin * L * 0.5
      // wing offsets perpendicular to heading
      const wx = -sin * B
      const wy = cos * B
      ctx!.beginPath()
      ctx!.moveTo(nx, ny)
      ctx!.lineTo(bx + wx, by + wy)
      ctx!.lineTo(bx - wx, by - wy)
      ctx!.closePath()
      const speed = Math.hypot(vx[i], vy[i])
      const bright = 0.42 + 0.5 * Math.min(1, (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED))
      ctx!.fillStyle = lime[i]
        ? `rgba(${accent},${bright})`
        : `rgba(226,232,240,${bright * 0.82})`
      ctx!.fill()
    }

    function paintTrailed() {
      // Erode the previous frame's ink toward transparent so trails fade and
      // the panel's own gradient shows through, then composite the flock
      // additively so overlapping birds smear into light.
      ctx!.globalCompositeOperation = 'destination-out'
      ctx!.fillStyle = `rgba(0,0,0,${TRAIL_FADE})`
      ctx!.fillRect(0, 0, W, H)
      ctx!.globalCompositeOperation = 'lighter'
      for (let i = 0; i < count; i++) drawBird(i)
      ctx!.globalCompositeOperation = 'source-over'
    }

    function paintStill() {
      ctx!.clearRect(0, 0, W, H)
      ctx!.globalCompositeOperation = 'lighter'
      for (let i = 0; i < count; i++) drawBird(i)
      ctx!.globalCompositeOperation = 'source-over'
    }

    function measure() {
      const rect = wrap!.getBoundingClientRect()
      const prevW = W
      const prevH = H
      W = rect.width
      H = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas!.width = Math.round(W * dpr)
      canvas!.height = Math.round(H * dpr)
      canvas!.style.width = `${W}px`
      canvas!.style.height = `${H}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Keep the flock in frame after a resize by rescaling positions.
      if (prevW > 0 && prevH > 0) {
        const sx = W / prevW
        const sy = H / prevH
        for (let i = 0; i < count; i++) {
          px[i] *= sx
          py[i] *= sy
        }
      }
    }

    function frame(t: number) {
      if (!last) last = t
      const dt = Math.min((t - last) / 1000, MAX_DT)
      last = t
      if (dt > 0) step(dt)
      paintTrailed()
      raf = requestAnimationFrame(frame)
    }

    function localPoint(e: PointerEvent) {
      const rect = wrap!.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    function onMove(e: PointerEvent) {
      localPoint(e)
      pointer.active = true
    }
    function onDown(e: PointerEvent) {
      localPoint(e)
      pointer.active = true
      pointer.down = true
    }
    function onUp() {
      pointer.down = false
    }
    function onLeave() {
      pointer.active = false
      pointer.down = false
    }

    if (reduce) {
      measure()
      build()
      // Settle the flock into one composed, still murmuration — deterministic,
      // identical each mount — then draw it once. No loop, no listeners.
      for (let k = 0; k < 150; k++) step(1 / 60)
      paintStill()
      const roStill = new ResizeObserver(() => {
        seed = 20260806
        measure()
        build()
        for (let k = 0; k < 150; k++) step(1 / 60)
        paintStill()
      })
      roStill.observe(wrap)
      return () => roStill.disconnect()
    }

    measure()
    build()
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    wrap.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => measure())
    ro.observe(wrap)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      wrap.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, count, accent])

  return (
    <div ref={wrapRef} className={`relative touch-none select-none overflow-hidden ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  )
}
