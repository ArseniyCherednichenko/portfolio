import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// The Lorenz attractor — the other famous face of deterministic chaos, and the
// one the Clifford map on the same shelf cannot show you. Where that map folds a
// flat plane and the Julia set colours one, this orbit lives in three dimensions
// and the whole point is the shape it traces there: the butterfly, the single
// best-known picture in all of chaos.
//
// It is the trajectory of one point obeying three coupled rules, the toy model
// Edward Lorenz distilled from atmospheric convection in 1963:
//   dx/dt = σ (y − x)
//   dy/dt = x (ρ − z) − y
//   dz/dt = x y − β z
// with the classic σ = 10, ρ = 28, β = 8/3. There is no randomness and no
// forcing; the system is entirely determined by where it starts. Yet two points
// a hair apart diverge exponentially — this is the equation that named the
// butterfly effect — so the orbit never lands on a fixed point and never closes
// into a cycle. Instead it winds around one lobe, flips to the other at an
// unpredictable moment, winds there a while, flips back, forever, and the set of
// all the places it visits is the two-winged strange attractor you see.
//
// The state is advanced with classical fourth-order Runge–Kutta, which tracks
// the true curve far more faithfully than a naive Euler step and keeps the two
// wings crisp instead of smeared. Several thousand integrated points are held in
// a ring buffer — the whole butterfly, laid down as a faint lime ghost — with
// the few hundred most-recent points ramped bright toward white, so a comet head
// is always seen tracing the live orbit around the wings. Everything is drawn
// with additive compositing, so where the trajectory crowds (the dense rims of
// each lobe) sums into light. The attractor is three-dimensional, so it is
// rotated and orthographically projected every frame: it turns on its own slow
// yaw, and the pointer takes the wheel while it is over the field — left/right
// spins the butterfly, up/down tilts it — easing back to the idle spin when the
// pointer leaves, with depth reading as brightness so the near wing glows over
// the far one. One canvas, one rAF loop, a frame-driven clock (no wall time), DPR
// capped, finite-guarded. Under reduced motion the loop never starts: a single
// long orbit is integrated once and the whole butterfly is drawn still, at a
// composed three-quarter angle. Decorative, so aria-hidden.

export function Lorenz({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let scale = 1
    let raf = 0
    let t = 0 // frame-driven time phase; no Date.now, so resize-stable and safe

    // Lorenz parameters — the canonical chaotic set.
    const SIGMA = 10
    const RHO = 28
    const BETA = 8 / 3
    // The butterfly centres near (0, 0, ~25); subtract it so the shape rotates
    // about its own middle rather than swinging off-screen.
    const CZ = 25
    // The orbit roams roughly |x|,|y| < 20 and 0 < z < 50; this half-extent
    // comfortably frames it at every rotation.
    const HALF = 32

    // The trajectory as a ring buffer of 3D points — the whole butterfly.
    const CAP = reduce ? 9000 : 5200
    const xs = new Float32Array(CAP)
    const ys = new Float32Array(CAP)
    const zs = new Float32Array(CAP)
    let head = 0 // index of the newest point
    let filled = 0 // how many slots hold real points

    // Integration state and step. dt is small enough that RK4 stays faithful to
    // the true curve; a handful of steps a frame keeps the comet moving steadily.
    let sx = 0.1
    let sy = 0
    let sz = 0
    const DT = 0.006
    const STEPS = reduce ? 1 : 11

    function deriv(x: number, y: number, z: number) {
      return [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z] as const
    }

    // One classical fourth-order Runge–Kutta step of the Lorenz system.
    function step() {
      const [k1x, k1y, k1z] = deriv(sx, sy, sz)
      const [k2x, k2y, k2z] = deriv(sx + (k1x * DT) / 2, sy + (k1y * DT) / 2, sz + (k1z * DT) / 2)
      const [k3x, k3y, k3z] = deriv(sx + (k2x * DT) / 2, sy + (k2y * DT) / 2, sz + (k2z * DT) / 2)
      const [k4x, k4y, k4z] = deriv(sx + k3x * DT, sy + k3y * DT, sz + k3z * DT)
      sx += ((k1x + 2 * k2x + 2 * k3x + k4x) * DT) / 6
      sy += ((k1y + 2 * k2y + 2 * k3y + k4y) * DT) / 6
      sz += ((k1z + 2 * k2z + 2 * k3z + k4z) * DT) / 6
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)) {
        // A degenerate step should never happen for this bounded system, but
        // never store NaN; reseed near the classic start if it ever does.
        sx = 0.1
        sy = 0
        sz = 0
      }
      head = (head + 1) % CAP
      xs[head] = sx
      ys[head] = sy
      zs[head] = sz - CZ
      if (filled < CAP) filled++
    }

    // The pointer eases toward the cursor and its influence swells while it is
    // over the field, so it takes the wheel and lets go gently.
    const cur = { nx: 0, ny: 0, tnx: 0, tny: 0, amp: 0, tamp: 0 }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      scale = (Math.min(w, h) * 0.86) / HALF
    }

    // Rotate a centred point by yaw (about the model's vertical z-axis) then
    // pitch (about the camera's horizontal axis) and orthographically project.
    // Returns screen x/y plus a depth in [0,1] where 1 is nearest the camera.
    function project(px: number, py: number, pz: number, yaw: number, pitch: number) {
      const ca = Math.cos(yaw)
      const sa = Math.sin(yaw)
      const rx = px * ca - py * sa
      const ry = px * sa + py * ca
      const rz = pz
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const ry2 = ry * cp - rz * sp
      const rz2 = ry * sp + rz * cp
      return {
        x: cx + rx * scale,
        y: cy - rz2 * scale,
        depth: 0.5 + ry2 / (HALF * 1.4), // nearer wing → brighter
      }
    }

    // Draw the whole buffer, oldest → newest, as additive segments. Older points
    // are a faint persistent ghost; the most-recent run ramps bright toward white
    // as the comet head. Depth modulates brightness so the near wing reads over
    // the far one.
    function render(yaw: number, pitch: number) {
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'
      ctx!.lineWidth = 1
      if (filled < 2) return
      const headRun = Math.min(reduce ? 0 : 320, filled - 1)
      let prev: { x: number; y: number; depth: number } | null = null
      for (let k = 0; k < filled; k++) {
        // Walk from the oldest stored point to the newest (head).
        const idx = (head - (filled - 1) + k + CAP * 2) % CAP
        const p = project(xs[idx], ys[idx], zs[idx], yaw, pitch)
        if (prev) {
          const depth = Math.max(0.15, Math.min(1, (p.depth + prev.depth) / 2))
          const fromHead = filled - 1 - k // 0 at the newest
          let alpha: number
          let r = ar
          let g = ag
          let b = ab
          if (!reduce && fromHead < headRun) {
            // Comet head: ramp up toward the newest point and lerp to white.
            const u = 1 - fromHead / headRun // 0..1, 1 at the very head
            alpha = (0.1 + 0.5 * u * u) * depth
            const whiten = u * u
            r = Math.round(ar + (255 - ar) * whiten)
            g = Math.round(ag + (255 - ag) * whiten)
            b = Math.round(ab + (255 - ab) * whiten)
          } else {
            // The resting butterfly — a faint lime ghost that density lights up.
            alpha = (reduce ? 0.07 : 0.05) * depth
          }
          ctx!.strokeStyle = `rgba(${r},${g},${b},${alpha})`
          ctx!.beginPath()
          ctx!.moveTo(prev.x, prev.y)
          ctx!.lineTo(p.x, p.y)
          ctx!.stroke()
        }
        prev = p
      }
      ctx!.globalCompositeOperation = 'source-over'
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tnx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      cur.tny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      cur.tamp = 1
    }
    function onLeave() {
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      // Integrate one long orbit and draw the whole butterfly, still, at a
      // composed three-quarter angle. No loop, no comet.
      for (let i = 0; i < CAP; i++) step()
      const YAW = -0.6
      const PITCH = 1.15
      render(YAW, PITCH)
      const ro = new ResizeObserver(() => {
        resize()
        render(YAW, PITCH)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame() {
      t += 0.01
      cur.nx += (cur.tnx - cur.nx) * 0.1
      cur.ny += (cur.tny - cur.ny) * 0.1
      cur.amp += (cur.tamp - cur.amp) * 0.05

      for (let s = 0; s < STEPS; s++) step()

      // Idle yaw turns the butterfly slowly; the pointer's x then leans it, blended
      // in by its eased influence. Pitch rests at a tilted three-quarter view and
      // the pointer's y nods it up and down.
      const yaw = t * 0.18 + cur.nx * 1.4 * cur.amp
      const pitch = 1.0 + Math.sin(t * 0.23) * 0.1 - cur.ny * 0.5 * cur.amp
      render(yaw, pitch)
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
  }, [reduce, accent])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
