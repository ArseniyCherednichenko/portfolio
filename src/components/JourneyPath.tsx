import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  type Variants,
} from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const EASE = [0.16, 1, 0.3, 1] as const

export interface JourneyStep {
  /** Short marker label, e.g. "Start" or "Berlin". */
  tag: string
  /** The headline of this waypoint. */
  title: string
  /** The honest body copy. ReactNode so it can carry inline links. */
  body: ReactNode
  /** Optional internal route this waypoint leads into. */
  to?: string
  /** Label for that link, e.g. "See the city". */
  toLabel?: string
}

// A single node on the spine. It lights to lime as it crosses the middle of the
// viewport (not merely on entry), so the row the reader is actually looking at
// is the one that glows — the dots read as the path being walked, not a list
// that flips on all at once. Reduced motion renders every node already lit and
// still, so the shape is complete and nothing moves.
const dotVariants: Variants = {
  rest: {
    backgroundColor: 'rgba(10,10,10,1)',
    borderColor: 'rgba(255,255,255,0.18)',
    boxShadow: '0 0 0 0 rgba(220,248,124,0)',
    scale: 0.82,
  },
  lit: {
    backgroundColor: '#DCF87C',
    borderColor: '#DCF87C',
    boxShadow: '0 0 22px 2px rgba(220,248,124,0.35)',
    scale: 1,
  },
}

function Node({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="relative z-10 mt-1 flex h-4 w-4 items-center justify-center rounded-full border"
      variants={dotVariants}
      initial={reduce ? 'lit' : 'rest'}
      whileInView={reduce ? undefined : 'lit'}
      viewport={{ once: false, margin: '-48% 0px -48% 0px' }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 0 1px rgba(220,248,124,0.5)' }}
          initial={{ opacity: 0, scale: 1 }}
          whileInView={{ opacity: [0.6, 0], scale: [1, 2.4] }}
          viewport={{ once: true, margin: '-48% 0px -48% 0px' }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      )}
    </motion.span>
  )
}

// A scroll-drawn vertical path of honest waypoints. The spine is a faint rail
// with a lime fill that grows as the section scrolls past, so the line appears
// to draw itself under the reader; each waypoint sits on a node that lights as
// it reaches the middle of the view. It is a reusable timeline primitive, not a
// one-off: give it any list of steps. Fully reduced-motion aware — the fill is
// held complete, every node is lit, and nothing animates.
export function JourneyPath({
  steps,
  className = '',
}: {
  steps: JourneyStep[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  // Measure this section against the viewport: the fill starts drawing as the
  // top passes 70% down the screen and completes as the bottom passes 40%, so
  // the line keeps pace with reading rather than the page edges.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.7', 'end 0.4'],
  })
  const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.4 })

  return (
    <div ref={ref} className={`relative mx-auto max-w-2xl ${className}`}>
      {/* Faint full-height rail — the road not yet walked. The left offset is the
          centre of each step's 2rem node column (≈15px). */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-3 left-[15px] top-3 w-px bg-white/10"
      />
      {/* Lime fill that draws with scroll. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-3 left-[15px] top-3 w-px origin-top bg-gradient-to-b from-[#DCF87C] via-[#DCF87C] to-[#DCF87C]/60"
        style={reduce ? { scaleY: 1 } : { scaleY: fill }}
      />

      <ol className="relative space-y-12 sm:space-y-16">
        {steps.map((step) => (
          <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-x-4 sm:gap-x-6">
            <div className="flex justify-center">
              <Node reduce={!!reduce} />
            </div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, ease: EASE }}
              className="pb-1"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">
                {step.tag}
              </p>
              <h3 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                {step.title}
              </h3>
              <div className="mt-3 text-base leading-relaxed text-white/60 sm:text-lg">
                {step.body}
              </div>
              {step.to && step.toLabel && (
                <Link
                  to={step.to}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-[#DCF87C]"
                >
                  {step.toLabel}
                  <span aria-hidden>-&gt;</span>
                </Link>
              )}
            </motion.div>
          </li>
        ))}
      </ol>

      {/* Count the steps for the running position, kept honest. */}
      <p className="mt-10 pl-[calc(2rem+1rem)] text-sm text-white/35 sm:pl-[calc(2rem+1.5rem)]">
        {steps.length} waypoints, no dates — just the through-line.
      </p>
    </div>
  )
}
