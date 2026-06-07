import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// React Router does not manage scroll position. On every navigation this jumps
// to the top of a new page, or — when the URL carries a hash like /#work —
// scrolls that section into view once it has mounted. Honors the global
// `scroll-behavior` (smooth, but auto under prefers-reduced-motion via CSS).
export function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      // Wait a frame so the target section is in the DOM after a route change.
      const id = hash.slice(1)
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView()
      })
      return
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])

  return null
}
