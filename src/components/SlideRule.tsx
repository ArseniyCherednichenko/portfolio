import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A working slide rule, reduced to the one thing it does best: multiplication on
// two logarithmic scales. The body carries the fixed D scale; the sliding centre
// strip carries the C scale. Because both are spaced by the logarithm of their
// value, sliding the C scale along D adds logarithms — and adding logs multiplies
// the numbers. Set the C index (the "1") over a on D, run the cursor to b on C,
// and it points at a·b on D. That is the whole instrument, and the picture below
// is the arithmetic, not a drawing of it.
//
// Everything lives in one decade, values in [1, 10], positioned by their log. A
// value v sits at fraction f = log10(v) of the scale, so f runs 0..1 across the
// beam. The state is the two readings the operator sets — the multiplicand a on
// the slide and the multiplier b on the cursor — and the product a·b is read off,
// never stored, so the display can never drift from the geometry.
const VIEW_W = 640
const VIEW_H = 210
const MARGIN = 40
const SCALE_W = VIEW_W - MARGIN * 2 // usable length of one decade
const LEFT = MARGIN

// The seam is the shared line where the D ticks (rising into the body above) meet
// the C ticks (descending into the slide below), exactly as the two scales sit
// back-to-back on a real rule — so aligned readings line up across one line.
const SEAM = 86
const BODY_TOP = 24
const SLIDE_BOT = 138
const BODY_BOT = 184

// The classic 2 × 3 = 6 as the opening state — a product everyone can verify at
// a glance, so the instrument reads as honest the instant it loads.
const START_A = 2
const START_B = 3

const log10 = Math.log10
const fracOf = (v: number) => log10(v) // v in [1,10] -> f in [0,1]
const xOfFrac = (f: number) => LEFT + f * SCALE_W
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
// Round to three significant figures — the honest precision of a ~25 cm rule.
const sig3 = (n: number) => Number(n.toPrecision(3))

// The graduations of one logarithmic decade. Majors at every integer 1..10 are
// labelled; the minor spacing tightens where the log scale has room (0.1 from 1
// to 2, 0.2 from 2 to 5, 0.5 from 5 to 10) exactly as an engraved rule does.
interface Tick {
  v: number
  major: boolean
  mid: boolean
}
function decadeTicks(): Tick[] {
  const out: Tick[] = []
  const push = (from: number, to: number, step: number) => {
    // Integer-count the loop so floating error never drops or doubles a tick.
    const n = Math.round((to - from) / step)
    for (let i = 0; i < n; i += 1) {
      const v = Number((from + i * step).toFixed(2))
      out.push({ v, major: Number.isInteger(v), mid: Math.abs(v * 2 - Math.round(v * 2)) < 1e-9 })
    }
  }
  push(1, 2, 0.1)
  push(2, 5, 0.2)
  push(5, 10, 0.5)
  out.push({ v: 10, major: true, mid: true })
  return out
}
const TICKS = decadeTicks()

/**
 * A slide rule rebuilt as a working instrument rather than a picture of one, and
 * the controls family's companion to the Vernier caliper: another tool you read
 * a value off rather than one you set. It multiplies the way the real thing does
 * — by adding lengths on two logarithmic scales. Slide the centre strip so the C
 * scale's index (its "1") sits over a on the fixed D scale, then drag the cursor
 * hairline to b on C, and the hairline crosses a·b on D. Both moving parts are
 * real: the slide sets the multiplicand, the cursor picks the multiplier, and the
 * product is read straight off the geometry, so the number can never disagree
 * with where the lines actually fall.
 *
 * Both the slide and the cursor are honest role=sliders — arrow keys nudge by a
 * tenth, Shift by a whole unit, Home and End jump to the ends — with a live
 * region reading the current product. Each part tracks the pointer one to one
 * while dragged and eases on a spring only for a keyboard nudge; under
 * prefers-reduced-motion even that cuts straight to the value. The product is
 * kept in one decade: pushing a or b so their product would leave the D scale
 * simply stops at the far index, the way you would reset on a real rule.
 */
export function SlideRule({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [a, setA] = useState(START_A) // multiplicand, the slide's index over D
  const [b, setB] = useState(START_B) // multiplier, read on the C scale
  const svgRef = useRef<SVGSVGElement>(null)
  // Which part the pointer is dragging, so a drag is 1:1 and a keyboard change
  // eases. Null means nothing is being dragged (keyboard or resting).
  const drag = useRef<null | 'slide' | 'cursor'>(null)
  const [, force] = useState(0)

  const product = sig3(a * b)
  const slideFrac = fracOf(a) // where the C index sits on D
  const cursorFrac = fracOf(a) + fracOf(b) // where the hairline crosses D = a·b

  // Pointer x (client) -> fraction along the decade, clamped to the beam.
  const fracFromClientX = useCallback((clientX: number) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const scale = rect.width / VIEW_W
    const localX = (clientX - rect.left) / scale
    return clamp((localX - LEFT) / SCALE_W, 0, 1)
  }, [])

  const setSlideFromX = useCallback(
    (clientX: number) => {
      const f = fracFromClientX(clientX)
      // The slide sets a; keep b fixed, so a·b must stay in the decade: a ≤ 10/b.
      setA(clamp(sig3(10 ** f), 1, 10 / b))
    },
    [fracFromClientX, b],
  )

  const setCursorFromX = useCallback(
    (clientX: number) => {
      const f = fracFromClientX(clientX)
      // The cursor reads a·b on D; b follows from where it lands over the fixed a.
      setB(clamp(sig3(10 ** f / a), 1, 10 / a))
    },
    [fracFromClientX, a],
  )

  const onPointerDown = useCallback(
    (which: 'slide' | 'cursor') => (e: React.PointerEvent) => {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      drag.current = which
      force((n) => n + 1)
      if (which === 'slide') setSlideFromX(e.clientX)
      else setCursorFromX(e.clientX)
    },
    [setSlideFromX, setCursorFromX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drag.current === 'slide') setSlideFromX(e.clientX)
      else if (drag.current === 'cursor') setCursorFromX(e.clientX)
    },
    [setSlideFromX, setCursorFromX],
  )

  const endDrag = useCallback(() => {
    if (!drag.current) return
    drag.current = null
    force((n) => n + 1)
  }, [])

  // Keyboard for either part: a tenth per arrow, a whole unit with Shift, and
  // Home/End to the reachable ends. Steps are taken in value space so the rule
  // lands on the round numbers an operator actually reaches for.
  const onKey = useCallback(
    (which: 'slide' | 'cursor') => (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 1 : 0.1
      const cur = which === 'slide' ? a : b
      const hi = which === 'slide' ? 10 / b : 10 / a
      let next: number
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + step
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - step
      else if (e.key === 'Home') next = 1
      else if (e.key === 'End') next = hi
      else return
      e.preventDefault()
      drag.current = null // keyboard changes ease on the spring
      const val = clamp(sig3(next), 1, hi)
      if (which === 'slide') setA(val)
      else setB(val)
    },
    [a, b],
  )

  const springy = (which: 'slide' | 'cursor') =>
    drag.current !== which && !reduce
      ? { type: 'spring' as const, stiffness: 460, damping: 34, mass: 0.7 }
      : { duration: 0 }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Reading: the arithmetic the geometry is doing, right now. */}
      <div className="flex items-end gap-2 font-display text-4xl font-bold tabular-nums sm:text-5xl">
        <span className="text-white/85">{sig3(a)}</span>
        <span className="pb-0.5 text-2xl text-white/40 sm:text-3xl">&times;</span>
        <span className="text-white/85">{sig3(b)}</span>
        <span className="pb-0.5 text-2xl text-white/40 sm:text-3xl">=</span>
        <span className="text-[#DCF87C]">{product}</span>
      </div>
      <p className="mt-1 text-sm text-white/45" aria-hidden="true">
        C index over <span className="tabular-nums text-white/70">{sig3(a)}</span> on D
        <span className="px-1.5 text-white/30">·</span>
        cursor at <span className="tabular-nums text-white/70">{sig3(b)}</span> on C
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        aria-labelledby={labelId}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="mt-5 w-full max-w-[600px] touch-none select-none"
      >
        <title id={labelId}>
          Slide rule reading {sig3(a)} times {sig3(b)} equals {product}. Drag the centre slide to set
          the multiplicand and the cursor hairline to set the multiplier.
        </title>

        {/* Body — the two fixed stators the slide runs between. */}
        <rect
          x={LEFT - 18}
          y={BODY_TOP}
          width={SCALE_W + 36}
          height={SEAM - 2 - BODY_TOP}
          rx={6}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.1)"
        />
        <rect
          x={LEFT - 18}
          y={SLIDE_BOT + 2}
          width={SCALE_W + 36}
          height={BODY_BOT - SLIDE_BOT - 2}
          rx={6}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.1)"
        />

        {/* Fixed scale letters, engraved at the left gutter. */}
        <text x={LEFT - 30} y={SEAM - 14} textAnchor="middle" className="fill-[#DCF87C]" style={{ fontSize: 13, fontWeight: 700 }}>
          D
        </text>

        {/* D scale — fixed, on the body, ticks rising to the seam. The tick under
            the cursor (the product) and the tick under the C index (the
            multiplicand) are lit lime, so both things the operator has aligned
            are visible on the fixed scale at once. */}
        <Scale baseline={SEAM} dir={-1} litFrac={[cursorFrac, slideFrac]} labelsAbove />

        {/* The slide — one rigid strip carrying the C scale, translated so its
            index (C = 1, local x = LEFT) lands over a on D. Drag is 1:1; a
            keyboard nudge eases. */}
        <motion.g
          animate={{ x: slideFrac * SCALE_W }}
          transition={springy('slide')}
          role="slider"
          tabIndex={0}
          aria-label="Slide — multiplicand set by the C scale index over D"
          aria-valuemin={1}
          aria-valuemax={sig3(10 / b)}
          aria-valuenow={sig3(a)}
          aria-valuetext={`Multiplicand ${sig3(a)}`}
          onPointerDown={onPointerDown('slide')}
          onKeyDown={onKey('slide')}
          className="outline-none [&:focus-visible_.slide-body]:stroke-[#DCF87C]/70"
          style={{ cursor: drag.current === 'slide' ? 'grabbing' : 'grab' }}
        >
          <rect
            className="slide-body"
            x={LEFT - 18}
            y={SEAM}
            width={SCALE_W + 36}
            height={SLIDE_BOT - SEAM}
            rx={5}
            fill="rgba(255,255,255,0.07)"
            stroke="rgba(255,255,255,0.16)"
          />
          {/* Thumb notches, so it reads as a thing you push. */}
          <rect x={LEFT - 14} y={SEAM + 8} width={4} height={SLIDE_BOT - SEAM - 16} rx={2} fill="rgba(255,255,255,0.18)" />
          <rect x={LEFT + SCALE_W + 10} y={SEAM + 8} width={4} height={SLIDE_BOT - SEAM - 16} rx={2} fill="rgba(255,255,255,0.18)" />
          {/* The scale letter rides the slide, as it is engraved on the real one. */}
          <text x={LEFT - 30} y={SEAM + 20} textAnchor="middle" className="fill-[#DCF87C]" style={{ fontSize: 13, fontWeight: 700 }}>
            C
          </text>
          {/* C scale — ticks descending from the seam to meet D. The C index (1)
              and the cursor's landing (b) are lit lime. */}
          <Scale baseline={SEAM} dir={1} litFrac={[0, fracOf(b)]} />
        </motion.g>

        {/* Cursor — the glass hairline. It spans the whole rule and reads a·b on
            D and b on C at once. A real role=slider in its own right. */}
        <motion.g
          animate={{ x: xOfFrac(cursorFrac) }}
          transition={springy('cursor')}
          role="slider"
          tabIndex={0}
          aria-label="Cursor — multiplier, reads the product on D"
          aria-valuemin={1}
          aria-valuemax={sig3(10 / a)}
          aria-valuenow={sig3(b)}
          aria-valuetext={`Multiplier ${sig3(b)}, product ${product}`}
          onPointerDown={onPointerDown('cursor')}
          onKeyDown={onKey('cursor')}
          className="outline-none [&:focus-visible_.cursor-glass]:stroke-[#DCF87C]"
          style={{ cursor: drag.current === 'cursor' ? 'grabbing' : 'ew-resize' }}
        >
          <rect
            className="cursor-glass"
            x={-13}
            y={BODY_TOP - 4}
            width={26}
            height={BODY_BOT - BODY_TOP + 8}
            rx={5}
            fill="rgba(220,248,124,0.05)"
            stroke="rgba(220,248,124,0.35)"
            strokeWidth={1}
          />
          <line x1={0} x2={0} y1={BODY_TOP - 2} y2={BODY_BOT + 2} stroke="#DCF87C" strokeWidth={1.25} />
        </motion.g>
      </svg>

      {/* Controls + a live reading for assistive tech. */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            drag.current = null
            setA(START_A)
            setB(START_B)
          }}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
        >
          Reset
        </button>
        <span aria-live="polite" className="sr-only">
          {sig3(a)} times {sig3(b)} equals {product}
        </span>
        <span className="text-sm text-white/40" aria-hidden="true">
          adding lengths multiplies the numbers
        </span>
      </div>
    </div>
  )
}

// One logarithmic decade of graduations, drawn from a shared `baseline` (the
// seam). `dir` is -1 for the D scale, whose ticks rise into the body above, and
// +1 for the C scale, whose ticks descend into the slide below. `litFrac` are the
// fractions to light lime. `labelsAbove` places the D value labels above their
// ticks; the C labels sit below theirs.
function Scale({
  baseline,
  dir,
  litFrac,
  labelsAbove = false,
}: {
  baseline: number
  dir: 1 | -1
  litFrac: number[]
  labelsAbove?: boolean
}) {
  // Match lit fractions to a thousandth, so exact index/product hits light up.
  const lit = new Set(litFrac.map((f) => Math.round(f * 1000)))
  const isLit = (f: number) => lit.has(Math.round(f * 1000))
  const labelY = labelsAbove ? baseline - 26 : baseline + 34
  return (
    <g>
      {TICKS.map((t) => {
        const f = fracOf(t.v)
        const x = xOfFrac(f)
        const len = t.major ? 20 : t.mid ? 13 : 9
        const on = isLit(f)
        return (
          <g key={t.v}>
            <line
              x1={x}
              x2={x}
              y1={baseline}
              y2={baseline + dir * len}
              stroke={on ? '#DCF87C' : t.major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)'}
              strokeWidth={on ? 2 : t.major ? 1.4 : 1}
            />
            {t.major && (
              <text
                x={x}
                y={labelY}
                textAnchor="middle"
                className={on ? 'fill-[#DCF87C]' : 'fill-white/55'}
                style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}
              >
                {t.v === 10 ? '1' : t.v}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

export default SlideRule
