import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'

export interface HPanel {
  /** Small label above the title, e.g. a discipline name. */
  tag: string
  title: string
  body: string
}

/**
 * A pinned horizontal-scroll section. While the section is in view it sticks to
 * the viewport and the row of panels translates sideways, mapping vertical
 * scroll to horizontal travel — the panels glide past as you scroll down.
 *
 * Travel is measured (track width minus the visible window) rather than
 * hard-coded percentages, so it adapts to panel count and screen size; the
 * outer height is sized so progress 0->1 covers exactly that travel. A gentle
 * spring smooths the motion.
 *
 * Under reduced motion (or before measurement) it degrades to a native,
 * user-driven horizontal scroller with snap points — fully readable, no
 * pinning, no listeners.
 */
export function HorizontalScroll({ panels, className }: { panels: HPanel[]; className?: string }) {
  const reduce = useReducedMotion()
  const sectionRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)
  const [viewportH, setViewportH] = useState(0)

  useLayoutEffect(() => {
    if (reduce) return
    function measure() {
      const track = trackRef.current
      const win = windowRef.current
      if (!track || !win) return
      const d = Math.max(0, track.scrollWidth - win.clientWidth)
      setDistance(d)
      setViewportH(window.innerHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (trackRef.current) ro.observe(trackRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [reduce, panels.length])

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })
  const xRaw = useTransform(scrollYProgress, [0, 1], [0, -distance])
  const x = useSpring(xRaw, { damping: 34, stiffness: 220, mass: 0.6 })

  // Reduced motion / pre-measure: a calm native scroller, no pinning.
  if (reduce) {
    return (
      <div className={className}>
        <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {panels.map((p, i) => (
            <Panel key={p.tag} panel={p} index={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={sectionRef}
      className={className}
      style={{ height: distance ? `${viewportH + distance}px` : undefined }}
    >
      <div ref={windowRef} className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div ref={trackRef} style={{ x }} className="flex gap-6 px-6 will-change-transform">
          {panels.map((p, i) => (
            <Panel key={p.tag} panel={p} index={i} />
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function Panel({ panel, index }: { panel: HPanel; index: number }) {
  return (
    <article className="group relative flex h-[58vh] min-h-[360px] w-[80vw] max-w-[440px] shrink-0 snap-center flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#161616] to-[#0d0d0d] p-8 sm:w-[420px] sm:p-10">
      {/* drifting lime wash that warms on hover */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#DCF87C]/10 opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">{panel.tag}</span>
        <span className="font-display text-2xl font-bold tabular-nums text-white/15">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="relative">
        <h3 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{panel.title}</h3>
        <p className="mt-4 leading-relaxed text-white/60">{panel.body}</p>
      </div>
    </article>
  )
}
