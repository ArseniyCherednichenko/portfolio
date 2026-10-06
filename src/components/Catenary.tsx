import { useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Catenary — the curve a hanging chain finds on its own.
//
// Pin a chain of fixed length between two points and let gravity settle it, and
// it never falls into a parabola or a circle: it finds the catenary, y = a·cosh
// (x/a). Galileo guessed a parabola and was wrong; Huygens, Leibniz, and Johann
// Bernoulli settled the true answer in 1691. It is the Brachistochrone's quiet
// sibling — another famous curve, but where that one is the answer to a race,
// this is the shape a chain works out for itself, with no clock running.
//
// The curve here is solved, not drawn. Given the two anchor points and a fixed
// chain length L, the shape is the unique catenary that (1) passes through both
// anchors and (2) has arc length exactly L. There is no closed form for that, so
// it is found numerically: an outer bisection on the catenary parameter `a`
// (which sets the curvature) wrapped around an inner bisection that slides the
// low point so the curve meets both anchors — the pair converges on the one
// catenary whose measured arc length equals L. Drag an anchor and the chain
// re-hangs; pull them apart past the chain's length and it goes taut, because a
// chain cannot stretch. Nothing about the sag is faked: it is the maths of a
// hanging rope, resolved on every move.

const VBW = 100
const VBH = 62
const PAD = 8
const N = 160 // samples along the chain
const LINKS = 15 // decorative beads, evenly spaced by arc length

type Pt = { x: number; y: number }

interface Shape {
  d: string
  pts: Pt[]
  cum: number[]
  len: number
  vertex: Pt
  sag: number
  taut: boolean
}

// Solve the catenary of arc length L through two anchors. Returns the sampled
// polyline (x,y in viewBox units, y pointing down) plus a few honest readouts.
function solveCatenary(a0: Pt, b0: Pt, L: number): Shape {
  // Work left-to-right; the chain is symmetric in which anchor is which.
  const leftFirst = a0.x <= b0.x
  const lx = leftFirst ? a0.x : b0.x
  const ly = leftFirst ? a0.y : b0.y
  const rx = leftFirst ? b0.x : a0.x
  const ry = leftFirst ? b0.y : a0.y

  let h = rx - lx
  if (h < 1e-3) h = 1e-3 // near-vertical: keep the maths finite
  const v = ry - ly // positive when the right anchor hangs lower (y is down)
  const D = Math.hypot(h, v) // straight-line distance between anchors
  const taut = L <= D
  const Leff = Math.max(L, D * 1.0004) // a chain cannot be shorter than the gap

  // Inner solve: for a given curvature `a`, place the low point (its x offset
  // x0 from the left anchor) so the curve hits both anchors. The screen curve is
  // y(X) = C − a·cosh((X − x0)/a); its height change over the span is monotonic
  // in x0, so bisection finds the one offset that matches the anchors' drop v.
  const findX0 = (a: number): number => {
    const f = (x0: number) => a * (Math.cosh(x0 / a) - Math.cosh((h - x0) / a)) - v
    let lo = -4 * h - 2
    let hi = 5 * h + 2
    for (let i = 0; i < 70; i++) {
      const m = (lo + hi) / 2
      if (f(m) < 0) lo = m
      else hi = m
    }
    return (lo + hi) / 2
  }

  // Arc length of that curve. Decreases monotonically as `a` grows (a → ∞ is the
  // straight chord), so the outer bisection drives it down to exactly Leff.
  const arcLen = (a: number, x0: number) =>
    a * (Math.sinh((h - x0) / a) + Math.sinh(x0 / a))

  let aLo = 1e-3 // tight curvature → a very long, deep chain
  let aHi = 1e5 // almost straight
  for (let i = 0; i < 80; i++) {
    const am = (aLo + aHi) / 2
    const len = arcLen(am, findX0(am))
    if (len > Leff) aLo = am
    else aHi = am
  }
  const a = (aLo + aHi) / 2
  const x0 = findX0(a)
  const C = ly + a * Math.cosh(x0 / a) // from y(0) = ly

  const pts: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const X = (i / N) * h
    pts.push({ x: lx + X, y: C - a * Math.cosh((X - x0) / a) })
  }
  const cum = [0]
  for (let i = 1; i <= N; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  // Lowest drawn point (largest y) — the real sag, measured from the lower anchor.
  let vertex = pts[0]
  for (const p of pts) if (p.y > vertex.y) vertex = p
  const sag = Math.max(0, vertex.y - Math.max(ly, ry))

  return { d, pts, cum, len: cum[N], vertex, sag, taut }
}

// Point at arc length s along the sampled chain (linear within the polyline).
function posAt(pts: Pt[], cum: number[], s: number): Pt {
  if (s <= 0) return pts[0]
  const total = cum[cum.length - 1]
  if (s >= total) return pts[pts.length - 1]
  let i = 1
  while (i < pts.length - 1 && cum[i] < s) i++
  const seg = cum[i] - cum[i - 1] || 1
  const f = (s - cum[i - 1]) / seg
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function Catenary({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef<0 | 1 | null>(null)

  const [anchors, setAnchors] = useState<[Pt, Pt]>([
    { x: 20, y: 15 },
    { x: 80, y: 15 },
  ])
  const [length, setLength] = useState(92)

  const shape = useMemo(() => solveCatenary(anchors[0], anchors[1], length), [anchors, length])

  const h = Math.abs(anchors[1].x - anchors[0].x)
  const drop = Math.abs(anchors[1].y - anchors[0].y)

  // Move an anchor to a viewBox point, clamped to the frame and to the chain's
  // reach: pull it past the length and it stops, the way a real chain goes taut.
  const place = (idx: 0 | 1, raw: Pt) => {
    const other = anchors[idx === 0 ? 1 : 0]
    let x = clamp(raw.x, PAD, VBW - PAD)
    let y = clamp(raw.y, PAD, VBH - PAD)
    const dx = x - other.x
    const dy = y - other.y
    const dist = Math.hypot(dx, dy) || 1
    const maxReach = length * 0.999
    if (dist > maxReach) {
      x = other.x + (dx / dist) * maxReach
      y = other.y + (dy / dist) * maxReach
    }
    setAnchors((prev) => {
      const next: [Pt, Pt] = [prev[0], prev[1]]
      next[idx] = { x, y }
      return next
    })
  }

  const toViewBox = (clientX: number, clientY: number): Pt => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * VBW,
      y: ((clientY - rect.top) / rect.height) * VBH,
    }
  }

  const onPointerDown = (idx: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = idx
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current == null) return
    place(dragging.current, toViewBox(e.clientX, e.clientY))
  }
  const onPointerUp = () => {
    dragging.current = null
  }

  // Keyboard: nudge the focused anchor. Keeps the toy reachable without a pointer.
  const onKey = (idx: 0 | 1) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 4 : 1.5
    const a = anchors[idx]
    if (e.key === 'ArrowLeft') place(idx, { x: a.x - step, y: a.y })
    else if (e.key === 'ArrowRight') place(idx, { x: a.x + step, y: a.y })
    else if (e.key === 'ArrowUp') place(idx, { x: a.x, y: a.y - step })
    else if (e.key === 'ArrowDown') place(idx, { x: a.x, y: a.y + step })
    else return
    e.preventDefault()
  }

  const reset = () => {
    setAnchors([
      { x: 20, y: 15 },
      { x: 80, y: 15 },
    ])
    setLength(92)
  }

  const links = Array.from({ length: LINKS }, (_, i) =>
    posAt(shape.pts, shape.cum, (shape.len * (i + 0.5)) / LINKS),
  )

  return (
    <div className={className}>
      <div className="mx-auto max-w-2xl">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="w-full touch-none select-none"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="cat-chain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DCF87C" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#DCF87C" stopOpacity="0.95" />
            </linearGradient>
            <radialGradient id="cat-peg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#DCF87C" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#DCF87C" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* The straight chord — the shortest span, for contrast with the sag. */}
          <line
            x1={anchors[0].x}
            y1={anchors[0].y}
            x2={anchors[1].x}
            y2={anchors[1].y}
            stroke="#ffffff"
            strokeOpacity="0.14"
            strokeWidth="0.4"
            strokeDasharray="1.5 1.5"
          />

          {/* The chain itself — the solved catenary. */}
          <path
            d={shape.d}
            fill="none"
            stroke="url(#cat-chain)"
            strokeOpacity={shape.taut ? 0.5 : 0.95}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Evenly spaced links, to read it as a chain of equal weights. */}
          {links.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="0.7" fill="#DCF87C" fillOpacity="0.8" />
          ))}

          {/* The low point. */}
          <circle cx={shape.vertex.x} cy={shape.vertex.y} r="1" fill="#5BD8C4" />

          {/* The two anchors — grab and drag, or focus and use the arrow keys. */}
          {([0, 1] as const).map((idx) => (
            <g
              key={idx}
              role="button"
              tabIndex={0}
              aria-label={`${idx === 0 ? 'Left' : 'Right'} anchor. Drag, or use the arrow keys to move it.`}
              onPointerDown={onPointerDown(idx)}
              onKeyDown={onKey(idx)}
              style={{ cursor: 'grab', outline: 'none' }}
              className="[&:focus-visible>circle:last-of-type]:stroke-white"
            >
              {!reduce && <circle cx={anchors[idx].x} cy={anchors[idx].y} r="3.4" fill="url(#cat-peg)" />}
              <circle
                cx={anchors[idx].x}
                cy={anchors[idx].y}
                r="1.9"
                fill="#0A0A0A"
                stroke="#DCF87C"
                strokeWidth="0.9"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Readouts — the honest geometry, live. */}
      <dl className="mx-auto mt-5 grid max-w-md grid-cols-4 gap-2 text-center">
        {[
          { k: 'Span', v: h.toFixed(0) },
          { k: 'Drop', v: drop.toFixed(0) },
          { k: 'Chain', v: length.toFixed(0) },
          { k: 'Sag', v: shape.sag.toFixed(0) },
        ].map((r) => (
          <div key={r.k} className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2.5">
            <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-white/35">{r.k}</dt>
            <dd className="mt-1 font-display text-lg font-semibold tabular-nums text-[#DCF87C]">{r.v}</dd>
          </div>
        ))}
      </dl>

      {/* Controls. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
        <label className="flex items-center gap-3 text-sm text-white/70">
          <span className="font-medium">Chain length</span>
          <input
            type="range"
            min={40}
            max={140}
            step={1}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            aria-label="Chain length"
            className="h-1 w-40 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#DCF87C]"
          />
        </label>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
        >
          Reset
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-white/35">
        Drag an anchor, or pull the chain longer. {shape.taut ? 'Taut — the chain is at full stretch.' : 'It re-hangs as a true catenary.'}
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {shape.taut
          ? 'The chain is pulled taut between the anchors.'
          : `A chain of length ${length.toFixed(0)} hangs between the anchors with a sag of ${shape.sag.toFixed(0)} units.`}
      </p>
    </div>
  )
}
