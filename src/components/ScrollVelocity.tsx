import { useRef } from 'react'
import {
  motion,
  useScroll,
  useVelocity,
  useTransform,
  useSpring,
  useMotionValue,
  useAnimationFrame,
  useReducedMotion,
  wrap,
} from 'framer-motion'

type Row = {
  /** The repeating text for this row. */
  text: string
  /** Base drift speed in %/s. Sign sets default direction. */
  baseVelocity?: number
}

function VelocityRow({
  text,
  baseVelocity = 4,
  className = '',
}: Row & { className?: string }) {
  const baseX = useMotionValue(0)
  const { scrollY } = useScroll()
  const scrollVelocity = useVelocity(scrollY)
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  })
  // Scroll speed scales the drift; clamp off so fast flicks really fling.
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
    clamp: false,
  })

  // Four copies are rendered; wrap the offset across one copy's width (-25%).
  const x = useTransform(baseX, (v) => `${wrap(-25, 0, v)}%`)

  // Scroll direction can flip the drift so the band feels reactive.
  const directionFactor = useRef(1)
  useAnimationFrame((_, delta) => {
    let moveBy = directionFactor.current * baseVelocity * (delta / 1000)

    if (velocityFactor.get() < 0) directionFactor.current = -1
    else if (velocityFactor.get() > 0) directionFactor.current = 1

    moveBy += directionFactor.current * moveBy * velocityFactor.get()
    baseX.set(baseX.get() + moveBy)
  })

  return (
    <div className="flex flex-nowrap overflow-hidden whitespace-nowrap">
      <motion.div className={`flex flex-nowrap whitespace-nowrap ${className}`} style={{ x }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} aria-hidden={i > 0} className="block pr-[0.4em]">
            {text}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

/**
 * Scroll-velocity text band, React Bits style: rows of large type drift on
 * their own, then speed up and change direction with the page's scroll
 * velocity. Under reduced-motion it renders a single static, non-clipped line
 * per row.
 */
export function ScrollVelocity({
  rows,
  className = '',
}: {
  rows: Row[]
  className?: string
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className={className}>
        {rows.map((row, i) => (
          <div key={i} className="overflow-hidden text-ellipsis whitespace-nowrap">
            {row.text}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      {rows.map((row, i) => (
        <VelocityRow key={i} text={row.text} baseVelocity={row.baseVelocity} />
      ))}
    </div>
  )
}
