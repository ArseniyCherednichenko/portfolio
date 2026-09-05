import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A plucked string. Grab it anywhere and pull it aside — it bends into a clean
// triangle, pinned at both ends and held under your finger — then let go and it
// rings: a wave races out from the kink to each fixed end, reflects, inverts,
// and crosses back through itself. That criss-cross is the whole point. A pluck
// is a triangle, and a triangle is a sum of sine modes (Fourier), so what you
// watch settle is the fundamental and its overtones beating against each other
// and damping out at their own rates — the higher, brighter modes dying first,
// the slow fundamental last to fade.
//
// The physics is the real one, not an eased curve. The string is a row of nodes
// with fixed ends, advanced by the textbook finite-difference solution of the
// 1-D wave equation — the leapfrog stencil y⁺ᵢ = 2yᵢ − y⁻ᵢ + r²(yᵢ₋₁ − 2yᵢ +
// yᵢ₊₁), where r is the Courant number kept under one so it stays stable. It
// runs on a fixed-timestep accumulator, so the pitch and the ring-down are the
// same on any monitor and survive a resize or a tab-away untouched; a light
// per-step damping is the string's own losses, taking the treble before the
// bass exactly as a real string does. No wall clock, no randomness.
//
// It is alive: it mounts already plucked and ringing, and settles toward a
// still line if left alone. PRESS AND DRAG anywhere along it to pull the string
// aside — the held point tracks your pointer while the two sides stay straight
// — and RELEASE to sound it; a plain tap plucks it there for you. The line
// warms to the accent where it moves fastest, so the travelling kink glows.
// Under reduced motion the loop never starts: the string is painted held in a
// single plucked triangle, so the toy still reads at a glance. Decorative, so
// aria-hidden.

const NODES = 180 // points along the string, ends fixed
const H = 1 / 480 // fixed physics timestep, seconds
const R2 = 0.5 // squared Courant number (c·h/dx)² — must stay ≤ 1 for stability
const DAMP = 0.9992 // per-step velocity retention — the string's own losses
const MAX_SUBSTEPS = 12 // cap steps per frame so a long stall can never spiral

export function StringPluck({
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
    let padX = 0 // horizontal inset to the pinned ends
    let midY = 0 // rest line
    let span = 0 // pixels between the two fixed ends
    let maxAmp = 0 // furthest a point may be pulled, pixels
    let raf = 0
    let last = -1
    let acc = 0

    // Displacement of each node from the rest line (px). `prev` holds the value
    // one step back — the leapfrog scheme needs both to imply velocity.
    const y = new Float32Array(NODES)
    const prev = new Float32Array(NODES)

    let dragIndex = -1 // held node while dragging, else -1
    let moved = false // did this drag travel far enough to count as a pull?

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      padX = Math.round(w * 0.08)
      span = Math.max(1, w - padX * 2)
      midY = Math.round(h * 0.5)
      maxAmp = Math.min(h * 0.4, 130)
    }

    function nodeX(i: number) {
      return padX + (span * i) / (NODES - 1)
    }

    // Pluck: pin both ends, hold node `hi` at displacement `amp`, and run a
    // straight line to each end — the exact triangular shape a real held pluck
    // makes. Zero the velocity (prev = y) so releasing it is a clean start.
    function shapeTriangle(hi: number, amp: number) {
      for (let i = 0; i < NODES; i++) {
        if (i <= hi) y[i] = (amp * i) / Math.max(1, hi)
        else y[i] = (amp * (NODES - 1 - i)) / Math.max(1, NODES - 1 - hi)
      }
      y[0] = 0
      y[NODES - 1] = 0
      prev.set(y)
    }

    // One leapfrog step of the wave equation. Ends stay pinned; a held node is
    // driven by the pointer, not the physics.
    function step() {
      const nx = new Float32Array(NODES)
      for (let i = 1; i < NODES - 1; i++) {
        if (i === dragIndex) {
          nx[i] = y[i]
          continue
        }
        const lap = y[i - 1] + y[i + 1] - 2 * y[i]
        // y⁺ = y + damped velocity + wave term.
        nx[i] = y[i] + (y[i] - prev[i]) * DAMP + R2 * lap
      }
      prev.set(y)
      y.set(nx)
      y[0] = 0
      y[NODES - 1] = 0
      if (dragIndex > 0 && dragIndex < NODES - 1) prev[dragIndex] = y[dragIndex]
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h)

      // The rest line and the two pins the string is strung between.
      ctx!.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(padX, midY)
      ctx!.lineTo(w - padX, midY)
      ctx!.stroke()

      // Local speed drives the glow, so the fastest-moving stretch — the
      // travelling kink — is the brightest part of the line.
      let peak = 1e-6
      for (let i = 0; i < NODES; i++) {
        const v = Math.abs(y[i] - prev[i])
        if (v > peak) peak = v
      }

      const pts: Array<[number, number, number]> = []
      for (let i = 0; i < NODES; i++) {
        const speed = Math.min(1, Math.abs(y[i] - prev[i]) / (peak + 1e-6))
        pts.push([nodeX(i), midY + y[i], speed])
      }

      // Wide soft underlay for the bloom, drawn along the curve in the accent.
      const glowStroke = (width: number, alpha: number) => {
        ctx!.lineWidth = width
        ctx!.lineJoin = 'round'
        ctx!.lineCap = 'round'
        ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${alpha})`
        ctx!.beginPath()
        ctx!.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < NODES - 1; i++) {
          const [x0, y0] = pts[i]
          const [x1, y1] = pts[i + 1]
          ctx!.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
        }
        ctx!.lineTo(pts[NODES - 1][0], pts[NODES - 1][1])
        ctx!.stroke()
      }

      const energy = Math.min(1, peak / 6)
      ctx!.save()
      ctx!.globalCompositeOperation = 'lighter'
      glowStroke(9, 0.05 + energy * 0.12) // outer bloom
      glowStroke(4, 0.1 + energy * 0.16) // mid glow
      ctx!.restore()

      // Core line: white at rest, warming to the accent along fast stretches.
      ctx!.lineWidth = 1.75
      ctx!.lineJoin = 'round'
      ctx!.lineCap = 'round'
      for (let i = 0; i < NODES - 1; i++) {
        const [x0, y0, s0] = pts[i]
        const [x1, y1] = pts[i + 1]
        const warm = s0 * energy
        const cr = Math.round(255 - (255 - ar) * warm)
        const cg = Math.round(255 - (255 - ag) * warm)
        const cb = Math.round(255 - (255 - ab) * warm)
        ctx!.strokeStyle = `rgba(${cr},${cg},${cb},0.92)`
        ctx!.beginPath()
        ctx!.moveTo(x0, y0)
        ctx!.lineTo(x1, y1)
        ctx!.stroke()
      }

      // The two end pins.
      for (const px of [padX, w - padX]) {
        ctx!.fillStyle = 'rgba(255,255,255,0.5)'
        ctx!.beginPath()
        ctx!.arc(px, midY, 2.4, 0, Math.PI * 2)
        ctx!.fill()
      }

      // A soft node under the finger while held, so the grab point reads.
      if (dragIndex > 0 && dragIndex < NODES - 1) {
        const gx = nodeX(dragIndex)
        const gy = midY + y[dragIndex]
        const g = ctx!.createRadialGradient(gx, gy, 0, gx, gy, 16)
        g.addColorStop(0, `rgba(${ar},${ag},${ab},0.9)`)
        g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
        ctx!.fillStyle = g
        ctx!.beginPath()
        ctx!.arc(gx, gy, 16, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    layout()

    if (reduce) {
      // A still frame: the string caught held in a plucked triangle.
      shapeTriangle(Math.round(NODES * 0.3), maxAmp * 0.7)
      draw()
      const ro = new ResizeObserver(() => {
        const hi = Math.round(NODES * 0.3)
        layout()
        shapeTriangle(hi, maxAmp * 0.7)
        draw()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Mount already plucked so it is alive on arrival.
    shapeTriangle(Math.round(NODES * 0.28), maxAmp * 0.62)

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away so it never jumps

      acc += dt
      let steps = 0
      while (acc >= H && steps < MAX_SUBSTEPS) {
        step()
        acc -= H
        steps++
      }
      if (steps === MAX_SUBSTEPS) acc = 0 // fell behind; drop the backlog

      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function indexFromClientX(clientX: number) {
      const rect = canvas!.getBoundingClientRect()
      const t = (clientX - rect.left - padX) / span
      return Math.max(1, Math.min(NODES - 2, Math.round(t * (NODES - 1))))
    }

    function onDown(e: PointerEvent) {
      dragIndex = indexFromClientX(e.clientX)
      moved = false
      const rect = canvas!.getBoundingClientRect()
      const amp = Math.max(-maxAmp, Math.min(maxAmp, e.clientY - rect.top - midY))
      shapeTriangle(dragIndex, amp)
      canvas!.setPointerCapture?.(e.pointerId)
    }
    function onMove(e: PointerEvent) {
      if (dragIndex < 0) return
      dragIndex = indexFromClientX(e.clientX)
      const rect = canvas!.getBoundingClientRect()
      const amp = Math.max(-maxAmp, Math.min(maxAmp, e.clientY - rect.top - midY))
      if (Math.abs(amp) > 6) moved = true
      shapeTriangle(dragIndex, amp)
    }
    function onUp() {
      if (dragIndex < 0) return
      // A tap with no real pull still sounds a note, plucked to a set height.
      if (!moved) shapeTriangle(dragIndex, maxAmp * 0.6)
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
