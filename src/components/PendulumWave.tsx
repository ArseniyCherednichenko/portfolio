import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A pendulum wave — a fanned rack of simple pendulums hung in a row, their
// lengths stepping longer to shorter so each swings at a slightly different
// rate. Where the other generative fields on the site grow from chaos (the
// Attractor), reaction (the Morphogen), or a flock (the Murmuration), this one
// grows from the plainest physics there is: a bob on a string, timed.
//
// The trick is the tuning. Over one shared cycle T the i-th pendulum completes
// exactly (BASE + i) full swings — an integer, so after T every bob returns to
// the same place at the same instant and the whole rack snaps back into a
// single line. In between, because no two rates match, the bobs drift out of
// step and the eye reads the drift as motion travelling along the rack:
// first a smooth snake, then a splitting into two and three waves, then a
// scatter that looks random but never is, then — because the counts are whole —
// a clean re-alignment. It is the Harvard lecture-hall demo, drawn in light.
//
// Each angle is a pure cosine of a frame-driven time phase, θ = A·cos(ω·t):
// no springs, no integration drift, no randomness, no Date.now — so it is
// stable across resizes and never trips the environment's guards. The rack is
// live: PRESS anywhere and the phase resets to zero, lifting every bob to the
// same side so the wave re-forms from a clean line under your hand (a spring
// eases the reset in, so it gathers rather than snaps). Longer strings hang as
// the slower, lower notes; the shorter ones race. Under reduced motion the loop
// never starts — a single frame is painted at a phase that shows one graceful
// wave, at rest. Decorative, so aria-hidden.

const COUNT = 18 // pendulums in the rack
const BASE = 9 // swings the longest pendulum completes per shared cycle
const CYCLE = 14 // shared re-alignment period, seconds
const AMP = 0.62 // swing amplitude, radians (~36deg)

export function PendulumWave({
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
    let step = 0 // horizontal gap between pivots
    let lenMax = 0 // longest rod, px
    let lenMin = 0 // shortest rod, px
    let bob = 0 // bob radius, px
    let raf = 0
    let t = 0 // seconds of phase, frame-accumulated — no wall clock
    let last = -1
    // Reset gathers the rack back to a clean line: `blend` eases the live phase
    // toward 0 so a press reads as a spring lift, not a jump cut.
    let blend = 0 // 1 right after a press, decays to 0

    // Per-pendulum angular frequency. The i-th completes (BASE + i) swings per
    // CYCLE, so ω = 2π·(BASE + i)/CYCLE. Whole-number counts guarantee the
    // shared re-alignment.
    const omega: number[] = []
    for (let i = 0; i < COUNT; i++) omega.push((2 * Math.PI * (BASE + i)) / CYCLE)
    // Longer string = slower swing. Real pendulum length scales as 1/ω², so the
    // rack fans from a long slow bob to a short quick one — tuned to the card.
    const invsq = omega.map((o) => 1 / (o * o))
    const sqMin = Math.min(...invsq)
    const sqMax = Math.max(...invsq)

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const padX = Math.min(w * 0.12, 96)
      left = padX
      step = (w - padX * 2) / (COUNT - 1)
      pivotY = Math.round(h * 0.14)
      lenMax = (h - pivotY) * 0.82
      lenMin = lenMax * 0.42
      bob = Math.max(4, Math.min(9, step * 0.24))
    }

    function lengthFor(i: number) {
      // Map the (already monotonic) 1/ω² spread onto the visible rod range.
      const u = (invsq[i] - sqMin) / (sqMax - sqMin || 1)
      return lenMin + u * (lenMax - lenMin)
    }

    function draw(phase: number) {
      ctx!.clearRect(0, 0, w, h)

      // The bar the rack hangs from — a faint rule with lit anchor points.
      ctx!.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(left - bob, pivotY)
      ctx!.lineTo(left + step * (COUNT - 1) + bob, pivotY)
      ctx!.stroke()

      for (let i = 0; i < COUNT; i++) {
        const px = left + step * i
        const len = lengthFor(i)
        const angle = AMP * Math.cos(omega[i] * phase)
        const bx = px + Math.sin(angle) * len
        const by = pivotY + Math.cos(angle) * len

        // String.
        ctx!.strokeStyle = 'rgba(255,255,255,0.14)'
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.moveTo(px, pivotY)
        ctx!.lineTo(bx, by)
        ctx!.stroke()

        // Pivot anchor.
        ctx!.fillStyle = 'rgba(255,255,255,0.28)'
        ctx!.beginPath()
        ctx!.arc(px, pivotY, 1.5, 0, Math.PI * 2)
        ctx!.fill()

        // Bob — a lime disc with an additive glow, brightest at the turning
        // points where it hangs an instant. |sin(angle)|/AMP peaks at the edges.
        const edge = Math.min(1, Math.abs(Math.sin(angle)) / Math.sin(AMP))
        const glow = 0.35 + edge * 0.55
        ctx!.save()
        ctx!.globalCompositeOperation = 'lighter'
        const g = ctx!.createRadialGradient(bx, by, 0, bx, by, bob * 3.4)
        g.addColorStop(0, `rgba(${ar},${ag},${ab},${glow})`)
        g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
        ctx!.fillStyle = g
        ctx!.beginPath()
        ctx!.arc(bx, by, bob * 3.4, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.restore()

        ctx!.fillStyle = `rgba(${ar},${ag},${ab},0.92)`
        ctx!.beginPath()
        ctx!.arc(bx, by, bob, 0, Math.PI * 2)
        ctx!.fill()
        // A cool highlight so the bob reads as a sphere, not a flat dot.
        ctx!.fillStyle = 'rgba(255,255,255,0.5)'
        ctx!.beginPath()
        ctx!.arc(bx - bob * 0.32, by - bob * 0.32, bob * 0.34, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    layout()

    if (reduce) {
      // A single still frame at a phase that shows one clean travelling wave.
      draw(CYCLE * 0.11)
      const ro = new ResizeObserver(() => {
        layout()
        draw(CYCLE * 0.11)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away so it never jumps

      // The eased phase: `blend` decays each frame, scaling the live phase down
      // toward a fresh line after a press.
      blend *= 0.9
      if (blend < 0.001) blend = 0
      t += dt
      const phase = t * (1 - blend)

      draw(phase)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // Press to gather the rack: lift `blend` to 1 and rebase `t` so the eased
    // phase starts from zero — every bob to the same side, then the wave re-forms.
    function reset() {
      blend = 1
      t = 0
      last = -1
    }
    canvas.addEventListener('pointerdown', reset)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', reset)
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
