import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

// SplitFlap — an authentic split-flap (airport / train departure board) display.
// Each character lives in its own cell; when the target glyph changes, the top
// leaf folds down to hide the old glyph and a fresh bottom leaf drops into place,
// exactly like a mechanical flap board. This is a *kind* of motion the site did
// not have — a hinged, two-phase mechanical flip, distinct from every spring,
// scroll, or canvas field elsewhere. Honest and reusable: it just renders the
// string it is handed (a live clock, a cycling word). Reduced-motion users get
// the glyphs set instantly, with no hinge and no leaves.

const FLIP = 0.42 // seconds for a full two-phase flip
const EASE = [0.35, 0, 0.2, 1] as const

// Characters rendered as thin separators rather than flap cells — they never
// carry a hinge, so a clock's colons don't "flip" every tick.
const SEPARATORS = new Set([':', '.', ' ', '/', '-'])

type Half = 'top' | 'bottom'

interface FaceProps {
  char: string
  half: Half
  h: number
  w: number
  font: number
  radius: number
}

// One clipped half (top or bottom) of a glyph, sized so the character sits
// centred in a full cell and we only reveal the requested half.
function Face({ char, half, h, w, font, radius }: FaceProps) {
  const half_h = h / 2
  const top = half === 'top'
  return (
    <div
      className="absolute inset-x-0 overflow-hidden bg-gradient-to-b from-[#1c1c1c] to-[#141414]"
      style={{
        height: half_h,
        top: top ? 0 : half_h,
        borderTopLeftRadius: top ? radius : 0,
        borderTopRightRadius: top ? radius : 0,
        borderBottomLeftRadius: top ? 0 : radius,
        borderBottomRightRadius: top ? 0 : radius,
      }}
    >
      <div
        className="flex items-center justify-center font-mono font-semibold tabular-nums text-white"
        style={{
          height: h,
          width: w,
          fontSize: font,
          lineHeight: `${h}px`,
          transform: top ? 'none' : `translateY(-${half_h}px)`,
        }}
      >
        {char}
      </div>
    </div>
  )
}

interface CellProps {
  char: string
  h: number
  w: number
  radius: number
}

function Cell({ char, h, w, radius }: CellProps) {
  const reduce = useReducedMotion()
  // `display` is the glyph at rest (drawn by the static top + resting bottom
  // leaf). `prev` is what the falling top leaf still shows mid-flip; once it
  // settles, `prev` catches up to `display` and the leaves unmount.
  const [display, setDisplay] = useState(char)
  const [prev, setPrev] = useState(char)

  useEffect(() => {
    if (char === display) return
    if (reduce) {
      setDisplay(char)
      setPrev(char)
      return
    }
    setPrev(display)
    setDisplay(char)
  }, [char, display, reduce])

  const font = Math.round(h * 0.62)
  const flipping = prev !== display
  const half_h = h / 2

  return (
    <div
      className="relative shrink-0 ring-1 ring-inset ring-white/[0.06]"
      style={{ height: h, width: w, borderRadius: radius, perspective: 220 }}
    >
      {/* Static top: the new glyph's top, revealed as the old top leaf falls. */}
      <Face char={display} half="top" h={h} w={w} font={font} radius={radius} />
      {/* Static bottom: the old glyph's bottom, shown until the new leaf lands.
          At rest prev === display, so this is simply the resting bottom. */}
      <Face char={prev} half="bottom" h={h} w={w} font={font} radius={radius} />

      {/* Hinge line down the middle of the cell. */}
      <div
        className="absolute inset-x-0 z-20 bg-black/60"
        style={{ top: half_h - 0.5, height: 1 }}
      />

      <AnimatePresence>
        {flipping && (
          <>
            {/* Top leaf: shows the OLD top, folds down and away (0 -> -90). */}
            <motion.div
              key={`t-${prev}-${display}`}
              className="absolute inset-x-0 top-0 z-10 origin-bottom"
              style={{ height: half_h, transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: -90 }}
              transition={{ duration: FLIP / 2, ease: EASE }}
            >
              <Face char={prev} half="top" h={h} w={w} font={font} radius={radius} />
            </motion.div>
            {/* Bottom leaf: shows the NEW bottom, drops into place (90 -> 0),
                and on arrival settles the resting state. */}
            <motion.div
              key={`b-${prev}-${display}`}
              className="absolute inset-x-0 z-10 origin-top"
              style={{ top: half_h, height: half_h, transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              initial={{ rotateX: 90 }}
              animate={{ rotateX: 0 }}
              transition={{ duration: FLIP / 2, ease: EASE, delay: FLIP / 2 }}
              onAnimationComplete={() => setPrev(display)}
            >
              <Face char={display} half="bottom" h={h} w={w} font={font} radius={radius} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export interface SplitFlapProps {
  /** The string to display; changing a character flips just that cell. */
  value: string
  /** Cell height in px (glyph size scales from this). */
  height?: number
  /** Cell width in px. */
  width?: number
  /** Cell corner radius in px. */
  radius?: number
  /** Gap between cells in px. */
  gap?: number
  className?: string
  'aria-label'?: string
}

export function SplitFlap({
  value,
  height = 56,
  width = 40,
  radius = 6,
  gap = 4,
  className = '',
  'aria-label': ariaLabel,
}: SplitFlapProps) {
  const chars = value.split('')
  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={{ gap }}
      role="img"
      aria-label={ariaLabel ?? value}
    >
      {chars.map((c, i) =>
        SEPARATORS.has(c) ? (
          <span
            key={`sep-${i}`}
            aria-hidden
            className="flex shrink-0 items-center justify-center font-mono font-semibold text-white/50"
            style={{ height, fontSize: Math.round(height * 0.5), width: c === ' ' ? width * 0.4 : width * 0.35 }}
          >
            {c === ' ' ? '' : c}
          </span>
        ) : (
          <Cell key={`c-${i}`} char={c} h={height} w={width} radius={radius} />
        ),
      )}
    </div>
  )
}
