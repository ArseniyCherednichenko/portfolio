import { useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Magnetic poetry — the fridge-magnet word kit, rebuilt as a draggable board.
// A loose scatter of little ivory tiles, each a word, that you pick up and slide
// anywhere on the door to compose a line. It is the one piece in the Type & text
// family you *rearrange* rather than read: `SplitText` lifts letters into place,
// `Braille` raises pins, `LabelMaker` punches a strip — this hands you the
// letters and gets out of the way.
//
// Each tile is its own draggable: the outer motion.div carries the drag (so
// Framer owns its x/y transform) while an inner span carries the fixed random
// tilt, keeping the two transforms from fighting. Picking a tile up raises it
// above the pile and lifts it a touch; letting go leaves it exactly where it
// lands. "Scatter" remounts the board at a fresh seeded layout, which also
// resets every drag back to the pile.
//
// The words are honest — Berlin, built by hand, late, slow, the small vocabulary
// this site keeps returning to — nothing claimed, just a kit to play with.
//
// Reduced motion: no entrance stagger, no hover or pick-up scale; the tiles are
// simply shown and still fully draggable, since a drag is the visitor's own doing.

/** The default kit. Lowercase, magnet-style, with a few function words so real
 * lines fall out of it ("made by hand", "slow and curious", "built in berlin"). */
export const POETRY_WORDS: readonly string[] = [
  'design', 'build', 'ship', 'in', 'berlin', 'made', 'by', 'hand',
  'late', 'at', 'night', 'with', 'care', 'pixels', 'and', 'motion',
  'a', 'quiet', 'the', 'craft', 'slow', 'idea', 'fast', 'student',
  'coffee', 'calm', 'loud', 'type', 'grid', 'curious', 'again', 'make',
]

// A tiny deterministic PRNG (mulberry32) so a given seed lays the board out the
// same way every render — no Math.random on the render path, which keeps the
// scatter stable until the visitor asks for a new one.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Placed {
  word: string
  /** Position of the tile's top-left corner, in % of the board. */
  left: number
  top: number
  /** Fixed tilt, degrees. */
  rot: number
}

// Lay the kit out in a jittered grid so the tiles spread across the whole door
// without clumping in one corner. Corners are clamped inside a margin so no tile
// starts clipped by the board's edge.
function layout(words: readonly string[], seed: number): Placed[] {
  const rand = rng(seed)
  const n = words.length
  const cols = Math.max(4, Math.round(Math.sqrt(n * 1.7)))
  const rows = Math.ceil(n / cols)
  const cellW = (100 - 12) / cols
  const cellH = (100 - 16) / rows
  return words.map((word, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const jx = (rand() - 0.5) * cellW * 0.7
    const jy = (rand() - 0.5) * cellH * 0.6
    const left = Math.min(92, Math.max(6, 6 + col * cellW + cellW * 0.15 + jx))
    const top = Math.min(90, Math.max(8, 8 + row * cellH + cellH * 0.1 + jy))
    const rot = (rand() - 0.5) * 7
    return { word, left, top, rot }
  })
}

export function MagneticPoetry({
  words = POETRY_WORDS,
  className = '',
}: {
  words?: readonly string[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const boardRef = useRef<HTMLDivElement>(null)
  // Bumped by "Scatter" — the seed for the layout and the remount key for the
  // whole tile set, so a scatter both re-lays and resets every in-flight drag.
  const [nonce, setNonce] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  const placed = useMemo(() => layout(words, nonce * 2654435761 + 7), [words, nonce])

  return (
    <div className={`flex w-full flex-col items-center gap-5 ${className}`}>
      {/* The fridge door: a brushed panel with a soft vertical sheen and an
          inset lip, so the tiles read as sitting on a surface. */}
      <div
        ref={boardRef}
        role="group"
        aria-label="Magnetic poetry board. Drag the word tiles to compose a line."
        className="relative h-[340px] w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-30px_60px_rgba(0,0,0,0.25)] sm:h-[400px]"
      >
        {/* Faint brushed-metal striping, purely decorative. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
          }}
        />
        {placed.map((p, i) => (
          <motion.div
            key={`${nonce}-${p.word}-${i}`}
            drag
            dragConstraints={boardRef}
            dragMomentum={false}
            dragElastic={0.12}
            onDragStart={() => setActive(i)}
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileDrag={reduce ? undefined : { scale: 1.08 }}
            initial={reduce ? false : { opacity: 0, scale: 0.8 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={
              reduce
                ? undefined
                : { delay: Math.min(i * 0.015, 0.4), type: 'spring', stiffness: 420, damping: 30 }
            }
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              top: `${p.top}%`,
              zIndex: active === i ? 60 : 1,
              cursor: 'grab',
              touchAction: 'none',
            }}
            className="select-none"
          >
            {/* Inner span owns the fixed tilt + the tile look, so the drag
                transform on the parent never cancels the rotation. */}
            <span
              className="block rounded-[5px] border border-black/10 bg-[#f4efe4] px-2.5 py-1 font-mono text-[13px] font-medium leading-none tracking-tight text-neutral-900 shadow-[0_2px_6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.7)] sm:text-sm"
              style={{ transform: `rotate(${p.rot}deg)` }}
            >
              {p.word}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="flex w-full items-center justify-between gap-4">
        <p className="text-xs leading-relaxed text-white/40">
          Pick up a tile and slide it anywhere. Build a line, leave it where it lands.
        </p>
        <button
          type="button"
          onClick={() => {
            setActive(null)
            setNonce((k) => k + 1)
          }}
          className="shrink-0 rounded-full border border-[#DCF87C]/30 bg-[#DCF87C]/10 px-3.5 py-1.5 text-xs font-medium text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/20"
        >
          Scatter
        </button>
      </div>
    </div>
  )
}
