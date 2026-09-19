import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// ParallelCoords — the chart family's many-variables-at-once shape, and the one
// none of the others can be. Every chart before it reads a bounded number of
// dimensions: the bar a single height, the scatter exactly two (x and y), the
// candlestick four prices strung along one time axis. A parallel-coordinates
// plot reads AS MANY numeric dimensions as you give it, side by side. Each
// dimension is its own vertical axis, laid out left to right; each record is a
// single polyline that crosses every axis at its value on that axis. So a whole
// table of many columns is drawn at once, and the reading is the SHAPE of the
// bundle — which lines run parallel (two dimensions that agree), which cross in
// an X between two axes (two dimensions that trade off), where the lines fan
// wide (a dimension that spreads the records) or pinch to a knot (one they share).
//
// The radar chart is also multivariate, but it wraps the axes into a ring and
// draws one closed polygon per record — good for a handful of records compared
// as silhouettes. Parallel coordinates keep the axes straight and open, which is
// what makes its signature interaction possible: BRUSHING. Drag along any axis
// to select a range on it, and every record outside that range dims away, so you
// can carve the bundle down to "the ones that are high here AND low there" and
// watch the surviving lines light up. Brush several axes and the filters stack.
//
// It keeps the family's rules. No plotting library: hand-laid SVG axes, ticks,
// and polylines, each axis on its own computed round-number scale (niceRange),
// because the dimensions are in different units and none is forced to share the
// others' zero. One lime: the lines are stepped in lightness by one chosen
// dimension so colour never encodes two things, and the brush, the hover, and
// the active line all speak in the same hue. It is quietly interactive and
// honest — a hovered or focused line names all its values in a readout, the SVG
// carries a full text summary, and every record's numbers sit in a list beneath,
// so the picture never carries the data alone.

export interface PCDimension {
  /** Key into each record for this dimension's value. */
  key: string
  /** Axis title. */
  label: string
  /** Optional short unit appended to values in the readout, e.g. "h". */
  unit?: string
}

export interface PCRecord {
  /** Name for this record, shown in the readout and the list. */
  label: string
  /** One numeric value per dimension key. */
  [key: string]: number | string
}

// The drawing surface, in viewBox units. Wide and short: parallel coordinates
// read horizontally across their axes, so the frame favours width. Padding
// leaves room for the axis titles + tick labels (top/bottom) and the first and
// last axis's value labels (left/right).
const VBW = 640
const VBH = 380
const PAD = { top: 34, right: 28, bottom: 30, left: 28 }
const PLOT_W = VBW - PAD.left - PAD.right
const PLOT_H = VBH - PAD.top - PAD.bottom

/**
 * Round a raw [min, max] span out to friendly axis bounds and hand back the tick
 * values that divide it evenly, so an axis reads in round numbers. A parallel
 * axis's marks are positions, not lengths, so it is NOT forced to zero — the
 * frame hugs the column with a little headroom. Aims for roughly four steps.
 */
function niceRange(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  if (max <= min) {
    const pad = Math.abs(min) > 1 ? Math.abs(min) * 0.1 : 1
    return { lo: min - pad, hi: max + pad, ticks: [min - pad, max + pad] }
  }
  const span = max - min
  const rough = span / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = mag * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(v)
  return { lo, hi, ticks }
}

/** Trim a value to a short, honest label — whole numbers stay whole, otherwise
 *  one decimal, so tick and readout text never runs to a jitter of digits. */
function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return (Math.round(v * 10) / 10).toFixed(1)
}

/** One lime, stepped in lightness by where a value falls in its dimension's
 *  range — low is a deeper forest lime, high a bright leaf. Colour encodes only
 *  the one chosen dimension, never a second thing. */
function limeFor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const light = 40 + clamped * 42 // 40%..82%
  return `hsl(74 78% ${light}%)`
}

interface Brush {
  /** Selected value range on this axis, min..max in data units. */
  lo: number
  hi: number
}

export function ParallelCoords({
  dimensions,
  data,
  colorBy,
  className = '',
  ariaLabel,
}: {
  dimensions: PCDimension[]
  data: PCRecord[]
  /** Dimension key whose value steps each line's lime lightness. Defaults to the
   *  last dimension. */
  colorBy?: string
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)
  const [brushes, setBrushes] = useState<Record<string, Brush | null>>({})
  // Live drag state for the axis currently being brushed. Kept in a ref so the
  // pointer-move handler never restages the whole component per frame.
  const drag = useRef<{ key: string; startFrac: number } | null>(null)
  const trackRefs = useRef<Record<string, SVGRectElement | null>>({})

  const colorKey = colorBy ?? dimensions[dimensions.length - 1]?.key

  // Per-axis geometry and scale, computed once from the data. Each axis gets its
  // own nice range (the dimensions are in different units), an x position, and a
  // value->y mapper. The colour scale is normalised over the colour dimension.
  const axes = useMemo(() => {
    return dimensions.map((dim, i) => {
      const vals = data.map((d) => Number(d[dim.key]))
      const r = niceRange(Math.min(...vals), Math.max(...vals))
      const span = r.hi - r.lo || 1
      const x = dimensions.length > 1 ? PAD.left + (i / (dimensions.length - 1)) * PLOT_W : PAD.left + PLOT_W / 2
      const yFor = (v: number) => PAD.top + (1 - (v - r.lo) / span) * PLOT_H
      // Fraction (0 top .. 1 bottom) -> value, for turning a brush drag back into
      // a data range.
      const valFor = (frac: number) => r.hi - Math.max(0, Math.min(1, frac)) * span
      return { dim, x, lo: r.lo, hi: r.hi, ticks: r.ticks, yFor, valFor }
    })
  }, [dimensions, data])

  const colorScale = useMemo(() => {
    if (!colorKey) return () => 0.6
    const vals = data.map((d) => Number(d[colorKey]))
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const span = hi - lo || 1
    return (v: number) => (v - lo) / span
  }, [data, colorKey])

  // A record survives if, for every axis that has a brush, its value on that
  // axis is inside the brush. Un-brushed axes never exclude anything.
  const passes = useCallback(
    (rec: PCRecord) => {
      for (const ax of axes) {
        const b = brushes[ax.dim.key]
        if (!b) continue
        const v = Number(rec[ax.dim.key])
        if (v < b.lo - 1e-9 || v > b.hi + 1e-9) return false
      }
      return true
    },
    [axes, brushes],
  )

  const lines = useMemo(
    () =>
      data.map((rec, i) => {
        const d = axes
          .map((ax) => `${ax.x.toFixed(2)},${ax.yFor(Number(rec[ax.dim.key])).toFixed(2)}`)
          .join(' ')
        const color = colorKey ? limeFor(colorScale(Number(rec[colorKey]))) : limeFor(0.6)
        return { rec, i, points: d, color, kept: passes(rec) }
      }),
    [data, axes, colorKey, colorScale, passes],
  )

  const anyBrush = axes.some((ax) => brushes[ax.dim.key])
  const keptCount = lines.filter((l) => l.kept).length

  // --- Brushing ---------------------------------------------------------------
  // Pointer coordinates come in client space; fraction along an axis is
  // scale-independent (clientY offset over the track's own client height), so it
  // maps cleanly to a data value whatever size the SVG renders at.
  function fracOf(key: string, clientY: number): number {
    const el = trackRefs.current[key]
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return (clientY - r.top) / (r.height || 1)
  }

  function onTrackPointerDown(e: React.PointerEvent, key: string) {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { key, startFrac: fracOf(key, e.clientY) }
  }

  function onTrackPointerMove(e: React.PointerEvent, key: string) {
    const d = drag.current
    if (!d || d.key !== key) return
    const ax = axes.find((a) => a.dim.key === key)
    if (!ax) return
    const f0 = d.startFrac
    const f1 = fracOf(key, e.clientY)
    const a = ax.valFor(f0)
    const b = ax.valFor(f1)
    setBrushes((cur) => ({ ...cur, [key]: { lo: Math.min(a, b), hi: Math.max(a, b) } }))
  }

  function onTrackPointerUp(e: React.PointerEvent, key: string) {
    const d = drag.current
    drag.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (!d || d.key !== key) return
    // A click (no real drag) clears this axis's brush rather than selecting a
    // sliver, so a stray tap never hides every line.
    if (Math.abs(fracOf(key, e.clientY) - d.startFrac) < 0.02) {
      setBrushes((cur) => ({ ...cur, [key]: null }))
    }
  }

  const shown = active != null ? data[active] : null
  const shownX = active != null ? axes[axes.length - 1]?.x ?? PAD.left : PAD.left

  const summary =
    ariaLabel ??
    `Parallel coordinates plot of ${data.length} records across ${dimensions.length} axes: ` +
      dimensions.map((d) => d.label).join(', ') +
      '. Each line is one record crossing every axis at its value.' +
      (anyBrush ? ` Filtered to ${keptCount} of ${data.length} records.` : '')

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Axes: a vertical spine per dimension, its round-number ticks, and a
              title above. The first and last axes label their values outward so
              the numbers never sit under the lines. */}
          {axes.map((ax, ai) => {
            const outward = ai === 0 ? 'end' : ai === axes.length - 1 ? 'start' : 'middle'
            const labelDx = ai === 0 ? -8 : ai === axes.length - 1 ? 8 : 0
            const showValues = ai === 0 || ai === axes.length - 1
            return (
              <g key={`${uid}-ax-${ax.dim.key}`}>
                <line
                  x1={ax.x}
                  y1={PAD.top}
                  x2={ax.x}
                  y2={PAD.top + PLOT_H}
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth={1}
                />
                {ax.ticks.map((t) => {
                  const y = ax.yFor(t)
                  return (
                    <g key={`${uid}-t-${ax.dim.key}-${t}`}>
                      <line x1={ax.x - 3} y1={y} x2={ax.x + 3} y2={y} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
                      {showValues && (
                        <text
                          x={ax.x + labelDx}
                          y={y}
                          textAnchor={outward as 'start' | 'end' | 'middle'}
                          dominantBaseline="middle"
                          className="fill-white/35"
                          style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmt(t)}
                        </text>
                      )}
                    </g>
                  )
                })}
                <text
                  x={ax.x}
                  y={PAD.top - 14}
                  textAnchor="middle"
                  className="fill-white/60"
                  style={{ fontSize: 12, letterSpacing: '0.02em' }}
                >
                  {ax.dim.label}
                </text>
                {ax.dim.unit && (
                  <text
                    x={ax.x}
                    y={VBH - 12}
                    textAnchor="middle"
                    className="fill-white/25"
                    style={{ fontSize: 9, letterSpacing: '0.08em' }}
                  >
                    {ax.dim.unit}
                  </text>
                )}
              </g>
            )
          })}

          {/* The bundle. Each record is a polyline crossing every axis; it draws
              itself left-to-right (pathLength) staggered by index, so the plot
              weaves in rather than snapping on. Brushed-out lines dim and thin. */}
          {lines.map((ln) => {
            const isActive = active === ln.i
            const dim = (active != null && !isActive) || !ln.kept
            return (
              <motion.polyline
                key={`${uid}-l-${ln.i}`}
                points={ln.points}
                fill="none"
                stroke={ln.color}
                strokeWidth={isActive ? 2.6 : 1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  opacity: dim ? 0.12 : isActive ? 1 : 0.7,
                  transition: 'opacity 0.18s ease, stroke-width 0.15s ease',
                }}
                initial={reduce ? { pathLength: 1, opacity: ln.kept ? 0.7 : 0.12 } : { pathLength: 0, opacity: 0 }}
                whileInView={reduce ? undefined : { pathLength: 1, opacity: ln.kept ? 0.7 : 0.12 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7, delay: reduce ? 0 : Math.min(ln.i * 0.04, 0.6), ease: [0.16, 1, 0.3, 1] }}
              />
            )
          })}

          {/* Wide, transparent hit lines over the bundle so a thin polyline is
              easy to reach by pointer or keyboard; each names all its values. */}
          {lines.map((ln) => (
            <polyline
              key={`${uid}-hit-${ln.i}`}
              points={ln.points}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              tabIndex={0}
              role="button"
              aria-label={`${ln.rec.label}: ${dimensions
                .map((d) => `${d.label} ${fmt(Number(ln.rec[d.key]))}${d.unit ? ` ${d.unit}` : ''}`)
                .join(', ')}${ln.kept ? '' : ' (filtered out)'}`}
              className="cursor-pointer focus:outline-none"
              onMouseEnter={() => setActive(ln.i)}
              onMouseLeave={() => setActive((cur) => (cur === ln.i ? null : cur))}
              onFocus={() => setActive(ln.i)}
              onBlur={() => setActive((cur) => (cur === ln.i ? null : cur))}
            />
          ))}

          {/* Brush tracks + selections, drawn above the bundle so a drag always
              lands on the axis, not a line. The visible lime band shows the
              current selection; the full-height track catches the drag. */}
          {axes.map((ax) => {
            const b = brushes[ax.dim.key]
            const bTop = b ? ax.yFor(b.hi) : 0
            const bBot = b ? ax.yFor(b.lo) : 0
            return (
              <g key={`${uid}-brush-${ax.dim.key}`}>
                {b && (
                  <rect
                    x={ax.x - 7}
                    y={bTop}
                    width={14}
                    height={Math.max(2, bBot - bTop)}
                    rx={3}
                    fill="rgba(220,248,124,0.16)"
                    stroke="rgba(220,248,124,0.6)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}
                <rect
                  ref={(el) => {
                    trackRefs.current[ax.dim.key] = el
                  }}
                  x={ax.x - 9}
                  y={PAD.top}
                  width={18}
                  height={PLOT_H}
                  fill="transparent"
                  className="cursor-ns-resize touch-none"
                  onPointerDown={(e) => onTrackPointerDown(e, ax.dim.key)}
                  onPointerMove={(e) => onTrackPointerMove(e, ax.dim.key)}
                  onPointerUp={(e) => onTrackPointerUp(e, ax.dim.key)}
                />
              </g>
            )
          })}
        </svg>

        {/* Floating readout — an HTML overlay near the hovered line's last axis,
            naming the record and every value. aria-hidden: the hit lines announce
            them. Flips left when the anchor sits in the right third. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10"
            style={{
              left: `${(shownX / VBW) * 100}%`,
              top: `${(PAD.top / VBH) * 100}%`,
              transform: `translate(${shownX > PAD.left + PLOT_W * 0.6 ? 'calc(-100% - 12px)' : '12px'}, 0)`,
            }}
          >
            <div className="rounded-lg border border-white/10 bg-black/85 px-3 py-2 shadow-lg backdrop-blur-sm">
              <div className="mb-1.5 font-display text-sm font-bold leading-none tracking-tight text-[#DCF87C]">
                {shown.label}
              </div>
              <div className="flex flex-col gap-1 tabular-nums">
                {dimensions.map((d) => (
                  <div key={d.key} className="flex items-baseline justify-between gap-4">
                    <span className="text-[9px] uppercase leading-none tracking-[0.1em] text-white/35">{d.label}</span>
                    <span className="text-[12px] font-semibold leading-none text-white/85">
                      {fmt(Number(shown[d.key]))}
                      {d.unit ? ` ${d.unit}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The reading and the controls: how the brush has carved the bundle, and a
          way to clear it. Only shown once a brush exists. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/55">
        <span>
          Drag along any axis to brush a range; brush several to stack the filters.
        </span>
        {anyBrush && (
          <>
            <span className="text-white/80">
              Showing <span className="font-display font-bold tabular-nums text-[#DCF87C]">{keptCount}</span> of{' '}
              {data.length}
            </span>
            <button
              type="button"
              onClick={() => setBrushes({})}
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
            >
              Clear brushes
            </button>
          </>
        )}
      </div>

      {/* The accessible, always-there face of the bundle — every record and its
          values as a plain list, so the numbers never live only in the picture.
          Filtered-out records dim but stay readable. */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {lines.map((ln) => {
          const isActive = active === ln.i
          return (
            <li key={`${uid}-key-${ln.i}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(ln.i)}
                onMouseLeave={() => setActive((cur) => (cur === ln.i ? null : cur))}
                onFocus={() => setActive(ln.i)}
                onBlur={() => setActive((cur) => (cur === ln.i ? null : cur))}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
                style={{ opacity: ln.kept ? 1 : 0.4 }}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ln.color, opacity: isActive ? 1 : 0.8 }}
                  aria-hidden
                />
                <span className="text-xs uppercase tracking-[0.12em] text-white/45">{ln.rec.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
