import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, wrap } from 'framer-motion'

export interface InfiniteScrollItem {
  /** Stable key for the row. */
  key: string
  /** Row contents — any node. */
  content: ReactNode
}

// How fast a fling from a drag release bleeds back to the base drift. Larger
// = the throw carries for longer before the column settles.
const FLING_TAU = 0.5
// A drag release can fling no faster than this (px/s), so a hard flick can't
// send the column into a blur.
const MAX_FLING = 2600

export interface InfiniteScrollProps {
  items: InfiniteScrollItem[]
  /** Base drift in px/s. */
  speed?: number
  /** Which way the column drifts on its own. */
  direction?: 'up' | 'down'
  /** Freeze the drift while the pointer rests on the column. */
  pauseOnHover?: boolean
  /** A gentle slant (deg, Z axis) for the isometric look. 0 keeps it upright. */
  tilt?: number
  /** Vertical rhythm between rows, in px. */
  gap?: number
  /** Height of the viewport window the column scrolls inside. */
  height?: string
  className?: string
  itemClassName?: string
}

/**
 * A vertical, seamless-looping column, React Bits style: the rows drift on
 * their own, you can grab and fling them with pointer or touch, and a release
 * carries momentum that decays back into the base drift. Two stacked copies of
 * the list are wrapped across one copy's height so the loop never seams, and a
 * soft gradient mask dissolves the rows at the top and bottom edges.
 *
 * Under prefers-reduced-motion it becomes a plain, native-scrolling column with
 * no drift, no transforms, and no clipping of the reading order.
 */
export function InfiniteScroll({
  items,
  speed = 32,
  direction = 'up',
  pauseOnHover = true,
  tilt = 0,
  gap = 16,
  height = '22rem',
  className = '',
  itemClassName = '',
}: InfiniteScrollProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div
        className={`overflow-y-auto rounded-3xl ${className}`}
        style={{ height }}
        role="list"
        aria-label="Scrolling list"
      >
        <div className="flex flex-col" style={{ gap }}>
          {items.map((it) => (
            <div key={it.key} role="listitem" className={itemClassName}>
              {it.content}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <MotionColumn {...{ items, speed, direction, pauseOnHover, tilt, gap, height, className, itemClassName }} />
}

function MotionColumn({
  items,
  speed = 32,
  direction = 'up',
  pauseOnHover = true,
  tilt = 0,
  gap = 16,
  height = '22rem',
  className = '',
  itemClassName = '',
}: InfiniteScrollProps) {
  const y = useMotionValue(0)
  const copyRef = useRef<HTMLDivElement>(null)
  const [copyH, setCopyH] = useState(0)

  // One copy's height, padding included, so two stacked copies keep a seamless
  // rhythm and the wrap distance matches the loop exactly.
  useLayoutEffect(() => {
    const el = copyRef.current
    if (!el) return
    const measure = () => setCopyH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items, gap])

  const drift = direction === 'up' ? -Math.abs(speed) : Math.abs(speed)
  const fling = useRef(0)
  const hovering = useRef(false)
  const dragging = useRef(false)
  const lastY = useRef(0)
  const lastT = useRef(0)

  const wrapY = (v: number) => (copyH ? wrap(-copyH, 0, v) : v)

  useAnimationFrame((_, delta) => {
    if (!copyH || dragging.current) return
    const dt = Math.min(delta, 64) / 1000
    // Momentum from a release decays exponentially back toward the base drift.
    fling.current *= Math.exp(-dt / FLING_TAU)
    if (Math.abs(fling.current) < 1) fling.current = 0
    const paused = hovering.current && pauseOnHover && fling.current === 0
    const v = (paused ? 0 : drift) + fling.current
    if (v !== 0) y.set(wrapY(y.get() + v * dt))
  })

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    fling.current = 0
    lastY.current = e.clientY
    lastT.current = performance.now()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const now = performance.now()
    const dy = e.clientY - lastY.current
    const dt = (now - lastT.current) / 1000
    y.set(wrapY(y.get() + dy))
    if (dt > 0) {
      // Blend the instantaneous pointer speed so a jitter doesn't spike it.
      const inst = dy / dt
      fling.current = fling.current * 0.6 + inst * 0.4
    }
    lastY.current = e.clientY
    lastT.current = now
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    fling.current = Math.max(-MAX_FLING, Math.min(MAX_FLING, fling.current))
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const Copy = ({ hidden }: { hidden?: boolean }) => (
    <div
      ref={hidden ? undefined : copyRef}
      aria-hidden={hidden || undefined}
      className="flex flex-col"
      style={{ gap, paddingBottom: gap }}
    >
      {items.map((it) => (
        <div key={it.key} className={itemClassName}>
          {it.content}
        </div>
      ))}
    </div>
  )

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        height,
        // Dissolve rows into the top and bottom edges.
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)',
        maskImage: 'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)',
        perspective: tilt ? '1200px' : undefined,
      }}
    >
      <div
        className="h-full cursor-grab touch-none select-none active:cursor-grabbing"
        style={tilt ? { transform: `rotateZ(${tilt}deg)`, transformStyle: 'preserve-3d' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => (hovering.current = true)}
        onPointerLeave={() => (hovering.current = false)}
      >
        <motion.div style={{ y }} className="will-change-transform">
          <Copy />
          <Copy hidden />
        </motion.div>
      </div>
    </div>
  )
}
