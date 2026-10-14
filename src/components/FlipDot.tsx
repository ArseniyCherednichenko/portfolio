import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { glyphFor, GLYPH_ROWS, GLYPH_COLS } from '../lib/font5x7'

// FlipDot — an electromechanical flip-dot (flip-disc) board, the kind that
// still rolls the next departure onto the front of a city bus. It renders the
// same 5x7 alphabet as the dot-matrix sign, but by a completely different
// machine, and that difference is the whole point of it.
//
// A dot-matrix LED sign (DotMatrix) is light: a lamp is on or it is off, and it
// "scrolls" by lighting a new column and dropping the old one — nothing moves.
// A flip-dot board is *mechanical*: every cell is a physical disc, matte black
// on one face and bright on the other, pivoting on a horizontal axle. A coil
// pulse flips it over to change the pixel, so repainting the board is a visible,
// clattering cascade of discs turning edge-on and landing on their other side,
// with the faint overshoot of a real hinge settling. Where the LED sign reads
// as signal, this reads as hardware doing work.
//
// Drawn the house way: one canvas, one requestAnimationFrame loop, DPR-clamped,
// re-measured on resize. The board is static (it shows the whole message at
// once, it does not travel), so the loop exists only to animate a *change*: when
// the text updates, each column of discs is scheduled to flip with a small
// left-to-right stagger, and the loop runs until the last disc has settled, then
// stops — a board at rest costs nothing. The canvas is aria-hidden and the live
// message rides in the wrapper's label, so a reader hears the words, not the
// discs. Under reduced motion there is no flipping: the board simply shows the
// message, every disc already landed on its final face.

const ROWS = GLYPH_ROWS
const GLYPH_W = GLYPH_COLS
/** Blank columns between two characters. */
const CHAR_GAP = 1

/** Turn a string into a flat list of columns, each a 7-tall on/off array. No
 * loop gap — a flip-dot board shows the whole message at once and holds it. */
function buildColumns(text: string): boolean[][] {
  const cols: boolean[][] = []
  const chars = Array.from((text || ' ').toUpperCase())
  chars.forEach((ch, i) => {
    const g = glyphFor(ch)
    for (let c = 0; c < GLYPH_W; c++) {
      const col: boolean[] = []
      for (let r = 0; r < ROWS; r++) col.push(g[r][c] === '1')
      cols.push(col)
    }
    if (i < chars.length - 1) for (let s = 0; s < CHAR_GAP; s++) cols.push(new Array(ROWS).fill(false))
  })
  return cols
}

/** Ease with a small overshoot past the end, so a flipped disc lands with the
 * faint bounce of a real hinge settling against its stop. */
function easeOutBack(p: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const x = p - 1
  return 1 + c3 * x * x * x + c1 * x * x
}

export function FlipDot({
  text,
  className = '',
  /** Size of one disc cell, in CSS pixels. The disc is drawn a little smaller. */
  cell = 15,
  /** The disc's bright (flipped-on) face colour. */
  color = '#DCF87C',
  /** How long one disc takes to flip over, in milliseconds. */
  flipMs = 260,
  /** Delay added per column left-to-right, in milliseconds — the cascade. */
  stagger = 26,
}: {
  text: string
  className?: string
  cell?: number
  color?: string
  flipMs?: number
  stagger?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  // The last landed board, keyed by "col:row", kept across text changes so a
  // new message flips discs both on AND off from wherever they were, rather
  // than snapping the off-going ones. Empty on first mount, so the board prints
  // in from all-black.
  const prevRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const strip = buildColumns(text)
    const cols = strip.length
    const count = cols * ROWS
    const radius = Math.max(2, cell * 0.4)
    const socket = Math.max(2.5, cell * 0.46)

    // Per-disc state, flat arrays indexed by col * ROWS + row.
    const shown = new Uint8Array(count) // the face currently landed and at rest
    const fromOn = new Uint8Array(count)
    const toOn = new Uint8Array(count)
    const startAt = new Float64Array(count).fill(-1) // flip start time, -1 = idle

    const wPx = cols * cell
    const hPx = ROWS * cell

    function measure() {
      canvas!.style.width = `${wPx}px`
      canvas!.style.height = `${hPx}px`
      canvas!.width = Math.round(wPx * dpr)
      canvas!.height = Math.round(hPx * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function disc(cx: number, cy: number, lit: boolean, scaleY: number) {
      // The socket: a dark recessed hole every cell sits in, so an off disc
      // still reads as a physical object rather than empty space.
      ctx!.beginPath()
      ctx!.arc(cx, cy, socket, 0, Math.PI * 2)
      ctx!.fillStyle = 'rgba(0,0,0,0.55)'
      ctx!.shadowBlur = 0
      ctx!.fill()

      const ry = Math.max(0.6, radius * scaleY)
      ctx!.save()
      ctx!.translate(cx, cy)
      ctx!.scale(1, ry / radius)
      ctx!.beginPath()
      ctx!.arc(0, 0, radius, 0, Math.PI * 2)
      if (lit) {
        ctx!.fillStyle = color
        ctx!.shadowColor = color
        ctx!.shadowBlur = reduce ? 0 : radius * 1.5 * scaleY
      } else {
        ctx!.fillStyle = '#2a2d26'
        ctx!.shadowBlur = 0
      }
      ctx!.fill()
      ctx!.restore()

      // A thin bright rim as the disc passes edge-on — the hinge catching light.
      if (scaleY < 0.22) {
        ctx!.beginPath()
        ctx!.moveTo(cx - radius, cy)
        ctx!.lineTo(cx + radius, cy)
        ctx!.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx!.lineWidth = 1
        ctx!.shadowBlur = 0
        ctx!.stroke()
      }
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, wPx, hPx)
      let active = false
      for (let c = 0; c < cols; c++) {
        const cx = c * cell + cell / 2
        for (let r = 0; r < ROWS; r++) {
          const i = c * ROWS + r
          const cy = r * cell + cell / 2
          const t0 = startAt[i]
          if (t0 < 0) {
            disc(cx, cy, shown[i] === 1, 1)
            continue
          }
          if (now < t0) {
            // Scheduled but not yet started: still resting on its old face.
            disc(cx, cy, fromOn[i] === 1, 1)
            active = true
            continue
          }
          const p = (now - t0) / flipMs
          if (p >= 1) {
            shown[i] = toOn[i]
            startAt[i] = -1
            disc(cx, cy, toOn[i] === 1, 1)
            continue
          }
          active = true
          // Half a turn, with overshoot: the disc goes edge-on at the midpoint
          // and the new face is showing from there on.
          const angle = easeOutBack(p) * Math.PI
          const scaleY = Math.abs(Math.cos(angle))
          const lit = p < 0.5 ? fromOn[i] === 1 : toOn[i] === 1
          disc(cx, cy, lit, scaleY)
        }
      }
      ctx!.shadowBlur = 0
      return active
    }

    measure()

    const prev = prevRef.current
    const next = new Map<string, number>()
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < ROWS; r++) next.set(`${c}:${r}`, strip[c][r] ? 1 : 0)

    if (reduce) {
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < ROWS; r++) shown[c * ROWS + r] = strip[c][r] ? 1 : 0
      prevRef.current = next
      draw(0)
      return
    }

    // Schedule the board to flip from the previous message to this one, column
    // by column, so a change rolls across like a real board turning its discs.
    // Discs that already hold the right face sit still; the rest flip, both on
    // and off, staggered left-to-right with a little row jitter.
    const t0 = performance.now()
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < ROWS; r++) {
        const i = c * ROWS + r
        const want = strip[c][r] ? 1 : 0
        const was = prev.get(`${c}:${r}`) ?? 0
        shown[i] = was
        fromOn[i] = was
        toOn[i] = want
        startAt[i] = was === want ? -1 : t0 + c * stagger + (r % 2) * 18
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
  }, [text, cell, color, flipMs, stagger, reduce])

  return (
    <div className={`inline-flex ${className}`} role="img" aria-label={text}>
      <canvas ref={ref} aria-hidden className="block" />
    </div>
  )
}
