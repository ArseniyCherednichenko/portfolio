import { useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// Lens — a magnifying glass that follows the pointer across a surface and
// reveals a zoomed circular region under it, like a loupe laid on a print.
//
// The mechanic is a single radial mask, not a second scaled clone chased into
// alignment: the same children are painted twice — once normally, once as an
// aria-hidden overlay scaled up with its transform-origin pinned to the cursor
// — and a radial-gradient maskImage on the overlay shows only a circle of it
// around the pointer. Pinning transform-origin to the cursor keeps whatever is
// directly under the loupe fixed as it magnifies, so the glass reads as a real
// lens rather than a panning window, and the alignment holds at any size or
// zoom without measuring a thing.
//
// Distinct from its neighbours: SpotlightReveal uncovers hidden copy under a
// moving mask, Crosshair measures with hairlines, and Lightbox opens media
// fullscreen — this magnifies what is already on the surface, in place. The
// glass rim and a soft inner light sell the loupe; both are pointer-events-none
// so the lens never intercepts a click.
//
// Honest to the machine and to assistive tech: the magnified layer is
// aria-hidden decoration, so nothing is duplicated into the accessibility tree,
// and the real children underneath stay the single source of truth. Under
// prefers-reduced-motion the loupe still works — it is direct manipulation, not
// autonomous motion — but the fade-and-scale entrance and the springy rim are
// dropped for an instant, still appearance.
export function Lens({
  children,
  zoom = 1.8,
  size = 170,
  className = '',
}: {
  children: ReactNode
  /** Magnification factor of the region under the glass. */
  zoom?: number
  /** Lens diameter in pixels. */
  size?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const r = size / 2

  function track(e: PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setPos({ x: e.clientX - box.left, y: e.clientY - box.top })
  }

  // A hard-edged circular mask centred on the cursor. transparent-at-100%
  // gives a crisp rim the glass border then traces exactly.
  const mask = `radial-gradient(circle ${r}px at ${pos.x}px ${pos.y}px, #000 100%, transparent 100%)`

  return (
    <div
      ref={ref}
      onPointerEnter={(e) => {
        track(e)
        setActive(true)
      }}
      onPointerMove={track}
      onPointerLeave={() => setActive(false)}
      className={`relative overflow-hidden ${active ? 'cursor-none' : ''} ${className}`}
    >
      {children}

      <AnimatePresence>
        {active && (
          <>
            {/* The magnified layer, masked to a circle around the pointer. */}
            <motion.div
              key="lens-zoom"
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                maskImage: mask,
                WebkitMaskImage: mask,
              }}
              initial={reduce ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: `${pos.x}px ${pos.y}px`,
                }}
              >
                {children}
              </div>
            </motion.div>

            {/* The glass: a rim, an inner light, and a soft cast shadow. */}
            <motion.span
              key="lens-rim"
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{
                width: size,
                height: size,
                left: pos.x - r,
                top: pos.y - r,
                boxShadow:
                  'inset 0 0 0 1px rgba(255,255,255,0.55), inset 0 2px 12px rgba(255,255,255,0.14), 0 10px 34px rgba(0,0,0,0.45)',
                background:
                  'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.16), transparent 42%)',
              }}
              initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 1 } : { scale: 0.6, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
