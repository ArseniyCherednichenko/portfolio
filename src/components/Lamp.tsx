import { motion, useReducedMotion, type Transition } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Lamp — an overhead light rig that ignites a statement as it scrolls into view.
 *
 * A distinct kind of reveal from the site's other light effects: SpotlightReveal
 * is a torch you drag across hidden words, ChromaGrid dims everything but a hole
 * under the cursor, Aurora/Iridescence/Lightning are ambient fields. This one is
 * a fixed overhead lamp — a thin glowing tube with a beam that fans down and a
 * soft pool of light beneath it — that switches on when the section arrives:
 * the tube stretches wide, the beam widens, the pool blooms, and the heading
 * rises up into the light it casts. In the spirit of Aceternity's Lamp, rebuilt
 * from scratch.
 *
 * The whole rig is additive (semi-transparent lime, heavily blurred), so it
 * lights whatever sits behind it — the Aurora, a page's own background — rather
 * than painting a dark box over it. No canvas, no RAF: three Framer Motion
 * layers keyed to `whileInView`, played once. The light is `aria-hidden`; the
 * children carry all the meaning.
 *
 * Under reduced motion the rig renders already switched on and the heading sits
 * still in the pool — the composition is the point, the ignition is the flourish.
 */
export function Lamp({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  const EASE = [0.16, 1, 0.3, 1] as const
  const t = (delay = 0): Transition => ({ duration: 0.9, delay, ease: EASE })
  const view = { once: true, margin: '-120px' } as const
  // Under reduced motion each layer uses initial={false}, which renders it
  // straight at its `whileInView` target — the fully-lit resting state — with no
  // from-state and no animation. So the same markup doubles as the still
  // fallback: the composition is the point, the ignition is the flourish.

  return (
    <div className={`relative isolate flex flex-col items-center overflow-hidden ${className}`}>
      {/* LIGHT RIG — purely decorative, lit from the top edge. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72">
        {/* The beam: a trapezoid of light that fans down from the tube — its
            narrow apex sits on the tube so the light reads as cast by the bar. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scaleX: 0.4 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={view}
          transition={t(0.15)}
          style={{
            transformOrigin: 'top center',
            background: 'linear-gradient(to bottom, rgba(220,248,124,0.34), transparent 72%)',
            clipPath: 'polygon(44% 0%, 56% 0%, 84% 100%, 16% 100%)',
          }}
          className="absolute inset-x-0 top-12 mx-auto h-64 w-[36rem] max-w-[92vw] blur-[7px]"
        />
        {/* The pool: a soft ellipse of light blooming just under the tube. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.55 }}
          whileInView={{ opacity: 0.6, scale: 1 }}
          viewport={view}
          transition={t(0.3)}
          style={{ background: '#DCF87C' }}
          className="absolute inset-x-0 top-8 mx-auto h-40 w-[22rem] max-w-[82vw] rounded-[50%] blur-[80px]"
        />
        {/* The tube: a bright hairline that stretches wide as it switches on. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, width: '9rem' }}
          whileInView={{ opacity: 1, width: '30rem' }}
          viewport={view}
          transition={t(0)}
          style={{ boxShadow: '0 0 26px 5px rgba(220,248,124,0.85)' }}
          className="absolute inset-x-0 top-12 mx-auto h-[3px] max-w-[86vw] rounded-full bg-[#DCF87C]"
        />
      </div>

      {/* CONTENT — rises up into the pool of light the rig casts. */}
      <div className="relative z-10 w-full pt-36 sm:pt-40">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 44 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={view}
          transition={t(0.35)}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
