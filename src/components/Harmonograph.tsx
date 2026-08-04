import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A harmonograph — the Victorian drawing machine where two or three pendulums,
// one swinging a pen and the others swinging the paper, trace the interference
// of their motions as they slowly wind down. This is the real thing in maths,
// not a decorative squiggle: each axis is the sum of two decaying sinusoids,
// x(t) = Σ aᵢ·sin(fᵢt + pᵢ)·e^(−dᵢt), and the near-integer frequency ratios
// with a hair of detuning are exactly what make the loops drift and precess
// into a figure instead of closing on themselves. A pen tip walks the curve in
// real time and the crossings glow because the trace is composited 'lighter',
// so density reads as light — the way graphite builds on paper. Distinct from
// everything else here: not a field, a card, a text effect or a weight on a
// string, but a *plotter*, deterministic from a seed. Click the plate or the
// button to hang a fresh set of pendulums. Honest to a11y: the canvas is
// decorative and aria-hidden with an sr-only account, and under reduced motion
// the finished figure is drawn once, instantly, with no travelling pen.

interface HarmonographProps {
  className?: string
}

interface Pendulum {
  a: number // amplitude, 0..1
  f: number // angular frequency
  p: number // phase
  d: number // damping per t-unit
}

interface Figure {
  x: [Pendulum, Pendulum]
  y: [Pendulum, Pendulum]
}

// A tiny seedable PRNG (mulberry32) so a seed reproduces a figure exactly and
// the same plate can be redrawn identically under reduced motion.
function mulberry32(seed: number) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeFigure(seed: number): Figure {
  const rnd = mulberry32(seed)
  // A small integer base ratio is what gives a legible figure; the detune is
  // the slow precession that keeps it from closing into a single flat loop.
  const base = 2 + Math.floor(rnd() * 3) // 2..4
  const detune = () => (rnd() - 0.5) * 0.08
  const pend = (freq: number): Pendulum => ({
    a: 0.55 + rnd() * 0.45,
    f: freq + detune(),
    p: rnd() * Math.PI * 2,
    d: 0.0016 + rnd() * 0.0042,
  })
  return {
    x: [pend(base), pend(base + 1 + Math.floor(rnd() * 2))],
    y: [pend(base), pend(base + 1 + Math.floor(rnd() * 2))],
  }
}

// Pre-sample the whole curve to normalised [-1, 1] once per figure, so the draw
// loop is a cheap replay of a point array rather than trig every frame.
function samplePoints(fig: Figure): Float32Array {
  const STEPS = 2600
  const DT = 0.55
  const pts = new Float32Array(STEPS * 2)
  const term = (pd: Pendulum, t: number) =>
    pd.a * Math.sin(pd.f * t + pd.p) * Math.exp(-pd.d * t)
  for (let i = 0; i < STEPS; i++) {
    const t = i * DT
    pts[i * 2] = (term(fig.x[0], t) + term(fig.x[1], t)) / 2
    pts[i * 2 + 1] = (term(fig.y[0], t) + term(fig.y[1], t)) / 2
  }
  return pts
}

export function Harmonograph({ className = '' }: HarmonographProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [seed, setSeed] = useState(() => 0x1a2b3c)

  // Live drawing state kept in refs so the rAF loop never triggers a re-render.
  const pointsRef = useRef<Float32Array>(samplePoints(makeFigure(0x1a2b3c)))
  const sizeRef = useRef(0)
  const dprRef = useRef(1)
  const drawnRef = useRef(0)

  // Repaint the plate from scratch up to `drawn` points. Additive compositing
  // makes overlapping strokes accumulate into light, so the busy centre glows.
  const paint = useCallback((drawn: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = sizeRef.current
    const dpr = dprRef.current
    const pts = pointsRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, s, s)
    if (drawn < 2) return

    const pad = s * 0.09
    const scale = s / 2 - pad
    const map = (nx: number, ny: number): [number, number] => [
      s / 2 + nx * scale,
      s / 2 + ny * scale,
    ]

    ctx.globalCompositeOperation = 'lighter'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(0.6, s / 620)
    ctx.strokeStyle = 'rgba(220, 248, 124, 0.16)'
    ctx.beginPath()
    let [px, py] = map(pts[0], pts[1])
    ctx.moveTo(px, py)
    for (let i = 1; i < drawn; i++) {
      ;[px, py] = map(pts[i * 2], pts[i * 2 + 1])
      ctx.lineTo(px, py)
    }
    ctx.stroke()

    // The pen tip: a bright bloom at the head of the trace while it travels.
    if (drawn < pts.length / 2) {
      const [hx, hy] = map(pts[(drawn - 1) * 2], pts[(drawn - 1) * 2 + 1])
      const r = Math.max(2, s / 90)
      const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 3)
      glow.addColorStop(0, 'rgba(220, 248, 124, 0.9)')
      glow.addColorStop(1, 'rgba(220, 248, 124, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(hx, hy, r * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }, [])

  // Size the backing store to the square container at device resolution.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const s = Math.round(wrap.clientWidth)
      if (!s) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = s
      dprRef.current = dpr
      canvas.width = s * dpr
      canvas.height = s * dpr
      canvas.style.height = `${s}px`
      paint(drawnRef.current)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [paint])

  // Draw a fresh figure whenever the seed changes: animate the pen across it,
  // or, under reduced motion, lay the whole figure down in one frame.
  useEffect(() => {
    pointsRef.current = samplePoints(makeFigure(seed))
    const total = pointsRef.current.length / 2

    if (reduce) {
      drawnRef.current = total
      paint(total)
      return
    }

    drawnRef.current = 0
    let raf = 0
    let last = 0
    // ~2.4s to lay the full trace; steady in points-per-second.
    const perSec = total / 2.4
    const tick = (now: number) => {
      if (!last) last = now
      const dt = Math.min(now - last, 64) / 1000
      last = now
      drawnRef.current = Math.min(total, drawnRef.current + perSec * dt)
      paint(Math.floor(drawnRef.current))
      if (drawnRef.current < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seed, reduce, paint])

  const reseed = useCallback(() => {
    // A fresh random plate; kept in [1, 2^24) so the PRNG has room to spread.
    setSeed(1 + Math.floor(Math.random() * 0xffffff))
  }, [])

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      <div
        ref={wrapRef}
        onClick={reduce ? undefined : reseed}
        className={`relative aspect-square w-full max-w-[440px] overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(120%_120%_at_30%_20%,#141414,#0a0a0a)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.6)] ${
          reduce ? '' : 'cursor-pointer'
        }`}
      >
        {/* Faint concentric guide, like the ruling on a plotter's plate. */}
        <div
          className="pointer-events-none absolute inset-6 rounded-full opacity-[0.5]"
          style={{
            background:
              'repeating-radial-gradient(circle at center, transparent 0, transparent 21px, rgba(255,255,255,0.03) 22px, transparent 23px)',
          }}
        />
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      </div>

      <button
        type="button"
        onClick={reseed}
        aria-describedby={id}
        className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
      >
        <span
          aria-hidden
          className="grid h-4 w-4 place-items-center text-white/60 transition-colors group-hover:text-[#DCF87C]"
        >
          {/* A small pen-nib glyph. */}
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M11 2l3 3-7.5 7.5L3 13.5l1-3.5L11 2z" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M9 4l3 3" strokeLinecap="round" />
          </svg>
        </span>
        New figure
      </button>
      <span id={id} className="sr-only">
        {reduce
          ? 'A harmonograph plate, showing one completed figure at rest.'
          : 'Draw a new harmonograph figure. You can also click the plate itself.'}
      </span>
    </div>
  )
}
