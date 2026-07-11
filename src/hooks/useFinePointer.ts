import { useEffect, useState } from 'react'

// useFinePointer — true only on a real mouse/trackpad (a `(pointer: fine)` match),
// tracked live so a device that gains/loses one updates. Shared single source used
// to gate cursor-driven interactions (torch reveals, hover flips) so touch users get
// a legible, non-hover fallback instead of a dead or surprising surface.
export function useFinePointer() {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return
    const m = window.matchMedia('(pointer: fine)')
    const on = () => setFine(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return fine
}
