import { useMemo, type CSSProperties } from 'react'

// ProgressiveBlur — a true, gradual blur that ramps from perfectly sharp to
// fully soft across one edge, the effect you see behind a floating iOS tab bar,
// the Family app's headers, or a Vercel section fade. It is the honest version
// of the trick most sites fake: a single `backdrop-filter: blur()` under a
// fading gradient does NOT ramp the blur — it blurs everything by one fixed
// amount and merely fades that blurred layer's opacity, so text under the soft
// end still reads as a crisp ghost. A real progressive blur needs the blur
// *radius itself* to climb toward the edge.
//
// The technique: stack several full-size layers, each a little blurrier than
// the last, and give every layer a linear-gradient MASK — an opaque band that
// slides one step further toward the edge on each layer. Where two windows
// overlap, their blur amounts sum visually, so the result is a smooth ramp
// rather than visible bands. The blur radii climb exponentially (…, ×2, ×2),
// which is what makes the ramp read as even to the eye rather than bunched at
// the sharp end.
//
// It is a passive overlay: `position: absolute`, `pointer-events-none`, and
// `aria-hidden`, so it never eats clicks or reaches a screen reader — drop it
// inside any `position: relative` scroll container to dissolve that edge. No
// animation of its own; it respects reduced motion by simply being static.

type Side = 'top' | 'bottom' | 'left' | 'right'

// The CSS gradient direction that makes the blur intensify toward `side`. The
// mask windows march from 0% (sharp) to 100% (the named edge), so the gradient
// must point *at* that edge for layer 0 to sit at the far, sharp end.
const DIRECTION: Record<Side, string> = {
  top: 'to top',
  bottom: 'to bottom',
  left: 'to left',
  right: 'to right',
}

// Which edge the overlay pins to, and how it spans the cross axis. `size` sets
// the extent along the blur axis; the cross axis is always pinned to 0/0.
function positionFor(side: Side, size: string): CSSProperties {
  switch (side) {
    case 'top':
      return { top: 0, left: 0, right: 0, height: size }
    case 'bottom':
      return { bottom: 0, left: 0, right: 0, height: size }
    case 'left':
      return { top: 0, bottom: 0, left: 0, width: size }
    case 'right':
      return { top: 0, bottom: 0, right: 0, width: size }
  }
}

export interface ProgressiveBlurProps {
  /** Which edge the blur intensifies toward. Default `'bottom'`. */
  side?: Side
  /** Extent of the blur region along its axis — any CSS length. Default `'6rem'`. */
  size?: string
  /** The maximum blur radius in px, reached at the very edge. Default `8`. */
  blur?: number
  /**
   * How many stacked layers build the ramp. More layers = smoother, at a small
   * cost. The proven sweet spot is 5–8. Default `6`.
   */
  layers?: number
  /** Extra classes for the wrapper (e.g. z-index, rounded corners to clip to). */
  className?: string
  style?: CSSProperties
}

/**
 * A layered, mask-driven progressive blur overlay. Place it as the last child
 * of a `position: relative` container whose content should dissolve at one
 * edge. Purely decorative — non-interactive and hidden from assistive tech.
 */
export function ProgressiveBlur({
  side = 'bottom',
  size = '6rem',
  blur = 8,
  layers = 6,
  className = '',
  style,
}: ProgressiveBlurProps) {
  const dir = DIRECTION[side]

  // Build the layer stack once per (layers, blur, side). Each layer i owns a
  // sliding opaque window three steps wide and a blur radius that doubles as i
  // climbs, normalised so the outermost layer lands exactly on `blur` px.
  const stack = useMemo(() => {
    const n = Math.max(1, Math.round(layers))
    const step = 100 / n
    return Array.from({ length: n }, (_, i) => {
      // Exponential ramp: the last layer (i = n-1) is exactly `blur` px, each
      // earlier layer half the next. A single layer just gets the full radius.
      const radius = n === 1 ? blur : blur * Math.pow(2, i - (n - 1))
      // A window opaque from i*step to (i+2)*step, feathered one step on each
      // side, sliding toward the named edge as i grows. Clamped to 100%.
      const a = Math.min(100, i * step)
      const b = Math.min(100, (i + 1) * step)
      const c = Math.min(100, (i + 2) * step)
      const d = Math.min(100, (i + 3) * step)
      const mask = `linear-gradient(${dir}, transparent ${a}%, #000 ${b}%, #000 ${c}%, transparent ${d}%)`
      const filter = `blur(${radius.toFixed(2)}px)`
      const layerStyle: CSSProperties = {
        position: 'absolute',
        inset: 0,
        backdropFilter: filter,
        WebkitBackdropFilter: filter,
        maskImage: mask,
        WebkitMaskImage: mask,
      }
      return { key: i, style: layerStyle }
    })
  }, [layers, blur, dir])

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ ...positionFor(side, size), ...style }}
    >
      {stack.map((l) => (
        <div key={l.key} style={l.style} />
      ))}
    </div>
  )
}

export default ProgressiveBlur
