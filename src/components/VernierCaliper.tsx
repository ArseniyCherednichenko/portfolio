import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A metric vernier caliper, in real millimetres. The main beam carries a fixed
// millimetre scale; the sliding jaw carries the vernier scale — ten divisions
// spanning nine millimetres, the classic 0.1 mm vernier. Everything below is in
// millimetre space and multiplied by PPMM only when it is drawn, so the maths
// and the picture are the same object.
const PPMM = 5.4 // pixels per millimetre when drawn at the base viewBox size
const SCALE_MM = 60 // length of the fixed main scale
const MAX_MM = 50 // furthest the jaws open; the vernier (9 mm long) stays on scale
const MARGIN_X = 26 // room at the left for the fixed jaw
const VERNIER_DIVS = 10 // ten vernier divisions …
const VERNIER_SPAN = 9 // … spanning nine main-scale millimetres (each 0.9 mm)

// A caliper reads to a tenth of a millimetre, so the whole state is one integer
// count of tenths — no floating-point drift, and exactly one vernier tick can
// ever coincide with a main-scale tick.
const MAX_TENTHS = MAX_MM * 10
const START_TENTHS = 247 // opens reading 24.7 mm, a number with a real fractional part

// Geometry, all in the drawn (px) coordinate space of the SVG.
const RAIL_LEFT = MARGIN_X
const COINCIDE_Y = 70 // the shared line where main ticks (above) meet vernier ticks (below)
const MAIN_LABEL_Y = 26
const JAW_TOP = 6
const JAW_BASE = 40 // the main beam's top edge / where the jaws hang from
const VERNIER_LABEL_Y = 112
const VIEW_W = SCALE_MM * PPMM + MARGIN_X * 2
const VIEW_H = 126

const mmToX = (mm: number) => RAIL_LEFT + mm * PPMM

/**
 * A metric vernier caliper rebuilt as a working instrument rather than a picture
 * of one. Drag the sliding jaw along the beam — or focus it and tick with the
 * arrow keys — and the jaws open around a workpiece whose width is the reading.
 * The reading is taken the way the tool is actually read: the whole millimetres
 * come from where the vernier's zero sits on the fixed scale, and the tenths
 * come from which of the ten vernier ticks lines up with a main-scale tick — the
 * one division out of ten that coincides is highlighted lime on both scales, so
 * the "aha" of the instrument is on screen and not just asserted.
 *
 * The vernier is ten divisions over nine millimetres, so each division is 0.9 mm
 * and steps 0.1 mm out of step with the main scale per tick; that 0.1 mm is the
 * resolution. The whole state is one integer count of tenths of a millimetre, so
 * the coincidence is always exact. It is a real role=slider — arrow keys nudge a
 * tenth, Shift a whole millimetre, Home closes it, End opens it to the limit —
 * and a live region reads the measurement. The jaw tracks the pointer one to one
 * (a tool you are sliding should not feel elastic); only a keyboard nudge eases,
 * and under prefers-reduced-motion even that cuts straight to the value.
 */
export function VernierCaliper({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [tenths, setTenths] = useState(START_TENTHS)
  const svgRef = useRef<SVGSVGElement>(null)
  // The jaw tracks the finger one-to-one while dragging; a keyboard nudge or a
  // Home/End jump eases on a spring. This ref flips the transition per source.
  const dragging = useRef(false)
  const [, force] = useState(0)

  const mm = tenths / 10
  const whole = Math.floor(tenths / 10)
  const tenth = tenths % 10 // the vernier division that coincides, 0..9

  const setFromClientX = useCallback((clientX: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scale = rect.width / VIEW_W
    const localX = (clientX - rect.left) / scale
    const rawMm = (localX - RAIL_LEFT) / PPMM
    const next = Math.round(rawMm * 10)
    setTenths(Math.max(0, Math.min(MAX_TENTHS, next)))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      dragging.current = true
      force((n) => n + 1)
      setFromClientX(e.clientX)
    },
    [setFromClientX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      setFromClientX(e.clientX)
    },
    [setFromClientX],
  )

  const endDrag = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    force((n) => n + 1)
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // A tenth per arrow, a whole millimetre with Shift; Home closes, End opens.
    const step = e.shiftKey ? 10 : 1
    const clamp = (n: number) => Math.max(0, Math.min(MAX_TENTHS, n))
    let apply: (prev: number) => number
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') apply = (p) => clamp(p + step)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') apply = (p) => clamp(p - step)
    else if (e.key === 'Home') apply = () => 0
    else if (e.key === 'End') apply = () => MAX_TENTHS
    else return
    e.preventDefault()
    dragging.current = false // keyboard changes ease on the spring
    setTenths(apply)
  }, [])

  const jawX = mmToX(mm)
  const springy = !dragging.current && !reduce

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Reading */}
      <div className="flex items-end gap-3">
        <span className="font-display text-5xl font-bold tabular-nums text-[#DCF87C]">
          {mm.toFixed(1)}
        </span>
        <span className="pb-1.5 text-lg font-medium text-white/50">mm</span>
      </div>
      <p className="mt-1 text-sm text-white/45" aria-hidden="true">
        <span className="tabular-nums text-white/70">{whole}</span> mm on the beam
        <span className="px-1.5 text-white/30">+</span>
        <span className="tabular-nums text-white/70">0.{tenth}</span> from the vernier
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={MAX_MM}
        aria-valuenow={mm}
        aria-valuetext={`${mm.toFixed(1)} millimetres`}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="mt-5 w-full max-w-[520px] touch-none select-none outline-none [&:focus-visible_.frame]:stroke-[#DCF87C]/60"
        style={{ cursor: dragging.current ? 'grabbing' : 'ew-resize' }}
      >
        <title id={labelId}>
          Vernier caliper reading {mm.toFixed(1)} millimetres. Drag the sliding jaw or use the
          arrow keys to open and close the jaws.
        </title>

        {/* Fixed jaw + the workpiece it holds. The lit main tick is the one the
            coinciding vernier division aligns with: whole millimetres + tenth. */}
        <MainScale coincide={whole + tenth} />
        <Workpiece jawX={jawX} />

        {/* The whole sliding assembly — the moving jaw and the vernier scale are
            one rigid piece, exactly as on the real tool. It translates by the
            measurement; drag is 1:1, keyboard eases. */}
        <motion.g
          className="frame"
          animate={{ x: mm * PPMM }}
          transition={springy ? { type: 'spring', stiffness: 480, damping: 36, mass: 0.7 } : { duration: 0 }}
        >
          <SlidingJaw tenth={tenth} />
        </motion.g>
      </svg>

      {/* Controls + live reading */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            dragging.current = false
            setTenths(0)
          }}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
        >
          Close jaws
        </button>
        <span aria-live="polite" className="sr-only">
          {mm.toFixed(1)} millimetres
        </span>
        <span className="text-sm text-white/40" aria-hidden="true">
          {tenth === 0 ? 'Vernier zero on a whole mark' : `Vernier ${tenth} coincides`}
        </span>
      </div>
    </div>
  )
}

// The fixed main scale: the beam and its millimetre ticks, numbered every 10.
// `coincide` is the tick the vernier currently lines up with — lit lime to match
// the vernier division opposite it.
function MainScale({ coincide }: { coincide: number }) {
  const ticks = []
  for (let i = 0; i <= SCALE_MM; i += 1) {
    const x = mmToX(i)
    const major = i % 10 === 0
    const mid = i % 5 === 0
    const len = major ? 22 : mid ? 15 : 9
    const lit = i === coincide
    ticks.push(
      <line
        key={i}
        x1={x}
        x2={x}
        y1={COINCIDE_Y}
        y2={COINCIDE_Y - len}
        stroke={lit ? '#DCF87C' : major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)'}
        strokeWidth={lit ? 2 : major ? 1.4 : 1}
      />,
    )
    if (major) {
      ticks.push(
        <text
          key={`t${i}`}
          x={x}
          y={MAIN_LABEL_Y}
          textAnchor="middle"
          className={lit ? 'fill-[#DCF87C]' : 'fill-white/55'}
          style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}
        >
          {i}
        </text>,
      )
    }
  }
  return (
    <g>
      {/* The beam body behind the scale. */}
      <rect
        x={RAIL_LEFT - 4}
        y={JAW_BASE}
        width={SCALE_MM * PPMM + 8}
        height={COINCIDE_Y - JAW_BASE}
        rx={3}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.1)"
      />
      {ticks}
      {/* The fixed jaw, rising off the left end of the beam. */}
      <path
        d={`M ${RAIL_LEFT} ${JAW_BASE} L ${RAIL_LEFT} ${JAW_TOP} L ${RAIL_LEFT - 12} ${JAW_TOP} L ${RAIL_LEFT - 12} ${JAW_BASE + 6} Z`}
        fill="rgba(255,255,255,0.1)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1}
      />
    </g>
  )
}

// The workpiece held between the jaws: a rounded rod whose width is the reading,
// so the measurement is something you can see the jaws close around.
function Workpiece({ jawX }: { jawX: number }) {
  const left = RAIL_LEFT
  const width = Math.max(0, jawX - left)
  if (width < 1) return null
  const midY = (JAW_TOP + JAW_BASE) / 2
  const h = 22
  return (
    <rect
      x={left}
      y={midY - h / 2}
      width={width}
      height={h}
      rx={Math.min(h / 2, width / 2)}
      fill="rgba(220,248,124,0.14)"
      stroke="rgba(220,248,124,0.4)"
      strokeWidth={1}
    />
  )
}

// The sliding assembly, drawn at the origin (reading 0). The parent <g> shifts
// it by the measurement. Its beak is the moving jaw; below the beam sits the
// vernier scale, whose coinciding division `tenth` is lit lime — the main-scale
// tick it aligns with (whole + tenth) is lit to match by MainScale above.
function SlidingJaw({ tenth }: { tenth: number }) {
  const ticks = []
  for (let k = 0; k <= VERNIER_DIVS; k += 1) {
    const x = mmToX((k * VERNIER_SPAN) / VERNIER_DIVS)
    const lit = k === tenth
    const major = k % 5 === 0
    ticks.push(
      <line
        key={k}
        x1={x}
        x2={x}
        y1={COINCIDE_Y}
        y2={COINCIDE_Y + (major ? 20 : 14)}
        stroke={lit ? '#DCF87C' : 'rgba(255,255,255,0.5)'}
        strokeWidth={lit ? 2 : 1}
      />,
    )
    if (k % 5 === 0) {
      ticks.push(
        <text
          key={`v${k}`}
          x={x}
          y={VERNIER_LABEL_Y}
          textAnchor="middle"
          className={lit ? 'fill-[#DCF87C]' : 'fill-white/50'}
          style={{ fontSize: 8, fontVariantNumeric: 'tabular-nums' }}
        >
          {k}
        </text>,
      )
    }
  }
  return (
    <g>
      {/* The plate the vernier is engraved on. */}
      <rect
        x={RAIL_LEFT - 6}
        y={COINCIDE_Y}
        width={VERNIER_SPAN * PPMM + 16}
        height={34}
        rx={3}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.16)"
      />
      {/* The moving jaw, hanging down onto the workpiece from the left of the plate. */}
      <path
        d={`M ${RAIL_LEFT} ${JAW_BASE} L ${RAIL_LEFT} ${JAW_TOP} L ${RAIL_LEFT + 12} ${JAW_TOP} L ${RAIL_LEFT + 12} ${JAW_BASE + 6} Z`}
        fill="rgba(255,255,255,0.14)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1}
      />
      {/* The thumb grip. */}
      <rect
        x={RAIL_LEFT + 2}
        y={COINCIDE_Y + 6}
        width={VERNIER_SPAN * PPMM - 4}
        height={4}
        rx={2}
        fill="rgba(255,255,255,0.2)"
      />
      {ticks}
    </g>
  )
}

export default VernierCaliper
