import {
  createContext,
  useContext,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

// A parallax "diorama" card. Where TiltCard rotates a single plane toward the
// cursor, this reads the pointer once and lets several stacked layers respond
// to it at different rates and depths — so the scene gains real inside-the-box
// depth, the way a shadow box or a paper theatre does. Each child is a
// <ParallaxLayer depth={n}>: a larger depth shifts further and sits further
// forward on the z-axis, so the whole thing separates as the card tilts.
//
// The pointer offset is measured once on the card, published through context as
// two spring-smoothed motion values in [-0.5, 0.5], and every layer subscribes
// — no layer touches the DOM or listens for its own events. Under reduced
// motion the tilt and the drift both collapse and the scene rests flat.

type ParallaxContext = {
  mx: MotionValue<number>
  my: MotionValue<number>
  reduce: boolean
  /** Pixels a layer at depth 1 drifts across the full pointer sweep. */
  shift: number
}

const Ctx = createContext<ParallaxContext | null>(null)

export function ParallaxCard({
  children,
  className = '',
  /** Max degrees the whole card tilts toward the pointer. */
  tilt = 7,
  /** Pixels a depth-1 layer drifts across the full pointer sweep. */
  shift = 26,
  /** Show the cursor-tracking sheen. */
  glare = true,
}: {
  children: ReactNode
  className?: string
  tilt?: number
  shift?: number
  glare?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion() ?? false

  // Raw pointer offset from centre, in [-0.5, 0.5] on each axis.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const spring = { stiffness: 140, damping: 20, mass: 0.4 }
  const mx = useSpring(px, spring)
  const my = useSpring(py, spring)

  const rotateX = useTransform(my, [-0.5, 0.5], [tilt, -tilt])
  const rotateY = useTransform(mx, [-0.5, 0.5], [-tilt, tilt])
  const glareX = useTransform(mx, [-0.5, 0.5], ['0%', '100%'])
  const glareY = useTransform(my, [-0.5, 0.5], ['0%', '100%'])
  const glareBg = useTransform(
    [glareX, glareY],
    ([gx, gy]) => `radial-gradient(420px circle at ${gx} ${gy}, rgba(220,248,124,0.15), transparent 62%)`,
  )

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  function reset() {
    px.set(0)
    py.set(0)
  }

  return (
    <Ctx.Provider value={{ mx, my, reduce, shift }}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={
          reduce
            ? undefined
            : { rotateX, rotateY, transformPerspective: 1000, transformStyle: 'preserve-3d' }
        }
        className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0B0B] ${className}`}
      >
        {children}
        {glare && !reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: glareBg }}
          />
        )}
      </motion.div>
    </Ctx.Provider>
  )
}

export function ParallaxLayer({
  children,
  depth = 0,
  className = '',
  style,
}: {
  children: ReactNode
  /** How strongly this layer reacts. Larger = drifts more and sits more forward. Negative sits behind and drifts against the pointer. */
  depth?: number
  className?: string
  style?: CSSProperties
}) {
  const ctx = useContext(Ctx)
  // Hooks must run unconditionally, so fall back to inert values if a layer is
  // ever rendered outside a ParallaxCard.
  const zero = useMotionValue(0)
  const mx = ctx?.mx ?? zero
  const my = ctx?.my ?? zero
  const reduce = ctx?.reduce ?? true
  const shift = ctx?.shift ?? 0

  // Nearer layers (higher depth) drift opposite to the pointer, so the scene
  // reads as looking *around* the box rather than sliding with the cursor.
  const x = useTransform(mx, (v) => -v * depth * shift)
  const y = useTransform(my, (v) => -v * depth * shift)

  return (
    <motion.div
      className={`absolute inset-0 ${className}`}
      style={
        reduce
          ? style
          : { x, y, translateZ: depth * 14, transformStyle: 'preserve-3d', ...style }
      }
    >
      {children}
    </motion.div>
  )
}
