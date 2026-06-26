import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type Rect = { x: number; y: number; width: number; height: number }

function Corner({ className }: { className: string }) {
  return <span aria-hidden className={`absolute h-3 w-3 rounded-[1px] border-[#DCF87C] ${className}`} />
}

// React Bits-style "true focus": a row of words where a lime corner-bracket
// frame glides to the focused word, which snaps sharp while the others blur
// out. It auto-cycles, and hovering a word pins the focus there. The words
// stay real, selectable text (only the frame is decorative), so it reads
// normally to assistive tech. Under reduced-motion it renders a calm, fully
// legible static line with no frame, blur, or timer.
export function TrueFocus({
  words,
  className = '',
  interval = 1800,
  blur = 5,
}: {
  words: string[]
  className?: string
  interval?: number
  blur?: number
}) {
  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [paused, setPaused] = useState(false)

  const measure = (i: number) => {
    const container = containerRef.current
    const el = wordRefs.current[i]
    if (!container || !el) return
    const c = container.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const px = 12
    const py = 6
    setRect({
      x: r.left - c.left - px,
      y: r.top - c.top - py,
      width: r.width + px * 2,
      height: r.height + py * 2,
    })
  }

  useLayoutEffect(() => {
    measure(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, words])

  useEffect(() => {
    const onResize = () => measure(index)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    if (reduce || paused) return
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), interval)
    return () => clearInterval(id)
  }, [reduce, paused, interval, words.length])

  if (reduce) {
    return (
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
        {words.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}
      onMouseLeave={() => setPaused(false)}
    >
      {words.map((w, i) => {
        const focused = i === index
        return (
          <span
            key={w}
            ref={(el) => {
              wordRefs.current[i] = el
            }}
            onMouseEnter={() => {
              setPaused(true)
              setIndex(i)
            }}
            className="cursor-default transition-[filter,opacity] duration-500 ease-out"
            style={{
              filter: focused ? 'blur(0px)' : `blur(${blur}px)`,
              opacity: focused ? 1 : 0.4,
            }}
          >
            {w}
          </span>
        )
      })}
      {rect && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          initial={false}
          animate={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }}
          transition={{ type: 'spring', stiffness: 240, damping: 28 }}
        >
          <Corner className="left-0 top-0 border-l-2 border-t-2" />
          <Corner className="right-0 top-0 border-r-2 border-t-2" />
          <Corner className="bottom-0 left-0 border-b-2 border-l-2" />
          <Corner className="bottom-0 right-0 border-b-2 border-r-2" />
        </motion.div>
      )}
    </div>
  )
}
