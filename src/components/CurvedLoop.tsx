import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

interface CurvedLoopProps {
  /** The phrase to loop. A trailing separator is added if missing. */
  text: string
  /** Base drift speed in user units per frame (~60fps). Sign is set by `direction`. */
  speed?: number
  /** Direction the type travels along the curve at rest. */
  direction?: 'left' | 'right'
  /** How deep the arc bows, in viewBox units. Higher = more curve. */
  curveAmount?: number
  /** Allow grabbing the type to scrub it, flinging with carried velocity. */
  interactive?: boolean
  /** Classes for the outer wrapper. */
  className?: string
  /** Classes for the SVG text (size/weight/fill live here). */
  textClassName?: string
}

const VIEW_W = 1440
const VIEW_H = 200

/**
 * CurvedLoop — a line of type running along a curved path, looping forever.
 * Distinct from the straight Marquee and ScrollVelocity bands: the text is laid
 * on an SVG arc via <textPath> and its startOffset is driven every frame, so the
 * words ride the curve. When `interactive`, grabbing the band scrubs it and a
 * flick carries a decaying velocity on top of the base drift. Honest to AT via
 * role="img"/aria-label; the repeated glyphs are aria-hidden. Under reduced
 * motion it paints a single static frame — the phrase resolved on the curve,
 * no animation and no drag.
 */
export function CurvedLoop({
  text,
  speed = 1.4,
  direction = 'left',
  curveAmount = 340,
  interactive = true,
  className = '',
  textClassName = '',
}: CurvedLoopProps) {
  const reduce = useReducedMotion()
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const pathId = `curve-${rawId}`

  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const measureRef = useRef<SVGTextElement>(null)
  const textPathRef = useRef<SVGTextPathElement>(null)

  // One instance is `${text} ` — a trailing space keeps repeats from fusing.
  const unit = /\s$/.test(text) ? text : `${text}  `
  const [spacing, setSpacing] = useState(0)
  const [repeats, setRepeats] = useState(3)

  // A symmetric arc that dips below the baseline and rises off both edges, so
  // glyphs enter and leave past the viewBox rather than popping at a seam.
  const dip = VIEW_H / 2 + curveAmount * 0.15
  const pathD = `M -220,${VIEW_H / 2} Q ${VIEW_W / 2},${dip} ${VIEW_W + 220},${VIEW_H / 2}`

  // Measure one instance and the path once glyphs have laid out, then size the
  // repeat count to overrun the path so the loop never shows a gap.
  useLayoutEffect(() => {
    const measure = measureRef.current
    const path = pathRef.current
    if (!measure || !path) return
    const w = measure.getComputedTextLength()
    if (!w) return
    const len = path.getTotalLength()
    setSpacing(w)
    setRepeats(Math.max(2, Math.ceil((len + 440) / w) + 1))
  }, [unit, curveAmount])

  // Drive startOffset every frame: base drift plus a decaying fling. No React
  // state on the hot path — the attribute is written straight onto the node,
  // and the offset is wrapped within one instance width so it loops seamlessly.
  const offsetRef = useRef(0)
  const flingRef = useRef(0)
  const drag = useRef({ active: false, lastX: 0 })

  useEffect(() => {
    if (reduce || !spacing) return
    const tp = textPathRef.current
    if (!tp) return
    const dir = direction === 'left' ? -1 : 1
    let raf = 0

    const wrapOffset = (v: number) => {
      let o = v % spacing
      if (o > 0) o -= spacing
      return o
    }

    const tick = () => {
      if (!drag.current.active) {
        offsetRef.current = wrapOffset(offsetRef.current + dir * speed + flingRef.current)
        flingRef.current *= 0.94
        if (Math.abs(flingRef.current) < 0.01) flingRef.current = 0
      }
      tp.setAttribute('startOffset', `${offsetRef.current}`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, spacing, speed, direction])

  // Grab-to-scrub: convert screen dx into user units via the viewBox/client
  // ratio, carry the last delta as the release velocity.
  useEffect(() => {
    if (reduce || !interactive || !spacing) return
    const svg = svgRef.current
    const tp = textPathRef.current
    if (!svg || !tp) return

    const wrapOffset = (v: number) => {
      let o = v % spacing
      if (o > 0) o -= spacing
      return o
    }
    const scale = () => VIEW_W / (svg.clientWidth || VIEW_W)

    const down = (e: PointerEvent) => {
      drag.current = { active: true, lastX: e.clientX }
      flingRef.current = 0
      svg.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return
      const dx = (e.clientX - drag.current.lastX) * scale()
      drag.current.lastX = e.clientX
      offsetRef.current = wrapOffset(offsetRef.current + dx)
      flingRef.current = dx
      tp.setAttribute('startOffset', `${offsetRef.current}`)
    }
    const up = (e: PointerEvent) => {
      if (!drag.current.active) return
      drag.current.active = false
      try {
        svg.releasePointerCapture(e.pointerId)
      } catch {
        /* pointer already released */
      }
    }

    svg.addEventListener('pointerdown', down)
    svg.addEventListener('pointermove', move)
    svg.addEventListener('pointerup', up)
    svg.addEventListener('pointercancel', up)
    return () => {
      svg.removeEventListener('pointerdown', down)
      svg.removeEventListener('pointermove', move)
      svg.removeEventListener('pointerup', up)
      svg.removeEventListener('pointercancel', up)
    }
  }, [reduce, interactive, spacing])

  const loop = unit.repeat(repeats)
  const grabbable = interactive && !reduce

  return (
    <div className={`w-full ${className}`} role="img" aria-label={text.trim()}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={`block w-full overflow-visible ${grabbable ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
        aria-hidden
      >
        <defs>
          <path id={pathId} ref={pathRef} d={pathD} fill="none" />
        </defs>
        {/* Hidden single instance, used only to measure one loop's width. */}
        <text
          ref={measureRef}
          xmlSpace="preserve"
          className={textClassName}
          style={{ visibility: 'hidden' }}
          x={0}
          y={-9999}
        >
          {unit}
        </text>
        <text xmlSpace="preserve" className={textClassName}>
          <textPath ref={textPathRef} href={`#${pathId}`} startOffset={reduce ? '6%' : '0'}>
            {loop}
          </textPath>
        </text>
      </svg>
    </div>
  )
}
