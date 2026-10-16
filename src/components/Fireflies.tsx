import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Fireflies: a meadow of drifting lights that start blinking out of step and,
// over a handful of seconds, pull one another into unison. It sits deliberately
// apart from the other living fields in the Playground. Murmuration is a flock
// steering by position — separation, alignment, cohesion — and its shape is the
// emergent thing. ParticleLife is chemistry, attraction and repulsion between
// coloured species. This one is neither about where the agents go nor what they
// do to each other in space; it is about *time*. Each firefly is a phase
// oscillator with its own slightly different natural rhythm, and the only
// coupling is the one real fireflies use: see a neighbour flash and nudge your
// own clock a touch toward theirs. That single rule — the Kuramoto model, the
// genuine mechanism behind the Southeast-Asian fireflies that flash a whole
// riverbank in time — is enough for a field that opens as random sparkle and
// condenses into a slow collective pulse. Nobody conducts it; synchrony falls
// out of a hundred clocks each watching only its nearest neighbours.
//
// The cursor is a lantern. Hover and the nearby flies drift toward the light
// and couple harder, so a pocket of the meadow locks up around you first. Press
// and you flash: your own steady pulse becomes a strong driver the neighbours
// chase, so you can lead the whole field into your rhythm.
//
// One <canvas>, one RAF loop, DPR-aware and ResizeObserver-driven, the whole
// field in flat typed arrays with no React state on the hot path. Phases are
// advanced from a read of the previous frame's state before any clock moves, so
// the field couples in lockstep rather than in reading order. dt is clamped so a
// backgrounded tab can never jump the clocks. Each frame is cleared rather than
// trailed — fireflies blink, they do not smear — and the glows composite
// additively so an in-step cluster reads as one swelling pool of light. Seeded
// so the opening desync is lively but identical each mount. aria-hidden — purely
// decorative. Under reduced motion the loop never starts: the field is advanced
// by a fixed number of silent steps to a mid-synchrony moment and drawn once, a
// calm still meadow with some flies lit and some dark.

const TWO_PI = Math.PI * 2
const DRIFT_SPEED = 20 // px/s — a slow, idle wander
const TURN_RATE = 1.5 // rad/s cap on how fast a fly re-aims its drift
const COUPLE_R = 132 // neighbour-sight radius for phase coupling
const COUPLE_R2 = COUPLE_R * COUPLE_R
const K = 2.3 // base coupling strength — strong enough to lock the field
const EDGE_MARGIN = 40
const POINTER_R = 180
const POINTER_PULL = 46 // px/s^2 gentle drift toward a hovering lantern
const POINTER_COUPLE = 3.4 // extra coupling for flies inside the lantern's reach
const DRIVER_K = 5.5 // how hard a pressed-cursor flash drives its neighbours
const FLASH_SHARP = 9 // exponent on the flash envelope — higher is a crisper blink
const MAX_DT = 1 / 30
const MAX_DPR = 2

export function Fireflies({
  count = 94,
  accent = '220,248,124', // lime, as "r,g,b", matched to the host panel
  className = '',
}: {
  /** How many fireflies populate the meadow. */
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

    // Flat, allocation-free state for the whole meadow.
    const px = new Float32Array(count)
    const py = new Float32Array(count)
    const phase = new Float32Array(count) // clock position in [0, 2π)
    const omega = new Float32Array(count) // natural angular frequency, rad/s
    const heading = new Float32Array(count) // drift direction
    const next = new Float32Array(count) // phases staged for lockstep update
    const warm = new Float32Array(count) // 0..1 lean toward the lantern's lime

    // Pointer, in local canvas coordinates. active = present, down = driving.
    const pointer = { x: 0, y: 0, active: false, down: false }
    let driver = 0 // the pressed lantern's own steady pulse

    // Seeded PRNG (mulberry32-ish) so the opening desync is identical each mount
    // and never pulls per-frame entropy.
    let seed = 20260815
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    function build() {
      for (let i = 0; i < count; i++) {
        px[i] = W * (0.06 + rand() * 0.88)
        py[i] = H * (0.06 + rand() * 0.88)
        phase[i] = rand() * TWO_PI // scattered clocks — the field opens out of step
        // Natural periods cluster near ~1.4s with a small spread, so coupling
        // has differences to reconcile but the lock is reachable.
        omega[i] = TWO_PI * (0.62 + rand() * 0.2)
        heading[i] = rand() * TWO_PI
        warm[i] = 0
      }
    }

    // A sharp once-per-cycle flash: bright only as the phase sweeps through 0.
    function flash(theta: number) {
      const c = Math.cos(theta)
      return c > 0 ? Math.pow(c, FLASH_SHARP) : 0
    }

    function step(dt: number) {
      if (pointer.down) driver = (driver + TWO_PI * 0.72 * dt) % TWO_PI

      for (let i = 0; i < count; i++) {
        // --- phase coupling: watch the neighbours, nudge my clock toward theirs
        let sum = 0
        let n = 0
        const xi = px[i]
        const yi = py[i]
        for (let j = 0; j < count; j++) {
          if (j === i) continue
          const dx = px[j] - xi
          const dy = py[j] - yi
          if (dx * dx + dy * dy > COUPLE_R2) continue
          sum += Math.sin(phase[j] - phase[i])
          n++
        }
        let dtheta = omega[i]
        if (n > 0) dtheta += (K / n) * sum

        // The lantern: flies inside its reach couple harder, and when it is
        // pressed its own steady pulse becomes a strong driver they chase.
        let near = false
        if (pointer.active) {
          const dx = pointer.x - xi
          const dy = pointer.y - yi
          const d2 = dx * dx + dy * dy
          if (d2 < POINTER_R * POINTER_R) {
            near = true
            const fall = 1 - Math.sqrt(d2) / POINTER_R
            if (pointer.down) dtheta += DRIVER_K * fall * Math.sin(driver - phase[i])
            else if (n > 0) dtheta += (POINTER_COUPLE / n) * fall * sum
          }
        }
        next[i] = (phase[i] + dtheta * dt) % TWO_PI
        if (next[i] < 0) next[i] += TWO_PI

        // warm toward lime inside the lantern, cool back out of it
        const target = near ? 1 : 0
        warm[i] += (target - warm[i]) * Math.min(1, dt * 4)
      }

      // --- drift: a slow idle wander, banking away from the walls
      for (let i = 0; i < count; i++) {
        phase[i] = next[i]
        heading[i] += (rand() - 0.5) * TURN_RATE * dt
        let hx = Math.cos(heading[i])
        let hy = Math.sin(heading[i])
        const xi = px[i]
        const yi = py[i]
        if (pointer.active && !pointer.down) {
          const dx = pointer.x - xi
          const dy = pointer.y - yi
          const d = Math.hypot(dx, dy)
          if (d < POINTER_R && d > 0.001) {
            const fall = 1 - d / POINTER_R
            hx += (dx / d) * (POINTER_PULL / DRIFT_SPEED) * fall
            hy += (dy / d) * (POINTER_PULL / DRIFT_SPEED) * fall
          }
        }
        // soft turn-in near the edges so the meadow stays in frame
        if (xi < EDGE_MARGIN) hx += (1 - xi / EDGE_MARGIN)
        else if (xi > W - EDGE_MARGIN) hx -= (1 - (W - xi) / EDGE_MARGIN)
        if (yi < EDGE_MARGIN) hy += (1 - yi / EDGE_MARGIN)
        else if (yi > H - EDGE_MARGIN) hy -= (1 - (H - yi) / EDGE_MARGIN)
        const hm = Math.hypot(hx, hy) || 1
        px[i] = Math.max(2, Math.min(W - 2, xi + (hx / hm) * DRIFT_SPEED * dt))
        py[i] = Math.max(2, Math.min(H - 2, yi + (hy / hm) * DRIFT_SPEED * dt))
      }
    }

    function drawFly(i: number) {
      const x = px[i]
      const y = py[i]
      const f = flash(phase[i])
      // Always a faint ember; the flash swells it into a soft pool of light.
      const w = warm[i]
      // Core leans warm white-gold; the lantern's flies pull toward clean lime.
      const r = Math.round(255 - 40 * w)
      const g = Math.round(248 - 6 * (1 - w))
      const b = Math.round(150 + 70 * (1 - f))
      const emberR = 1.6
      ctx!.beginPath()
      ctx!.arc(x, y, emberR, 0, TWO_PI)
      ctx!.fillStyle = `rgba(${accent},${0.16 + 0.1 * w})`
      ctx!.fill()
      if (f <= 0.004) return
      const glowR = 3 + f * 20
      const grad = ctx!.createRadialGradient(x, y, 0, x, y, glowR)
      grad.addColorStop(0, `rgba(${r},${g},${b},${0.9 * f})`)
      grad.addColorStop(0.4, `rgba(${accent},${0.5 * f})`)
      grad.addColorStop(1, `rgba(${accent},0)`)
      ctx!.beginPath()
      ctx!.arc(x, y, glowR, 0, TWO_PI)
      ctx!.fillStyle = grad
      ctx!.fill()
    }

    function paint() {
      ctx!.clearRect(0, 0, W, H)
      ctx!.globalCompositeOperation = 'lighter'
      for (let i = 0; i < count; i++) drawFly(i)
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
      paint()
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
      // Advance to a mid-synchrony moment — partly locked, not a frozen pulse —
      // then draw it once. Deterministic, identical each mount. No loop.
      for (let k = 0; k < 360; k++) step(1 / 60)
      paint()
      const roStill = new ResizeObserver(() => {
        seed = 20260815
        measure()
        build()
        for (let k = 0; k < 360; k++) step(1 / 60)
        paint()
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
