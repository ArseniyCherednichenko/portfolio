import { motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

// The rich radio group the controls family was missing. It already had the
// *compact* way to pick one of a few — the SegmentedControl, a row of pill
// buttons where every option is a single word. But the other, commoner shape a
// product reaches for is the one this fills: a stack of **cards**, each option
// carrying a heading, a line of description, and sometimes a badge, the
// "choose a plan / pick a mode" list. Teams almost always build that out of
// bare <div>s with an onClick, and the moment they do they lose everything the
// native radio gave for free: one tab stop for the whole set, arrow keys that
// move *and* select, Home/End, and the aria-checked radiogroup a screen reader
// can announce. So this keeps the real WAI-ARIA contract — the container is
// role="radiogroup", each card a role="radio" with aria-checked, a roving
// tabindex keeps a single tab stop, and the arrows walk and select like native
// radios — and spends the motion where it reads: one lime selection outline
// springs from the old card to the new one on a shared layoutId, and a check
// draws itself into the chosen card. Controlled or uncontrolled; an optional
// hidden input carries the value into a real form. Reduced motion: the outline
// crossfades in place and the check is already drawn — identical to use.

const EASE = [0.16, 1, 0.3, 1] as const

export interface RadioCardOption {
  /** The value reported through onChange and carried by a form. */
  value: string
  /** The card's heading. */
  label: ReactNode
  /** A quieter second line under the heading. */
  description?: ReactNode
  /** A small pill in the top-right, e.g. "Popular" or a price. */
  badge?: ReactNode
  disabled?: boolean
}

export interface RadioCardsProps {
  options: RadioCardOption[]
  /** Controlled selected value — pair with onChange. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  onChange?: (value: string) => void
  /** Accessible name for the whole group. */
  'aria-label'?: string
  /** A visible heading rendered above the group and used as its label. */
  label?: ReactNode
  /** Emit a hidden input of this name so the choice rides a native form post. */
  name?: string
  className?: string
}

/**
 * A radiogroup rendered as a stack of selectable cards (heading + description +
 * optional badge). A single tab stop, arrow/Home/End navigable, aria-checked,
 * with a springing lime selection outline and a drawn check. Reduced-motion
 * aware; controlled or uncontrolled.
 */
export function RadioCards({
  options,
  value,
  defaultValue,
  onChange,
  'aria-label': ariaLabel,
  label,
  name,
  className = '',
}: RadioCardsProps) {
  const reduce = useReducedMotion()
  const groupId = useId()
  const labelId = label ? `${groupId}-label` : undefined
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])

  const isControlled = value !== undefined
  // When nothing is pre-selected, `current` is empty and no card is checked —
  // a legitimate "no choice yet" state the tab stop still reaches.
  const [uncontrolled, setUncontrolled] = useState<string>(defaultValue ?? '')
  const current = isControlled ? value! : uncontrolled

  const selectedIndex = options.findIndex((o) => o.value === current)
  // The single tab stop: the selected card, or — when nothing is chosen — the
  // first enabled one, so Tab always lands somewhere operable.
  const firstEnabled = options.findIndex((o) => !o.disabled)
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : firstEnabled

  const select = useCallback(
    (next: string, focus = false) => {
      if (next !== current) {
        if (!isControlled) setUncontrolled(next)
        onChange?.(next)
      }
      if (focus) {
        const i = options.findIndex((o) => o.value === next)
        cardRefs.current[i]?.focus()
      }
    },
    [current, isControlled, onChange, options],
  )

  // Walk to the next/previous enabled card, wrapping, and select it — native
  // radio behaviour, where moving the selection *is* arrowing.
  function step(dir: 1 | -1) {
    const n = options.length
    if (n === 0) return
    const from = selectedIndex >= 0 ? selectedIndex : dir === 1 ? -1 : 0
    for (let k = 1; k <= n; k++) {
      const i = ((from + dir * k) % n + n) % n
      if (!options[i]?.disabled) {
        select(options[i].value, true)
        return
      }
    }
  }

  function edge(which: 'first' | 'last') {
    const ordered = which === 'first' ? options : [...options].reverse()
    const found = ordered.find((o) => !o.disabled)
    if (found) select(found.value, true)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        step(1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        step(-1)
        break
      case 'Home':
        e.preventDefault()
        edge('first')
        break
      case 'End':
        e.preventDefault()
        edge('last')
        break
    }
  }

  return (
    <div className={className}>
      {label && (
        <div id={labelId} className="mb-3 text-sm font-semibold text-white/85">
          {label}
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-2.5"
      >
        {options.map((o, i) => {
          const selected = o.value === current
          return (
            <button
              key={o.value}
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={o.disabled}
              tabIndex={i === tabbableIndex ? 0 : -1}
              onClick={() => !o.disabled && select(o.value)}
              className={`group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-45 ${
                selected
                  ? 'border-[#DCF87C]/40 bg-[#DCF87C]/[0.06]'
                  : 'border-white/10 bg-white/[0.02] enabled:hover:border-white/25 enabled:hover:bg-white/[0.04]'
              }`}
            >
              {/* The single lime outline that springs from the old card to the
                  new one — a shared layoutId, so only ever one is mounted. */}
              {selected && (
                <motion.span
                  aria-hidden
                  layoutId={`${groupId}-outline`}
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-[#DCF87C]/60 shadow-[0_0_0_1px_rgba(220,248,124,0.15),0_8px_30px_-12px_rgba(220,248,124,0.4)]"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
                  }
                />
              )}

              {/* The radio dot — border eases to lime, a disc springs up, and a
                  check draws itself in when the card is chosen. */}
              <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-full border transition-colors duration-200 ${
                    selected ? 'border-[#DCF87C]' : 'border-white/30 group-enabled:group-hover:border-white/50'
                  }`}
                />
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[#DCF87C]"
                  initial={false}
                  animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 640, damping: 34 }}
                  style={{ transformOrigin: 'center' }}
                />
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  fill="none"
                  className="pointer-events-none relative"
                >
                  {selected && (
                    <motion.path
                      d="M5.5 10.5l3 3L15 7"
                      stroke="#0a0a0a"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: reduce ? 0 : 0.26, ease: EASE, delay: reduce ? 0 : 0.04 }}
                    />
                  )}
                </svg>
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-base font-semibold leading-snug text-white/90">
                    {o.label}
                  </span>
                  {o.badge && (
                    <span className="shrink-0 rounded-full border border-[#DCF87C]/25 bg-[#DCF87C]/[0.06] px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#DCF87C]/85">
                      {o.badge}
                    </span>
                  )}
                </span>
                {o.description && (
                  <span className="mt-1 text-sm leading-snug text-white/50">{o.description}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {/* Carry the choice into a native form post when asked. */}
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  )
}
