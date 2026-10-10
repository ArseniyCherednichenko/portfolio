import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A snow globe — a thing you shake and then watch settle, which is what sets it
// apart from the other objects on the shelf. The Lava lamp runs its own cycle
// forever and the Newton's cradle hands a single blow down a line; this one does
// nothing until you disturb it, throws its snow up in a swirl, and then slowly,
// honestly, lets gravity put it all back down. The whole piece is the decay.
//
// The scene inside is deliberately personal: a small Berlin at night — the
// Fernsehturm with its lit sphere and antenna, a church spire, a row of
// rooftops — because the work on this site is made from Berlin, and a snow
// globe is the one object that is always a little homesick. No invented place,
// just the skyline of the city named all over the rest of the site.
//
// The snow is a plain particle system, not a scripted flurry. Each flake falls
// under a gentle gravity with viscous drag (snow in liquid, not air — a globe
// is full of glycerol water, which is why real globe snow drifts so slowly), is
// bent by a turbulence value that a shake sets to full and that then decays to
// zero, and is kept inside the glass by a soft circular wall. A flake that
// reaches the bank at the bottom and is moving slowly comes to rest there; a
// shake wakes the whole bank back up and lifts it. Depth gives parallax: far
// flakes are small, dim, and slow; near ones are large, bright, and quick, and
// they are drawn after the skyline so the globe reads as a volume, not a decal.
// One canvas, one rAF loop off the frame delta, DPR-capped at 2, seeded PRNG so
// a given flake always starts the same way (the repo's no-Math.random rule).
//
// Reduced motion: no loop at all. The globe paints a single still — snow caught
// mid-drift with a fuller bank already settled — and a shake simply reshuffles
// that still and repaints once, so the toy stays usable without anything moving
// on its own.

export type SnowGlobeProps = {
  className?: string
  style?: React.CSSProperties
  /** Number of snow flakes in the glass. Clamped to a sensible range. */
  count?: number
}

type Flake = {
  x: number // fraction of the dome box, 0..1
  y: number // fraction of the dome box, 0..1
  vx: number // fraction/second
  vy: number // fraction/second
  r: number // radius in fraction of the dome diameter
  depth: number // 0 far .. 1 near
  phase: number // for per-flake swirl variety
  resting: boolean
}

// mulberry32 — a given seed always yields the same stream, so the snow starts
// the same way on every mount (the repo's deterministic-art convention).
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function SnowGlobe({ className, style, count = 150 }: SnowGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduce = useReducedMotion()
  // A shake pushes turbulence to 1; the loop decays it. A ref so the loop never
  // restarts and a button press and a pointer tap drive the same value.
  const turbulenceRef = useRef(0)
  const shakeFnRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const n = Math.max(40, Math.min(260, Math.round(count)))
    const rnd = seeded(0x5e40b1a)

    // Seed the flakes spread through the glass so first paint already has snow
    // aloft rather than an empty dome. Depth sets size, speed, and brightness.
    const flakes: Flake[] = Array.from({ length: n }, (): Flake => {
      const depth = rnd()
      return {
        x: 0.08 + rnd() * 0.84,
        y: rnd(),
        vx: 0,
        vy: 0,
        r: 0.004 + depth * 0.012,
        depth,
        phase: rnd() * Math.PI * 2,
        resting: false,
      }
    })

    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    resize()

    // Globe geometry in CSS pixels: a glass sphere sitting on a base. The snow
    // and the city live inside `dome`; everything maps through the dome box so
    // it survives a resize.
    const geometry = () => {
      const baseH = Math.min(74, height * 0.2)
      const pad = Math.min(width, height - baseH) * 0.04
      const avail = Math.min(width - pad * 2, height - baseH - pad)
      const D = Math.max(1, avail) // dome diameter
      const cx = width / 2
      const top = pad
      const cy = top + D / 2
      const R = D / 2
      const left = cx - R
      return { baseH, D, R, cx, cy, top, left, bottom: top + D }
    }

    // Map a flake (dome-box fraction) to canvas pixels.
    const toPx = (f: Flake, g: ReturnType<typeof geometry>) => ({
      px: g.left + f.x * g.D,
      py: g.top + f.y * g.D,
    })

    const clear = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
    }

    // The bank line: the resting height of snow at the bottom of the glass, as a
    // y-fraction of the dome box. A gentle rise toward the walls so it reads as
    // a drift rather than a flat shelf.
    const bankY = (xFrac: number) => {
      const edge = Math.abs(xFrac - 0.5) * 2 // 0 centre .. 1 walls
      return 0.9 - edge * edge * 0.06
    }

    // --- The Berlin skyline, drawn once per frame inside the glass. Dark
    // shapes with a faint cool rim where the night sky catches their top edge.
    const drawCity = (g: ReturnType<typeof geometry>) => {
      const { left, top, D } = g
      const X = (fx: number) => left + fx * D
      const Y = (fy: number) => top + fy * D
      const bank = 0.9

      ctx.save()
      // Rooftops — a low, quiet row along the bank, varied heights.
      const roofs: [number, number][] = [
        [0.2, 0.74],
        [0.28, 0.8],
        [0.72, 0.78],
        [0.8, 0.83],
        [0.86, 0.8],
      ]
      ctx.fillStyle = '#0a0d16'
      for (const [cxf, topf] of roofs) {
        const w = 0.07
        ctx.fillRect(X(cxf - w / 2), Y(topf), w * D, (bank - topf) * D)
      }

      // A church with a pitched spire, left of centre.
      ctx.beginPath()
      const chx = 0.34
      ctx.moveTo(X(chx - 0.03), Y(0.72))
      ctx.lineTo(X(chx), Y(0.64))
      ctx.lineTo(X(chx + 0.03), Y(0.72))
      ctx.lineTo(X(chx + 0.03), Y(bank))
      ctx.lineTo(X(chx - 0.03), Y(bank))
      ctx.closePath()
      ctx.fill()

      // The Fernsehturm — tapered shaft, a lit sphere, and a long antenna.
      const tx = 0.54
      const shaftTop = 0.4
      const shaftBottom = bank
      ctx.beginPath()
      ctx.moveTo(X(tx - 0.012), Y(shaftBottom))
      ctx.lineTo(X(tx - 0.006), Y(shaftTop))
      ctx.lineTo(X(tx + 0.006), Y(shaftTop))
      ctx.lineTo(X(tx + 0.012), Y(shaftBottom))
      ctx.closePath()
      ctx.fill()
      // Antenna above the sphere.
      ctx.strokeStyle = '#0a0d16'
      ctx.lineWidth = Math.max(1, D * 0.004)
      ctx.beginPath()
      ctx.moveTo(X(tx), Y(shaftTop))
      ctx.lineTo(X(tx), Y(0.22))
      ctx.stroke()
      // The sphere, the one thing in the scene that is lit.
      const sx = X(tx)
      const sy = Y(0.37)
      const sr = D * 0.028
      const sg = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 1, sx, sy, sr)
      sg.addColorStop(0, 'rgba(220,248,124,0.95)')
      sg.addColorStop(0.5, 'rgba(176,198,110,0.9)')
      sg.addColorStop(1, 'rgba(20,26,20,1)')
      ctx.fillStyle = sg
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
      // A soft halo so the sphere reads as the lit beacon it is.
      ctx.globalCompositeOperation = 'lighter'
      const halo = ctx.createRadialGradient(sx, sy, 1, sx, sy, sr * 2.6)
      halo.addColorStop(0, 'rgba(220,248,124,0.28)')
      halo.addColorStop(1, 'rgba(220,248,124,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(sx, sy, sr * 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'

      // A cool rim light along the very tops of the dark mass, so the skyline
      // doesn't read as a flat silhouette cut from paper.
      ctx.strokeStyle = 'rgba(150,180,230,0.14)'
      ctx.lineWidth = 1
      for (const [cxf, topf] of roofs) {
        const w = 0.07
        ctx.beginPath()
        ctx.moveTo(X(cxf - w / 2), Y(topf))
        ctx.lineTo(X(cxf + w / 2), Y(topf))
        ctx.stroke()
      }
      ctx.restore()
    }

    const paint = () => {
      clear()
      const g = geometry()
      const { D, R, cx, cy, top, left, bottom, baseH } = g

      // --- The base the globe sits on: a dark plinth with a lit top lip. ---
      const baseW = D * 0.62
      const bx = cx - baseW / 2
      const by = bottom - D * 0.06
      const bh = baseH
      ctx.save()
      ctx.beginPath()
      const rr = Math.min(12, bh / 2)
      ctx.moveTo(bx + rr, by)
      ctx.lineTo(bx + baseW - rr, by)
      ctx.quadraticCurveTo(bx + baseW, by, bx + baseW + 2, by + rr)
      ctx.lineTo(bx + baseW - bh * 0.3, by + bh)
      ctx.lineTo(bx + bh * 0.3, by + bh)
      ctx.lineTo(bx - 2, by + rr)
      ctx.quadraticCurveTo(bx, by, bx + rr, by)
      ctx.closePath()
      const baseGrad = ctx.createLinearGradient(0, by, 0, by + bh)
      baseGrad.addColorStop(0, 'rgba(58,44,34,0.98)')
      baseGrad.addColorStop(0.5, 'rgba(38,28,22,1)')
      baseGrad.addColorStop(1, 'rgba(20,15,12,1)')
      ctx.fillStyle = baseGrad
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,230,190,0.14)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // --- The glass interior, clipped to the dome circle. ---
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      // Night sky inside the glass, deep indigo with a low glow.
      const sky = ctx.createLinearGradient(0, top, 0, bottom)
      sky.addColorStop(0, '#0a1330')
      sky.addColorStop(0.55, '#12204a')
      sky.addColorStop(1, '#0c1526')
      ctx.fillStyle = sky
      ctx.fillRect(left, top, D, D)
      // A pale moon high on the right.
      const mx = left + D * 0.74
      const my = top + D * 0.24
      const moon = ctx.createRadialGradient(mx, my, 1, mx, my, D * 0.1)
      moon.addColorStop(0, 'rgba(226,232,248,0.9)')
      moon.addColorStop(0.5, 'rgba(226,232,248,0.18)')
      moon.addColorStop(1, 'rgba(226,232,248,0)')
      ctx.fillStyle = moon
      ctx.fillRect(left, top, D, D)

      // Far flakes first (small, dim), so the skyline sits in the middle depth.
      const drawFlakes = (nearHalf: boolean) => {
        for (const f of flakes) {
          if (nearHalf !== f.depth >= 0.5) continue
          const { px, py } = toPx(f, g)
          const rad = f.r * D
          const a = 0.35 + f.depth * 0.55
          ctx.fillStyle = `rgba(245,248,255,${a})`
          ctx.beginPath()
          ctx.arc(px, py, rad, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      drawFlakes(false)

      // The city.
      drawCity(g)

      // The snow bank at the bottom — a soft white drift over the skyline feet.
      ctx.beginPath()
      ctx.moveTo(left, top + D)
      const steps = 20
      for (let i = 0; i <= steps; i++) {
        const xf = i / steps
        ctx.lineTo(left + xf * D, top + bankY(xf) * D)
      }
      ctx.lineTo(left + D, top + D)
      ctx.closePath()
      const bankGrad = ctx.createLinearGradient(0, top + D * 0.84, 0, top + D)
      bankGrad.addColorStop(0, 'rgba(236,242,255,0.95)')
      bankGrad.addColorStop(1, 'rgba(206,218,240,0.92)')
      ctx.fillStyle = bankGrad
      ctx.fill()

      // Near flakes last, over the bank and skyline, so the globe has volume.
      drawFlakes(true)

      ctx.restore() // end interior clip

      // --- Glass itself: a cool fill, a bright rim, a top-left specular arc. ---
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      const glassSheen = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.1, cx, cy, R)
      glassSheen.addColorStop(0, 'rgba(255,255,255,0.06)')
      glassSheen.addColorStop(0.7, 'rgba(255,255,255,0)')
      glassSheen.addColorStop(1, 'rgba(10,14,26,0.22)')
      ctx.fillStyle = glassSheen
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.stroke()
      // A crisp specular highlight arc, upper-left.
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.9, Math.PI * 1.05, Math.PI * 1.4)
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()
    }

    // --- Physics. One step off the frame delta. ---
    const GRAV = 0.09 // fraction/s² — slow, globe snow is suspended in liquid
    const step = (dt: number) => {
      const T = turbulenceRef.current
      turbulenceRef.current = Math.max(0, T - dt * 0.42) // decay a shake away
      for (const f of flakes) {
        const speed = 0.35 + f.depth * 0.75
        if (f.resting && T < 0.02) {
          // At rest on the bank and nothing is stirring it — leave it be.
          continue
        }
        f.resting = false
        // Gravity, scaled by depth so near snow falls a touch faster.
        f.vy += GRAV * speed * dt
        // Turbulence: a swirl about the globe centre plus a per-flake jitter,
        // strongest right after a shake and fading as T decays.
        if (T > 0.001) {
          const ang = Math.atan2(f.y - 0.5, f.x - 0.5)
          f.vx += Math.cos(ang + Math.PI / 2) * T * 0.9 * dt
          f.vy += Math.sin(ang + Math.PI / 2) * T * 0.9 * dt
          f.vx += Math.sin(f.phase) * T * 0.5 * dt
          f.vy += Math.cos(f.phase) * T * 0.5 * dt
          f.phase += dt * (1 + f.depth)
        }
        // Viscous drag — the signature slow drift.
        const drag = Math.min(1, dt * (1.6 + f.depth * 0.8))
        f.vx -= f.vx * drag
        f.vy -= f.vy * drag
        f.x += f.vx * dt
        f.y += f.vy * dt

        // Keep the flake inside the circular glass (dome box is the unit square,
        // circle radius 0.5 about centre). Push back and shed outward velocity.
        const dx = f.x - 0.5
        const dy = f.y - 0.5
        const dist = Math.hypot(dx, dy)
        const wall = 0.47 - f.r
        if (dist > wall) {
          const nx = dx / (dist || 1)
          const ny = dy / (dist || 1)
          f.x = 0.5 + nx * wall
          f.y = 0.5 + ny * wall
          // Remove the outward component so flakes slide along the glass.
          const vn = f.vx * nx + f.vy * ny
          f.vx -= vn * nx * 1.3
          f.vy -= vn * ny * 1.3
        }

        // Rest on the bank: below the drift line, moving slowly, nothing stirring.
        const floor = bankY(f.x) - f.r
        if (f.y >= floor) {
          f.y = floor
          if (Math.abs(f.vy) < 0.05 && T < 0.05) {
            f.vy = 0
            f.vx *= 0.6
            f.resting = true
          } else {
            f.vy = -Math.abs(f.vy) * 0.18
            f.vx *= 0.7
          }
        }
      }
    }

    // A shake: wake the bank, lift everything, and set turbulence to full.
    const shake = () => {
      turbulenceRef.current = 1
      const r = seeded(0xa11 + Math.floor(performance.now()))
      for (const f of flakes) {
        f.resting = false
        f.vy -= 0.35 + r() * 0.5 // an upward kick
        f.vx += (r() - 0.5) * 0.6
      }
      if (reduce) {
        // No loop under reduced motion: reshuffle to a fresh still and repaint.
        for (const f of flakes) {
          f.x = 0.08 + r() * 0.84
          f.y = r() * 0.86
          f.vx = 0
          f.vy = 0
          f.resting = false
        }
        turbulenceRef.current = 0
        paint()
      }
    }
    shakeFnRef.current = shake

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      paint()
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) paint()
    })
    ro.observe(canvas)

    if (reduce) {
      // Settle a fuller bank and catch the rest mid-drift, then hold the still.
      for (const f of flakes) {
        if (f.y > bankY(f.x) - f.r - 0.04) f.resting = true
      }
      paint()
    } else {
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reduce, count])

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <canvas
        ref={canvasRef}
        aria-hidden
        onPointerDown={() => shakeFnRef.current()}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'pointer', touchAction: 'none' }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <button
          type="button"
          onClick={() => shakeFnRef.current()}
          className="pointer-events-auto rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#DCF87C] transition hover:bg-[#DCF87C]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          aria-label="Shake the snow globe"
        >
          Shake
        </button>
      </div>
    </div>
  )
}
