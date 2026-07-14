import { useRef, type PointerEvent } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion'
import { useFinePointer } from '../hooks/useFinePointer'

// A single tile in the drifting grid. `accent` paints it in the lime so a few
// break the otherwise cool rhythm; the label carries the meaning.
export interface GridMotionItem {
  label: string
  accent?: boolean
}

// Per-row drift strength in pixels. Rows further from centre travel more, so the
// field reads as layered depth rather than one flat sheet sliding.
const ROW_AMPLITUDE = [70, 118, 96, 140]

// Row is centred, then translated by the pointer. `reverse` flips a row's
// direction so neighbouring rows part and cross as the cursor sweeps across.
function Row({
  px,
  items,
  amplitude,
  reverse,
  reduce,
}: {
  px: MotionValue<number>
  items: GridMotionItem[]
  amplitude: number
  reverse: boolean
  reduce: boolean
}) {
  // px runs -1..1 (left..right of the field). Map it to a pixel offset and let a
  // spring lag behind, so the row eases toward the pointer instead of tracking
  // it rigidly. A reversed row moves against the cursor.
  const target = useTransform(
    px,
    [-1, 1],
    reverse ? [-amplitude, amplitude] : [amplitude, -amplitude],
  )
  const x = useSpring(target, { stiffness: 90, damping: 22, mass: 0.7 })

  return (
    // justify-center keeps the over-wide row centred, so it clips evenly on both
    // sides and there is room to drift either way without baring an edge.
    <div className="flex justify-center">
      <motion.div
        style={reduce ? undefined : { x }}
        className="flex shrink-0 gap-3 sm:gap-4 will-change-transform"
      >
        {items.map((item, i) => (
          <motion.span
            key={i}
            whileHover={reduce ? undefined : { scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={
              'flex shrink-0 items-center whitespace-nowrap rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors sm:text-base ' +
              (item.accent
                ? 'border-[#DCF87C]/40 bg-[#DCF87C]/10 text-[#DCF87C]'
                : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white')
            }
          >
            {item.label}
          </motion.span>
        ))}
      </motion.div>
    </div>
  )
}

/**
 * GridMotion — a field of labelled tiles laid out in rows that drift with the
 * pointer. Move the cursor and each row eases sideways by a different amount and,
 * on alternate rows, in the opposite direction, so the grid parts, crosses, and
 * layers like parallax. Every tile is real: tools, roles, places, and the rules
 * this site is built by.
 *
 * No per-frame React state — one motion value carries the pointer position and
 * each row derives its own sprung offset from it. On a touch device or under
 * reduced motion there is nothing to chase, so the rows sit still, centred and
 * fully legible.
 */
export function GridMotion({ rows }: { rows: GridMotionItem[][] }) {
  const reduce = useReducedMotion() ?? false
  const fine = useFinePointer()
  const ref = useRef<HTMLDivElement>(null)
  const px = useMotionValue(0)
  const active = fine && !reduce

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const v = ((e.clientX - r.left) / r.width) * 2 - 1
    px.set(Math.max(-1, Math.min(1, v)))
  }

  return (
    <div
      ref={ref}
      onPointerMove={active ? onMove : undefined}
      onPointerLeave={active ? () => px.set(0) : undefined}
      className="relative overflow-hidden py-10"
      style={{
        // Fade the tiles into the container edges so the clipped rows dissolve
        // instead of ending on a hard cut.
        maskImage:
          'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
      }}
    >
      <div className="flex flex-col gap-3 sm:gap-4">
        {rows.map((items, i) => (
          <Row
            key={i}
            px={px}
            items={items}
            amplitude={ROW_AMPLITUDE[i % ROW_AMPLITUDE.length]}
            reverse={i % 2 === 1}
            reduce={!active}
          />
        ))}
      </div>
    </div>
  )
}
