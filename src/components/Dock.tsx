import { useRef, useState, type ReactNode } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
  type MotionValue,
} from 'framer-motion'
import { Link } from 'react-router-dom'

export interface DockItem {
  label: string
  icon: ReactNode
  /** Internal route — renders a router Link. */
  to?: string
  /** External target — renders an anchor opening in a new tab. */
  href?: string
  /** Imperative action — renders a button. */
  onClick?: () => void
}

const SPRING = { mass: 0.1, stiffness: 180, damping: 14 } as const

// A magnifying dock in the spirit of the macOS Dock. As the pointer sweeps the
// row, each tile swells along a smooth bell curve based on its distance from the
// cursor, so the dock "leans" toward where you point and eases back as you leave.
// One shared pointer MotionValue drives every tile (no per-tile React state on
// the hot path); a tooltip label rises on hover. Under reduced motion the whole
// magnification is dropped — a plain, fully usable row of fixed tiles with no
// listeners or springs.
export function Dock({
  items,
  className = '',
  baseSize = 52,
  maxSize = 84,
  influence = 130,
}: {
  items: DockItem[]
  className?: string
  /** Tile size at rest, in px. */
  baseSize?: number
  /** Tile size directly under the cursor, in px. */
  maxSize?: number
  /** Half-width of the magnification falloff, in px. */
  influence?: number
}) {
  const reduce = useReducedMotion()
  // Pointer x in viewport coords; Infinity parks every tile at its base size.
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)

  if (reduce) {
    return (
      <nav
        aria-label="Dock"
        className={`flex items-end justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md ${className}`}
      >
        {items.map((item) => (
          <Tile key={item.label} item={item} style={{ width: baseSize, height: baseSize }} />
        ))}
      </nav>
    )
  }

  return (
    <motion.nav
      aria-label="Dock"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      className={`flex items-end justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md ${className}`}
    >
      {items.map((item) => (
        <DockTile
          key={item.label}
          item={item}
          mouseX={mouseX}
          baseSize={baseSize}
          maxSize={maxSize}
          influence={influence}
        />
      ))}
    </motion.nav>
  )
}

function DockTile({
  item,
  mouseX,
  baseSize,
  maxSize,
  influence,
}: {
  item: DockItem
  mouseX: MotionValue<number>
  baseSize: number
  maxSize: number
  influence: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  // Signed distance from the pointer to this tile's centre.
  const distance = useTransform(mouseX, (x) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return influence + 1
    return x - (box.x + box.width / 2)
  })

  // Bell curve: full size at the cursor, easing back to base by ±influence.
  const sizeTarget = useTransform(distance, [-influence, 0, influence], [baseSize, maxSize, baseSize], {
    clamp: true,
  })
  const size = useSpring(sizeTarget, SPRING)

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-full border border-white/10 bg-[#111]/90 px-3 py-1 text-xs font-medium text-white/85 shadow-lg backdrop-blur"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      <Tile
        item={item}
        style={{ width: size, height: size }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
      />
    </div>
  )
}

// The styled tile itself. `style` carries either fixed numbers (reduced motion)
// or live MotionValues (magnified). The icon scales with the tile via a CSS
// percentage so the glyph grows with the lift.
function Tile({
  item,
  style,
  onHoverStart,
  onHoverEnd,
}: {
  item: DockItem
  style: React.ComponentProps<typeof motion.div>['style']
  onHoverStart?: () => void
  onHoverEnd?: () => void
}) {
  const inner = (
    <motion.div
      style={style}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] text-white/70 transition-colors duration-200 hover:border-[#DCF87C]/40 hover:text-[#DCF87C]"
    >
      <span className="flex h-[44%] w-[44%] items-center justify-center" aria-hidden>
        {item.icon}
      </span>
    </motion.div>
  )

  const label = item.label
  if (item.to) {
    return (
      <Link to={item.to} aria-label={label} className="block">
        {inner}
      </Link>
    )
  }
  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" aria-label={label} className="block">
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={item.onClick} aria-label={label} className="block">
      {inner}
    </button>
  )
}
