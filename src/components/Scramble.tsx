import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>-_\\|'

// Text that "decodes" into place: each character settles from a stream of
// random glyphs, left to right. Runs once when scrolled into view, and again
// on hover (opt-in). Under reduced motion it renders the final text instantly.
export function Scramble({
  text,
  className = '',
  hoverable = true,
  speed = 28,
}: {
  text: string
  className?: string
  /** Re-run the decode when the element is hovered. */
  hoverable?: boolean
  /** Frame interval in ms — lower is faster. */
  speed?: number
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? text : '')
  const ref = useRef<HTMLSpanElement>(null)
  const frame = useRef(0)
  const timer = useRef<number | null>(null)

  function run() {
    if (reduce) {
      setDisplay(text)
      return
    }
    if (timer.current) window.clearInterval(timer.current)
    let progress = 0
    timer.current = window.setInterval(() => {
      frame.current++
      progress += 1 / 3 // reveal one settled char every ~3 frames
      let out = ''
      for (let i = 0; i < text.length; i++) {
        if (i < progress) {
          out += text[i]
        } else if (text[i] === ' ') {
          out += ' '
        } else {
          out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        }
      }
      setDisplay(out)
      if (progress >= text.length) {
        setDisplay(text)
        if (timer.current) window.clearInterval(timer.current)
      }
    }, speed)
  }

  useEffect(() => {
    if (reduce) {
      setDisplay(text)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          run()
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer.current) window.clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduce])

  return (
    <span
      ref={ref}
      onMouseEnter={hoverable ? run : undefined}
      className={className}
      // tabular-ish: keep width stable while glyphs flicker
      style={{ fontVariantLigatures: 'none' }}
    >
      {display || ' '}
    </span>
  )
}
