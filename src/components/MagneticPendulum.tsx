import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A magnetic pendulum — the double pendulum's quieter cousin among the toys, and
// its deliberate opposite argument. The double pendulum is chaos that never
// lands: a family of arms that diverge forever and settle on nothing. This is
// chaos that always lands — and the drama is in *which* magnet it lands on.
//
// A single bob hangs on an idealised pendulum over three magnets laid out in a
// triangle. Two forces fight for it. The pendulum itself pulls the bob back
// toward the centre, a gentle restoring spring, the way gravity returns a real
// pendulum to rest. The three magnets each pull it toward themselves, a tug that
// grows sharply as the bob nears — an inverse-cube falloff, softened by the
// height the bob swings above the magnet plane so the pull never blows up to
// infinity directly over a magnet. Add a whisper of air friction and the bob
// spirals, loops, doubles back, and eventually is captured by one magnet and
// comes to rest on it.
//
// Which one? That is the whole point. The magnetic pendulum is the textbook
// picture of a fractal basin of attraction: start the bob a hair's breadth from
// where it was, and it can spiral into a completely different magnet. The final
// resting place is not a tidy wedge of the table pointing at the nearest magnet;
// it is an infinitely filigreed border where the three basins interleave, and
// near that border the outcome is, for all practical purposes, unknowable in
// advance. So the piece runs itself: released from rest at one point, it hunts,
// spirals, and settles; holds a beat on its captor; then re-releases from the
// next point in a fixed sequence and does it again, each run tracing a different
// luminous scribble before it finds a home.
//
// The physics is honest. The bob integrates the real equation of motion —
// restoring pull to the centre, inverse-cube attraction to each softened magnet,
// linear friction — with semi-implicit (symplectic) Euler on a small fixed
// timestep. An accumulator eats the rAF delta in 1/240 s bites, so the motion is
// frame-rate independent and reads the same on any monitor, and time is the rAF
// delta alone, never Date.now. The sequence of release points comes from a fixed
// integer hash of the run index, so the same show plays the same way on every
// load and it never touches Math.random. The trail the bob leaves is tinted
// toward whichever magnet is currently winning it, so the colour itself tells
// you where it is being pulled before the capture is decided.
//
// The pointer aims the drop: press anywhere on the field and the bob is placed
// there at rest and released, so you can hunt for the hairline borders where a
// pixel's difference flips the outcome. One canvas, one loop, drawn DPR-aware
// and cleaned up on unmount, off the React render path. Under
// prefers-reduced-motion the loop never starts — one representative run is
// integrated once to its resting place and its settled spiral is laid down
// still, with the three magnets lit, and held. Decorative, so aria-hidden.

const TAU = Math.PI * 2
const STEP = 1 / 240 // fixed integration substep, seconds
const MAX_SUB = 10 // cap substeps per frame (no spiral of death)

// Simulation constants, in a unit field where the magnet ring sits at radius
// ~0.5 and the usable field is about radius 1. Mapped to pixels at draw time, so
// the behaviour is identical at any canvas size.
const K_CENTRE = 3.1 // restoring pull toward the pivot (the pendulum spring)
const FRICTION = 0.19 // linear air friction
const MAG_STRENGTH = 0.22 // per-magnet attraction
const MAG_RADIUS = 0.52 // how far the three magnets sit from the centre
const HEIGHT2 = 0.0145 // (bob height above the magnet plane)^2 — softening
const SETTLE_SPEED = 0.05 // |v| below this (and near a magnet) counts as captured
const SETTLE_HOLD = 0.9 // seconds to rest on a captor before the next release
const TRAIL = 150 // trail length, points

// The site's accent triad — lime, cyan, violet — one per magnet, so the three
// basins read as three colours and the trail can tell you which is winning.
const MAGNET_COLORS = ['#DCF87C', '#8CC2FF', '#C4A5FF'] as const

// Three magnets in a triangle: top, lower-right, lower-left.
const MAGNETS = MAGNET_COLORS.map((color, i) => {
  const a = -Math.PI / 2 + (i * TAU) / 3
  return { x: Math.cos(a) * MAG_RADIUS, y: Math.sin(a) * MAG_RADIUS, color }
})

// A fast, deterministic integer hash → a number in [0, 1). Stands in for a PRNG
// so every release point is fixed by its run index, never rolled at runtime.
function hash(n: number): number {
  let x = n | 0
  x = (x ^ 61) ^ (x >>> 16)
  x = x + (x << 3)
  x = x ^ (x >>> 4)
  x = Math.imul(x, 0x27d4eb2d)
  x = x ^ (x >>> 15)
  return (x >>> 0) / 4294967296
}

// A deterministic release point for run `n`: an angle and a radius drawn from
// the hash, kept out near the rim where the hunt is longest and prettiest.
function releasePoint(n: number): { x: number; y: number } {
  const ang = hash(n * 2 + 1) * TAU
  const rad = 0.72 + hash(n * 2 + 7) * 0.22
  return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad }
}

// Acceleration on the bob at position (x, y) with velocity (vx, vy), in unit
// field space. Returns [ax, ay] plus the index of the magnet currently pulling
// hardest, so the trail can be tinted toward it.
function accel(x: number, y: number, vx: number, vy: number): [number, number, number] {
  let ax = -K_CENTRE * x - FRICTION * vx
  let ay = -K_CENTRE * y - FRICTION * vy
  let best = 0
  let bestPull = -1
  for (let i = 0; i < MAGNETS.length; i++) {
    const m = MAGNETS[i]
    const dx = m.x - x
    const dy = m.y - y
    const d2 = dx * dx + dy * dy + HEIGHT2
    const invR3 = 1 / (d2 * Math.sqrt(d2)) // inverse-cube falloff
    const pull = MAG_STRENGTH * invR3
    ax += dx * pull
    ay += dy * pull
    if (pull > bestPull) {
      bestPull = pull
      best = i
    }
  }
  return [ax, ay, best]
}

// Parse "#rrggbb" → [r, g, b].
function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}
const MAGNET_RGB = MAGNET_COLORS.map(rgb)

export function MagneticPendulum({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let scale = 1
    let dpr = 1

    // Bob state in unit field space.
    let x = 0
    let y = 0
    let vx = 0
    let vy = 0
    let run = 0
    let settleTimer = 0
    let acc = 0
    const trail: { x: number; y: number; m: number }[] = []

    function release(px: number, py: number) {
      x = px
      y = py
      vx = 0
      vy = 0
      settleTimer = 0
      trail.length = 0
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      scale = Math.min(w, h) * 0.42
    }

    // Unit field → canvas pixels.
    const px = (ux: number) => cx + ux * scale
    const py = (uy: number) => cy + uy * scale

    function drawMagnets() {
      for (const m of MAGNETS) {
        const mx = px(m.x)
        const my = py(m.y)
        const glow = ctx!.createRadialGradient(mx, my, 0, mx, my, scale * 0.42)
        glow.addColorStop(0, `${m.color}55`)
        glow.addColorStop(1, `${m.color}00`)
        ctx!.fillStyle = glow
        ctx!.beginPath()
        ctx!.arc(mx, my, scale * 0.42, 0, TAU)
        ctx!.fill()
        // The magnet core.
        ctx!.fillStyle = m.color
        ctx!.beginPath()
        ctx!.arc(mx, my, Math.max(3, scale * 0.028), 0, TAU)
        ctx!.fill()
        ctx!.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.arc(mx, my, Math.max(3, scale * 0.028), 0, TAU)
        ctx!.stroke()
      }
      // The pivot at the centre — a faint ring, where the pendulum hangs from.
      ctx!.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.arc(cx, cy, Math.max(2, scale * 0.012), 0, TAU)
      ctx!.stroke()
    }

    function drawTrail() {
      if (trail.length < 2) return
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]
        const b = trail[i]
        const t = i / trail.length // 0 (oldest) → 1 (newest)
        const [r, g, bl] = MAGNET_RGB[b.m]
        ctx!.strokeStyle = `rgba(${r},${g},${bl},${(t * t * 0.85).toFixed(3)})`
        ctx!.lineWidth = 0.6 + t * 2.2
        ctx!.lineCap = 'round'
        ctx!.beginPath()
        ctx!.moveTo(px(a.x), py(a.y))
        ctx!.lineTo(px(b.x), py(b.y))
        ctx!.stroke()
      }
    }

    function drawBob() {
      const bx = px(x)
      const by = py(y)
      const [, , m] = accel(x, y, vx, vy)
      const color = MAGNET_COLORS[m]
      const halo = ctx!.createRadialGradient(bx, by, 0, bx, by, scale * 0.12)
      halo.addColorStop(0, `${color}cc`)
      halo.addColorStop(1, `${color}00`)
      ctx!.fillStyle = halo
      ctx!.beginPath()
      ctx!.arc(bx, by, scale * 0.12, 0, TAU)
      ctx!.fill()
      ctx!.fillStyle = '#ffffff'
      ctx!.beginPath()
      ctx!.arc(bx, by, Math.max(2.5, scale * 0.02), 0, TAU)
      ctx!.fill()
    }

    // Advance the simulation by one fixed substep.
    function substep() {
      const [ax, ay, m] = accel(x, y, vx, vy)
      vx += ax * STEP
      vy += ay * STEP
      x += vx * STEP
      y += vy * STEP
      trail.push({ x, y, m })
      if (trail.length > TRAIL) trail.shift()
    }

    // Is the bob captured — slow, and sitting close to a magnet?
    function captured(): boolean {
      const speed = Math.hypot(vx, vy)
      if (speed > SETTLE_SPEED) return false
      for (const m of MAGNETS) {
        if (Math.hypot(m.x - x, m.y - y) < 0.14) return true
      }
      return false
    }

    let raf = 0
    let last = 0

    function frame(now: number) {
      if (!last) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-switch
      acc += dt
      let n = 0
      while (acc >= STEP && n < MAX_SUB) {
        substep()
        acc -= STEP
        n++
      }
      if (acc > STEP) acc = 0

      if (captured()) {
        settleTimer += dt
        if (settleTimer >= SETTLE_HOLD) {
          run++
          const p = releasePoint(run)
          release(p.x, p.y)
        }
      } else {
        settleTimer = 0
      }

      ctx!.clearRect(0, 0, w, h)
      drawMagnets()
      drawTrail()
      drawBob()
      raf = requestAnimationFrame(frame)
    }

    // The reduced-motion still: integrate one representative run to rest off the
    // clock, then lay down its settled spiral once and hold it.
    function drawStill() {
      ctx!.clearRect(0, 0, w, h)
      drawMagnets()
      const p = releasePoint(1)
      x = p.x
      y = p.y
      vx = 0
      vy = 0
      trail.length = 0
      // Integrate up to a generous bound; stop once it is clearly captured.
      for (let i = 0; i < 8000; i++) {
        substep()
        if (i > 200 && captured()) break
      }
      // Keep only the most recent points so the still reads as a tidy tail into
      // its captor rather than a full-field scribble.
      while (trail.length > TRAIL * 3) trail.shift()
      // Draw the whole retained path at a calm, even opacity.
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]
        const b = trail[i]
        const t = i / trail.length
        const [r, g, bl] = MAGNET_RGB[b.m]
        ctx!.strokeStyle = `rgba(${r},${g},${bl},${(0.12 + t * 0.4).toFixed(3)})`
        ctx!.lineWidth = 0.6 + t * 1.8
        ctx!.lineCap = 'round'
        ctx!.beginPath()
        ctx!.moveTo(px(a.x), py(a.y))
        ctx!.lineTo(px(b.x), py(b.y))
        ctx!.stroke()
      }
      drawBob()
    }

    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) drawStill()
    })
    ro.observe(wrap)
    resize()

    // Pointer aims the drop: place the bob under the pointer, at rest, and let
    // go. Disabled under reduced motion, where there is no running loop.
    function onPointer(e: PointerEvent) {
      if (reduce) return
      const rect = canvas!.getBoundingClientRect()
      const ux = (e.clientX - rect.left - cx) / scale
      const uy = (e.clientY - rect.top - cy) / scale
      release(ux, uy)
      acc = 0
    }

    if (reduce) {
      drawStill()
    } else {
      const p = releasePoint(0)
      release(p.x, p.y)
      canvas.addEventListener('pointerdown', onPointer)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointer)
    }
  }, [reduce])

  return (
    <div ref={wrapRef} className={`relative ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  )
}
