import { motion, useAnimationControls, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type CSSProperties } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * One stroke of the drawing. A bare `d` string, or an object to override the
 * per-path weight, colour, dash feel, or fill for that stroke alone.
 */
export type DrawPath =
  | string
  | {
      d: string
      strokeWidth?: number
      stroke?: string
      /** Paint the enclosed area once the outline finishes drawing. */
      fill?: string
      className?: string
      /** Extra delay (seconds) before this stroke starts, on top of the stagger. */
      delay?: number
    }

function norm(p: DrawPath): Exclude<DrawPath, string> {
  return typeof p === 'string' ? { d: p } : p
}

/**
 * DrawSVG — line-art that draws itself, one stroke at a time.
 *
 * A genuinely different *kind* of motion for the library: not a spring, a
 * canvas field, or a text effect, but an outline that traces itself into being
 * via Framer's `pathLength` (0 -> 1). Timeline and ScrollScene only *scale* a
 * bar to fake a draw; this animates the real path length, so any hand-authored
 * curve — a swash, a flourish, an arrow, a monogram — appears as if drawn by a
 * pen. Rounded caps/joins give it an ink-on-paper feel.
 *
 * Trigger:
 *  - `'inView'` (default) — traces once as it scrolls into view.
 *  - `'mount'`  — traces immediately on mount (above-the-fold accents).
 *  - `'loop'`   — traces, holds, fades the stroke back, and redraws forever.
 * When `replayOnHover` (default true) and a fine pointer is present, hovering
 * the drawing re-traces it from empty.
 *
 * Honest to assistive tech: the `<svg>` carries `role="img"` + the given
 * `aria-label` (or is `aria-hidden` when purely decorative and unlabelled).
 *
 * Under **reduced motion** every stroke renders fully drawn from the first
 * paint — no controls, no listeners, no loop. Nothing is gated behind motion.
 */
export function DrawSVG({
  paths,
  viewBox,
  stroke = '#DCF87C',
  strokeWidth = 3,
  duration = 1.1,
  stagger = 0.18,
  delay = 0,
  trigger = 'inView',
  replayOnHover = true,
  loopHold = 1.4,
  className = '',
  style,
  ariaLabel,
}: {
  paths: DrawPath[]
  viewBox: string
  stroke?: string
  strokeWidth?: number
  /** Seconds to trace each stroke. */
  duration?: number
  /** Seconds between the start of one stroke and the next. */
  stagger?: number
  /** Seconds before the whole drawing starts. */
  delay?: number
  trigger?: 'inView' | 'mount' | 'loop'
  replayOnHover?: boolean
  /** For `trigger='loop'`: seconds the finished drawing holds before redrawing. */
  loopHold?: number
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: trigger !== 'loop', margin: '-60px' })
  const controls = useAnimationControls()
  const finePointer = useRef(false)

  const items = paths.map(norm)

  // Total time for one full pass, so the loop knows when to redraw.
  const passMs = (delay + (items.length - 1) * stagger + duration) * 1000

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      finePointer.current = window.matchMedia('(pointer: fine)').matches
    }
  }, [])

  useEffect(() => {
    if (reduced) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const runOnce = () => controls.start('visible')

    if (trigger === 'mount') {
      runOnce()
    } else if (trigger === 'inView') {
      if (inView) runOnce()
    } else {
      // loop: draw, hold, erase, redraw — but only while in view.
      const cycle = async () => {
        if (cancelled) return
        controls.set('hidden')
        await controls.start('visible')
        if (cancelled) return
        timer = setTimeout(async () => {
          if (cancelled) return
          await controls.start('faded')
          if (!cancelled) cycle()
        }, loopHold * 1000)
      }
      if (inView) cycle()
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // passMs derives from the timing props; re-run if any change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, trigger, inView, controls, loopHold, passMs])

  const replay = () => {
    if (reduced || !replayOnHover || !finePointer.current || trigger === 'loop') return
    controls.set('hidden')
    controls.start('visible')
  }

  const variants = {
    hidden: { pathLength: 0, opacity: 0 },
    faded: { pathLength: 1, opacity: 0, transition: { opacity: { duration: 0.4, ease: 'easeOut' } } },
    visible: (i: number) => ({
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration, ease: EASE, delay: delay + i * stagger },
        opacity: { duration: 0.001, delay: delay + i * stagger },
      },
    }),
  }

  return (
    <motion.svg
      ref={ref}
      viewBox={viewBox}
      fill="none"
      className={className}
      style={style}
      onHoverStart={replay}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      preserveAspectRatio="xMidYMid meet"
    >
      {items.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          stroke={p.stroke ?? stroke}
          strokeWidth={p.strokeWidth ?? strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={p.fill ?? 'none'}
          custom={i}
          variants={variants}
          initial={reduced ? false : 'hidden'}
          animate={reduced ? undefined : controls}
          style={reduced ? { pathLength: 1, opacity: 1 } : undefined}
          transition={p.delay ? { delay: p.delay } : undefined}
        />
      ))}
    </motion.svg>
  )
}

/**
 * A ready-made editorial "hand-drawn" underline swash — the most common use of
 * DrawSVG. One confident sweep with a lighter second pass beneath it, so it
 * reads as two quick pen strokes rather than a printed rule. Sits under a
 * heading; scale it with width/height utilities via `className`.
 */
export function HandUnderline({
  className = '',
  stroke = '#DCF87C',
  trigger = 'inView',
  delay = 0,
  ariaLabel,
}: {
  className?: string
  stroke?: string
  trigger?: 'inView' | 'mount' | 'loop'
  delay?: number
  ariaLabel?: string
}) {
  return (
    <DrawSVG
      viewBox="0 0 320 34"
      className={className}
      stroke={stroke}
      strokeWidth={4}
      duration={0.9}
      stagger={0.22}
      delay={delay}
      trigger={trigger}
      ariaLabel={ariaLabel}
      paths={[
        // The confident top stroke, rising a touch as it finishes.
        'M8 20 C 78 8, 168 6, 236 14 C 274 18, 300 17, 314 9',
        // A lighter, shorter under-stroke for the two-pass hand feel.
        { d: 'M18 27 C 96 21, 214 22, 292 27', strokeWidth: 2.5 },
      ]}
    />
  )
}
