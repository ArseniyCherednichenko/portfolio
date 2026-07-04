import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A gooey liquid-blob field, in the spirit of React Bits' MetaBalls. Several
// lime blobs drift on their own paths inside an SVG gooey filter (a blur plus a
// crushed-alpha colour matrix), so where two blobs approach they fuse with a
// stretching liquid neck instead of overlapping as flat discs. A dedicated blob
// eases toward the cursor and gathers the drifters as it passes, so the whole
// mass leans and merges toward the pointer. Pure requestAnimationFrame writing
// straight to the circle attributes, so there is no per-blob React state on the
// hot path. Under reduced motion it paints a single calm, static composition
// with no loop or listeners. Decorative, so the field is aria-hidden.

type Blob = {
  fx: number // base x, fraction of width
  fy: number // base y, fraction of height
  fr: number // radius, fraction of the smaller side
  ax: number // drift amplitude x, fraction of width
  ay: number // drift amplitude y, fraction of height
  wx: number // angular speed x (rad/s)
  wy: number // angular speed y (rad/s)
  phx: number // phase x
  phy: number // phase y
}

// Deterministic per-index generator (mulberry32) so a given blob count always
// renders the same arrangement, matching the repo's no-Math.random convention.
function seeded(i: number): () => number {
  let s = ((i + 1) * 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeBlobs(count: number): Blob[] {
  const blobs: Blob[] = []
  for (let i = 0; i < count; i++) {
    const rnd = seeded(i)
    blobs.push({
      fx: 0.14 + rnd() * 0.72,
      fy: 0.16 + rnd() * 0.68,
      fr: 0.09 + rnd() * 0.12,
      ax: 0.05 + rnd() * 0.11,
      ay: 0.05 + rnd() * 0.1,
      wx: 0.18 + rnd() * 0.42,
      wy: 0.18 + rnd() * 0.42,
      phx: rnd() * Math.PI * 2,
      phy: rnd() * Math.PI * 2,
    })
  }
  return blobs
}

let uid = 0

export function MetaBalls({
  count = 7,
  color = '#DCF87C',
  className = '',
}: {
  count?: number
  color?: string
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const blurRef = useRef<SVGFEGaussianBlurElement>(null)
  const circleRefs = useRef<(SVGCircleElement | null)[]>([])
  const reduce = useReducedMotion()
  const idRef = useRef<number>(0)
  if (idRef.current === 0) idRef.current = ++uid
  const filterId = `metaballs-${idRef.current}`

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg) return

    const blobs = makeBlobs(count)
    let w = 0
    let h = 0
    let raf = 0
    // A cursor blob eased toward the pointer; its radius grows on enter and
    // shrinks away when the pointer leaves, so interaction reads clearly.
    const cursor = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, active: false }

    function measure() {
      const rect = wrap!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      svg!.setAttribute('viewBox', `0 0 ${w} ${h}`)
      const min = Math.min(w, h)
      if (blurRef.current) blurRef.current.setAttribute('stdDeviation', String(min * 0.045))
      if (!cursor.active) {
        cursor.x = cursor.tx = w / 2
        cursor.y = cursor.ty = h / 2
      }
    }

    function place(i: number, cx: number, cy: number, r: number) {
      const c = circleRefs.current[i]
      if (!c) return
      c.setAttribute('cx', cx.toFixed(1))
      c.setAttribute('cy', cy.toFixed(1))
      c.setAttribute('r', Math.max(0, r).toFixed(1))
    }

    function paintStatic() {
      measure()
      const min = Math.min(w, h)
      blobs.forEach((b, i) => place(i, b.fx * w, b.fy * h, b.fr * min))
      // Cursor blob rests, unused, in the middle at zero radius.
      place(blobs.length, w / 2, h / 2, 0)
    }

    if (reduce) {
      paintStatic()
      const ro = new ResizeObserver(paintStatic)
      ro.observe(wrap)
      return () => ro.disconnect()
    }

    function frame(ts: number) {
      const t = ts / 1000
      const min = Math.min(w, h)

      // Ease the cursor blob toward its target and its radius toward the goal.
      cursor.x += (cursor.tx - cursor.x) * 0.14
      cursor.y += (cursor.ty - cursor.y) * 0.14
      cursor.tr = cursor.active ? min * 0.16 : 0
      cursor.r += (cursor.tr - cursor.r) * 0.12

      blobs.forEach((b, i) => {
        let cx = (b.fx + b.ax * Math.sin(t * b.wx + b.phx)) * w
        let cy = (b.fy + b.ay * Math.cos(t * b.wy + b.phy)) * h
        // Gather drifters toward the pointer when it is near, so the mass leans.
        if (cursor.active) {
          const dx = cursor.tx - cx
          const dy = cursor.ty - cy
          const dist = Math.hypot(dx, dy) || 1
          const reach = min * 1.1
          const pull = Math.max(0, 1 - dist / reach) * 0.28
          cx += dx * pull
          cy += dy * pull
        }
        place(i, cx, cy, b.fr * min)
      })
      place(blobs.length, cursor.x, cursor.y, cursor.r)

      raf = requestAnimationFrame(frame)
    }

    function onMove(e: PointerEvent) {
      const rect = wrap!.getBoundingClientRect()
      cursor.tx = e.clientX - rect.left
      cursor.ty = e.clientY - rect.top
      cursor.active = true
    }
    function onLeave() {
      cursor.active = false
      cursor.tx = w / 2
      cursor.ty = h / 2
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [count, reduce])

  return (
    <div ref={wrapRef} aria-hidden className={`relative h-full w-full ${className}`}>
      <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`} fill={color}>
          {Array.from({ length: count + 1 }).map((_, i) => (
            <circle
              key={i}
              ref={(el) => {
                circleRefs.current[i] = el
              }}
              cx="0"
              cy="0"
              r="0"
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
