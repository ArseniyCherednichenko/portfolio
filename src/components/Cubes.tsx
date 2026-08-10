import { useState, useMemo, useRef, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'

// Cubes: an isometric field of extruded blocks that rise toward the cursor.
//
// The pointer-field family already has flat dots (DotGrid), needles
// (MagnetLines), a lattice (Squares), heat squares (PixelTrail) and canvas
// simulations (Truchet/Morphogen/Phyllotaxis) — but nothing with real height.
// This is the family's first *volumetric* surface: a grid of little cubes laid
// on an isometric ground plane, each built from a top face and two lit walls in
// pure CSS 3D (no canvas, no WebGL). The block your pointer is over lifts, its
// top face lighting lime, and a ripple radiates outward — nearer cubes rise
// first and higher, farther ones a beat later and less, via a per-cube
// transition-delay keyed to grid distance, so the raise reads as a wave leaving
// your finger rather than every block snapping at once.
//
// It is index-driven, not coordinate-math: each cube reports itself on
// pointerenter, so the "active" cell only changes when you cross into a new
// block (cheap, no per-pixel state on the hot path); every other cube derives
// its raise and delay from its distance to that cell. The whole plane keeps a
// gentle idle shimmer — the top faces breathe on a staggered diagonal loop —
// so the field feels alive before you touch it. Under prefers-reduced-motion
// the shimmer, the ripple transitions and the entrance all fall away (the
// global CSS guard neutralises them) and the plane sits still and legible.

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export function Cubes({
  rows = 6,
  cols = 6,
  /** Edge of one cube, in px. */
  cell = 46,
  /** Space between cubes, in px. */
  gap = 10,
  /** How high (px) the cube directly under the pointer rises. */
  lift = 34,
  /** Ripple radius, in cells — cubes beyond this stay at rest. */
  reach = 3.2,
  className = '',
}: {
  rows?: number
  cols?: number
  cell?: number
  gap?: number
  lift?: number
  reach?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState<number | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cubes = useMemo(
    () => Array.from({ length: rows * cols }, (_, i) => ({ i, r: Math.floor(i / cols), c: i % cols })),
    [rows, cols],
  )

  // When the pointer crosses into a new cube it names itself; setting the same
  // index bails, so fast tracking across one block does not thrash React.
  function enter(i: number) {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    setActive(i)
  }
  function leave() {
    // A short grace so slipping through the seam between two cubes does not
    // flicker the whole field back down for a frame.
    leaveTimer.current = setTimeout(() => setActive(null), 90)
  }

  const activeCell = active != null ? { r: Math.floor(active / cols), c: active % cols } : null

  // The ground plane, tipped into an isometric view. Everything inside keeps
  // preserve-3d so each cube's faces pop out of the plane.
  const stageStyle: CSSProperties = {
    transformStyle: 'preserve-3d',
    transform: 'rotateX(58deg) rotateZ(45deg)',
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
    gap: `${gap}px`,
  }

  return (
    <div
      className={`grid place-items-center ${className}`}
      style={{ perspective: '1200px' }}
      onPointerLeave={leave}
    >
      <div style={stageStyle} aria-hidden>
        {cubes.map(({ i, r, c }) => {
          const dist = activeCell
            ? Math.hypot(r - activeCell.r, c - activeCell.c)
            : Infinity
          const k = activeCell ? Math.max(0, 1 - dist / reach) : 0
          const raise = k * lift
          // Nearer cubes lead the wave; farther ones follow a beat later.
          const delay = reduce ? 0 : Math.min(dist * 26, 220)
          const idleDelay = ((r + c) % 8) * 0.16
          const style: CSSProperties = {
            position: 'relative',
            width: cell,
            height: cell,
            transformStyle: 'preserve-3d',
            transform: `translateZ(${reduce ? 0 : raise}px)`,
            transition: reduce
              ? 'none'
              : `transform 0.5s ${EASE} ${delay}ms`,
            // Faces read these to light up as the cube rises.
            ['--k' as string]: k.toFixed(3),
            ['--cube' as string]: `${cell}px`,
            ['--idle' as string]: `${idleDelay}s`,
          }
          return (
            <div
              key={i}
              className="cube"
              style={style}
              onPointerEnter={() => enter(i)}
            >
              <span className="cube-face cube-top" />
              <span className="cube-face cube-left" />
              <span className="cube-face cube-right" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
