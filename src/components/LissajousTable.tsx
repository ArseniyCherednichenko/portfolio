import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Lissajous table: the classic harmonic grid. Every cell traces the curve a
// point draws when two sine waves drive it at right angles —
//   x = sin(fx * theta + delta),  y = sin(fy * theta)
// — with the horizontal frequency fx fixed per column (1, 2, 3, ...) and the
// vertical frequency fy fixed per row. The ratio fx:fy decides the shape, so
// the whole table lays the integer ratios out at a glance: the first row and
// column are plain back-and-forth lines, the diagonal (1:1, 2:2, ...) collapses
// to a single loop, and the off-diagonal cells knot into pretzels, bows and
// cages. The one moving number is the phase delta between the two waves: slide
// it and every figure breathes — a 1:1 cell opens from a diagonal line, through
// a leaning ellipse, to a true circle at a quarter turn, then closes again.
//
// A lime pen rides each curve so the table reads as something being drawn, not
// a static chart, trailing a short bright comet behind the leading point. The
// heavy work is one canvas and one requestAnimationFrame loop, kept off the
// React render path and capped for device pixel ratio; the controls (play the
// phase drift, scrub it by hand, reset) are the only React state. Under
// prefers-reduced-motion the loop never starts: it paints the figures once at
// the quarter-turn phase, where every ratio shows its fullest shape, with no
// pen and no drift.

const N = 5 // grid is N x N: frequencies 1..N across and down
const TAU = Math.PI * 2
const CURVE_STEPS = 140 // points per traced figure
const PEN_PERIOD = 4.2 // seconds for the pen to complete one lap of a curve
const DRIFT_PERIOD = 26 // seconds for the phase delta to drift a full turn
const TRAIL = 0.42 * TAU // how much of the lap the bright comet covers

const LIME = '220, 248, 124'

function phaseLabel(deg: number): string {
  const d = Math.round(deg)
  if (d === 0 || d === 360) return 'straight lines'
  if (d === 90 || d === 270) return 'open figures'
  if (d === 180) return 'mirrored lines'
  return `${d} degrees`
}

export function LissajousTable({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const statusId = useId()

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef(0)

  // running = the phase delta drifts on its own. When the user scrubs or sets
  // the slider, drift pauses and delta is held where they left it.
  const [running, setRunning] = useState(true)
  // deltaDeg is the phase between the two waves, in degrees, for the readout and
  // the slider. The loop reads it through a ref so it never re-renders per frame.
  const [deltaDeg, setDeltaDeg] = useState(90)
  const deltaRef = useRef((deltaDeg * Math.PI) / 180)
  const runningRef = useRef(running)
  runningRef.current = running

  const setDelta = (deg: number) => {
    const d = Math.max(0, Math.min(360, deg))
    deltaRef.current = (d * Math.PI) / 180
    setDeltaDeg(d)
  }

  // The animation loop. Draws the whole table each frame on a single canvas,
  // advancing the pen always and the phase drift only while running.
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let size = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      const w = Math.max(240, Math.floor(wrap.clientWidth))
      size = w
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(w * dpr)
      canvas.style.height = `${w}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduce) draw(0)
    }

    // Draw one frame. `pen` is the pen's lap phase (theta), delta the wave phase.
    const draw = (pen: number) => {
      const s = size
      ctx.clearRect(0, 0, s, s)
      const delta = reduce ? Math.PI / 2 : deltaRef.current
      const cell = s / N
      const rad = cell * 0.34

      for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
          const fx = col + 1
          const fy = row + 1
          const cx = col * cell + cell / 2
          const cy = row * cell + cell / 2

          // The full figure, faint, so the shape is always legible.
          ctx.beginPath()
          for (let i = 0; i <= CURVE_STEPS; i++) {
            const th = (i / CURVE_STEPS) * TAU
            const px = cx + rad * Math.sin(fx * th + delta)
            const py = cy + rad * Math.sin(fy * th)
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.strokeStyle = `rgba(${LIME}, 0.16)`
          ctx.lineWidth = 1
          ctx.stroke()

          if (reduce) continue

          // The bright comet: the arc of the lap just behind the pen, drawn from
          // dim to bright so the leading point reads as the tip.
          const segs = 26
          for (let i = 0; i < segs; i++) {
            const t0 = pen - TRAIL * (1 - i / segs)
            const t1 = pen - TRAIL * (1 - (i + 1) / segs)
            const x0 = cx + rad * Math.sin(fx * t0 + delta)
            const y0 = cy + rad * Math.sin(fy * t0)
            const x1 = cx + rad * Math.sin(fx * t1 + delta)
            const y1 = cy + rad * Math.sin(fy * t1)
            ctx.beginPath()
            ctx.moveTo(x0, y0)
            ctx.lineTo(x1, y1)
            ctx.strokeStyle = `rgba(${LIME}, ${0.08 + 0.72 * (i / segs)})`
            ctx.lineWidth = 1.6
            ctx.lineCap = 'round'
            ctx.stroke()
          }

          // The pen itself: a glowing lime point at the head of the comet.
          const hx = cx + rad * Math.sin(fx * pen + delta)
          const hy = cy + rad * Math.sin(fy * pen)
          ctx.beginPath()
          ctx.arc(hx, hy, 3.4, 0, TAU)
          ctx.fillStyle = `rgba(${LIME}, 0.95)`
          ctx.shadowColor = `rgba(${LIME}, 0.9)`
          ctx.shadowBlur = 8
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }
    }

    resize()

    let ro: ResizeObserver | null = null
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(resize)
      ro.observe(wrap)
    }

    if (reduce) {
      draw(0)
      return () => {
        if (ro) ro.disconnect()
      }
    }

    let penTheta = 0
    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const dt = Math.min(0.05, (now - lastRef.current) / 1000)
      lastRef.current = now
      penTheta = (penTheta + (TAU / PEN_PERIOD) * dt) % TAU
      if (runningRef.current) {
        deltaRef.current = (deltaRef.current + (TAU / DRIFT_PERIOD) * dt) % TAU
      }
      draw(penTheta)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (ro) ro.disconnect()
      lastRef.current = 0
    }
  }, [reduce])

  // While the drift runs it owns delta, so mirror it into the readout a few
  // times a second — enough for the number to feel live, far short of a render
  // per frame.
  useEffect(() => {
    if (!running || reduce) return
    const id = window.setInterval(() => {
      setDeltaDeg(Math.round((deltaRef.current * 180) / Math.PI))
    }, 250)
    return () => window.clearInterval(id)
  }, [running, reduce])

  // Drag across the table to scrub the phase by hand; this pauses the drift.
  const scrubFrom = (clientX: number) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    setDelta(Math.round(frac * 360))
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (reduce) return
    setRunning(false)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    scrubFrom(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduce || e.buttons === 0) return
    scrubFrom(e.clientX)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (reduce) return
    let handled = true
    const step = e.shiftKey ? 15 : 5
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      setRunning(false)
      setDelta(deltaDeg - step)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      setRunning(false)
      setDelta(deltaDeg + step)
    } else if (e.key === 'Home') {
      setRunning(false)
      setDelta(0)
    } else if (e.key === 'End') {
      setRunning(false)
      setDelta(360)
    } else if (e.key === ' ' || e.key === 'Enter') {
      setRunning((r) => !r)
    } else handled = false
    if (handled) e.preventDefault()
  }

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        ref={wrapRef}
        role="slider"
        tabIndex={reduce ? -1 : 0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={deltaDeg}
        aria-valuetext={`Phase ${deltaDeg} degrees; ${phaseLabel(deltaDeg)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: reduce ? 'default' : 'ew-resize' }}
      >
        <span id={labelId} className="sr-only">
          A Lissajous table. Each cell traces the figure drawn by two sine waves at right angles, with the horizontal
          frequency fixed per column and the vertical frequency per row. The arrow keys set the phase between the two
          waves, which morphs every figure; Shift takes larger steps, Home and End jump to the ends, and Space starts or
          stops the automatic phase drift. You can also drag across the table to scrub the phase by hand.
        </span>
        <canvas ref={canvasRef} className="block w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]" aria-hidden />
      </div>

      <p id={statusId} aria-live="polite" className="sr-only">
        Phase {deltaDeg} degrees. The figures show {phaseLabel(deltaDeg)}.
      </p>

      <div className="mt-6 w-full">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
            {deltaDeg}&deg; phase
          </span>
          <span className="font-mono text-xs text-white/45">{running && !reduce ? 'drifting' : phaseLabel(deltaDeg)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={deltaDeg}
          disabled={!!reduce}
          onChange={(e) => {
            setRunning(false)
            setDelta(Number(e.target.value))
          }}
          aria-label="Phase between the two waves, in degrees"
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#DCF87C] disabled:opacity-40"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          <span>0&deg;</span>
          <span>Quarter turn</span>
          <span>360&deg;</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={!!reduce}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/[0.12] disabled:opacity-40"
        >
          {running ? 'Hold phase' : 'Drift'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false)
            setDelta(90)
          }}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Quarter turn
        </button>
      </div>
    </div>
  )
}
