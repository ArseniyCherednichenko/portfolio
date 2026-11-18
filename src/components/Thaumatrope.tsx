import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A thaumatrope you actually twirl. The oldest moving-picture toy there is: a
// disc with a different drawing on each face — here a bird on one side, an empty
// cage on the other — strung so it spins about its horizontal diameter. Spin it
// slowly and you watch the two pictures take turns. Spin it fast enough and your
// eye can no longer keep them apart: persistence of vision holds the bird on the
// retina just long enough for the cage to arrive on top of it, and the bird
// lands *inside* the cage. One image that only exists while the disc is moving.
//
// Deliberately the inverse of its neighbour the Zoetrope. The zoetrope SAMPLES
// one motion across many frames so a sequence reads as movement; the thaumatrope
// FUSES two frames into one still that neither face holds alone. Same ancestor —
// the eye's refusal to let an image go — read from the opposite end.
//
// Built the way the real toy reads: two faces in pure CSS 3D (no canvas), a
// forward-only rotateX about the horizontal axis — the bird resting at a
// multiple of 360, the cage 180 past it — accumulated in a ref so a quick
// re-twirl keeps spinning the same way instead of snapping back. A twirl ramps
// the disc up and lets it decay to rest the way a wound string unwinds, and a
// fusion layer surfaces only while the disc is spinning fastest, fading out as
// it settles onto a single face — the illusion made legible on a screen that
// can't actually strobe fast enough to earn it honestly.
//
// Honest to a11y: the disc is a real button with an aria-label and the resting
// face is announced through an aria-live region. Under reduced motion nothing
// spins — the fused bird-in-cage is shown outright, with a Flip control to read
// either single face on its own, so it stays a usable, legible toy.

interface ThaumatropeProps {
  /** Diameter of the disc in px. */
  size?: number
  className?: string
}

type Face = 'bird' | 'cage'

// Smallest forward (non-negative) rotation that takes `cur` degrees to an angle
// congruent to `base` mod 360, so the disc only ever spins one way.
function forwardDelta(cur: number, base: number) {
  return ((((base - (cur % 360)) % 360) + 360) % 360)
}

const LIME = '#DCF87C'

// The bird: a minimal perched songbird silhouette on a short perch, drawn once
// so the same path serves the spinning face and the fused overlay.
function Bird({ faded = false }: { faded?: boolean }) {
  const fill = faded ? 'rgba(220,248,124,0.9)' : LIME
  return (
    <g>
      {/* perch */}
      <line x1="30" y1="76" x2="70" y2="76" stroke={fill} strokeWidth="2.4" strokeLinecap="round" />
      {/* legs */}
      <line x1="47" y1="64" x2="45" y2="76" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="53" y1="64" x2="55" y2="76" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      {/* body + tail as one silhouette */}
      <path
        d="M50 34
           c10 0 17 7 17 17
           c0 8 -4 13 -10 15
           l16 7 -16 0
           c-9 1 -24 -3 -24 -20
           c0 -10 7 -16 17 -16 Z"
        fill={fill}
      />
      {/* wing detail, cut in the page's dark */}
      <path
        d="M50 44 c7 0 12 5 12 12 c0 4 -2 7 -5 8 c-7 2 -16 -1 -16 -10 c0 -6 4 -10 9 -10 Z"
        fill="#0a0b07"
        opacity="0.55"
      />
      {/* head */}
      <circle cx="41" cy="40" r="8.5" fill={fill} />
      {/* beak */}
      <path d="M33 39 l-8 2 8 3 Z" fill={fill} />
      {/* eye */}
      <circle cx="40" cy="39" r="1.7" fill="#0a0b07" />
    </g>
  )
}

// The cage: a domed birdcage of vertical bars with a hanging ring. Mirrored at
// the group level by the caller so it reads upright after the disc's half-turn.
function Cage({ faded = false }: { faded?: boolean }) {
  const stroke = faded ? 'rgba(220,248,124,0.9)' : LIME
  // Bars with the outer pair dropping a little to meet the dome, so the cage
  // reads rounded rather than a flat fence.
  const bars: { x: number; top: number }[] = [
    { x: 34, top: 44 },
    { x: 42, top: 41 },
    { x: 50, top: 40 },
    { x: 58, top: 41 },
    { x: 66, top: 44 },
  ]
  return (
    <g fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round">
      {/* hanging ring + hook */}
      <circle cx="50" cy="13" r="4" />
      <line x1="50" y1="17" x2="50" y2="22" />
      {/* domed top */}
      <path d="M28 40 C28 24 72 24 72 40" />
      {/* floor + base plate */}
      <line x1="26" y1="76" x2="74" y2="76" />
      <path d="M34 76 C34 83 66 83 66 83" />
      {/* vertical bars */}
      {bars.map((b) => (
        <line key={b.x} x1={b.x} y1={b.top} x2={b.x} y2="76" />
      ))}
      {/* two hoop rails to read as a cage, not a fence */}
      <line x1="28" y1="40" x2="72" y2="40" />
      <line x1="30" y1="58" x2="70" y2="58" />
    </g>
  )
}

// One disc face: the struck-metal disc body shared with the toy family, carrying
// a single drawing. The cage face is pre-rotated 180° about X so it reads upright
// once the disc has turned to show it.
function DiscFace({ face, size }: { face: Face; size: number }) {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full"
      style={{
        backfaceVisibility: 'hidden',
        transform: face === 'cage' ? 'rotateX(180deg)' : undefined,
        background: 'radial-gradient(120% 120% at 32% 24%, #24271f 0%, #15170f 48%, #0a0b07 100%)',
        border: '1px solid rgba(220,248,124,0.22)',
        boxShadow:
          'inset 0 2px 6px rgba(255,255,255,0.08), inset 0 -6px 14px rgba(0,0,0,0.65), 0 10px 24px rgba(0,0,0,0.5)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{ inset: size * 0.07, border: '1px dashed rgba(220,248,124,0.18)' }}
      />
      <svg viewBox="0 0 100 100" width={size * 0.82} height={size * 0.82} aria-hidden>
        {face === 'bird' ? <Bird /> : <Cage />}
      </svg>
    </span>
  )
}

export function Thaumatrope({ size = 160, className = '' }: ThaumatropeProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const [face, setFace] = useState<Face>('bird')
  const [spinning, setSpinning] = useState(false)
  const [run, setRun] = useState(0)
  const [twirls, setTwirls] = useState(0)
  // Accumulated, forward-only rotation about X (degrees). Seeded to the bird (0).
  const rot = useRef(0)
  const [display, setDisplay] = useState(0)

  const twirl = useCallback(() => {
    if (reduce) {
      // No spin: just flip to the other single face so both are still readable.
      setFace((f) => (f === 'bird' ? 'cage' : 'bird'))
      return
    }
    if (spinning) return
    const next: Face = Math.random() < 0.5 ? 'bird' : 'cage'
    const base = next === 'bird' ? 0 : 180
    const turns = 5 + Math.floor(Math.random() * 3) // 5..7 whole turns
    rot.current += forwardDelta(rot.current, base) + 360 * turns
    setSpinning(true)
    setDisplay(rot.current)
    setRun((n) => n + 1)
    setTwirls((n) => n + 1)
    window.setTimeout(() => {
      setFace(next)
      setSpinning(false)
    }, 3200)
  }, [reduce, spinning])

  const restLabel = face === 'bird' ? 'the bird' : 'the empty cage'

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        style={{ perspective: `${size * 7}px`, width: size, height: size }}
        className="relative flex items-center justify-center"
      >
        {/* The two strings the disc is slung on, left and right. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 -left-[22%] h-px w-[22%] -translate-y-1/2"
          style={{ background: 'linear-gradient(to right, transparent, rgba(220,248,124,0.35))' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 -right-[22%] h-px w-[22%] -translate-y-1/2"
          style={{ background: 'linear-gradient(to left, transparent, rgba(220,248,124,0.35))' }}
        />

        <button
          type="button"
          onClick={twirl}
          aria-describedby={`${id}-live`}
          aria-label={
            reduce
              ? `Thaumatrope showing ${restLabel}. Press to flip to the other face.`
              : `Thaumatrope resting on ${restLabel}. Press to twirl and fuse the two faces.`
          }
          className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
          style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
        >
          {reduce ? (
            // Reduced motion: no spin. Show the single current face, crisp.
            <span className="relative block" style={{ width: size, height: size }}>
              <DiscFace face={face} size={size} />
            </span>
          ) : (
            <motion.div
              aria-hidden
              className="relative"
              style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
              animate={{ rotateX: display }}
              transition={{ duration: 3.2, ease: [0.16, 0.7, 0.28, 1] }}
            >
              <DiscFace face="bird" size={size} />
              <DiscFace face="cage" size={size} />
            </motion.div>
          )}

          {/* The fusion layer: the still that only the spin produces. Under
              reduced motion it is shown outright (the honest result); otherwise
              it surfaces only while the disc is fastest and fades as it settles. */}
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <motion.svg
              viewBox="0 0 100 100"
              width={size * 0.82}
              height={size * 0.82}
              initial={false}
              animate={reduce ? { opacity: 0.92 } : run === 0 ? { opacity: 0 } : { opacity: [0, 0.9, 0.9, 0] }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 3.2, ease: 'linear', times: [0, 0.14, 0.5, 1] }
              }
            >
              <Bird faded />
              <Cage faded />
            </motion.svg>
          </span>
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          {reduce ? 'Both faces, fused' : spinning ? 'Spinning' : 'At rest'}
        </span>
        <span
          id={`${id}-live`}
          aria-live="polite"
          className="font-display text-3xl font-semibold text-[#DCF87C]"
        >
          {reduce ? 'Bird in the cage' : spinning ? 'Bird in the cage' : face === 'bird' ? 'A bird' : 'An empty cage'}
        </span>

        <p className="mt-4 max-w-xs text-center text-[11px] leading-relaxed text-white/40">
          {reduce
            ? 'One drawing on each face. Spinning fuses them — shown here outright. Flip to read either face alone.'
            : twirls === 0
              ? 'A bird on one face, an empty cage on the other. Twirl it fast and your eye can no longer keep them apart.'
              : 'While it spins fastest the two faces fuse — the bird is in the cage. It settles back onto one.'}
        </p>

        <button
          type="button"
          onClick={twirl}
          disabled={spinning}
          className="mt-5 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white disabled:opacity-40"
        >
          {reduce ? 'Flip' : spinning ? 'Spinning…' : 'Twirl'}
        </button>
      </div>
    </div>
  )
}
