import { useEffect, useState } from 'react'

// Tracks which section is currently in view (scroll-spy) via IntersectionObserver.
// Returns the id of the most-visible section.
export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? '')

  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => e !== null)
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (top) setActive(top.target.id)
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids.join(',')])

  return active
}
