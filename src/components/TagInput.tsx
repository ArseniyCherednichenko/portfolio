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

// The controls family had the single-choice pair — the Select you open and the
// Combobox you type into — but never the field where the answer is *several*
// things at once: a token input. Tags, recipients, skills, filters — the
// interface where each committed value becomes a chip that sits in the field,
// and the caret keeps writing the next one right after it.
//
// It looks small and is not. The contract is the WAI-ARIA editable combobox
// again (a text input driving a filtered listbox through aria-activedescendant,
// a live region narrating the count and each add/remove), but wrapped around a
// second, harder interaction: a row of removable chips that shares one focus
// context with the input. Enter or comma commits the query; Backspace on an
// empty field reaches back and lifts the last chip; every value is trimmed and
// de-duplicated case-insensitively so the same tag never lands twice; an
// optional cap closes the field when it is full.
//
// The craft on top: each chip springs in from nothing and, on removal, folds
// out while the rest slide left to close the gap (a shared layout animation);
// the suggestion panel rises with a blur; a single lime highlight glides
// between suggestions instead of blinking. Reduced motion takes the spring, the
// layout slide, the blur, and the glide off for a plain, instant, equally
// usable field.

const EASE = [0.16, 1, 0.3, 1] as const

/** Case-insensitive subsequence test — "frmr" still finds "Framer Motion", so
 * a suggestion surfaces from a few scattered letters rather than a prefix. */
function subsequence(haystack: string, needle: string): boolean {
  if (!needle) return true
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  let i = 0
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) i++
  }
  return i === n.length
}

/** Fold a candidate tag to its comparison key, so "React" and "  react "
 * count as the same token regardless of case or surrounding space. */
const key = (s: string) => s.trim().toLowerCase()

/**
 * A hand-built, accessible tag / token input. Type and press Enter or comma to
 * commit a chip; Backspace on an empty field removes the last one; an optional
 * `suggestions` list drives an autocomplete panel (arrows, Home/End, Enter to
 * add, Escape to close). Controlled (`value` + `onChange`) or uncontrolled
 * (`defaultValue`). Under prefers-reduced-motion the chip spring, the layout
 * slide, the panel blur, and the gliding highlight all come off.
 */
export function TagInput({
  value: controlledValue,
  defaultValue,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag…',
  label,
  max,
  /** When false, only values present in `suggestions` can be added. */
  allowCustom = true,
  emptyLabel = 'No matches',
  disabled = false,
  className = '',
}: {
  value?: string[]
  defaultValue?: string[]
  onChange?: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  /** Optional visible label above the field; also the accessible name. */
  label?: string
  /** Cap on how many tags the field accepts. */
  max?: number
  allowCustom?: boolean
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
  const [uncontrolled, setUncontrolled] = useState<string[]>(defaultValue ?? [])
  const tags = isControlled ? controlledValue : uncontrolled

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Announced by the live region after an add or remove, so a screen reader
  // hears what changed rather than only the current count.
  const [announce, setAnnounce] = useState('')

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  const isFull = max !== undefined && tags.length >= max

  // Suggestions that aren't already chosen and match the current query. An
  // empty query shows every remaining suggestion, so opening a settled field
  // still offers the rest of the set.
  const chosen = useMemo(() => new Set(tags.map(key)), [tags])
  const matches = useMemo(() => {
    return suggestions.filter((s) => !chosen.has(key(s)) && subsequence(s, query.trim()))
  }, [suggestions, chosen, query])

  const showPanel = open && !isFull && matches.length > 0

  // Keep `active` inside the result set as it shrinks or grows under the cursor.
  useEffect(() => {
    setActive((a) => (a < matches.length ? a : 0))
  }, [matches.length])

  useEffect(() => {
    if (showPanel) optionRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [showPanel, active])

  const commitTags = useCallback(
    (next: string[]) => {
      if (!isControlled) setUncontrolled(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  const addTag = useCallback(
    (raw: string) => {
      const label = raw.trim()
      if (!label) return
      if (!allowCustom && !suggestions.some((s) => key(s) === key(label))) return
      if (isFull) return
      if (chosen.has(key(label))) {
        // Already present — clear the field and nudge the existing chip.
        setQuery('')
        setAnnounce(`${label} is already added`)
        return
      }
      // Prefer the suggestion's canonical casing over whatever was typed.
      const canonical = suggestions.find((s) => key(s) === key(label)) ?? label
      commitTags([...tags, canonical])
      setQuery('')
      setActive(0)
      setAnnounce(`Added ${canonical}. ${tags.length + 1} ${tags.length + 1 === 1 ? 'tag' : 'tags'}.`)
    },
    [allowCustom, suggestions, isFull, chosen, commitTags, tags],
  )

  const removeTag = useCallback(
    (index: number) => {
      const removed = tags[index]
      commitTags(tags.filter((_, i) => i !== index))
      setAnnounce(`Removed ${removed}. ${tags.length - 1} ${tags.length - 1 === 1 ? 'tag' : 'tags'}.`)
      inputRef.current?.focus()
    },
    [tags, commitTags],
  )

  const move = useCallback(
    (dir: 1 | -1, to?: number) => {
      const n = matches.length
      if (n === 0) return
      setActive((a) => {
        const from = to ?? a
        return (from + dir + n) % n
      })
    },
    [matches.length],
  )

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!showPanel) setOpen(true)
        else move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!showPanel) setOpen(true)
        else move(-1)
        break
      case 'Home':
        if (showPanel) {
          e.preventDefault()
          setActive(0)
        }
        break
      case 'End':
        if (showPanel) {
          e.preventDefault()
          setActive(matches.length - 1)
        }
        break
      case 'Enter':
        e.preventDefault()
        if (showPanel) addTag(matches[active])
        else addTag(query)
        break
      case ',':
        // Comma is a committing key, never a character in a tag.
        e.preventDefault()
        addTag(query)
        break
      case 'Backspace':
        if (query === '' && tags.length > 0) {
          e.preventDefault()
          removeTag(tags.length - 1)
        }
        break
      case 'Escape':
        if (showPanel) {
          e.preventDefault()
          setOpen(false)
        } else if (query) {
          e.preventDefault()
          setQuery('')
        }
        break
    }
  }

  // Close the panel on an outside pointer press.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const activeId = showPanel ? `${baseId}-opt-${active}` : undefined

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

      {/* The field: a chip row that shares one focus context with the caret.
          Clicking anywhere in the box lands focus on the input. */}
      <div
        onPointerDown={(e) => {
          // A pointer on the box (not on a chip's remove button) focuses input.
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.field) {
            e.preventDefault()
            inputRef.current?.focus()
          }
        }}
        data-field
        className={`flex min-h-[3.25rem] w-full flex-wrap items-center gap-1.5 rounded-2xl border bg-white/[0.03] px-2.5 py-2 text-sm transition-colors ${
          disabled
            ? 'cursor-not-allowed border-white/10 opacity-50'
            : 'cursor-text border-white/12 hover:border-white/20 focus-within:border-[#DCF87C]/60 focus-within:ring-2 focus-within:ring-[#DCF87C]/40'
        }`}
      >
        <ul className="contents" aria-label={label ? undefined : 'Selected tags'}>
          <AnimatePresence initial={false}>
            {tags.map((tag, i) => (
              <motion.li
                key={tag.toLowerCase()}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : { type: 'spring', stiffness: 640, damping: 34 }
                }
                className="flex items-center gap-1 rounded-full border border-[#DCF87C]/25 bg-[#DCF87C]/12 py-1 pl-3 pr-1.5 text-[#DCF87C]"
              >
                <span className="max-w-[12rem] truncate text-[0.82rem] font-medium leading-none">
                  {tag}
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                  onClick={() => removeTag(i)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[#DCF87C]/70 outline-none transition-colors hover:bg-[#DCF87C]/20 hover:text-[#DCF87C] focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
                >
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : placeholder}
          aria-describedby={statusId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled || isFull}
          value={query}
          placeholder={tags.length === 0 ? placeholder : isFull ? '' : ''}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-[6rem] flex-1 bg-transparent px-1.5 py-1 text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed"
        />
      </div>

      {/* Live region: narrates adds and removes, then the count. */}
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {announce ||
          (isFull
            ? `Tag limit reached, ${tags.length} of ${max}.`
            : `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'}.`)}
      </span>

      <AnimatePresence>
        {showPanel && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label={label ? `${label} suggestions` : 'Tag suggestions'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97, filter: 'blur(6px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' }}
            transition={reduce ? { duration: 0.12 } : { duration: 0.22, ease: EASE }}
            style={{ transformOrigin: 'top center' }}
            className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-white/12 bg-[#0E0E0E]/95 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            {matches.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-white/40">{emptyLabel}</li>
            )}
            {matches.map((s, i) => {
              const isActive = i === active
              return (
                <li
                  key={s}
                  ref={(el) => {
                    optionRefs.current[i] = el
                  }}
                  id={`${baseId}-opt-${i}`}
                  role="option"
                  aria-selected={isActive}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => {
                    addTag(s)
                    inputRef.current?.focus()
                  }}
                  className="relative flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5"
                >
                  {isActive && (
                    <motion.span
                      layoutId={reduce ? undefined : `${baseId}-hl`}
                      className="absolute inset-0 -z-10 rounded-xl bg-[#DCF87C]/12 ring-1 ring-inset ring-[#DCF87C]/25"
                      transition={{ type: 'spring', stiffness: 620, damping: 42 }}
                    />
                  )}
                  <span aria-hidden className="text-[#DCF87C]/70">
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span className={`text-sm ${isActive ? 'text-white' : 'text-white/75'}`}>{s}</span>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
