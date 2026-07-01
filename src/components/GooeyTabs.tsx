import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A liquid tab switcher. The active indicator is not one pill that slides —
// it is two lime blobs (a snappy "head" and a laggier "tail") living inside an
// SVG gooey filter, so as the selection moves the tail stretches out of the old
// tab and drips into the new one before the two merge back into a single pill.
// The classic metaball trick: blur the shapes, then crush the alpha ramp so the
// blurred halos fuse where they overlap and stay sharp where they don't.
//
// The labels render above the filtered layer (unfiltered, so text stays crisp)
// and cross-fade their colour as the blob arrives. Reduced motion drops the
// stretch entirely: a single pill moves instantly, no goo, fully legible.

export interface GooeyTabsProps {
  tabs: string[]
  /** Controlled active index. Omit to let the component own its state. */
  value?: number
  onChange?: (index: number) => void
  className?: string
  /** Rendered inside each tab button, before the label. */
  renderIcon?: (index: number) => ReactNode
}

// A module-scoped counter keeps every mounted instance on its own filter id
// without reaching for Math.random (unavailable here) or useId churn.
let gooSeq = 0

export function GooeyTabs({
  tabs,
  value,
  onChange,
  className = '',
  renderIcon,
}: GooeyTabsProps) {
  const reduce = useReducedMotion()
  const [filterId] = useState(() => `goo-tabs-${gooSeq++}`)
  const [internal, setInternal] = useState(0)
  const active = value ?? internal

  const select = (i: number) => {
    if (value === undefined) setInternal(i)
    onChange?.(i)
  }

  const listRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [rect, setRect] = useState({ left: 0, width: 0 })

  // Measure the active button's box against the row so the blobs can sit under
  // it exactly. Re-measures on mount, on selection, and whenever the row resizes
  // (font swap, container width, wrapping) via a ResizeObserver.
  useLayoutEffect(() => {
    const measure = () => {
      const btn = btnRefs.current[active]
      if (!btn) return
      setRect({ left: btn.offsetLeft, width: btn.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (listRef.current) ro.observe(listRef.current)
    return () => ro.disconnect()
  }, [active, tabs.length])

  const headSpring = { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.7 }
  const tailSpring = { type: 'spring' as const, stiffness: 210, damping: 26, mass: 0.9 }
  const target = { left: rect.left, width: rect.width }

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* The gooey filter itself. stdDeviation blurs the blobs into overlapping
          halos; the alpha row of the matrix (large multiply, negative bias)
          snaps the ramp so the halos fuse into one liquid edge. */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={listRef}
        className="relative flex rounded-full border border-white/10 bg-white/[0.03] p-1"
      >
        {/* Filtered blob layer — sits behind the labels, ignores pointer. */}
        <div
          className="pointer-events-none absolute inset-1"
          style={reduce ? undefined : { filter: `url(#${filterId})` }}
        >
          {/* Tail: the laggier blob that stretches out of the old position. */}
          {!reduce && (
            <motion.span
              className="absolute top-0 bottom-0 rounded-full bg-[#DCF87C]"
              initial={false}
              animate={target}
              transition={tailSpring}
            />
          )}
          {/* Head: snaps to the new tab and pulls the tail in behind it. */}
          <motion.span
            className="absolute top-0 bottom-0 rounded-full bg-[#DCF87C]"
            initial={false}
            animate={target}
            transition={reduce ? { duration: 0 } : headSpring}
          />
        </div>

        {tabs.map((tab, i) => {
          const isActive = i === active
          return (
            <button
              key={tab}
              ref={(el) => {
                btnRefs.current[i] = el
              }}
              type="button"
              onClick={() => select(i)}
              aria-pressed={isActive}
              className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 sm:px-5 ${
                isActive ? 'text-black' : 'text-white/55 hover:text-white/80'
              }`}
            >
              {renderIcon?.(i)}
              {tab}
            </button>
          )
        })}
      </div>
    </div>
  )
}
