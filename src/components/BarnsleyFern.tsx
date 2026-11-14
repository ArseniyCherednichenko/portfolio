import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// The Barnsley fern — the chaos game's affine sibling, and the piece that shows
// the same "order falls out of pure chance" engine can draw a LIVING thing, not
// just an abstract lace. The chaos game beside it jumps a fixed fraction of the
// way toward a randomly chosen polygon corner; this plays the identical game but
// replaces the corner-jumps with four tiny affine maps — each a rotate, scale,
// shear and shift packed into six numbers — and picks among them with UNEQUAL
// odds. Start a point at the origin, over and over pick one of the four maps at
// random (weighted), apply it, and plot where you land. No map describes a leaf
// and nothing in the rule mentions a plant, yet the landings pile onto a fern:
// a stalk, a spray of ever-smaller fronds, and two side leaves, each a shrunken
// copy of the whole. That four six-number matrices can encode a recognisable
// organism is the astonishing part — it is the seed of fractal image compression
// (store the maps, not the pixels), and the reason this earns a place next to
// the chaos game rather than repeating it.
//
// It is coloured by WHICH map drew each point, so the engine is legible: the
// rare stem map (1%) in teal, the dominant frond map (85%) in lime, the two
// side-leaf maps (7% each) in mint and warm amber. The dominant frond map is a
// rotate-and-shrink; its rotation angle is the one dial — the Curl slider — and
// widening it makes every leaflet inherit a little more turn than the last, so
// the whole frond coils into a spiral while staying a bounded fern (every map
// contracts, so the attractor can never run off). The randomness is seeded (a
// fixed mulberry32, so the same curl grows the same fern every load and the loop
// never touches Math.random or the wall clock); the picture is a real additive
// density map. The fern grows over ~1.8s while a bright point skitters the walk
// on an overlay; a control change clears and regrows. Reduced motion plots the
// whole fern at once and holds it, with no skittering point. The canvases are
// decorative and aria-hidden; a live region names the state.

interface BarnsleyFernProps {
  className?: string
}

const SEED = 0x9e3779b9
const CURL_MIN = -15 // degrees
const CURL_MAX = 15
const CURL_DEFAULT = -2.7 // the classic Barnsley rotation of the frond map

// A deterministic PRNG, so a given curl grows the same fern every load and the
// draw loop never touches Math.random.
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One affine map of the IFS: x' = a·x + b·y + e, y' = c·x + d·y + f, chosen with
// probability p, plotted in colour `rgb` with additive alpha `alpha`.
interface Affine {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
  p: number
  rgb: string
  alpha: number
  key: string
}

// Build the four classic Barnsley maps for a given frond-rotation `curlDeg`.
// Only the dominant frond map (85%) depends on the dial; the stem and the two
// side leaves are the published constants. The frond's linear part is a pure
// rotate-and-scale r·R(t) with r = 0.85 — at t = -2.7° it reproduces the classic
// (a,b,c,d) = (0.85, 0.04, -0.04, 0.85).
function buildMaps(curlDeg: number): Affine[] {
  const t = (curlDeg * Math.PI) / 180
  const r = 0.85
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  return [
    // Stem — collapses the point onto the base of the stalk. Rare, so a brighter
    // alpha keeps the thin spine visible against the frond's wash.
    { a: 0, b: 0, c: 0, d: 0.16, e: 0, f: 0, p: 0.01, rgb: '31,118,110', alpha: 0.5, key: 'stem' },
    // Frond — the self-similar body of the fern, the rotate-and-shrink that most
    // landings take, so the lowest alpha of the four.
    { a: r * cos, b: -r * sin, c: r * sin, d: r * cos, e: 0, f: 1.6, p: 0.85, rgb: '220,248,124', alpha: 0.05, key: 'frond' },
    // Left leaf — a sheared, flipped copy spraying to one side.
    { a: 0.2, b: -0.26, c: 0.23, d: 0.22, e: 0, f: 1.6, p: 0.07, rgb: '120,230,180', alpha: 0.14, key: 'left' },
    // Right leaf — its mirror, to the other side.
    { a: -0.15, b: 0.28, c: 0.26, d: 0.24, e: 0, f: 0.44, p: 0.07, rgb: '245,196,120', alpha: 0.14, key: 'right' },
  ]
}

// Cumulative probability table for weighted selection (sums to 1.0).
function cumulative(maps: Affine[]): number[] {
  const out: number[] = []
  let acc = 0
  for (const m of maps) {
    acc += m.p
    out.push(acc)
  }
  out[out.length - 1] = 1 // guard against float drift
  return out
}

// A compact hand-built ARIA slider for the curl angle, matching the chaos game's
// own ratio control: a focusable track, arrow keys, and pointer drag.
function CurlSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pct = ((value - CURL_MIN) / (CURL_MAX - CURL_MIN)) * 100

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onChange(Math.round((CURL_MIN + frac * (CURL_MAX - CURL_MIN)) * 10) / 10)
    },
    [onChange],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 2 : 0.5
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(CURL_MIN, Math.round((value - step) * 10) / 10))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(CURL_MAX, Math.round((value + step) * 10) / 10))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(CURL_MIN)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(CURL_MAX)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Curl</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Frond rotation"
        aria-valuemin={CURL_MIN}
        aria-valuemax={CURL_MAX}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(1)} degrees of frond rotation`}
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
          {value > 0 ? '+' : ''}
          {value.toFixed(1)}&deg;
        </span>
      </div>
    </div>
  )
}

function curlName(curlDeg: number): string {
  if (Math.abs(curlDeg - CURL_DEFAULT) < 0.6) return 'the classic Barnsley fern'
  if (curlDeg > 6) return 'a fern coiling to the right'
  if (curlDeg < -6) return 'a fern coiling to the left'
  return 'a gently leaning fern'
}

export function BarnsleyFern({ className = '' }: BarnsleyFernProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const accRef = useRef<HTMLCanvasElement>(null) // the accumulating fern
  const fxRef = useRef<HTMLCanvasElement>(null) // the skittering walk point

  const [curl, setCurl] = useState(CURL_DEFAULT)
  const [cast, setCast] = useState(0)
  const name = curlName(curl)

  // Live geometry + walk state, all off the React render path.
  const sizeRef = useRef(0)
  const dprRef = useRef(1)
  const mapsRef = useRef<Affine[]>(buildMaps(CURL_DEFAULT))
  const cumRef = useRef<number[]>(cumulative(buildMaps(CURL_DEFAULT)))
  const xformRef = useRef({ scale: 1, ox: 0, oy: 0 }) // world → pixel
  const stateRef = useRef({ x: 0, y: 0, plotted: 0, rng: mulberry32(SEED) })
  const targetRef = useRef(0)

  // Sample the attractor once (deterministically) to find its world bounding box,
  // so the fern is framed crisply whatever the curl does to its reach.
  const fitBounds = useCallback(() => {
    const maps = mapsRef.current
    const cum = cumRef.current
    const rng = mulberry32(SEED ^ 0x55555555)
    let x = 0
    let y = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    const N = 20000
    for (let i = 0; i < N; i++) {
      const u = rng()
      let k = 0
      while (k < cum.length - 1 && u > cum[k]) k++
      const m = maps[k]
      const nx = m.a * x + m.b * y + m.e
      const ny = m.c * x + m.d * y + m.f
      x = nx
      y = ny
      if (i > 20) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    const s = sizeRef.current
    const pad = s * 0.08
    const w = Math.max(1e-6, maxX - minX)
    const h = Math.max(1e-6, maxY - minY)
    const scale = Math.min((s - 2 * pad) / w, (s - 2 * pad) / h)
    // Centre the drawn fern in the square; flip y so the plant grows upward.
    const drawnW = w * scale
    const drawnH = h * scale
    const ox = (s - drawnW) / 2 - minX * scale
    const oy = (s - drawnH) / 2 + maxY * scale // + because y is flipped below
    xformRef.current = { scale, ox, oy }
  }, [])

  // Reset the walk from the seed and clear the accumulation canvas.
  const reset = useCallback(() => {
    const acc = accRef.current
    if (acc) {
      const ctx = acc.getContext('2d')
      if (ctx) {
        ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
        ctx.clearRect(0, 0, sizeRef.current, sizeRef.current)
      }
    }
    stateRef.current = { x: 0, y: 0, plotted: 0, rng: mulberry32(SEED) }
  }, [])

  // Advance the walk by `n` steps, plotting each landing in its map's colour with
  // additive light. Returns the last landing point in pixels.
  const advance = useCallback((n: number): [number, number] => {
    const acc = accRef.current
    if (!acc) return [0, 0]
    const ctx = acc.getContext('2d')
    if (!ctx) return [0, 0]
    const st = stateRef.current
    const maps = mapsRef.current
    const cum = cumRef.current
    const { scale, ox, oy } = xformRef.current
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    ctx.globalCompositeOperation = 'lighter'
    let hx = 0
    let hy = 0
    for (let i = 0; i < n; i++) {
      const u = st.rng()
      let k = 0
      while (k < cum.length - 1 && u > cum[k]) k++
      const m = maps[k]
      const nx = m.a * st.x + m.b * st.y + m.e
      const ny = m.c * st.x + m.d * st.y + m.f
      st.x = nx
      st.y = ny
      const px = ox + st.x * scale
      const py = oy - st.y * scale // flip y to grow upward
      if (st.plotted > 10) {
        ctx.fillStyle = `rgba(${m.rgb},${m.alpha})`
        ctx.fillRect(px, py, 1, 1)
      }
      st.plotted++
      hx = px
      hy = py
    }
    ctx.globalCompositeOperation = 'source-over'
    return [hx, hy]
  }, [])

  // Draw the skittering walk point on the overlay, a bright lime bloom.
  const paintFx = useCallback((showPoint: boolean, hx: number, hy: number) => {
    const fx = fxRef.current
    if (!fx) return
    const ctx = fx.getContext('2d')
    if (!ctx) return
    const s = sizeRef.current
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    ctx.clearRect(0, 0, s, s)
    if (!showPoint) return
    const pr = Math.max(2.5, s / 150)
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, pr * 3.5)
    g.addColorStop(0, 'rgba(220,248,124,0.95)')
    g.addColorStop(1, 'rgba(220,248,124,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(hx, hy, pr * 3.5, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  // Keep the maps + cumulative table in sync with the curl dial.
  useEffect(() => {
    const maps = buildMaps(curl)
    mapsRef.current = maps
    cumRef.current = cumulative(maps)
  }, [curl])

  // Size both canvases to the square container at device resolution, and regrow
  // whatever has been plotted so a resize stays continuous.
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
      targetRef.current = Math.max(40000, Math.min(150000, Math.round(area * 1.0)))
      fitBounds()
      reset()
      advance(Math.max(done, 0))
      paintFx(false, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [fitBounds, reset, advance, paintFx])

  // The growth loop: on any curl change or recast, refit, clear and regrow the
  // fern over ~1.8s, skittering the point. Reduced motion lays it down at once.
  useEffect(() => {
    if (!sizeRef.current) return
    fitBounds()
    reset()
    const target = targetRef.current

    if (reduce) {
      advance(target)
      paintFx(false, 0, 0)
      return
    }

    let raf = 0
    const batch = Math.max(600, Math.ceil(target / 110))
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
  }, [curl, cast, reduce, fitBounds, reset, advance, paintFx])

  const legend: { label: string; rgb: string }[] = [
    { label: 'Stem', rgb: '31,118,110' },
    { label: 'Frond', rgb: '220,248,124' },
    { label: 'Left leaf', rgb: '120,230,180' },
    { label: 'Right leaf', rgb: '245,196,120' },
  ]

  return (
    <div className={`flex flex-col items-center gap-7 ${className}`}>
      <div
        ref={wrapRef}
        className="relative aspect-square w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_120%_at_30%_20%,#0d110d,#050505)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.6)]"
      >
        <canvas ref={accRef} aria-hidden className="absolute inset-0 h-full w-full" />
        <canvas ref={fxRef} aria-hidden className="absolute inset-0 h-full w-full" />
      </div>

      {/* Legend — names the four maps by the colour they draw. */}
      <ul className="flex w-full max-w-[440px] flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-hidden>
        {legend.map((l) => (
          <li key={l.label} className="flex items-center gap-2 text-xs text-white/50">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `rgb(${l.rgb})` }} />
            {l.label}
          </li>
        ))}
      </ul>

      {/* Controls — real, labelled, keyboard-drivable. */}
      <div className="w-full max-w-[440px] space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <CurlSlider value={curl} onChange={setCurl} />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="max-w-[14rem] text-xs leading-snug text-white/40">
            Growing <span className="text-white/70">{name}</span>.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurl(CURL_DEFAULT)}
              className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
            >
              Reset
            </button>
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
              Regrow
            </button>
          </div>
        </div>
      </div>
      <span id={id} aria-live="polite" className="sr-only">
        {reduce
          ? `The Barnsley fern, showing ${name} plotted in full and held still. Four affine maps, chosen at random with unequal odds, drawn in the stem, frond and two leaf colours. Change the curl to grow a different fern.`
          : `The Barnsley fern: play the chaos game with four affine maps instead of polygon corners, picking one at random each step with unequal odds, and watch ${name} precipitate out of the random walk. Drag the curl to rotate the frond map, or regrow.`}
      </span>
    </div>
  )
}
