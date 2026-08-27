import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { Knob } from './Knob'

// An Etch A Sketch — the aluminium-powder drawing toy, rebuilt honestly. The
// odd one out even among the Objects & toys: the Clock is a passive dial, the
// Turntable a wheel with momentum, the Harmonograph a seeded plotter, the
// Abacus an instrument you reckon on — but this one *you* draw on, and the
// constraint is the whole character of the thing. There is no lifting the pen.
// The left knob drives the stylus horizontally and the right knob vertically,
// so every picture is one unbroken line, and the fun is fighting the mechanism
// to make a diagonal or a curve out of two straight axes. The screen is a real
// canvas: the trace is a polyline kept in normalised [0,1] coordinates (so a
// resize repaints it crisply at the new size, never stretched), and only the
// new segment is inked each move — the powder is never cleared except when you
// shake it. The two knobs are the site's own Knob control, so the whole toy is
// keyboard-driven for free: focus a knob and the arrow keys walk the stylus,
// drawing as they go. Honest to a11y — the canvas is aria-hidden decoration
// with a live stroke count read to a screen reader, the knobs carry their own
// labels and values. Under reduced motion the shake-to-erase loses its wobble
// and the screen just clears; the drawing itself, being direct manipulation,
// works exactly the same.

interface EtchASketchProps {
  className?: string
}

// The stylus travels this range on each knob; mapped to the drawable area with
// a small inset so the line never kisses the bezel. Kept coarse enough that the
// arrow keys move a visible amount, fine enough that a drag reads as smooth.
const RANGE = 1000
const STEP = 4

export function EtchASketch({ className = '' }: EtchASketchProps) {
  const reduce = useReducedMotion()
  const liveId = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const shake = useAnimationControls()

  // Stylus position as a fraction of each knob's range. Start dead centre.
  const [hx, setHx] = useState(RANGE / 2)
  const [vy, setVy] = useState(RANGE / 2)

  // The trace, in normalised [0,1] screen coordinates, plus the drawing plumbing
  // kept in refs so nothing on the ink path forces a React render.
  const pointsRef = useRef<Array<[number, number]>>([[0.5, 0.5]])
  const sizeRef = useRef({ w: 0, h: 0 })
  const dprRef = useRef(1)
  const insetRef = useRef(0)
  const [strokes, setStrokes] = useState(0)

  const norm = useCallback(
    (x: number, y: number): [number, number] => [x / RANGE, y / RANGE],
    [],
  )

  // Map a normalised point into device pixels inside the inset drawable area.
  const project = useCallback((nx: number, ny: number): [number, number] => {
    const { w, h } = sizeRef.current
    const inset = insetRef.current
    return [inset + nx * (w - inset * 2), inset + ny * (h - inset * 2)]
  }, [])

  const strokeStyle = useCallback((ctx: CanvasRenderingContext2D) => {
    const { w, h } = sizeRef.current
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1.4, Math.min(w, h) / 190)
    // Graphite line, the way scraped aluminium powder darkens the screen.
    ctx.strokeStyle = 'rgba(38, 42, 34, 0.92)'
  }, [])

  // Repaint the whole polyline — used on mount and on every resize, where the
  // backing store is thrown away and has to be re-inked from the stored points.
  const repaint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = dprRef.current
    const { w, h } = sizeRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const pts = pointsRef.current
    if (pts.length < 2) return
    strokeStyle(ctx)
    ctx.beginPath()
    let [px, py] = project(pts[0][0], pts[0][1])
    ctx.moveTo(px, py)
    for (let i = 1; i < pts.length; i++) {
      ;[px, py] = project(pts[i][0], pts[i][1])
      ctx.lineTo(px, py)
    }
    ctx.stroke()
  }, [project, strokeStyle])

  // Size the backing store to the screen at device resolution, then re-ink.
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
      insetRef.current = Math.max(10, Math.min(w, h) * 0.04)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      repaint()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [repaint])

  // Ink the new segment whenever either knob moves. Only the last edge is drawn,
  // so the powder accumulates rather than being cleared and redrawn each move.
  useLayoutEffect(() => {
    const [nx, ny] = norm(hx, vy)
    const pts = pointsRef.current
    const last = pts[pts.length - 1]
    if (last && last[0] === nx && last[1] === ny) return
    pts.push([nx, ny])
    setStrokes(pts.length - 1)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !last) return
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    strokeStyle(ctx)
    ctx.beginPath()
    const [ax, ay] = project(last[0], last[1])
    const [bx, by] = project(nx, ny)
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }, [hx, vy, norm, project, strokeStyle])

  const erase = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    // Reset the trace to the stylus's current spot so the next line starts here.
    const here: [number, number] = norm(hx, vy)
    pointsRef.current = [here]
    setStrokes(0)
    if (ctx) {
      const { w, h } = sizeRef.current
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      ctx.clearRect(0, 0, w, h)
    }
    if (reduce) return
    shake.start({
      x: [0, -7, 6, -5, 4, -2, 0],
      y: [0, 4, -5, 3, -3, 1, 0],
      transition: { duration: 0.5, ease: 'easeInOut' },
    })
  }, [hx, vy, norm, reduce, shake])

  const nx = hx / RANGE
  const ny = vy / RANGE
  const pct = (v: number) => `${Math.round((v / RANGE) * 100)}`

  return (
    <div className={`flex flex-col items-center gap-8 ${className}`}>
      <motion.div
        animate={shake}
        className="relative w-full max-w-[520px] rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,#1c1c1a,#111110)] p-5 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-7"
      >
        {/* The screen: a brushed aluminium plate the stylus scrapes a line into. */}
        <div
          ref={wrapRef}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-black/40 shadow-[inset_0_2px_12px_rgba(0,0,0,0.45)]"
          style={{
            background:
              'repeating-linear-gradient(115deg, #b9bcae 0px, #c4c7b9 1px, #b3b6a8 2px, #bfc2b4 3px), radial-gradient(120% 120% at 30% 20%, #cfd2c4, #a7aa9c)',
          }}
        >
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0" />
          {/* A soft vignette to seat the plate under its bezel. */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_40px_rgba(90,94,80,0.55)]" />
          {/* The stylus nib, positioned in the inset drawable area over the canvas. */}
          <div
            aria-hidden
            className="pointer-events-none absolute z-10"
            style={{
              left: `calc(4% + ${nx} * 92%)`,
              top: `calc(4% + ${ny} * 92%)`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="block h-2.5 w-2.5 rounded-full bg-[#262a22] shadow-[0_0_0_3px_rgba(220,248,124,0.35)]" />
          </div>
        </div>

        {/* The two knobs, low on the frame like the real toy. */}
        <div className="mt-6 flex items-end justify-between px-1 sm:px-3">
          <Knob
            min={0}
            max={RANGE}
            step={STEP}
            value={hx}
            onChange={setHx}
            label="Horizontal"
            format={pct}
            size={88}
          />
          <div className="flex flex-col items-center gap-1 pb-3">
            <span className="font-display text-lg font-semibold tracking-tight text-white/80">
              Etch
            </span>
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-white/35">
              a sketch
            </span>
          </div>
          <Knob
            min={0}
            max={RANGE}
            step={STEP}
            value={vy}
            onChange={setVy}
            label="Vertical"
            format={pct}
            size={88}
          />
        </div>
      </motion.div>

      <button
        type="button"
        onClick={erase}
        className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
      >
        <span
          aria-hidden
          className="grid h-4 w-4 place-items-center text-white/60 transition-colors group-hover:text-[#DCF87C]"
        >
          {/* A little shake glyph. */}
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2 8h2M12 8h2M4.5 4.5l1.5 1.5M10 10l1.5 1.5M4.5 11.5L6 10M10 6l1.5-1.5" strokeLinecap="round" />
            <circle cx="8" cy="8" r="2.4" />
          </svg>
        </span>
        Shake to erase
      </button>

      <span id={liveId} aria-live="polite" className="sr-only">
        {strokes === 0
          ? 'Blank screen. Turn the horizontal and vertical knobs to draw one unbroken line.'
          : `Drawing in progress, ${strokes} segment${strokes === 1 ? '' : 's'} so far.`}
      </span>
    </div>
  )
}
