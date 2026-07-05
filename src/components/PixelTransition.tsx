import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Deterministic per-cell scatter (mulberry32-ish from the index) so the pixels
// dissolve in a stable, organic order rather than a plain left-to-right sweep.
function seeded(i: number) {
  let t = (i + 1) * 0x6d2b79f5
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// PixelTransition — a hover/focus-driven pixelated dissolve between two faces.
// A grid of small squares flashes on in a seeded scatter to cover the surface,
// the visible face is swapped underneath at the peak, then the squares flash
// back off to reveal the new face. In the spirit of 21st.dev / React Bits pixel
// cards. Under reduced motion (or on touch, where there is no hover) it drops
// the grid entirely and cross-fades the two faces instantly, staying legible.
export function PixelTransition({
  front,
  back,
  gridSize = 8,
  color = '#DCF87C',
  duration = 0.5,
  className = '',
  rounded = 'rounded-2xl',
}: {
  /** Resting face (kept in normal flow, so it sizes the box). */
  front: React.ReactNode
  /** Face revealed on hover/focus (absolutely filled over the front). */
  back: React.ReactNode
  /** Squares per side of the pixel grid. */
  gridSize?: number
  /** Pixel colour during the dissolve. */
  color?: string
  /** Seconds for one dissolve. */
  duration?: number
  className?: string
  /** Tailwind radius utility; match it to the host surface. */
  rounded?: string
}) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(false) // hover/focus target
  const [face, setFace] = useState<'front' | 'back'>('front') // rendered face
  const [flash, setFlash] = useState(0) // bumps to replay the pixel grid
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const total = gridSize * gridSize
  // Small, scattered per-cell start delays so the grid fills unevenly.
  const delays = useMemo(
    () => Array.from({ length: total }, (_, i) => seeded(i) * duration * 0.45),
    [total, duration],
  )

  // When the hover/focus target changes, run the dissolve and swap the visible
  // face at its peak. Reduced-motion swaps instantly with no grid.
  useEffect(() => {
    const target: 'front' | 'back' = active ? 'back' : 'front'
    if (target === face) return
    if (reduce) {
      setFace(target)
      return
    }
    setFlash((f) => f + 1)
    timer.current = setTimeout(() => setFace(target), duration * 500)
    return () => clearTimeout(timer.current)
    // face is intentionally omitted: reacting to the target (active) only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div
      className={`relative isolate overflow-hidden ${rounded} ${className}`}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={() => setActive(false)}
    >
      <div
        className="h-full w-full transition-opacity duration-200"
        style={{ opacity: face === 'front' ? 1 : 0, pointerEvents: face === 'front' ? undefined : 'none' }}
        aria-hidden={face !== 'front'}
      >
        {front}
      </div>
      <div
        className="absolute inset-0 h-full w-full transition-opacity duration-200"
        style={{ opacity: face === 'back' ? 1 : 0, pointerEvents: face === 'back' ? undefined : 'none' }}
        aria-hidden={face !== 'back'}
      >
        {back}
      </div>

      {/* The pixel grid. Remounted on every flash so the keyframe replays; the
          cells rest at opacity 0, so nothing shows between transitions. */}
      {!reduce && flash > 0 && (
        <div
          key={flash}
          aria-hidden
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gridTemplateRows: `repeat(${gridSize}, 1fr)` }}
        >
          {delays.map((d, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration, delay: d, times: [0, 0.5, 1], ease: 'easeInOut' }}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
