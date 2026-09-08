import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// A train of meshing gears, kept honest to the mechanics behind it. Every gear
// is a real toothed wheel whose pitch radius is its tooth count over two, so
// bigger wheels genuinely carry more teeth; two that mesh sit exactly a pitch
// radius apart, and turning one turns the next the only way it can — the wrong
// way round, and slower or faster in exact proportion to the teeth. Grab any
// wheel and drag it, and the whole train obeys: a fast little pinion whips a
// heavy wheel round a fraction of a turn, the classic reduction you feel in a
// hand drill or a clock.
//
// The coupling is not scripted. A single degree of freedom — the drive angle of
// the first wheel — fixes every other angle through the meshing law
//   Z_a·(θ_a − φ) + Z_b·(θ_b − φ − π) ≡ π   (mod 2π),
// which is exactly the statement that a tooth of one wheel always meets a gap of
// the next along their line of centres (φ). Differentiate it and the familiar
// ratio ω_b = −(Z_a/Z_b)·ω_a falls straight out — opposite sign, inverse of the
// teeth — so the picture and the physics are the same object. Each wheel's angle
// is therefore an affine function of the driver's, θ_i = P_i·θ0 + Q_i, precomputed
// once from the layout; the loop just evaluates it.
//
// The odd one out among the Objects & toys canvas pieces: not a crowd of bodies
// colliding (Ballpit, Cradle, Galton) nor particles reading a field (Chladni,
// Slime), but a rigid mechanism — every part's motion determined, to the last
// decimal, by one input. One canvas, one rAF loop that sleeps when nothing
// turns, DPR-capped, ResizeObserver-driven; physics in refs, no per-frame React
// state, no Date.now and no Math.random on the hot path. The canvas is
// aria-hidden decoration with an sr-only account, and Spin/Reverse are real
// labelled buttons so it is drivable without a pointer. Under reduced motion the
// train never auto-turns and never coasts — it is painted once at rest, and
// dragging a wheel (direct manipulation) still turns the train, just without the
// idle spin or the fly-wheel glide.

interface GearsProps {
  className?: string
  /** Tooth counts along the train, left to right. Each meshes with its neighbour. */
  teeth?: number[]
}

// The default train: a heavy wheel driven down through a fast pinion and back
// up, so the ratio between the ends is worth reading.
const DEFAULT_TEETH = [26, 14, 22, 12, 20]
// Placement angles (radians, from horizontal) of each wheel relative to the
// previous one — a gentle zigzag so the train reads as a mechanism, not a row.
const LINK_ANGLES = [-0.34, 0.5, -0.46, 0.36]

const ADDENDUM = 1 // tooth reaches one module past the pitch circle
const DEDENDUM = 1.25 // and a little further below it

interface Gear {
  teeth: number
  x: number // centre, in module units
  y: number
  pitch: number // pitch radius = teeth / 2
  outer: number // addendum radius
  root: number // dedendum radius
  P: number // θ_i = P·θ0 + Q
  Q: number
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

// Lay the train out in module units and precompute each wheel's affine link to
// the driver's angle, so every subsequent angle is one multiply and add.
function buildTrain(teeth: number[]): Gear[] {
  const n = teeth.length
  const gears: Gear[] = []
  let px = 0
  let py = 0
  let prevAngle = 0 // driver's own angle at θ0 = 0
  let P = 1
  let Q = 0
  for (let i = 0; i < n; i++) {
    const z = teeth[i]
    const pitch = z / 2
    if (i === 0) {
      px = 0
      py = 0
    } else {
      const conn = LINK_ANGLES[(i - 1) % LINK_ANGLES.length]
      const dist = gears[i - 1].pitch + pitch
      px = gears[i - 1].x + dist * Math.cos(conn)
      py = gears[i - 1].y + dist * Math.sin(conn)
      // Meshing law solved for this wheel's angle as affine in the previous:
      //   θ_i = a_i + b_i·θ_{i-1},  b_i = −Z_{i-1}/Z_i
      const zPrev = teeth[i - 1]
      const b = -zPrev / z
      const a = conn + Math.PI + (Math.PI + zPrev * conn) / z
      // Compose with the previous wheel's link to the driver.
      Q = a + b * Q
      P = b * P
      prevAngle = a + b * prevAngle
    }
    gears.push({
      teeth: z,
      x: px,
      y: py,
      pitch,
      outer: pitch + ADDENDUM,
      root: Math.max(pitch * 0.2, pitch - DEDENDUM),
      P,
      Q,
    })
  }
  return gears
}

// Shortest signed distance from angle a1 to a2, in (−π, π].
function angleDelta(a1: number, a2: number): number {
  let d = a2 - a1
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function Gears({ className = '', teeth = DEFAULT_TEETH }: GearsProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [spinning, setSpinning] = useState(false)
  const spinningRef = useRef(false)

  const gears = useMemo(() => buildTrain(teeth), [teeth])

  // The end-to-end reduction: the last wheel turns Z0 / Zlast times per turn of
  // the driver. Reduced to lowest terms so it reads as the honest ratio.
  const ratio = useMemo(() => {
    const first = teeth[0]
    const last = teeth[teeth.length - 1]
    const g = gcd(first, last)
    return { a: first / g, b: last / g }
  }, [teeth])

  // The screen transform that fits the unit-space train into the canvas.
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })
  const dprRef = useRef(1)

  // Single degree of freedom and its rate; everything else derives.
  const theta0 = useRef(0)
  const omega0 = useRef(0)
  const dirRef = useRef(1) // idle spin direction
  const gearsRef = useRef(gears)
  gearsRef.current = gears

  // Pointer interaction state.
  const dragRef = useRef<{ gear: number; prevAngle: number } | null>(null)
  const hoverRef = useRef(-1)

  const IDLE_SPEED = 0.55 // rad/s of the driver when spinning
  const FRICTION = 0.6 // per-second velocity retention while coasting

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = sizeRef.current
    const dpr = dprRef.current
    const { scale, ox, oy } = viewRef.current
    const gs = gearsRef.current
    const drive = theta0.current
    const drag = dragRef.current
    const hover = hoverRef.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Meshing marks sit between wheels along their line of centres — a small
    // reminder that the teeth are actually engaging, not just spinning near.
    for (let i = 1; i < gs.length; i++) {
      const ax = ox + gs[i - 1].x * scale
      const ay = oy + gs[i - 1].y * scale
      const bx = ox + gs[i].x * scale
      const by = oy + gs[i].y * scale
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      ctx.fillStyle = 'rgba(220,248,124,0.16)'
      ctx.beginPath()
      ctx.arc(mx, my, Math.max(1.5, scale * 0.09), 0, Math.PI * 2)
      ctx.fill()
    }

    for (let i = 0; i < gs.length; i++) {
      const g = gs[i]
      const cx = ox + g.x * scale
      const cy = oy + g.y * scale
      const theta = g.P * drive + g.Q
      const isDriver = i === 0
      const active = (drag && drag.gear === i) || (!drag && hover === i)

      const outer = g.outer * scale
      const rootR = g.root * scale
      const pitchR = g.pitch * scale
      const step = (Math.PI * 2) / g.teeth

      // Toothed outline: trapezoidal teeth around the pitch circle. Consecutive
      // teeth share their valley points so the path is continuous.
      ctx.beginPath()
      for (let k = 0; k < g.teeth; k++) {
        const a = theta + k * step
        const v0x = cx + Math.cos(a - step * 0.5) * rootR
        const v0y = cy + Math.sin(a - step * 0.5) * rootR
        const t0x = cx + Math.cos(a - step * 0.28) * outer
        const t0y = cy + Math.sin(a - step * 0.28) * outer
        const t1x = cx + Math.cos(a + step * 0.28) * outer
        const t1y = cy + Math.sin(a + step * 0.28) * outer
        if (k === 0) ctx.moveTo(v0x, v0y)
        else ctx.lineTo(v0x, v0y)
        ctx.lineTo(t0x, t0y)
        ctx.lineTo(t1x, t1y)
      }
      ctx.closePath()

      // Body fill: a dark radial shade for volume, warmed on the active wheel.
      const grad = ctx.createRadialGradient(
        cx - outer * 0.3,
        cy - outer * 0.3,
        outer * 0.1,
        cx,
        cy,
        outer,
      )
      if (active) {
        grad.addColorStop(0, 'rgba(46,52,32,1)')
        grad.addColorStop(1, 'rgba(16,18,10,1)')
      } else {
        grad.addColorStop(0, isDriver ? 'rgba(32,36,24,1)' : 'rgba(30,30,30,1)')
        grad.addColorStop(1, 'rgba(11,11,11,1)')
      }
      ctx.fillStyle = grad
      ctx.fill()

      // Tooth edge.
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(0.8, scale * 0.05)
      ctx.strokeStyle =
        isDriver || active ? 'rgba(220,248,124,0.7)' : 'rgba(255,255,255,0.16)'
      ctx.stroke()

      // Rim circle at the root, for a finished read.
      ctx.beginPath()
      ctx.arc(cx, cy, rootR, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Spokes turning with the wheel — the clearest proof of rotation.
      const hub = Math.max(pitchR * 0.24, scale * 0.5)
      const spokes = g.teeth >= 20 ? 6 : g.teeth >= 14 ? 5 : 4
      ctx.strokeStyle = active
        ? 'rgba(220,248,124,0.4)'
        : 'rgba(255,255,255,0.14)'
      ctx.lineWidth = Math.max(1, scale * 0.07)
      for (let s = 0; s < spokes; s++) {
        const a = theta + (s * Math.PI * 2) / spokes
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * hub, cy + Math.sin(a) * hub)
        ctx.lineTo(cx + Math.cos(a) * rootR * 0.86, cy + Math.sin(a) * rootR * 0.86)
        ctx.stroke()
      }

      // Hub and bore.
      ctx.beginPath()
      ctx.arc(cx, cy, hub, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(20,20,20,1)'
      ctx.fill()
      ctx.strokeStyle =
        isDriver || active ? 'rgba(220,248,124,0.5)' : 'rgba(255,255,255,0.22)'
      ctx.lineWidth = Math.max(1, scale * 0.06)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, hub * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fill()

      // A lime index mark near the rim, so a slow turn is still legible.
      const markA = theta
      const mrx = cx + Math.cos(markA) * pitchR * 0.72
      const mry = cy + Math.sin(markA) * pitchR * 0.72
      const mr = Math.max(1.6, scale * 0.12)
      const glow = ctx.createRadialGradient(mrx, mry, 0, mrx, mry, mr * 2.4)
      glow.addColorStop(0, isDriver ? 'rgba(220,248,124,1)' : 'rgba(220,248,124,0.85)')
      glow.addColorStop(1, 'rgba(220,248,124,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(mrx, mry, mr * 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  // Fit the train into the current canvas box.
  const layout = useCallback(() => {
    const gs = gearsRef.current
    const { w, h } = sizeRef.current
    if (!w || !h) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const g of gs) {
      minX = Math.min(minX, g.x - g.outer)
      minY = Math.min(minY, g.y - g.outer)
      maxX = Math.max(maxX, g.x + g.outer)
      maxY = Math.max(maxY, g.y + g.outer)
    }
    const pad = Math.min(w, h) * 0.08
    const bw = maxX - minX
    const bh = maxY - minY
    const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)
    const ox = (w - bw * scale) / 2 - minX * scale
    const oy = (h - bh * scale) / 2 - minY * scale
    viewRef.current = { scale, ox, oy }
  }, [])

  // Size the backing store to the container at device resolution.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const w = Math.round(wrap.clientWidth)
      const h = Math.round(wrap.clientHeight)
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { w, h }
      dprRef.current = dpr
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      layout()
      paint()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [layout, paint])

  // Re-fit and repaint if the train itself changes.
  useEffect(() => {
    layout()
    paint()
  }, [gears, layout, paint])

  // The loop only runs while something turns: spinning, coasting, or dragging.
  // It sleeps otherwise, and is woken by interaction.
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const runningRef = useRef(false)

  const step = useCallback(
    (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now

      const dragging = !!dragRef.current
      if (!dragging) {
        if (spinningRef.current && !reduce) {
          const target = IDLE_SPEED * dirRef.current
          omega0.current += (target - omega0.current) * Math.min(1, dt * 2.5)
          theta0.current += omega0.current * dt
        } else {
          // Coast to rest.
          theta0.current += omega0.current * dt
          omega0.current *= Math.pow(FRICTION, dt)
          if (Math.abs(omega0.current) < 0.0008) omega0.current = 0
        }
      }

      paint()

      const alive =
        dragging || spinningRef.current || Math.abs(omega0.current) > 0.0008
      if (alive && !reduce) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        runningRef.current = false
        lastRef.current = 0
      }
    },
    [paint, reduce],
  )

  const wake = useCallback(() => {
    if (reduce && !dragRef.current) return
    if (runningRef.current) return
    runningRef.current = true
    lastRef.current = 0
    rafRef.current = requestAnimationFrame(step)
  }, [reduce, step])

  // Auto-spin on mount unless the visitor prefers reduced motion.
  useEffect(() => {
    if (reduce) {
      paint()
      return
    }
    setSpinning(true)
    spinningRef.current = true
    wake()
    return () => cancelAnimationFrame(rafRef.current)
  }, [reduce, wake, paint])

  // Map a client point to a gear index, if it lands on one.
  const gearAt = useCallback((clientX: number, clientY: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return -1
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const { scale, ox, oy } = viewRef.current
    const gs = gearsRef.current
    for (let i = 0; i < gs.length; i++) {
      const cx = ox + gs[i].x * scale
      const cy = oy + gs[i].y * scale
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy <= (gs[i].outer * scale) ** 2) return i
    }
    return -1
  }, [])

  const pointerAngle = useCallback(
    (clientX: number, clientY: number, gear: number): number => {
      const canvas = canvasRef.current
      if (!canvas) return 0
      const rect = canvas.getBoundingClientRect()
      const { scale, ox, oy } = viewRef.current
      const g = gearsRef.current[gear]
      const cx = ox + g.x * scale
      const cy = oy + g.y * scale
      return Math.atan2(clientY - rect.top - cy, clientX - rect.left - cx)
    },
    [],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    const gear = gearAt(e.clientX, e.clientY)
    if (gear < 0) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { gear, prevAngle: pointerAngle(e.clientX, e.clientY, gear) }
    omega0.current = 0
    wake()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) {
      const gear = gearAt(e.clientX, e.clientY)
      if (gear !== hoverRef.current) {
        hoverRef.current = gear
        if (!runningRef.current) paint()
      }
      return
    }
    const g = gearsRef.current[drag.gear]
    const cur = pointerAngle(e.clientX, e.clientY, drag.gear)
    const d = angleDelta(drag.prevAngle, cur)
    drag.prevAngle = cur
    // Move the driver so this wheel tracks the finger: θ_gear = P·θ0 + Q.
    const dDrive = d / g.P
    theta0.current += dDrive
    // Fly-wheel velocity handed to the release, from the same delta.
    const dt = 1 / 60
    omega0.current = dDrive / dt
    if (!runningRef.current) paint()
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    dragRef.current = null
    // Keep the coasting spin the drag imparted (unless reduced motion).
    if (reduce) omega0.current = 0
    wake()
  }

  const toggleSpin = () => {
    const next = !spinningRef.current
    spinningRef.current = next
    setSpinning(next)
    if (next) wake()
  }

  const reverse = () => {
    dirRef.current *= -1
    omega0.current *= -1
    if (!spinningRef.current) omega0.current += dirRef.current * IDLE_SPEED * 0.6
    wake()
  }

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      <div
        ref={wrapRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(130%_130%_at_30%_15%,#141414,#0a0a0a)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_70px_rgba(0,0,0,0.55)]"
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(e) => {
            if (dragRef.current) return
            hoverRef.current = -1
            if (!runningRef.current) paint()
            void e
          }}
        />
      </div>

      {/* Controls — real, labelled, keyboard-drivable. */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-white/40">
          Reduction{' '}
          <span className="tabular-nums text-white/70">
            {ratio.a} : {ratio.b}
          </span>
          <span className="text-white/30"> · drag any wheel</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reverse}
            aria-label="Reverse the direction of the train"
            className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
          >
            Reverse
          </button>
          <button
            type="button"
            onClick={toggleSpin}
            aria-pressed={spinning}
            aria-describedby={id}
            className="rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
          >
            {spinning ? 'Stop' : 'Spin'}
          </button>
        </div>
      </div>
      <span id={id} className="sr-only">
        {reduce
          ? 'A train of meshing gears, shown at rest. Drag any wheel to turn the whole train; each wheel turns the next in the opposite direction and in inverse proportion to its teeth.'
          : 'A train of meshing gears. Press Spin to turn it, Reverse to flip its direction, or drag any wheel by pointer. Each wheel turns the next the opposite way and in inverse proportion to its teeth.'}
      </span>
    </div>
  )
}
