import { motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

// The controls family had the pickers that hide their options until you open
// them — the Select, the Combobox, the Wheel — and the binary Switch. What it
// was missing is the one where every choice stays on screen at once and you
// pick between a small, fixed few: the segmented control, the iOS/macOS
// tab-of-buttons. This fills that gap, and it speaks the same "one lit thing
// glides, it never blinks" language as its siblings — a single accent pill
// rides a spring from the old segment to the new one, morphing its width to fit
// each label rather than teleporting. The pill's geometry is measured from the
// live buttons (a ResizeObserver keeps it exact through font swaps and reflow),
// so labels of any length line up.
//
// It is a real WAI-ARIA radio group: the container is role="radiogroup", each
// segment a role="radio" carrying aria-checked, and a roving tabindex keeps the
// group a single tab stop. The arrows (and Home/End) move the selection and the
// focus together, wrapping at the ends, the way a native radio group does; click
// selects too. Under prefers-reduced-motion the glide comes off — the pill lands
// on its segment instantly — and the control stays a plain, fully usable picker.

export interface SegmentOption {
  /** Stable value reported through onChange and compared against `value`. */
  value: string
  /** What the segment shows. Falls back to `value` when omitted. */
  label?: ReactNode
  /** Optional glyph rendered before the label. */
  icon?: ReactNode
  disabled?: boolean
}

/** Accept either rich options or a bare list of strings. */
export type SegmentInput = SegmentOption | string

function normalise(o: SegmentInput): SegmentOption {
  return typeof o === 'string' ? { value: o } : o
}

/**
 * A segmented control: a fixed row of choices with one selected, the accent
 * highlight gliding between segments on a spring and sizing itself to each.
 *
 * Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). It is a
 * real `role="radiogroup"` — a single tab stop, arrow/Home/End navigable, with
 * selection following focus the way a native radio group does. Under
 * prefers-reduced-motion the glide is dropped for an instant, legible move.
 */
export function SegmentedControl({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  label,
  size = 'md',
  className = '',
}: {
  options: SegmentInput[]
  /** Controlled selected value. When set, changes report through onChange only. */
  value?: string
  /** Initial value when uncontrolled. Defaults to the first enabled option. */
  defaultValue?: string
  onChange?: (value: string) => void
  /** Accessible name for the group. */
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const reduce = useReducedMotion()
  const groupId = useId()
  const opts = options.map(normalise)

  const firstEnabled = opts.find((o) => !o.disabled)?.value ?? opts[0]?.value ?? ''
  const isControlled = controlledValue !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? firstEnabled)
  const value = isControlled ? controlledValue : uncontrolled
  const selectedIndex = Math.max(0, opts.findIndex((o) => o.value === value))

  const listRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([])
  // The pill's measured geometry, in px relative to the padded track.
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  const measure = useCallback(() => {
    const list = listRef.current
    const el = btnRefs.current[selectedIndex]
    if (!list || !el) return
    const l = list.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setPill({ left: b.left - l.left, width: b.width })
  }, [selectedIndex])

  // Measure after layout, and again whenever the track or a segment resizes
  // (font swap, container reflow, label change) so the pill never drifts.
  useLayoutEffect(() => {
    measure()
  }, [measure, opts.length])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => measure()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
    const ro = new ResizeObserver(() => measure())
    if (listRef.current) ro.observe(listRef.current)
    btnRefs.current.forEach((b) => b && ro.observe(b))
    return () => ro.disconnect()
  }, [measure, opts.length])

  function select(next: string, focus = false) {
    if (next !== value) {
      if (!isControlled) setUncontrolled(next)
      onChange?.(next)
    }
    if (focus) {
      const i = opts.findIndex((o) => o.value === next)
      btnRefs.current[i]?.focus()
    }
  }

  // Step to the next/previous enabled segment, wrapping at the ends.
  function step(dir: 1 | -1) {
    const n = opts.length
    for (let k = 1; k <= n; k++) {
      const i = (selectedIndex + dir * k + n * k) % n
      if (!opts[i]?.disabled) {
        select(opts[i].value, true)
        return
      }
    }
  }

  function edge(which: 'first' | 'last') {
    const ordered = which === 'first' ? opts : [...opts].reverse()
    const found = ordered.find((o) => !o.disabled)
    if (found) select(found.value, true)
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

  const geom = {
    sm: { pad: 'p-0.5', seg: 'px-3 py-1.5 text-xs', gap: 'gap-1.5', radius: 'rounded-lg', pill: 'rounded-md' },
    md: { pad: 'p-1', seg: 'px-4 py-2 text-sm', gap: 'gap-2', radius: 'rounded-xl', pill: 'rounded-lg' },
    lg: { pad: 'p-1.5', seg: 'px-5 py-2.5 text-base', gap: 'gap-2', radius: 'rounded-2xl', pill: 'rounded-xl' },
  }[size]

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative inline-flex ${geom.pad} ${geom.radius} border border-white/10 bg-white/[0.03] ${className}`}
    >
      {/* The single accent pill, sliding and sizing to the selected segment. */}
      {pill && (
        <motion.span
          aria-hidden
          className={`pointer-events-none absolute top-1 bottom-1 ${geom.pill} bg-[#DCF87C] shadow-[0_2px_12px_rgba(220,248,124,0.25)]`}
          initial={false}
          animate={{ left: pill.left, width: pill.width }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }
          }
        />
      )}

      <div className={`relative z-10 flex ${geom.gap}`}>
        {opts.map((o, i) => {
          const selected = o.value === value
          return (
            <button
              key={o.value}
              ref={(el) => {
                btnRefs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-labelledby={`${groupId}-${i}`}
              disabled={o.disabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => !o.disabled && select(o.value, true)}
              className={`relative inline-flex select-none items-center justify-center ${geom.seg} ${geom.pill} font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40 ${
                selected ? 'text-black' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {o.icon && (
                <span className="mr-1.5 inline-flex shrink-0" aria-hidden>
                  {o.icon}
                </span>
              )}
              <span id={`${groupId}-${i}`}>{o.label ?? o.value}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
