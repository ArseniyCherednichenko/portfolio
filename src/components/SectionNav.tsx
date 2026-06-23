import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export type SectionLink = { id: string; label: string }

// Right-side orientation rail for long single-page views. Watches each target
// section with an IntersectionObserver and lights the matching marker as it
// scrolls into the middle of the viewport; clicking a marker glides there.
// Hidden on small screens (no room) and to assistive tech is a plain nav.
// Reduced motion: instant jumps, no springy indicator travel.
export function SectionNav({ sections }: { sections: SectionLink[] }) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label="On this page"
      className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
    >
      <ul className="flex flex-col items-end gap-4">
        {sections.map((s) => {
          const isActive = s.id === active
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(s.id)}
                aria-current={isActive ? 'true' : undefined}
                className="group flex items-center gap-3"
              >
                <span
                  className={`text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
                    isActive
                      ? 'text-[#DCF87C] opacity-100'
                      : 'text-white/50 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {s.label}
                </span>
                <span className="relative flex h-3 w-3 items-center justify-center">
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                      isActive ? 'bg-[#DCF87C]' : 'bg-white/25 group-hover:bg-white/60'
                    }`}
                  />
                  {isActive && (
                    <motion.span
                      layoutId="section-nav-ring"
                      className="absolute inset-0 rounded-full ring-1 ring-[#DCF87C]/60"
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 380, damping: 30 }
                      }
                    />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
