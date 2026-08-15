import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Newton's cradle — a line of equal steel bobs hung so they just kiss at
// rest. Lift the end one and let it fall: it stops dead on contact and an equal
// one leaps off the far side, because between equal masses an elastic collision
// simply hands the whole of one bob's momentum to the next. It is the classic
// desk toy, and the deliberate counterpart to the Pendulum wave beside it —
// there the pendulums are *uncoupled*, each keeping its own time so the eye
// reads drift; here they are *coupled*, touching, so the story is the transfer
// of a single blow straight down the line.
//
// The physics is honest, not faked. Each bob is a real simple pendulum
// integrated by semi-implicit Euler (α = -(g/L)·sinθ) at a fixed substep, and a
// contact is resolved the textbook way: when two neighbours overlap, equal
// masses on equal strings swap their angular velocities and are nudged back to
// the kiss so they never stick. Sweeping the resolver along the row each substep
// lets one impact ripple through the whole chain within a frame, so "one in,
// one out" (and two-in-two-out) fall straight out of the rule rather than being
// scripted. A struck bob briefly sparks so the eye can follow the blow.
//
// It is alive: it mounts already swinging and runs all but frictionless, so it
// keeps going. PRESS AND DRAG an end bob to lift it — the rest hang still under
// your hand — and RELEASE to let it fall; a plain press near an end lifts and
// releases it for you. No wall clock and no randomness — the loop runs off the
// rAF delta — so it is resize-stable and never trips the environment's guards.
// Under reduced motion the loop never starts: one bob is painted lifted, mid-
// fall arrested, so the toy still reads at a glance. Decorative, so aria-hidden.

const COUNT = 5 // bobs in the line
const G = 2600 // gravity, px/s² — tuned to the card, not earth
const MAX_ANGLE = 1.02 // furthest a bob can be lifted, radians (~58deg)
const DAMP = 0.99985 // per-substep velocity retention — all but frictionless
const SUBSTEPS = 5 // integration substeps per frame, for crisp contacts

export function Cradle({
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
    let pivotY = 0
    let left = 0
    let step = 0 // horizontal gap between pivots (= bob diameter at rest)
    let len = 0 // string length, px
    let bob = 0 // bob radius, px
    let raf = 0
    let last = -1

    // State per bob: angle from vertical (θ, +x is right), angular velocity, and
    // a decaying impact flash lit on contact.
    const theta = new Array<number>(COUNT).fill(0)
    const omega = new Array<number>(COUNT).fill(0)
    const flash = new Array<number>(COUNT).fill(0)

    let dragIndex = -1 // 0 or COUNT-1 while an end bob is held, else -1

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      pivotY = Math.round(h * 0.16)
      // Size the whole rack to the smaller constraint so it always fits: the row
      // of COUNT touching bobs across the width, and the string+bob down the height.
      const availW = w * 0.72
      const availH = (h - pivotY) * 0.92
      // Solve for a bob radius that fits both: width wants 2r·COUNT, height wants
      // len + 2r with len ≈ 3.4·(2r).
      const rByW = availW / (2 * COUNT)
      const rByH = availH / (2 + 2 * 3.4)
      bob = Math.max(6, Math.min(rByW, rByH, 34))
      step = 2 * bob
      len = bob * 2 * 3.4
      const rackW = step * (COUNT - 1)
      left = (w - rackW) / 2
    }

    function pivotX(i: number) {
      return left + step * i
    }

    // One elastic contact pass: neighbours that have overlapped swap velocities
    // (equal mass, equal string) and are separated back to the kiss.
    function resolve() {
      for (let i = 0; i < COUNT - 1; i++) {
        // Bobs touch when the right one has swung left of / into the left one:
        // gap ∝ sin(θ_{i+1}) − sin(θ_i); overlap when that turns negative.
        if (Math.sin(theta[i + 1]) - Math.sin(theta[i]) < 0) {
          const approaching = omega[i] > omega[i + 1]
          // Correct positions to the shared contact angle so they never stick.
          const mid = (theta[i] + theta[i + 1]) / 2
          theta[i] = mid
          theta[i + 1] = mid
          if (approaching) {
            const tmp = omega[i]
            omega[i] = omega[i + 1]
            omega[i + 1] = tmp
            const hit = Math.min(1, Math.abs(tmp) * 0.06 + 0.25)
            flash[i] = Math.max(flash[i], hit)
            flash[i + 1] = Math.max(flash[i + 1], hit)
          }
        }
      }
    }

    function integrate(dt: number) {
      const sub = dt / SUBSTEPS
      for (let s = 0; s < SUBSTEPS; s++) {
        for (let i = 0; i < COUNT; i++) {
          if (i === dragIndex) continue // held bob is driven by the pointer
          omega[i] += -(G / len) * Math.sin(theta[i]) * sub
          omega[i] *= DAMP
          theta[i] += omega[i] * sub
        }
        // Sweep both directions so a blow can propagate through the whole line
        // and a returning wave resolves in the same substep.
        resolve()
        for (let i = COUNT - 2; i >= 0; i--) {
          if (Math.sin(theta[i + 1]) - Math.sin(theta[i]) < 0) {
            const approaching = omega[i] > omega[i + 1]
            const mid = (theta[i] + theta[i + 1]) / 2
            theta[i] = mid
            theta[i + 1] = mid
            if (approaching) {
              const tmp = omega[i]
              omega[i] = omega[i + 1]
              omega[i + 1] = tmp
            }
          }
        }
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h)

      // The beam the cradle hangs from — a faint rule with lit anchor points.
      ctx!.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      ctx!.moveTo(pivotX(0) - bob, pivotY)
      ctx!.lineTo(pivotX(COUNT - 1) + bob, pivotY)
      ctx!.stroke()

      for (let i = 0; i < COUNT; i++) {
        const px = pivotX(i)
        const bx = px + Math.sin(theta[i]) * len
        const by = pivotY + Math.cos(theta[i]) * len

        // String.
        ctx!.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.moveTo(px, pivotY)
        ctx!.lineTo(bx, by)
        ctx!.stroke()

        // Pivot anchor.
        ctx!.fillStyle = 'rgba(255,255,255,0.3)'
        ctx!.beginPath()
        ctx!.arc(px, pivotY, 1.6, 0, Math.PI * 2)
        ctx!.fill()

        // Glow — brightest when lifted (carrying energy) and on a fresh impact.
        const lift = Math.min(1, Math.abs(theta[i]) / MAX_ANGLE)
        const glow = 0.28 + lift * 0.5 + flash[i] * 0.6
        ctx!.save()
        ctx!.globalCompositeOperation = 'lighter'
        const g = ctx!.createRadialGradient(bx, by, 0, bx, by, bob * 3)
        g.addColorStop(0, `rgba(${ar},${ag},${ab},${Math.min(0.95, glow)})`)
        g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
        ctx!.fillStyle = g
        ctx!.beginPath()
        ctx!.arc(bx, by, bob * 3, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.restore()

        // The bob — a lime sphere with a shaded body and a cool highlight.
        const body = ctx!.createRadialGradient(
          bx - bob * 0.3,
          by - bob * 0.3,
          bob * 0.1,
          bx,
          by,
          bob,
        )
        body.addColorStop(0, `rgba(${ar},${ag},${ab},1)`)
        body.addColorStop(1, `rgba(${ar},${ag},${ab},0.72)`)
        ctx!.fillStyle = body
        ctx!.beginPath()
        ctx!.arc(bx, by, bob, 0, Math.PI * 2)
        ctx!.fill()

        ctx!.fillStyle = 'rgba(255,255,255,0.55)'
        ctx!.beginPath()
        ctx!.arc(bx - bob * 0.34, by - bob * 0.34, bob * 0.3, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    layout()

    if (reduce) {
      // A still frame: the left bob caught mid-fall so the toy reads at a glance.
      theta[0] = -MAX_ANGLE * 0.6
      draw()
      const ro = new ResizeObserver(() => {
        layout()
        draw()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Mount already in motion so it is alive on arrival.
    theta[0] = -MAX_ANGLE * 0.82

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away so it never jumps

      integrate(dt)
      for (let i = 0; i < COUNT; i++) {
        flash[i] *= 0.86
        if (flash[i] < 0.01) flash[i] = 0
      }
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // Pointer: grab the nearer end bob, drive its angle by hand while the rest
    // hang still, release to let it fall. A quick press with no drag lifts and
    // releases the near end for you.
    function angleFromPointer(i: number, clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect()
      const dx = clientX - rect.left - pivotX(i)
      const dy = Math.max(1, clientY - rect.top - pivotY)
      let a = Math.atan2(dx, dy)
      // End bobs only lift outward: bob 0 to the left, the last to the right.
      if (i === 0) a = Math.max(-MAX_ANGLE, Math.min(0, a))
      else a = Math.max(0, Math.min(MAX_ANGLE, a))
      return a
    }

    function onDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      dragIndex = x < w / 2 ? 0 : COUNT - 1
      // Still the rack so the held bob lifts alone.
      for (let i = 0; i < COUNT; i++) {
        omega[i] = 0
        if (i !== dragIndex) theta[i] = 0
      }
      theta[dragIndex] = angleFromPointer(dragIndex, e.clientX, e.clientY)
      canvas!.setPointerCapture?.(e.pointerId)
    }
    function onMove(e: PointerEvent) {
      if (dragIndex < 0) return
      theta[dragIndex] = angleFromPointer(dragIndex, e.clientX, e.clientY)
      omega[dragIndex] = 0
    }
    function onUp() {
      if (dragIndex < 0) return
      // If barely lifted (a tap, not a drag), give it a clean starting lift.
      if (Math.abs(theta[dragIndex]) < 0.12) {
        theta[dragIndex] = dragIndex === 0 ? -MAX_ANGLE * 0.7 : MAX_ANGLE * 0.7
      }
      omega[dragIndex] = 0
      dragIndex = -1
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full cursor-pointer touch-none ${className}`}
    />
  )
}
