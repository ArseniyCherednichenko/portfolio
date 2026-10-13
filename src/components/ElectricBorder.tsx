import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// ElectricBorder — a rounded frame whose whole edge is alive, wavering like a
// live electric filament. The border is an SVG rounded rect whose stroke is run
// through an feTurbulence → feDisplacementMap filter, so the crisp line is
// pushed into an organic, trembling path; the turbulence's baseFrequency breathes
// on a loop (SMIL `<animate>`, so there is no RAF and the wriggle loops seamlessly),
// which makes the whole frame crackle in place. A blurred copy of the same
// displaced stroke sits behind it as a halo, so the edge reads as glowing current
// rather than a plain line.
//
// Deliberately distinct from its nearest neighbours. BorderBeam sends one bright
// comet orbiting a still ring (a travelling point of light); this keeps the light
// everywhere and makes the *whole* edge tremble. Lightning draws a field of
// filaments arcing between drifting anchors across a surface; this is a single
// treatment bound to one rounded rect, framing whatever it wraps. Nothing travels
// and nothing is a canvas — it is a self-contained, declarative overlay.
//
// Drop it *inside* any `relative` rounded surface as a sibling of the content; it
// is an `aria-hidden`, `pointer-events-none` span that fills the box, measures the
// host with a ResizeObserver so the stroke stays crisp at any size (no viewBox
// distortion), and sets its rect's corner radius from `radius` to follow the host
// corners. Let the glow show by not clipping the host (`overflow-visible`); a host
// with `overflow-hidden` simply trims the bloom and the edge still reads.
//
// Reduced motion drops the turbulence animation *and* the displacement entirely:
// the frame renders as a calm, still double-stroke (a soft halo under a crisp
// line), so the surface still reads as framed and lit without any motion.

export function ElectricBorder({
  className = '',
  /** Corner radius in px — match the host's rounding. */
  radius = 24,
  /** The current's colour. */
  color = '#DCF87C',
  /** Core stroke width in px. */
  thickness = 1.4,
  /** How far the turbulence pushes the stroke — the raggedness of the arc. */
  chaos = 1,
  /** Relative animation speed; 1 is the calm default. */
  speed = 1,
  /** Overall brightness of the glow halo, 0–1+. */
  intensity = 1,
}: {
  className?: string
  radius?: number
  color?: string
  thickness?: number
  chaos?: number
  speed?: number
  intensity?: number
}) {
  const reduce = useReducedMotion()
  const hostRef = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const rawId = useId()
  const uid = rawId.replace(/[:]/g, '')
  const coreId = `eb-core-${uid}`
  const glowId = `eb-glow-${uid}`

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  // Seat the base stroke a few px inside so the displaced line and its blur have
  // room before the box edge; the filter regions below reach well past this.
  const pad = Math.max(thickness * 2, 6)
  const rw = Math.max(0, w - pad * 2)
  const rh = Math.max(0, h - pad * 2)
  const rx = Math.min(radius, rw / 2, rh / 2)
  // A longer period reads calmer; `speed` scales it.
  const dur = Math.max(1.5, 7 / Math.max(0.2, speed))
  const scale = 14 * chaos

  // One shared rect geometry, stroked twice (halo + core).
  const rectProps = {
    x: pad,
    y: pad,
    width: rw,
    height: rh,
    rx,
    ry: rx,
    fill: 'none',
    stroke: color,
  }

  return (
    <span
      ref={hostRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      {w > 0 && h > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 overflow-visible"
          style={{ display: 'block' }}
        >
          <defs>
            {/* Core: displacement only — a crisp, trembling line. */}
            <filter id={coreId} x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.018 0.022"
                numOctaves={2}
                seed={7}
                result="noise"
              >
                {!reduce && (
                  <animate
                    attributeName="baseFrequency"
                    dur={`${dur}s`}
                    values="0.018 0.022;0.028 0.015;0.014 0.026;0.018 0.022"
                    keyTimes="0;0.34;0.67;1"
                    calcMode="spline"
                    keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                    repeatCount="indefinite"
                  />
                )}
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={reduce ? 0 : scale}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* Glow: the same displacement, then a Gaussian bloom. */}
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.018 0.022"
                numOctaves={2}
                seed={7}
                result="noise"
              >
                {!reduce && (
                  <animate
                    attributeName="baseFrequency"
                    dur={`${dur}s`}
                    values="0.018 0.022;0.028 0.015;0.014 0.026;0.018 0.022"
                    keyTimes="0;0.34;0.67;1"
                    calcMode="spline"
                    keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                    repeatCount="indefinite"
                  />
                )}
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={reduce ? 0 : scale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />
              <feGaussianBlur in="displaced" stdDeviation={reduce ? 2.5 : 4.5} />
            </filter>
          </defs>

          {/* Outer bloom — wide, soft, dim. */}
          <rect
            {...rectProps}
            strokeWidth={thickness * 3.4}
            opacity={0.32 * intensity}
            filter={`url(#${glowId})`}
          />
          {/* Inner halo — tighter, brighter. */}
          <rect
            {...rectProps}
            strokeWidth={thickness * 1.8}
            opacity={0.55 * intensity}
            filter={`url(#${glowId})`}
          />
          {/* Core — the crisp trembling line. */}
          <rect {...rectProps} strokeWidth={thickness} filter={`url(#${coreId})`} />
        </svg>
      )}
    </span>
  )
}
