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

const LIGHT = 'rgba(220,248,124,0.55)' // the lime catching the lit bevel
const SHADOW = 'rgba(0,0,0,0.78)' // the shadow thrown on the dark bevel
const DEPTH = 2.6 // px the bevel copies are offset — the apparent relief depth
const IDLE_SPEED = 0.35 // rad/s the resting light drifts around the word

export function Letterpress({
  text,
  as = 'span',
  mode = 'deboss',
  className = '',
}: {
  text: string
  /** Element to render the word as. */
  as?: ElementType
  /** 'deboss' presses the type into the surface; 'emboss' raises it out. */
  mode?: 'deboss' | 'emboss'
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

  const textShadow = useMotionTemplate`${liteX} ${liteY} 0.6px ${LIGHT}, ${darkX} ${darkY} 0.6px ${SHADOW}`

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
      style={{ textShadow, color: mode === 'emboss' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)' }}
      className={className}
    >
      {text}
    </Tag>
  )
}
