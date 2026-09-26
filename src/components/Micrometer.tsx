import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A metric micrometer (screw gauge), the controls family's finest measuring
// instrument. Where the vernier caliper reads to a tenth of a millimetre by an
// aligned division, the micrometer reads to a hundredth by a precision screw:
// the thimble turns on a thread of PITCH 0.5 mm, so one full revolution advances
// the spindle exactly half a millimetre, and the thimble's rim is divided into
// 50 parts — each one a hundredth of a millimetre. Everything below lives in
// millimetre space and is multiplied by PPMM only when drawn, so the arithmetic
// and the picture are the same object, exactly as the caliper.
const PPMM = 18 // pixels per millimetre when drawn at the base viewBox size
const MAX_MM = 25 // a 0–25 mm micrometer, the standard first size
const PITCH_HUND = 50 // hundredths of a mm the spindle advances per thimble turn (0.5 mm)

// The reading is a whole number of hundredths of a millimetre — no float drift,
// and the sleeve and thimble readings therefore always sum to it exactly.
const MAX_HUND = MAX_MM * 100
const START_HUND = 763 // opens reading 7.63 mm, a number with a real fractional part

// Geometry, all in the drawn (px) coordinate space of the SVG.
const BARREL_LEFT = 46 // shared origin: anvil face, sleeve zero, and thimble-at-zero edge
const DATUM_Y = 132 // the sleeve's horizontal reading line, which the thimble scale is read against
const ANVIL_TOP = 26
const ANVIL_BASE = 70
const WORK_MID = (ANVIL_TOP + ANVIL_BASE) / 2
const DIV_H = 9 // vertical spacing of the thimble's rim divisions at the datum window
const THIMBLE_W = 96 // how far the thimble body extends right of its leading edge
const VIEW_W = MAX_MM * PPMM + BARREL_LEFT + THIMBLE_W + 8
const VIEW_H = 172

const mmToX = (mm: number) => BARREL_LEFT + mm * PPMM

/**
 * A metric micrometer rebuilt as a working instrument rather than a picture of
 * one. Drag the thimble along the sleeve — or focus it and tick with the arrow
 * keys — and the spindle closes onto a workpiece whose width is the reading. The
 * reading is taken the way the tool is actually read, and the two halves are on
 * screen at once: the whole-and-half millimetres come from the last sleeve
 * graduation the thimble's edge has uncovered, and the hundredths come from the
 * one thimble-rim division sitting on the sleeve's datum line — that division is
 * lit lime, and the sleeve graduation it belongs to is lit to match, so the
 * "sleeve + thimble" of a micrometer reading is a thing you can see rather than a
 * rule you are told.
 *
 * The mechanism is the screw: the thimble turns on a 0.5 mm-pitch thread, so a
 * full turn advances the spindle exactly half a millimetre and the 50-division
 * rim resolves that half-millimetre to a hundredth. The whole state is one
 * integer count of hundredths, so `sleeveHundredths + thimbleDivision` is always
 * exactly the reading. A real role=slider — arrow keys nudge a hundredth, Shift a
 * tenth, PageUp/Down a full turn, Home closes it, End opens it to the limit — with
 * a live region reading the measurement. The thimble tracks the pointer one to
 * one (a tool you are turning should not feel elastic); only a keyboard nudge
 * eases, and under prefers-reduced-motion even that cuts straight to the value.
 */
export function Micrometer({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [hund, setHund] = useState(START_HUND)
  const svgRef = useRef<SVGSVGElement>(null)
  // The thimble tracks the finger one-to-one while dragging; a keyboard nudge or
  // a Home/End jump eases on a spring. This ref flips the transition per source.
  const dragging = useRef(false)
  const [, force] = useState(0)

  const mm = hund / 100
  // The sleeve reading is the last whole-or-half graduation the thimble uncovered;
  // the thimble reading is the rim division sitting on the datum line. They sum to
  // the whole reading because floor(hund/50)*50 + (hund % 50) === hund.
  const sleeveHund = Math.floor(hund / PITCH_HUND) * PITCH_HUND
  const sleeveMm = sleeveHund / 100
  const thimbleDiv = hund % PITCH_HUND // 0..49, the lit division on the rim

  const setFromClientX = useCallback((clientX: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scale = rect.width / VIEW_W
    const localX = (clientX - rect.left) / scale
    const rawMm = (localX - BARREL_LEFT) / PPMM
    const next = Math.round(rawMm * 100)
    setHund(Math.max(0, Math.min(MAX_HUND, next)))
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
    // A hundredth per arrow, a tenth with Shift, a full turn on PageUp/Down;
    // Home closes the spindle, End opens it to the limit.
    const clamp = (n: number) => Math.max(0, Math.min(MAX_HUND, n))
    const step = e.shiftKey ? 10 : 1
    let apply: (prev: number) => number
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') apply = (p) => clamp(p + step)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') apply = (p) => clamp(p - step)
    else if (e.key === 'PageUp') apply = (p) => clamp(p + PITCH_HUND)
    else if (e.key === 'PageDown') apply = (p) => clamp(p - PITCH_HUND)
    else if (e.key === 'Home') apply = () => 0
    else if (e.key === 'End') apply = () => MAX_HUND
    else return
    e.preventDefault()
    dragging.current = false // keyboard changes ease on the spring
    setHund(apply)
  }, [])

  const springy = !dragging.current && !reduce

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Reading */}
      <div className="flex items-end gap-3">
        <span className="font-display text-5xl font-bold tabular-nums text-[#DCF87C]">
          {mm.toFixed(2)}
        </span>
        <span className="pb-1.5 text-lg font-medium text-white/50">mm</span>
      </div>
      <p className="mt-1 text-sm text-white/45" aria-hidden="true">
        <span className="tabular-nums text-white/70">{sleeveMm.toFixed(1)}</span> mm on the sleeve
        <span className="px-1.5 text-white/30">+</span>
        <span className="tabular-nums text-white/70">
          0.{thimbleDiv.toString().padStart(2, '0')}
        </span>{' '}
        from the thimble
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
        aria-valuetext={`${mm.toFixed(2)} millimetres`}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="mt-5 w-full max-w-[560px] touch-none select-none outline-none [&:focus-visible_.mic-thimble]:stroke-[#DCF87C]/60"
        style={{ cursor: dragging.current ? 'grabbing' : 'ew-resize' }}
      >
        <title id={labelId}>
          Micrometer reading {mm.toFixed(2)} millimetres. Drag the thimble or use the arrow keys to
          open and close the spindle.
        </title>

        {/* The frame, the anvil, and the workpiece the spindle closes onto — its
            width is the reading, so the measurement is something you watch the
            spindle come down on. */}
        <Frame />
        <Workpiece jawX={mmToX(mm)} />

        {/* The fixed sleeve and its datum line, with the whole/half-mm scale. The
            graduation the thimble edge has just uncovered (the sleeve reading) is
            lit lime to match the lit thimble division. */}
        <Sleeve edgeMm={mm} litHund={sleeveHund} />

        {/* The spindle + thimble are one rigid moving piece, exactly as on the real
            tool: the spindle face rests on the workpiece and the thimble edge is
            the sleeve index. It translates by the reading; drag is 1:1, keyboard
            eases. Drawn at the origin (reading 0) and shifted. */}
        <motion.g
          animate={{ x: mm * PPMM }}
          transition={
            springy ? { type: 'spring', stiffness: 480, damping: 36, mass: 0.7 } : { duration: 0 }
          }
        >
          <SpindleAndThimble thimbleDiv={thimbleDiv} />
        </motion.g>
      </svg>

      {/* Controls + live reading */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            dragging.current = false
            setHund(0)
          }}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
        >
          Close spindle
        </button>
        <span aria-live="polite" className="sr-only">
          {mm.toFixed(2)} millimetres
        </span>
        <span className="text-sm text-white/40" aria-hidden="true">
          {thimbleDiv === 0 ? 'Rim zero on the datum' : `Rim ${thimbleDiv} on the datum`}
        </span>
      </div>
    </div>
  )
}

// The C-frame and anvil the whole tool hangs off. The anvil face sits at the
// shared origin (reading 0); the spindle closes onto the workpiece from the right.
function Frame() {
  const x = BARREL_LEFT
  return (
    <g>
      {/* The C-frame arc, sweeping down and under to the anvil. */}
      <path
        d={`M ${x} ${ANVIL_TOP - 6}
            C ${x - 30} ${ANVIL_TOP - 6}, ${x - 34} ${ANVIL_BASE + 44}, ${x} ${ANVIL_BASE + 44}
            L ${x} ${ANVIL_BASE + 34}
            C ${x - 20} ${ANVIL_BASE + 34}, ${x - 18} ${ANVIL_TOP + 4}, ${x} ${ANVIL_TOP + 4} Z`}
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={1}
      />
      {/* The anvil: the fixed face the workpiece rests against. */}
      <rect
        x={x - 6}
        y={ANVIL_TOP}
        width={7}
        height={ANVIL_BASE - ANVIL_TOP}
        rx={1.5}
        fill="rgba(255,255,255,0.16)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1}
      />
    </g>
  )
}

// The workpiece gripped between anvil and spindle: a rounded rod whose width is
// the reading, so the measurement is something you can see the tool close around.
function Workpiece({ jawX }: { jawX: number }) {
  const width = Math.max(0, jawX - BARREL_LEFT)
  if (width < 1) return null
  const h = 26
  return (
    <rect
      x={BARREL_LEFT}
      y={WORK_MID - h / 2}
      width={width}
      height={h}
      rx={Math.min(h / 2, width / 2)}
      fill="rgba(220,248,124,0.14)"
      stroke="rgba(220,248,124,0.4)"
      strokeWidth={1}
    />
  )
}

// The fixed sleeve (barrel): the body the spindle threads through, its datum line
// running the length of it, whole millimetres ticked above the line and the
// half-millimetres below (the pitch of one thimble turn). `litHund` is the sleeve
// reading — the last graduation the thimble uncovered — drawn lime to match the
// lit thimble division.
function Sleeve({ edgeMm, litHund }: { edgeMm: number; litHund: number }) {
  const ticks = []
  // Whole-millimetre graduations above the datum line, numbered every five.
  for (let i = 0; i <= MAX_MM; i += 1) {
    const x = mmToX(i)
    const major = i % 5 === 0
    const lit = i * 100 === litHund
    ticks.push(
      <line
        key={`w${i}`}
        x1={x}
        x2={x}
        y1={DATUM_Y}
        y2={DATUM_Y - (major ? 18 : 11)}
        stroke={lit ? '#DCF87C' : major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)'}
        strokeWidth={lit ? 2 : major ? 1.4 : 1}
      />,
    )
    if (major) {
      ticks.push(
        <text
          key={`t${i}`}
          x={x}
          y={DATUM_Y - 22}
          textAnchor="middle"
          className={lit ? 'fill-[#DCF87C]' : 'fill-white/55'}
          style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums' }}
        >
          {i}
        </text>,
      )
    }
  }
  // Half-millimetre graduations below the datum line, offset half a step.
  for (let i = 0; i < MAX_MM; i += 1) {
    const x = mmToX(i + 0.5)
    const lit = i * 100 + 50 === litHund
    ticks.push(
      <line
        key={`h${i}`}
        x1={x}
        x2={x}
        y1={DATUM_Y}
        y2={DATUM_Y + 10}
        stroke={lit ? '#DCF87C' : 'rgba(255,255,255,0.3)'}
        strokeWidth={lit ? 2 : 1}
      />,
    )
  }
  return (
    <g>
      {/* The sleeve body. */}
      <rect
        x={BARREL_LEFT - 6}
        y={DATUM_Y - 30}
        width={MAX_MM * PPMM + 12}
        height={60}
        rx={4}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.1)"
      />
      {/* The datum (reading) line the thimble rim is read against. */}
      <line
        x1={BARREL_LEFT - 4}
        x2={mmToX(edgeMm)}
        y1={DATUM_Y}
        y2={DATUM_Y}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1}
      />
      {ticks}
    </g>
  )
}

// The moving assembly, drawn at the origin (reading 0); the parent <g> shifts it
// by the measurement. Its left edge is the sleeve index; its rim carries the
// 50-division hundredths scale, read against the sleeve's datum line. The one
// division on the datum (`thimbleDiv`) is lit lime — the sleeve graduation it
// belongs to is lit to match by Sleeve above.
function SpindleAndThimble({ thimbleDiv }: { thimbleDiv: number }) {
  const edge = BARREL_LEFT
  const marks = []
  // A window of rim divisions around the datum, so the scale reads like a drum
  // turning past the line. The division on the datum is lit and labelled; every
  // fifth division is labelled. Values wrap 0..49 as the thimble turns.
  for (let d = -3; d <= 3; d += 1) {
    const value = ((thimbleDiv + d) % PITCH_HUND + PITCH_HUND) % PITCH_HUND
    const y = DATUM_Y - d * DIV_H
    const lit = d === 0
    const labelled = lit || value % 5 === 0
    marks.push(
      <line
        key={`m${d}`}
        x1={edge + 6}
        x2={edge + (labelled ? 20 : 14)}
        y1={y}
        y2={y}
        stroke={lit ? '#DCF87C' : 'rgba(255,255,255,0.5)'}
        strokeWidth={lit ? 2 : 1}
      />,
    )
    if (labelled) {
      marks.push(
        <text
          key={`ml${d}`}
          x={edge + 24}
          y={y + 3}
          className={lit ? 'fill-[#DCF87C]' : 'fill-white/50'}
          style={{ fontSize: 8, fontVariantNumeric: 'tabular-nums' }}
        >
          {value.toString().padStart(2, '0')}
        </text>,
      )
    }
  }
  return (
    <g className="mic-thimble">
      {/* The spindle: the polished screw running from the sleeve out to the anvil,
          its face on the workpiece at the reading. */}
      <rect
        x={edge - 4}
        y={WORK_MID - 5}
        width={10}
        height={10}
        rx={2}
        fill="rgba(255,255,255,0.2)"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth={1}
      />
      <line
        x1={edge}
        x2={edge}
        y1={WORK_MID}
        y2={DATUM_Y - 30}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={2}
      />

      {/* The thimble body, extending right of the leading edge, with knurling. */}
      <rect
        x={edge}
        y={DATUM_Y - 30}
        width={THIMBLE_W}
        height={60}
        rx={5}
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.2)"
      />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <line
          key={`k${k}`}
          x1={edge + 34 + k * 10}
          x2={edge + 34 + k * 10}
          y1={DATUM_Y - 24}
          y2={DATUM_Y + 24}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={2}
        />
      ))}
      {/* The bevelled leading edge that carries the rim scale. */}
      <line
        x1={edge}
        x2={edge}
        y1={DATUM_Y - 30}
        y2={DATUM_Y + 30}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1.5}
      />
      {marks}
    </g>
  )
}

export default Micrometer
