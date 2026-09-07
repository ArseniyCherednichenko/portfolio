import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Treemap — the chart family's tenth shape, and the one none of the others is:
// the space-filling one. The donut and ring bend a share into an arc, the bar
// stands it up as a height, the waffle counts it out one square at a time — all
// of them leave the page mostly empty around the figure. A treemap refuses to:
// it packs every share into one solid rectangle with no gap and no waste, each
// part a tile whose *area* is its value, laid out so the tiles stay as square as
// they can (the squarified layout — Bruls, Huizing & van Wijk, 2000 — the one
// d3 ships, written here by hand off a list of values, no charting library).
// That area-for-value reading is the thing the radial and unit charts cannot
// give: you compare parts by how much room each takes, and the label sits inside
// the part it names rather than off in a legend.
//
// Same colour discipline as the rest of the site's data-viz, kept honest for a
// chart that must carry text on its fills: one lime, stepped by rank from a
// bright leaf on the largest tile down to a deep forest on the smallest, so the
// biggest share reads brightest — and the label ink flips dark-on-light or
// light-on-dark by each tile's own luminance, so it is legible on every step.
//
// Interactive like its siblings: hover or focus a tile (or its legend row) and
// it lifts to full lime while the rest dim back, and the readout names its
// share. The tiles scale in on scroll in rank order; under reduced motion they
// are simply present, nothing growing.

export interface TreeCell {
  /** Names the part — drawn inside its tile and read by assistive tech. */
  label: string
  /** The amount. A tile's area is this as a fraction of the total. */
  value: number
  /** Optional short unit for the readout, e.g. "components". */
  unit?: string
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const EASE = [0.16, 1, 0.3, 1] as const

// Layout / viewBox in one space so a unit reads as roughly a pixel and the
// in-tile type sizes are predictable. An 8:5 field packs into pleasant tiles.
const W = 320
const H = 200
const GAP = 2 // hairline gutter inset around every tile

// The single lime, stepped by rank between a bright leaf (largest) and a deep
// forest (smallest), so identity is carried by size and the ramp only ever
// encodes magnitude — never a second hue.
const LEAF = [220, 248, 124] as const
const FOREST = [26, 38, 18] as const

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function toneAt(t: number): { fill: string; ink: string } {
  const r = Math.round(lerp(LEAF[0], FOREST[0], t))
  const g = Math.round(lerp(LEAF[1], FOREST[1], t))
  const b = Math.round(lerp(LEAF[2], FOREST[2], t))
  // Perceptual-ish luminance decides whether the label reads dark or light.
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return {
    fill: `rgb(${r}, ${g}, ${b})`,
    ink: lum > 150 ? 'rgba(12,15,8,0.92)' : 'rgba(255,255,255,0.9)',
  }
}

// The squarified treemap. Given values (in the caller's order) and a rectangle,
// it lays them out row by row, adding to the current row only while doing so
// keeps the worst tile in it closer to square, then commits the row along the
// shortest side and recurses into what is left. Returns one rect per value, in
// the same order as `values` so the caller can map identity back onto them.
function squarify(values: number[], area: Rect): Rect[] {
  const total = values.reduce((s, v) => s + v, 0)
  const out: Rect[] = new Array(values.length)
  if (total <= 0) return values.map(() => ({ x: area.x, y: area.y, w: 0, h: 0 }))

  // Scale every value to a real area inside the rectangle, remembering its index.
  const scale = (area.w * area.h) / total
  const items = values.map((v, i) => ({ i, a: Math.max(v, 0) * scale }))

  let rect = { ...area }
  let row: { i: number; a: number }[] = []

  // Worst aspect ratio in a row laid along `side`, given the row's total area.
  const worst = (r: { a: number }[], side: number): number => {
    const s = r.reduce((acc, x) => acc + x.a, 0)
    let max = 0
    let min = Infinity
    for (const x of r) {
      if (x.a > max) max = x.a
      if (x.a < min) min = x.a
    }
    const s2 = s * s
    return Math.max((side * side * max) / s2, s2 / (side * side * min))
  }

  const commit = (r: { i: number; a: number }[]) => {
    const s = r.reduce((acc, x) => acc + x.a, 0)
    if (s <= 0) return
    if (rect.w >= rect.h) {
      // A vertical strip on the left, its width set by the row's total area.
      const stripW = s / rect.h
      let y = rect.y
      for (const x of r) {
        const h = x.a / stripW
        out[x.i] = { x: rect.x, y, w: stripW, h }
        y += h
      }
      rect = { x: rect.x + stripW, y: rect.y, w: rect.w - stripW, h: rect.h }
    } else {
      // A horizontal strip along the top, its height set by the row's area.
      const stripH = s / rect.w
      let x = rect.x
      for (const it of r) {
        const w = it.a / stripH
        out[it.i] = { x, y: rect.y, w, h: stripH }
        x += w
      }
      rect = { x: rect.x, y: rect.y + stripH, w: rect.w, h: rect.h - stripH }
    }
  }

  for (const item of items) {
    const side = Math.min(rect.w, rect.h)
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) {
      row.push(item)
    } else {
      commit(row)
      row = [item]
    }
  }
  if (row.length) commit(row)

  // Guard: any value that never got placed (all-zero degenerate) gets an empty
  // tile so the returned array always lines up with the input.
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) out[i] = { x: area.x, y: area.y, w: 0, h: 0 }
  }
  return out
}

export function Treemap({
  cells,
  unit,
  className = '',
  ariaLabel,
  showLegend = true,
}: {
  cells: TreeCell[]
  /** Fallback unit for the readout when a cell carries none. */
  unit?: string
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
  showLegend?: boolean
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { rows, total } = useMemo(() => {
    // Sort largest-first: squarify wants descending values, and the rank drives
    // the tone ramp so the biggest tile is the brightest leaf.
    const sorted = cells
      .map((c, i) => ({ ...c, value: Math.max(c.value, 0), _src: i }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
    const sum = sorted.reduce((s, c) => s + c.value, 0)
    const rects = squarify(
      sorted.map((c) => c.value),
      { x: 0, y: 0, w: W, h: H },
    )
    const n = Math.max(sorted.length - 1, 1)
    const built = sorted.map((c, i) => {
      const t = sorted.length === 1 ? 0 : i / n
      return {
        ...c,
        rect: rects[i],
        pct: sum > 0 ? Math.round((c.value / sum) * 100) : 0,
        tone: toneAt(t),
      }
    })
    return { rows: built, total: sum }
  }, [cells])

  const focus = active != null ? rows[active] : rows[0]
  const summary =
    ariaLabel ??
    `Treemap. ${rows
      .map((r) => `${r.label}, ${r.value}${r.unit || unit ? ` ${r.unit ?? unit}` : ''} (${r.pct} percent)`)
      .join('; ')}.`

  return (
    <div className={`flex w-full flex-col ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={summary}>
          {rows.map((row, i) => {
            const { x, y, w, h } = row.rect
            if (w <= 0 || h <= 0) return null
            const dim = active != null && active !== i
            const on = active === i
            const ix = x + GAP / 2
            const iy = y + GAP / 2
            const iw = Math.max(w - GAP, 0)
            const ih = Math.max(h - GAP, 0)
            const fill = on ? `rgb(${LEAF[0]}, ${LEAF[1]}, ${LEAF[2]})` : row.tone.fill
            const ink = on ? 'rgba(12,15,8,0.92)' : row.tone.ink
            const showLabel = iw >= 46 && ih >= 24
            const showValue = showLabel && ih >= 42 && iw >= 54
            return (
              <motion.g
                key={row.label + i}
                // Grow each tile in from its own centre, in rank order.
                initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.05 + i * 0.05 }}
                style={{
                  transformOrigin: `${x + w / 2}px ${y + h / 2}px`,
                  opacity: dim ? 0.32 : 1,
                  transition: 'opacity 0.3s ease',
                  cursor: 'default',
                }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <rect
                  x={ix}
                  y={iy}
                  width={iw}
                  height={ih}
                  rx={4}
                  fill={fill}
                  stroke={on ? 'rgba(255,255,255,0.5)' : 'transparent'}
                  strokeWidth={1}
                  style={{ transition: 'fill 0.25s ease' }}
                />
                {showLabel && (
                  <text
                    x={ix + 8}
                    y={iy + 16}
                    fill={ink}
                    className="font-semibold"
                    style={{ fontSize: 11, letterSpacing: 0.2 }}
                  >
                    {row.label}
                  </text>
                )}
                {showValue && (
                  <text
                    x={ix + 8}
                    y={iy + 34}
                    fill={ink}
                    className="tabular-nums"
                    style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}
                  >
                    {row.value}
                  </text>
                )}
              </motion.g>
            )
          })}
        </svg>
      </div>

      {/* Readout — the focused (hovered/first) tile's share, read once beneath
          the field. aria-hidden: the svg summary already carries every tile. */}
      {focus && (
        <div aria-hidden className="mt-4 flex items-baseline gap-3">
          <motion.span
            key={`${uid}-${active ?? 'first'}`}
            initial={reduce ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="font-display text-2xl font-bold leading-none tracking-tight text-[#DCF87C]"
          >
            {focus.pct}
            <span className="text-base text-white/40">%</span>
          </motion.span>
          <span className="text-sm text-white/60">
            <span className="font-semibold text-white/80">{focus.label}</span>
            {' — '}
            {focus.value}
            {focus.unit || unit ? ` ${focus.unit ?? unit}` : ''} of {total}
          </span>
        </div>
      )}

      {showLegend && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {rows.map((row, i) => (
            <li key={row.label + i}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                aria-label={`${row.label}: ${row.value}${row.unit || unit ? ` ${row.unit ?? unit}` : ''}, ${row.pct} percent`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: row.tone.fill }} aria-hidden />
                <span className="text-sm text-white/65">{row.label}</span>
                <span className="text-sm font-semibold tabular-nums text-white/85">{row.pct}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
