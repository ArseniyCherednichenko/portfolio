import { useId } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// Nixie — the cold-cathode neon numeral tube of a 1960s instrument panel, the
// display technology the digital-display family did not have. Its neighbours are
// all cool and flat: the Odometer rolls mechanical wheels, the SplitFlap drops
// Solari flaps, the DotMatrix lights round lamps, the SevenSegment lights seven
// bars — and every one of them is the site's lime. A Nixie is the opposite of
// flat. Each glyph is a separate wire cathode shaped like a whole numeral, and
// the ten of them are stacked front-to-back inside one glass envelope; a chosen
// cathode is set glowing in a warm neon orange while the other nine sit unlit as
// a faint wire cage behind it. So the tell of a real tube is *depth* — you can
// see the numbers that are switched off, fanned back into the glass — and
// *warmth*: this is deliberately the one display on the site that is not lime,
// because a lime Nixie would not be a Nixie.
//
// Pure inline SVG, no font glyph faked as hardware and no canvas: the envelope,
// the anode mesh in front of the cathodes, the glass reflection and the base are
// all drawn, and the numerals are set in the page face so they stay crisp at any
// size in both themes. When a tube's digit changes, the old cathode's glow eases
// out as the new one rises — the little warm-up flicker that makes a running
// clock feel like glass and gas rather than pixels. The figure is aria-hidden;
// the value rides in the wrapper's label, so a screen reader hears "12:04", not a
// description of ten cathodes. Under reduced motion the crossfade is off, the
// glow bloom is dropped, and digits simply cut.

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

// Tube geometry in a 0..VW by 0..VH viewBox. The envelope is a tall capsule; the
// numeral sits in the upper glass, the bakelite base with its pin stubs below.
const VW = 120
const VH = 200
const GLASS_TOP = 6
const GLASS_BOT = 168
const NUM_CY = 84 // vertical centre of the numeral zone
const FONT = 128

type Glyph =
  | { kind: 'digit'; ch: string }
  | { kind: 'colon' }
  | { kind: 'space' }

function parse(value: string): Glyph[] {
  const out: Glyph[] = []
  for (const ch of Array.from(value)) {
    if (ch === ':') out.push({ kind: 'colon' })
    else if (ch === ' ') out.push({ kind: 'space' })
    else if (ch >= '0' && ch <= '9') out.push({ kind: 'digit', ch })
    else out.push({ kind: 'space' })
  }
  return out
}

export function Nixie({
  value,
  className = '',
  /** Tube height in CSS pixels; width tracks it. */
  height = 132,
  /** Neon cathode colour — warm amber by default, the real thing. */
  color = '#ff7a1a',
  /** Soft neon bloom around the lit cathode (off under reduced motion regardless). */
  glow = true,
}: {
  value: string
  className?: string
  height?: number
  color?: string
  glow?: boolean
}) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/[:]/g, '')
  const glyphs = parse(value)

  const tubeW = height * (VW / VH)
  const colonW = height * 0.32
  const spaceW = height * 0.24
  const bloom = glow && !reduce

  return (
    <div
      className={`inline-flex items-end ${className}`}
      style={{ gap: height * 0.05 }}
      role="img"
      aria-label={value}
    >
      {bloom && (
        <svg width="0" height="0" aria-hidden className="absolute">
          <filter id={`nx-glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </svg>
      )}
      {glyphs.map((g, i) => {
        if (g.kind === 'space') {
          return <span key={i} aria-hidden style={{ width: spaceW }} />
        }
        if (g.kind === 'colon') {
          const r = height * 0.045
          return (
            <svg
              key={i}
              aria-hidden
              width={colonW}
              height={height}
              viewBox={`0 0 ${colonW} ${height}`}
              className="block shrink-0"
            >
              <g style={{ filter: bloom ? `url(#nx-glow-${uid})` : undefined }}>
                <circle cx={colonW / 2} cy={height * 0.4} r={r} fill={color} />
                <circle cx={colonW / 2} cy={height * 0.6} r={r} fill={color} />
              </g>
            </svg>
          )
        }
        return (
          <NixieTube
            key={i}
            digit={g.ch}
            width={tubeW}
            height={height}
            color={color}
            uid={`${uid}-${i}`}
            bloom={bloom}
            reduce={!!reduce}
          />
        )
      })}
    </div>
  )
}

function NixieTube({
  digit,
  width,
  height,
  color,
  uid,
  bloom,
  reduce,
}: {
  digit: string
  width: number
  height: number
  color: string
  uid: string
  bloom: boolean
  reduce: boolean
}) {
  // Fan the ten unlit cathodes back into the glass: each sits a touch lower and
  // fainter than the last, so the switched-off numbers read as a wire cage in
  // depth behind the one that is lit — the detail that makes it a tube.
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VW} ${VH}`}
      className="block shrink-0"
      aria-hidden
    >
      <defs>
        <clipPath id={`nx-clip-${uid}`}>
          <rect x={GLASS_TOP} y={GLASS_TOP} width={VW - GLASS_TOP * 2} height={GLASS_BOT - GLASS_TOP} rx={26} />
        </clipPath>
        <radialGradient id={`nx-glass-${uid}`} cx="34%" cy="26%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Bakelite base with pin stubs */}
      <path
        d={`M28 ${GLASS_BOT - 6} H92 L88 ${VH - 20} H32 Z`}
        fill="#0c0c10"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
      />
      {[42, 54, 66, 78].map((x) => (
        <rect key={x} x={x} y={VH - 22} width={4} height={16} rx={1.5} fill="#2a2a30" />
      ))}

      {/* Glass envelope */}
      <rect
        x={GLASS_TOP}
        y={GLASS_TOP}
        width={VW - GLASS_TOP * 2}
        height={GLASS_BOT - GLASS_TOP}
        rx={26}
        fill="#070708"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={1.5}
      />

      <g clipPath={`url(#nx-clip-${uid})`}>
        {/* Unlit cathode cage, fanned into depth */}
        {DIGITS.map((d, idx) => {
          if (d === digit) return null
          const depth = idx / (DIGITS.length - 1)
          return (
            <text
              key={d}
              x={VW / 2}
              y={NUM_CY + 4 + depth * 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={FONT}
              fontWeight={300}
              fill={`rgba(255,150,80,${(0.05 - depth * 0.03).toFixed(3)})`}
            >
              {d}
            </text>
          )
        })}

        {/* The lit cathode */}
        <g style={{ filter: bloom ? `url(#nx-glow-${uid})` : undefined }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.text
              key={digit}
              x={VW / 2}
              y={NUM_CY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={FONT}
              fontWeight={400}
              fill={color}
              initial={reduce ? false : { opacity: 0, y: NUM_CY + 6 }}
              animate={{ opacity: 1, y: NUM_CY }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: NUM_CY - 6 }}
              transition={{ duration: reduce ? 0 : 0.28, ease: 'easeOut' }}
            >
              {digit}
            </motion.text>
          </AnimatePresence>
        </g>

        {/* Anode mesh in front of the cathodes */}
        <g stroke="rgba(255,255,255,0.045)" strokeWidth={0.8}>
          {Array.from({ length: 9 }, (_, k) => 20 + k * 10).map((x) => (
            <line key={`v${x}`} x1={x} y1={GLASS_TOP + 8} x2={x} y2={GLASS_BOT - 8} />
          ))}
          {Array.from({ length: 12 }, (_, k) => 18 + k * 12).map((y) => (
            <line key={`h${y}`} x1={16} y1={y} x2={VW - 16} y2={y} />
          ))}
        </g>

        {/* Glass reflection */}
        <rect
          x={GLASS_TOP}
          y={GLASS_TOP}
          width={VW - GLASS_TOP * 2}
          height={GLASS_BOT - GLASS_TOP}
          rx={26}
          fill={`url(#nx-glass-${uid})`}
        />
      </g>
    </svg>
  )
}
