import { useEffect, useMemo, useRef, useState } from 'react'
import { useAnimationFrame, useReducedMotion } from 'framer-motion'
import { useFinePointer } from '../hooks/useFinePointer'

/**
 * CurvedLoop — editorial text that flows along a curved SVG path, in the spirit
 * of React Bits' CurvedLoop. A *kind* of motion the site did not have: type that
 * follows a path rather than a straight line (the straight `ScrollVelocity`
 * band), a full circle (`CircularText`), or a flat marquee.
 *
 * The line is one `<textPath>` carrying the phrase repeated enough times to
 * overflow the curve; its `startOffset` is advanced every frame and wrapped by
 * exactly one phrase-length, so the loop is seamless. On a fine pointer it is
 * draggable — dragging scrubs the offset 1:1 (converted from client px to SVG
 * user units) and the release carries the throw as an inertial **fling** that
 * decays back into the base drift. No per-frame React state: the offset is a
 * ref written straight onto the `<textPath>` via `setAttribute`.
 *
 * Honest to assistive tech: the wrapper is `role="img"` with the real phrase as
 * `aria-label`, and the decorative SVG is `aria-hidden`. Under reduced motion it
 * renders the phrase once along the curve, centred and still, with no loop,
 * listeners, or drag.
 */
export function CurvedLoop({
  text,
  /** Base drift in SVG user units per second. Sign is overridden by `direction`. */
  speed = 60,
  /** How far the mid-path control point dips — larger is a deeper wave. */
  curveAmount = 320,
  direction = 'left',
  interactive = true,
  className = '',
}: {
  text: string
  speed?: number
  curveAmount?: number
  direction?: 'left' | 'right'
  interactive?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const canDrag = interactive && fine && !reduce

  // A stable, deterministic id so the <path> and <textPath> href match without
  // Math.random / useId churn across the repeated instances.
  const pathId = useMemo(
    () => 'curve-' + text.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase() + '-' + curveAmount,
    [text, curveAmount],
  )

  // The viewBox height is derived from curveAmount so the arc always fits: the
  // apex of the baseline lands exactly one ascender-height below the top, and
  // the endpoints leave a descender's room above the bottom. This keeps any
  // curve — gentle or deep — fully framed without clipping the glyphs.
  const VB_W = 1440
  const ASC = 82 // room above the baseline for caps/ascenders at 76px
  const DESC = 30 // room below the baseline for descenders
  const midY = ASC + curveAmount / 2 // endpoint baseline; apex sits at ASC
  const VB_H = midY + DESC + 6
  // A single quadratic bow spanning wider than the viewBox, so the type runs off
  // both edges instead of stopping inside the frame.
  const d = `M-260,${midY} Q ${VB_W / 2},${midY - curveAmount} ${VB_W + 260},${midY}`

  // Always end the phrase with a spacer so repeats never butt letters together.
  const phrase = useMemo(() => (text.endsWith(' ') ? text : text + '  '), [text])

  const measureRef = useRef<SVGTextElement>(null)
  const textPathRef = useRef<SVGTextPathElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Length in user units of one copy of the phrase — measured once rendered.
  const [spacing, setSpacing] = useState(0)

  // Enough copies to overflow the path (~1960 user units) plus a margin, so a
  // wrap by one phrase-length is always covered by a following copy.
  const repeated = useMemo(() => {
    const copies = spacing ? Math.ceil(2200 / spacing) + 2 : 8
    return phrase.repeat(copies)
  }, [phrase, spacing])

  useEffect(() => {
    if (measureRef.current) {
      const len = measureRef.current.getComputedTextLength()
      if (len > 0) setSpacing(len)
    }
  }, [phrase, className])

  // Imperative offset state (ref, not React state) driven by the RAF loop.
  const offset = useRef(0)
  const velocity = useRef(0) // fling velocity, decays back to base drift
  const dirSign = direction === 'left' ? -1 : 1

  // --- drag scrubbing (fine pointers only) ---
  const drag = useRef<{ active: boolean; lastX: number; vx: number }>({
    active: false,
    lastX: 0,
    vx: 0,
  })

  // Client px -> SVG user units on the x axis.
  const pxToUser = (px: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return px
    return px * (VB_W / rect.width)
  }

  useAnimationFrame((_, delta) => {
    if (reduce || !spacing) return
    const dt = Math.min(delta, 64) / 1000

    if (drag.current.active) {
      // While grabbed the pointer drives the offset directly (see onPointerMove).
    } else {
      // Base drift plus any leftover fling velocity, which eases away.
      velocity.current *= Math.exp(-dt / 0.5)
      if (Math.abs(velocity.current) < 1) velocity.current = 0
      offset.current += (dirSign * speed + velocity.current) * dt
    }

    // Seamless wrap by exactly one phrase-length.
    let o = offset.current % spacing
    if (o > 0) o -= spacing // keep it in (-spacing, 0]
    offset.current = o
    textPathRef.current?.setAttribute('startOffset', String(o))
  })

  // Reduced-motion / SSR fallback: a single centred, still startOffset.
  const staticOffset = spacing ? -spacing / 2 : 0

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDrag) return
    drag.current = { active: true, lastX: e.clientX, vx: 0 }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    const dx = pxToUser(e.clientX - drag.current.lastX)
    drag.current.lastX = e.clientX
    drag.current.vx = dx // smoothed enough for a throw at 60fps
    offset.current += dx
    let o = offset.current % spacing
    if (o > 0) o -= spacing
    offset.current = o
    textPathRef.current?.setAttribute('startOffset', String(o))
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    // Convert the last per-frame delta into a per-second fling, capped.
    velocity.current = Math.max(-2600, Math.min(2600, drag.current.vx * 60))
    drag.current.active = false
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      role="img"
      aria-label={text.trim()}
      className={`w-full select-none ${className}`}
    >
      <svg
        ref={svgRef}
        aria-hidden
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={`w-full overflow-visible ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ touchAction: canDrag ? 'pan-y' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <defs>
          <path id={pathId} d={d} fill="none" />
        </defs>

        {/* Hidden single-copy measurer — same font/size as the visible line. */}
        <text
          ref={measureRef}
          xmlSpace="preserve"
          className="font-display font-semibold"
          style={{ visibility: 'hidden', fontSize: '76px' }}
        >
          {phrase}
        </text>

        <text
          xmlSpace="preserve"
          fill="currentColor"
          className="font-display font-semibold"
          style={{ fontSize: '76px' }}
        >
          <textPath
            ref={textPathRef}
            href={`#${pathId}`}
            startOffset={reduce ? staticOffset : 0}
          >
            {reduce ? phrase : repeated}
          </textPath>
        </text>
      </svg>
    </div>
  )
}
