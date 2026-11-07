import { useEffect, useMemo, useRef, type ElementType, type PointerEvent } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// Letterpress — type that is pressed into the surface (deboss) or raised out of
// it (emboss), with the raking light that reveals the carving following the
// pointer.
//
// Thesis / what makes it not another text effect: every other piece in this
// family MOVES a string — SplitText lifts letters into place, ShinyText sweeps
// a highlight band, the decode resolves glyphs out of noise. Letterpress does
// not animate the letters at all. The glyphs sit almost exactly the colour of
// the surface, so there is nothing to read in the fill; the whole word is
// legible only from the light caught on one bevelled edge and the shadow thrown
// on the opposite one. It is a still effect about depth and light, the printer's
// craft rather than the animator's — and the one thing that moves is the light
// source. Point at the word and the highlight and shadow swing around the
// relief the way a real engraving catches a lamp carried past it, so the carving
// reads as genuinely three-dimensional rather than a flat drop shadow.
//
// Mechanics: two offset copies of the text (one lime highlight, one black
// shadow) sit on opposite sides of the glyphs — that pair of edges is the
// bevel. A unit light vector points from the word toward the pointer; the
// highlight copy is offset toward the light and the shadow copy away from it,
// so the lit and dark edges track the cursor. Emboss and deboss are the same
// bevel with the two copies swapped: a raised letter catches light on the side
// facing the lamp, an engraved one is dark on that side and bright on the far
// wall of the groove. Left alone, the light drifts in a slow circle so the
// relief is never dead before you touch it.
//
// Honest and cheap: the real text is a normal, selectable element a screen
// reader reads once; the bevel is pure CSS text-shadow driven by two springs,
// no canvas and nothing on a render path. Under prefers-reduced-motion the idle
// drift never starts and the pointer is never wired — the light rests fixed at
// the upper-left and the word holds one still, fully legible relief.

const LIGHT = 'rgba(220,248,124,0.85)' // the lime catching the lit bevel edge
const SHADOW = 'rgba(0,0,0,0.95)' // the dark cast on the shadowed bevel
const DEPTH = 2.2 // px the bevel copies are offset — the apparent relief depth
const IDLE_SPEED = 0.35 // rad/s the resting light drifts around the word

// The fill is painted OPAQUE and almost exactly the surface tone, which is what
// makes this read as letterpress rather than coloured type: text-shadow renders
// behind the glyph, so an opaque fill hides the overlapping bevel copies and
// leaves each one showing only as a thin crescent on its offset edge. A near-
// invisible fill would instead let the lime copy flood through the whole letter.
// Deboss sits a hair darker than the surface (recessed), emboss a hair lighter
// (proud); callers on a different surface pass `surface` to match it.
const FILL_DEBOSS = '#0b0b0c'
const FILL_EMBOSS = '#19191b'

export function Letterpress({
  text,
  as = 'span',
  mode = 'deboss',
  fill,
  className = '',
}: {
  text: string
  /** Element to render the word as. */
  as?: ElementType
  /** 'deboss' presses the type into the surface; 'emboss' raises it out. */
  mode?: 'deboss' | 'emboss'
  /** Opaque glyph fill — set to the host surface's own colour so the type reads
   * as carved into it. Defaults suit the site's near-black card surface. */
  fill?: string
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion() ?? false

  // Unit light direction (word → light), screen coords (x right, y down). The
  // default rests at the upper-left, the conventional engraver's light.
  const lx = useMotionValue(-0.7)
  const ly = useMotionValue(-0.7)
  const sx = useSpring(lx, { stiffness: 140, damping: 22, mass: 0.7 })
  const sy = useSpring(ly, { stiffness: 140, damping: 22, mass: 0.7 })

  // The two bevel copies: one offset toward the light, one directly away.
  const towX = useTransform(sx, (v) => `${(v * DEPTH).toFixed(2)}px`)
  const towY = useTransform(sy, (v) => `${(v * DEPTH).toFixed(2)}px`)
  const awX = useTransform(sx, (v) => `${(-v * DEPTH).toFixed(2)}px`)
  const awY = useTransform(sy, (v) => `${(-v * DEPTH).toFixed(2)}px`)

  // A raised letter is lit on the side facing the lamp (highlight toward the
  // light); an engraved one is dark there and bright on the far wall (swapped).
  const liteX = mode === 'emboss' ? towX : awX
  const liteY = mode === 'emboss' ? towY : awY
  const darkX = mode === 'emboss' ? awX : towX
  const darkY = mode === 'emboss' ? awY : towY

  // The lit edge is a tight lime rim; the shadow is a slightly larger, softer
  // cast that gives the groove or ridge its depth. Both offsets track the pointer.
  const textShadow = useMotionTemplate`${liteX} ${liteY} 0.3px ${LIGHT}, ${darkX} ${darkY} 2.6px ${SHADOW}`

  // Idle drift: while nothing is pointing at the word, carry the light slowly
  // around it so the relief keeps breathing. Paused on hover, off under reduced
  // motion. rAF writes straight to the two source values; the springs smooth it.
  const hovering = useRef(false)
  useEffect(() => {
    if (reduce) return
    let raf = 0
    let last = performance.now()
    let angle = Math.atan2(-0.7, -0.7)
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!hovering.current) {
        angle += IDLE_SPEED * dt
        lx.set(Math.cos(angle))
        ly.set(Math.sin(angle))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, lx, ly])

  function onMove(e: PointerEvent) {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy) || 1
    lx.set(dx / len)
    ly.set(dy / len)
  }
  function onEnter() {
    hovering.current = true
  }
  function onLeave() {
    hovering.current = false
  }

  const Tag = useMemo(() => motion((as ?? 'span') as ElementType), [as])
  return (
    <Tag
      ref={ref}
      onPointerMove={reduce ? undefined : onMove}
      onPointerEnter={reduce ? undefined : onEnter}
      onPointerLeave={reduce ? undefined : onLeave}
      // The fill sits just off the surface tone so the glyph nearly vanishes and
      // the bevel does the reading — the essence of the letterpress look.
      style={{ textShadow, color: fill ?? (mode === 'emboss' ? FILL_EMBOSS : FILL_DEBOSS) }}
      className={className}
    >
      {text}
    </Tag>
  )
}
