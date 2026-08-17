import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// The controls family had inputs you touch — a slider, a rotary knob, a stepper,
// a toggle, a code field — but not the one every real form leans on: a select.
// The native <select> can't be styled or animated past its box, so a portfolio
// that lives by motion needs a hand-built one. This is a real accessible listbox
// (the WAI-ARIA "select-only combobox" pattern): the trigger keeps focus and
// drives a floating list through aria-activedescendant, so keyboard and screen
// reader users get the full contract — arrows, Home/End, Enter/Space, Escape,
// type-ahead — while the visible craft is the motion. The panel springs open
// with a small blur-and-rise, a single lime highlight *glides* between options on
// a shared layoutId rather than blinking, the chevron rotates, and the chosen
// option carries a check. It is a deliberate turn from the recent run of
// generative canvas fields back to product-grade interface craft.

export type SelectOption = {
  value: string
  label: string
  /** Optional muted second line under the label. */
  hint?: string
  disabled?: boolean
}

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * A hand-built, accessible select. Click it or focus it and press Enter / Space
 * / ArrowDown to open; arrows and Home/End move the highlight, type a letter or
 * two to jump, Enter/Space chooses, Escape closes. Controlled (`value` +
 * `onChange`) or uncontrolled (`defaultValue`). Under prefers-reduced-motion the
 * spring, blur, and gliding highlight all come off for a plain, instant menu.
 */
export function Select({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = 'Select…',
  label,
  disabled = false,
  className = '',
}: {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  /** Optional visible label above the trigger; also the accessible name. */
  label?: string
  disabled?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const baseId = useId()
  const listId = `${baseId}-list`
  const labelId = `${baseId}-label`

  const isControlled = controlledValue !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '')
  const value = isControlled ? controlledValue : uncontrolled

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])
  const typeBuffer = useRef('')
  const typeTimer = useRef<number | undefined>(undefined)

  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  )
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const firstEnabled = useMemo(() => options.findIndex((o) => !o.disabled), [options])

  // Move the highlight to a given index, skipping disabled entries in `dir`.
  const moveActive = useCallback(
    (target: number, dir: 1 | -1) => {
      const n = options.length
      if (n === 0) return
      let i = ((target % n) + n) % n
      for (let step = 0; step < n; step++) {
        if (!options[i].disabled) {
          setActive(i)
          return
        }
        i = ((i + dir) % n + n) % n
      }
    },
    [options],
  )

  const commit = useCallback(
    (index: number) => {
      const opt = options[index]
      if (!opt || opt.disabled) return
      if (!isControlled) setUncontrolled(opt.value)
      onChange?.(opt.value)
      setOpen(false)
      buttonRef.current?.focus()
    },
    [options, isControlled, onChange],
  )

  const openMenu = useCallback(() => {
    if (disabled) return
    setActive(selectedIndex >= 0 ? selectedIndex : Math.max(firstEnabled, 0))
    setOpen(true)
  }, [disabled, selectedIndex, firstEnabled])

  // Close on outside pointer and on Escape reaching the document (belt-and-braces).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Keep the active option scrolled into view while paging with the keyboard.
  useEffect(() => {
    if (!open) return
    optionRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  useEffect(() => () => window.clearTimeout(typeTimer.current), [])

  // Type-ahead: accumulate printable keys for ~700ms and jump to the first option
  // whose label starts with the buffer (fallback: any label containing it).
  const typeAhead = useCallback(
    (char: string) => {
      window.clearTimeout(typeTimer.current)
      typeBuffer.current += char.toLowerCase()
      const buf = typeBuffer.current
      const starts = options.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(buf),
      )
      const idx =
        starts >= 0
          ? starts
          : options.findIndex((o) => !o.disabled && o.label.toLowerCase().includes(buf))
      if (idx >= 0) {
        setActive(idx)
        if (!open) commit(idx)
      }
      typeTimer.current = window.setTimeout(() => {
        typeBuffer.current = ''
      }, 700)
    },
    [options, open, commit],
  )

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    const key = e.key
    if (!open) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault()
        openMenu()
        return
      }
      if (key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        typeAhead(key)
      }
      return
    }
    switch (key) {
      case 'ArrowDown':
        e.preventDefault()
        moveActive(active + 1, 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveActive(active - 1, -1)
        break
      case 'Home':
        e.preventDefault()
        moveActive(0, 1)
        break
      case 'End':
        e.preventDefault()
        moveActive(options.length - 1, -1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        commit(active)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          typeAhead(key)
        }
    }
  }

  const activeId = open ? `${baseId}-opt-${active}` : undefined

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <span
          id={labelId}
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/45"
        >
          {label}
        </span>
      )}

      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : placeholder}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3 text-left outline-none transition-colors hover:border-white/20 focus-visible:border-[#DCF87C]/60 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40 disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:border-[#DCF87C]/50"
      >
        <span className={`truncate text-sm ${selected ? 'text-white' : 'text-white/40'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <motion.svg
          viewBox="0 0 24 24"
          width={16}
          height={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-white/45"
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97, filter: 'blur(6px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' }}
            transition={reduce ? { duration: 0.12 } : { duration: 0.24, ease: EASE }}
            style={{ transformOrigin: 'top center' }}
            className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-white/12 bg-[#0E0E0E]/95 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            {options.map((opt, i) => {
              const isActive = i === active
              const isSelected = i === selectedIndex
              return (
                <li
                  key={opt.value}
                  ref={(el) => {
                    optionRefs.current[i] = el
                  }}
                  id={`${baseId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  onPointerEnter={() => !opt.disabled && setActive(i)}
                  onClick={() => commit(i)}
                  className={`relative flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                    opt.disabled ? 'cursor-not-allowed opacity-40' : ''
                  }`}
                >
                  {isActive && !opt.disabled && (
                    <motion.span
                      layoutId={reduce ? undefined : `${baseId}-hl`}
                      className="absolute inset-0 -z-10 rounded-xl bg-[#DCF87C]/12 ring-1 ring-inset ring-[#DCF87C]/25"
                      transition={{ type: 'spring', stiffness: 620, damping: 42 }}
                    />
                  )}
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm ${
                        isActive ? 'text-white' : 'text-white/75'
                      }`}
                    >
                      {opt.label}
                    </span>
                    {opt.hint && (
                      <span className="mt-0.5 block truncate text-xs text-white/40">{opt.hint}</span>
                    )}
                  </span>
                  <motion.svg
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-[#DCF87C]"
                    initial={false}
                    animate={{ opacity: isSelected ? 1 : 0, scale: isSelected ? 1 : 0.6 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }}
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </motion.svg>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
