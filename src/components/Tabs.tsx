import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

// The accessible tabbed panel the controls family was missing. It already had
// pieces that *look* like tabs — the SegmentedControl (a compact one-of-a-few
// picker), GooeyTabs (a liquid indicator effect), PillNav (a scroll-spy nav) —
// but none of them is the real thing a product reaches for: a **tablist wired
// to panels**, where choosing a tab swaps the content beneath it. Teams build
// that out of bare buttons and a `useState`, and the instant they do they lose
// everything the pattern owes a keyboard and a screen reader: a single tab stop
// for the whole strip, arrow keys that move between tabs, Home/End to the ends,
// the `aria-selected` tablist a reader announces, and the `aria-controls` /
// `aria-labelledby` wiring that ties each tab to the panel it reveals. So this
// keeps the full WAI-ARIA Tabs contract — role="tablist" / "tab" / "tabpanel",
// a roving tabindex so Tab lands on the active tab and then leaves the strip,
// arrows that walk (and, by default, select) across the enabled tabs, the
// active panel reachable by Tab — and spends the motion where it reads: one
// lime indicator glides from the old tab to the new on a shared layoutId
// (measured from the live buttons, so any label length lines up, and, in the
// enclosed variant, morphs its width to fit), and the panel beneath slides in
// from the side you moved toward while the old one leaves the other way.
// Controlled or uncontrolled. Reduced motion: the indicator crossfades in place
// and panels swap without travel — identical to use, just still.

const EASE = [0.16, 1, 0.3, 1] as const

export interface TabItem {
  /** The value reported through onChange and used to match the active tab. */
  value: string
  /** The tab's label. */
  label: ReactNode
  /** A small glyph rendered before the label. */
  icon?: ReactNode
  /** The panel body revealed when this tab is active. */
  content: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  /** Controlled active value — pair with onChange. */
  value?: string
  /** Initial active value when uncontrolled; defaults to the first enabled tab. */
  defaultValue?: string
  onChange?: (value: string) => void
  /** 'underline' (a line under the active tab) or 'pill' (an enclosed segmented strip). */
  variant?: 'underline' | 'pill'
  /**
   * Automatic activation follows focus — arrowing to a tab selects it, the
   * native default when panels are cheap. Set false for manual activation,
   * where arrows only move focus and Enter/Space selects (for heavier panels).
   */
  activateOnFocus?: boolean
  /** Accessible name for the tablist. */
  'aria-label'?: string
  className?: string
}

/**
 * A WAI-ARIA tabbed panel: a tablist wired to panels, one tab stop, arrow /
 * Home / End navigable, with a springing lime indicator and a direction-aware
 * panel transition. Reduced-motion aware; controlled or uncontrolled.
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  variant = 'underline',
  activateOnFocus = true,
  'aria-label': ariaLabel,
  className = '',
}: TabsProps) {
  const reduce = useReducedMotion()
  const baseId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const firstEnabled = Math.max(
    0,
    items.findIndex((t) => !t.disabled),
  )
  const fallback = items[firstEnabled]?.value ?? items[0]?.value ?? ''

  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = useState<string>(defaultValue ?? fallback)
  const current = isControlled ? value! : uncontrolled

  const activeIndex = Math.max(
    0,
    items.findIndex((t) => t.value === current),
  )

  // The panel slides in from the side it was summoned toward: moving to a later
  // tab enters from the right, an earlier one from the left. A ref holds the
  // last index so the direction survives re-renders without extra state.
  const prevIndex = useRef(activeIndex)
  const direction = activeIndex >= prevIndex.current ? 1 : -1
  prevIndex.current = activeIndex

  const select = useCallback(
    (next: string, focus = false) => {
      if (next !== current) {
        if (!isControlled) setUncontrolled(next)
        onChange?.(next)
      }
      if (focus) {
        const i = items.findIndex((t) => t.value === next)
        tabRefs.current[i]?.focus()
      }
    },
    [current, isControlled, onChange, items],
  )

  // Walk to the next/previous enabled tab, wrapping. Whether the walk also
  // selects depends on the activation mode; focus always follows.
  function step(dir: 1 | -1) {
    const n = items.length
    if (n === 0) return
    for (let k = 1; k <= n; k++) {
      const i = ((activeIndex + dir * k) % n + n) % n
      if (!items[i]?.disabled) {
        if (activateOnFocus) {
          select(items[i].value, true)
        } else {
          tabRefs.current[i]?.focus()
        }
        return
      }
    }
  }

  function edge(which: 'first' | 'last') {
    const order = which === 'first' ? items.map((_, i) => i) : items.map((_, i) => items.length - 1 - i)
    const i = order.find((idx) => !items[idx]?.disabled)
    if (i === undefined) return
    if (activateOnFocus) select(items[i].value, true)
    else tabRefs.current[i]?.focus()
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        step(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
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

  const enclosed = variant === 'pill'
  const indicatorSpring = reduce
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 520, damping: 42, mass: 0.7 } as const)

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className={
          enclosed
            ? 'inline-flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1'
            : 'flex gap-1 border-b border-white/10'
        }
      >
        {items.map((t, i) => {
          const selected = t.value === current
          return (
            <button
              key={t.value}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.value}`}
              disabled={t.disabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => !t.disabled && select(t.value)}
              className={`group relative inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40 ${
                enclosed ? 'rounded-full px-4 py-1.5' : 'px-3 pb-3 pt-1.5'
              } ${
                selected
                  ? enclosed
                    ? 'text-black'
                    : 'text-white'
                  : 'text-white/50 enabled:hover:text-white/80'
              }`}
            >
              {/* The single indicator — only one is mounted, so the shared
                  layoutId makes it glide (and, enclosed, morph width) from the
                  old tab to the new. In the pill variant it sits behind the
                  label; under the underline variant it is a line at the base. */}
              {selected &&
                (enclosed ? (
                  <motion.span
                    aria-hidden
                    layoutId={`${baseId}-indicator`}
                    className="absolute inset-0 -z-0 rounded-full bg-[#DCF87C]"
                    transition={indicatorSpring}
                  />
                ) : (
                  <motion.span
                    aria-hidden
                    layoutId={`${baseId}-indicator`}
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#DCF87C]"
                    transition={indicatorSpring}
                  />
                ))}
              {t.icon && (
                <span aria-hidden className="relative z-10 inline-flex">
                  {t.icon}
                </span>
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* The panels. Only the active one is mounted; it enters from the side the
          selection moved toward while the old one leaves the other way, then
          AnimatePresence waits for the exit so the two never overlap. */}
      <div className="relative mt-5 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={current}
            role="tabpanel"
            id={`${baseId}-panel-${current}`}
            aria-labelledby={`${baseId}-tab-${current}`}
            tabIndex={0}
            custom={direction}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
            transition={{ duration: reduce ? 0.12 : 0.28, ease: EASE }}
            className="outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            {items[activeIndex]?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
