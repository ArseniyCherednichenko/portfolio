import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1] as const

export interface Scene {
  /** Small eyebrow label, e.g. "Layer 01". */
  tag: string
  /** One-line headline for the step. */
  title: string
  /** A sentence or two of detail. */
  body: string
}

interface ScrollSceneProps {
  scenes: readonly Scene[]
  /**
   * Renders the pinned visual for the active step. Receives the active index
   * and the total count. When omitted, a built-in morphing stage is used.
   */
  renderStage?: (active: number, total: number) => ReactNode
  className?: string
}

/**
 * ScrollScene — a sticky "scrollytelling" section. A visual stage pins to the
 * viewport on one side while a column of steps scrolls past on the other; as
 * each step crosses an activation line the stage cross-fades to it, so the
 * story and the picture stay in lock-step. A distinct scroll motion kind from
 * the site's stacking cards, pinned horizontal travel, spine-drawing timeline,
 * and word-by-word reveal — here a single pinned frame *transforms* under the
 * reader's scroll.
 *
 * Active detection is a rAF-throttled measure of every step's centre against a
 * line at mid-viewport (no per-step scroll listeners; a handful of rects a
 * frame). Under reduced motion the whole mechanism is dropped: the stage is
 * shown once fully composed and the steps render as a plain, legible list.
 */
export function ScrollScene({ scenes, renderStage, className }: ScrollSceneProps) {
  const reduce = useReducedMotion()
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (reduce) return
    let raf = 0
    const measure = () => {
      raf = 0
      const line = window.innerHeight * 0.5
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < stepRefs.current.length; i++) {
        const el = stepRefs.current[i]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const centre = rect.top + rect.height / 2
        const dist = Math.abs(centre - line)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      setActive(best)
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reduce, scenes.length])

  const stage = renderStage ?? defaultStage

  // Reduced motion: a fully-composed stage once, then a plain readable list.
  if (reduce) {
    return (
      <div className={className}>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <div className="lg:col-start-2 lg:row-start-1">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              {stage(scenes.length - 1, scenes.length)}
            </div>
          </div>
          <ol className="lg:col-start-1 lg:row-start-1">
            {scenes.map((s) => (
              <li
                key={s.title}
                className="border-t border-white/10 py-8 first:border-t-0 first:pt-0"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">
                  {s.tag}
                </span>
                <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/55">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        {/* STAGE — sticky. First in the DOM so on mobile it pins above the
            steps that scroll under it; pushed to the right column on lg. */}
        <div className="lg:col-start-2 lg:row-start-1">
          <div className="sticky top-16 z-10 lg:top-24">
            <div className="relative aspect-[16/11] w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:aspect-[16/10] lg:aspect-[4/3]">
              {stage(active, scenes.length)}
              {/* progress dots */}
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
                {scenes.map((s, i) => (
                  <span
                    key={s.title}
                    className="relative h-1.5 w-1.5 rounded-full bg-white/20"
                  >
                    {i === active && (
                      <motion.span
                        layoutId="scrollscene-dot"
                        className="absolute inset-0 rounded-full bg-[#DCF87C]"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STEPS */}
        <ol className="lg:col-start-1 lg:row-start-1">
          {scenes.map((s, i) => {
            const on = i === active
            return (
              <li
                key={s.title}
                ref={(el) => {
                  stepRefs.current[i] = el
                }}
                className="flex min-h-[62vh] flex-col justify-center py-6 lg:min-h-[80vh]"
              >
                <motion.div
                  animate={{ opacity: on ? 1 : 0.4 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="relative pl-5"
                >
                  {/* active rail marker */}
                  <span className="absolute left-0 top-1.5 h-[calc(100%-0.75rem)] w-px bg-white/10">
                    <motion.span
                      className="absolute inset-x-0 top-0 origin-top bg-[#DCF87C]"
                      animate={{ scaleY: on ? 1 : 0, opacity: on ? 1 : 0 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      style={{ height: '100%' }}
                    />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">
                    {s.tag}
                  </span>
                  <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                    {s.title}
                  </h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
                    {s.body}
                  </p>
                </motion.div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/** A tint per step for the built-in stage — lime always leads, a companion
 *  hue shifts so each scene reads as its own moment. */
const STAGE_TINTS = ['#DCF87C', '#7CE0F8', '#C69CF8', '#F8C77C', '#8CF8B4']

function defaultStage(active: number, total: number): ReactNode {
  const tint = STAGE_TINTS[active % STAGE_TINTS.length]
  return (
    <>
      <motion.div
        aria-hidden
        className="absolute inset-0"
        animate={{
          background: `radial-gradient(120% 120% at 30% 20%, ${tint}22 0%, transparent 55%), radial-gradient(120% 120% at 80% 90%, #DCF87C1a 0%, transparent 60%)`,
        }}
        transition={{ duration: 0.8, ease: EASE }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={active}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: EASE }}
            className="font-display text-[7rem] font-bold leading-none tracking-tight text-white sm:text-[9rem]"
            style={{ WebkitTextStroke: `1px ${tint}`, color: 'transparent' }}
          >
            {String(active + 1).padStart(2, '0')}
          </motion.span>
        </AnimatePresence>
        <span className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
          {active + 1} / {total}
        </span>
      </div>
    </>
  )
}
