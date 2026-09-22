import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion'

// The controls family keeps building the platform behaviours the web never
// shipped. This is one every phone owner knows in their thumb and no browser
// gives you for free: the swipeable list row. Drag a row of mail sideways and a
// tray of actions slides out from under it — archive, flag, delete — and shove
// it far enough and the outermost action fires on its own. It is the most
// tactile pattern in mobile UI, and on the web it is almost always faked with a
// button that toggles a panel, losing the whole feel: the row that tracks your
// finger one-to-one, the rubber-band when you pull past the tray, the snap that
// reads your release velocity, the flick that commits.
//
// So this is the honest version. The row's x is one Framer Motion value the
// drag writes directly, so the tray under it is never out of sync with the
// finger. Release, and where it lands is decided from BOTH how far it travelled
// and how fast — a slow drag settles by position, a quick flick opens or closes
// against the direction it was barely moving. Pull past the tray's own width and
// an elastic constraint lets it stretch, and cross a threshold and the primary
// action arms: its panel brightens to say "let go and I fire", and a release
// there slides the whole row off and commits, exactly like Mail's delete.
//
// None of that would matter if it were mouse-only, so it is a real keyboard
// control too: the row is focusable, ArrowLeft reveals the trailing tray and
// ArrowRight the leading one (the same directions the swipe uses), focus jumps
// straight onto the revealed actions so they can be triggered, and Escape closes
// and hands focus back. The revealed buttons are real <button>s the whole time,
// hidden from tab and screen readers only while their tray is closed. A polite
// live region says which tray opened.
//
// Reduced motion gets a genuine equivalent, not a dead component: with no drag
// to feel, the actions simply sit in a visible toolbar beside the row — every
// one reachable and labelled, the same choices with no motion at all.

const EASE = [0.16, 1, 0.3, 1] as const
const SPRING = { type: 'spring' as const, stiffness: 520, damping: 44, mass: 0.9 }
// Each action pill is a fixed width, iOS-style, so the tray width is just a
// count — no measuring, no layout thrash on resize.
const ACTION_W = 92
// A flick past this pointer speed opens/closes regardless of distance.
const FLICK = 520
// Pull the row past this fraction of its own width and the outermost action arms
// for a full-swipe commit.
const FULL = 0.52

export type SwipeTone = 'default' | 'accent' | 'danger'

export interface SwipeAction {
  id: string
  label: string
  /** Optional inline SVG glyph shown above the label. */
  icon?: ReactNode
  tone?: SwipeTone
  onAction: () => void
}

export interface SwipeToRevealProps {
  /** The row's own content, shown on the draggable surface. */
  children: ReactNode
  /** Actions revealed by swiping left (they sit on the trailing/right edge). The
   *  last one is the primary — the one a full left-swipe commits. */
  actions?: SwipeAction[]
  /** Actions revealed by swiping right (leading/left edge). The first is the
   *  primary a full right-swipe commits. */
  leadingActions?: SwipeAction[]
  /** Accessible name for the row (what the actions act on). */
  ariaLabel?: string
  className?: string
}

type Side = 'none' | 'trailing' | 'leading'

const TONE: Record<SwipeTone, string> = {
  default: 'bg-white/10 text-white/85 hover:bg-white/15',
  accent: 'bg-[#DCF87C] text-black hover:bg-[#e6ffa0]',
  danger: 'bg-[#e5484d] text-white hover:bg-[#f0575c]',
}

/**
 * An iOS-style swipeable list row: drag to reveal a tray of actions, flick to
 * open or close, or shove past the threshold to fire the outermost action.
 * Keyboard-operable (arrows reveal, focus lands on the actions, Escape closes)
 * and, under prefers-reduced-motion, it drops the drag for a plain visible
 * action toolbar so nothing is lost.
 */
export function SwipeToReveal({
  children,
  actions = [],
  leadingActions = [],
  ariaLabel,
  className = '',
}: SwipeToRevealProps) {
  const reduce = useReducedMotion()
  const trailingW = actions.length * ACTION_W
  const leadingW = leadingActions.length * ACTION_W

  const x = useMotionValue(0)
  const [open, setOpen] = useState<Side>('none')
  const [announce, setAnnounce] = useState('')

  const wrapRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const trailFirstRef = useRef<HTMLButtonElement>(null)
  const leadFirstRef = useRef<HTMLButtonElement>(null)
  const widthRef = useRef(0)
  const draggingRef = useRef(false)

  // Container width backs the full-swipe threshold. Measured, not guessed, so
  // the flick-to-commit distance is honest on any viewport.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      widthRef.current = el.clientWidth
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A tray's actions fade and rise into place as the row uncovers them, so the
  // reveal reads as the row lifting off the tray rather than a static panel
  // sitting behind a moving card.
  const trailProgress = useTransform(x, [-trailingW, 0], [1, 0], { clamp: true })
  const leadProgress = useTransform(x, [0, leadingW], [0, 1], { clamp: true })
  // Past the threshold the primary action arms — its panel brightens to promise
  // the commit, the clearest read of "let go now".
  const trailArm = useTransform(x, (v) =>
    widthRef.current ? Math.max(0, Math.min(1, (-v - widthRef.current * FULL) / 40)) : 0,
  )
  const leadArm = useTransform(x, (v) =>
    widthRef.current ? Math.max(0, Math.min(1, (v - widthRef.current * FULL) / 40)) : 0,
  )
  // The armed-panel opacity for each primary action, derived once at the top
  // level (never inside the action .map, which would break the Rules of Hooks).
  const trailArmOpacity = useTransform(trailArm, (v) => v * 0.28)
  const leadArmOpacity = useTransform(leadArm, (v) => v * 0.28)

  const snapTo = useCallback(
    (side: Side, opts?: { silent?: boolean }) => {
      const target = side === 'trailing' ? -trailingW : side === 'leading' ? leadingW : 0
      animate(x, target, SPRING)
      setOpen(side)
      if (!opts?.silent) {
        setAnnounce(
          side === 'none'
            ? 'Row closed'
            : `${side === 'trailing' ? actions.length : leadingActions.length} action${
                (side === 'trailing' ? actions.length : leadingActions.length) === 1 ? '' : 's'
              } revealed`,
        )
      }
    },
    [actions.length, leadingActions.length, leadingW, trailingW, x],
  )

  // A full swipe: the row slides off the edge, the primary action fires, then —
  // in case the parent keeps the row rather than removing it — it eases back.
  const commitFull = useCallback(
    (side: 'trailing' | 'leading') => {
      const w = widthRef.current || 320
      const action = side === 'trailing' ? actions[actions.length - 1] : leadingActions[0]
      if (!action) {
        snapTo('none')
        return
      }
      setAnnounce(`${action.label}`)
      animate(x, side === 'trailing' ? -w : w, { duration: 0.24, ease: EASE }).then(() => {
        action.onAction()
        x.set(0)
        setOpen('none')
      })
    },
    [actions, leadingActions, snapTo, x],
  )

  const onDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      draggingRef.current = false
      const w = widthRef.current || 320
      const cur = x.get()
      const vx = info.velocity.x
      // Full-swipe commit takes priority: dragged well past the tray.
      if (trailingW && cur < -w * FULL) return commitFull('trailing')
      if (leadingW && cur > w * FULL) return commitFull('leading')
      // Otherwise settle by position, with a flick overriding it.
      if (vx < -FLICK && trailingW) return snapTo('trailing')
      if (vx > FLICK && leadingW) return snapTo('leading')
      if (vx > FLICK || vx < -FLICK) return snapTo('none')
      if (cur < -trailingW / 2 && trailingW) return snapTo('trailing')
      if (cur > leadingW / 2 && leadingW) return snapTo('leading')
      return snapTo('none')
    },
    [commitFull, leadingW, snapTo, trailingW, x],
  )

  // Move focus onto the freshly revealed tray so a keyboard user can act on it.
  useEffect(() => {
    if (reduce) return
    if (open === 'trailing') trailFirstRef.current?.focus()
    else if (open === 'leading') leadFirstRef.current?.focus()
  }, [open, reduce])

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (reduce) return
      if (e.key === 'ArrowLeft' && trailingW) {
        e.preventDefault()
        snapTo('trailing')
      } else if (e.key === 'ArrowRight' && leadingW) {
        e.preventDefault()
        snapTo('leading')
      } else if (e.key === 'Escape' || e.key === 'Home') {
        if (open !== 'none') {
          e.preventDefault()
          snapTo('none')
          surfaceRef.current?.focus()
        }
      }
    },
    [leadingW, open, reduce, snapTo, trailingW],
  )

  const fireFrom = useCallback(
    (action: SwipeAction) => {
      action.onAction()
      snapTo('none', { silent: true })
      setAnnounce(`${action.label}`)
      surfaceRef.current?.focus()
    },
    [snapTo],
  )

  // Reduced-motion: no drag, no tray. Every action sits in a plain visible
  // toolbar beside the content — same choices, zero motion.
  if (reduce) {
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={`overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}
      >
        <div className="px-4 py-3.5">{children}</div>
        {(leadingActions.length > 0 || actions.length > 0) && (
          <div className="flex flex-wrap gap-2 border-t border-white/8 bg-black/20 px-4 py-2.5">
            {[...leadingActions, ...actions].map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => a.onAction()}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${TONE[a.tone ?? 'default']}`}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative isolate overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}
    >
      {/* LEADING TRAY — revealed by dragging right, pinned to the left edge. */}
      {leadingW > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 flex"
          style={{ width: leadingW, opacity: leadProgress }}
        >
          {leadingActions.map((a, i) => (
            <motion.button
              key={a.id}
              ref={i === 0 ? leadFirstRef : undefined}
              type="button"
              tabIndex={open === 'leading' ? 0 : -1}
              aria-hidden={open === 'leading' ? undefined : true}
              onClick={() => fireFrom(a)}
              style={{ width: ACTION_W }}
              className={`relative flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 ${TONE[a.tone ?? 'default']}`}
            >
              {/* The primary (first) leading action arms on a full right-swipe. */}
              {i === 0 && (
                <motion.span aria-hidden className="absolute inset-0 bg-white" style={{ opacity: leadArmOpacity }} />
              )}
              <span className="relative flex flex-col items-center gap-1">
                {a.icon}
                {a.label}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* TRAILING TRAY — revealed by dragging left, pinned to the right edge. */}
      {trailingW > 0 && (
        <motion.div
          className="absolute inset-y-0 right-0 flex"
          style={{ width: trailingW, opacity: trailProgress }}
        >
          {actions.map((a, i) => (
            <motion.button
              key={a.id}
              ref={i === 0 ? trailFirstRef : undefined}
              type="button"
              tabIndex={open === 'trailing' ? 0 : -1}
              aria-hidden={open === 'trailing' ? undefined : true}
              onClick={() => fireFrom(a)}
              style={{ width: ACTION_W }}
              className={`relative flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 ${TONE[a.tone ?? 'default']}`}
            >
              {/* The primary (last) trailing action arms on a full left-swipe. */}
              {i === actions.length - 1 && (
                <motion.span aria-hidden className="absolute inset-0 bg-white" style={{ opacity: trailArmOpacity }} />
              )}
              <span className="relative flex flex-col items-center gap-1">
                {a.icon}
                {a.label}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* THE ROW SURFACE — the draggable card the finger tracks one-to-one. */}
      <motion.div
        ref={surfaceRef}
        tabIndex={0}
        aria-label={ariaLabel ? `${ariaLabel}. Swipe or use arrow keys to reveal actions.` : 'Swipe or use arrow keys to reveal actions.'}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -trailingW, right: leadingW }}
        dragElastic={0.4}
        dragMomentum={false}
        onDragStart={() => {
          draggingRef.current = true
        }}
        onDragEnd={onDragEnd}
        onKeyDown={onKeyDown}
        onClick={() => {
          // A tap on an open row closes it, matching the platform.
          if (!draggingRef.current && open !== 'none') snapTo('none')
        }}
        style={{ x }}
        className="relative z-10 cursor-grab touch-pan-y select-none bg-[#0e0e0e] px-4 py-3.5 outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#DCF87C]/70"
      >
        {children}
      </motion.div>

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}
