import { useRef, type PointerEvent } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'

// GridMotion — a living wall of tiles. Several rows drift sideways at their own
// pace and in alternating directions (an infinite, seamless loop, the same
// duplicate-and-slide trick Marquee plays, but stacked and staggered into a
// field), while the whole slab tilts in 3D toward the cursor like a panel you
// are leaning over. Distinct from the 1D text bands (Marquee, ScrollVelocity,
// CurvedLoop): those are single tracks; this is a two-axis surface you steer.
//
// Fed a vocabulary rather than one message, it reads as breadth — a wall of
// what someone works across, no single tile carrying the whole story.
//
// Reduced motion holds the wall still and square: the tiles are all there and
// legible, just neither drifting nor tilting.

export interface GridMotionProps {
  /** The tiles, as short strings. Repeated to fill each row seamlessly. */
  items: string[]
  /** How many rows to stack. Default 4. */
  rows?: number
  /** Optional tiles to render in the lime accent, matched by exact string. */
  accent?: string[]
  className?: string
}

const EASE = [0.16, 1, 0.3, 1] as const

// One horizontally-looping row. The track holds its tiles twice back to back
// and slides exactly one copy's width, so the seam is invisible and the loop
// never jumps. Direction and duration vary per row to break the grid rhythm.
function Row({
  items,
  accent,
  dir,
  duration,
  still,
}: {
  items: string[]
  accent: Set<string>
  dir: 1 | -1
  duration: number
  still: boolean
}) {
  const from = dir === 1 ? '-50%' : '0%'
  const to = dir === 1 ? '0%' : '-50%'
  const tiles = [...items, ...items]
  return (
    <div className="flex w-max">
      <motion.div
        className="flex shrink-0 gap-3 pr-3"
        animate={still ? undefined : { x: [from, to] }}
        transition={still ? undefined : { duration, ease: 'linear', repeat: Infinity }}
      >
        {tiles.map((label, i) => {
          const on = accent.has(label)
          return (
            <span
              key={`${label}-${i}`}
              className={
                'whitespace-nowrap rounded-2xl border px-5 py-3 text-lg font-semibold tracking-tight ' +
                (on
                  ? 'border-[#DCF87C]/40 bg-[#DCF87C]/10 text-[#DCF87C]'
                  : 'border-white/10 bg-white/[0.03] text-white/70')
              }
            >
              {label}
            </span>
          )
        })}
      </motion.div>
    </div>
  )
}

export function GridMotion({ items, rows = 4, accent = [], className = '' }: GridMotionProps) {
  const reduce = useReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const accentSet = new Set(accent)

  // Normalised pointer offset from centre (-0.5..0.5 on each axis), sprung so
  // the wall eases toward the cursor and settles back rather than snapping.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 120, damping: 20, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 120, damping: 20, mass: 0.6 })

  const rotateY = useTransform(sx, [-0.5, 0.5], [12, -12])
  const rotateX = useTransform(sy, [-0.5, 0.5], [-8, 8])
  const shiftX = useTransform(sx, [-0.5, 0.5], [26, -26])
  const shiftY = useTransform(sy, [-0.5, 0.5], [16, -16])

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    const el = wrap.current
    if (!el) return
    const r = el.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  function onLeave() {
    px.set(0)
    py.set(0)
  }

  // Offset alternate rows a little so tiles don't line up into columns.
  const offsets = ['0', '-2.5rem', '1.5rem', '-1rem', '2rem', '-3rem']

  return (
    <div
      ref={wrap}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`relative overflow-hidden [perspective:1200px] ${className}`}
    >
      {/* Fade the field into the page at every edge. */}
      <div className="pointer-events-none absolute inset-0 z-10 [mask-image:radial-gradient(120%_120%_at_50%_50%,transparent_55%,black)]">
        <div className="h-full w-full bg-[#0a0a0a]" />
      </div>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.8, ease: EASE }}
        style={
          reduce
            ? undefined
            : { rotateX, rotateY, x: shiftX, y: shiftY, transformStyle: 'preserve-3d' }
        }
        className="flex flex-col gap-3 py-2 [transform:rotate(-6deg)_scale(1.18)] will-change-transform"
        aria-hidden
      >
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ transform: `translateX(${offsets[r % offsets.length]})` }}>
            <Row
              items={items}
              accent={accentSet}
              dir={r % 2 === 0 ? 1 : -1}
              duration={26 + (r % 3) * 6}
              still={!!reduce}
            />
          </div>
        ))}
      </motion.div>
    </div>
  )
}
