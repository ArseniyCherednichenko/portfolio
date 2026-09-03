import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A circle packing — the space-filling generative figure, kept honest to the
// one rule that makes it. Seeds are dropped at random points that fall clear of
// every circle already down; each seed then grows outward, a little every
// frame, until its rim just kisses a neighbour or the wall, and there it
// freezes. Do that forever and the plane fills the way soap froth or a bag of
// oranges does: big discs where there was room, a lace of ever-smaller ones
// packed into the gaps between them, none of them overlapping, ever.
//
// So this is not a scatter of decorative dots. It is the classic greedy
// circle-packing algorithm — random seeding by rejection, then unchecked radial
// growth arrested by contact — and the size distribution you see fall out (a few
// large, many middling, a dust of tiny) is a property of the rule, not a thing
// tuned by hand. Distinct from the Phyllotaxis spiral next door, which places
// equal dots on a golden-angle lattice, and from the Voronoi field, which
// partitions the plane with no gaps at all: this one leaves the gaps and lets
// them fill themselves, so the boundaries between circles are the empty curved
// slivers, not shared edges.
//
// The cursor carves. Press or drag and the circles under the pointer are lifted
// out, opening a clear region; the seeder immediately notices the new room and
// the packing grows back into the hole, smaller and denser than before, so you
// can draw slow trails of froth that heal behind you. A tint runs by size — the
// smallest discs sit cool teal, the largest warm to the site's lime — so the
// hierarchy of scale is always legible, and a freshly frozen circle blooms in
// over a few frames rather than snapping on.
//
// One canvas, one rAF loop, DPR-capped and resize-driven; no per-circle React
// state. Growth is arrested by an all-pairs distance test over only the handful
// of circles still growing, and seeds are placed by nearest-edge rejection, so
// the cost falls as the field settles. The canvas is decorative and aria-hidden
// with an sr-only account of what it is. Under reduced motion nothing animates:
// a complete packing is computed once, in full, and painted still — and the
// cursor does not carve, because there is no regrowth to answer it.

interface CirclePackingProps {
  className?: string
}

interface Circle {
  x: number
  y: number
  r: number
  rMax: number // frozen radius once it stops; 0 while still growing
  life: number // 0..1 bloom-in after freezing
}

const MIN_R = 2 // smallest seed a gap has to admit, CSS px
const PAD = 1 // breathing room kept between rims
const GROW = 0.45 // radial growth per frame, CSS px
const MAX_CIRCLES = 620
const SEED_TRIES = 26 // rejection attempts per frame
const CARVE_R = 44 // cursor lift radius, CSS px
const DPR_CAP = 2

// Tint by size: the smallest discs sit cool teal, the largest warm to lime.
function tint(r: number, alpha: number): string {
  const t = Math.min(1, r / 46)
  const hue = 176 - t * 104 // 176 (teal) -> 72 (lime)
  const light = 52 + t * 20
  return `hsla(${hue}, 80%, ${light}%, ${alpha})`
}

export function CirclePacking({ className }: CirclePackingProps) {
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
    let circles: Circle[] = []
    let raf = 0

    // Pointer, in CSS px; null when off-canvas or lifted.
    const pointer = { x: 0, y: 0, active: false, carving: false }

    // Largest clearance from (x,y) to any rim, negative when inside a circle.
    function clearance(x: number, y: number): number {
      let min = Infinity
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]
        const d = Math.hypot(x - c.x, y - c.y) - c.r
        if (d < min) min = d
      }
      // Also respect the walls.
      const wall = Math.min(x, y, width - x, height - y)
      return Math.min(min, wall)
    }

    // Try to drop one new seed at a random clear point.
    function trySeed() {
      if (circles.length >= MAX_CIRCLES) return
      for (let t = 0; t < SEED_TRIES; t++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const gap = clearance(x, y)
        if (gap > MIN_R + PAD) {
          circles.push({ x, y, r: MIN_R, rMax: 0, life: 0 })
          return
        }
      }
    }

    // Does this growing circle now touch anything if it were radius r?
    function blocked(self: Circle, r: number): boolean {
      if (self.x - r <= 0 || self.y - r <= 0 || self.x + r >= width || self.y + r >= height) {
        return true
      }
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]
        if (c === self) continue
        if (Math.hypot(self.x - c.x, self.y - c.y) < r + c.r + PAD) return true
      }
      return false
    }

    function step() {
      // Seed a few new circles into whatever room is left.
      for (let s = 0; s < 3; s++) trySeed()

      // Grow the ones still growing; freeze on contact.
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]
        if (c.rMax === 0) {
          const next = c.r + GROW
          if (blocked(c, next)) {
            c.rMax = c.r // freeze at the last clear radius
          } else {
            c.r = next
          }
        }
        if (c.life < 1) c.life = Math.min(1, c.life + 0.06)
      }

      // The cursor lifts circles out, opening room the seeder fills back in.
      if (pointer.active && pointer.carving) {
        circles = circles.filter(
          (c) => Math.hypot(c.x - pointer.x, c.y - pointer.y) > CARVE_R + c.r * 0.4,
        )
      }
    }

    function paint() {
      const g = ctx!
      g.clearRect(0, 0, width, height)
      g.fillStyle = '#040404'
      g.fillRect(0, 0, width, height)

      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]
        const a = c.life
        // A faint fill lit by size, then a crisper rim on top.
        g.beginPath()
        g.arc(c.x, c.y, c.r, 0, Math.PI * 2)
        g.fillStyle = tint(c.r, 0.06 * a)
        g.fill()
        g.lineWidth = 1
        g.strokeStyle = tint(c.r, (c.rMax === 0 ? 0.85 : 0.5) * a)
        g.stroke()
      }

      // A soft ring marks where the cursor is carving.
      if (pointer.active && !reduce) {
        g.beginPath()
        g.arc(pointer.x, pointer.y, CARVE_R, 0, Math.PI * 2)
        g.strokeStyle = 'rgba(220, 248, 124, 0.35)'
        g.lineWidth = 1.5
        g.stroke()
      }
    }

    function frame() {
      step()
      paint()
      raf = requestAnimationFrame(frame)
    }

    // For reduced motion: run the packing to completion once, off the clock.
    function settle() {
      circles = []
      let placed = true
      let guard = 0
      while (placed && guard < 4000 && circles.length < MAX_CIRCLES) {
        guard++
        placed = false
        // Drop a seed at the clearest of a handful of candidates so the still
        // frame reads full rather than sparse.
        let best = { x: 0, y: 0, gap: -Infinity }
        for (let t = 0; t < SEED_TRIES; t++) {
          const x = Math.random() * width
          const y = Math.random() * height
          const gap = clearance(x, y)
          if (gap > best.gap) best = { x, y, gap }
        }
        if (best.gap > MIN_R + PAD) {
          const c: Circle = { x: best.x, y: best.y, r: MIN_R, rMax: 0, life: 1 }
          // Grow it in place until it locks.
          let r = MIN_R
          while (!blocked(c, r + GROW)) r += GROW
          c.r = r
          c.rMax = r
          circles.push(c)
          placed = true
        }
      }
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
      if (reduce) {
        settle()
      } else {
        circles = []
      }
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
        pointer.carving = true
      }
      const onUp = () => {
        pointer.carving = false
      }
      const onLeave = () => {
        pointer.active = false
        pointer.carving = false
      }
      // Pointer-move carves too, so a light drag draws a healing trail.
      const onMoveCarve = (e: PointerEvent) => {
        toLocal(e)
        pointer.active = true
        if (e.pressure > 0 || pointer.carving) pointer.carving = true
      }
      canvas.addEventListener('pointermove', onMoveCarve)
      canvas.addEventListener('pointerdown', onDown)
      window.addEventListener('pointerup', onUp)
      canvas.addEventListener('pointerleave', onLeave)
      canvas.style.touchAction = 'none'

      raf = requestAnimationFrame(frame)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        canvas.removeEventListener('pointermove', onMoveCarve)
        canvas.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointerup', onUp)
        canvas.removeEventListener('pointerleave', onLeave)
      }
    }

    return () => {
      ro.disconnect()
    }
  }, [reduce])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: 'block' }}
    />
  )
}
