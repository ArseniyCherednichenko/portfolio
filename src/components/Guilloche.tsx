import { motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

// Guilloché — the engine-turned engraving you find on a watch dial, a fountain
// pen, or the border of a banknote, kept honest to the machine that makes it.
// A rose-engine lathe cuts one simple curve over and over while slowly indexing
// the work between passes; the passes interleave, and it is that overlap — never
// any one line — that weaves the dense, impossible-to-forge lattice. Nothing
// here is a texture or a filter: every strand is the same closed rosette, laid
// down again at a turned angle, and the picture is the sum of where they cross.
//
// The rosette is a radius modulated by one or two harmonics as the angle sweeps:
//   r(t) = base + a1·sin(p1·t) + a2·sin(p2·t)
//   x(t) = r(t)·cos t ,  y(t) = r(t)·sin t ,  t ∈ [0, 2π]
// so p1 and p2 set how many lobes ring the figure and a1, a2 how deep they cut.
// Each successive pass is rotated by the golden angle (≈137.5°), the same step
// a sunflower packs its seeds by — it never repeats and never leaves a gap, so
// the passes fill the dial evenly however many you lay. That even, non-repeating
// index is exactly what a real rose engine's dividing plate is chosen to avoid:
// a lattice with no seam.
//
// Kin to the Spirograph and the Harmonograph — all three are one closed rule
// sampled densely — but where those lay a single travelling pen, this is many
// rotated copies of one rosette whose crossings do the drawing, the way an
// engraver builds tone by cross-hatching. One canvas, laid pass-by-pass onto a
// single persistent buffer (each strand a sub-path, composited 'lighter' so the
// crossings bloom toward white), then the finished plate turns on its mount at a
// glacial pace via a GPU transform — no per-frame restroke. Reduced motion lays
// the whole plate down in one pass and holds it perfectly still.

interface GuillocheProps {
  className?: string
}

interface Plate {
  id: string
  name: string
  p1: number
  a1: number
  p2: number
  a2: number
  passes: number
}

// Four honest plates — named for what the maths actually makes, not borrowed
// from a pattern book it does not reproduce. Each is one rosette's harmonics
// plus how many turned passes weave it.
const PLATES: Plate[] = [
  { id: 'rosette', name: 'Rosette', p1: 5, a1: 0.3, p2: 0, a2: 0, passes: 96 },
  { id: 'sunburst', name: 'Sunburst', p1: 22, a1: 0.11, p2: 0, a2: 0, passes: 80 },
  { id: 'weave', name: 'Weave', p1: 7, a1: 0.22, p2: 11, a2: 0.1, passes: 150 },
  { id: 'bloom', name: 'Bloom', p1: 3, a1: 0.34, p2: 9, a2: 0.12, passes: 120 },
]

const GOLDEN = Math.PI * (3 - Math.sqrt(5)) // the golden angle, ≈ 2.39996 rad
const BASE = 0.6 // normalised rest radius; fits in the unit disc with the lobes

interface Figure {
  // One Float32Array for the whole plate: `passes` strands laid end to end,
  // each `seg + 1` points, normalised so the plate radius maps to 1.
  pts: Float32Array
  passes: number
  seg: number
}

// Pre-sample every strand of the plate once. Each pass is the same rosette,
// rotated by i × the golden angle, so the whole dial fills evenly and without a
// repeat. Depth scales both harmonics together.
function sampleFigure(plate: Plate, depth: number): Figure {
  const { p1, a1, p2, a2, passes } = plate
  // Resolution tracks the fastest lobe so even the Sunburst stays smooth.
  const seg = Math.min(360, Math.max(140, Math.round(Math.max(p1, p2) * 16)))
  const A1 = a1 * depth
  const A2 = a2 * depth
  const stride = seg + 1
  const pts = new Float32Array(passes * stride * 2)
  for (let i = 0; i < passes; i++) {
    const rot = i * GOLDEN
    const base = i * stride * 2
    for (let j = 0; j <= seg; j++) {
      const t = (j / seg) * Math.PI * 2
      const r = BASE + A1 * Math.sin(p1 * t) + (p2 ? A2 * Math.sin(p2 * t) : 0)
      const a = t + rot
      pts[base + j * 2] = r * Math.cos(a)
      pts[base + j * 2 + 1] = r * Math.sin(a)
    }
  }
  return { pts, passes, seg }
}

// A small hand-built slider for the cut depth (0.5 → 1.3). Real ARIA slider: a
// focusable thumb, arrow keys stepping the value, pointer drag on the track —
// mirrors the pen slider on the Spirograph so the family's controls read alike.
function DepthSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const MIN = 0.5
  const MAX = 1.3
  const pct = ((value - MIN) / (MAX - MIN)) * 100

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onChange(Math.round((MIN + frac * (MAX - MIN)) * 100) / 100)
    },
    [onChange],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setFromClientX(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return
    setFromClientX(e.clientX)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(MIN, Math.round((value - step) * 100) / 100))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(MAX, Math.round((value + step) * 100) / 100))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(MIN)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(MAX)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
        Depth
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Cut depth"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-valuetext={`${Math.round(((value - MIN) / (MAX - MIN)) * 100)} percent`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="relative h-8 flex-1 cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <span
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#DCF87C]/70"
          style={{ width: `${pct}%` }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#DCF87C] bg-black shadow-[0_0_0_4px_rgba(220,248,124,0.12)]"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function Guilloche({ className = '' }: GuillocheProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [plateIndex, setPlateIndex] = useState(2) // the Weave reads best on load
  const [depth, setDepth] = useState(1)
  const [done, setDone] = useState(false)

  const plate = PLATES[plateIndex]
  const figure = useMemo(() => sampleFigure(plate, depth), [plate, depth])

  const sizeRef = useRef(0)
  const dprRef = useRef(1)
  const figureRef = useRef(figure)
  figureRef.current = figure

  // Prepare a blank engraving field: clear the buffer and stroke the faint
  // bounding ring, so every re-engrave starts from the same clean dial.
  const prime = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const s = sizeRef.current
    const dpr = dprRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, s, s)
    const pad = s * 0.07
    const R = s / 2 - pad
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, R, 0, Math.PI * 2)
    ctx.stroke()
    return ctx
  }, [])

  // Lay a half-open range of strands [from, to) onto the persistent buffer. Each
  // strand is one rosette sub-path, rotated by the golden angle; tinted teal at
  // the first pass and warming to lime at the last, so the winding order stays
  // legible, and composited additively so the crossings bloom toward white.
  const strokePasses = useCallback(
    (ctx: CanvasRenderingContext2D, from: number, to: number) => {
      const s = sizeRef.current
      const fig = figureRef.current
      const { pts, passes, seg } = fig
      const stride = seg + 1
      const pad = s * 0.07
      const R = s / 2 - pad
      const cx = s / 2
      const cy = s / 2
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(0.55, s / 680)
      const hi = Math.min(to, passes)
      for (let i = Math.max(0, from); i < hi; i++) {
        const f = passes > 1 ? i / (passes - 1) : 0
        // teal (95,227,201) → lime (220,248,124)
        const r = Math.round(95 + (220 - 95) * f)
        const g = Math.round(227 + (248 - 227) * f)
        const b = Math.round(201 + (124 - 201) * f)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.2)`
        const base = i * stride * 2
        ctx.beginPath()
        ctx.moveTo(cx + pts[base] * R, cy + pts[base + 1] * R)
        for (let j = 1; j < stride; j++) {
          ctx.lineTo(cx + pts[base + j * 2] * R, cy + pts[base + j * 2 + 1] * R)
        }
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    },
    [],
  )

  // Size the backing store to the square container at device resolution, then
  // re-engrave — the buffer is persistent, so a resize has to redraw the plate.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    let raf = 0
    let laid = 0
    let last = 0
    const engrave = () => {
      const ctx = prime()
      if (!ctx) return
      const fig = figureRef.current
      if (reduce) {
        strokePasses(ctx, 0, fig.passes)
        setDone(true)
        return
      }
      setDone(false)
      laid = 0
      last = 0
      // A steady ~2.6s to turn the whole plate, whatever the pass count.
      const perSec = fig.passes / 2.6
      const tick = (now: number) => {
        if (!last) last = now
        const dt = Math.min(now - last, 64) / 1000
        last = now
        const next = Math.min(fig.passes, laid + perSec * dt)
        strokePasses(ctx, Math.floor(laid), Math.floor(next))
        laid = next
        if (laid < fig.passes) {
          raf = requestAnimationFrame(tick)
        } else {
          setDone(true)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    const resize = () => {
      const size = Math.round(wrap.clientWidth)
      if (!size) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = size
      dprRef.current = dpr
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.height = `${size}px`
      cancelAnimationFrame(raf)
      engrave()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [figure, reduce, prime, strokePasses])

  // A fresh, still-tasteful plate: pick a different pattern and a new depth.
  const reengrave = useCallback(() => {
    setPlateIndex((i) => (i + 1 + Math.floor(Math.random() * (PLATES.length - 1))) % PLATES.length)
    setDepth(0.7 + Math.round(Math.random() * 55) / 100)
  }, [])

  return (
    <div className={`flex flex-col items-center gap-7 ${className}`}>
      <div
        ref={wrapRef}
        className="relative aspect-square w-full max-w-[440px] overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(120%_120%_at_30%_20%,#121212,#070707)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.6)]"
      >
        <motion.div
          className="absolute inset-0"
          animate={done && !reduce ? { rotate: 360 } : { rotate: 0 }}
          transition={
            done && !reduce
              ? { duration: 160, ease: 'linear', repeat: Infinity }
              : { duration: 0 }
          }
        >
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        </motion.div>
      </div>

      {/* Controls — real, labelled, keyboard-reachable. */}
      <div className="w-full max-w-[440px] space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
            Plate
          </span>
          <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label="Plate pattern">
            {PLATES.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={i === plateIndex}
                onClick={() => setPlateIndex(i)}
                className={`rounded-full border px-2 py-2 text-xs font-semibold tracking-tight transition-colors ${
                  i === plateIndex
                    ? 'border-[#DCF87C]/60 bg-[#DCF87C]/[0.08] text-[#DCF87C]'
                    : 'border-white/12 text-white/60 hover:border-white/30 hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <DepthSlider value={depth} onChange={setDepth} />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-white/40">
            <span className="tabular-nums text-white/70">{plate.passes}</span> passes
          </span>
          <button
            type="button"
            onClick={reengrave}
            aria-describedby={id}
            className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
          >
            <span
              aria-hidden
              className="grid h-4 w-4 place-items-center text-white/60 transition-colors group-hover:text-[#DCF87C]"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="8" cy="8" r="6" />
                <circle cx="8" cy="8" r="2" />
              </svg>
            </span>
            Re-engrave
          </button>
        </div>
      </div>
      <span id={id} className="sr-only">
        {reduce
          ? 'A guilloché engraving — one rosette curve laid down many times at turned angles, shown complete and at rest. Choose a plate pattern or the cut depth to engrave a different figure.'
          : 'An engine-turned guilloché plate. Pick a plate pattern, set the cut depth, or re-engrave at random, and watch one rosette curve laid down pass by pass at the golden angle until the lattice fills.'}
      </span>
    </div>
  )
}
