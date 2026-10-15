import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cellsFor, dotBit } from '../lib/braille'

// Braille — a refreshable braille display, the third machine in the digital-
// display thread and the one that does not use light at all. The dot-matrix
// sign is lamps switching on and off; the flip-dot board is discs turning over;
// a braille cell is *tactile* — six rounded pins driven up and down through
// holes in a plastic face, so a line of text is read by the fingertips, not the
// eyes. The honest signature here is that rise: when the text changes, pins
// that need to come up pop up with the small overshoot of a solenoid driving
// against its stop, pins that are no longer needed sink flush, and both happen
// cell by cell left to right, the way a real cell array refreshes a line.
//
// Encoded the honest way: the message runs through the shared Grade-1 braille
// encoder (`cellsFor`), so what the pins spell is standard English Braille —
// the capital and number prefix cells appear where a reader expects them, not
// an invented mapping. Drawn the house way: one canvas, one requestAnimationFrame
// loop, DPR-clamped, re-measured on resize. The board is static — it holds the
// whole line at once — so the loop exists only to animate a *change* and then
// stops; a line at rest costs nothing. The canvas is aria-hidden and the plain
// text rides in the wrapper's label, so a screen reader reads the words, which
// is the one audience a braille line and a screen reader share. Under reduced
// motion there is no rise: the pins are simply shown already up or already down.

/** Dots are numbered 1..6 in two columns of three; this is each dot's
 * (column, row) within a cell. */
const DOT_POS: Array<[number, number]> = [
  [0, 0], // 1
  [0, 1], // 2
  [0, 2], // 3
  [1, 0], // 4
  [1, 1], // 5
  [1, 2], // 6
]

/** Rise with a small overshoot, so a pin driven up lands with the faint bounce
 * of a solenoid hitting its stop. */
function easeOutBack(p: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const x = p - 1
  return 1 + c3 * x * x * x + c1 * x * x
}

/** Plain ease-out for a pin sinking back flush — no overshoot going down. */
function easeOut(p: number): number {
  return 1 - (1 - p) * (1 - p) * (1 - p)
}

export function Braille({
  text,
  className = '',
  /** Diameter of one pin/hole, in CSS pixels. */
  dot = 11,
  /** The raised pin's lit colour. */
  color = '#DCF87C',
  /** How long one pin takes to rise or sink, in milliseconds. */
  riseMs = 300,
  /** Delay added per cell left-to-right, in milliseconds — the refresh sweep. */
  stagger = 70,
}: {
  text: string
  className?: string
  dot?: number
  color?: string
  riseMs?: number
  stagger?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  // The last settled line, keyed by "cell:dot", kept across text changes so a
  // new line raises AND lowers pins from wherever they stood rather than
  // snapping the old ones flush. Empty on first mount, so the line rises from
  // a blank face.
  const prevRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cells = cellsFor(text)
    const n = Math.max(1, cells.length)

    // Geometry. Within a cell, dot centres sit on a square pitch; cells advance
    // by a wider gap so the two columns of a cell read as one unit.
    const pitch = dot * 1.7
    const cellGap = pitch * 1.4
    const cellAdvance = pitch + cellGap
    const padX = dot * 0.9
    const padY = dot * 0.9
    const headR = dot * 0.42
    const socketR = dot * 0.52
    const lift = dot * 0.2 // how far a raised pin stands proud of the face

    const wPx = padX * 2 + (n - 1) * cellAdvance + pitch
    const hPx = padY * 2 + 2 * pitch

    // Per-dot animation state, flat, indexed by cell * 6 + dotIndex.
    const count = n * 6
    const level = new Float64Array(count) // 0 flush .. 1 fully raised, at rest
    const fromLvl = new Float64Array(count)
    const toLvl = new Float64Array(count)
    const startAt = new Float64Array(count).fill(-1)

    function measure() {
      canvas!.style.width = `${wPx}px`
      canvas!.style.height = `${hPx}px`
      canvas!.width = Math.round(wPx * dpr)
      canvas!.height = Math.round(hPx * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function pin(cx: number, cy: number, lv: number) {
      // The socket: a dark recessed hole, always visible, so a flush pin still
      // reads as a hole in a physical face rather than empty space.
      ctx!.beginPath()
      ctx!.arc(cx, cy, socketR, 0, Math.PI * 2)
      ctx!.fillStyle = 'rgba(0,0,0,0.5)'
      ctx!.shadowBlur = 0
      ctx!.fill()
      ctx!.beginPath()
      ctx!.arc(cx, cy, socketR, Math.PI * 0.75, Math.PI * 1.75)
      ctx!.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx!.lineWidth = 1
      ctx!.stroke()

      const y = cy - lift * lv // the pin stands up out of the face as it rises

      // A soft contact shadow under a raised pin, pinning it above the surface.
      if (lv > 0.04 && !reduce) {
        ctx!.beginPath()
        ctx!.arc(cx, cy + headR * 0.3, headR * (0.7 + 0.2 * lv), 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(0,0,0,${0.3 * lv})`
        ctx!.shadowBlur = 0
        ctx!.fill()
      }

      // The pin head. Flush (lv 0) it is a dark dome barely above the socket;
      // raised it brightens to the lit colour and throws a little glow.
      const r = headR * (0.74 + 0.26 * lv)
      const mix = Math.max(0, Math.min(1, lv))
      ctx!.beginPath()
      ctx!.arc(cx, y, r, 0, Math.PI * 2)
      ctx!.fillStyle = mix > 0.5 ? color : `rgba(42,45,38,${0.9})`
      ctx!.shadowColor = color
      ctx!.shadowBlur = reduce ? 0 : r * 1.4 * mix
      ctx!.fill()
      ctx!.shadowBlur = 0

      // A fleck of highlight on the dome's upper-left, selling its roundness.
      if (mix > 0.1) {
        ctx!.beginPath()
        ctx!.arc(cx - r * 0.3, y - r * 0.32, r * 0.3, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(255,255,255,${0.35 * mix})`
        ctx!.fill()
      }
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, wPx, hPx)
      let active = false
      for (let c = 0; c < n; c++) {
        const col0 = padX + c * cellAdvance
        for (let d = 0; d < 6; d++) {
          const i = c * 6 + d
          const cx = col0 + DOT_POS[d][0] * pitch
          const cy = padY + DOT_POS[d][1] * pitch
          const t0 = startAt[i]
          if (t0 < 0) {
            pin(cx, cy, level[i])
            continue
          }
          if (now < t0) {
            pin(cx, cy, fromLvl[i])
            active = true
            continue
          }
          const p = (now - t0) / riseMs
          if (p >= 1) {
            level[i] = toLvl[i]
            startAt[i] = -1
            pin(cx, cy, toLvl[i])
            continue
          }
          active = true
          const rising = toLvl[i] > fromLvl[i]
          const eased = rising ? easeOutBack(p) : easeOut(p)
          pin(cx, cy, fromLvl[i] + (toLvl[i] - fromLvl[i]) * eased)
        }
      }
      return active
    }

    measure()

    const prev = prevRef.current
    const next = new Map<string, number>()
    for (let c = 0; c < n; c++) {
      const mask = cells[c] ?? 0
      for (let d = 0; d < 6; d++) next.set(`${c}:${d}`, mask & dotBit(d + 1) ? 1 : 0)
    }

    if (reduce) {
      for (let c = 0; c < n; c++) {
        const mask = cells[c] ?? 0
        for (let d = 0; d < 6; d++) level[c * 6 + d] = mask & dotBit(d + 1) ? 1 : 0
      }
      prevRef.current = next
      draw(0)
      return
    }

    // Schedule the line to refresh from the previous message to this one, cell
    // by cell. Pins already holding the right state sit still; the rest rise or
    // sink, staggered left-to-right so the change sweeps across like a real
    // cell array updating.
    const t0 = performance.now()
    for (let c = 0; c < n; c++) {
      const mask = cells[c] ?? 0
      for (let d = 0; d < 6; d++) {
        const i = c * 6 + d
        const want = mask & dotBit(d + 1) ? 1 : 0
        const was = prev.get(`${c}:${d}`) ?? 0
        level[i] = was
        fromLvl[i] = was
        toLvl[i] = want
        startAt[i] = was === want ? -1 : t0 + c * stagger
      }
    }
    prevRef.current = next

    let raf = 0
    function frame(now: number) {
      const active = draw(now)
      if (active) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => cancelAnimationFrame(raf)
  }, [text, dot, color, riseMs, stagger, reduce])

  return (
    <div className={`inline-flex ${className}`} role="img" aria-label={text}>
      <canvas ref={ref} aria-hidden className="block" />
    </div>
  )
}
