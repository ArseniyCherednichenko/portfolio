import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

// Heatmap — the data-viz family's seventh shape, and the one none of the others
// could be: a two-dimensional field. Every chart before it reduces the world to
// a single series — the donut splits one whole, the gauge sweeps one
// proportion, the bar and area track one number across one axis, the radar
// draws one silhouette, the waffle piles one count. A heatmap is the first that
// reads a value at the *crossing* of two axes at once: this kind of work, in
// that stretch of time. It is the shape you reach for when the question is not
// "how much" but "how much, where — and when".
//
// Same restraint as the rest of the site's charts: one lime, and colour only
// ever encodes magnitude. A cell's tint is its value against the field's
// brightest cell; an empty cell is a bordered ghost, never a colour of its own.
// The field tiles in on scroll in a soft diagonal wave; hovering or focusing a
// cell lights its whole row and column so the crossing is unmistakable, and
// dims the rest back. Under reduced motion the field is simply present, and the
// cross-light is an instant state change with nothing in flight.

export interface HeatmapRow {
  /** The row's name, shown down the left edge. */
  label: string
  /** One value per column, in column order. Missing entries read as zero. */
  values: number[]
}

const EASE = [0.16, 1, 0.3, 1] as const

/** One lime, alpha mapped from the cell's value against the field maximum. Zero
 *  is left to the ghost styling; anything above it starts at a legible floor so
 *  a single unit never disappears, and climbs to full strength at the max. */
function limeFor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return 'transparent'
  const t = value / max
  const alpha = 0.16 + t * 0.84
  return `rgba(220, 248, 124, ${alpha.toFixed(3)})`
}

interface Cell {
  row: number
  col: number
  value: number
}

export function Heatmap({
  rows,
  columns,
  unit = 'items',
  caption,
  className = '',
  ariaLabel,
}: {
  /** The rows, top to bottom. Each carries one value per column. */
  rows: HeatmapRow[]
  /** Column headers, left to right. Length sets how many columns are drawn. */
  columns: string[]
  /** Noun for one unit of value, e.g. "entries". Used in the readout. */
  unit?: string
  /** Optional line under the field. */
  caption?: string
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<Cell | null>(null)

  const cols = columns.length

  // Find the field maximum and total in one pass, so the ramp is measured
  // against the real brightest crossing, not a guess.
  const { max, total } = useMemo(() => {
    let mx = 0
    let sum = 0
    rows.forEach((r) => {
      for (let col = 0; col < cols; col++) {
        const value = Math.max(0, r.values[col] ?? 0)
        if (value > mx) mx = value
        sum += value
      }
    })
    return { max: mx, total: sum }
  }, [rows, cols])

  const shown = active
  const summary =
    ariaLabel ??
    `Heatmap: ${total} ${unit} across ${rows.length} rows and ${cols} columns. ` +
      rows
        .map(
          (r) =>
            `${r.label}: ` +
            columns.map((c, col) => `${c}, ${Math.max(0, r.values[col] ?? 0)}`).join('; '),
        )
        .join('. ') +
      '.'

  // A soft diagonal wave keyed off row + column, capped so the whole field is
  // seated inside ~0.8s regardless of size.
  const span = Math.max(rows.length + cols, 1)
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: Math.min(0.8 / span, 0.05) } },
  }
  const cell: Variants = {
    hidden: { opacity: 0, scale: 0.4 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE } },
  }

  return (
    <div className={className} role="img" aria-label={summary}>
      {/* Readout — names the active crossing, or the whole field at rest. */}
      <div aria-hidden className="mb-6 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold leading-none tracking-tight text-[#DCF87C] sm:text-5xl tabular-nums">
          {shown ? shown.value : total}
        </span>
        <span className="text-sm font-medium text-white/55">
          {shown ? (
            <>
              {unit} —{' '}
              <span className="text-white/80">{rows[shown.row]?.label}</span>
              <span className="text-white/35"> in {columns[shown.col]}</span>
            </>
          ) : (
            <>{unit} across the field</>
          )}
        </span>
      </div>

      {/* The field. One flat grid — a row-label gutter plus one column per
          header — so every cell is a direct child and the container's stagger
          reaches it. The header row sits first, then each row's label and
          cells in reading order. */}
      <div className="overflow-x-auto">
        <motion.div
          variants={reduce ? undefined : container}
          initial={reduce ? false : 'hidden'}
          whileInView={reduce ? undefined : 'show'}
          viewport={{ once: true, amount: 0.3 }}
          className="grid min-w-[22rem] gap-[3px] sm:gap-1"
          style={{ gridTemplateColumns: `minmax(4.5rem, auto) repeat(${cols}, minmax(0, 1fr))` }}
        >
          {/* Column headers — an empty corner, then one label per column. */}
          <div aria-hidden />
          {columns.map((c) => (
            <div
              key={`${uid}-h-${c}`}
              aria-hidden
              className="pb-1 text-center text-[0.7rem] font-medium uppercase tracking-wide text-white/40"
            >
              {c}
            </div>
          ))}

          {/* Rows — each contributes a left label then its cells, flat. */}
          {rows.map((r, row) => [
            <div
              key={`${uid}-r-${row}`}
              aria-hidden
              className={`flex items-center pr-3 text-right text-xs transition-colors duration-300 ${
                active && active.row === row ? 'text-white/85' : 'text-white/50'
              }`}
            >
              <span className="ml-auto">{r.label}</span>
            </div>,
            ...columns.map((_, col) => {
              const value = Math.max(0, r.values[col] ?? 0)
              const cross = active && (active.row === row || active.col === col)
              const here = active && active.row === row && active.col === col
              const dim = active && !cross
              return (
                <motion.button
                  type="button"
                  key={`${uid}-c-${row}-${col}`}
                  variants={reduce ? undefined : cell}
                  onMouseEnter={() => setActive({ row, col, value })}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive({ row, col, value })}
                  onBlur={() => setActive(null)}
                  aria-label={`${r.label} in ${columns[col]}: ${value} ${unit}`}
                  className="relative aspect-square rounded-[4px] outline-none transition-[opacity,transform] duration-300 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/80"
                  style={{
                    backgroundColor: limeFor(value, max),
                    border: value <= 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    opacity: dim ? 0.2 : 1,
                    transform: here ? 'scale(1.12)' : 'scale(1)',
                    zIndex: here ? 1 : 0,
                  }}
                />
              )
            }),
          ])}
        </motion.div>
      </div>

      {/* Scale legend — the ramp made explicit: none, through to the busiest. */}
      <div aria-hidden className="mt-7 flex items-center gap-2.5">
        <span className="text-xs text-white/40">Less</span>
        <div className="flex gap-1">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              className="h-3 w-3 rounded-[3px]"
              style={{
                backgroundColor: t === 0 ? 'transparent' : `rgba(220, 248, 124, ${0.16 + t * 0.84})`,
                border: t === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            />
          ))}
        </div>
        <span className="text-xs text-white/40">More</span>
      </div>

      {caption && <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/45">{caption}</p>}
    </div>
  )
}
