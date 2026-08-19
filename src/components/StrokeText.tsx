import { useRef, type PointerEvent } from 'react'
import { motion, useSpring, useMotionValueEvent, useReducedMotion } from 'framer-motion'

// StrokeText — a headline drawn as thin outlined letters that stay hollow until
// a cursor-tracked spotlight paints them with a moving gradient. An SVG
// stroke-to-fill reveal, in the spirit of Aceternity's text-hover effect but
// rebuilt from the SVG up.
//
// The mechanic is two <text> elements stacked on the same baseline. The first
// is a faint outline (stroke only, no fill) that draws itself on once at mount
// by animating strokeDashoffset — the letters ink in. The second is filled with
// a lime→cyan→violet gradient (the site's own accent triad) but shown only
// through a radial mask whose centre is pinned to the pointer, so the word reads
// as thin wireframe until the cursor sweeps over it and lights the letters it
// passes. The reveal radius springs open on enter and closes on leave, and the
// fill gradient itself slides on a slow SMIL shimmer so the lit letters are
// never a flat colour.
//
// Distinct from the rest of the type family: GradientText clips a moving
// gradient to solid letters, VariableProximity leans variable-font weight toward
// the cursor, and SpotlightReveal lights hidden copy under a torch — this one
// keeps the letters as an outline you paint in with the pointer, an SVG
// stroke-to-fill nobody else here does.
//
// Honest to assistive tech: the <svg> carries role="img" and the real word as
// aria-label, and both <text> layers are decoration the reader never sees twice.
// Under prefers-reduced-motion the draw-on, the shimmer, and the cursor mask are
// all dropped — the gradient fill is shown in full so the word is simply, calmly
// there and fully legible, never gated behind motion.

let uid = 0

export function StrokeText({
  text,
  className = '',
  strokeWidth = 0.8,
  duration = 2.4,
}: {
  text: string
  /** Applied to the wrapping <svg>; set the font size and family here. */
  className?: string
  /** Outline weight in viewBox units. */
  strokeWidth?: number
  /** Seconds for the letters to draw themselves in on mount. */
  duration?: number
}) {
  const reduce = useReducedMotion()
  const idRef = useRef<number>()
  if (idRef.current === undefined) idRef.current = ++uid
  const fillId = `stroke-fill-${idRef.current}`
  const maskGradId = `stroke-mask-grad-${idRef.current}`
  const maskId = `stroke-mask-${idRef.current}`

  const svgRef = useRef<SVGSVGElement>(null)
  const gradRef = useRef<SVGRadialGradientElement>(null)

  // Mask centre (objectBoundingBox fractions) and reveal radius, springed so the
  // spotlight glides after the cursor and opens/closes softly. We write the
  // spring values straight onto the gradient element's attributes each frame —
  // reliable across every browser, where binding a motion value to an SVG
  // gradient prop is not.
  const cx = useSpring(0.5, { stiffness: 260, damping: 32, mass: 0.6 })
  const cy = useSpring(0.5, { stiffness: 260, damping: 32, mass: 0.6 })
  const r = useSpring(0, { stiffness: 170, damping: 26 })
  useMotionValueEvent(cx, 'change', (v) => gradRef.current?.setAttribute('cx', String(v)))
  useMotionValueEvent(cy, 'change', (v) => gradRef.current?.setAttribute('cy', String(v)))
  useMotionValueEvent(r, 'change', (v) => gradRef.current?.setAttribute('r', String(v)))

  function onMove(e: PointerEvent<SVGSVGElement>) {
    if (reduce || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    cx.set((e.clientX - rect.left) / rect.width)
    cy.set((e.clientY - rect.top) / rect.height)
  }
  function onEnter() {
    if (!reduce) r.set(0.32)
  }
  function onLeave() {
    if (!reduce) r.set(0)
  }

  // Both text layers share this placement — centred, on one baseline.
  const textProps = {
    x: '50%',
    y: '50%',
    textAnchor: 'middle' as const,
    dominantBaseline: 'middle' as const,
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 300 100"
      width="100%"
      height="100%"
      role="img"
      aria-label={text}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className={`select-none overflow-visible ${className}`}
    >
      <defs>
        {/* The fill: the site's accent triad, sliding sideways on a slow SMIL
            shimmer so lit letters are never a dead flat colour. */}
        <linearGradient id={fillId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="100">
          <stop offset="0%" stopColor="#DCF87C" />
          <stop offset="48%" stopColor="#7CE0F8" />
          <stop offset="100%" stopColor="#C79CFF" />
          {!reduce && (
            <animate
              attributeName="x1"
              values="-150;150;-150"
              dur="9s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>

        {/* The spotlight mask — white near the pointer, black elsewhere, so the
            filled layer shows only where the cursor is. Its centre and radius
            are springed motion values pinned to the pointer. */}
        <radialGradient
          ref={gradRef}
          id={maskGradId}
          gradientUnits="objectBoundingBox"
          cx="0.5"
          cy="0.5"
          r="0"
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${maskGradId})`} />
        </mask>
      </defs>

      {/* Faint outline — inks itself in once on mount, then holds. */}
      <motion.text
        {...textProps}
        fill="transparent"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={strokeWidth}
        strokeDasharray={reduce ? undefined : 1000}
        initial={reduce ? false : { strokeDashoffset: 1000 }}
        animate={reduce ? undefined : { strokeDashoffset: 0 }}
        transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
      >
        {text}
      </motion.text>

      {/* Gradient fill — full under reduced motion, otherwise only under the
          cursor spotlight. A thin gradient stroke keeps the lit edge crisp. */}
      <text
        {...textProps}
        fill={`url(#${fillId})`}
        stroke={`url(#${fillId})`}
        strokeWidth={strokeWidth * 0.5}
        mask={reduce ? undefined : `url(#${maskId})`}
      >
        {text}
      </text>
    </svg>
  )
}
