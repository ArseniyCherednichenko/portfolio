import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// PinCard — the "3D pin" card, hand-built.
//
// A card that reads as pinned to a board: at rest it sits flat like every
// other surface, but on hover (or keyboard focus) the whole face lies back on
// its perspective while a floating label rises out of it on a dropped line,
// haloed by expanding radar rings. It is the Aceternity / 21st.dev "3D Pin"
// signature, and a genuinely new *kind* for the card family here — distinct
// from the TiltCard (which leans toward the cursor and stays flat-on), the
// FlipCard (a real half-rotation to a back face), and the SpotlightCard (a
// tracked glow). Here the motion is a lie-back-and-lift: the card tips away
// from you and the pin it hangs from floats forward.
//
// Renders as a router <Link> when given `to`, an external anchor for `href`,
// or a plain <div> otherwise — so it works as a real destination or a static
// showcase. Accessible: the whole surface is one focus target that shows the
// pin on focus as well as hover. Under prefers-reduced-motion the lie-back and
// the ring pulse are dropped — the pin simply fades in, no travel, no spin.

const EASE = [0.16, 1, 0.3, 1] as const

export interface PinCardProps {
  /** The floating label that lifts out on hover — a place, a role, a hint. */
  title: string
  /** Internal route (renders a router Link). */
  to?: string
  /** External URL (renders an anchor, opens in a new tab). */
  href?: string
  /** The card face. */
  children: ReactNode
  className?: string
}

// The expanding radar rings behind the floating pin. Three concentric borders
// that scale outward and fade on a staggered loop, so the pin reads as a live
// beacon rather than a static badge.
function Radar({ animate }: { animate: boolean }) {
  const rings = [0, 1, 2]
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {rings.map((i) =>
        animate ? (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#DCF87C]/25"
            initial={{ scale: 0.35, opacity: 0 }}
            animate={{ scale: [0.35, 1.15, 1.6], opacity: [0, 0.7, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut', delay: i * 0.86 }}
          />
        ) : (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#DCF87C]/20"
            style={{ transform: `translate(-50%,-50%) scale(${0.6 + i * 0.4})` }}
          />
        ),
      )}
    </div>
  )
}

export function PinCard({ title, to, href, children, className = '' }: PinCardProps) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(false)

  const lift = active && !reduce

  const face = (
    <>
      {/* The floating pin: a labelled pill on a dropped gradient line, haloed
          by radar rings. Lives above the card in its own 3D layer so it reads
          as hovering forward while the card lies back. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <AnimatePresence>
          {active && (
            <motion.div
              className="absolute flex flex-col items-center"
              style={{ top: reduce ? -18 : -76 }}
              initial={{ opacity: 0, y: reduce ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : 14 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <div className="relative flex items-center justify-center">
                <Radar animate={!reduce} />
                <span className="relative z-10 whitespace-nowrap rounded-full border border-[#DCF87C]/40 bg-[#0A0A0A]/90 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#DCF87C] shadow-[0_0_24px_rgba(220,248,124,0.18)] backdrop-blur">
                  {title}
                </span>
              </div>
              {!reduce && (
                <span
                  aria-hidden
                  className="mt-1 block h-9 w-px bg-gradient-to-b from-[#DCF87C]/70 to-transparent"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* The card face itself. On lift it tips away from the viewer and eases
          back a touch, so the pin appears to float out in front of it. */}
      <motion.div
        className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
        style={{ transformStyle: 'preserve-3d' }}
        animate={
          lift
            ? { rotateX: 22, scale: 0.94, y: 10 }
            : { rotateX: 0, scale: 1, y: 0 }
        }
        transition={{ duration: 0.5, ease: EASE }}
      >
        {/* A lime wash that warms the face as it lifts. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 0%, rgba(220,248,124,0.14), transparent 60%)',
          }}
          animate={{ opacity: lift ? 1 : 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        {children}
      </motion.div>
    </>
  )

  const wrapperClass = `group relative block text-left outline-none ${className}`
  const wrapperStyle = { perspective: 1000 } as const

  const bind = {
    className: wrapperClass,
    style: wrapperStyle,
    onMouseEnter: () => setActive(true),
    onMouseLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
  }

  if (to) {
    return (
      <Link to={to} aria-label={title} {...bind}>
        {face}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={title} {...bind}>
        {face}
      </a>
    )
  }
  return (
    <div tabIndex={0} aria-label={title} {...bind}>
      {face}
    </div>
  )
}
