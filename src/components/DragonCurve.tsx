import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// The Heighway dragon — the fractal you get by folding a strip of paper in half,
// again and again, and then opening every crease to a right angle. It is the
// one curve in this corner of the Playground whose whole identity is the fold,
// so unlike the space-filling Hilbert sweep (a fixed recursive tour) or the
// branching fractal tree (a recursion that splits), this piece animates the
// crease itself: a single parameter t runs the creases from flat (t=0, a plain
// straight strip) to square (t=1, the dragon), and the curve folds up in front
// of you and unfolds back down on command.
//
// The turns are not random and not hand-placed — they are the regular
// paper-folding sequence, read straight off the binary of each crease index.
// Number the creases 1, 2, 3, …; strip the trailing zeros from the index, and
// the remaining low bit decides the turn: a left where it reads 1, a right where
// it reads 3 (mod 4). That one rule is self-similar, so the order-n dragon is
// just the first 2^n − 1 turns of the same infinite sequence and every higher
// order extends the last rather than replacing it — which is why stepping the
// order feels like unrolling more of one object, not swapping figures.
//
// Everything is deterministic and off the wall clock: for a given fold angle the
// turtle walks the same path every frame, the bounding box is re-fit each frame
// so the strip zooms in on itself as it folds, and the stroke is drawn in colour
// bands from a deep teal tail to a lime head so the order of travel reads along
// the curve. The canvas is decorative and aria-hidden; a live region names the
// order, the segment count and the fold state. Under reduced motion nothing
// sweeps — the dragon is painted whole at full fold and the Fold control snaps
// between the flat strip and the finished curve with no animation.

interface DragonCurveProps {
  className?: string
}

const ORDER_MIN = 1
const ORDER_MAX = 14
const ORDER_DEFAULT = 11
const HALF_PI = Math.PI / 2

// The regular paper-folding sequence, precomputed once to the deepest order we
// allow. turns[k] is the crease after segment k: +1 is a left turn, −1 a right.
// Index 0 is unused so a crease index reads as its natural 1-based number.
const MAX_SEGMENTS = 1 << ORDER_MAX
const TURNS = (() => {
  const t = new Int8Array(MAX_SEGMENTS)
  for (let k = 1; k < MAX_SEGMENTS; k++) {
    let m = k
    while ((m & 1) === 0) m >>= 1
    t[k] = (m & 3) === 1 ? 1 : -1
  }
  return t
})()

// Linearly blend two RGB triples; used to lay the travel-order colour bands.
function mix(a: [number, number, number], b: [number, number, number], f: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * f)
  const g = Math.round(a[1] + (b[1] - a[1]) * f)
  const bl = Math.round(a[2] + (b[2] - a[2]) * f)
  return `rgb(${r},${g},${bl})`
}
const TAIL: [number, number, number] = [31, 118, 110] // deep teal — where the walk begins
const HEAD: [number, number, number] = [220, 248, 124] // lime — where it ends

// A compact −/＋ stepper for the order. Real buttons; the held value is echoed to
// assistive tech through each control's own label, matching the house pattern.
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
          aria-label={`Lower ${label.toLowerCase()}`}
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
          aria-label={`Raise ${label.toLowerCase()}`}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/12 text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-white disabled:opacity-30 disabled:hover:border-white/12"
        >
          <span aria-hidden>+</span>
        </button>
      </div>
    </div>
  )
}

export function DragonCurve({ className = '' }: DragonCurveProps) {
  const reduce = useReducedMotion()
  const liveId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [order, setOrder] = useState(ORDER_DEFAULT)
  // Whether the target state is the folded dragon (true) or the flat strip.
  const [folded, setFolded] = useState(true)
  // A bump token so "Refold" replays the fold even when nothing else changed.
  const [replay, setReplay] = useState(0)

  const segments = 1 << order

  // Live animation state, all off the React render path.
  const sizeRef = useRef(0)
  const dprRef = useRef(1)
  const tRef = useRef(1) // current fold angle fraction, 0 (flat) … 1 (dragon)
  const targetRef = useRef(1)
  const rafRef = useRef(0)
  // Reusable point buffers so a frame allocates nothing.
  const xsRef = useRef(new Float64Array(MAX_SEGMENTS + 1))
  const ysRef = useRef(new Float64Array(MAX_SEGMENTS + 1))

  // Walk the turtle at the current fold fraction and paint the curve, re-fitting
  // the bounding box so the strip zooms on itself as it folds. Pure function of
  // t and order; no randomness, no clock.
  const paint = useCallback(
    (t: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const s = sizeRef.current
      const dpr = dprRef.current
      if (!s) return

      const n = 1 << order
      const xs = xsRef.current
      const ys = ysRef.current
      const angle = t * HALF_PI

      // Net turning at full fold, halved, so we counter-rotate and the fold looks
      // balanced in place instead of spinning off to one side.
      let net = 0
      for (let i = 1; i < n; i++) net += TURNS[i]
      let a = -0.5 * net * angle

      let x = 0
      let y = 0
      xs[0] = 0
      ys[0] = 0
      let minX = 0
      let maxX = 0
      let minY = 0
      let maxY = 0
      for (let i = 1; i <= n; i++) {
        x += Math.cos(a)
        y += Math.sin(a)
        xs[i] = x
        ys[i] = y
        if (x < minX) minX = x
        else if (x > maxX) maxX = x
        if (y < minY) minY = y
        else if (y > maxY) maxY = y
        if (i < n) a += TURNS[i] * angle
      }

      const pad = s * 0.1
      const span = s - pad * 2
      const w = maxX - minX
      const h = maxY - minY
      const scale = span / Math.max(w, h, 1e-6)
      const ox = (s - w * scale) / 2 - minX * scale
      const oy = (s - h * scale) / 2 - minY * scale

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, s, s)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(1, s / 320)

      // Draw in colour bands from teal tail to lime head. Each band overlaps its
      // neighbour by one point so the seams stay closed. Band count is bounded so
      // a deep order still costs a couple of hundred stroke calls, not thousands.
      const bands = Math.min(240, n)
      const per = n / bands
      ctx.shadowColor = 'rgba(220,248,124,0.25)'
      ctx.shadowBlur = s / 90
      for (let b = 0; b < bands; b++) {
        const start = Math.floor(b * per)
        const end = b === bands - 1 ? n : Math.floor((b + 1) * per)
        ctx.strokeStyle = mix(TAIL, HEAD, bands === 1 ? 1 : b / (bands - 1))
        ctx.beginPath()
        ctx.moveTo(xs[start] * scale + ox, ys[start] * scale + oy)
        for (let i = start + 1; i <= end; i++) ctx.lineTo(xs[i] * scale + ox, ys[i] * scale + oy)
        ctx.stroke()
      }
      ctx.shadowBlur = 0

      // A bright head where the walk ends, so the direction of travel is legible.
      const hx = xs[n] * scale + ox
      const hy = ys[n] * scale + oy
      const hr = Math.max(2.5, s / 150)
      const grd = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr * 3)
      grd.addColorStop(0, 'rgba(220,248,124,0.95)')
      grd.addColorStop(1, 'rgba(220,248,124,0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(hx, hy, hr * 3, 0, Math.PI * 2)
      ctx.fill()
    },
    [order],
  )

  // Ease the current fold toward its target, repainting each frame; the loop runs
  // only while a fold is in flight and then stops, so a settled curve costs
  // nothing. Reduced motion skips the loop entirely and snaps to the target.
  const runToTarget = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (reduce) {
      tRef.current = targetRef.current
      paint(tRef.current)
      return
    }
    const tick = () => {
      const target = targetRef.current
      const cur = tRef.current
      const next = cur + (target - cur) * 0.08
      if (Math.abs(target - next) < 0.0005) {
        tRef.current = target
        paint(target)
        return
      }
      tRef.current = next
      paint(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [reduce, paint])

  // Size the canvas to its square container at device resolution and repaint the
  // live fold so a resize stays continuous.
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
      paint(tRef.current)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [paint])

  // On an order change or a replay, start the fold fresh from the flat strip so
  // the new depth unrolls into view; the Fold toggle just moves the target.
  useEffect(() => {
    targetRef.current = folded ? 1 : 0
    if (!reduce && folded) tRef.current = 0
    runToTarget()
    // `replay` is intentionally a dependency so Refold re-triggers the fold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, replay, reduce])

  // The Fold / Unfold toggle: move the target and ease toward it in place,
  // without resetting, so it folds and unfolds smoothly.
  useEffect(() => {
    targetRef.current = folded ? 1 : 0
    runToTarget()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folded])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  return (
    <div className={`flex flex-col items-center gap-7 ${className}`}>
      <div
        ref={wrapRef}
        className="relative aspect-square w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_120%_at_30%_20%,#111,#050505)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_60px_rgba(0,0,0,0.6)]"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      </div>

      {/* Controls — real, labelled, keyboard-reachable. */}
      <div className="w-full max-w-[440px] space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <Stepper label="Order" value={order} min={ORDER_MIN} max={ORDER_MAX} onChange={setOrder} />
        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-4">
          <span className="text-xs leading-snug text-white/40">
            <span className="font-display text-sm font-bold tabular-nums text-white/70">
              {segments.toLocaleString()}
            </span>{' '}
            segments, one crease between each.
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={folded}
            aria-label={folded ? 'Unfold the dragon flat' : 'Fold the strip into the dragon'}
            onClick={() => setFolded((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
              folded ? 'border-[#DCF87C]/60 bg-[#DCF87C]/20' : 'border-white/15 bg-white/[0.04]'
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
                folded ? 'left-[calc(100%-1.375rem)] bg-[#DCF87C]' : 'left-0.5 bg-white/50'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
            {folded ? 'Folded' : 'Flat strip'}
          </span>
          <button
            type="button"
            onClick={() => {
              setFolded(true)
              setReplay((r) => r + 1)
            }}
            aria-describedby={liveId}
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
            Refold
          </button>
        </div>
      </div>
      <span id={liveId} aria-live="polite" className="sr-only">
        {reduce
          ? `The Heighway dragon at order ${order}, ${segments.toLocaleString()} segments, painted whole and held still. Raise or lower the order to unroll more or less of the same curve.`
          : `The Heighway dragon at order ${order}: ${segments.toLocaleString()} segments folding from a flat strip into the fractal. Currently ${
              folded ? 'folded into the dragon' : 'unfolded flat'
            }. Step the order to unroll more of the curve, toggle to fold or unfold, or refold to replay.`}
      </span>
    </div>
  )
}
