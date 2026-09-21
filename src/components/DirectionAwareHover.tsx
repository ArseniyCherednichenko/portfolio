import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// DirectionAwareHover — the one hover the "Cards & surfaces" family was still
// missing: an overlay that knows *where the cursor came from*. Where the glare
// card sweeps one fixed diagonal, the spotlight card glows under the pointer,
// and the flip card turns on a hinge, this reads the edge the pointer actually
// crossed — top, right, bottom, or left — and slides its cover in from exactly
// that side, then, when you leave, pushes it back out toward the edge you exit.
// The panel appears to be shoved by the cursor rather than merely appearing, so
// a row of these feels physical: brush the deck from the left and every cover
// enters leftward in turn.
//
// The direction is one cheap calculation, not a wall of listeners: on enter and
// on leave we take the pointer's position relative to the card's centre and read
// its angle with atan2, quantised to the four sides. That index picks an offset
// (a full card-width or -height in the right sign), the cover animates from it
// to rest on enter and back to the leave offset on exit, and one spring carries
// the travel so nothing snaps.
//
// Honest about the medium: the cover is a real, always-rendered element (its
// copy is selectable and reachable), lifted over the resting face only visually.
// Keyboard users get the same reveal — focus slides the cover up from the
// bottom, blur sends it back down — so it is not a pointer-only trick. Reduced
// motion drops all travel: the cover simply cross-fades in and out, fully
// legible, with nothing sliding across the screen.

export interface DirectionAwareHoverProps {
  /** Small eyebrow shown on the cover, e.g. a category. */
  label?: string
  /** The cover's headline. */
  title: string
  /** A sentence of body copy on the cover. */
  body: string
  /** The resting face — what shows before the cover slides in. */
  children: ReactNode
  className?: string
}

// Four sides, in the order atan2 quantises to below: 0 top, 1 right, 2 bottom,
// 3 left. Each maps to the offset the cover rests at when hidden on that side —
// a whole card away in the matching axis, so it enters and exits fully off-face.
const OFFSETS = [
  { x: '0%', y: '-100%' }, // 0 — top
  { x: '100%', y: '0%' }, // 1 — right
  { x: '0%', y: '100%' }, // 2 — bottom
  { x: '-100%', y: '0%' }, // 3 — left
] as const

const SPRING = { type: 'spring', stiffness: 260, damping: 30 } as const

/** The side of the card the pointer is nearest, from its offset to the centre.
 *  atan2 gives the angle; dividing by a quarter-turn and rounding lands it on
 *  one of four sides. In screen space (y grows downward) a quarter-turn q reads
 *  0 = right, 1 = bottom, 2/-2 = left, -1 = top; +1 then maps those onto the
 *  OFFSETS order (0 top, 1 right, 2 bottom, 3 left), and the +4 before the final
 *  modulo keeps a negative result positive. */
function directionFromPointer(e: PointerEvent<HTMLElement>, el: HTMLElement): number {
  const r = el.getBoundingClientRect()
  const x = e.clientX - r.left - r.width / 2
  const y = e.clientY - r.top - r.height / 2
  const q = Math.round(Math.atan2(y, x) / (Math.PI / 2))
  return ((q + 1) % 4 + 4) % 4
}

export function DirectionAwareHover({
  label,
  title,
  body,
  children,
  className = '',
}: DirectionAwareHoverProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  // The offset the cover rests at while hidden — updated on the way in and out
  // so it always enters from and leaves toward the real edge the pointer used.
  const [offset, setOffset] = useState<{ x: string; y: string }>(OFFSETS[2])

  function reveal(e: PointerEvent<HTMLDivElement>) {
    if (ref.current) setOffset(OFFSETS[directionFromPointer(e, ref.current)])
    setShown(true)
  }

  function hide(e: PointerEvent<HTMLDivElement>) {
    if (ref.current) setOffset(OFFSETS[directionFromPointer(e, ref.current)])
    setShown(false)
  }

  return (
    <div
      ref={ref}
      className={`group relative isolate aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 ${className}`}
      onPointerEnter={reveal}
      onPointerLeave={hide}
      // Keyboard parity: focusing anything inside slides the cover up from the
      // bottom; leaving sends it back down. bottom is the calm default edge.
      onFocus={() => {
        setOffset(OFFSETS[2])
        setShown(true)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOffset(OFFSETS[2])
          setShown(false)
        }
      }}
    >
      {/* Resting face */}
      <div className="absolute inset-0 flex flex-col justify-end p-6">{children}</div>

      {/* The direction-aware cover. Always rendered (its copy is real, selectable
          and reachable), animated over the face. Reduced motion: opacity only. */}
      <motion.div
        aria-hidden={!shown}
        className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black via-black/85 to-black/30 p-6"
        initial={false}
        animate={
          reduce
            ? { opacity: shown ? 1 : 0, x: 0, y: 0 }
            : { x: shown ? '0%' : offset.x, y: shown ? '0%' : offset.y, opacity: 1 }
        }
        transition={reduce ? { duration: 0.2 } : SPRING}
        style={reduce ? undefined : { pointerEvents: shown ? 'auto' : 'none' }}
      >
        {label && (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{label}</span>
        )}
        <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>
      </motion.div>
    </div>
  )
}
