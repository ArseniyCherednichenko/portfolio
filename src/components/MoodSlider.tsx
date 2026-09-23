import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useState } from 'react'
import { ElasticSlider } from './ElasticSlider'

// The five honest zones the value falls into, low to high. The readout and the
// slider's aria-valuetext both speak in these words rather than a bare number,
// so the control says what it means.
const ZONES: { from: number; label: string }[] = [
  { from: 0, label: 'Rough' },
  { from: 20, label: 'Low' },
  { from: 40, label: 'Okay' },
  { from: 60, label: 'Good' },
  { from: 80, label: 'Great' },
]

function zoneLabel(value: number): string {
  let label = ZONES[0].label
  for (const z of ZONES) if (value >= z.from) label = z.label
  return label
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Linear blend between two RGB triples, returned as an rgb() string so Framer
// can spring the fill from one mood colour to the next.
function mixColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(lerp(a[0], b[0], t))
  const g = Math.round(lerp(a[1], b[1], t))
  const bl = Math.round(lerp(a[2], b[2], t))
  return `rgb(${r}, ${g}, ${bl})`
}

// Cool slate when the mood is low, warming to the site's lime as it climbs.
const SAD_FILL: [number, number, number] = [91, 100, 112]
const HAPPY_FILL: [number, number, number] = [220, 248, 124]

/**
 * A mood slider whose face is the readout. Drag the track — or arrow the thumb —
 * and a hand-drawn SVG face morphs continuously with the value: the mouth swings
 * from a frown through a flat line to a broad smile, the brows unknit and lift,
 * the eyes brighten, the whole head tilts up, cheeks warm, and the face colour
 * travels from a cool slate to the site's lime. Every attribute is a Framer
 * motion target so the morph springs rather than snaps.
 *
 * The track underneath is a real ElasticSlider — the same tactile, keyboard- and
 * pointer-driven control used elsewhere — reused wholesale rather than rebuilt,
 * so the face is a controlled skin over a control that already handles a11y.
 * Under prefers-reduced-motion the springs give way to instant, exact states:
 * the face still reflects the value perfectly, just without the in-between
 * travel.
 */
export function MoodSlider({
  defaultValue = 50,
  value: controlledValue,
  onChange,
  label = 'How is it going',
  className = '',
}: {
  defaultValue?: number
  value?: number
  onChange?: (value: number) => void
  label?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const [uncontrolled, setUncontrolled] = useState(() => clamp(defaultValue, 0, 100))
  const value = clamp(controlledValue ?? uncontrolled, 0, 100)

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(next, 0, 100)
      if (controlledValue === undefined) setUncontrolled(clamped)
      onChange?.(clamped)
    },
    [controlledValue, onChange],
  )

  const t = value / 100

  // Mouth: a single quadratic. The corners lift a touch as it climbs; the
  // control point crosses the corner line from above (a frown) to well below (a
  // grin), so the same path structure interpolates cleanly end to end.
  const cornerY = 64 - t * 4
  const ctrlY = 60 + t * 24
  const mouthPath = `M 35 ${cornerY.toFixed(2)} Q 50 ${ctrlY.toFixed(2)} 65 ${cornerY.toFixed(2)}`

  // Brows: inner ends drop and knit together when low (concern), lift and relax
  // when high. Each side is a short line mirrored across the centre.
  const browInnerY = 35 - t * 4
  const browOuterY = 33 + (1 - t) * 4
  const leftBrow = `M 33 ${browOuterY.toFixed(2)} L 45 ${browInnerY.toFixed(2)}`
  const rightBrow = `M 67 ${browOuterY.toFixed(2)} L 55 ${browInnerY.toFixed(2)}`

  const eyeR = 3.4 + t * 1.6
  const faceFill = mixColor(SAD_FILL, HAPPY_FILL, t)
  const headTilt = (t - 0.5) * 8
  const blush = clamp((t - 0.62) / 0.38, 0, 1)

  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 260, damping: 22, mass: 0.6 }

  return (
    <div className={`w-full max-w-xs ${className}`}>
      <div className="flex justify-center">
        <motion.svg
          viewBox="0 0 100 100"
          role="img"
          aria-labelledby={titleId}
          className="h-40 w-40 sm:h-48 sm:w-48"
          animate={reduce ? undefined : { rotate: headTilt }}
          transition={spring}
          style={reduce ? { rotate: headTilt } : undefined}
        >
          <title id={titleId}>{`A face reading ${zoneLabel(value)}`}</title>

          {/* Face */}
          <motion.circle cx="50" cy="50" r="42" animate={{ fill: faceFill }} transition={spring} />
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />

          {/* Cheeks — warm blush that fades in only near the top of the range. */}
          <motion.circle cx="30" cy="58" r="5.5" fill="#f4a3b4" animate={{ opacity: blush * 0.55 }} transition={spring} />
          <motion.circle cx="70" cy="58" r="5.5" fill="#f4a3b4" animate={{ opacity: blush * 0.55 }} transition={spring} />

          {/* Brows */}
          <motion.path
            animate={{ d: leftBrow }}
            transition={spring}
            fill="none"
            stroke="#14180f"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <motion.path
            animate={{ d: rightBrow }}
            transition={spring}
            fill="none"
            stroke="#14180f"
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Eyes */}
          <motion.circle cx="38" cy="46" fill="#14180f" animate={{ r: eyeR }} transition={spring} />
          <motion.circle cx="62" cy="46" fill="#14180f" animate={{ r: eyeR }} transition={spring} />

          {/* Mouth */}
          <motion.path
            animate={{ d: mouthPath }}
            transition={spring}
            fill="none"
            stroke="#14180f"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </motion.svg>
      </div>

      <div className="mt-6">
        <ElasticSlider
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={commit}
          label={label}
          format={zoneLabel}
        />
      </div>
    </div>
  )
}
