import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Superformula — one equation, drawn over and over, that turns two numbers into
// every shape between a circle and a starfish. Johan Gielis's superformula gives
// a radius for each angle,
//
//     r(θ) = ( |cos(mθ/4)|^n2 + |sin(mθ/4)|^n3 )^(-1/n1)
//
// and that is the whole generator. The single parameter m sets the symmetry —
// how many lobes the figure has — so sweeping it from 3 to about 16 walks the
// outline through triangles, flowers, gears, stars and rosettes without a break;
// n1 sets how sharp or how swollen those lobes are, from soft petals to needle
// spikes. Two knobs, and out of them falls the vocabulary of shapes that shows
// up everywhere in nature, from starfish to diatoms to flowers, none of it
// shaped by hand.
//
// Here it is drawn not once but as a bloom of nested rings, each a supershape at
// a slightly turned phase and a slightly evolved m, tinted teal at the core and
// warming to the site's lime at the rim, so the figure reads as a living rose
// window rather than a single outline. Left to itself the symmetry breathes
// slowly up and down and the rings counter-rotate, so it is never still. The
// pointer takes the two knobs directly: move across to drive the symmetry m,
// move up and down to drive the sharpness n1, and the whole bloom morphs under
// your hand, easing toward wherever you point and drifting back to its own
// breathing when you let go.
//
// Kin to the Phyllotaxis, Spirograph and Harmonograph in this family — all of
// them one closed form sampled densely — but where those trace a path that winds
// through the plane, this one solves a radius per angle and closes a curve. One
// canvas, one rAF loop, DPR-capped and resize-driven; each ring is a few hundred
// sampled points, no per-point React state and no wall clock beyond a smooth
// frame counter. The canvas is decorative and aria-hidden with an sr-only
// account of what it is. Under reduced motion nothing animates: one settled
// bloom is computed at a pleasing symmetry and painted still, and the pointer
// does not drive it.

interface SuperformulaProps {
  className?: string
}

const RINGS = 9 // nested supershapes, core to rim
const SAMPLES = 480 // points per closed curve
const DPR_CAP = 2
const EASE = 0.06 // how fast live params chase their target

// Autonomous targets when the pointer is idle: symmetry breathes, sharpness rolls.
const M_MIN = 3
const M_MAX = 15
const N1_MIN = 0.3
const N1_MAX = 3.2

// Tint by ring: the core sits cool teal, the outer rings warm to lime.
function tint(t: number, alpha: number): string {
  const hue = 176 - t * 104 // 176 (teal) -> 72 (lime)
  const light = 50 + t * 22
  return `hsla(${hue}, 82%, ${light}%, ${alpha})`
}

export function Superformula({ className }: SuperformulaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let raf = 0
    let t = 0 // smooth frame counter, not a wall clock

    // Live parameters, eased toward a target every frame.
    const live = { m: 6, n1: 1, n2: 1.2, n3: 1.2 }
    const pointer = { x: 0, y: 0, active: false }

    // The superformula radius at one angle, given a lobe count and shape knobs.
    function radius(theta: number, m: number, n1: number, n2: number, n3: number): number {
      const t1 = Math.abs(Math.cos((m * theta) / 4))
      const t2 = Math.abs(Math.sin((m * theta) / 4))
      const sum = Math.pow(t1, n2) + Math.pow(t2, n3)
      // Guard the pole where sum underflows before the negative power blows up.
      return Math.pow(Math.max(sum, 1e-6), -1 / n1)
    }

    // Trace one closed supershape, scaled to `scale` px and turned by `phase`.
    function ringPath(
      g: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      scale: number,
      phase: number,
      m: number,
      n1: number,
      n2: number,
      n3: number,
    ) {
      g.beginPath()
      for (let i = 0; i <= SAMPLES; i++) {
        const theta = (i / SAMPLES) * Math.PI * 2
        const r = radius(theta, m, n1, n2, n3) * scale
        const a = theta + phase
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
    }

    function paint() {
      const g = ctx!
      g.clearRect(0, 0, width, height)
      g.fillStyle = '#040404'
      g.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      // A supershape's radius peaks near ~1.4; leave a margin from the frame.
      const unit = Math.min(width, height) * 0.34

      g.lineCap = 'round'
      g.lineJoin = 'round'

      for (let k = 0; k < RINGS; k++) {
        const ratio = (k + 1) / RINGS // 0..1 core -> rim
        const scale = unit * ratio
        // Each ring evolves m a touch and counter-rotates, so the bloom turns.
        const m = live.m + (k - RINGS / 2) * 0.5
        const phase = t * 0.004 * (k % 2 === 0 ? 1 : -1) + k * 0.3
        const n1 = live.n1 + ratio * 0.4
        ringPath(g, cx, cy, scale, phase, m, n1, live.n2, live.n3)
        g.lineWidth = 1 + ratio * 0.6
        g.strokeStyle = tint(ratio, 0.16 + ratio * 0.5)
        g.stroke()
      }

      // A soft lime core anchors the centre of the bloom.
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.5)
      glow.addColorStop(0, 'rgba(220, 248, 124, 0.12)')
      glow.addColorStop(1, 'rgba(220, 248, 124, 0)')
      g.fillStyle = glow
      g.fillRect(0, 0, width, height)
    }

    function step() {
      t += 1
      // Choose targets: the pointer drives m and n1 directly when it is down;
      // otherwise both breathe on their own slow cycles.
      let mTarget: number
      let n1Target: number
      if (pointer.active) {
        const fx = Math.min(1, Math.max(0, pointer.x / Math.max(1, width)))
        const fy = Math.min(1, Math.max(0, pointer.y / Math.max(1, height)))
        mTarget = M_MIN + fx * (M_MAX - M_MIN)
        n1Target = N1_MAX - fy * (N1_MAX - N1_MIN) // up = sharper
      } else {
        mTarget = M_MIN + (M_MAX - M_MIN) * (0.5 + 0.5 * Math.sin(t * 0.006))
        n1Target = N1_MIN + (N1_MAX - N1_MIN) * (0.5 + 0.5 * Math.sin(t * 0.009 + 1.3))
      }
      live.m += (mTarget - live.m) * EASE
      live.n1 += (n1Target - live.n1) * EASE
    }

    function frame() {
      step()
      paint()
      raf = requestAnimationFrame(frame)
    }

    // For reduced motion: settle on a pleasing symmetry and paint one still bloom.
    function settle() {
      live.m = 6
      live.n1 = 1
      live.n2 = 1.2
      live.n3 = 1.2
      paint()
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(width * dpr)
      canvas!.height = Math.floor(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduce) settle()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    if (!reduce) {
      const toLocal = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect()
        pointer.x = e.clientX - rect.left
        pointer.y = e.clientY - rect.top
      }
      const onDown = (e: PointerEvent) => {
        toLocal(e)
        pointer.active = true
      }
      const onMove = (e: PointerEvent) => {
        if (!pointer.active && e.pressure === 0) return
        toLocal(e)
        pointer.active = true
      }
      const onUp = () => {
        pointer.active = false
      }
      const onLeave = () => {
        pointer.active = false
      }
      canvas.addEventListener('pointerdown', onDown)
      canvas.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      canvas.addEventListener('pointerleave', onLeave)
      canvas.style.touchAction = 'none'

      raf = requestAnimationFrame(frame)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        canvas.removeEventListener('pointerdown', onDown)
        canvas.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        canvas.removeEventListener('pointerleave', onLeave)
      }
    }

    return () => {
      ro.disconnect()
    }
  }, [reduce])

  return (
    <div className={className} style={{ position: 'relative' }}>
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" style={{ display: 'block' }} />
      <span className="sr-only">
        A live superformula bloom: nested supershapes whose symmetry and sharpness morph on their own and follow the
        pointer.
      </span>
    </div>
  )
}
