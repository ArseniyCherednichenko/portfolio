import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useMemo, useRef, useState } from 'react'

// A coin you actually toss. Not a field, a card, or a text effect but a small
// *object with a flip*: press it and it springs up, tumbles end over end through
// several whole half-turns, and settles face-up on heads or tails — and the side
// it lands on is the honest call, one Math.random() split at 0.5, nothing
// weighted, nothing faked.
//
// Distinct from its neighbours in the toys family. The Dice is a 1-of-6 tumble
// that settles on a face; the Magic 8-ball answers in words; the Turntable is a
// wheel you impart momentum to; the FidgetSpinner is an rpm decaying in real
// time. This is the one toy there that resolves a true *binary* — and it keeps a
// running tally so the split you watch drifts toward 50/50 the more you flip, a
// law-of-large-numbers readout you can feel rather than be told.
//
// Built the way a real coin reads: two faces in pure CSS 3D (no canvas, no
// WebGL), so it stays crisp at any size and DPR-independent. The flip is a
// forward-only rotateX about a horizontal axis — heads rests at a multiple of
// 360, tails at 180 past it — accumulated in a ref and mirrored into state, so a
// fast double-press keeps tumbling the same way instead of snapping backward.
// A keyframed toss arc lifts it off the table and sets it back down as it spins.
//
// Honest to a11y: the coin is a real button with an aria-label, and the landed
// side is announced through an aria-live region. Under reduced motion it settles
// face-up instantly — no toss, no tumble — so it stays a usable, legible toy.

interface CoinFlipProps {
  /** Diameter of the coin in px. */
  size?: number
  className?: string
}

type Side = 'heads' | 'tails'

// Smallest forward (non-negative) rotation that takes `cur` degrees to an angle
// congruent to `base` mod 360, so the coin only ever tumbles one way.
function forwardDelta(cur: number, base: number) {
  return ((((base - (cur % 360)) % 360) + 360) % 360)
}

// One coin face: dark struck metal, a raised rim, and a serif monogram. Heads
// carries an A (Arseniy), tails a B (Berlin) — a quiet personal mark rather than
// a generic crest. The small caption names the side so the face reads at a
// glance even before the tally does.
function CoinFace({ side, size }: { side: Side; size: number }) {
  const mark = side === 'heads' ? 'A' : 'B'
  return (
    <span
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-full"
      style={{
        backfaceVisibility: 'hidden',
        transform: side === 'tails' ? 'rotateX(180deg)' : undefined,
        background:
          'radial-gradient(120% 120% at 32% 24%, #24271f 0%, #15170f 48%, #0a0b07 100%)',
        border: '1px solid rgba(220,248,124,0.22)',
        boxShadow:
          'inset 0 2px 6px rgba(255,255,255,0.08), inset 0 -6px 14px rgba(0,0,0,0.65), 0 10px 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Milled rim: a thin inset ring just in from the edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: size * 0.08,
          border: '1px dashed rgba(220,248,124,0.18)',
        }}
      />
      <span
        className="font-display font-semibold leading-none text-[#DCF87C]"
        style={{ fontSize: size * 0.4, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        {mark}
      </span>
      <span
        className="mt-[6%] font-semibold uppercase tracking-[0.3em] text-white/35"
        style={{ fontSize: Math.max(8, size * 0.07) }}
      >
        {side}
      </span>
    </span>
  )
}

export function CoinFlip({ size = 136, className = '' }: CoinFlipProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const [side, setSide] = useState<Side>('heads')
  const [flipping, setFlipping] = useState(false)
  const [tally, setTally] = useState({ heads: 0, tails: 0 })
  // Accumulated, forward-only rotation about X (degrees). Seeded to heads (0).
  const rot = useRef(0)
  const [display, setDisplay] = useState(0)

  const flip = useCallback(() => {
    if (flipping) return
    const next: Side = Math.random() < 0.5 ? 'heads' : 'tails'
    const base = next === 'heads' ? 0 : 180
    if (reduce) {
      // No toss: settle straight onto the face, still forward-only.
      rot.current += forwardDelta(rot.current, base)
      setDisplay(rot.current)
      setSide(next)
      setTally((t) => ({ ...t, [next]: t[next] + 1 }))
      return
    }
    const spins = 3 + Math.floor(Math.random() * 3) // 3..5 whole end-over-end turns
    rot.current += forwardDelta(rot.current, base) + 360 * spins
    setFlipping(true)
    setDisplay(rot.current)
    // The side is the destination; reveal and count it when the coin lands.
    window.setTimeout(() => {
      setSide(next)
      setTally((t) => ({ ...t, [next]: t[next] + 1 }))
      setFlipping(false)
    }, 1000)
  }, [reduce, flipping])

  const total = tally.heads + tally.tails
  // Heads share of the tally; sits at an even 50 before the first flip so the
  // bar reads neutral rather than empty.
  const headsPct = total === 0 ? 50 : (tally.heads / total) * 100

  const toss = useMemo(() => {
    // Keyframed vertical arc: up and back down over the flight, timed to land
    // with the spin. Reduced motion holds it on the table.
    if (reduce) return { y: 0 }
    const lift = -(size * 0.7)
    return { y: [0, lift, lift * 0.25, 0] }
  }, [reduce, size])

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        style={{ perspective: `${size * 7}px`, width: size, height: size }}
        className="flex items-center justify-center"
      >
        <motion.div
          style={{ width: size, height: size }}
          animate={toss}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 1, ease: [0.33, 0, 0.3, 1], times: [0, 0.4, 0.7, 1] }
          }
        >
          <button
            type="button"
            onClick={flip}
            aria-describedby={`${id}-live`}
            aria-label={`Coin showing ${side}. Press to flip.`}
            className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
            style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
          >
            <motion.div
              aria-hidden
              className="relative"
              style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
              animate={{ rotateX: display }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 1, ease: [0.22, 0.65, 0.3, 1] }
              }
            >
              <CoinFace side="heads" size={size} />
              <CoinFace side="tails" size={size} />
            </motion.div>
          </button>
        </motion.div>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          It landed
        </span>
        <span
          id={`${id}-live`}
          aria-live="polite"
          className="font-display text-4xl font-semibold capitalize text-[#DCF87C]"
        >
          {flipping ? '—' : side}
        </span>

        {/* Running tally. The split bar drifts toward the midline the more you
            flip — the honest convergence, shown rather than claimed. */}
        <div className="mt-5 w-56 max-w-full">
          <div className="flex items-baseline justify-between text-xs font-semibold tabular-nums">
            <span className="text-[#DCF87C]">Heads {tally.heads}</span>
            <span className="text-white/35">{total} flips</span>
            <span className="text-white/70">Tails {tally.tails}</span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="presentation"
          >
            <motion.div
              className="h-full rounded-full bg-[#DCF87C]"
              animate={{ width: `${headsPct}%` }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
              style={{ opacity: total === 0 ? 0.3 : 1 }}
            />
          </div>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-white/35">
            {total === 0
              ? 'An even 50/50 draw. Flip a few and watch the split settle.'
              : `Heads ${headsPct.toFixed(0)}% — the more you flip, the closer it drifts to 50/50.`}
          </p>
        </div>

        <button
          type="button"
          onClick={flip}
          disabled={flipping}
          className="mt-4 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white disabled:opacity-40"
        >
          {flipping ? 'Flipping…' : 'Flip'}
        </button>
      </div>
    </div>
  )
}
