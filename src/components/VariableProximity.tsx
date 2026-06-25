import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

interface VariableProximityProps {
  /** The text to render. Each character reacts to the cursor independently. */
  text: string
  className?: string
  /** Pixel radius around the pointer within which letters react. */
  radius?: number
  /** Resting and peak weights (Fraunces supports 300..700). */
  fromWeight?: number
  toWeight?: number
  /** Resting and peak optical sizes (Fraunces supports 9..144). */
  fromOpsz?: number
  toOpsz?: number
  /** How quickly each letter eases toward its target each frame (0..1). */
  ease?: number
}

/**
 * Cursor-pressure display text. Built on the variable Fraunces face: as the
 * pointer nears a letter, that letter's weight axis ("wght") swells from light
 * to bold and its optical-size axis ("opsz") opens up, so the headline appears
 * to lean toward the cursor. Letters ease back to rest as the pointer leaves.
 *
 * Pure rAF + direct style writes (no per-letter React state), so even long
 * lines stay smooth. Reads then writes in separate passes to avoid thrashing.
 * Honest to assistive tech: the container carries the real string as its
 * aria-label and every visual letter is aria-hidden. Under reduced-motion it
 * renders the finished line at a fixed weight with no listeners or loop.
 */
export function VariableProximity({
  text,
  className = '',
  radius = 160,
  fromWeight = 320,
  toWeight = 700,
  fromOpsz = 16,
  toOpsz = 132,
  ease = 0.16,
}: VariableProximityProps) {
  const reduce = useReducedMotion()
  const charRefs = useRef<(HTMLSpanElement | null)[]>([])
  const pointer = useRef({ x: -9999, y: -9999, active: false })
  const current = useRef<number[]>([])

  const chars = Array.from(text)

  useEffect(() => {
    if (reduce) return
    const spans = charRefs.current
    current.current = chars.map(() => fromWeight)

    const onMove = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY, active: true }
    }
    const onLeave = () => {
      pointer.current.active = false
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('blur', onLeave)
    document.addEventListener('pointerleave', onLeave)

    let raf = 0
    const wSpan = toWeight - fromWeight
    const opSpan = toOpsz - fromOpsz

    const loop = () => {
      const { x, y, active } = pointer.current
      // Read pass: compute each letter's target weight from cursor distance.
      const targets: number[] = []
      for (let i = 0; i < spans.length; i++) {
        const el = spans[i]
        if (!el || !active) {
          targets[i] = fromWeight
          continue
        }
        const r = el.getBoundingClientRect()
        const dx = r.left + r.width / 2 - x
        const dy = r.top + r.height / 2 - y
        const t = Math.max(0, 1 - Math.hypot(dx, dy) / radius)
        // Square the falloff so the swell concentrates near the pointer.
        targets[i] = fromWeight + wSpan * (t * t)
      }
      // Write pass: ease toward target, then set the variation axes.
      for (let i = 0; i < spans.length; i++) {
        const el = spans[i]
        if (!el) continue
        const cur = current.current[i] ?? fromWeight
        const next = cur + (targets[i] - cur) * ease
        current.current[i] = next
        const prog = wSpan === 0 ? 0 : (next - fromWeight) / wSpan
        const opsz = fromOpsz + opSpan * prog
        el.style.fontVariationSettings = `"wght" ${next.toFixed(1)}, "opsz" ${opsz.toFixed(1)}`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, chars.length, radius, fromWeight, toWeight, fromOpsz, toOpsz, ease])

  if (reduce) {
    return (
      <span
        className={`font-display ${className}`}
        style={{ fontVariationSettings: `"wght" 600, "opsz" ${toOpsz}` }}
      >
        {text}
      </span>
    )
  }

  // Group letters into per-word wrappers so lines break only between words,
  // never mid-word, while each letter keeps a stable global ref index.
  const words: { ch: string; i: number }[][] = [[]]
  chars.forEach((ch, i) => {
    if (ch === ' ') words.push([])
    else words[words.length - 1].push({ ch, i })
  })

  const letterStyle = {
    display: 'inline-block',
    fontVariationSettings: `"wght" ${fromWeight}, "opsz" ${fromOpsz}`,
    willChange: 'font-variation-settings',
  } as const

  return (
    <span className={`font-display ${className}`} aria-label={text} role="text">
      {words.map((word, w) => (
        <span key={w}>
          <span aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            {word.map(({ ch, i }) => (
              <span
                key={i}
                ref={(el) => {
                  charRefs.current[i] = el
                }}
                style={letterStyle}
              >
                {ch}
              </span>
            ))}
          </span>
          {w < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  )
}
