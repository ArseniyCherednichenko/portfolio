import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
  type ReactNode,
} from 'react'
import { useReducedMotion } from 'framer-motion'

// FocusCards — a grid where touching one card brings it into focus and lets the
// rest fall quietly back. In the spirit of Aceternity's "focus cards", rebuilt
// by hand and wired for the keyboard, not only the mouse.
//
// The idea is a kind of restraint the other card pieces here do not have. The
// spotlight card lights the one under the cursor; the glow card hands its border
// to the pointer; the tilt and parallax cards answer the cursor by moving. Each
// of those makes the touched card do *more*. This one makes everything else do
// *less*: the card you are on holds still and sharp while its neighbours blur a
// touch, dim, and settle back a hair, so attention is directed by subtraction
// rather than addition — the way a good page dims what you are not reading.
//
// Coordination without indices. A grid needs each card to know two things: is
// *any* sibling active, and am *I* the active one. Rather than thread fragile
// positional indices, every FocusCard mints a stable id (useId) and the parent
// context holds only the active id. A card is dimmed exactly when some id is
// active and it is not mine — so the set stays correct however the children are
// composed, reordered, or conditionally rendered.
//
// It answers the keyboard, not just the pointer. Focus moving into a card (a
// link or button inside it, via onFocusCapture) raises it the same way a hover
// does, and focus leaving lowers it, so tabbing through the grid reads exactly
// like sweeping the cursor across it — the dim is an attention cue for everyone,
// not a mouse-only flourish.
//
// Reduced motion keeps the meaning, drops the motion. There is no blur and no
// scale: the active card simply gains a faint, even ring and the rest are left
// untouched, so the grid still says "this one" without anything sliding.

interface FocusCtx {
  active: string | null
  focus: (id: string) => void
  blur: (id: string) => void
}

const FocusContext = createContext<FocusCtx | null>(null)

/**
 * The grid shell. Holds the single "which card is active" value and lays its
 * children out in a responsive grid by default (override with `className`).
 */
export function FocusCards({
  children,
  className = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3',
}: {
  children: ReactNode
  className?: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const focus = useCallback((id: string) => setActive(id), [])
  // Only clear if the leaving card is still the active one — guards against a
  // fast pointer that enters the next card before the previous one's leave
  // fires, which would otherwise blank the whole grid mid-sweep.
  const blur = useCallback(
    (id: string) => setActive((cur) => (cur === id ? null : cur)),
    [],
  )
  return (
    <FocusContext.Provider value={{ active, focus, blur }}>
      <div className={className}>{children}</div>
    </FocusContext.Provider>
  )
}

/**
 * One card in the grid. Wrap whatever content you like; put a real link or
 * button inside and the whole card tracks its focus for the keyboard.
 */
export function FocusCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ctx = useContext(FocusContext)
  const reduce = useReducedMotion()
  const id = useId()

  // Used on its own (no FocusCards parent) it is just a plain bordered card —
  // never broken, only unlinked from any siblings.
  const active = ctx?.active ?? null
  const isActive = active === id
  const isDimmed = active !== null && !isActive

  const handlers = ctx
    ? {
        onPointerEnter: () => ctx.focus(id),
        onPointerLeave: () => ctx.blur(id),
        // Capture so focus landing on anything inside (a link, a button) counts
        // as focusing the card, matching the hover behaviour for the keyboard.
        onFocusCapture: () => ctx.focus(id),
        onBlurCapture: () => ctx.blur(id),
      }
    : {}

  // Reduced motion: no blur, no scale — the active card gets a calm ring and the
  // rest are left exactly as they are. The meaning survives; the movement does not.
  if (reduce) {
    return (
      <div
        {...handlers}
        className={`relative rounded-3xl border bg-white/[0.03] ${
          isActive ? 'border-[#DCF87C]/40' : 'border-white/10'
        } ${className}`}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      {...handlers}
      className={`relative rounded-3xl border border-white/10 bg-white/[0.03] transition-[filter,opacity,transform] duration-500 ease-out will-change-transform ${
        isDimmed ? 'scale-[0.98] opacity-55 blur-[2px]' : 'scale-100 opacity-100 blur-0'
      } ${isActive ? 'scale-[1.02]' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
