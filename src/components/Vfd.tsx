import { useId } from 'react'
import { useReducedMotion } from 'framer-motion'

// Vfd — a vacuum-fluorescent display, built as a fourteen-segment "starburst"
// readout: the glowing teal panel of an old hi-fi, a VCR, a car stereo, a
// microwave. It is the display this family was missing. Its neighbours all stop
// at digits and a lopsided handful of letters: the seven-segment lights seven
// bars, the odometer rolls wheels, the split-flap drops flaps, the dot-matrix
// lights round lamps, the Nixie stacks wire cathodes. A fourteen-segment cell
// splits the middle bar in two and adds four diagonals and two centre verticals,
// and that is exactly enough geometry to spell the *whole* alphabet honestly —
// the real "M", "W", "X", "K", "V", "Z" that seven bars can only fake or drop.
//
// Two things make it read as a VFD and not just "more segments". First the
// colour: a real vacuum-fluorescent tube glows blue-green phosphor, so this is
// deliberately the one display on the site that is teal rather than lime, the
// way the Nixie is deliberately warm — a lime VFD would not be a VFD. Second the
// glass: the lit segments bloom softly through a dark anode mesh while the unlit
// ones stay faintly present, the ghost of the full starburst sitting behind
// every character — the tell of a real fluorescent module warming its grid.
//
// Pure inline SVG, no canvas and no font: every segment (bars and diagonals
// alike) is a hand-computed mitred hexagon, so it stays crisp at any size and in
// both themes. When a cell's value changes its segments cross-fade — a lit one
// easing on, a dropped one easing off — the little tick that makes a running
// clock feel alive without layout thrash. Under reduced motion the cross-fade
// and the bloom are dropped and values simply cut. The figure is aria-hidden;
// the string rides in an aria-label on the wrapper, so a screen reader hears
// "MOTION", not fourteen segments.

/** The fourteen segments.
 *
 *        a
 *     ───────
 *    |\  |  /|
 *   f| h i j |b          i = upper centre vertical
 *    |  \|/  |           l = lower centre vertical
 *     g1  g2             h j k m = the four diagonals
 *    |  /|\  |
 *   e| k l m |c
 *    |/  |  \|
 *     ───────
 *        d
 */
type Seg = {
  a?: 1; b?: 1; c?: 1; d?: 1; e?: 1; f?: 1
  g1?: 1; g2?: 1
  h?: 1; i?: 1; j?: 1; k?: 1; l?: 1; m?: 1
}

// What a fourteen-segment cell lights for each glyph. Digits borrow the
// seven-segment shapes (plus a slashed zero, so 0 can never be mistaken for O);
// the letters are the conventional starburst spellings, which — unlike seven
// bars — are all genuinely legible. Anything not here renders as a dark cell
// rather than a lie.
const GLYPHS: Record<string, Seg> = {
  '0': { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, j: 1, k: 1 },
  '1': { b: 1, c: 1 },
  '2': { a: 1, b: 1, d: 1, e: 1, g1: 1, g2: 1 },
  '3': { a: 1, b: 1, c: 1, d: 1, g1: 1, g2: 1 },
  '4': { b: 1, c: 1, f: 1, g1: 1, g2: 1 },
  '5': { a: 1, c: 1, d: 1, f: 1, g1: 1, g2: 1 },
  '6': { a: 1, c: 1, d: 1, e: 1, f: 1, g1: 1, g2: 1 },
  '7': { a: 1, b: 1, c: 1 },
  '8': { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g1: 1, g2: 1 },
  '9': { a: 1, b: 1, c: 1, d: 1, f: 1, g1: 1, g2: 1 },
  A: { a: 1, b: 1, c: 1, e: 1, f: 1, g1: 1, g2: 1 },
  B: { a: 1, b: 1, c: 1, d: 1, g2: 1, i: 1, l: 1 },
  C: { a: 1, d: 1, e: 1, f: 1 },
  D: { a: 1, b: 1, c: 1, d: 1, i: 1, l: 1 },
  E: { a: 1, d: 1, e: 1, f: 1, g1: 1, g2: 1 },
  F: { a: 1, e: 1, f: 1, g1: 1, g2: 1 },
  G: { a: 1, c: 1, d: 1, e: 1, f: 1, g2: 1 },
  H: { b: 1, c: 1, e: 1, f: 1, g1: 1, g2: 1 },
  I: { a: 1, d: 1, i: 1, l: 1 },
  J: { b: 1, c: 1, d: 1, e: 1 },
  K: { e: 1, f: 1, g1: 1, j: 1, m: 1 },
  L: { d: 1, e: 1, f: 1 },
  M: { b: 1, c: 1, e: 1, f: 1, h: 1, j: 1 },
  N: { b: 1, c: 1, e: 1, f: 1, h: 1, m: 1 },
  O: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 },
  P: { a: 1, b: 1, e: 1, f: 1, g1: 1, g2: 1 },
  Q: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, m: 1 },
  R: { a: 1, b: 1, e: 1, f: 1, g1: 1, g2: 1, m: 1 },
  S: { a: 1, c: 1, d: 1, f: 1, g1: 1, g2: 1 },
  T: { a: 1, i: 1, l: 1 },
  U: { b: 1, c: 1, d: 1, e: 1, f: 1 },
  V: { e: 1, f: 1, j: 1, k: 1 },
  W: { b: 1, c: 1, e: 1, f: 1, k: 1, m: 1 },
  X: { h: 1, j: 1, k: 1, m: 1 },
  Y: { h: 1, j: 1, l: 1 },
  Z: { a: 1, d: 1, j: 1, k: 1 },
  '-': { g1: 1, g2: 1 },
  '_': { d: 1 },
  '=': { d: 1, g1: 1, g2: 1 },
  '+': { g1: 1, g2: 1, i: 1, l: 1 },
  '*': { g1: 1, g2: 1, h: 1, i: 1, j: 1, k: 1, l: 1, m: 1 },
  '/': { j: 1, k: 1 },
  '\\': { h: 1, m: 1 },
  '°': { a: 1, b: 1, f: 1, g1: 1, g2: 1 },
  "'": { f: 1 },
  '"': { f: 1, i: 1 },
  '!': { b: 1, c: 1 },
  '?': { a: 1, b: 1, g2: 1, l: 1 },
  ' ': {},
}

// Cell geometry, in a 0..W by 0..H viewBox. CX/MID are the centre the diagonals
// and centre verticals all run to.
const W = 64
const H = 104
const M = 9 // inset from the cell edges
const CX = W / 2
const MID = H / 2
const TOP = M
const BOT = H - M
const LX = M
const RX = W - M
const T = 8 // bar thickness
const DT = 6.4 // diagonals a touch thinner, so the eight segments meeting at the centre don't choke
const GAP = 2.4 // pull each end back from its vertex so neighbours meet in a clean seam

// A mitred hexagon bar of thickness `t` from (x0,y0) to (x1,y1), with each end
// pulled back by GAP and tapered to a point so touching segments seam cleanly —
// the same construction for the straight bars and the diagonals.
function bar(x0: number, y0: number, x1: number, y1: number, t: number): string {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const half = t / 2
  // endpoints pulled in by the gap
  const sx = x0 + ux * GAP
  const sy = y0 + uy * GAP
  const ex = x1 - ux * GAP
  const ey = y1 - uy * GAP
  // mitre: the flat sides stop `half` short of the tip
  const sxi = sx + ux * half
  const syi = sy + uy * half
  const exi = ex - ux * half
  const eyi = ey - uy * half
  const pts: [number, number][] = [
    [sx, sy],
    [sxi + px * half, syi + py * half],
    [exi + px * half, eyi + py * half],
    [ex, ey],
    [exi - px * half, eyi - py * half],
    [sxi - px * half, syi - py * half],
  ]
  return pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
}

const SEGMENTS: { key: keyof Seg; points: string }[] = [
  { key: 'a', points: bar(LX, TOP, RX, TOP, T) },
  { key: 'd', points: bar(LX, BOT, RX, BOT, T) },
  { key: 'f', points: bar(LX, TOP, LX, MID, T) },
  { key: 'e', points: bar(LX, MID, LX, BOT, T) },
  { key: 'b', points: bar(RX, TOP, RX, MID, T) },
  { key: 'c', points: bar(RX, MID, RX, BOT, T) },
  { key: 'g1', points: bar(LX, MID, CX, MID, T) },
  { key: 'g2', points: bar(CX, MID, RX, MID, T) },
  { key: 'i', points: bar(CX, TOP, CX, MID, T) },
  { key: 'l', points: bar(CX, MID, CX, BOT, T) },
  { key: 'h', points: bar(LX, TOP, CX, MID, DT) },
  { key: 'j', points: bar(RX, TOP, CX, MID, DT) },
  { key: 'k', points: bar(LX, BOT, CX, MID, DT) },
  { key: 'm', points: bar(RX, BOT, CX, MID, DT) },
]

type Cell =
  | { kind: 'digit'; seg: Seg; dp: boolean }
  | { kind: 'colon' }

// Parse the string into cells. A '.' folds onto the digit before it as a decimal
// point rather than taking a slot; a ':' is its own two-dot separator.
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

export function Vfd({
  value,
  className = '',
  /** Cell height in CSS pixels; width tracks it. */
  height = 72,
  /** Lit-segment colour. The VFD default is phosphor teal, not the site lime. */
  color = '#43e8c9',
  /** Show the ghost of the unlit segments behind each character. */
  ghost = true,
  /** A soft phosphor bloom around lit segments (off under reduced motion). */
  glow = true,
  /** Draw the dark glass panel with its faint anode mesh behind the readout. */
  panel = true,
}: {
  value: string
  className?: string
  height?: number
  color?: string
  ghost?: boolean
  glow?: boolean
  panel?: boolean
}) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/[:]/g, '')
  const cells = parse(value)

  const digitW = height * (W / H)
  const colonW = height * 0.34
  const dur = reduce ? '0ms' : '180ms'
  const ghostFill = ghost ? 'rgba(255,255,255,0.045)' : 'transparent'
  const litGlow = glow && !reduce
  const pad = height * 0.28

  // The glass: a very dark teal-washed panel with a fine horizontal anode mesh,
  // the look of a vacuum-fluorescent tube lit from behind a grid.
  const panelStyle = panel
    ? {
        background:
          'radial-gradient(130% 120% at 50% 0%, rgba(67,232,201,0.07), rgba(2,10,10,0.92) 60%, rgba(0,0,0,0.95))',
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(67,232,201,0.05) 0px, rgba(67,232,201,0.05) 1px, transparent 1px, transparent 4px), radial-gradient(130% 120% at 50% 0%, rgba(67,232,201,0.07), rgba(2,10,10,0.92) 60%, rgba(0,0,0,0.95))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 40px rgba(0,0,0,0.6)',
        padding: `${pad}px ${pad * 1.2}px`,
        borderRadius: Math.max(10, height * 0.16),
      }
    : undefined

  return (
    <div
      className={`inline-flex items-stretch ${panel ? 'border border-white/10' : ''} ${className}`}
      style={{ gap: height * 0.055, ...panelStyle }}
      role="img"
      aria-label={value}
    >
      {litGlow && (
        <svg width="0" height="0" aria-hidden className="absolute">
          <filter id={`vfd-glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
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
              style={{ filter: litGlow ? `url(#vfd-glow-${uid})` : undefined }}
            >
              <circle cx={colonW / 2} cy={height * 0.38} r={r} fill={color} />
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
            width={digitW + (cell.dp ? digitW * 0.26 : 0)}
            height={height}
            viewBox={`0 0 ${W + (cell.dp ? W * 0.26 : 0)} ${H}`}
            className="block shrink-0"
            style={{ filter: litGlow ? `url(#vfd-glow-${uid})` : undefined }}
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
            {cell.dp && <circle cx={W + W * 0.07} cy={BOT} r={dpR} fill={color} />}
          </svg>
        )
      })}
    </div>
  )
}
