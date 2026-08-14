import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// RadarChart — the site's fourth piece of data-viz, and the shape the chart
// family had not yet drawn. The DonutChart splits one whole at a single instant;
// the AreaChart tracks one number across an ordered axis; the BarChart stands
// discrete categories up to be compared by height. This answers a different
// question again — "what is the overall SHAPE of a set measured on several axes
// at once?" — by spoking those categories out from a shared centre and joining
// their values into one silhouette, so balance (or lopsidedness) reads at a
// glance rather than value by value.
//
// It keeps the family's rules. No plotting library: just SVG polygons, a
// computed round-number scale, and one Framer Motion move. And it holds to a
// SINGLE hue — a radar plots one series, one shape, so like the AreaChart there
// is nothing for a second colour to tell apart; the whole silhouette is one
// lime, the axes are named by their own labels, and each vertex carries its own
// readout, so nothing rests on colour alone.
//
// The reveal is a bloom: the silhouette scales up from the centre point to its
// full reach, the vertices arriving with it. Under reduced motion it is simply
// present at full size from the first frame — the finished shape, no growth. It
// is quietly interactive: hover or focus a vertex (each is a real button, so the
// whole set is keyboard-reachable) and a readout floats beside it while its axis
// label lights and the rest settle back. The SVG carries a full text summary for
// a screen reader, and a visible readout list sits beneath so the numbers never
// live only in the picture.

export interface RadarDatum {
  label: string
  value: number
}

// A square drawing surface, in viewBox units. The plot is a circle centred in
// it; the margin around the outer ring leaves room for the axis labels, which
// sit just outside each spoke.
const VB = 460
const C = VB / 2
const R = 148 // outer ring radius (the axis maximum)
const LABEL_GAP = 26 // how far a label floats beyond the outer ring

/**
 * Round a raw maximum up to a friendly ring top and hand back the tick values
 * that divide it evenly, so the concentric rings land on round numbers a reader
 * can count by (5s, 10s, 25s) instead of whatever the data peaked at. Aims for
 * roughly four rings. Shared shape with the BarChart's axis, so the two read as
 * one family.
 */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] }
  const rough = max / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = mag * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v))
  return { top, ticks }
}

interface Vertex extends RadarDatum {
  index: number
  /** Angle in radians, 0 = straight up, going clockwise. */
  angle: number
  /** Point on the data silhouette. */
  x: number
  y: number
  /** Point on the outer ring for this axis (where the label anchors). */
  ax: number
  ay: number
  /** Text anchoring for the label, by which side of the circle it sits on. */
  anchor: 'start' | 'middle' | 'end'
  /** Fractional coords of the vertex, for the HTML readout overlay. */
  fx: number
  fy: number
}

/** Point at radius `r` along `angle` (0 = up, clockwise), from the centre. */
function polar(r: number, angle: number): { x: number; y: number } {
  return { x: C + r * Math.sin(angle), y: C - r * Math.cos(angle) }
}

export function RadarChart({
  data,
  unit,
  valuePrefix = '',
  className = '',
  ariaLabel,
}: {
  data: RadarDatum[]
  /** Optional short noun shown after a value in the readout, e.g. "pages". */
  unit?: string
  /** Optional string shown before a value, e.g. "+". */
  valuePrefix?: string
  className?: string
  /** Overrides the generated screen-reader summary of the whole chart. */
  ariaLabel?: string
}) {
  const reduce = useReducedMotion() ?? false
  const uid = useId()
  const [active, setActive] = useState<number | null>(null)

  const { vertices, ticks, top } = useMemo(() => {
    if (data.length === 0) {
      return { vertices: [] as Vertex[], ticks: [0], top: 1 }
    }
    const max = Math.max(...data.map((d) => d.value), 0)
    const { top: t, ticks: tk } = niceScale(max)
    const n = data.length
    const list: Vertex[] = data.map((d, i) => {
      const angle = (i / n) * Math.PI * 2
      const r = t > 0 ? (d.value / t) * R : 0
      const p = polar(r, angle)
      const a = polar(R + LABEL_GAP, angle)
      const cos = Math.sin(angle) // horizontal component (x): sin because 0 = up
      const anchor: Vertex['anchor'] =
        Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end'
      return {
        ...d,
        index: i,
        angle,
        x: p.x,
        y: p.y,
        ax: a.x,
        ay: a.y,
        anchor,
        fx: p.x / VB,
        fy: p.y / VB,
      }
    })
    return { vertices: list, ticks: tk, top: t }
  }, [data])

  const n = vertices.length
  const shown = active != null ? vertices[active] : null

  // The filled silhouette, as an SVG polygon points string.
  const polygon = vertices.map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ')

  const summary =
    ariaLabel ??
    `Radar chart of ${n} measures${unit ? ` in ${unit}` : ''}: ` +
      vertices.map((v) => `${v.label}, ${valuePrefix}${v.value}`).join('; ') +
      '.'

  return (
    <div className={`w-full ${className}`}>
      <div className="relative mx-auto w-full max-w-[30rem]" style={{ aspectRatio: '1 / 1' }}>
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={summary}
        >
          {/* Concentric rings at the round tick values, and a small radial scale
              read up the top spoke, so the silhouette is measured against
              countable numbers rather than a bare web. */}
          {ticks.map((t, ti) => {
            if (t === 0) return null
            const rr = top > 0 ? (t / top) * R : 0
            // Ring drawn as a regular n-gon so it shares the silhouette's facets,
            // not a circle floating behind an angular shape.
            const ringPts = vertices
              .map((v) => {
                const p = polar(rr, v.angle)
                return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
              })
              .join(' ')
            const isOuter = ti === ticks.length - 1
            return (
              <g key={`${uid}-ring-${t}`}>
                {n >= 3 ? (
                  <polygon
                    points={ringPts}
                    fill="none"
                    stroke={isOuter ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={1}
                  />
                ) : (
                  <circle
                    cx={C}
                    cy={C}
                    r={rr}
                    fill="none"
                    stroke={isOuter ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={1}
                  />
                )}
                <text
                  x={C + 5}
                  y={C - rr}
                  dominantBaseline="middle"
                  className="fill-white/30"
                  style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                >
                  {t}
                </text>
              </g>
            )
          })}

          {/* Spokes out to each axis, and the axis label just past the ring. The
              active axis lights; the rest stay quiet. */}
          {vertices.map((v, i) => {
            const outer = polar(R, v.angle)
            const isActive = active === i
            return (
              <g key={`${uid}-axis-${v.label}`}>
                <line
                  x1={C}
                  y1={C}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={isActive ? 'rgba(220,248,124,0.35)' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={1}
                  style={{ transition: 'stroke 0.2s ease' }}
                />
                <text
                  x={v.ax}
                  y={v.ay}
                  textAnchor={v.anchor}
                  dominantBaseline="middle"
                  className={isActive ? 'fill-white/85' : 'fill-white/45'}
                  style={{ fontSize: 14, transition: 'fill 0.2s ease' }}
                >
                  {v.label}
                </text>
              </g>
            )
          })}

          {/* The silhouette — fill + stroke — and its vertices, blooming out from
              the centre together. transform-box: view-box pins the scale origin
              to the chart centre in viewBox units, so the shape grows from the
              middle rather than its own bounding box. */}
          {n >= 2 && (
            <motion.g
              initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              whileInView={reduce ? undefined : { scale: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformBox: 'view-box', transformOrigin: `${C}px ${C}px` }}
            >
              <polygon
                points={polygon}
                fill="rgba(220, 248, 124, 0.14)"
                stroke="rgba(220, 248, 124, 0.9)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {vertices.map((v, i) => (
                <circle
                  key={`${uid}-dot-${v.label}`}
                  cx={v.x}
                  cy={v.y}
                  r={active === i ? 5 : 3.5}
                  fill={active === i ? '#ffffff' : '#DCF87C'}
                  style={{ transition: 'r 0.2s ease, fill 0.2s ease' }}
                />
              ))}
            </motion.g>
          )}

          {/* A ring around the active vertex, drawn at its final position (outside
              the animated group) so the highlight is exact whatever the reveal is
              doing. */}
          {shown && (
            <circle
              cx={shown.x}
              cy={shown.y}
              r={9}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.5}
              opacity={0.7}
            />
          )}

          {/* Per-vertex hit targets — a generous transparent disc at each final
              vertex so the whole set is hoverable and keyboard-reachable. Each is
              a real button announcing its own axis and value. */}
          {vertices.map((v, i) => (
            <circle
              key={`${uid}-hit-${v.label}`}
              cx={v.x}
              cy={v.y}
              r={16}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${v.label}: ${valuePrefix}${v.value}${unit ? ` ${unit}` : ''}`}
              className="cursor-pointer focus:outline-none"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((cur) => (cur === i ? null : cur))}
            />
          ))}
        </svg>

        {/* Floating readout beside the active vertex. aria-hidden: the hit target
            buttons already announce label and value. Nudged toward the centre so
            it never runs off the edge of the plot. */}
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(shown.fx * 0.82 + 0.09) * 100}%`,
              top: `${(shown.fy * 0.82 + 0.09) * 100}%`,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-white/10 bg-black/85 px-3 py-1.5 text-center shadow-lg backdrop-blur-sm">
              <div className="font-display text-base font-bold leading-none tracking-tight text-[#DCF87C]">
                {valuePrefix}
                {shown.value}
                {unit && <span className="ml-1 text-[11px] font-medium text-white/40">{unit}</span>}
              </div>
              <div className="mt-1 text-[11px] leading-none text-white/55">{shown.label}</div>
            </div>
          </div>
        )}
      </div>

      {/* The accessible, always-there face of the set — a plain readout of every
          axis, so the numbers never rest on the picture alone. */}
      <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
        {vertices.map((v, i) => {
          const isActive = active === i
          return (
            <li key={`${uid}-key-${v.label}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                className={`flex items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-white/10 transition-transform"
                  style={{
                    background: '#DCF87C',
                    transform: isActive ? 'scale(1.35)' : 'scale(1)',
                  }}
                />
                <span
                  className={`text-xs uppercase tracking-[0.12em] transition-colors ${
                    isActive ? 'text-white/80' : 'text-white/45'
                  }`}
                >
                  {v.label}
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-white/85">
                  {valuePrefix}
                  {v.value}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
