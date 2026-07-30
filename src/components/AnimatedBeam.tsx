import { useEffect, useId, useState, type RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// AnimatedBeam — a beam of light that travels along a curved line drawn between
// two real DOM nodes. The connective kind the library was missing: not a light
// shaft (`Beams`) and not a border lap (`BorderBeam`), but a wire between two
// things you can point at — the Magic-UI / React-Bits signature, hand-built.
//
// The geometry is honest: it measures the container and the two node elements
// with getBoundingClientRect, so the path is always drawn between wherever the
// nodes actually are, and it re-measures on resize. The travelling light is a
// single SVG linear gradient whose coordinates sweep across the viewBox, so no
// per-frame React state runs — Framer animates the gradient's endpoints.
//
// Compose many of these over one relatively-positioned container to wire a hub
// to its spokes (see the About "How it fits together" node web). The SVG is
// absolutely positioned to fill the container and is `pointer-events-none` +
// `aria-hidden`, so it never intercepts a click and never speaks to AT.

export interface AnimatedBeamProps {
  /** The positioned box the beam is drawn inside; both nodes must live in it. */
  containerRef: RefObject<HTMLElement | null>
  /** The node the beam starts at. */
  fromRef: RefObject<HTMLElement | null>
  /** The node the beam ends at. */
  toRef: RefObject<HTMLElement | null>
  /** Arc height in px — positive bows the line up, negative down, 0 straight. */
  curvature?: number
  /** Reverse the direction the light travels along the line. */
  reverse?: boolean
  /** Seconds for one sweep of the light. */
  duration?: number
  /** Seconds before the first sweep, and between repeats. */
  delay?: number
  /** The resting line under the moving light. */
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  /** The two ends of the travelling light gradient. */
  gradientStartColor?: string
  gradientStopColor?: string
  /** Nudge either endpoint off the measured node centre (px). */
  startXOffset?: number
  startYOffset?: number
  endXOffset?: number
  endYOffset?: number
  className?: string
}

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 3,
  delay = 0,
  pathColor = '#ffffff',
  pathWidth = 1.5,
  pathOpacity = 0.12,
  gradientStartColor = '#DCF87C',
  gradientStopColor = '#8ad0ff',
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  className,
}: AnimatedBeamProps) {
  const reduce = useReducedMotion()
  const gradientId = useId().replace(/:/g, '')
  const [path, setPath] = useState('')
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const container = containerRef.current
    const from = fromRef.current
    const to = toRef.current

    const measure = () => {
      if (!container || !from || !to) return
      const c = container.getBoundingClientRect()
      const a = from.getBoundingClientRect()
      const b = to.getBoundingClientRect()
      if (c.width === 0 || c.height === 0) return

      const sx = a.left - c.left + a.width / 2 + startXOffset
      const sy = a.top - c.top + a.height / 2 + startYOffset
      const ex = b.left - c.left + b.width / 2 + endXOffset
      const ey = b.top - c.top + b.height / 2 + endYOffset

      // Control point: the midpoint, lifted perpendicular to the chord by the
      // curvature so the bow is consistent whatever the two nodes' angle.
      const mx = (sx + ex) / 2
      const my = (sy + ey) / 2
      const dx = ex - sx
      const dy = ey - sy
      const len = Math.hypot(dx, dy) || 1
      const cx = mx + (-dy / len) * curvature
      const cy = my + (dx / len) * curvature

      setBox({ w: c.width, h: c.height })
      setPath(`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`)
    }

    measure()

    const ro = new ResizeObserver(measure)
    if (container) ro.observe(container)
    if (from) ro.observe(from)
    if (to) ro.observe(to)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ])

  if (!path) {
    return (
      <svg
        aria-hidden
        className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
      />
    )
  }

  // The light sweeps left-to-right (or the reverse) across the whole viewBox in
  // user space, so the lit band rides the line regardless of its exact slope.
  const sweep = reverse
    ? { x1: ['90%', '-10%'], x2: ['100%', '0%'] }
    : { x1: ['10%', '110%'], x2: ['0%', '100%'] }

  return (
    <svg
      aria-hidden
      width={box.w}
      height={box.h}
      viewBox={`0 0 ${box.w} ${box.h}`}
      fill="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
    >
      {/* Resting line — the wire the light travels along. */}
      <path
        d={path}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      {/* The travelling light. Under reduced motion the gradient holds still. */}
      <path
        d={path}
        stroke={`url(#${gradientId})`}
        strokeWidth={pathWidth}
        strokeLinecap="round"
      />
      <defs>
        {reduce ? (
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0%" x2="100%">
            <stop stopColor={gradientStartColor} stopOpacity="0" />
            <stop offset="0.5" stopColor={gradientStartColor} stopOpacity="0.35" />
            <stop stopColor={gradientStopColor} stopOpacity="0" offset="1" />
          </linearGradient>
        ) : (
          <motion.linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
            animate={{ x1: sweep.x1, x2: sweep.x2, y1: ['0%', '0%'], y2: ['0%', '0%'] }}
            transition={{
              delay,
              duration,
              ease: [0.16, 1, 0.3, 1],
              repeat: Infinity,
              repeatDelay: 0,
            }}
          >
            <stop stopColor={gradientStartColor} stopOpacity="0" />
            <stop stopColor={gradientStartColor} />
            <stop offset="32.5%" stopColor={gradientStopColor} />
            <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
          </motion.linearGradient>
        )}
      </defs>
    </svg>
  )
}

export default AnimatedBeam
