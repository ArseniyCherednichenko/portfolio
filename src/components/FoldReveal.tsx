import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

// A trifold panel that unfolds in 3D — the folded-letter / map / brochure
// gesture, rebuilt by hand. At rest the two side wings are creased back behind
// the centre panel, so only the centre shows its muted teaser line. Reach for
// the card and the wings swing flat into one continuous lit surface, and the
// full statement fades up across the spread. Fold it away and it closes again.
//
// The mechanism is one open value, 0 (folded) to 1 (flat), spring-followed so
// the paper has weight and a touch of overshoot as it lands. Three details sell
// it as a real surface rather than a CSS trick. First, the wings never pass
// 90 degrees — they go from creased-straight-back to coplanar — so there is no
// mirrored-backface moment; the fold always reads as paper turning toward the
// light. Second, each wing carries a shading layer whose darkness tracks its
// own fold angle, so a creased wing sits in shadow and lands fully lit, the way
// a sheet catches a room light as it flattens. Third, left alone it does not
// sit dead shut: it breathes a few percent ajar on a slow loop, a quiet hint
// that it is meant to be opened.
//
// Honest to assistive tech: the folding panels and both text layers are
// aria-hidden, and the card carries one plain label stating the teaser and the
// full reveal in order, so a screen reader hears the whole thing once, not a
// folded fragment. It is reachable without a pointer — the card is a focusable
// group that unfolds on focus and holds there, and a click toggles it locked
// open for touch. Under prefers-reduced-motion the fold drops entirely: the
// surface renders flat and lit with the reveal already shown, no hinge, no
// breathing, nothing to wait on.

export interface FoldRevealProps {
  /** The muted line on the centre panel while the card is folded. */
  teaser: string
  /** The headline uncovered as the card unfolds flat. */
  title: string
  /** The supporting line under the revealed headline. */
  body: string
  className?: string
}

export function FoldReveal({ teaser, title, body, className }: FoldRevealProps) {
  const reduced = useReducedMotion()
  const labelId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [locked, setLocked] = useState(false)

  // raw is the target; open is the spring the panels actually read, so the
  // paper lags and settles rather than snapping between folded and flat.
  const raw = useMotionValue(0)
  const open = useSpring(raw, { stiffness: 170, damping: 24, mass: 0.9 })

  const setOpen = useCallback((v: number) => raw.set(v), [raw])

  // Idle breathing: whenever nothing is touching it (and it is not locked open
  // or reduced), ease a few percent ajar and back on a slow loop, so a card at
  // rest hints it wants to be unfolded — the invitation a dead-shut card never
  // gives.
  useEffect(() => {
    if (reduced || active || locked) return
    const controls = animate(raw, [0.04, 0.13, 0.04], {
      duration: 5,
      ease: 'easeInOut',
      repeat: Infinity,
    })
    return () => controls.stop()
  }, [reduced, active, locked, raw])

  if (reduced) {
    return (
      <div
        role="group"
        aria-label={`${teaser}. ${title}. ${body}`}
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 ${className ?? ''}`}
      >
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-8 py-14 text-center">
          <span className="font-display text-3xl font-bold text-[#DCF87C] sm:text-4xl">{title}</span>
          <span className="max-w-md text-sm leading-relaxed text-white/55">{body}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-labelledby={labelId}
      onPointerEnter={() => {
        if (locked) return
        setActive(true)
        setOpen(1)
      }}
      onPointerLeave={() => {
        if (locked) return
        setActive(false)
        setOpen(0.04)
      }}
      onFocus={() => {
        setActive(true)
        setOpen(1)
      }}
      onBlur={() => {
        if (locked) return
        setActive(false)
        setOpen(0.04)
      }}
      onClick={() => {
        const next = !locked
        setLocked(next)
        setActive(next)
        setOpen(next ? 1 : 0.04)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const next = !locked
          setLocked(next)
          setActive(next)
          setOpen(next ? 1 : 0.04)
        }
      }}
      className={`group/fold relative cursor-pointer select-none rounded-3xl border border-white/10 bg-black/20 outline-none [perspective:1400px] focus-visible:border-[#DCF87C]/40 ${className ?? ''}`}
    >
      <span id={labelId} className="sr-only">
        {teaser}. {title}. {body}
      </span>

      {/* The folding stage. The three panels share a 3D space; the reveal copy
          rides above them on a flat layer so it stays crisp and readable. */}
      <div aria-hidden className="relative min-h-[240px] [transform-style:preserve-3d]">
        <div className="absolute inset-0 flex [transform-style:preserve-3d]">
          <Wing open={open} side="left" />
          <CentrePanel open={open} teaser={teaser} />
          <Wing open={open} side="right" />
        </div>

        <RevealLayer open={open} title={title} body={body} />
      </div>

      <span className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white/25 transition-colors group-hover/fold:text-white/40">
        {locked ? 'Fold away' : 'Unfold'}
      </span>
    </div>
  )
}

// One side wing. It is hinged on its inner edge (the one touching the centre),
// creased straight back at rest and swinging flat as `open` goes to 1. Its
// shading layer darkens with the fold so a creased wing sits in shadow.
function Wing({ open, side }: { open: MotionValue<number>; side: 'left' | 'right' }) {
  // Left wing hinges on its right edge, right wing on its left. The sign of the
  // rotation differs so both creases fold backward, away from the viewer. The
  // angle stays under 90 degrees so a creased wing is always a foreshortened
  // flap catching shadow, never flipped to its mirrored back.
  const deg = side === 'left' ? 78 : -78
  const rotateY = useTransform(open, [0, 1], [deg, 0])
  const shade = useTransform(open, [0, 1], [0.78, 0])
  return (
    <motion.div
      className="relative h-full flex-1 border-y border-white/10 bg-gradient-to-b from-white/[0.05] to-black/40"
      style={{
        rotateY,
        transformOrigin: side === 'left' ? 'right center' : 'left center',
        transformStyle: 'preserve-3d',
        borderTopLeftRadius: side === 'left' ? 24 : 0,
        borderBottomLeftRadius: side === 'left' ? 24 : 0,
        borderTopRightRadius: side === 'right' ? 24 : 0,
        borderBottomRightRadius: side === 'right' ? 24 : 0,
        borderLeft: side === 'left' ? '1px solid rgba(255,255,255,0.1)' : undefined,
        borderRight: side === 'right' ? '1px solid rgba(255,255,255,0.1)' : undefined,
      }}
    >
      {/* The crease shadow, strongest at the hinge edge, falling off across the
          wing — the soft valley a fold leaves even when flat. */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          side === 'left'
            ? 'bg-gradient-to-l from-black/35 to-transparent'
            : 'bg-gradient-to-r from-black/35 to-transparent'
        }`}
      />
      {/* Fold shading: dark while creased back, clearing as it lands flat. */}
      <motion.div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: shade }} />
    </motion.div>
  )
}

// The centre panel never folds. It holds the teaser while shut and fades it out
// as the card opens, handing the moment to the reveal layer above.
function CentrePanel({ open, teaser }: { open: MotionValue<number>; teaser: string }) {
  const teaserOpacity = useTransform(open, [0, 0.4], [1, 0])
  return (
    <div className="relative h-full flex-1 border-y border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40">
      <motion.div
        className="absolute inset-0 flex items-center justify-center px-3 text-center"
        style={{ opacity: teaserOpacity }}
      >
        <span className="text-sm font-medium uppercase tracking-[0.2em] text-white/40">{teaser}</span>
      </motion.div>
    </div>
  )
}

// The reveal copy. It sits above the folding paper on a flat, un-folded layer so
// the headline stays sharp, and fades and lifts in only over the back half of
// the unfold — the paper opens first, the words arrive once there is a surface
// to land on.
function RevealLayer({
  open,
  title,
  body,
}: {
  open: MotionValue<number>
  title: string
  body: string
}) {
  const opacity = useTransform(open, [0.5, 1], [0, 1])
  const y = useTransform(open, [0.5, 1], [14, 0])
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center"
      style={{ opacity, y }}
    >
      <span className="font-display text-3xl font-bold text-[#DCF87C] [text-shadow:0_0_26px_rgba(220,248,124,0.3)] sm:text-4xl">
        {title}
      </span>
      <span className="max-w-md text-sm leading-relaxed text-white/60">{body}</span>
    </motion.div>
  )
}
