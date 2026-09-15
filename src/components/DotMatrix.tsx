import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// DotMatrix — a dot-matrix LED sign, the kind that hangs over a train platform
// or a stadium tunnel. Text is not set in a font here: it is *lit*, one round
// LED at a time, on a fixed grid of dim dots, and it scrolls the authentic way
// a real sign does — one whole dot-column at a time, never a sub-pixel slide.
// That stepped travel is the whole tell; a smooth DOM marquee reads as text
// sliding, this reads as lamps turning on and off, which is a different thing.
//
// Distinct on purpose from the neighbours: SplitFlap is a mechanical Solari
// board, LetterGlitch scrambles glyphs, Marquee and ScrollVelocity translate
// real DOM nodes. None of them render type as a physical bitmap of lamps. The
// character set is a hand-authored 5x7 pixel font (uppercase, digits, and the
// punctuation a sign actually needs) — no web font, no library — so every glyph
// is literally addressed dot by dot.
//
// Built on one canvas and a single requestAnimationFrame loop, and cheap with
// it: the frame only repaints when the column offset actually advances, so a
// slow, readable sign costs a handful of paints a second, not sixty. The grid
// rebuilds on resize via ResizeObserver, device-pixel-ratio is clamped, and the
// canvas is aria-hidden while the live message rides in an aria-label on the
// wrapper — so a screen reader hears the words, not the lamps. Under reduced
// motion there is no loop and no scroll: the sign lights the message from its
// first column and holds it, a still photograph of the board.

/** A 5-wide, 7-tall glyph, seven rows of five "1"/"0" cells (top row first). */
type Glyph = readonly [string, string, string, string, string, string, string]

// The font. Uppercase only (LED boards are), lowercase folds to it. Everything
// unmapped falls back to a blank cell, so unknown input never throws.
const FONT: Record<string, Glyph> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  "'": ['00100', '00100', '00100', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '00110', '00110', '00000', '00110', '00110', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '·': ['00000', '00000', '00000', '00110', '00110', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
}

const ROWS = 7
const GLYPH_W = 5
/** Blank columns between two characters. */
const CHAR_GAP = 1
/** Blank columns after the whole message, before it loops back in. */
const LOOP_GAP = 4

/** Turn a string into a flat list of dot-columns, each a 7-tall on/off array. */
function buildColumns(text: string): boolean[][] {
  const cols: boolean[][] = []
  const chars = Array.from(text.toUpperCase())
  chars.forEach((ch, i) => {
    const g = FONT[ch] ?? FONT[' ']
    for (let c = 0; c < GLYPH_W; c++) {
      const col: boolean[] = []
      for (let r = 0; r < ROWS; r++) col.push(g[r][c] === '1')
      cols.push(col)
    }
    if (i < chars.length - 1) for (let s = 0; s < CHAR_GAP; s++) cols.push(new Array(ROWS).fill(false))
  })
  for (let s = 0; s < LOOP_GAP; s++) cols.push(new Array(ROWS).fill(false))
  return cols
}

export function DotMatrix({
  text,
  className = '',
  /** Size of one LED cell, in CSS pixels. The dot is drawn a little smaller. */
  cell = 10,
  /** Lit columns advanced per second. Higher reads faster. */
  speed = 22,
  /** The lamp colour when lit. */
  color = '#DCF87C',
}: {
  text: string
  className?: string
  cell?: number
  speed?: number
  color?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const strip = buildColumns(text || ' ')
    const stripLen = strip.length
    const radius = Math.max(1.5, cell * 0.36)

    let w = 0
    let h = 0
    let gridCols = 0
    let offX = 0
    let offY = 0
    let raf = 0
    let last = 0
    let acc = 0
    let colOffset = 0
    let drawnAt = -1
    let dirty = true

    function measure() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      gridCols = Math.max(1, Math.floor(w / cell))
      // Centre the fixed grid inside the box, both axes.
      offX = (w - gridCols * cell) / 2 + cell / 2
      offY = (h - ROWS * cell) / 2 + cell / 2
      dirty = true
    }

    function dot(cx: number, cy: number, lit: boolean) {
      ctx!.beginPath()
      ctx!.arc(cx, cy, radius, 0, Math.PI * 2)
      if (lit) {
        ctx!.fillStyle = color
        ctx!.shadowColor = color
        ctx!.shadowBlur = reduce ? 0 : radius * 1.6
      } else {
        ctx!.fillStyle = 'rgba(255,255,255,0.06)'
        ctx!.shadowBlur = 0
      }
      ctx!.fill()
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h)
      // The board reads left-aligned from column `colOffset`; under reduced
      // motion colOffset stays 0, so the message simply sits from the start.
      for (let c = 0; c < gridCols; c++) {
        const src = strip[(colOffset + c) % stripLen]
        const cx = offX + c * cell
        for (let r = 0; r < ROWS; r++) {
          dot(cx, offY + r * cell, src[r])
        }
      }
      ctx!.shadowBlur = 0
      drawnAt = colOffset
    }

    // On resize we re-measure (which resizes and so clears the canvas); when the
    // loop is running its next frame repaints, but under reduced motion there is
    // no loop, so measure-then-draw here keeps the still sign from blanking.
    const ro = new ResizeObserver(() => {
      measure()
      if (reduce) draw()
    })
    ro.observe(canvas)
    measure()

    if (reduce) {
      draw()
      return () => ro.disconnect()
    }

    const stepMs = 1000 / Math.max(1, speed)
    function frame(t: number) {
      if (!last) last = t
      const dt = Math.min(64, t - last)
      last = t
      acc += dt
      while (acc >= stepMs) {
        colOffset = (colOffset + 1) % stripLen
        acc -= stepMs
      }
      if (dirty || colOffset !== drawnAt) {
        draw()
        dirty = false
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [text, cell, speed, color, reduce])

  return (
    <div className={`relative w-full ${className}`} role="img" aria-label={text}>
      <canvas ref={ref} aria-hidden className="block h-full w-full" />
    </div>
  )
}
