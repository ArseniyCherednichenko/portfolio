import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, useInView } from 'framer-motion'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>-_\\[]{}=+*'

// Text that resolves from random glyphs into the final string, character by
// character, left to right. Plays once on view and again on hover. With
// reduced-motion it simply renders the final text, no scrambling.
export function DecryptedText({
  text,
  className = '',
  speed = 38,
}: {
  text: string
  className?: string
  speed?: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [display, setDisplay] = useState(reduce ? text : '')
  const frame = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function run() {
    if (reduce) {
      setDisplay(text)
      return
    }
    if (timer.current) clearInterval(timer.current)
    frame.current = 0
    timer.current = setInterval(() => {
      frame.current += 1
      const revealed = frame.current / 2
      const next = text
        .split('')
        .map((ch, i) => {
          if (ch === ' ') return ' '
          if (i < revealed) return ch
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        })
        .join('')
      setDisplay(next)
      if (revealed >= text.length) {
        if (timer.current) clearInterval(timer.current)
        setDisplay(text)
      }
    }, speed)
  }

  useEffect(() => {
    if (inView) run()
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce])

  return (
    <span
      ref={ref}
      onMouseEnter={run}
      className={className}
      aria-label={text}
    >
      <span aria-hidden="true">{display || ' '}</span>
    </span>
  )
}
