import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

// Waffle — a unit chart, and the shape the data-viz family had been missing.
// The donut splits a whole into arcs, the gauge sweeps one proportion onto a
// dial, the bar compares magnitudes by height, the radar draws a set's
// silhouette, the area curve moves one number over time. None of them shows a
// countable quantity as what it actually is: a pile of individual things. This
// does — one square per unit, so a hundred and seventy-one hand-built
// components read as a hundred and seventy-one squares you could sit and count,
// grouped into their families and tinted by family. "Made, not assembled" made
// literal: every square is one thing that was made.
//
// Same thesis as the rest of the site's charts, and the same restraint: a
// single lime, stepped darker by the family's rank so the largest family is
// brightest — colour only ever encodes "how big a family", never identity.
// Identity lives in the legend, which names every family and, on hover or
// focus, lifts its own squares out of the field while the rest dim back. The
// squares tile in on scroll in a soft diagonal wave; under reduced motion they
// are simply present, no stagger, and nothing moves.

export interface WaffleSegment {
  label: string
  value: number
}

/**
 * One lime, stepped by rank — identical ramp to the DonutChart so the two read
 * as one family. Rank 0 (the largest segment) is full-strength lime; each
 * subsequent segment steps down in opacity over the dark ground.
 */
function limeFor(rank: number, count: number): string {
  if (count <= 1) return 'rgba(220, 248, 124, 1)'
  const t = rank / (count - 1)
  const alpha = 1 - t * 0.62 // 1.0 down to ~0.38
  return `rgba(220, 248, 124, ${alpha.toFixed(3)})`
}

interface Ranked extends WaffleSegment {
  rank: number
  color: string
  share: number
}

const EASE = [0.16, 1, 0.3, 1] as const

export function Waffle({
  segments,
  unit = 'items',
  columns = 19,
  caption,
  className = '',
  ariaLabel,
}: {
  /** The families, in the order they should tile. Each contributes `value` cells. */
  segments: WaffleSegment[]
  /** Noun for one cell, e.g. "components". Used in the readout and summary. */
  unit?: string
  /** Cells per row. The grid keeps this many columns and wraps to as many rows
   *  as the total needs; the last row may be partial, which is honest. */
  columns?: number
  /** Optional line under the legend. */
  caption?: string
  className?: string
  /** Overrides the generated screen-reader summary. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  // Rank the segments largest-first so the lime ramp reads lightest-where-
  // largest, and tint each. Ordering the tiles by this rank means the field
  // fills brightest-family-first, left to right.
  const ranked = useMemo<Ranked[]>(() => {
    const total = segments.reduce((s, d) => s + Math.max(0, d.value), 0) || 1
    return segments
      .map((d) => ({ ...d, value: Math.max(0, d.value) }))
      .sort((a, b) => b.value - a.value)
      .map((d, rank, arr) => ({
        ...d,
        rank,
        color: limeFor(rank, arr.length),
        share: d.value / total,
      }))
  }, [segments])

  const total = useMemo(() => ranked.reduce((s, d) => s + d.value, 0), [ranked])

  // Flatten into one cell-per-unit list, each carrying the index of the segment
  // it belongs to, in ranked order so the field tiles family by family.
  const cells = useMemo<number[]>(() => {
    const out: number[] = []
    ranked.forEach((seg, i) => {
      for (let n = 0; n < seg.value; n++) out.push(i)
    })
    return out
  }, [ranked])

  const shown = active != null ? ranked[active] : null
  const summary =
    ariaLabel ??
    `Waffle chart: ${total} ${unit} across ${ranked.length} groups — ` +
      ranked.map((d) => `${d.label}, ${d.value}`).join('; ') +
      '.'

  // A soft diagonal wave: the delay grows with row + column, capped so the whole
  // field is seated inside ~1s no matter how many cells there are.
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: Math.min(0.9 / Math.max(total, 1), 0.02) } },
  }
  const cell: Variants = {
    hidden: { opacity: 0, scale: 0.2 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE } },
  }

  return (
    <div className={className} role="img" aria-label={summary}>
      {/* Readout — names the active family, or the whole count at rest. */}
      <div aria-hidden className="mb-5 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold leading-none tracking-tight text-[#DCF87C] sm:text-5xl tabular-nums">
          {shown ? shown.value : total}
        </span>
        <span className="text-sm font-medium text-white/55">
          {shown ? (
            <>
              {unit} in <span className="text-white/80">{shown.label}</span>
              <span className="text-white/35"> · {Math.round(shown.share * 100)}%</span>
            </>
          ) : (
            <>{unit}, one square each</>
          )}
        </span>
      </div>

      {/* The field. One rounded square per unit, tinted by family. */}
      <motion.div
        variants={reduce ? undefined : container}
        initial={reduce ? false : 'hidden'}
        whileInView={reduce ? undefined : 'show'}
        viewport={{ once: true, amount: 0.3 }}
        className="grid gap-[3px] sm:gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cells.map((segIdx, i) => {
          const dim = active != null && active !== segIdx
          const lift = active != null && active === segIdx
          return (
            <motion.div
              key={`${uid}-${i}`}
              variants={reduce ? undefined : cell}
              className="aspect-square rounded-[3px] transition-[opacity,transform] duration-300"
              style={{
                backgroundColor: ranked[segIdx].color,
                opacity: dim ? 0.12 : 1,
                transform: lift ? 'scale(1.14)' : 'scale(1)',
              }}
            />
          )
        })}
      </motion.div>

      {/* Legend — the identity layer. Each family is a real button, so the field
          is explorable by keyboard as well as pointer, exactly like the donut. */}
      <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
        {ranked.map((seg, i) => {
          const on = active === i
          return (
            <li key={seg.label}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  active != null && !on ? 'opacity-45' : 'opacity-100'
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-sm text-white/80">{seg.label}</span>
                <span className="text-sm tabular-nums text-white/40">{seg.value}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {caption && <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/45">{caption}</p>}
    </div>
  )
}
