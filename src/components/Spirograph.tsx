import { useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

// A spirograph — the geared drawing toy, kept honest to the maths behind it.
// A small wheel of radius r rolls without slipping around the inside of a fixed
// ring of radius R, and a pen dropped through a hole at distance a from the
// wheel's centre traces a hypotrochoid:
//   x(θ) = (R − r)·cos θ + a·cos(((R − r)/r)·θ)
//   y(θ) = (R − r)·sin θ − a·sin(((R − r)/r)·θ)
// With integer R and r the curve is periodic and closes exactly, after
// θ = 2π · r / gcd(R, r); the ratio R : r sets how many lobes it has, and the
// pen offset a sets how sharp or round they are. So this is not a decorative
// squiggle: change the two gears and the figure changes for a real reason.
//
// Distinct from the Harmonograph next door — that plotter is a *seeded* set of
// decaying pendulums you can only reroll; this one you *drive*, choosing the
// gears and the pen and watching the same rule redraw. A wheel visibly rolls
// the inside of the ring while a pen at the end of its spoke lays the trace,
// which glows where it crosses itself because it is composited additively, the
// way graphite builds where a plotter passes twice.
//
// One canvas, one rAF loop, DPR-capped and resize-driven; no per-point React
// state. The pen path is pre-sampled once whenever the gears change, then the
// loop just replays it. Honest to a11y: the canvas is decorative and
// aria-hidden with an sr-only account; the gears and pen are real labelled
// controls (steppers with a keyboard-drivable slider). Under reduced motion the
// finished figure is drawn once, instantly, with no rolling wheel or travelling
// pen — and changing a control simply redraws the new figure whole.

interface SpirographProps {
  className?: string
}

const RING_MIN = 40
const RING_MAX = 140
const GEAR_MIN = 18
// The rolling wheel must stay strictly smaller than the ring, with a little
// headroom so there is always a visible annulus between them.
const GEAR_GAP = 10

function gcd(a: number, b: number): number {
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

interface Figure {
  pts: Float32Array // pen path, normalised so the ring radius R maps to 1
  R: number
  r: number
  a: number // pen distance, in the same units as R and r
  k: number // R − r, the rolling centre's orbit radius
}

// Pre-sample the whole closed pen path once. Point count scales with how many
// times the wheel goes round (r / gcd), so busy figures get enough resolution
// and simple ones stay cheap; capped so a pathological ratio can't run away.
function sampleFigure(R: number, r: number, penFrac: number): Figure {
  const g = gcd(R, r)
  const k = R - r
  const a = penFrac * r
  const turns = r / g // whole revolutions of the ring to close the curve
  const STEPS = Math.min(9000, Math.max(600, Math.round(turns * 260)))
  const thetaMax = Math.PI * 2 * turns
  const ratio = k / r
  // Fit to the ring radius R (the pen never reaches past k + a ≤ R), so the
  // ring itself can be drawn as the boundary and different gears fill honestly.
  const inv = 1 / R
  const pts = new Float32Array((STEPS + 1) * 2)
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * thetaMax
    pts[i * 2] = (k * Math.cos(t) + a * Math.cos(ratio * t)) * inv
    pts[i * 2 + 1] = (k * Math.sin(t) - a * Math.sin(ratio * t)) * inv
  }
  return { pts, R, r, a, k }
}

// A compact −/＋ stepper for an integer gear count. Real buttons, held value
// echoed for assistive tech through the wrapping fieldset's label.
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label={`Fewer ${label} teeth`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/12 text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white disabled:opacity-30 disabled:hover:border-white/12"
        >
          <span aria-hidden>&minus;</span>
        </button>
        <span
          aria-hidden
          className="w-9 text-center font-display text-lg font-bold tabular-nums text-white"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          aria-label={`More ${label} teeth`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/12 text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white disabled:opacity-30 disabled:hover:border-white/12"
        >
          <span aria-hidden>+</span>
        </button>
      </div>
    </div>
  )
}

// A small hand-built slider for the pen offset (0.1 → 1.0). Real ARIA slider:
// a focusable thumb, arrow keys stepping the value, and pointer drag on the
// track. Kept self-contained so the toy owns its whole surface.
function PenSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const MIN = 0.1
  const MAX = 1
  const pct = ((value - MIN) / (MAX - MIN)) * 100

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      // Snap to a hundredth so the value reads cleanly.
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
        Pen
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Pen offset"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-valuetext={`${Math.round(value * 100)} percent`}
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

export function Spirograph({ className = '' }: SpirographProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [ring, setRing] = useState(96)
  const [gear, setGear] = useState(60)
  const [pen, setPen] = useState(0.82)

  // Keep the wheel strictly smaller than the ring as either changes.
  const safeGear = Math.min(gear, ring - GEAR_GAP)
  const figure = useMemo(
    () => sampleFigure(ring, safeGear, pen),
    [ring, safeGear, pen],
  )

  // How many lobes the current gears produce — R / gcd(R, r) — surfaced so the
  // maths reads as a reason, not a mystery.
  const lobes = ring / gcd(ring, safeGear)

  const sizeRef = useRef(0)
  const dprRef = useRef(1)
  const figureRef = useRef(figure)
  figureRef.current = figure
  const drawnRef = useRef(0)

  // Repaint: the faint ring, the accumulated trace up to `drawn`, and — while
  // the pen is still travelling — the rolling wheel with its spoke and pen tip.
  const paint = useCallback(
    (drawn: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const s = sizeRef.current
      const dpr = dprRef.current
      const fig = figureRef.current
      const pts = fig.pts
      const total = pts.length / 2

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, s, s)

      const pad = s * 0.08
      const R = s / 2 - pad // pixel radius of the fixed ring (fig is fitted to it)
      const cx = s / 2
      const cy = s / 2
      const map = (nx: number, ny: number): [number, number] => [
        cx + nx * R,
        cy + ny * R,
      ]

      // The fixed ring, faint.
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()

      // The trace, composited additively so crossings read as light.
      if (drawn >= 2) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.lineWidth = Math.max(0.7, s / 560)
        ctx.strokeStyle = 'rgba(220, 248, 124, 0.34)'
        ctx.beginPath()
        let [px, py] = map(pts[0], pts[1])
        ctx.moveTo(px, py)
        for (let i = 1; i < drawn; i++) {
          ;[px, py] = map(pts[i * 2], pts[i * 2 + 1])
          ctx.lineTo(px, py)
        }
        ctx.stroke()
        ctx.globalCompositeOperation = 'source-over'
      }

      // The mechanism, only while the pen is mid-figure.
      if (drawn > 1 && drawn < total) {
        const head = drawn - 1
        const [hx, hy] = map(pts[head * 2], pts[head * 2 + 1])
        // Recover the rolling centre for this θ from the closed-form orbit.
        const t = (head / (total - 1)) * Math.PI * 2 * (fig.r / gcd(fig.R, fig.r))
        const [gcx, gcy] = map(
          (fig.k * Math.cos(t)) / fig.R,
          (fig.k * Math.sin(t)) / fig.R,
        )
        const gearR = (fig.r / fig.R) * R

        // Rolling wheel.
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(gcx, gcy, gearR, 0, Math.PI * 2)
        ctx.stroke()
        // Wheel hub.
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath()
        ctx.arc(gcx, gcy, Math.max(1.4, s / 240), 0, Math.PI * 2)
        ctx.fill()
        // Spoke from hub to pen.
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'
        ctx.beginPath()
        ctx.moveTo(gcx, gcy)
        ctx.lineTo(hx, hy)
        ctx.stroke()
        // Pen tip: a bright bloom at the head of the trace.
        const pr = Math.max(2, s / 96)
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, pr * 3)
        glow.addColorStop(0, 'rgba(220, 248, 124, 0.95)')
        glow.addColorStop(1, 'rgba(220, 248, 124, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(hx, hy, pr * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [],
  )

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

  // Redraw whenever the gears or pen change: travel the pen across the fresh
  // figure, or — under reduced motion — lay the whole thing down at once.
  useEffect(() => {
    const total = figure.pts.length / 2

    if (reduce) {
      drawnRef.current = total
      paint(total)
      return
    }

    drawnRef.current = 0
    let raf = 0
    let last = 0
    // A steady ~3s to lay any figure, whatever its length.
    const perSec = total / 3
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
  }, [figure, reduce, paint])

  // A fresh pair of gears and a pen, coprime-ish so the figure is busy.
  const randomize = useCallback(() => {
    const R = RING_MIN + Math.floor(Math.random() * (RING_MAX - RING_MIN + 1))
    const rMax = R - GEAR_GAP
    const r = GEAR_MIN + Math.floor(Math.random() * (rMax - GEAR_MIN + 1))
    setRing(R)
    setGear(r)
    setPen(0.45 + Math.round(Math.random() * 55) / 100)
  }, [])

  return (
    <div className={`flex flex-col items-center gap-7 ${className}`}>
      <div
        ref={wrapRef}
        className="relative aspect-square w-full max-w-[440px] overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(120%_120%_at_30%_20%,#141414,#0a0a0a)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.6)]"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      </div>

      {/* Controls — real, labelled, keyboard-drivable. */}
      <div className="w-full max-w-[440px] space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <Stepper label="Ring" value={ring} min={RING_MIN} max={RING_MAX} onChange={setRing} />
        <Stepper
          label="Wheel"
          value={safeGear}
          min={GEAR_MIN}
          max={ring - GEAR_GAP}
          onChange={setGear}
        />
        <PenSlider value={pen} onChange={setPen} />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-white/40">
            <span className="tabular-nums text-white/70">{lobes}</span>{' '}
            {lobes === 1 ? 'lobe' : 'lobes'}
          </span>
          <button
            type="button"
            onClick={randomize}
            aria-describedby={id}
            className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
          >
            <span
              aria-hidden
              className="grid h-4 w-4 place-items-center text-white/60 transition-colors group-hover:text-[#DCF87C]"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="8" cy="8" r="6" />
                <circle cx="8" cy="5" r="1.4" />
              </svg>
            </span>
            New gears
          </button>
        </div>
      </div>
      <span id={id} className="sr-only">
        {reduce
          ? 'A spirograph, showing one completed figure at rest. Change the ring, the wheel, or the pen offset to draw a different figure.'
          : 'Draw a spirograph. Set the ring and wheel tooth counts and the pen offset, or pick a new pair of gears at random, and watch the wheel roll the figure out.'}
      </span>
    </div>
  )
}
