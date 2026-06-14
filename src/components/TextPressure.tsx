import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Interactive typography: each letter reacts to the cursor's proximity, growing,
// bolding, and lighting toward the lime accent the closer the pointer gets, then
// easing back to rest. Hand-built with refs and a single rAF loop (no per-letter
// React state, so it stays smooth with long strings). Under reduced motion it
// renders as plain, static text with no pointer reaction.
export function TextPressure({
  text,
  className = '',
  radius = 180,
}: {
  text: string
  className?: string
  radius?: number
}) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const wrap = wrapRef.current
    if (!wrap) return
    const letters = Array.from(wrap.querySelectorAll<HTMLSpanElement>('[data-letter]'))
    if (letters.length === 0) return

    type Cell = { el: HTMLSpanElement; cx: number; cy: number; force: number }
    let cells: Cell[] = []
    const pointer = { x: -9999, y: -9999, active: false }
    let raf = 0

    function measure() {
      const base = wrap!.getBoundingClientRect()
      cells = letters.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          el,
          cx: r.left - base.left + r.width / 2,
          cy: r.top - base.top + r.height / 2,
          force: 0,
        }
      })
    }

    function frame() {
      let busy = false
      for (const c of cells) {
        let target = 0
        if (pointer.active) {
          const dist = Math.hypot(c.cx - pointer.x, c.cy - pointer.y)
          if (dist < radius) target = 1 - dist / radius
        }
        // ease toward target so letters swell and relax smoothly
        c.force += (target - c.force) * 0.16
        if (c.force > 0.001 || target > 0.001) busy = true

        const f = c.force
        const scale = 1 + f * 0.55
        const weight = Math.round(400 + f * 500)
        // blend resting white toward the lime accent as the letter peaks
        const r = Math.round(255 + (220 - 255) * f)
        const g = Math.round(255 + (248 - 255) * f)
        const b = Math.round(255 + (124 - 255) * f)
        const alpha = 0.62 + f * 0.38
        c.el.style.transform = `scale(${scale.toFixed(3)})`
        c.el.style.fontWeight = String(weight)
        c.el.style.color = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
      }
      // keep animating while any letter is still settling
      raf = busy || pointer.active ? requestAnimationFrame(frame) : 0
    }

    function wake() {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    function onMove(e: PointerEvent) {
      const base = wrap!.getBoundingClientRect()
      pointer.x = e.clientX - base.left
      pointer.y = e.clientY - base.top
      pointer.active = true
      wake()
    }
    function onLeave() {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
      wake()
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    window.addEventListener('scroll', measure, { passive: true })
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('scroll', measure)
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, radius, text])

  // Split into words so wrapping stays natural; letters animate individually.
  const words = text.split(' ')
  return (
    <span ref={wrapRef} aria-label={text} className={`inline-block ${className}`}>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap">
          {Array.from(word).map((ch, ci) => (
            <span
              key={ci}
              data-letter
              aria-hidden
              className="inline-block will-change-transform"
              style={{ color: 'rgba(255,255,255,0.62)' }}
            >
              {ch}
            </span>
          ))}
          {wi < words.length - 1 && <span aria-hidden>{' '}</span>}
        </span>
      ))}
    </span>
  )
}
