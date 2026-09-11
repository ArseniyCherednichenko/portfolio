import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Oscilloscope — a cathode-ray tube in XY mode, drawing Lissajous figures the
// way a real scope does: one beam sweeping a single point around a curve, and a
// phosphor coating that keeps glowing for a moment after the beam has moved on,
// so the whole figure hangs in the dark, brightest where the beam just was and
// fading behind it. It is the honest counterpart to the Harmonograph and the
// Fourier trace next door — where the Harmonograph is a damped pen on paper that
// spirals to a stop and Fourier stacks turning circles to redraw a fixed path,
// this holds no memory of its own: the figure you see is a decaying afterimage
// of a point still moving.
//
// The curve is the classic pair of perpendicular sines. Feed the horizontal
// plates x = sin(fx·u + δ) and the vertical plates y = sin(fy·u), sweep the
// parameter u, and the beam traces a Lissajous figure whose shape is set only by
// the frequency ratio fx:fy — 1:1 is an ellipse, 3:2 a trefoil, 5:4 a woven
// lattice. A whole-number ratio gives a closed, standing figure; nudge fx a
// hair off and the curve never quite closes, so it precesses — the standing
// figure slowly turning, which on a bench scope means the two oscillators have
// drifted out of lock. A slow, deliberate detune (δ creeping each frame) keeps
// even a locked ratio gently rotating, so it is never dead still.
//
// Persistence is real, not painted on. Nothing is cleared between frames; each
// frame the whole face is dimmed by a thin wash of the background colour, and
// the new stretch of beam is added in 'lighter' so overlapping passes bloom
// toward white the way excited phosphor does. The tail you see is the literal
// sum of how long ago each point was struck. A faint graticule is re-laid every
// frame at low alpha so it holds a steady glow through the dimming.
//
// The pointer drives the oscillators: horizontal position sets the target
// frequency ratio (sweeping fx across a run of musical ratios), vertical sets
// the sweep speed and the amount of detune, so a still hand holds a shape and a
// moving one walks it through the family. It eases home to a slow idle trefoil
// when the cursor leaves. One canvas, one requestAnimationFrame loop off the
// clamped frame delta (no wall clock, so a tab-away cannot jump the sweep),
// DPR-capped and cleaned up on unmount. Decorative, so aria-hidden. Under
// prefers-reduced-motion the beam never sweeps: one closed figure at a whole
// ratio is drawn once as a steady glowing line and held, and re-drawn on resize.

const ACCENT: readonly [number, number, number] = [220, 248, 124]
const BG = '4,5,4'

// A run of frequency ratios the pointer sweeps fx across, fy held at 2. Chosen
// so the figure walks a pleasing family: ellipse, trefoil, and on up into denser
// woven lattices as the cursor moves right.
const RATIOS = [1, 1.5, 2, 3, 4, 5]

export function Oscilloscope({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = ACCENT
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const fy = 2

    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let radius = 1

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      radius = Math.min(w, h) * 0.38
      // Start from a solid dark face so the first frames don't build up.
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.fillStyle = `rgb(${BG})`
      ctx!.fillRect(0, 0, w, h)
    }

    // The faint scope graticule: a centre cross and a light frame of ticks,
    // re-laid every frame so it survives the persistence dimming at a steady
    // low glow.
    function grid() {
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.lineWidth = 1
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},0.05)`
      ctx!.beginPath()
      ctx!.moveTo(cx - radius, cy)
      ctx!.lineTo(cx + radius, cy)
      ctx!.moveTo(cx, cy - radius)
      ctx!.lineTo(cx, cy + radius)
      ctx!.stroke()
      // Tick marks along the two axes.
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},0.08)`
      ctx!.beginPath()
      for (let i = -4; i <= 4; i++) {
        if (i === 0) continue
        const p = (i / 4) * radius
        ctx!.moveTo(cx + p, cy - 4)
        ctx!.lineTo(cx + p, cy + 4)
        ctx!.moveTo(cx - 4, cy + p)
        ctx!.lineTo(cx + 4, cy + p)
      }
      ctx!.stroke()
    }

    // Map a Lissajous parameter u to a screen point for the current fx/δ.
    function point(u: number, fx: number, delta: number): [number, number] {
      const x = Math.sin(fx * u + delta)
      const y = Math.sin(fy * u)
      return [cx + x * radius, cy + y * radius]
    }

    layout()

    if (reduce) {
      // A single closed figure at a whole ratio, drawn once as a steady glow.
      const fx = 3
      const draw = () => {
        ctx!.globalCompositeOperation = 'source-over'
        ctx!.fillStyle = `rgb(${BG})`
        ctx!.fillRect(0, 0, w, h)
        grid()
        ctx!.globalCompositeOperation = 'lighter'
        ctx!.lineWidth = 1.6
        ctx!.lineCap = 'round'
        ctx!.strokeStyle = `rgba(${ar},${ag},${ab},0.7)`
        ctx!.beginPath()
        const N = 1400
        for (let i = 0; i <= N; i++) {
          const u = (i / N) * Math.PI * 2
          const [px, py] = point(u, fx, 0)
          if (i === 0) ctx!.moveTo(px, py)
          else ctx!.lineTo(px, py)
        }
        ctx!.stroke()
        ctx!.globalCompositeOperation = 'source-over'
      }
      draw()
      const ro = new ResizeObserver(() => {
        layout()
        draw()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Live sweep state.
    let beam = 0 // beam parameter u, radians, always advancing
    let fx = 3 // current horizontal frequency
    let fxTarget = 3
    let delta = 0 // detune phase, creeps to precess the figure
    let speed = 3.2 // beam sweep rate, rad/s
    let speedTarget = 3.2
    let detuneRate = 0.12 // rad/s that δ creeps

    // Eased pointer lean; falls back to idle when the cursor is away.
    let leanX = 0.4 // 0..1 across the ratio run
    let leanY = 0.35 // 0..1 speed/detune
    let targetX = 0.4
    let targetY = 0.35

    let raf = 0
    let last = performance.now()

    function ratioAt(t: number): number {
      // Interpolate across the RATIOS run by the 0..1 lean.
      const s = Math.max(0, Math.min(1, t)) * (RATIOS.length - 1)
      const i = Math.floor(s)
      const f = s - i
      const a = RATIOS[i]
      const b = RATIOS[Math.min(RATIOS.length - 1, i + 1)]
      return a + (b - a) * f
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      // Ease pointer lean home so the figure is calm when untouched.
      leanX += (targetX - leanX) * Math.min(1, dt * 3)
      leanY += (targetY - leanY) * Math.min(1, dt * 3)

      fxTarget = ratioAt(leanX)
      fx += (fxTarget - fx) * Math.min(1, dt * 2.5)
      speedTarget = 2.2 + leanY * 4.5
      speed += (speedTarget - speed) * Math.min(1, dt * 2.5)
      detuneRate = 0.05 + leanY * 0.35

      delta += detuneRate * dt

      // Dim the whole face — this is the phosphor decay.
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.fillStyle = `rgba(${BG},0.12)`
      ctx!.fillRect(0, 0, w, h)
      grid()

      // Advance the beam and draw the freshly swept stretch, additively so
      // overlapping passes bloom toward white like real phosphor.
      const du = speed * dt
      const steps = Math.max(2, Math.ceil(du / 0.012))
      ctx!.globalCompositeOperation = 'lighter'
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      ctx!.lineWidth = 1.6
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},0.85)`
      ctx!.beginPath()
      let [sx, sy] = point(beam, fx, delta)
      ctx!.moveTo(sx, sy)
      for (let i = 1; i <= steps; i++) {
        const u = beam + (du * i) / steps
        const [px, py] = point(u, fx, delta)
        ctx!.lineTo(px, py)
        sx = px
        sy = py
      }
      ctx!.stroke()

      // The beam head — a small hot point, near-white, where the spot is now.
      ctx!.fillStyle = `rgba(255,255,${Math.round(ab + (255 - ab) * 0.4)},0.95)`
      ctx!.beginPath()
      ctx!.arc(sx, sy, 2.2, 0, Math.PI * 2)
      ctx!.fill()

      ctx!.globalCompositeOperation = 'source-over'
      beam += du
      if (beam > Math.PI * 200) beam -= Math.PI * 200 // keep the number small

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      targetX = (e.clientX - rect.left) / rect.width
      targetY = 1 - (e.clientY - rect.top) / rect.height // up = faster
    }
    function onLeave() {
      targetX = 0.4
      targetY = 0.35
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full touch-none ${className}`}
    />
  )
}
