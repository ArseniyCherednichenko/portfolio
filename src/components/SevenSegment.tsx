import { useId } from 'react'
import { useReducedMotion } from 'framer-motion'

// SevenSegment — the classic seven-segment digital readout: the beveled bars of
// a calculator, an alarm clock, a microwave, a petrol pump. What makes it read
// as *this* thing and not just "digits" is the two details a lazy version drops:
// the segments are stubby parallelograms with a mitred gap between them (never a
// clean font stroke), and the unlit segments are still faintly *there* — the
// ghost of the whole figure-eight sitting behind every character, so a 1 shows
// you the seven bars it is choosing not to light. That ghost is the tell of a
// real LED/LCD module.
//
// Deliberately distinct from its display-family neighbours. Odometer rolls
// mechanical number wheels; SplitFlap drops Solari flaps; DotMatrix lights a
// bitmap of round lamps. This lights seven fixed bars per cell and nothing else,
// which is exactly why it can only *almost* spell — it renders digits perfectly,
// a colon and a decimal point properly, and the lopsided subset of letters the
// format can actually manage (the "hELLO" / "0FF" / hex look), unknown glyphs
// falling dark rather than faked.
//
// Pure inline SVG, no canvas and no font: every segment is a hand-computed
// polygon, so it stays crisp at any size and both themes. When a cell's value
// changes, its segments cross-fade — a lit bar easing on, a dropped one easing
// off — which is the little tick that makes a running clock or counter feel
// alive without any layout thrash. Under reduced motion the cross-fade is off
// and values simply cut. The figure is aria-hidden; the string rides in an
// aria-label on the wrapper, so a screen reader hears "12:04", not seven bars.

/** Which of the seven bars (a b c d e f g) are lit for a given character.
 *
 *      aaa
 *     f   b
 *     f   b
 *      ggg
 *     e   c
 *     e   c
 *      ddd
 */
type Seg = { a?: 1; b?: 1; c?: 1; d?: 1; e?: 1; f?: 1; g?: 1 }

// The glyphs a seven-segment module can honestly show. Digits are exact; the
// letters are the conventional seven-segment spellings (some borrow a lowercase
// shape because the uppercase is impossible — b, d, h, n, r, t, u). Anything not
// in here renders as an all-dark cell rather than a lie.
const GLYPHS: Record<string, Seg> = {
  '0': { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 },
  '1': { b: 1, c: 1 },
  '2': { a: 1, b: 1, g: 1, e: 1, d: 1 },
  '3': { a: 1, b: 1, g: 1, c: 1, d: 1 },
  '4': { f: 1, g: 1, b: 1, c: 1 },
  '5': { a: 1, f: 1, g: 1, c: 1, d: 1 },
  '6': { a: 1, f: 1, g: 1, e: 1, c: 1, d: 1 },
  '7': { a: 1, b: 1, c: 1 },
  '8': { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
  '9': { a: 1, b: 1, c: 1, d: 1, f: 1, g: 1 },
  A: { a: 1, b: 1, c: 1, e: 1, f: 1, g: 1 },
  b: { c: 1, d: 1, e: 1, f: 1, g: 1 },
  C: { a: 1, d: 1, e: 1, f: 1 },
  c: { d: 1, e: 1, g: 1 },
  d: { b: 1, c: 1, d: 1, e: 1, g: 1 },
  E: { a: 1, d: 1, e: 1, f: 1, g: 1 },
  F: { a: 1, e: 1, f: 1, g: 1 },
  G: { a: 1, c: 1, d: 1, e: 1, f: 1 },
  H: { b: 1, c: 1, e: 1, f: 1, g: 1 },
  h: { c: 1, e: 1, f: 1, g: 1 },
  I: { e: 1, f: 1 },
  J: { b: 1, c: 1, d: 1, e: 1 },
  L: { d: 1, e: 1, f: 1 },
  n: { c: 1, e: 1, g: 1 },
  O: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 },
  o: { c: 1, d: 1, e: 1, g: 1 },
  P: { a: 1, b: 1, e: 1, f: 1, g: 1 },
  r: { e: 1, g: 1 },
  S: { a: 1, f: 1, g: 1, c: 1, d: 1 },
  t: { d: 1, e: 1, f: 1, g: 1 },
  U: { b: 1, c: 1, d: 1, e: 1, f: 1 },
  u: { c: 1, d: 1, e: 1 },
  Y: { b: 1, c: 1, d: 1, f: 1, g: 1 },
  '-': { g: 1 },
  '_': { d: 1 },
  '=': { d: 1, g: 1 },
  '°': { a: 1, b: 1, f: 1, g: 1 },
  ' ': {},
}

// Digit geometry, in a 0..W by 0..H viewBox. The segment is a stubby hexagon:
// a rectangle of thickness T with the two ends mitred to a point, so touching
// segments meet in a clean diagonal seam like the real thing.
const W = 62
const H = 104
const T = 12 // bar thickness
const HALF = T / 2
const M = 8 // inset from the cell edges
const GAP = 2.5 // gap where two segments would otherwise touch

function hbar(y: number): string {
  const x0 = M + GAP
  const x1 = W - M - GAP
  return [
    [x0, y],
    [x0 + HALF, y - HALF],
    [x1 - HALF, y - HALF],
    [x1, y],
    [x1 - HALF, y + HALF],
    [x0 + HALF, y + HALF],
  ]
    .map((p) => p.join(','))
    .join(' ')
}

function vbar(x: number, y0: number, y1: number): string {
  return [
    [x, y0],
    [x + HALF, y0 + HALF],
    [x + HALF, y1 - HALF],
    [x, y1],
    [x - HALF, y1 - HALF],
    [x - HALF, y0 + HALF],
  ]
    .map((p) => p.join(','))
    .join(' ')
}

const TOP = M
const MID = H / 2
const BOT = H - M
const SEGMENTS: { key: keyof Seg; points: string }[] = [
  { key: 'a', points: hbar(TOP) },
  { key: 'g', points: hbar(MID) },
  { key: 'd', points: hbar(BOT) },
  { key: 'f', points: vbar(M, TOP + GAP, MID - GAP) },
  { key: 'b', points: vbar(W - M, TOP + GAP, MID - GAP) },
  { key: 'e', points: vbar(M, MID + GAP, BOT - GAP) },
  { key: 'c', points: vbar(W - M, MID + GAP, BOT - GAP) },
]

type Cell =
  | { kind: 'digit'; seg: Seg; dp: boolean }
  | { kind: 'colon' }

// Parse the string into cells. A '.' folds onto the digit before it as a decimal
// point rather than taking its own slot; a ':' is its own two-dot separator.
function parse(value: string): Cell[] {
  const cells: Cell[] = []
  for (const ch of Array.from(value)) {
    if (ch === '.') {
      const prev = cells[cells.length - 1]
      if (prev && prev.kind === 'digit' && !prev.dp) {
        prev.dp = true
        continue
      }
      cells.push({ kind: 'digit', seg: {}, dp: true })
      continue
    }
    if (ch === ':') {
      cells.push({ kind: 'colon' })
      continue
    }
    const seg = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS[ch.toLowerCase()]
    cells.push({ kind: 'digit', seg: seg ?? {}, dp: false })
  }
  return cells
}

export function SevenSegment({
  value,
  className = '',
  /** Cell height in CSS pixels; width tracks it. */
  height = 88,
  /** Lit-segment colour. */
  color = '#DCF87C',
  /** Show the ghost of the unlit segments behind each digit. */
  ghost = true,
  /** A soft glow around lit segments (off under reduced motion regardless). */
  glow = true,
}: {
  value: string
  className?: string
  height?: number
  color?: string
  ghost?: boolean
  glow?: boolean
}) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/[:]/g, '')
  const cells = parse(value)

  const digitW = height * (W / H)
  const colonW = height * 0.34
  const dur = reduce ? '0ms' : '160ms'
  const ghostFill = ghost ? 'rgba(255,255,255,0.05)' : 'transparent'

  return (
    <div
      className={`inline-flex items-stretch ${className}`}
      style={{ gap: height * 0.06 }}
      role="img"
      aria-label={value}
    >
      {glow && !reduce && (
        <svg width="0" height="0" aria-hidden className="absolute">
          <filter id={`ss-glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </svg>
      )}
      {cells.map((cell, i) => {
        if (cell.kind === 'colon') {
          const r = height * 0.05
          return (
            <svg
              key={i}
              aria-hidden
              width={colonW}
              height={height}
              viewBox={`0 0 ${colonW} ${height}`}
              className="block shrink-0"
            >
              <circle cx={colonW / 2} cy={height * 0.36} r={r} fill={color} />
              <circle cx={colonW / 2} cy={height * 0.64} r={r} fill={color} />
            </svg>
          )
        }
        const seg = cell.seg
        const dpR = T * 0.42
        return (
          <svg
            key={i}
            aria-hidden
            width={digitW + (cell.dp ? digitW * 0.28 : 0)}
            height={height}
            viewBox={`0 0 ${W + (cell.dp ? W * 0.28 : 0)} ${H}`}
            className="block shrink-0"
            style={{ filter: glow && !reduce ? `url(#ss-glow-${uid})` : undefined }}
          >
            {SEGMENTS.map(({ key, points }) => {
              const lit = !!seg[key]
              return (
                <polygon
                  key={key}
                  points={points}
                  fill={lit ? color : ghostFill}
                  style={{ transition: `fill ${dur} ease` }}
                />
              )
            })}
            {cell.dp && (
              <circle cx={W + W * 0.08} cy={BOT} r={dpR} fill={color} />
            )}
          </svg>
        )
      })}
    </div>
  )
}
