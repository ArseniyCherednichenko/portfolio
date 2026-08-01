import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A gooey blob that chases the pointer across a surface. A short chain of solid
// circles trails the cursor — the lead blob eases toward the pointer and each
// follower eases toward the one ahead of it — and the whole chain is rendered
// under an SVG gooey filter (a Gaussian blur crushed by an alpha-ramp matrix),
// so the circles fuse into one liquid mass with a stretching tail rather than
// reading as separate dots. Distinct from everything near it in the field
// family: MetaBalls drift on their own timeline, Ribbons streak thin canvas
// trails, PixelTrail lights a grid under the cursor, and Crosshair is a precise
// reticle — this is soft, physical, and grabbable-feeling.
//
// Honest to the machine: one RAF loop writes translate3d straight onto the
// blobs (no per-blob React state), the filter id comes off a module counter (no
// Math.random, which is unavailable here, and no useId churn), and pressing
// swells the whole chain. It fills a positioned parent and only lives while the
// pointer is over that parent, resting off-screen otherwise. Under reduced
// motion the loop never starts: a single still blob sits at the centre so the
// soft liquid shape still reads while nothing chases anything.

// Module-scoped counter keeps every mounted instance on its own filter id,
// matching the other gooey components in the library.
let blobSeq = 0

export function BlobCursor({
  className = '',
  color = '#DCF87C',
  /** Number of trailing circles. More reads as a longer, heavier tail. */
  count = 4,
  /** Diameter of the lead blob, in px. Followers taper down from here. */
  size = 64,
  /** How hard the lead blob eases toward the pointer (0–1). */
  lead = 0.22,
  /** How hard each follower eases toward the blob ahead of it (0–1). */
  follow = 0.32,
  /** Blur radius fed to the gooey filter — higher fuses the blobs more. */
  goo = 12,
}: {
  className?: string
  color?: string
  count?: number
  size?: number
  lead?: number
  follow?: number
  goo?: number
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const blobRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [filterId] = useState(() => `blob-goo-${blobSeq++}`)

  // Diameter of each blob in the chain: the lead is `size`, the tail tapers.
  const sizes = Array.from({ length: count }, (_, i) => size * (1 - i * (0.4 / count)))

  useEffect(() => {
    if (reduce) return
    const wrap = wrapRef.current
    if (!wrap) return

    // Chain of positions (centre coords, in px within the wrapper). Start them
    // stacked at the centre so the first frame doesn't fling in from 0,0.
    const rect0 = wrap.getBoundingClientRect()
    // Local copy of the taper so the effect doesn't depend on a fresh array
    // reference each render.
    const chainSizes = Array.from({ length: count }, (_, i) => size * (1 - i * (0.4 / count)))
    const pos = Array.from({ length: count }, () => ({
      x: rect0.width / 2,
      y: rect0.height / 2,
    }))
    const target = { x: rect0.width / 2, y: rect0.height / 2 }
    let active = false
    let press = 0 // eased 0→1 while the pointer is held down
    let pressTarget = 0
    let raf = 0

    function onMove(e: PointerEvent) {
      const rect = wrap!.getBoundingClientRect()
      target.x = e.clientX - rect.left
      target.y = e.clientY - rect.top
      active = true
    }
    function onLeave() {
      active = false
    }
    function onDown() {
      pressTarget = 1
    }
    function onUp() {
      pressTarget = 0
    }

    function frame() {
      // When the pointer is away, let the chain drift back to the centre so it
      // rests calmly instead of freezing at the last edge it touched.
      const rect = wrap!.getBoundingClientRect()
      if (!active) {
        target.x = rect.width / 2
        target.y = rect.height / 2
      }
      press += (pressTarget - press) * 0.2

      pos[0].x += (target.x - pos[0].x) * lead
      pos[0].y += (target.y - pos[0].y) * lead
      for (let i = 1; i < count; i++) {
        pos[i].x += (pos[i - 1].x - pos[i].x) * follow
        pos[i].y += (pos[i - 1].y - pos[i].y) * follow
      }

      // A gentle swell on press, fading and easing along the tail so the
      // release ripples down the chain.
      const grow = 1 + press * 0.28
      for (let i = 0; i < count; i++) {
        const el = blobRefs.current[i]
        if (!el) continue
        const d = chainSizes[i] * grow * (active || press > 0.01 ? 1 : 0.82)
        const half = d / 2
        el.style.width = `${d}px`
        el.style.height = `${d}px`
        el.style.transform = `translate3d(${pos[i].x - half}px, ${pos[i].y - half}px, 0)`
      }
      raf = requestAnimationFrame(frame)
    }

    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)
    wrap.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
      wrap.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [reduce, count, size, lead, follow])

  // Reduced motion: one still blob at the centre, no loop, no listeners — the
  // liquid shape reads while nothing chases the pointer.
  if (reduce) {
    return (
      <div
        className={`pointer-events-none absolute inset-0 grid place-items-center ${className}`}
        aria-hidden="true"
      >
        <span
          className="rounded-full"
          style={{
            width: size,
            height: size,
            background: color,
            filter: 'blur(2px)',
            opacity: 0.9,
          }}
        />
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={`absolute inset-0 ${className}`} aria-hidden="true">
      {/* The gooey filter: blur fuses the circles into overlapping halos, then
          the alpha row of the matrix (large multiply, negative bias) snaps the
          ramp so the halos weld into one liquid edge with a stretching tail. */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={goo} result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            />
          </filter>
        </defs>
      </svg>
      <div className="absolute inset-0" style={{ filter: `url(#${filterId})` }}>
        {sizes.map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              blobRefs.current[i] = el
            }}
            className="absolute left-0 top-0 rounded-full will-change-transform"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  )
}
