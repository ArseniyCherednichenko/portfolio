import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export type PillLink = { id: string; label: string }

// A sticky, horizontal scroll-spy pill bar for long single-page views with
// named sections. Watches each target section with an IntersectionObserver and
// glides a lime pill under the label of whichever section owns the middle of
// the viewport; clicking a pill smooth-scrolls there. Scrolls horizontally on
// small screens so every pill stays reachable. Reduced motion drops the glide
// (the pill jumps) and scrolls instantly. To assistive tech it is a plain nav.
export function PillNav({
  links,
  layoutId = 'pill-nav',
  className = '',
}: {
  links: PillLink[]
  layoutId?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(links[0]?.id ?? '')

  useEffect(() => {
    const els = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        // The section nearest the top of the active band wins.
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setActive(visible[0].target.id)
      },
      { rootMargin: '-42% 0px -50% 0px', threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [links])

  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav aria-label="Sections" className={className}>
      <div className="flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#0c0c0c]/80 p-1.5 backdrop-blur-xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((l) => {
          const isActive = l.id === active
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => go(l.id)}
              aria-current={isActive ? 'true' : undefined}
              className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                isActive ? 'text-black' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 -z-10 rounded-full bg-[#DCF87C]"
                  transition={
                    reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
                  }
                />
              )}
              {l.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
