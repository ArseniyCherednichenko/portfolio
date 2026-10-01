import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A die you actually throw. Not a field, a card, or a text effect but a small
// *object with a tumble*: press it and the cube spins through two to four whole
// turns on both axes and settles onto a face, and the number it lands on is the
// honest roll — one Math.random() in [1,6], nothing weighted, nothing faked.
//
// Distinct from its neighbours in the toys family. The Turntable is a wheel you
// impart momentum to; the Harmonograph is a seeded plotter; the Abacus holds a
// number you set by hand. This is a throw with a settled result, built the way a
// real die reads: six faces in pure CSS 3D (no canvas, no WebGL), so it stays
// crisp at any size and DPR-independent.
//
// The trick that keeps the resting face correct: every canonical orientation
// leaves one axis at a multiple of 360 (a full turn is the identity, so the
// non-commuting order of rotateX/rotateY never bites), and the tumble only ever
// ADDS whole turns to both axes, so wherever it stops it still reads the face it
// claims. Rotation is accumulated forward in a ref and mirrored into state, so a
// fast double-press keeps spinning the same way instead of snapping backward.
//
// Honest to a11y: the die is a real button with an aria-label, and the rolled
// value is announced through an aria-live region. Under reduced motion the cube
// lands on its face instantly — no tumble — so it stays a usable, legible toy.

interface DiceProps {
  /** Side length of the cube in px. */
  size?: number
  className?: string
}

type Face = 1 | 2 | 3 | 4 | 5 | 6

// Canonical cube orientation (in degrees) that brings each face to the front.
// For every value one axis is a multiple of 360 (i.e. 0 here) so the rotateX /
// rotateY order never changes which face shows — see the note above.
const ORIENTATION: Record<Face, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
}

// Which of the nine cells in a 3x3 grid carry a pip, per face value.
const PIPS: Record<Face, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Smallest forward (non-negative) rotation that takes `cur` degrees to an angle
// congruent to `base` mod 360, so the die only ever tumbles one way.
function forwardDelta(cur: number, base: number) {
  const d = (((base - (cur % 360)) % 360) + 360) % 360
  return d
}

function FaceGrid({ value }: { value: Face }) {
  const on = PIPS[value]
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0 p-[14%]">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {on.includes(i) ? (
            <span
              className="block rounded-full bg-[#DCF87C]"
              style={{
                width: '58%',
                height: '58%',
                boxShadow: '0 0 6px rgba(220,248,124,0.55)',
              }}
            />
          ) : null}
        </span>
      ))}
    </div>
  )
}

export function Dice({ size = 128, className = '' }: DiceProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const [value, setValue] = useState<Face>(5)
  const [rolling, setRolling] = useState(false)
  // Accumulated, forward-only rotation. Seeded to the starting face so the first
  // roll animates from a true orientation rather than zero.
  const rot = useRef({ x: ORIENTATION[5].x, y: ORIENTATION[5].y })
  const [display, setDisplay] = useState({ x: ORIENTATION[5].x, y: ORIENTATION[5].y })

  const roll = useCallback(() => {
    if (rolling) return
    const next = ((Math.floor(Math.random() * 6) + 1) as Face)
    const base = ORIENTATION[next]
    if (reduce) {
      // No tumble: settle straight onto the face, still forward-only.
      rot.current = {
        x: rot.current.x + forwardDelta(rot.current.x, base.x),
        y: rot.current.y + forwardDelta(rot.current.y, base.y),
      }
      setDisplay({ ...rot.current })
      setValue(next)
      return
    }
    const spinsX = 2 + Math.floor(Math.random() * 3) // 2..4 whole turns
    const spinsY = 2 + Math.floor(Math.random() * 3)
    rot.current = {
      x: rot.current.x + forwardDelta(rot.current.x, base.x) + 360 * spinsX,
      y: rot.current.y + forwardDelta(rot.current.y, base.y) + 360 * spinsY,
    }
    setRolling(true)
    setDisplay({ ...rot.current })
    // The face value is the destination; reveal it when the tumble lands.
    window.setTimeout(() => {
      setValue(next)
      setRolling(false)
    }, 900)
  }, [reduce, rolling])

  const S = size
  const half = S / 2

  // The six faces, each pushed out by half the side and turned to face outward.
  const faces: { face: Face; transform: string }[] = [
    { face: 1, transform: `translateZ(${half}px)` },
    { face: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { face: 2, transform: `rotateY(90deg) translateZ(${half}px)` },
    { face: 5, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { face: 3, transform: `rotateX(90deg) translateZ(${half}px)` },
    { face: 4, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ]

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        style={{ perspective: `${S * 6}px`, width: S, height: S }}
        className="flex items-center justify-center"
      >
        <button
          type="button"
          onClick={roll}
          aria-describedby={`${id}-live`}
          aria-label={`Die showing ${value}. Press to roll.`}
          className="group relative rounded-[18%] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
          style={{ width: S, height: S, transformStyle: 'preserve-3d' }}
        >
          <motion.div
            aria-hidden
            className="relative"
            style={{ width: S, height: S, transformStyle: 'preserve-3d' }}
            animate={{ rotateX: display.x, rotateY: display.y }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: 'spring', stiffness: 70, damping: 13, mass: 1.1 }
            }
          >
            {faces.map(({ face, transform }) => (
              <span
                key={face}
                className="absolute inset-0 rounded-[14%] border border-white/12 bg-gradient-to-br from-[#1a1c18] to-[#0c0d0b]"
                style={{
                  transform,
                  backfaceVisibility: 'hidden',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06)',
                }}
              >
                <FaceGrid value={face} />
              </span>
            ))}
          </motion.div>
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          You rolled
        </span>
        <span
          id={`${id}-live`}
          aria-live="polite"
          className="font-display text-5xl font-semibold tabular-nums text-[#DCF87C]"
        >
          {rolling ? '—' : value}
        </span>
        <button
          type="button"
          onClick={roll}
          disabled={rolling}
          className="mt-4 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white disabled:opacity-40"
        >
          {rolling ? 'Rolling…' : 'Roll'}
        </button>
      </div>
    </div>
  )
}
