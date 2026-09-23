import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'

// The controls family keeps rebuilding the platform gestures the web never
// shipped. SwipeToReveal gave the swipeable row its honest feel; this is the
// other gesture every phone owner knows in their thumb and no browser hands
// you for free: pull-to-refresh. Drag the top of a list down past its own
// ceiling and the content rubber-bands, an indicator hauls into the gap, and
// past a threshold it arms — "let go and I'll reload". Release there and the
// list settles onto a spinner while the work runs, then snaps home.
//
// The web fakes this constantly with a button, and loses the whole thing: the
// content that tracks your finger, the diminishing pull that fights back the
// further you drag, the arm at the threshold, the spinner that holds its
// ground until the promise resolves. So this is the real one.
//
// The pull distance is one Framer Motion value the gesture writes directly, so
// the content, the indicator, and the arrow's flip are never out of sync with
// the finger. The resistance is a genuine rubber band — a diminishing-returns
// curve that approaches a ceiling asymptotically, so the list gives easily at
// first and then refuses to be dragged to the floor. Release below the
// threshold and it springs back; release past it and `onRefresh` runs while the
// list rests on the spinner, with a floor on the visible time so a instant
// promise still reads as a refresh rather than a flicker.
//
// It only engages from the very top of the scroll — pull down anywhere else and
// the list just scrolls, exactly like the platform. Touch drives it through
// non-passive touch handlers (so the pull can cancel the browser's own scroll
// frame while it owns the gesture); mouse gets its own drag path, with no native
// scroll to fight. A polite live region speaks each state change, and a real
// focusable Reload control sits in the header so the keyboard is never left out.
//
// Reduced motion gets the honest equivalent, not a dead component: no drag, no
// rubber band — just that Reload button and the same spinner state, every bit
// of the behaviour reachable with none of the movement.

const SPRING = { type: 'spring' as const, stiffness: 460, damping: 40, mass: 0.9 }
// The spinner rests here while the refresh runs — enough to seat it clearly
// without holding the list far off its home.
const REST = 56
// Floor on the visible refresh so an instant promise still reads as work done.
const MIN_VISIBLE = 620

type Phase = 'idle' | 'pulling' | 'armed' | 'refreshing'

export interface PullToRefreshProps {
  /** The refresh work. May be async — the spinner holds until it settles. */
  onRefresh: () => void | Promise<void>
  /** The scrollable content. */
  children: ReactNode
  /** Max height of the scroll region; the pull opens above it. */
  maxHeight?: number | string
  /** Pull distance (px) that arms the refresh. */
  threshold?: number
  /** Ceiling the rubber band approaches. */
  max?: number
  pullLabel?: string
  releaseLabel?: string
  refreshingLabel?: string
  className?: string
}

// A spinning ring, used both as the armed→loading indicator and, held still and
// rotated by the pull, as the "drag me" arrow's companion track.
function Ring({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <motion.path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { repeat: Infinity, ease: 'linear', duration: 0.8 } : { duration: 0.2 }}
        style={{ transformOrigin: '12px 12px' }}
      />
    </svg>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path d="M12 5v14M12 19l5-5M12 19l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * A pull-to-refresh scroll region: drag the content down from the top past a
 * threshold and release to run `onRefresh`, with a real rubber-band pull, an
 * arming arrow, and a spinner that holds until the work settles. Keyboard users
 * get a Reload control, and under prefers-reduced-motion the drag is dropped for
 * that control alone — same behaviour, no movement.
 */
export function PullToRefresh({
  onRefresh,
  children,
  maxHeight = 360,
  threshold = 68,
  max = 128,
  pullLabel = 'Pull to refresh',
  releaseLabel = 'Release to refresh',
  refreshingLabel = 'Refreshing',
  className = '',
}: PullToRefreshProps) {
  const reduce = useReducedMotion()

  const y = useMotionValue(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [announce, setAnnounce] = useState('')

  const scrollerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  // Whether the current gesture has committed to a pull (vs. a normal scroll).
  const pullingRef = useRef(false)
  // Whether a gesture is being tracked at all (down happened at the top).
  const trackingRef = useRef(false)
  // Guards the synthetic mouse events browsers fire after a touch.
  const touchStampRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase

  // The rubber band: 1:1 near zero, then diminishing returns toward `max`, so
  // the list gives at first and stiffens the further it is hauled down.
  const resist = useCallback((dy: number) => (dy <= 0 ? 0 : max * (1 - Math.exp(-dy / max))), [max])

  // Indicator readouts, all derived from the one pull value.
  const indicatorOpacity = useTransform(y, [0, threshold * 0.35], [0, 1], { clamp: true })
  const indicatorScale = useTransform(y, [0, threshold], [0.7, 1], { clamp: true })
  const arrowRotate = useTransform(y, [threshold * 0.55, threshold], [0, 180], { clamp: true })

  const setPhaseSafe = useCallback((p: Phase) => {
    if (phaseRef.current !== p) setPhase(p)
  }, [])

  // A pull update from either input path: figures the phase and writes `y`.
  const onPull = useCallback(
    (dy: number) => {
      if (phaseRef.current === 'refreshing') return
      const scroller = scrollerRef.current
      if (scroller && scroller.scrollTop > 2) {
        // The list has scrolled — this is no longer a pull.
        pullingRef.current = false
        if (y.get() > 0) y.set(0)
        setPhaseSafe('idle')
        return
      }
      if (dy <= 0) {
        pullingRef.current = false
        if (y.get() > 0) y.set(0)
        setPhaseSafe('idle')
        return
      }
      pullingRef.current = true
      const pulled = resist(dy)
      y.set(pulled)
      setPhaseSafe(pulled >= threshold ? 'armed' : 'pulling')
    },
    [resist, setPhaseSafe, threshold, y],
  )

  const runRefresh = useCallback(() => {
    setPhase('refreshing')
    setAnnounce(`${refreshingLabel}…`)
    animate(y, REST, SPRING)
    const started = Date.now()
    const finish = () => {
      const wait = Math.max(0, MIN_VISIBLE - (Date.now() - started))
      window.setTimeout(() => {
        setPhase('idle')
        setAnnounce('Refreshed')
        animate(y, 0, SPRING)
      }, wait)
    }
    try {
      const r = onRefresh()
      if (r && typeof (r as Promise<void>).then === 'function') (r as Promise<void>).then(finish, finish)
      else finish()
    } catch {
      finish()
    }
  }, [onRefresh, refreshingLabel, y])

  const release = useCallback(() => {
    trackingRef.current = false
    if (!pullingRef.current || phaseRef.current === 'refreshing') return
    pullingRef.current = false
    if (y.get() >= threshold) runRefresh()
    else {
      setPhaseSafe('idle')
      animate(y, 0, SPRING)
    }
  }, [runRefresh, setPhaseSafe, threshold, y])

  // --- Touch path (non-passive, so a pull can cancel the browser scroll) ---
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || reduce) return

    const onTouchStart = (e: TouchEvent) => {
      touchStampRef.current = Date.now()
      if (phaseRef.current === 'refreshing') return
      if (scroller.scrollTop > 2) {
        trackingRef.current = false
        return
      }
      trackingRef.current = true
      startYRef.current = e.touches[0]!.clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current) return
      const dy = e.touches[0]!.clientY - startYRef.current
      // Once we own a downward pull from the top, stop the browser scrolling it.
      if (dy > 0 && (scroller.scrollTop <= 2 || pullingRef.current) && e.cancelable) e.preventDefault()
      onPull(dy)
    }
    const onTouchEnd = () => release()

    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchmove', onTouchMove, { passive: false })
    scroller.addEventListener('touchend', onTouchEnd)
    scroller.addEventListener('touchcancel', onTouchEnd)
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchmove', onTouchMove)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [onPull, reduce, release])

  // --- Mouse path (no native scroll to fight; window-level move/up) ---
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (reduce || phaseRef.current === 'refreshing') return
      // Ignore the synthetic mouse event that follows a touch.
      if (Date.now() - touchStampRef.current < 700) return
      const scroller = scrollerRef.current
      if (!scroller || scroller.scrollTop > 2) return
      trackingRef.current = true
      startYRef.current = e.clientY
    },
    [reduce],
  )

  useEffect(() => {
    if (reduce) return
    const onMove = (e: MouseEvent) => {
      if (!trackingRef.current) return
      const dy = e.clientY - startYRef.current
      if (pullingRef.current && dy > 0) e.preventDefault()
      onPull(dy)
    }
    const onUp = () => release()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onPull, reduce, release])

  const refreshing = phase === 'refreshing'
  const armed = phase === 'armed'
  const label = refreshing ? `${refreshingLabel}…` : armed ? releaseLabel : pullLabel

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}>
      {/* Header: title slot for the list, plus a keyboard-reachable Reload. */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/40">Feed</span>
        <button
          type="button"
          onClick={() => {
            if (phase !== 'refreshing') runRefresh()
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white/70 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60"
        >
          <span className={refreshing ? 'text-[#DCF87C]' : 'text-white/60'}>
            <Ring spinning={refreshing} />
          </span>
          {refreshing ? `${refreshingLabel}…` : 'Reload'}
        </button>
      </div>

      <div className="relative isolate">
        {/* Indicator, uncovered as the content slides down over it. */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-0 flex items-center justify-center overflow-hidden"
            style={{ height: y }}
          >
            <motion.div
              className="flex flex-col items-center gap-1.5"
              style={{ opacity: indicatorOpacity, scale: indicatorScale }}
            >
              <span className={armed || refreshing ? 'text-[#DCF87C]' : 'text-white/55'}>
                {refreshing ? (
                  <Ring spinning />
                ) : (
                  <motion.span className="block" style={{ rotate: arrowRotate }}>
                    <Arrow />
                  </motion.span>
                )}
              </span>
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/45">{label}</span>
            </motion.div>
          </motion.div>
        )}

        {/* The scroll region, dragged down by the pull. */}
        <motion.div
          ref={scrollerRef}
          onMouseDown={onMouseDown}
          style={reduce ? { maxHeight } : { y, maxHeight, touchAction: 'pan-y', overscrollBehavior: 'contain' }}
          className="relative z-10 overflow-y-auto bg-[#0e0e0e]"
        >
          {children}
        </motion.div>
      </div>

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}
