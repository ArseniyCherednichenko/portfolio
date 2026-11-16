import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Recaman — the sequence that walks a number line in alternating semicircles,
// and the math family's piece about a rule as plain as Collatz's and a mystery
// just as stubborn. Start at 0. At step n, try to jump *back* by n: if
// a(n-1) - n is positive and not somewhere you have already landed, take it;
// otherwise jump *forward* by n instead. Repeat. That is the whole rule
// (Bernardo Recaman Santos, 1991).
//
// The picture is the canonical one — the one Numberphile made famous. Every term
// sits on a single horizontal line at its own value; each step is drawn as a
// semicircle whose diameter is the jump, so a step of size n spans n units and
// rises or falls by n/2. Consecutive arcs are flipped above and below the line
// so they never fold onto one another, and because the walk keeps doubling back
// over ground it has already crossed, the arcs nest and interleave into a shape
// that looks designed and is not: nothing here is placed by hand and there is no
// randomness, the same term count always draws the same figure, because the
// Recaman map is fixed.
//
// The open question it carries is the hook. It is conjectured — but has never
// been proved — that every whole number eventually appears somewhere in the
// sequence. (It is not even injective: the forward rule can land on a value seen
// before; 42 is the first number the walk visits twice.) So, like the Collatz
// coral two pieces down this thread, it is a child's rule standing on a problem
// no one has closed.
//
// Drawn on two stacked canvases the way the Collatz coral and the Hilbert curve
// are: a base that accumulates arc by arc as an eased sweep reveals them in the
// order the walk makes them (never cleared while it draws), and an overlay
// cleared each frame for the hovered arc lit bright with the two terms it joins.
// The whole figure is fit with one uniform scale so the semicircles stay true
// circles. Colour reads either travel order or jump size, stepped only in
// lightness so hue never encodes anything spurious. The canvases are aria-hidden
// and the wrapper carries a live label. Under prefers-reduced-motion nothing
// animates: the walk is painted at once and held, and the hover readout still
// works because it is interaction, not decoration.

// One lime, stepped only in lightness: deep for the near end of whatever the
// colour mode measures, paling toward white for the far end.
const LIME_DEEP = [150, 196, 60]
const LIME_PALE = [236, 255, 224]

// Term-count presets. Each term after the first adds one arc, so more terms
// means a denser weave. Capped so the reveal stays smooth.
const COUNTS = [80, 160, 320] as const

// What the lightness ramp reads. Both are honest encodings of the real figure:
// "Order" pales with how late the walk draws an arc; "Jump" pales with how far
// that step leaps. Neither invents a dimension — they just pick which true
// quantity the single lime axis carries.
const COLORS = [
  { id: 'order', label: 'Order' },
  { id: 'jump', label: 'Jump' },
] as const

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

interface Arc {
  from: number // a(n-1)
  to: number // a(n)
  step: number // n, which is also the jump size |to - from|
  up: boolean // drawn above the line (true) or below
  back: boolean // true if this was the backward (subtract) move
  firstVisit: boolean // whether a(n) is a value never landed on before
  n: number // the term index of `to`
}

// Walk the Recaman rule and turn each step into one semicircle. Deterministic:
// the same count always yields the same arcs.
function buildArcs(count: number): { arcs: Arc[]; valMin: number; valMax: number } {
  const seen = new Set<number>([0])
  const arcs: Arc[] = []
  let prev = 0
  let valMin = 0
  let valMax = 0
  for (let n = 1; n <= count; n++) {
    const back = prev - n
    const takeBack = back > 0 && !seen.has(back)
    const next = takeBack ? back : prev + n
    const firstVisit = !seen.has(next)
    seen.add(next)
    arcs.push({
      from: prev,
      to: next,
      step: n,
      up: n % 2 === 1, // flip each step so adjacent arcs never overlap
      back: takeBack,
      firstVisit,
      n,
    })
    if (next < valMin) valMin = next
    if (next > valMax) valMax = next
    prev = next
  }
  return { arcs, valMin, valMax }
}

export function Recaman({ className = '' }: { className?: string }) {
  const [countIdx, setCountIdx] = useState(1)
  const [colorIdx, setColorIdx] = useState(0)
  const [replay, setReplay] = useState(0)
  const [hover, setHover] = useState<{
    from: number
    to: number
    step: number
    back: boolean
    firstVisit: boolean
    n: number
  } | null>(null)
  const reduce = useReducedMotion()

  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const count = COUNTS[countIdx]
  const colorMode = COLORS[colorIdx].id

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

    const { arcs, valMin, valMax } = buildArcs(count)

    // Vertical reach in value units: the tallest up-arc and the deepest down-arc,
    // each radius being half its jump. Up is treated as positive y.
    let yTop = 0
    let yBot = 0
    let maxJump = 1
    for (const a of arcs) {
      const r = a.step / 2
      if (a.up) {
        if (r > yTop) yTop = r
      } else if (r > yBot) yBot = r
      if (a.step > maxJump) maxJump = a.step
    }

    // Screen geometry, filled at layout time. One uniform scale for x and y keeps
    // every semicircle a true circle.
    let scale = 1
    let ox = 0 // screen x of value `valMin`
    let baselineY = 0 // screen y of the number line (value 0 of the vertical axis)
    let lineW = 1

    const duration = Math.min(2800, Math.max(1200, 900 + count * 5))

    function colorFor(a: Arc, idx: number): string {
      const t =
        colorMode === 'order'
          ? arcs.length > 1
            ? idx / (arcs.length - 1)
            : 0
          : maxJump > 1
            ? (a.step - 1) / (maxJump - 1)
            : 0
      const r = Math.round(LIME_DEEP[0] + (LIME_PALE[0] - LIME_DEEP[0]) * t)
      const g = Math.round(LIME_DEEP[1] + (LIME_PALE[1] - LIME_DEEP[1]) * t)
      const b = Math.round(LIME_DEEP[2] + (LIME_PALE[2] - LIME_DEEP[2]) * t)
      return `rgb(${r},${g},${b})`
    }

    function computeLayout() {
      const pad = Math.max(16, Math.min(w, h) * 0.08)
      const spanX = valMax - valMin || 1
      const spanY = yTop + yBot || 1
      scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY)
      const drawnW = spanX * scale
      const drawnH = spanY * scale
      ox = (w - drawnW) / 2 - valMin * scale
      const oy = (h - drawnH) / 2
      // Top of the band (the highest up-arc) sits at oy; the line is yTop below it.
      baselineY = oy + yTop * scale
      lineW = Math.max(0.8, Math.min(2.4, scale * 0.5))
    }

    const xOf = (v: number) => ox + v * scale

    // Stroke one arc as a semicircle on the number line. Above the line uses the
    // upper half (angles pi..2pi, where canvas sin is negative), below uses 0..pi.
    function strokeArc(ctx: CanvasRenderingContext2D, a: Arc) {
      const cx = xOf((a.from + a.to) / 2)
      const r = (a.step / 2) * scale
      ctx.beginPath()
      if (a.up) ctx.arc(cx, baselineY, r, Math.PI, 2 * Math.PI)
      else ctx.arc(cx, baselineY, r, 0, Math.PI)
      ctx.stroke()
    }

    function drawBaseLine() {
      bctx!.save()
      bctx!.strokeStyle = 'rgba(255,255,255,0.10)'
      bctx!.lineWidth = 1
      bctx!.beginPath()
      bctx!.moveTo(xOf(valMin), baselineY)
      bctx!.lineTo(xOf(valMax), baselineY)
      bctx!.stroke()
      // A brighter nick at 0, the sequence's origin, when it is on screen.
      if (valMin <= 0 && valMax >= 0) {
        bctx!.strokeStyle = 'rgba(220,248,124,0.35)'
        bctx!.lineWidth = 1
        bctx!.beginPath()
        bctx!.moveTo(xOf(0), baselineY - 6)
        bctx!.lineTo(xOf(0), baselineY + 6)
        bctx!.stroke()
      }
      bctx!.restore()
    }

    function drawBase(from: number, to: number) {
      bctx!.globalCompositeOperation = 'lighter'
      bctx!.lineCap = 'round'
      bctx!.lineWidth = lineW
      for (let k = from; k < to; k++) {
        bctx!.globalAlpha = 0.72
        bctx!.strokeStyle = colorFor(arcs[k], k)
        strokeArc(bctx!, arcs[k])
      }
      bctx!.globalAlpha = 1
      bctx!.globalCompositeOperation = 'source-over'
    }

    function drawOverlay() {
      octx!.clearRect(0, 0, w, h)
      if (hoverIdx >= 0 && hoverIdx < arcs.length) {
        const a = arcs[hoverIdx]
        octx!.save()
        octx!.lineCap = 'round'
        octx!.lineWidth = Math.max(1.6, lineW * 2.1)
        octx!.shadowColor = 'rgba(220,248,124,0.9)'
        octx!.shadowBlur = 8
        octx!.strokeStyle = '#f4ffdf'
        strokeArc(octx!, a)
        octx!.shadowBlur = 0
        octx!.fillStyle = 'rgba(220,248,124,0.95)'
        for (const v of [a.from, a.to]) {
          octx!.beginPath()
          octx!.arc(xOf(v), baselineY, Math.max(2.4, lineW * 1.6), 0, Math.PI * 2)
          octx!.fill()
        }
        octx!.restore()
      }
    }

    function tick(ts: number) {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / duration)
      const target = Math.max(1, Math.round(easeInOut(p) * arcs.length))
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
      drawBaseLine()
      drawnUpTo = 0
      startTs = 0
      if (reduce) {
        animating = false
        drawBase(0, arcs.length)
        drawnUpTo = arcs.length
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
      computeLayout()
      restart()
    }

    // Nearest arc under the pointer: the pointer must be on the right side of the
    // line (up arcs above, down arcs below) and close to that arc's radius.
    function pointerToArc(clientX: number, clientY: number): number {
      const rect = base!.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      const reach = 10
      let best = -1
      let bestD = reach
      for (let i = 0; i < arcs.length; i++) {
        const a = arcs[i]
        const above = my <= baselineY
        if (a.up !== above) continue
        const cx = xOf((a.from + a.to) / 2)
        const r = (a.step / 2) * scale
        const d = Math.abs(Math.hypot(mx - cx, my - baselineY) - r)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return best
    }

    function onMove(e: PointerEvent) {
      const idx = pointerToArc(e.clientX, e.clientY)
      if (idx === hoverIdx) return
      hoverIdx = idx
      setHover(
        idx >= 0
          ? {
              from: arcs[idx].from,
              to: arcs[idx].to,
              step: arcs[idx].step,
              back: arcs[idx].back,
              firstVisit: arcs[idx].firstVisit,
              n: arcs[idx].n,
            }
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
  }, [count, colorMode, replay, reduce])

  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      <div
        ref={wrapRef}
        role="img"
        aria-label={`Recaman's sequence drawn as ${count} alternating semicircular arcs on a number line, each step jumping back by n when that landing is positive and unused and forward by n otherwise, flipped above and below the line so the arcs nest without overlapping.`}
        className="relative h-[clamp(280px,52vw,460px)] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#070807]"
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
                {c} terms
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
            {COLORS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorIdx(i)}
                aria-pressed={i === colorIdx}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  i === colorIdx
                    ? 'bg-[#DCF87C] text-black'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {c.label}
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

      {/* The readout: hover an arc to read the single step it draws — which term
          it joins to which, whether the walk jumped back or was forced forward,
          and whether it was the first time that number was ever reached. */}
      <p className="min-h-[1.25rem] text-sm text-white/45" aria-live="polite">
        {hover ? (
          <>
            Step <span className="font-mono text-[#DCF87C]">{hover.n}</span>
            {': '}from <span className="font-mono text-white/70">{hover.from}</span>{' '}
            {hover.back ? 'jumps back' : 'is forced forward'} by{' '}
            <span className="font-mono text-white/70">{hover.step}</span> to{' '}
            <span className="font-mono text-white/70">{hover.to}</span>
            {hover.back
              ? ' — the backward landing was positive and unused, so the rule takes it.'
              : ' — stepping back would repeat a value or go negative, so the rule adds instead.'}
            {!hover.firstVisit && ' This value had already been visited once before.'}
          </>
        ) : (
          'Hover an arc to read one step of the walk — and whether it had to leap forward.'
        )}
      </p>
    </div>
  )
}
