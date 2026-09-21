import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Collatz — the "coral" grown from the 3n+1 conjecture, and the math family's
// piece about a rule so simple a child can follow it and so stubborn no one has
// proved it always stops. Take any whole number: if it is even, halve it; if it
// is odd, triple it and add one. Repeat. The conjecture (Lothar Collatz, 1937,
// still open) is that every starting number, however large its detour, eventually
// falls to 1. n = 27 is the famous troublemaker — it climbs past nine thousand
// and takes 111 steps to come home.
//
// The picture is not a plot of those numbers but a *drawing* of the journeys.
// Every starting number's path down to 1 is reversed so all of them begin at the
// same root, then walked as a line that bends a little one way on an even number
// and a little the other way on an odd one. Because thousands of sequences share
// the same tail (… 16, 8, 4, 2, 1), those shared endings overlap into a single
// thick trunk near the root, and the paths only fan apart as they climb toward
// their distinct starting values — so the accumulation of every journey grows an
// organic, branching coral. Nothing is placed by hand and there is no randomness:
// the same count always grows the same coral, because the Collatz map is fixed.
//
// Drawn on two stacked canvases the way the Hilbert curve and the Penrose tiling
// are: a base that accumulates strand by strand as an eased sweep reveals them
// (blooming from the shortest, innermost journeys outward, never cleared while it
// draws), and an overlay cleared each frame for the hovered strand lit bright and
// the ring on its tip. Each strand is coloured only in lightness by how many
// steps its journey took — a deeper lime for the quick ones, paling toward white
// for the long climbers — so hue never encodes anything but stopping time. The
// canvases are aria-hidden and the wrapper carries a live label. Under
// prefers-reduced-motion nothing animates: the whole coral is painted at once and
// held, and the hover readout still works because it is interaction, not
// decoration.

// One lime, stepped only in lightness by stopping time: deep for the quick
// journeys, paling toward white for the long climbers.
const LIME_DEEP = [150, 196, 60]
const LIME_PALE = [236, 255, 224]

// How far each step advances, in model units (scaled to the box at layout time).
const SEG = 1

// Two turn styles, each a pair of small rotations applied per step by parity —
// even numbers bend one way, odd numbers the other. "Coral" fans wide and open;
// "Reef" curls tighter into a denser thicket. Both are deterministic.
const TWISTS = [
  { id: 'coral', label: 'Coral', even: 0.14, odd: 0.32 },
  { id: 'reef', label: 'Reef', even: 0.22, odd: 0.19 },
] as const

// Strand-count presets. Each strand is one starting number's whole journey to 1,
// so more strands means a fuller coral. Capped so the reveal stays smooth.
const COUNTS = [400, 1500, 4000] as const

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

interface Strand {
  // Model-space points (root at 0,0, y up), flat x,y pairs.
  pts: Float32Array
  tipX: number
  tipY: number
  start: number // the starting number this journey belongs to
  steps: number // stopping time (steps to reach 1)
  peak: number // highest value the journey reached
}

// Build one number's Collatz journey to 1, reversed so it begins at the root,
// and turned into a bending polyline. Even/odd parity picks the turn direction.
function buildStrand(start: number, aEven: number, aOdd: number): Strand {
  // First walk down to 1, recording the sequence and its peak.
  const seq: number[] = [start]
  let x = start
  let peak = start
  while (x !== 1) {
    x = x % 2 === 0 ? x / 2 : 3 * x + 1
    if (x > peak) peak = x
    seq.push(x)
  }
  const steps = seq.length - 1
  // Reverse: every journey now starts at 1 (the shared root) and ends at `start`.
  seq.reverse()

  let angle = Math.PI / 2 // point up
  let px = 0
  let py = 0
  const pts = new Float32Array(seq.length * 2)
  pts[0] = 0
  pts[1] = 0
  for (let i = 1; i < seq.length; i++) {
    const v = seq[i]
    angle += v % 2 === 0 ? aEven : -aOdd
    px += Math.cos(angle) * SEG
    py += Math.sin(angle) * SEG
    pts[i * 2] = px
    pts[i * 2 + 1] = py
  }
  return { pts, tipX: px, tipY: py, start, steps, peak }
}

export function Collatz({ className = '' }: { className?: string }) {
  const [countIdx, setCountIdx] = useState(1)
  const [twistIdx, setTwistIdx] = useState(0)
  const [replay, setReplay] = useState(0)
  const [hover, setHover] = useState<{ start: number; steps: number; peak: number } | null>(null)
  const reduce = useReducedMotion()

  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const count = COUNTS[countIdx]
  const twist = TWISTS[twistIdx]

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
    let raf = 0
    let startTs = 0
    let drawnUpTo = 0
    let animating = false
    let hoverIdx = -1

    // Build every journey once in model space (independent of the box size), then
    // sort so the coral blooms from the innermost, shortest journeys outward.
    const strands: Strand[] = []
    let minStep = Infinity
    let maxStep = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let s = 2; s < count + 2; s++) {
      const strand = buildStrand(s, twist.even, twist.odd)
      strands.push(strand)
      if (strand.steps < minStep) minStep = strand.steps
      if (strand.steps > maxStep) maxStep = strand.steps
      const p = strand.pts
      for (let i = 0; i < p.length; i += 2) {
        if (p[i] < minX) minX = p[i]
        if (p[i] > maxX) maxX = p[i]
        if (p[i + 1] < minY) minY = p[i + 1]
        if (p[i + 1] > maxY) maxY = p[i + 1]
      }
    }
    // Draw shortest journeys first so the trunk lands before the long climbers.
    const order = strands.map((_, i) => i).sort((a, b) => strands[a].steps - strands[b].steps)

    // Screen-space point buffers, filled at layout time.
    const pxStrands: Float32Array[] = strands.map((s) => new Float32Array(s.pts.length))
    const tipsPx = new Float32Array(strands.length * 2)
    let lineW = 1

    const duration = Math.min(2800, Math.max(1300, 1000 + count * 0.4))

    function colorFor(steps: number): string {
      const t = maxStep > minStep ? (steps - minStep) / (maxStep - minStep) : 0
      const r = Math.round(LIME_DEEP[0] + (LIME_PALE[0] - LIME_DEEP[0]) * t)
      const g = Math.round(LIME_DEEP[1] + (LIME_PALE[1] - LIME_DEEP[1]) * t)
      const b = Math.round(LIME_DEEP[2] + (LIME_PALE[2] - LIME_DEEP[2]) * t)
      return `rgb(${r},${g},${b})`
    }

    function computePx() {
      const pad = Math.max(14, Math.min(w, h) * 0.08)
      const spanX = maxX - minX || 1
      const spanY = maxY - minY || 1
      const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY)
      // Centre the drawn coral in the box; flip y so the trunk sits at the bottom
      // and the journeys climb upward.
      const drawnW = spanX * scale
      const drawnH = spanY * scale
      const ox = (w - drawnW) / 2 - minX * scale
      const oy = (h - drawnH) / 2
      for (let si = 0; si < strands.length; si++) {
        const src = strands[si].pts
        const dst = pxStrands[si]
        for (let i = 0; i < src.length; i += 2) {
          dst[i] = ox + src[i] * scale
          dst[i + 1] = h - oy - (src[i + 1] - minY) * scale
        }
        tipsPx[si * 2] = ox + strands[si].tipX * scale
        tipsPx[si * 2 + 1] = h - oy - (strands[si].tipY - minY) * scale
      }
      lineW = Math.max(0.5, Math.min(1.4, scale * 0.9))
    }

    // Stroke one strand as a single polyline (cheap: one path per journey).
    function strokeStrand(ctx: CanvasRenderingContext2D, si: number) {
      const p = pxStrands[si]
      ctx.beginPath()
      ctx.moveTo(p[0], p[1])
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
      ctx.stroke()
    }

    function drawBase(from: number, to: number) {
      bctx!.globalCompositeOperation = 'lighter'
      bctx!.lineCap = 'round'
      bctx!.lineJoin = 'round'
      bctx!.lineWidth = lineW
      for (let k = from; k < to; k++) {
        const si = order[k]
        bctx!.globalAlpha = 0.5
        bctx!.strokeStyle = colorFor(strands[si].steps)
        strokeStrand(bctx!, si)
      }
      bctx!.globalAlpha = 1
      bctx!.globalCompositeOperation = 'source-over'
    }

    function drawOverlay() {
      octx!.clearRect(0, 0, w, h)
      if (hoverIdx >= 0 && hoverIdx < strands.length) {
        octx!.save()
        octx!.lineCap = 'round'
        octx!.lineJoin = 'round'
        octx!.lineWidth = Math.max(1.4, lineW * 2.2)
        octx!.shadowColor = 'rgba(220,248,124,0.9)'
        octx!.shadowBlur = 8
        octx!.strokeStyle = '#f4ffdf'
        strokeStrand(octx!, hoverIdx)
        const tx = tipsPx[hoverIdx * 2]
        const ty = tipsPx[hoverIdx * 2 + 1]
        octx!.shadowBlur = 0
        octx!.fillStyle = 'rgba(220,248,124,0.95)'
        octx!.beginPath()
        octx!.arc(tx, ty, Math.max(2.2, lineW * 2.4), 0, Math.PI * 2)
        octx!.fill()
        octx!.restore()
      }
    }

    function tick(ts: number) {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / duration)
      const target = Math.max(1, Math.round(easeInOut(p) * strands.length))
      if (target > drawnUpTo) {
        drawBase(drawnUpTo, target)
        drawnUpTo = target
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
      drawnUpTo = 0
      startTs = 0
      if (reduce) {
        animating = false
        drawBase(0, strands.length)
        drawnUpTo = strands.length
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
      computePx()
      restart()
    }

    // Nearest tip within a small radius, so a hover lands on a whole journey.
    function pointerToStrand(clientX: number, clientY: number): number {
      const rect = base!.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      const reach = 16
      let best = -1
      let bestD = reach * reach
      for (let si = 0; si < strands.length; si++) {
        const dx = tipsPx[si * 2] - mx
        const dy = tipsPx[si * 2 + 1] - my
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = si
        }
      }
      return best
    }

    function onMove(e: PointerEvent) {
      const idx = pointerToStrand(e.clientX, e.clientY)
      if (idx === hoverIdx) return
      hoverIdx = idx
      setHover(
        idx >= 0
          ? { start: strands[idx].start, steps: strands[idx].steps, peak: strands[idx].peak }
          : null,
      )
      if (!animating) drawOverlay()
    }

    function onLeave() {
      if (hoverIdx === -1) return
      hoverIdx = -1
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
  }, [count, twist, replay, reduce])

  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      <div
        ref={wrapRef}
        role="img"
        aria-label={`Collatz coral grown from the 3n+1 journeys of ${count.toLocaleString()} starting numbers, every path reversed to a shared root so the shared endings overlap into a trunk that branches outward.`}
        className="relative h-[clamp(300px,60vw,540px)] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#070807]"
      >
        <canvas ref={baseRef} aria-hidden className="absolute inset-0" />
        <canvas ref={overlayRef} aria-hidden className="absolute inset-0" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
            {COUNTS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setCountIdx(i)}
                aria-pressed={i === countIdx}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
                  i === countIdx
                    ? 'bg-[#DCF87C] text-black'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {c.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
            {TWISTS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTwistIdx(i)}
                aria-pressed={i === twistIdx}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  i === twistIdx
                    ? 'bg-[#DCF87C] text-black'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setReplay((r) => r + 1)}
          className="rounded-full border border-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
        >
          Redraw
        </button>
      </div>

      {/* The readout: hover a strand's tip to follow one number's whole journey
          home — its stopping time and how high it climbed before falling to 1. */}
      <p className="min-h-[1.25rem] text-sm text-white/45" aria-live="polite">
        {hover ? (
          <>
            Start at <span className="font-mono text-[#DCF87C]">{hover.start.toLocaleString()}</span>
            {': '}it climbs as high as{' '}
            <span className="font-mono text-white/70">{hover.peak.toLocaleString()}</span> and takes{' '}
            <span className="font-mono text-white/70">{hover.steps.toLocaleString()}</span> steps to
            fall to 1 &mdash; every strand here ends there, which nobody has ever proved must happen.
          </>
        ) : (
          'Hover a strand tip to trace one number’s whole journey down to 1.'
        )}
      </p>
    </div>
  )
}
