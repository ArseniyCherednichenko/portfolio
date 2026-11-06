import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Ripple — the Material touch-feedback ink wave, rebuilt by hand as a reusable
// surface primitive rather than a toy. It is the deliberate counterpart to
// ClickSpark (which throws decorative particles off *any* click, site-wide and
// above everything): this one is bounded and surface-contained. An ink circle
// grows out of the exact point you pressed, clipped to the element's own
// rounded shape, so the press reads as the surface itself acknowledging the
// touch — the oldest, quietest piece of interaction feedback there is, and the
// one honest control feel the site's buttons never carried.
//
// It wraps its child and takes no semantics: the child stays the real button,
// link, or list row, and this only lays a decorative, aria-hidden ink layer
// over it. The wave is spawned from the pointer-down coordinate; a radius sized
// to the farthest corner guarantees it always sweeps the whole surface however
// off-centre the press. Keyboard parity is deliberate — activating a focused
// child with Enter or Space (the one case with no pointer coordinate) spawns a
// ripple from the centre, so the feedback is not a mouse-only reward.
//
// Reduced motion drops the wave entirely: the child keeps its own hover and
// active states, so the control stays fully usable with nothing expanding.

type Drop = {
  id: number
  /** Local coordinates of the press, in CSS px from the top-left. */
  x: number
  y: number
  /** Diameter that covers the surface from that point to its farthest corner. */
  size: number
}

type RippleProps = {
  children: ReactNode
  /** The ink colour. A translucent accent by default, so a label stays legible
   * under the wash the way a real Material ripple sits over its own text. */
  color?: string
  /** Seconds for a single wave to grow out and fade. */
  duration?: number
  /** Spawn a centred ripple when a focused child is activated by keyboard. */
  keyboard?: boolean
  className?: string
}

export function Ripple({
  children,
  color = 'rgba(220, 248, 124, 0.35)',
  duration = 0.62,
  keyboard = true,
  className = '',
}: RippleProps) {
  const reduce = useReducedMotion()
  const hostRef = useRef<HTMLSpanElement>(null)
  const nextId = useRef(0)
  const [drops, setDrops] = useState<Drop[]>([])

  // Size the wave so it always reaches the farthest corner from the press,
  // then centre it on that point — the classic Material radius.
  const spawn = useCallback(
    (clientX: number, clientY: number) => {
      const el = hostRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const x = clientX - r.left
      const y = clientY - r.top
      const far = Math.max(
        Math.hypot(x, y),
        Math.hypot(r.width - x, y),
        Math.hypot(x, r.height - y),
        Math.hypot(r.width - x, r.height - y),
      )
      const id = nextId.current++
      setDrops((prev) => [...prev, { id, x, y, size: far * 2 }])
    },
    [],
  )

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLSpanElement>) => {
      // Primary press only — never on a right- or middle-click.
      if (e.button !== 0) return
      spawn(e.clientX, e.clientY)
    },
    [spawn],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLSpanElement>) => {
      if (!keyboard || e.repeat) return
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
      const el = hostRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      spawn(r.left + r.width / 2, r.top + r.height / 2)
    },
    [keyboard, spawn],
  )

  const remove = useCallback((id: number) => {
    setDrops((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return (
    <span
      ref={hostRef}
      onPointerDown={reduce ? undefined : onPointerDown}
      onKeyDown={reduce ? undefined : onKeyDown}
      className={`relative isolate inline-flex overflow-hidden ${className}`}
    >
      {children}
      {!reduce && drops.length > 0 && (
        <span aria-hidden className="pointer-events-none absolute inset-0 z-10">
          {drops.map((d) => (
            <motion.span
              key={d.id}
              initial={{ scale: 0, opacity: 0.55 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
              onAnimationComplete={() => remove(d.id)}
              style={{
                position: 'absolute',
                left: d.x - d.size / 2,
                top: d.y - d.size / 2,
                width: d.size,
                height: d.size,
                borderRadius: '9999px',
                background: color,
              }}
            />
          ))}
        </span>
      )}
    </span>
  )
}
