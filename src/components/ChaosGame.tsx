import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// The chaos game — a fractal precipitated out of pure chance, and the emergence
// toy the family was missing. Its whole engine is one rule you can hold in your
// head: mark the corners of a regular polygon, drop a point anywhere, then over
// and over pick a corner at random and jump a fixed fraction of the way toward
// it, plotting where you land. Nothing about that rule mentions a shape — every
// choice is a fair coin — and yet the landing points never fill the polygon
// evenly. With three corners and a half-way jump they refuse a dense middle and
// pile only onto a self-similar lace of ever-smaller triangles: the Sierpinski
// gasket, drawn by a process that has no idea it is drawing it. That is the
// point of the toy — order is not put in, it falls out, the same way it does in
// the diffusion crystal and the slime mesh elsewhere in this family.
//
// It is an instrument, not a fixed figure: the number of corners (3 to 6) and
// the jump ratio are yours to set, and each pair grows a different attractor —
// a square with a half jump is just noise, but forbid landing on the corner you
// just used and the same square grows a real fractal, so a "no repeats" rule is
// a control too. The maths is honest and the randomness is seeded (a fixed
// mulberry32, so the same seed grows the same dust every load and it never
// touches Math.random or the wall clock); the picture is a real density map,
// each landing added with "lighter" compositing so where the walk lingers sums
// from lime toward white and the rare cells stay dark. The dust accumulates on
// its own persistent canvas over ~1.5s while a bright point skitters the walk on
// an overlay above it; a control change clears both and regrows. Under reduced
// motion the whole figure is plotted at once and held, with no skittering point.
// The canvases are decorative and aria-hidden; a live region names the figure.

interface ChaosGameProps {
  className?: string
}

const V_MIN = 3
const V_MAX = 6
const R_MIN = 0.1
const R_MAX = 0.9
const SEED = 0x9e3779b9

// A deterministic PRNG, so the same controls grow the same dust every load and
// the draw loop never touches Math.random.
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The classic figures this engine is known for, named honestly where the maths
// gives a name and described plainly otherwise.
function figureName(vertices: number, ratio: number, noRepeat: boolean): string {
  const half = Math.abs(ratio - 0.5) < 0.001
  if (vertices === 3 && half && !noRepeat) return 'the Sierpinski triangle'
  if (vertices === 3 && half) return 'a Sierpinski triangle'
  if (vertices === 4 && half && noRepeat) return 'a Sierpinski-style square lace'
  if (vertices === 4 && half && !noRepeat) return 'an even square wash (no fractal)'
  if (vertices === 5 && Math.abs(ratio - 0.618) < 0.02) return 'the pentagonal (golden-ratio) fractal'
  return `a ${vertices}-corner attractor`
}

// A compact −/＋ stepper for the corner count. Real buttons; the held value is
// echoed to assistive tech through the control's own label.
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
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/12 text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white disabled:opacity-30 disabled:hover:border-white/12"
        >
          <span aria-hidden>&minus;</span>
        </button>
        <span aria-hidden className="w-9 text-center font-display text-lg font-bold tabular-nums text-white">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/12 text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white disabled:opacity-30 disabled:hover:border-white/12"
        >
          <span aria-hidden>+</span>
        </button>
      </div>
    </div>
  )
}

// A small hand-built ARIA slider for the jump ratio (0.10 → 0.90): a focusable
// track, arrow keys stepping the value, and pointer drag. Self-contained so the
// toy owns its whole surface.
function RatioSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pct = ((value - R_MIN) / (R_MAX - R_MIN)) * 100

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onChange(Math.round((R_MIN + frac * (R_MAX - R_MIN)) * 100) / 100)
    },
    [onChange],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(R_MIN, Math.round((value - step) * 100) / 100))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(R_MAX, Math.round((value + step) * 100) / 100))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(R_MIN)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(R_MAX)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Jump</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Jump ratio"
        aria-valuemin={R_MIN}
        aria-valuemax={R_MAX}
        aria-valuenow={value}
        aria-valuetext={`${Math.round(value * 100)} percent of the way`}
        onPointerDown={(e) => {
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          setFromClientX(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0) return
          setFromClientX(e.clientX)
        }}
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
        <span aria-hidden className="absolute -top-6 right-0 font-display text-sm font-bold tabular-nums text-white/70">
          {value.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

export function ChaosGame({ className = '' }: ChaosGameProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const accRef = useRef<HTMLCanvasElement>(null) // the accumulating fractal dust
  const fxRef = useRef<HTMLCanvasElement>(null) // polygon guides + skittering point

  const [vertices, setVertices] = useState(3)
  const [ratio, setRatio] = useState(0.5)
  const [noRepeat, setNoRepeat] = useState(false)

  // A monotonically increasing token so a "Recast" reseeds even when the
  // controls are unchanged.
  const [cast, setCast] = useState(0)

  const name = figureName(vertices, ratio, noRepeat)

  // Live geometry + walk state, all off the React render path.
  const sizeRef = useRef(0)
  const dprRef = useRef(1)
  const stateRef = useRef({ px: 0, py: 0, lastJ: -1, plotted: 0, rng: mulberry32(SEED) })
  const targetRef = useRef(0)

  // Geometry helpers computed fresh each paint so a resize stays crisp.
  const geom = useCallback(() => {
    const s = sizeRef.current
    const pad = s * 0.1
    const half = s / 2 - pad
    const cx = s / 2
    const cy = s / 2
    const verts: [number, number][] = []
    for (let i = 0; i < vertices; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / vertices
      verts.push([cx + Math.cos(a) * half, cy + Math.sin(a) * half])
    }
    return { cx, cy, verts }
  }, [vertices])

  // Draw the faint polygon, its corners, and (mid-run) the skittering point.
  const paintFx = useCallback(
    (showPoint: boolean, hitX: number, hitY: number) => {
      const fx = fxRef.current
      if (!fx) return
      const ctx = fx.getContext('2d')
      if (!ctx) return
      const s = sizeRef.current
      const dpr = dprRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, s, s)
      const { verts } = geom()

      // The polygon edges, very faint — a frame, not a fill.
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      verts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.stroke()

      // The corners you jump toward.
      verts.forEach(([x, y]) => {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.beginPath()
        ctx.arc(x, y, Math.max(2, s / 160), 0, Math.PI * 2)
        ctx.fill()
      })

      // The current landing point, a bright bloom, only while the walk runs.
      if (showPoint) {
        const pr = Math.max(2.5, s / 150)
        const g = ctx.createRadialGradient(hitX, hitY, 0, hitX, hitY, pr * 3.5)
        g.addColorStop(0, 'rgba(220,248,124,0.95)')
        g.addColorStop(1, 'rgba(220,248,124,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(hitX, hitY, pr * 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [geom],
  )

  // Advance the walk by `n` steps, plotting each landing onto the accumulation
  // canvas with additive light. Returns the last landing point in pixels.
  const advance = useCallback(
    (n: number): [number, number] => {
      const acc = accRef.current
      if (!acc) return [0, 0]
      const ctx = acc.getContext('2d')
      if (!ctx) return [0, 0]
      const st = stateRef.current
      const { verts } = geom()
      const nv = verts.length
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = `rgba(220,248,124,${reduce ? 0.06 : 0.05})`
      let hx = st.px
      let hy = st.py
      for (let i = 0; i < n; i++) {
        let j = Math.floor(st.rng() * nv)
        if (j >= nv) j = nv - 1
        // The "no repeats" restriction: never jump to the corner just used.
        if (noRepeat && j === st.lastJ) j = (j + 1 + Math.floor(st.rng() * (nv - 1))) % nv
        st.lastJ = j
        const [vx, vy] = verts[j]
        st.px += (vx - st.px) * ratio
        st.py += (vy - st.py) * ratio
        // Drop the first few transient landings before the orbit is on the set.
        if (st.plotted > 8) ctx.fillRect(st.px, st.py, 1, 1)
        st.plotted++
        hx = st.px
        hy = st.py
      }
      ctx.globalCompositeOperation = 'source-over'
      return [hx, hy]
    },
    [geom, ratio, noRepeat, reduce],
  )

  // Reset the walk from the seed and clear the accumulation canvas. The starting
  // point is the polygon's centre.
  const reset = useCallback(() => {
    const acc = accRef.current
    if (acc) {
      const ctx = acc.getContext('2d')
      if (ctx) {
        ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
        ctx.clearRect(0, 0, sizeRef.current, sizeRef.current)
      }
    }
    const { cx, cy } = geom()
    stateRef.current = { px: cx, py: cy, lastJ: -1, plotted: 0, rng: mulberry32(SEED) }
  }, [geom])

  // Size both canvases to the square container at device resolution, and redraw
  // whatever has been plotted so far so a resize stays continuous.
  useEffect(() => {
    const wrap = wrapRef.current
    const acc = accRef.current
    const fx = fxRef.current
    if (!wrap || !acc || !fx) return
    const resize = () => {
      const s = Math.round(wrap.clientWidth)
      if (!s) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const done = stateRef.current.plotted
      sizeRef.current = s
      dprRef.current = dpr
      for (const c of [acc, fx]) {
        c.width = s * dpr
        c.height = s * dpr
        c.style.height = `${s}px`
      }
      const area = s * s
      targetRef.current = Math.max(30000, Math.min(130000, Math.round(area * 0.9)))
      // Re-run the deterministic walk up to the same count at the new scale.
      reset()
      advance(Math.max(done, 0))
      paintFx(false, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
    // Re-size handler only depends on the stable callbacks.
  }, [reset, advance, paintFx])

  // The growth loop: on any control change (or a recast), clear and regrow the
  // dust over ~1.5s, skittering the point on the overlay. Reduced motion lays
  // the whole figure down at once and holds a static frame.
  useEffect(() => {
    if (!sizeRef.current) return
    reset()
    const target = targetRef.current

    if (reduce) {
      advance(target)
      paintFx(false, 0, 0)
      return
    }

    let raf = 0
    const batch = Math.max(500, Math.ceil(target / 90))
    const tick = () => {
      const st = stateRef.current
      const remaining = target - st.plotted
      const [hx, hy] = advance(Math.min(batch, Math.max(0, remaining)))
      const running = st.plotted < target
      paintFx(running, hx, hy)
      if (running) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [vertices, ratio, noRepeat, cast, reduce, reset, advance, paintFx])

  return (
    <div className={`flex flex-col items-center gap-7 ${className}`}>
      <div
        ref={wrapRef}
        className="relative aspect-square w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_120%_at_30%_20%,#111,#050505)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.6)]"
      >
        <canvas ref={accRef} aria-hidden className="absolute inset-0 h-full w-full" />
        <canvas ref={fxRef} aria-hidden className="absolute inset-0 h-full w-full" />
      </div>

      {/* Controls — real, labelled, keyboard-drivable. */}
      <div className="w-full max-w-[440px] space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <Stepper label="Corners" value={vertices} min={V_MIN} max={V_MAX} onChange={setVertices} />
        <RatioSlider value={ratio} onChange={setRatio} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">No repeats</span>
          <button
            type="button"
            role="switch"
            aria-checked={noRepeat}
            aria-label="Forbid jumping to the corner just used"
            onClick={() => setNoRepeat((v) => !v)}
            className={`relative h-7 w-12 rounded-full border transition-colors ${
              noRepeat ? 'border-[#DCF87C]/60 bg-[#DCF87C]/20' : 'border-white/15 bg-white/[0.04]'
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
                noRepeat ? 'left-[calc(100%-1.375rem)] bg-[#DCF87C]' : 'left-0.5 bg-white/50'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="max-w-[14rem] text-xs leading-snug text-white/40">
            Now drawing <span className="text-white/70">{name}</span>.
          </span>
          <button
            type="button"
            onClick={() => setCast((c) => c + 1)}
            aria-describedby={id}
            className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
          >
            <span
              aria-hidden
              className="grid h-4 w-4 place-items-center text-white/60 transition-colors group-hover:text-[#DCF87C]"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M13 8a5 5 0 1 1-1.46-3.54" />
                <path d="M13 2v3h-3" />
              </svg>
            </span>
            Recast
          </button>
        </div>
      </div>
      <span id={id} aria-live="polite" className="sr-only">
        {reduce
          ? `The chaos game, showing ${name} plotted in full and held still. Change the corners, the jump ratio, or the no-repeats rule to grow a different figure.`
          : `The chaos game: jump a fraction of the way toward a randomly chosen polygon corner, over and over, and watch ${name} precipitate out of the random walk. Set the corners, the jump ratio, and whether a corner may repeat, or recast to regrow.`}
      </span>
    </div>
  )
}
