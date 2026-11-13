import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// ThreeBody — the three-body problem, chaos in its oldest and most physical
// form. Where the Lorenz attractor distils chaos from the equations of
// convection and the Clifford map iterates an abstract rule, this is the system
// the whole idea of chaos was born from: three stars, each pulling on the other
// two by Newton's inverse-square gravity, and nothing else. Two bodies trace
// clean ellipses forever — Kepler solved that in closed form. Add a third and
// the closed form vanishes. Poincaré proved in 1890 that no formula can predict
// where these three go; the only way to know is to integrate the motion step by
// step and watch, and two starts a hair apart diverge into completely different
// histories. That sensitive dependence — the butterfly, decades before Lorenz
// named it — is the whole point.
//
// The physics is honest and hand-rolled: three point masses, pairwise force
//   F = G·m₁·m₂ / (r² + ε²)
// with a small Plummer softening ε so a near-collision stays finite instead of
// flinging a body to infinity and killing the frame. State is carried forward
// by velocity-Verlet (leapfrog), the symplectic integrator astronomers use
// because it conserves energy over long runs far better than a naive Euler step,
// so the dance stays bounded and alive rather than spiralling out to numerical
// noise. Many small sub-steps run per frame for accuracy; the barycentre is
// pinned to the centre of the canvas every frame (total momentum is zeroed at
// the start), so the three stay framed as a group even while one of them is
// being thrown clear. When a body is genuinely ejected — the general outcome of
// three-body gravity, one star flung away while the other two pair into a tight
// binary — or the maths goes non-finite, the system quietly reseeds into a
// fresh random configuration, so the piece never freezes and never repeats.
//
// Trails are a feedback fade: the frame is dimmed toward ink by a hair each tick
// rather than cleared, so every body drags a glowing comet tail that remembers
// where it has been, the three in lime, mint and warm white so the braid of
// three paths stays legible. The pointer drops a soft gravitational well under
// the cursor — a fourth, gentle mass — so moving across the field leans the
// whole dance toward your hand without ever yanking it.
//
// Under reduced motion there is no loop, no pointer and no chaos: the canvas is
// painted once with the figure-eight choreography — the exact periodic solution
// Chenciner and Montgomery proved in 2000, three equal masses chasing one
// another forever around a single figure-eight — integrated from its known
// initial conditions and drawn complete and still. The moving piece is the
// chaotic general case; the still is the one orbit that found order.
export function ThreeBody({
  className = '',
  speed = 1,
  interactive = true,
}: {
  className?: string
  /** Scales how far the simulation advances per frame. */
  speed?: number
  /** Let the pointer drop a soft gravitational well under the cursor. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // The three body hues: lime, mint, warm white — all in the site's family,
    // distinct enough that three braided trails never read as one smear.
    const COLORS = [
      [220, 248, 124], // lime  #DCF87C
      [158, 230, 180], // mint  #9EE6B4
      [239, 243, 230], // warm white
    ] as const

    const G = 1
    const SOFT2 = 0.05 * 0.05 // Plummer softening ε², keeps close passes finite
    const N = 3

    let w = 0
    let h = 0
    let dpr = 1
    // World-to-pixel scale and the world-space radius past which a body counts
    // as ejected and the system reseeds.
    let scale = 1
    const EJECT = 6

    // Flat state so the hot loop never touches React.
    const px = new Float64Array(N)
    const py = new Float64Array(N)
    const vx = new Float64Array(N)
    const vy = new Float64Array(N)
    const ax = new Float64Array(N)
    const ay = new Float64Array(N)
    const mass = new Float64Array(N)
    // Last pixel position per body, so each frame draws one trail segment.
    const lastX = new Float64Array(N)
    const lastY = new Float64Array(N)
    let haveLast = false

    // Pointer well, in world coordinates, eased in and out.
    let mouseX = 0
    let mouseY = 0
    let mouseOn = false
    let wellMass = 0 // eased 0 → target so the lean never jumps

    let raf = 0
    let last = 0
    let age = 0 // frames since the last reseed

    function rand(a: number, b: number) {
      return a + Math.random() * (b - a)
    }

    // Drop three equal-ish masses into a bounded random configuration with a
    // little spin, then remove the net momentum so the barycentre holds still.
    function reseed() {
      for (let i = 0; i < N; i++) {
        mass[i] = rand(0.9, 1.3)
        const ang = (i / N) * Math.PI * 2 + rand(-0.5, 0.5)
        const r = rand(0.7, 1.15)
        px[i] = Math.cos(ang) * r
        py[i] = Math.sin(ang) * r
        // A gentle tangential kick plus noise: enough to orbit, not to escape.
        const spin = rand(0.25, 0.5)
        vx[i] = -Math.sin(ang) * spin + rand(-0.15, 0.15)
        vy[i] = Math.cos(ang) * spin + rand(-0.15, 0.15)
      }
      zeroMomentumAndCentre()
      computeAccel()
      haveLast = false
      age = 0
    }

    // The figure-eight: Chenciner–Montgomery's exact periodic three-body orbit,
    // three equal masses on one shared figure-eight path. Used only for the
    // reduced-motion still, where it is integrated once and drawn complete.
    function seedFigureEight() {
      mass[0] = mass[1] = mass[2] = 1
      px[0] = 0.97000436
      py[0] = -0.24308753
      px[1] = -0.97000436
      py[1] = 0.24308753
      px[2] = 0
      py[2] = 0
      vx[2] = -0.93240737
      vy[2] = -0.86473146
      vx[0] = vx[1] = 0.93240737 / 2
      vy[0] = vy[1] = 0.86473146 / 2
      zeroMomentumAndCentre()
      computeAccel()
    }

    function zeroMomentumAndCentre() {
      let mSum = 0
      let cx = 0
      let cy = 0
      let mvx = 0
      let mvy = 0
      for (let i = 0; i < N; i++) {
        mSum += mass[i]
        cx += mass[i] * px[i]
        cy += mass[i] * py[i]
        mvx += mass[i] * vx[i]
        mvy += mass[i] * vy[i]
      }
      cx /= mSum
      cy /= mSum
      mvx /= mSum
      mvy /= mSum
      for (let i = 0; i < N; i++) {
        px[i] -= cx
        py[i] -= cy
        vx[i] -= mvx
        vy[i] -= mvy
      }
    }

    function computeAccel() {
      for (let i = 0; i < N; i++) {
        ax[i] = 0
        ay[i] = 0
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = px[j] - px[i]
          const dy = py[j] - py[i]
          const r2 = dx * dx + dy * dy + SOFT2
          const inv = 1 / (r2 * Math.sqrt(r2)) // 1 / (r²+ε²)^{3/2}
          const fi = G * mass[j] * inv
          const fj = G * mass[i] * inv
          ax[i] += dx * fi
          ay[i] += dy * fi
          ax[j] -= dx * fj
          ay[j] -= dy * fj
        }
      }
      // The pointer well: a soft extra mass pulling every body toward the cursor.
      if (wellMass > 0.0001) {
        for (let i = 0; i < N; i++) {
          const dx = mouseX - px[i]
          const dy = mouseY - py[i]
          const r2 = dx * dx + dy * dy + 0.25 // broad softening: a lean, not a yank
          const inv = 1 / (r2 * Math.sqrt(r2))
          const f = G * wellMass * inv
          ax[i] += dx * f
          ay[i] += dy * f
        }
      }
    }

    // One velocity-Verlet step: half-kick, drift, recompute, half-kick.
    function step(dt: number) {
      for (let i = 0; i < N; i++) {
        vx[i] += 0.5 * ax[i] * dt
        vy[i] += 0.5 * ay[i] * dt
        px[i] += vx[i] * dt
        py[i] += vy[i] * dt
      }
      computeAccel()
      for (let i = 0; i < N; i++) {
        vx[i] += 0.5 * ax[i] * dt
        vy[i] += 0.5 * ay[i] * dt
      }
    }

    function finite() {
      for (let i = 0; i < N; i++) {
        if (!Number.isFinite(px[i]) || !Number.isFinite(py[i])) return false
      }
      return true
    }

    function ejected() {
      for (let i = 0; i < N; i++) {
        if (px[i] * px[i] + py[i] * py[i] > EJECT * EJECT) return true
      }
      return false
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // World radius ~2.6 fits comfortably; scale so that spans the short side.
      scale = Math.min(w, h) / 5.2
      ctx!.fillStyle = '#050505'
      ctx!.fillRect(0, 0, w, h)
      haveLast = false
    }

    // Map a body's world position to pixels, barycentre pinned to canvas centre.
    function toPx(i: number) {
      return { x: w / 2 + px[i] * scale, y: h / 2 + py[i] * scale }
    }

    function drawBodies() {
      const cx = w / 2
      const cy = h / 2
      for (let i = 0; i < N; i++) {
        const p = toPx(i)
        const [r, g, b] = COLORS[i]
        if (haveLast) {
          // One trail segment from the previous frame's pixel to this one.
          ctx!.strokeStyle = `rgba(${r},${g},${b},0.9)`
          ctx!.lineWidth = 1.6
          ctx!.lineCap = 'round'
          ctx!.beginPath()
          ctx!.moveTo(lastX[i], lastY[i])
          ctx!.lineTo(p.x, p.y)
          ctx!.stroke()
        }
        lastX[i] = p.x
        lastY[i] = p.y
        // The star: a bright core with a soft bloom, bigger with mass.
        const rad = 2.2 + mass[i] * 1.6
        const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 3)
        grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.5)`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, rad * 3, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.fillStyle = `rgba(${r},${g},${b},1)`
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, rad, 0, Math.PI * 2)
        ctx!.fill()
      }
      // A faint lime marker at the barycentre the three forever balance about.
      ctx!.fillStyle = 'rgba(220,248,124,0.16)'
      ctx!.beginPath()
      ctx!.arc(cx, cy, 2, 0, Math.PI * 2)
      ctx!.fill()
      haveLast = true
    }

    resize()

    // Reduced motion: integrate the figure-eight once and paint it complete, no
    // loop, no pointer. One full period of the orbit is ~6.32 time units.
    if (reduce) {
      const paint = () => {
        ctx!.fillStyle = '#050505'
        ctx!.fillRect(0, 0, w, h)
        seedFigureEight()
        const dt = 0.002
        const steps = Math.round(6.4 / dt)
        // First lay the full shared path as a calm lime trace.
        ctx!.strokeStyle = 'rgba(220,248,124,0.5)'
        ctx!.lineWidth = 1.4
        ctx!.lineCap = 'round'
        ctx!.beginPath()
        let first = true
        for (let s = 0; s < steps; s++) {
          step(dt)
          const p = toPx(0)
          if (first) {
            ctx!.moveTo(p.x, p.y)
            first = false
          } else {
            ctx!.lineTo(p.x, p.y)
          }
        }
        ctx!.stroke()
        // Then the three bodies at their final, evenly-phased places on it.
        haveLast = false
        drawBodies()
      }
      paint()
      const ro = new ResizeObserver(() => {
        resize()
        paint()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseX = (e.clientX - rect.left - w / 2) / scale
      mouseY = (e.clientY - rect.top - h / 2) / scale
      mouseOn = true
    }
    function onLeave() {
      mouseOn = false
    }

    reseed()

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (!last) last = now
      let elapsed = (now - last) / 1000
      last = now
      if (elapsed > 0.05) elapsed = 0.05 // clamp after a tab-switch stall

      // Ease the pointer well toward its target so the lean is always gentle.
      const target = mouseOn && interactive ? 0.9 : 0
      wellMass += (target - wellMass) * 0.08

      // Dim the whole frame a hair toward ink: the feedback fade that leaves
      // each body a glowing comet tail without ever fully clearing the canvas.
      ctx!.fillStyle = 'rgba(5,5,5,0.085)'
      ctx!.fillRect(0, 0, w, h)

      // Advance the physics in small sub-steps for accuracy.
      const total = Math.min(0.05, elapsed) * 1.1 * speed
      const sub = 10
      const dt = total / sub
      for (let s = 0; s < sub; s++) step(dt)

      if (!finite() || ejected()) {
        if (age > 30) {
          // Paint the frame back to ink so the reseed doesn't jump-cut.
          ctx!.fillStyle = 'rgba(5,5,5,0.5)'
          ctx!.fillRect(0, 0, w, h)
          reseed()
        }
      }
      age++
      // Safety: reseed well before an integrator ever runs away for good.
      if (age > 60 * 26) reseed()

      drawBodies()
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
  }, [reduce, speed, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
