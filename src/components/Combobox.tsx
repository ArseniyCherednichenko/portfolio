import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

// The controls family had the select-only listbox, the one you open and pick
// from. It never had its editable twin: the combobox you *type into* to narrow
// a long list down to the one thing you meant. That is a different contract and
// a harder one — the WAI-ARIA editable-combobox pattern, where a real text
// input owns focus and drives a filtered listbox beneath it through
// aria-activedescendant, so a screen reader hears the count change and the
// active option as you type, while the keyboard gets the full run (arrows,
// Home/End, Enter, Escape, and Tab-to-complete the highlighted option).
//
// The craft on top of that contract: the list filters live on every keystroke,
// each result underlines the exact letters your query matched (a subsequence
// match, so "gmiddl" still finds "Graphite middleweight"), a single lime
// highlight *glides* between results on a shared layoutId rather than blinking,
// the panel springs open with a blur-and-rise, and a clear button folds in the
// moment there is text to clear. Reduced motion takes all of it off for a
// plain, instant, equally usable field.

export type ComboOption = {
  value: string
  label: string
  /** Optional muted second line under the label. */
  hint?: string
  disabled?: boolean
}

const EASE = [0.16, 1, 0.3, 1] as const

/** A single subsequence match: the option plus the indices of the label
 * characters that the query matched, so the view can underline exactly those.
 * `score` is lower-is-better — earlier, tighter matches rank first. */
type Match = { option: ComboOption; index: number; hits: number[]; score: number }

/**
 * Case-insensitive subsequence match. Returns the matched character indices and
 * a score (lower = better: rewards matches that start early and stay contiguous)
 * or `null` when the query's letters don't appear in order. An empty query
 * matches everything with a neutral score, preserving source order.
 */
function fuzzyMatch(label: string, query: string): { hits: number[]; score: number } | null {
  if (!query) return { hits: [], score: 0 }
  const l = label.toLowerCase()
  const q = query.toLowerCase()
  const hits: number[] = []
  let qi = 0
  let score = 0
  let last = -1
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) {
      hits.push(i)
      // Penalise gaps between consecutive matched letters, and reward a match
      // that begins at the very start of the label.
      score += last === -1 ? i : i - last - 1
      last = i
      qi++
    }
  }
  return qi === q.length ? { hits, score } : null
}

/** Split a label into runs, marking which characters were matched by `hits`
 * (a sorted list of indices) so the view can wrap just those in a highlight. */
function highlightRuns(label: string, hits: number[]): { text: string; on: boolean }[] {
  if (hits.length === 0) return [{ text: label, on: false }]
  const set = new Set(hits)
  const runs: { text: string; on: boolean }[] = []
  let buf = ''
  let on = set.has(0)
  for (let i = 0; i < label.length; i++) {
    const here = set.has(i)
    if (here !== on) {
      runs.push({ text: buf, on })
      buf = ''
      on = here
    }
    buf += label[i]
  }
  if (buf) runs.push({ text: buf, on })
  return runs
}

/**
 * A hand-built, accessible combobox (editable autocomplete). Type to filter the
 * list; arrows and Home/End move the highlight, Enter or Tab completes the
 * highlighted option, Escape clears or closes. Controlled (`value` + `onChange`,
 * where value is an option `value`) or uncontrolled (`defaultValue`). Under
 * prefers-reduced-motion the spring, blur, and gliding highlight all come off.
 */
export function Combobox({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = 'Search…',
  label,
  emptyLabel = 'No matches',
  disabled = false,
  className = '',
}: {
  options: ComboOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  /** Optional visible label above the input; also the accessible name. */
  label?: string
  /** Shown inside the panel when the query matches nothing. */
  emptyLabel?: string
  disabled?: boolean
  className?: string
}): ReactNode {
  const reduce = useReducedMotion()
  const baseId = useId()
  const listId = `${baseId}-list`
  const labelId = `${baseId}-label`
  const statusId = `${baseId}-status`

  const isControlled = controlledValue !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '')
  const value = isControlled ? controlledValue : uncontrolled

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  )

  // The text in the field. Seeded from the selected option's label; when a
  // value is chosen the query holds its label, and typing reopens filtering.
  const [query, setQuery] = useState(selectedOption?.label ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // True once the user edits the field, so we filter by the query. Choosing an
  // option or closing resets it, so reopening a settled field shows everything.
  const [typing, setTyping] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  // Keep the field's text in sync when the selected value changes from outside.
  useEffect(() => {
    if (!open) setQuery(selectedOption?.label ?? '')
  }, [selectedOption, open])

  // The filtered, ranked result set. While not actively typing (e.g. just
  // opened on a settled value) we show every option in source order.
  const matches = useMemo<Match[]>(() => {
    const effective = typing ? query : ''
    const out: Match[] = []
    options.forEach((option, index) => {
      const m = fuzzyMatch(option.label, effective)
      if (m) out.push({ option, index, hits: m.hits, score: m.score })
    })
    // Stable sort by score, then by original order.
    return out
      .map((m, i) => ({ m, i }))
      .sort((a, b) => a.m.score - b.m.score || a.i - b.i)
      .map(({ m }) => m)
  }, [options, query, typing])

  const firstEnabled = useMemo(
    () => matches.findIndex((m) => !m.option.disabled),
    [matches],
  )

  // Keep `active` valid as the result set shrinks or grows under the cursor.
  useEffect(() => {
    if (matches.length === 0) {
      setActive(0)
      return
    }
    setActive((a) => {
      if (a < matches.length && !matches[a].option.disabled) return a
      return Math.max(firstEnabled, 0)
    })
  }, [matches, firstEnabled])

  const move = useCallback(
    (dir: 1 | -1, from?: number) => {
      const n = matches.length
      if (n === 0) return
      let i = from ?? active
      for (let step = 0; step < n; step++) {
        i = (i + dir + n) % n
        if (!matches[i].option.disabled) {
          setActive(i)
          return
        }
      }
    },
    [matches, active],
  )

  const commit = useCallback(
    (index: number) => {
      const match = matches[index]
      if (!match || match.option.disabled) return
      if (!isControlled) setUncontrolled(match.option.value)
      onChange?.(match.option.value)
      setQuery(match.option.label)
      setTyping(false)
      setOpen(false)
      inputRef.current?.focus()
    },
    [matches, isControlled, onChange],
  )

  const openMenu = useCallback(() => {
    if (disabled) return
    setTyping(false)
    setOpen(true)
  }, [disabled])

  const clear = useCallback(() => {
    if (!isControlled) setUncontrolled('')
    onChange?.('')
    setQuery('')
    setTyping(true)
    setOpen(true)
    inputRef.current?.focus()
  }, [isControlled, onChange])

  // Close on outside pointer; restore the field text to the settled value.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setTyping(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) optionRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) {
          openMenu()
        } else {
          move(1)
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) openMenu()
        else move(-1)
        break
      case 'Home':
        if (open) {
          e.preventDefault()
          move(1, -1)
        }
        break
      case 'End':
        if (open) {
          e.preventDefault()
          move(-1, 0)
        }
        break
      case 'Enter':
        if (open && matches.length > 0) {
          e.preventDefault()
          commit(active)
        }
        break
      case 'Tab':
        // Complete the highlighted option on the way out, if the field is open.
        if (open && matches.length > 0 && typing) commit(active)
        else setOpen(false)
        break
      case 'Escape':
        if (open) {
          e.preventDefault()
          setOpen(false)
          setTyping(false)
          setQuery(selectedOption?.label ?? '')
        } else if (query) {
          e.preventDefault()
          clear()
        }
        break
    }
  }

  const activeId =
    open && matches.length > 0 ? `${baseId}-opt-${active}` : undefined

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label
          id={labelId}
          htmlFor={`${baseId}-input`}
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/45"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>

        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : placeholder}
          aria-describedby={statusId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setTyping(true)
            setOpen(true)
          }}
          onFocus={() => openMenu()}
          onClick={() => openMenu()}
          onKeyDown={onKeyDown}
          className="w-full rounded-2xl border border-white/12 bg-white/[0.03] py-3 pl-11 pr-10 text-sm text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/20 focus-visible:border-[#DCF87C]/60 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40 disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:border-[#DCF87C]/50"
        />

        <AnimatePresence>
          {query && !disabled && (
            <motion.button
              type="button"
              aria-label="Clear"
              onClick={clear}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              transition={reduce ? { duration: 0.12 } : { duration: 0.18, ease: EASE }}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/45 outline-none transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40"
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Live region: announces how many options the current query leaves. */}
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {open
          ? matches.length === 0
            ? emptyLabel
            : `${matches.length} ${matches.length === 1 ? 'result' : 'results'}`
          : ''}
      </span>

      <AnimatePresence>
        {open && (
          <motion.ul
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
            {matches.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-white/40">{emptyLabel}</li>
            )}
            {matches.map((match, i) => {
              const opt = match.option
              const isActive = i === active
              const isSelected = opt.value === value
              const runs = highlightRuns(opt.label, match.hits)
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
                    <span className={`block truncate text-sm ${isActive ? 'text-white' : 'text-white/75'}`}>
                      {runs.map((run, ri) =>
                        run.on ? (
                          <span key={ri} className="rounded-[3px] bg-[#DCF87C]/20 font-medium text-[#DCF87C]">
                            {run.text}
                          </span>
                        ) : (
                          <span key={ri}>{run.text}</span>
                        ),
                      )}
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
