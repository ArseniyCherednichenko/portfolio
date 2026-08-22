import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// A radial (pie) action menu. Press the centre and the items don't drop into a
// list — they fan out on an arc around the trigger, each one springing from the
// centre to its seat with a staggered delay so the ring blooms open rather than
// appearing all at once. A thin spoke grows from the hub to each item as it
// travels, so the geometry reads as a wheel, not scattered buttons. The trigger
// glyph (a plus) rotates into a cross as it opens, and a live readout in the hub
// names whichever item is under the cursor or the keyboard.
//
// It is a real menu, not a decoration. The trigger carries aria-haspopup and
// aria-expanded; the fan is a role=menu of role=menuitem buttons; a single
// roving highlight walks the ring with the arrow keys (Right/Down forward,
// Left/Up back, wrapping), Home and End jump to the ends, Enter or Space fires
// the highlighted item, and Escape closes and returns focus to the trigger.
// Click outside closes it too.
//
// Reduced motion keeps every affordance but drops the theatre: the items appear
// in place with no fan-out spring, no spoke draw, and no glyph spin.

export interface RadialMenuItem {
  /** Accessible label, also shown in the hub readout on hover/focus. */
  label: string
  /** Optional glyph (an inline SVG or a character). Falls back to the initial. */
  icon?: ReactNode
  /** Called when the item is chosen. */
  onSelect?: () => void
  /** If set, the item is a link (external opens in a new tab). */
  href?: string
}

export interface RadialMenuProps {
  items: RadialMenuItem[]
  /** Distance in px from the hub to each item's centre. */
  radius?: number
  /** Degrees of the first item, measured clockwise from due north. */
  startAngle?: number
  /** Total arc the items span, in degrees. 360 lays a full, even wheel. */
  spread?: number
  /** Accessible name for the trigger. */
  label?: string
  className?: string
}

// Where an item sits, in the CSS coordinate system (y grows downward). Angle 0
// is north; angles increase clockwise, matching how the eye reads the wheel.
function seat(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius }
}

export function RadialMenu({
  items,
  radius = 120,
  startAngle = 0,
  spread = 360,
  label = 'Open actions',
  className = '',
}: RadialMenuProps) {
  const reduce = useReducedMotion()
  const menuId = useId()
  const [open, setOpen] = useState(false)
  // The highlighted seat. -1 means nothing is highlighted yet (fresh open); the
  // hub then shows its resting label.
  const [active, setActive] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | HTMLAnchorElement | null>>([])

  const n = items.length
  // A full turn distributes evenly with no doubled seat at the seam; a partial
  // arc pins the first and last items to the ends of the span.
  const full = spread >= 360
  const step = n <= 1 ? 0 : full ? spread / n : spread / (n - 1)

  const close = (returnFocus = true) => {
    setOpen(false)
    setActive(-1)
    if (returnFocus) triggerRef.current?.focus()
  }

  // Move the highlight and pull focus with it, so screen readers and sighted
  // keyboard users stay in lock-step.
  const move = (next: number) => {
    const i = ((next % n) + n) % n
    setActive(i)
    itemRefs.current[i]?.focus()
  }

  const choose = (item: RadialMenuItem) => {
    item.onSelect?.()
    // A link handles its own navigation; a pure action closes the wheel.
    if (!item.href) close()
  }

  // Close on a click anywhere outside the wheel.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  // When the wheel opens, land focus on the first seat so the arrows work at
  // once. Skipped for a pointer open where the user hasn't asked for keyboard.
  const openWheel = (focusFirst: boolean) => {
    setOpen(true)
    if (focusFirst) {
      setActive(0)
      // Wait a frame for the items to mount before focusing.
      requestAnimationFrame(() => itemRefs.current[0]?.focus())
    }
  }

  const onWheelKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        move(active < 0 ? 0 : active + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        move(active < 0 ? n - 1 : active - 1)
        break
      case 'Home':
        e.preventDefault()
        move(0)
        break
      case 'End':
        e.preventDefault()
        move(n - 1)
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  const spokeSpring = { type: 'spring' as const, stiffness: 260, damping: 22, mass: 0.9 }
  const size = radius * 2 + 132

  const hubLabel = active >= 0 ? items[active].label : open ? 'Choose' : label

  return (
    <div
      ref={rootRef}
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Spokes: thin lines from the hub to each seat, drawn as the ring blooms.
          Purely decorative, so hidden from assistive tech. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <AnimatePresence>
          {open &&
            items.map((_, i) => {
              const { x, y } = seat(startAngle + step * i, radius)
              const cx = size / 2
              const cy = size / 2
              return (
                <motion.line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={cx + x}
                  y2={cy + y}
                  stroke={active === i ? '#DCF87C' : 'rgba(255,255,255,0.14)'}
                  strokeWidth={active === i ? 1.5 : 1}
                  initial={reduce ? { opacity: 0.6 } : { pathLength: 0, opacity: 0 }}
                  animate={reduce ? { opacity: 0.6 } : { pathLength: 1, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
                  transition={reduce ? { duration: 0 } : { ...spokeSpring, delay: i * 0.03 }}
                />
              )
            })}
        </AnimatePresence>
      </svg>

      {/* The items live inside the role=menu the trigger points at. The wrapper
          uses display:contents so it adds the menu semantics without becoming
          the positioning context — the seats still resolve against the root. */}
      <div id={menuId} role="menu" aria-label={label} style={{ display: 'contents' }}>
      <AnimatePresence>
        {open &&
          items.map((item, i) => {
            const { x, y } = seat(startAngle + step * i, radius)
            const isActive = active === i
            const common =
              'grid h-14 w-14 place-items-center rounded-full border text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70'
            const skin = isActive
              ? 'border-[#DCF87C] bg-[#DCF87C] text-black'
              : 'border-white/12 bg-white/[0.04] text-white/75 hover:border-white/25 hover:text-white'
            const style: CSSProperties = { transformOrigin: 'center' }
            const glyph = item.icon ?? item.label.charAt(0).toUpperCase()

            const anim = {
              key: item.label,
              className: `absolute ${common} ${skin}`,
              style,
              role: 'menuitem' as const,
              'aria-label': item.label,
              tabIndex: isActive || (active < 0 && i === 0) ? 0 : -1,
              onKeyDown: onWheelKey,
              onPointerEnter: () => setActive(i),
              onFocus: () => setActive(i),
              initial: reduce ? { x, y, opacity: 0 } : { x: 0, y: 0, scale: 0.2, opacity: 0 },
              animate: reduce
                ? { x, y, opacity: 1 }
                : { x, y, scale: 1, opacity: 1 },
              exit: reduce ? { x, y, opacity: 0 } : { x: 0, y: 0, scale: 0.2, opacity: 0 },
              transition: reduce
                ? { duration: 0 }
                : { type: 'spring' as const, stiffness: 380, damping: 26, mass: 0.8, delay: i * 0.035 },
            }

            if (item.href) {
              const ext = /^https?:/.test(item.href)
              return (
                <motion.a
                  {...anim}
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                  href={item.href}
                  target={ext ? '_blank' : undefined}
                  rel={ext ? 'noreferrer' : undefined}
                  onClick={() => choose(item)}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {glyph}
                  </span>
                </motion.a>
              )
            }
            return (
              <motion.button
                {...anim}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                onClick={() => choose(item)}
              >
                <span aria-hidden className="text-lg leading-none">
                  {glyph}
                </span>
              </motion.button>
            )
          })}
      </AnimatePresence>
      </div>

      {/* The hub: trigger plus a live readout of the highlighted item. */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => (open ? close(false) : openWheel(false))}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            openWheel(true)
          } else if (open) {
            onWheelKey(e)
          }
        }}
        className="relative z-10 grid h-20 w-20 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-white shadow-[0_0_40px_-12px_rgba(220,248,124,0.5)] outline-none transition-colors hover:border-[#DCF87C]/60 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
      >
        <motion.svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          animate={{ rotate: open ? 135 : 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
        >
          <path d="M12 5v14M5 12h14" stroke="#DCF87C" strokeWidth="2" strokeLinecap="round" />
        </motion.svg>
      </button>

      {/* The readout sits just under the hub. role=status narrates the current
          selection to assistive tech as the highlight moves. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute left-1/2 top-[calc(50%+3.25rem)] -translate-x-1/2 whitespace-nowrap text-center"
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={hubLabel}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
            className={`text-xs font-semibold uppercase tracking-[0.18em] ${
              active >= 0 ? 'text-[#DCF87C]' : 'text-white/40'
            }`}
          >
            {hubLabel}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}
