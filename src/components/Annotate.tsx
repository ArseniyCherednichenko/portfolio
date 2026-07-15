import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

/**
 * Annotate — a hand-drawn, RoughNotation-style marker that draws itself around a
 * short phrase when it scrolls into view. Distinct from every other motion in the
 * set: not text that assembles (SplitText/ScrollReveal), not a comet on a border
 * (BorderBeam), not text on a path (CurvedLoop) — this is an editorial pen stroke
 * (underline, circle, box, strike, bracket) sketched over real copy, giving the
 * writing a marked-up, human voice.
 *
 * The stroke is a slightly wobbly SVG path built with a *seeded* RNG (mulberry32,
 * never Math.random) so the same phrase always sketches the same way, and it draws
 * on via Framer's native `pathLength` (0 -> 1). It is pure decoration: the wrapped
 * text stays the real, selectable content and the SVG is aria-hidden.
 *
 * Meant for a short, non-wrapping phrase (the RoughNotation use). If the phrase
 * wraps to two lines the single-line stroke will not follow the wrap.
 *
 * Under reduced motion the mark renders fully drawn, instantly, with no animation.
 */

export type AnnotateType = 'underline' | 'strike' | 'box' | 'circle' | 'bracket'

interface AnnotateProps {
  children: React.ReactNode
  type?: AnnotateType
  color?: string
  /** stroke width in px */
  strokeWidth?: number
  /** seconds the draw-on takes */
  duration?: number
  /** seconds before it starts once in view */
  delay?: number
  /** replay every time it enters the viewport (default: draw once) */
  repeat?: boolean
  /** seed for the hand-drawn wobble; same seed -> same stroke */
  seed?: number
  className?: string
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Margin around the text box the SVG overflows into, so a circle/box can sit
// outside the glyphs and the stroke's round cap is never clipped.
const M = 8

type Pt = [number, number]

/** A smooth open path threaded through the points (quadratic smoothing). */
function smooth(pts: Pt[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    const mx = (x + nx) / 2
    const my = (y + ny) / 2
    d += ` Q ${x.toFixed(1)} ${y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`
  return d
}

/** Build the mark path(s) for a text box of size w x h (inside the M margin). */
function buildPaths(type: AnnotateType, w: number, h: number, rng: () => number): string[] {
  // Text rect inside the overflow margin.
  const x0 = M
  const y0 = M
  const x1 = M + w
  const y1 = M + h
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const jit = (amt: number) => (rng() - 0.5) * 2 * amt

  if (type === 'underline' || type === 'strike') {
    const y = type === 'strike' ? cy + jit(1) : y1 - 1
    const overshoot = Math.min(6, w * 0.04)
    const n = 5
    const pts: Pt[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = x0 - overshoot + (w + overshoot * 2) * t
      // gentle wave + per-point wobble; ends settle flatter
      const wave = Math.sin(t * Math.PI) * (h * 0.06 + 1)
      pts.push([x, y + jit(1.4) + (type === 'underline' ? wave : jit(1.2))])
    }
    return [smooth(pts)]
  }

  if (type === 'circle') {
    const rx = w / 2 + Math.min(10, w * 0.06) + 3
    const ry = h / 2 + 5
    const start = -Math.PI * 0.62 // begin up-left
    const sweep = Math.PI * 2 + Math.PI * 0.42 // overshoot past the start
    const n = 26
    const pts: Pt[] = []
    for (let i = 0; i <= n; i++) {
      const a = start + (sweep * i) / n
      pts.push([cx + Math.cos(a) * (rx + jit(2)), cy + Math.sin(a) * (ry + jit(2))])
    }
    return [smooth(pts)]
  }

  if (type === 'box') {
    const pad = 4
    const bx0 = x0 - pad
    const by0 = y0 - pad
    const bx1 = x1 + pad
    const by1 = y1 + pad
    // trace the rectangle as one open loop starting mid top-left, overshooting the close
    const corners: Pt[] = [
      [bx0 + (bx1 - bx0) * 0.12, by0],
      [bx1, by0],
      [bx1, by1],
      [bx0, by1],
      [bx0, by0],
      [bx0 + (bx1 - bx0) * 0.22, by0], // overshoot past the start
    ]
    // subtly jitter every corner so no edge is dead straight
    const pts = corners.map(([x, y]) => [x + jit(1.6), y + jit(1.6)] as Pt)
    return [smooth(pts)]
  }

  // bracket — a [ and ] hugging the phrase, drawn together
  const pad = 3
  const lip = Math.min(7, w * 0.05) + 4
  const bx0 = x0 - pad
  const bx1 = x1 + pad
  const left = `M ${(bx0 + lip).toFixed(1)} ${(y0 + jit(1)).toFixed(1)} L ${bx0.toFixed(1)} ${(y0 + jit(1)).toFixed(1)} L ${bx0.toFixed(1)} ${(y1 + jit(1)).toFixed(1)} L ${(bx0 + lip).toFixed(1)} ${(y1 + jit(1)).toFixed(1)}`
  const right = `M ${(bx1 - lip).toFixed(1)} ${(y0 + jit(1)).toFixed(1)} L ${bx1.toFixed(1)} ${(y0 + jit(1)).toFixed(1)} L ${bx1.toFixed(1)} ${(y1 + jit(1)).toFixed(1)} L ${(bx1 - lip).toFixed(1)} ${(y1 + jit(1)).toFixed(1)}`
  return [left, right]
}

export function Annotate({
  children,
  type = 'underline',
  color = '#DCF87C',
  strokeWidth = 2,
  duration = 0.7,
  delay = 0,
  repeat = false,
  seed = 1,
  className = '',
}: AnnotateProps) {
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const inView = useInView(wrapRef, { once: !repeat, margin: '-10% 0px -10% 0px' })

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize((s) => (Math.abs(s.w - r.width) > 0.5 || Math.abs(s.h - r.height) > 0.5 ? { w: r.width, h: r.height } : s))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

  const W = size.w + M * 2
  const H = size.h + M * 2
  const paths = size.w > 0 ? buildPaths(type, size.w, size.h, mulberry32(seed)) : []
  const draw = reduced || inView

  return (
    <span ref={wrapRef} className={`relative inline-block ${className}`}>
      {children}
      {size.w > 0 && (
        <svg
          aria-hidden
          className="pointer-events-none absolute overflow-visible"
          style={{ left: -M, top: -M, width: W, height: H }}
          viewBox={`0 0 ${W} ${H}`}
          fill="none"
        >
          {paths.map((d, i) => (
            <motion.path
              key={`${type}-${i}-${size.w}`}
              d={d}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={draw ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{
                pathLength: { duration, delay: delay + i * duration * 0.5, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.15, delay: delay + i * duration * 0.5 },
              }}
            />
          ))}
        </svg>
      )}
    </span>
  )
}

export default Annotate
