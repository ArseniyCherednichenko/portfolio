import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Penrose — an aperiodic rhombus tiling (the P3 tiling), and the one shape in the
// generative family that fills the plane forever without ever repeating. A normal
// tiling has a unit cell you could slide onto itself; this one has none — shift it
// any distance in any direction and it never lines back up, yet it still covers the
// plane completely, with just two tiles: a thick rhomb (angles 72 and 108) and a
// thin one (36 and 144). It is the picture behind quasicrystals, the ordered-but-
// non-periodic matter that won the 2011 Nobel in chemistry.
//
// Nothing is placed by hand. The tiling is grown by *deflation*: start with a wheel
// of ten Robinson triangles (each half of a rhomb) meeting at the centre, then
// subdivide every triangle into smaller ones by the golden ratio, over and over.
// A subdivision that respects the matching rules can only ever grow the one legal
// tiling, so the aperiodic order falls straight out of a rule you can hold in your
// head — the same theme as the rest of this family, where structure is not put in
// but emerges. The subdivision is the standard one (de Bruijn / Robinson):
//   a thin half  (A,B,C) -> a thin half and a thick half
//   a thick half (A,B,C) -> two thick halves and one thin half
// with the new vertices placed a 1/phi fraction along an edge. Paired mirror halves
// share their base edge, which is never stroked, so each pair reads as one rhomb.
//
// The golden ratio is not just in the construction, it is the payoff you can read
// off the finished tiling: the number of thick rhombs divided by the number of thin
// ones converges to phi ~ 1.618 as the tiling grows — hover to watch the live tally
// climb toward it. Colour is one lime in two lightness steps, so hue only ever says
// which of the two tiles a piece is, never anything else.
//
// Drawn on two stacked canvases like the Hilbert curve and the chaos game: a base
// canvas that accumulates the tiles as they bloom outward from the centre (never
// cleared while it draws), and an overlay cleared each frame for the growth ring and
// the hovered rhomb. No Math.random and no Date.now on the hot path — every vertex
// is a deterministic golden-ratio construction, so a given depth always grows the
// exact same tiling. The canvases are aria-hidden and the wrapper carries a live
// label. Under prefers-reduced-motion the animation never runs: the whole tiling is
// painted at once and held, and the hover mapping still works because it is
// interaction, not decoration.

const PHI = (1 + Math.sqrt(5)) / 2
const INV_PHI = 1 / PHI

const MIN_DEPTH = 3
const MAX_DEPTH = 7
const DEFAULT_DEPTH = 5

// One lime, two lightness steps — the only thing colour encodes is which of the two
// rhombs a tile is. The thick rhomb (the majority, the one whose share drives the
// ratio toward phi) reads bright; the thin rhomb recedes into a deep forest lime.
const THICK_FILL = 'rgb(150,196,60)'
const THIN_FILL = 'rgb(66,92,44)'
const GROUT = 'rgba(6,9,6,0.92)'

type Pt = [number, number]
// A Robinson triangle: c=0 is a thin-rhomb half, c=1 a thick-rhomb half.
interface Tri {
  c: 0 | 1
  a: Pt
  b: Pt
  d: Pt // the third vertex; base edge is b<->d, apex is a
}

const lerp = (p: Pt, q: Pt, f: number): Pt => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]

// The deflation step. Each half splits by the golden ratio into the halves the
// matching rules allow — a thin into {thin, thick}, a thick into {thick, thick, thin}.
function subdivide(tris: Tri[]): Tri[] {
  const out: Tri[] = []
  for (const t of tris) {
    const { a, b, d } = t
    if (t.c === 0) {
      const p = lerp(a, b, INV_PHI)
      out.push({ c: 0, a: d, b: p, d: b })
      out.push({ c: 1, a: p, b: d, d: a })
    } else {
      const q = lerp(b, a, INV_PHI)
      const r = lerp(b, d, INV_PHI)
      out.push({ c: 1, a: r, b: d, d: a })
      out.push({ c: 1, a: q, b: r, d: b })
      out.push({ c: 0, a: r, b: q, d: a })
    }
  }
  return out
}

// The seed: ten thin-rhomb halves meeting at the origin, every other one mirrored,
// so their bases ring the unit circle into the ten-fold "sun" the tiling grows from.
function buildTiling(depth: number): Tri[] {
  let tris: Tri[] = []
  for (let i = 0; i < 10; i++) {
    let b: Pt = [Math.cos(((2 * i - 1) * Math.PI) / 10), Math.sin(((2 * i - 1) * Math.PI) / 10)]
    let d: Pt = [Math.cos(((2 * i + 1) * Math.PI) / 10), Math.sin(((2 * i + 1) * Math.PI) / 10)]
    if (i % 2 === 0) {
      const tmp = b
      b = d
      d = tmp
    }
    tris.push({ c: 0, a: [0, 0], b, d })
  }
  for (let g = 0; g < depth; g++) tris = subdivide(tris)
  return tris
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// Point-in-triangle by the sign of the three edge cross products.
function inTri(px: number, py: number, a: Pt, b: Pt, d: Pt): boolean {
  const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1])
  const d2 = (px - d[0]) * (b[1] - d[1]) - (b[0] - d[0]) * (py - d[1])
  const d3 = (px - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (py - a[1])
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

export function Penrose({ className = '' }: { className?: string }) {
  const [depth, setDepth] = useState(DEFAULT_DEPTH)
  const [replay, setReplay] = useState(0)
  const [hover, setHover] = useState<{ thick: boolean } | null>(null)
  const reduce = useReducedMotion()

  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Live tallies for the ratio readout, set once the tiling is built.
  const [counts, setCounts] = useState<{ thick: number; thin: number }>({ thick: 0, thin: 0 })

  useEffect(() => {
    const base = baseRef.current
    const overlay = overlayRef.current
    const wrap = wrapRef.current
    if (!base || !overlay || !wrap) return
    const bctx = base.getContext('2d')
    const octx = overlay.getContext('2d')
    if (!bctx || !octx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)

    // Build the tiling in unit space once for this depth.
    const unit = buildTiling(depth)
    const N = unit.length
    let nThick = 0
    let nThin = 0
    for (const t of unit) t.c === 1 ? nThick++ : nThin++
    setCounts({ thick: nThick, thin: nThin })

    // Reveal order: sort by centroid distance from the centre so the tiling blooms
    // outward. Precompute each centroid radius (unit space) too, for the growth ring.
    const cenR = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const t = unit[i]
      const cx = (t.a[0] + t.b[0] + t.d[0]) / 3
      const cy = (t.a[1] + t.b[1] + t.d[1]) / 3
      cenR[i] = Math.hypot(cx, cy)
    }
    const order = Array.from({ length: N }, (_, i) => i).sort((p, q) => cenR[p] - cenR[q])
    const maxR = N ? cenR[order[N - 1]] : 1

    // Pair mirror halves by their shared base edge, so a hover can light the whole
    // rhomb. Key an unordered base-endpoint pair, rounded to merge coincident points.
    const pair = new Int32Array(N).fill(-1)
    const seen = new Map<string, number>()
    const key = (p: Pt, q: Pt) => {
      const r = (v: number) => Math.round(v * 1e5)
      const k1 = `${r(p[0])},${r(p[1])}`
      const k2 = `${r(q[0])},${r(q[1])}`
      return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
    }
    for (let i = 0; i < N; i++) {
      const k = key(unit[i].b, unit[i].d)
      const j = seen.get(k)
      if (j !== undefined) {
        pair[i] = j
        pair[j] = i
      } else {
        seen.set(k, i)
      }
    }

    // Per-layout px geometry, recomputed on resize.
    let w = 0
    let h = 0
    let scale = 1
    let ox = 0
    let oy = 0
    let lineW = 1
    const px = new Float32Array(N * 6) // ax,ay,bx,by,dx,dy per triangle
    let raf = 0
    let startTs = 0
    let drawn = 0 // how many tiles (in reveal order) the base has painted
    let animating = false
    let hoverTri = -1

    const duration = Math.min(2600, Math.max(1100, 900 + N * 0.5))

    function toPx() {
      const sizeMin = Math.min(w, h)
      const pad = Math.max(14, sizeMin * 0.06)
      scale = (sizeMin - pad * 2) / 2
      ox = w / 2
      oy = h / 2
      lineW = Math.max(0.5, scale * 0.006)
      for (let i = 0; i < N; i++) {
        const t = unit[i]
        px[i * 6] = ox + t.a[0] * scale
        px[i * 6 + 1] = oy + t.a[1] * scale
        px[i * 6 + 2] = ox + t.b[0] * scale
        px[i * 6 + 3] = oy + t.b[1] * scale
        px[i * 6 + 4] = ox + t.d[0] * scale
        px[i * 6 + 5] = oy + t.d[1] * scale
      }
    }

    // Fill one triangle in its rhomb colour and stroke its two legs (b->a->d),
    // never the base b<->d, so paired halves fuse into a single rhomb outline.
    function paintTri(ctx: CanvasRenderingContext2D, i: number) {
      const o = i * 6
      ctx.beginPath()
      ctx.moveTo(px[o], px[o + 1])
      ctx.lineTo(px[o + 2], px[o + 3])
      ctx.lineTo(px[o + 4], px[o + 5])
      ctx.closePath()
      ctx.fillStyle = unit[i].c === 1 ? THICK_FILL : THIN_FILL
      ctx.fill()
      ctx.strokeStyle = GROUT
      ctx.lineWidth = lineW
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(px[o + 2], px[o + 3])
      ctx.lineTo(px[o], px[o + 1])
      ctx.lineTo(px[o + 4], px[o + 5])
      ctx.stroke()
    }

    function drawBase(from: number, to: number) {
      for (let k = from; k < to; k++) paintTri(bctx!, order[k])
    }

    function drawOverlay() {
      octx!.clearRect(0, 0, w, h)
      // The growth ring: a faint lime circle riding the reveal front.
      if (animating && drawn > 0 && drawn < N) {
        const frontR = (cenR[order[drawn - 1]] / (maxR || 1)) * scale
        octx!.save()
        octx!.strokeStyle = 'rgba(220,248,124,0.5)'
        octx!.lineWidth = Math.max(1, lineW * 2.2)
        octx!.shadowColor = 'rgba(220,248,124,0.8)'
        octx!.shadowBlur = 14
        octx!.beginPath()
        octx!.arc(ox, oy, frontR, 0, Math.PI * 2)
        octx!.stroke()
        octx!.restore()
      }
      // The hovered rhomb: fill the tile (and its mirror, if any) and outline it.
      if (hoverTri >= 0) {
        const tiles = pair[hoverTri] >= 0 ? [hoverTri, pair[hoverTri]] : [hoverTri]
        octx!.save()
        octx!.fillStyle = 'rgba(220,248,124,0.26)'
        for (const i of tiles) {
          const o = i * 6
          octx!.beginPath()
          octx!.moveTo(px[o], px[o + 1])
          octx!.lineTo(px[o + 2], px[o + 3])
          octx!.lineTo(px[o + 4], px[o + 5])
          octx!.closePath()
          octx!.fill()
        }
        octx!.strokeStyle = 'rgba(245,255,220,0.95)'
        octx!.lineWidth = Math.max(1.2, lineW * 2)
        octx!.lineJoin = 'round'
        for (const i of tiles) {
          const o = i * 6
          octx!.beginPath()
          octx!.moveTo(px[o + 2], px[o + 3])
          octx!.lineTo(px[o], px[o + 1])
          octx!.lineTo(px[o + 4], px[o + 5])
          octx!.stroke()
        }
        octx!.restore()
      }
    }

    function tick(ts: number) {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / duration)
      const target = Math.max(1, Math.round(easeInOut(p) * N))
      if (target > drawn) {
        drawBase(drawn, target)
        drawn = target
      }
      drawOverlay()
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        animating = false
        drawOverlay()
      }
    }

    function restart() {
      cancelAnimationFrame(raf)
      bctx!.clearRect(0, 0, w, h)
      octx!.clearRect(0, 0, w, h)
      drawn = 0
      startTs = 0
      if (reduce) {
        animating = false
        drawBase(0, N)
        drawn = N
        drawOverlay()
      } else {
        animating = true
        raf = requestAnimationFrame(tick)
      }
    }

    function layout() {
      const rect = wrap!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      for (const c of [base!, overlay!]) {
        c.width = Math.floor(w * dpr)
        c.height = Math.floor(h * dpr)
        c.style.width = `${w}px`
        c.style.height = `${h}px`
      }
      bctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      octx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      toPx()
      restart()
    }

    function pointerToTri(clientX: number, clientY: number): number {
      const rect = base!.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      // Cheap reject: outside the disc can't be on a tile.
      if (Math.hypot(mx - ox, my - oy) > scale + 4) return -1
      for (let i = 0; i < N; i++) {
        const o = i * 6
        if (
          inTri(
            mx,
            my,
            [px[o], px[o + 1]],
            [px[o + 2], px[o + 3]],
            [px[o + 4], px[o + 5]],
          )
        )
          return i
      }
      return -1
    }

    function onMove(e: PointerEvent) {
      const idx = pointerToTri(e.clientX, e.clientY)
      if (idx === hoverTri) return
      hoverTri = idx
      setHover(idx >= 0 ? { thick: unit[idx].c === 1 } : null)
      if (!animating) drawOverlay()
    }

    function onLeave() {
      if (hoverTri === -1) return
      hoverTri = -1
      setHover(null)
      if (!animating) drawOverlay()
    }

    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(wrap)
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [depth, replay, reduce])

  const thickRhombs = Math.round(counts.thick / 2)
  const thinRhombs = Math.round(counts.thin / 2)
  const ratio = thinRhombs > 0 ? counts.thick / counts.thin : 0

  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      <div
        ref={wrapRef}
        role="img"
        aria-label={`A Penrose rhombus tiling grown to depth ${depth}, ${(
          thickRhombs + thinRhombs
        ).toLocaleString()} tiles with ten-fold symmetry, filling the plane without ever repeating.`}
        className="relative h-[clamp(300px,60vw,540px)] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#070807]"
      >
        <canvas ref={baseRef} aria-hidden className="absolute inset-0" />
        <canvas ref={overlayRef} aria-hidden className="absolute inset-0" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Depth
          </span>
          <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setDepth((d) => Math.max(MIN_DEPTH, d - 1))}
              disabled={depth <= MIN_DEPTH}
              aria-label="Fewer subdivisions"
              className="grid h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              &minus;
            </button>
            <span
              aria-live="polite"
              className="min-w-[2.4rem] text-center font-mono text-sm text-[#DCF87C]"
            >
              {depth}
            </span>
            <button
              type="button"
              onClick={() => setDepth((d) => Math.min(MAX_DEPTH, d + 1))}
              disabled={depth >= MAX_DEPTH}
              aria-label="More subdivisions"
              className="grid h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              +
            </button>
          </div>
          <span className="font-mono text-xs text-white/35">
            {(thickRhombs + thinRhombs).toLocaleString()} rhombs
          </span>
        </div>

        <button
          type="button"
          onClick={() => setReplay((r) => r + 1)}
          className="rounded-full border border-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
        >
          Redraw
        </button>
      </div>

      {/* The golden-ratio readout: which tile the pointer is on, and the live
          thick-to-thin ratio climbing toward phi as the tiling grows. */}
      <p className="min-h-[1.25rem] text-sm text-white/45" aria-live="polite">
        {hover ? (
          <>
            {hover.thick ? (
              <>
                A <span className="text-white/65">thick</span> rhomb &mdash; 72&deg; and 108&deg;.
              </>
            ) : (
              <>
                A <span className="text-white/65">thin</span> rhomb &mdash; 36&deg; and 144&deg;.
              </>
            )}{' '}
            Thick to thin is{' '}
            <span className="font-mono text-[#DCF87C]">{ratio ? ratio.toFixed(4) : '—'}</span>, closing
            on the golden ratio &phi;&nbsp;&asymp;&nbsp;1.6180.
          </>
        ) : (
          <>
            Hover a tile to name it. There are just two &mdash; a thick and a thin rhomb &mdash; and
            their count settles at &phi;&nbsp;&asymp;&nbsp;1.6180 to one.
          </>
        )}
      </p>
    </div>
  )
}
