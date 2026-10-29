import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

interface WaveTextProps {
  /** The text to render. Each character rides the wave on its own phase. */
  text: string
  className?: string
  /** Peak vertical travel in pixels. Keep it small — this is an accent. */
  amplitude?: number
  /** Angular speed of the wave, in radians per second. */
  speed?: number
  /** Phase offset added per character, in radians — how long the crest is. */
  stagger?: number
  /**
   * When the wave runs. 'always' undulates continuously; 'hover' rests flat
   * and only rolls while the pointer is over the word, easing in and out.
   */
  trigger?: 'always' | 'hover'
  /** Brighten each letter as it reaches its crest, so light seems to travel. */
  shimmer?: boolean
}

/**
 * A line of type with a slow sine wave travelling through it — each letter
 * bobs on the same wave a beat behind the last, so a crest rolls across the
 * word like a gentle current or a flag in a light wind. It is a genuinely
 * different *kind* of text motion from the rest of the library: where
 * SplitText lifts letters into place once and settles, DecryptedText resolves
 * glyphs out of noise, and VariableProximity leans letters toward the cursor,
 * this one never arrives anywhere — it is continuous and ambient, the motion
 * itself the point. With `shimmer`, each letter also lifts in brightness at
 * the top of its arc, so a band of light seems to ride the crest.
 *
 * Honest to the machine: a single rAF loop writes `transform` (and opacity)
 * straight to each letter span — no per-letter React state on the hot path —
 * and the time base is the frame timestamp, so the wave keeps the same real
 * speed whatever the refresh rate. In `hover` mode a global amplitude eases
 * between 0 and full, so the wave rolls up and dies away rather than snapping.
 * Everything is cleaned up on unmount.
 *
 * Honest to assistive tech: the container carries the real string as its
 * aria-label and every visual letter is aria-hidden, so a screen reader hears
 * the word, not a pile of single characters. Letters group into per-word
 * wrappers so a line breaks only between words, never mid-word.
 *
 * Reduced motion drops the whole loop: the line renders flat and still, with
 * no listeners and nothing scheduled.
 */
export function WaveText({
  text,
  className = '',
  amplitude = 8,
  speed = 2.4,
  stagger = 0.42,
  trigger = 'always',
  shimmer = true,
}: WaveTextProps) {
  const reduce = useReducedMotion()
  const charRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rootRef = useRef<HTMLSpanElement>(null)

  const chars = Array.from(text)

  useEffect(() => {
    if (reduce) return
    const spans = charRefs.current
    const root = rootRef.current

    // In hover mode the wave rests flat; a pointer over the word raises the
    // target so amplitude eases up, and leaving lowers it so the wave settles.
    let ampTarget = trigger === 'hover' ? 0 : 1
    let amp = ampTarget
    const onEnter = () => {
      ampTarget = 1
    }
    const onLeave = () => {
      ampTarget = 0
    }
    if (trigger === 'hover' && root) {
      root.addEventListener('pointerenter', onEnter)
      root.addEventListener('pointerleave', onLeave)
    }

    let raf = 0
    let start = 0
    const loop = (ts: number) => {
      if (!start) start = ts
      const t = (ts - start) / 1000
      amp += (ampTarget - amp) * 0.08
      const scaled = amp * amplitude
      for (let i = 0; i < spans.length; i++) {
        const el = spans[i]
        if (!el) continue
        const phase = t * speed - i * stagger
        const s = Math.sin(phase)
        el.style.transform = `translate3d(0, ${(-scaled * s).toFixed(2)}px, 0)`
        if (shimmer) {
          // Lift opacity toward the crest (sin = 1), so a band of light rides
          // along with the wave. Scaled by amp so it fades out with the motion.
          const lift = (s + 1) / 2
          el.style.opacity = (1 - amp * 0.4 * (1 - lift)).toFixed(3)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      if (trigger === 'hover' && root) {
        root.removeEventListener('pointerenter', onEnter)
        root.removeEventListener('pointerleave', onLeave)
      }
    }
  }, [reduce, chars.length, amplitude, speed, stagger, trigger, shimmer])

  if (reduce) {
    return <span className={className}>{text}</span>
  }

  // Group letters into per-word wrappers so lines break only between words,
  // never mid-word, while each letter keeps a stable global ref index.
  const words: { ch: string; i: number }[][] = [[]]
  chars.forEach((ch, i) => {
    if (ch === ' ') words.push([])
    else words[words.length - 1].push({ ch, i })
  })

  return (
    <span ref={rootRef} className={className} aria-label={text} role="text">
      {words.map((word, w) => (
        <span key={w}>
          <span aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            {word.map(({ ch, i }) => (
              <span
                key={i}
                ref={(el) => {
                  charRefs.current[i] = el
                }}
                style={{ display: 'inline-block', willChange: 'transform' }}
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
