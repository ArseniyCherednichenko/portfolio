import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import type { AnimationPlaybackControls } from 'framer-motion'

// StickerPeel: a tactile dog-ear. A lime sticker sits flush on the surface;
// grab its bottom-right corner and drag toward the middle and it peels back like
// a real sticker — the folded flap shows its paper backface and casts a soft
// shadow onto the line printed underneath, which reads through the gap the peel
// opens. Let go past halfway and it settles open; let go short and it springs
// flat and re-adheres. Tap or press Enter to toggle it hands-free.
//
// The whole fold is one number. `f` is the peel fraction (0 flat, 1 folded to
// the diagonal): the sticker face is a pentagon clipped by a 45-degree corner
// cut that grows with `f`, and the flap is the mirror-image triangle that corner
// folds onto — both are just clip-paths driven off the same MotionValue, so the
// geometry stays exact without a canvas or a layout pass. A drag sets `f`
// directly for a 1:1 feel; release hands it to a spring for the snap; when idle
// and shut it breathes a few percent so the corner reads as grabbable.
//
// Kin to ScratchReveal and PixelTransition — the site's other "uncover" pieces —
// but where those erase or flip a face, this one physically folds the surface
// out of the way. The revealed line is a real, selectable element always in the
// DOM; the flap and its sheen are aria-hidden decoration. Under reduced motion
// there is no spring, no breathing, no drag physics: it is a plain toggle button
// that shows or hides the line with the fold held at a calm resting angle.

// Resting peel fraction when the sticker is settled open.
const OPEN = 0.6
// Release past this fraction settles open; below it, springs flat.
const SETTLE = 0.34
// Hard cap so a fast drag can't invert the fold through the diagonal.
const MAX = 0.86

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 18, mass: 0.9 }

export function StickerPeel({
  className = '',
  face = 'AC',
  eyebrow = 'Peel me',
  reveal = 'Built by hand in Berlin.',
  signoff = 'Arseniy',
}: {
  className?: string
  /** Short mark shown large on the sticker face. */
  face?: string
  /** Small label above the mark, hinting at the interaction. */
  eyebrow?: string
  /** The honest line uncovered under the peel. */
  reveal?: string
  /** Small attribution shown beneath the revealed line. */
  signoff?: string
}) {
  const reduce = useReducedMotion()
  const stickerRef = useRef<HTMLDivElement>(null)
  const f = useMotionValue(0)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const dragging = useRef(false)
  const moved = useRef(false)
  const openRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [grab, setGrab] = useState(false)

  // The corner cut lives at p% from the top-left on both trailing edges; as `f`
  // grows the cut marches in toward the centre. The face keeps everything but
  // that corner; the flap is exactly the corner, folded back over the face.
  const faceClip = useTransform(f, (v) => {
    const p = (100 - v * 100).toFixed(2)
    return `polygon(0% 0%, 100% 0%, 100% ${p}%, ${p}% 100%, 0% 100%)`
  })
  const flapClip = useTransform(f, (v) => {
    const p = (100 - v * 100).toFixed(2)
    return `polygon(${p}% 100%, 100% ${p}%, ${p}% ${p}%)`
  })
  // The flap lifts off the surface as it folds, so its shadow deepens with `f`.
  const flapShadow = useTransform(
    f,
    (v) => `drop-shadow(${(-v * 10).toFixed(1)}px ${(-v * 10).toFixed(1)}px ${(6 + v * 14).toFixed(1)}px rgba(0,0,0,0.45))`,
  )
  const flapOpacity = useTransform(f, [0, 0.03, 1], [0, 1, 1])

  const startBreathing = useCallback(() => {
    if (reduce || openRef.current || dragging.current) return
    anim.current?.stop()
    anim.current = animate(f, [0, 0.05, 0], {
      duration: 3.4,
      repeat: Infinity,
      ease: 'easeInOut',
    })
  }, [f, reduce])

  // Settle to a resting state: flat (and then breathing) or held open.
  const rest = useCallback(
    (toOpen: boolean) => {
      anim.current?.stop()
      openRef.current = toOpen
      if (reduce) {
        f.set(toOpen ? OPEN : 0)
        return
      }
      anim.current = animate(f, toOpen ? OPEN : 0, {
        ...SPRING,
        onComplete: () => {
          if (!toOpen) startBreathing()
        },
      })
    },
    [f, reduce, startBreathing],
  )

  // Kick off the idle breathing once mounted (and settle reduced-motion flat).
  useEffect(() => {
    if (reduce) {
      f.set(0)
      return
    }
    startBreathing()
    return () => anim.current?.stop()
  }, [f, reduce, startBreathing])

  const toggle = useCallback(() => {
    const next = !openRef.current
    setOpen(next)
    rest(next)
  }, [rest])

  // Map a pointer position to a peel fraction. The folded corner tip rides the
  // main diagonal; projecting the pointer onto that diagonal gives how far in the
  // corner has travelled, and the fraction is how far that is from flat.
  const peelFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = stickerRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const s = Math.max(1, Math.min(r.width, r.height))
    const px = clientX - r.left
    const py = clientY - r.top
    const v = 1 - (px + py) / (2 * s)
    return Math.max(0, Math.min(MAX, v))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduce) return
      dragging.current = true
      moved.current = false
      setGrab(true)
      anim.current?.stop()
      f.set(peelFromPointer(e.clientX, e.clientY))
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    [f, peelFromPointer, reduce],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      moved.current = true
      f.set(peelFromPointer(e.clientX, e.clientY))
    },
    [f, peelFromPointer],
  )

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    setGrab(false)
    // A tap with no travel toggles; a real drag settles by where it was let go.
    const next = moved.current ? f.get() > SETTLE : !openRef.current
    setOpen(next)
    rest(next)
  }, [f, rest])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    },
    [toggle],
  )

  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-3xl bg-[#0c0d09] ${className}`}>
      {/* Soft ground so the sticker reads as sitting on a surface. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 15%, rgba(220,248,124,0.06), transparent 60%), radial-gradient(90% 70% at 70% 90%, rgba(255,255,255,0.03), transparent 65%)',
        }}
      />

      <div
        ref={stickerRef}
        role="button"
        tabIndex={0}
        aria-pressed={open}
        aria-label={open ? `Peeled: ${reveal}. Press to reseal.` : `Sticker. Press to peel and reveal a note.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative aspect-square w-[62%] max-w-[280px] min-w-[180px] touch-none select-none rounded-[26px] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0d09]"
        style={{ cursor: reduce ? 'pointer' : grab ? 'grabbing' : 'grab' }}
      >
        {/* Underneath: the line the peel uncovers. Always in the DOM. */}
        <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-[26px] bg-[#111309] p-6 text-center ring-1 ring-inset ring-white/5">
          <div>
            <p className="font-display text-xl font-semibold leading-tight text-white sm:text-2xl">{reveal}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.3em] text-[#DCF87C]/80">— {signoff}</p>
          </div>
        </div>

        {/* The sticker face — clipped so the peeling corner opens onto the line. */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden rounded-[26px]"
          style={{ clipPath: faceClip }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 120% at 30% 20%, #e8ff9a 0%, #DCF87C 45%, #c4e85f 100%)',
            }}
          />
          {/* Faint grain and a top sheen so the face is not a flat fill. */}
          <div
            className="absolute inset-0 mix-blend-overlay"
            style={{
              background:
                'linear-gradient(150deg, rgba(255,255,255,0.5), transparent 35%), radial-gradient(80% 60% at 80% 90%, rgba(0,0,0,0.14), transparent 60%)',
            }}
          />
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#2a3300]/70">{eyebrow}</p>
              <p className="font-display text-6xl font-bold leading-none text-[#1a2000] sm:text-7xl">{face}</p>
              <p className="mt-3 text-[11px] font-medium tracking-wide text-[#2a3300]/60">Drag the corner</p>
            </div>
          </div>
          {/* A hairline shadow that pools along the fold, deepening the crease. */}
          <motion.div
            className="absolute inset-0"
            style={{
              clipPath: flapClip,
              background: 'linear-gradient(315deg, rgba(0,0,0,0.28), transparent 40%)',
            }}
          />
        </motion.div>

        {/* The folded flap: the corner's paper backface, lifted over the face. */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden rounded-[26px]"
          style={{ clipPath: flapClip, filter: flapShadow, opacity: flapOpacity }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(315deg, #f2f0e6 0%, #d8d5c6 55%, #b9b6a6 100%)',
            }}
          />
          {/* A bright curl of light catching the fold edge. */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(315deg, rgba(255,255,255,0.65), transparent 22%)' }}
          />
        </motion.div>

        {/* A small dog-ear cue in the corner, purely to say "grab here". */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 rounded-br-[10px] border-b-2 border-r-2 border-[#1a2000]/25"
        />
      </div>

      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/35">
        {reduce ? 'Press to reveal the note' : 'Drag the corner, or press Enter'}
      </p>
    </div>
  )
}
