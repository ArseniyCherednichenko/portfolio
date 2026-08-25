import {
  useCallback,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useAnimationFrame, useReducedMotion } from 'framer-motion'

// Bezier — an interactive cubic Bézier curve, taken apart while it draws. Every
// easing curve on the rest of this site is one of these under the hood; here the
// thing itself is the toy. Four control points define the curve; drag any of
// them and it reshapes live under the pointer. A bead rides along it, and the
// whole De Casteljau construction — the nested set of straight-line
// interpolations that a Bézier actually is — is drawn out around the bead as it
// travels, so you can watch three lerps collapse into two, then two into one,
// then that one point trace the curve.
//
// Same "made, not assembled" thesis as the rest of the site's motion: no easing
// library, no path-sampling helper. The curve point is computed the honest way,
// by repeated linear interpolation (de Casteljau's algorithm), which is also
// exactly what the construction lines show — the maths and the picture are the
// same object. The travelling parameter t sweeps 0 -> 1 -> 0 off the animation
// clock; reduced motion parks the bead at the curve's midpoint and shows the
// construction there, still, while dragging keeps working.

// A 160 x 100 field; points live in this space and the SVG scales to fit.
const W = 160
const H = 100
const PAD = 14

type Pt = { x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

// A pleasant default S-curve — the ends anchored low-left and high-right, the
// handles thrown out so it swings. Kept away from the padding so the labels sit.
const DEFAULT: Pt[] = [
  { x: PAD + 6, y: H - PAD - 6 },
  { x: 54, y: 12 },
  { x: 104, y: H - 12 },
  { x: W - PAD - 6, y: PAD + 6 },
]

const HANDLE_LABELS = ['P0', 'P1', 'P2', 'P3']

export function Bezier({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [pts, setPts] = useState<Pt[]>(DEFAULT)
  const [drag, setDrag] = useState<number | null>(null)
  // The travelling parameter. Reduced motion parks it at the midpoint.
  const [t, setT] = useState(reduce ? 0.5 : 0)

  // Sweep t as a 0 -> 1 -> 0 triangle wave, ~3.6s per full there-and-back, off
  // the elapsed animation clock so it never reads Date.now. Paused while a
  // handle is held (so the construction holds still where you are reading it),
  // and skipped entirely under reduced motion.
  useAnimationFrame((elapsed) => {
    if (reduce || drag !== null) return
    const phase = (elapsed / 1800) % 2 // 0..2
    setT(phase <= 1 ? phase : 2 - phase)
  })

  // Map a pointer event into the 160 x 100 field, honouring the SVG's rendered
  // size and aspect (preserveAspectRatio defaults to meet/centre).
  const toField = useCallback((e: ReactPointerEvent): Pt => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    const scale = Math.min(r.width / W, r.height / H)
    const offX = (r.width - W * scale) / 2
    const offY = (r.height - H * scale) / 2
    return {
      x: clamp((e.clientX - r.left - offX) / scale, PAD, W - PAD),
      y: clamp((e.clientY - r.top - offY) / scale, PAD, H - PAD),
    }
  }, [])

  const onDown = (i: number) => (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(i)
    const p = toField(e)
    setPts((prev) => prev.map((q, k) => (k === i ? p : q)))
  }
  const onMove = (e: ReactPointerEvent) => {
    if (drag === null) return
    const p = toField(e)
    setPts((prev) => prev.map((q, k) => (k === drag ? p : q)))
  }
  const onUp = () => setDrag(null)

  // De Casteljau at t: three first-level points on the control legs, two on the
  // level above, and the single curve point where they meet. This IS the curve.
  const [p0, p1, p2, p3] = pts
  const a = lerp(p0, p1, t)
  const b = lerp(p1, p2, t)
  const c = lerp(p2, p3, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  const pt = lerp(d, e, t)

  const curve = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`
  const hull = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`

  const summary =
    `Interactive cubic Bézier curve with four draggable control points. A bead ` +
    `at parameter t = ${t.toFixed(2)} shows the de Casteljau construction that ` +
    `traces the curve.`

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`h-full w-full touch-none select-none ${className}`}
      role="img"
      aria-label={summary}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      <defs>
        <linearGradient id={`${uid}-c`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(220,248,124,0.35)" />
          <stop offset="100%" stopColor="rgba(220,248,124,1)" />
        </linearGradient>
      </defs>

      {/* Control polygon — the raw legs the curve is bent from. */}
      <path
        d={hull}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={0.6}
        strokeDasharray="2 2.5"
        strokeLinejoin="round"
      />

      {/* The full curve, faint underneath. */}
      <path d={curve} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
      {/* The portion already drawn, up to t — lime, growing as the bead travels.
          pathLength 1 lets the dash express the fraction directly. */}
      <path
        d={curve}
        fill="none"
        stroke={`url(#${uid}-c)`}
        strokeWidth={1.8}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${clamp(t, 0.0001, 1)} 1`}
      />

      {/* First-level construction legs (a-b, b-c) and their points. */}
      <path
        d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y}`}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={0.7}
        strokeLinejoin="round"
      />
      {[a, b, c].map((q, i) => (
        <circle key={`l1-${i}`} cx={q.x} cy={q.y} r={1.4} fill="rgba(255,255,255,0.7)" />
      ))}

      {/* Second-level leg (d-e) and points — one step from the curve. */}
      <path
        d={`M ${d.x} ${d.y} L ${e.x} ${e.y}`}
        fill="none"
        stroke="rgba(220,248,124,0.6)"
        strokeWidth={0.8}
      />
      {[d, e].map((q, i) => (
        <circle key={`l2-${i}`} cx={q.x} cy={q.y} r={1.5} fill="rgba(220,248,124,0.9)" />
      ))}

      {/* The travelling point — where the two levels collapse onto the curve. */}
      <circle cx={pt.x} cy={pt.y} r={4} fill="rgba(220,248,124,0.18)" />
      <circle cx={pt.x} cy={pt.y} r={2.1} fill="#DCF87C" />

      {/* Draggable control handles, drawn last so they sit on top. */}
      {pts.map((q, i) => {
        const active = drag === i
        return (
          <g key={`h-${i}`}>
            <circle
              cx={q.x}
              cy={q.y}
              r={active ? 4.4 : 3.4}
              fill="#0a0a0a"
              stroke="#DCF87C"
              strokeWidth={1.2}
              className="cursor-grab transition-[r] active:cursor-grabbing"
              style={{ touchAction: 'none' }}
              onPointerDown={onDown(i)}
            />
            <text
              x={q.x}
              y={q.y - 6}
              textAnchor="middle"
              className="pointer-events-none fill-white/45 text-[4px] font-semibold uppercase tracking-wider"
            >
              {HANDLE_LABELS[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default Bezier
