import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// HilbertCurve — a space-filling curve that draws itself, and the one shape in
// the curve-tracing family whose whole point is a paradox: a single continuous
// line, one-dimensional, that visits every cell of a two-dimensional grid without
// ever crossing itself. Where the Spirograph and the Harmonograph trace a fixed
// figure and stop, and the Oscilloscope holds no line of its own, this line has a
// job — cover the plane — and the astonishing part is *how* it covers it.
//
// The construction is pure recursion. Order 1 is a plain U through the four cells
// of a 2x2 grid. Order 2 takes four copies of that U — two of them rotated — and
// stitches them into the four quadrants of a 4x4 grid. Order p is four copies of
// order p-1 wired together the same way, so a grid of 2^p x 2^p cells is threaded
// by one unbroken path of (2^p)^2 points. Nothing is drawn by hand; every point
// comes from the standard bit-twiddling map between a distance d along the curve
// and its (x, y) cell (d2xy), and its exact inverse (xy2d).
//
// What makes it worth showing is *locality*. Because the curve folds back on
// itself at every scale instead of scanning row by row, two cells that sit near
// each other on the plane almost always sit near each other along the line too —
// which is exactly why Hilbert order is used to lay out images, databases, and
// textures so that things close in space stay close in memory. The site makes
// that legible two ways: the line is coloured by how far along it you are (a lime
// that lightens toward white as the distance grows), so you can read the order of
// travel straight off the picture; and hovering the field maps the cell under the
// pointer back to its distance along the curve, so you can watch a small move in
// space stay a small move along the line — until you cross one of the big folds.
//
// Drawn on two stacked canvases the way the Chaos game is: a base canvas that
// accumulates the curve segment by segment as it is revealed (never cleared while
// it draws), and an overlay cleared each frame for the glowing head that leads the
// draw and the ring that marks the hovered cell. No Math.random, no Date.now on
// the hot path — every point is a deterministic integer map, so the same order
// always draws the same curve. The canvases are aria-hidden and the wrapper
// carries a live label. Under prefers-reduced-motion the animation never runs: the
// whole curve is painted at once and held, and the hover mapping still works
// because it is interaction, not decoration.

const MIN_ORDER = 1
const MAX_ORDER = 7
const DEFAULT_ORDER = 6

// One lime, stepped only in lightness along the path — a deeper lime where the
// curve begins climbing toward a near-white as the distance grows, so hue never
// encodes anything but "how far along".
const LIME_DEEP = [150, 196, 60]
const LIME_PALE = [236, 255, 224]

// Map a distance d (0 .. n*n-1) along an order-log2(n) Hilbert curve to its (x, y)
// grid cell. The textbook algorithm: read two bits of d per level, place the cell
// in the right quadrant, and rotate/reflect the sub-square so the copies join up.
function d2xy(n: number, d: number): [number, number] {
  let rx = 0
  let ry = 0
  let t = d
  let x = 0
  let y = 0
  for (let s = 1; s < n; s *= 2) {
    rx = 1 & (t >> 1)
    ry = 1 & (t ^ rx)
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x
        y = s - 1 - y
      }
      const tmp = x
      x = y
      y = tmp
    }
    x += s * rx
    y += s * ry
    t >>= 2
  }
  return [x, y]
}

// The exact inverse: a cell (x, y) back to its distance along the curve. This is
// what lets a hovered cell report where on the one-dimensional line it lands.
function xy2d(n: number, x: number, y: number): number {
  let rx = 0
  let ry = 0
  let d = 0
  let ix = x
  let iy = y
  for (let s = n >> 1; s > 0; s >>= 1) {
    rx = (ix & s) > 0 ? 1 : 0
    ry = (iy & s) > 0 ? 1 : 0
    d += s * s * ((3 * rx) ^ ry)
    if (ry === 0) {
      if (rx === 1) {
        ix = s - 1 - ix
        iy = s - 1 - iy
      }
      const tmp = ix
      ix = iy
      iy = tmp
    }
  }
  return d
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export function HilbertCurve({ className = '' }: { className?: string }) {
  const [order, setOrder] = useState(DEFAULT_ORDER)
  const [replay, setReplay] = useState(0)
  const [hover, setHover] = useState<{ index: number; total: number } | null>(null)
  const reduce = useReducedMotion()

  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const n = 1 << order
  const total = n * n

  useEffect(() => {
    const base = baseRef.current
    const overlay = overlayRef.current
    const wrap = wrapRef.current
    if (!base || !overlay || !wrap) return
    const bctx = base.getContext('2d')
    const octx = overlay.getContext('2d')
    if (!bctx || !octx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)

    let w = 0
    let h = 0
    let step = 0
    let originX = 0
    let originY = 0
    let lineW = 1
    let pts = new Float32Array(0) // flat x,y pairs in css px
    let raf = 0
    let startTs = 0
    let drawnUpTo = 0 // how many points of the path the base canvas has drawn
    let animating = false
    let hoverIndex = -1

    // Duration scales gently with the point count so a dense curve still finishes
    // in a couple of seconds rather than crawling.
    const duration = Math.min(3200, Math.max(1300, 1100 + total * 0.06))

    function lerpColor(t: number): string {
      const r = Math.round(LIME_DEEP[0] + (LIME_PALE[0] - LIME_DEEP[0]) * t)
      const g = Math.round(LIME_DEEP[1] + (LIME_PALE[1] - LIME_DEEP[1]) * t)
      const b = Math.round(LIME_DEEP[2] + (LIME_PALE[2] - LIME_DEEP[2]) * t)
      return `rgb(${r},${g},${b})`
    }

    function computePts() {
      const sizeMin = Math.min(w, h)
      const pad = Math.max(12, sizeMin * 0.07)
      const inner = Math.max(1, sizeMin - pad * 2)
      const gaps = n - 1 || 1
      step = inner / gaps
      originX = (w - inner) / 2
      originY = (h - inner) / 2
      lineW = Math.max(0.6, step * 0.34)
      pts = new Float32Array(total * 2)
      for (let i = 0; i < total; i++) {
        const [gx, gy] = d2xy(n, i)
        pts[i * 2] = originX + gx * step
        pts[i * 2 + 1] = originY + gy * step
      }
    }

    // Draw the path segments [from, to) onto the base canvas, each coloured by its
    // distance along the curve. Called incrementally as the head advances, so a
    // segment is painted exactly once and the accumulation is cheap per frame.
    function drawBase(from: number, to: number) {
      bctx!.lineCap = 'round'
      bctx!.lineJoin = 'round'
      bctx!.lineWidth = lineW
      const first = Math.max(1, from)
      for (let i = first; i < to; i++) {
        bctx!.strokeStyle = lerpColor((i - 1) / (total - 1 || 1))
        bctx!.beginPath()
        bctx!.moveTo(pts[(i - 1) * 2], pts[(i - 1) * 2 + 1])
        bctx!.lineTo(pts[i * 2], pts[i * 2 + 1])
        bctx!.stroke()
      }
    }

    // The overlay carries only transient marks: the glowing head that leads the
    // draw, and the ring on the hovered cell. Cleared and repainted, never
    // accumulated.
    function drawOverlay() {
      octx!.clearRect(0, 0, w, h)
      if (animating && drawnUpTo > 0) {
        const i = drawnUpTo - 1
        const hx = pts[i * 2]
        const hy = pts[i * 2 + 1]
        octx!.save()
        octx!.shadowColor = 'rgba(220,248,124,0.9)'
        octx!.shadowBlur = Math.max(6, step * 1.4)
        octx!.fillStyle = '#f4ffdf'
        octx!.beginPath()
        octx!.arc(hx, hy, Math.max(1.6, lineW * 0.9), 0, Math.PI * 2)
        octx!.fill()
        octx!.restore()
      }
      if (hoverIndex >= 0 && hoverIndex < total) {
        const hx = pts[hoverIndex * 2]
        const hy = pts[hoverIndex * 2 + 1]
        const r = Math.max(3, step * 0.62)
        octx!.save()
        octx!.strokeStyle = 'rgba(255,255,255,0.9)'
        octx!.lineWidth = Math.max(1, lineW * 0.5)
        octx!.beginPath()
        octx!.arc(hx, hy, r, 0, Math.PI * 2)
        octx!.stroke()
        octx!.fillStyle = 'rgba(220,248,124,0.95)'
        octx!.beginPath()
        octx!.arc(hx, hy, Math.max(1.4, r * 0.34), 0, Math.PI * 2)
        octx!.fill()
        octx!.restore()
      }
    }

    function tick(ts: number) {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / duration)
      const target = Math.max(1, Math.round(easeInOut(p) * total))
      if (target > drawnUpTo) {
        drawBase(drawnUpTo, target)
        drawnUpTo = target
      }
      drawOverlay()
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        animating = false
        drawOverlay() // final pass drops the head, keeps any hover ring
      }
    }

    function restart() {
      cancelAnimationFrame(raf)
      bctx!.clearRect(0, 0, w, h)
      octx!.clearRect(0, 0, w, h)
      drawnUpTo = 0
      startTs = 0
      if (reduce) {
        // No animation: paint the whole curve at once and hold it.
        animating = false
        drawBase(1, total)
        drawnUpTo = total
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
      computePts()
      restart()
    }

    function pointerToIndex(clientX: number, clientY: number): number {
      const rect = base!.getBoundingClientRect()
      const gx = Math.round((clientX - rect.left - originX) / step)
      const gy = Math.round((clientY - rect.top - originY) / step)
      if (gx < 0 || gy < 0 || gx >= n || gy >= n) return -1
      return xy2d(n, gx, gy)
    }

    function onMove(e: PointerEvent) {
      const idx = pointerToIndex(e.clientX, e.clientY)
      if (idx === hoverIndex) return
      hoverIndex = idx
      setHover(idx >= 0 ? { index: idx, total } : null)
      if (!animating) drawOverlay()
    }

    function onLeave() {
      if (hoverIndex === -1) return
      hoverIndex = -1
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
  }, [order, replay, reduce, n, total])

  const pct = hover ? Math.round((hover.index / (hover.total - 1 || 1)) * 100) : null

  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      <div
        ref={wrapRef}
        role="img"
        aria-label={`Hilbert space-filling curve of order ${order}, one continuous line threading all ${total.toLocaleString()} cells of a ${n} by ${n} grid.`}
        className="relative h-[clamp(280px,58vw,520px)] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#070807]"
      >
        <canvas ref={baseRef} aria-hidden className="absolute inset-0" />
        <canvas ref={overlayRef} aria-hidden className="absolute inset-0" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Order
          </span>
          <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setOrder((o) => Math.max(MIN_ORDER, o - 1))}
              disabled={order <= MIN_ORDER}
              aria-label="Lower the curve order"
              className="grid h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              &minus;
            </button>
            <span
              aria-live="polite"
              className="min-w-[2.4rem] text-center font-mono text-sm text-[#DCF87C]"
            >
              {order}
            </span>
            <button
              type="button"
              onClick={() => setOrder((o) => Math.min(MAX_ORDER, o + 1))}
              disabled={order >= MAX_ORDER}
              aria-label="Raise the curve order"
              className="grid h-7 w-7 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              +
            </button>
          </div>
          <span className="font-mono text-xs text-white/35">
            {n}&times;{n} &middot; {total.toLocaleString()} cells
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

      {/* The locality readout: a hovered cell mapped back to its place along the
          one-dimensional line, so a small move in space reads as a small move
          along the curve. */}
      <p className="min-h-[1.25rem] text-sm text-white/45" aria-live="polite">
        {hover ? (
          <>
            That cell sits at{' '}
            <span className="font-mono text-[#DCF87C]">
              {(hover.index + 1).toLocaleString()}
            </span>{' '}
            of {hover.total.toLocaleString()} along the line &mdash;{' '}
            <span className="text-white/65">{pct}% of the way through</span>. Move a
            little and the number barely changes: neighbours in space stay
            neighbours along the curve.
          </>
        ) : (
          'Hover the field to map a cell back to how far along the single line it lands.'
        )}
      </p>
    </div>
  )
}
