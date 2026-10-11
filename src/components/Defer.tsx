import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

// Mount-on-approach. A thin wrapper that keeps its children OUT of the React
// tree until the box is about to scroll into view, then mounts them for good.
//
// Why this exists: the Playground holds a few hundred live experiments, many of
// them running their own canvas + requestAnimationFrame loop. Mounting every
// one at once means hundreds of animation loops competing for the main thread
// the instant the page loads — most of them for things far below the fold that
// no one is looking at yet. Deferring the mount means an experiment only comes
// alive as you reach it, so the page spins up smoothly and stays responsive no
// matter how large the catalogue grows. Unlike `Reveal` (which fades children
// that are always mounted), `Defer` genuinely withholds the mount, so no effect
// runs and no loop starts until the piece is near the viewport.
//
// Once mounted it STAYS mounted (scrolling back up never tears it down and
// re-initialises it), so a toy keeps whatever state you left it in.
//
// Accessibility / honesty: the placeholder carries the same min-height as the
// real demo frame, so nothing below jumps as pieces mount; it is marked
// aria-hidden because it is a loading stand-in, not content. Under reduced
// motion the standby dot does not pulse — the deferral is about CPU, not
// decoration, so it still applies, just without the breathing animation.
//
// SSR/first-paint safety: if IntersectionObserver is unavailable (or the box is
// already on screen at mount), children render immediately.
export function Defer({
  children,
  className = '',
  minHeight = 220,
  rootMargin = '400px 0px',
  placeholderClassName = '',
}: {
  children: ReactNode
  /** Passed straight through to the wrapper (layout, rounding, etc.). */
  className?: string
  /** Reserved height for the standby state so layout never shifts on mount. */
  minHeight?: number
  /** How far ahead of the viewport to mount. A generous margin means the piece
   *  is already alive by the time it scrolls into view. */
  rootMargin?: string
  /** Extra classes for the standby panel, if a caller wants a different frame. */
  placeholderClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    // No observer (old browser, test env): don't gamble with a blank box — show.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown, rootMargin])

  return (
    <div ref={ref} className={className} style={shown ? undefined : { minHeight }}>
      {shown ? (
        children
      ) : (
        <div
          aria-hidden
          className={`flex h-full w-full items-center justify-center ${placeholderClassName}`}
          style={{ minHeight }}
        >
          <span
            className={`h-2 w-2 rounded-full bg-[#DCF87C]/50 ${reduce ? '' : 'animate-pulse'}`}
          />
        </div>
      )}
    </div>
  )
}
