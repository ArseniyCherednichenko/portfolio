import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// The "type & text" family had the single-choice select you open (Select), the
// field you type into to narrow one answer (Combobox), and the field that holds
// several answers at once as chips (TagInput). The one inline-composition
// pattern it never carried is the one every chat, comment box and editor ships:
// the @-mention. You are writing prose, you type "@", and a popover of names
// rises *at the caret* — not pinned to the field, but to the exact glyph you are
// typing — and an arrow-and-Enter pick drops the handle into the sentence and
// hands the caret straight back so the thought keeps flowing.
//
// Two pieces of craft separate this from a plain dropdown. The first is the
// trigger: there is no button. The field watches the word under the caret, and
// a mention is "active" only when an "@" sits at a word boundary with an
// unbroken run of mention characters between it and the caret — so "email@host"
// never triggers, and a space closes it. The second, and the real work, is
// anchoring the popover to the caret inside a <textarea>, which exposes no caret
// rectangle at all. A hidden mirror div copies the field's box and type metrics,
// takes the text up to the caret plus a zero-width marker, and the marker's
// offset is read back as the caret's pixel position — so the panel tracks the
// caret through wraps, scrolls and resizes the way it does in a real editor.
//
// Honest and reachable throughout: a real labelled <textarea> you can type in
// with or without ever opening the popover, WAI-ARIA combobox semantics (the
// field owns the listbox through aria-controls and points at the active option
// with aria-activedescendant), and a polite live region that narrates how many
// handles match and which one landed. Under prefers-reduced-motion the panel's
// rise and blur and the gliding highlight all come off for a plain, instant,
// equally usable field.

const EASE = [0.16, 1, 0.3, 1] as const

/** One mentionable handle. `label` is what lands in the text (after the "@");
 * `hint` is the muted second line in the popover; `to` is an optional route the
 * host can link a committed mention to. */
export interface MentionOption {
  id: string
  label: string
  hint?: string
  to?: string
}

/** Case-insensitive subsequence test — "pgd" still finds "Playground", so a
 * handle surfaces from a few scattered letters rather than a strict prefix. */
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

// The characters a handle query may contain once "@" has opened it. Letters,
// digits, and the few joiners a label can carry; anything else (a space, a
// newline, punctuation) ends the run and closes the popover.
const MENTION_CHAR = /[\w.-]/

interface ActiveQuery {
  /** Index of the triggering "@" in the value. */
  at: number
  /** The text typed after it, up to the caret. */
  query: string
}

/**
 * Read the mention query currently under the caret, or null if none is active.
 * A query is active when an "@" sits at the start of the value or right after
 * whitespace, and every character from it up to the caret is a mention char.
 */
function activeQueryAt(value: string, caret: number): ActiveQuery | null {
  let i = caret - 1
  // Walk back over the run of mention characters.
  while (i >= 0 && MENTION_CHAR.test(value[i])) i--
  // The char that stopped the walk must be the trigger.
  if (i < 0 || value[i] !== '@') return null
  // The "@" itself must open a word — be first, or follow whitespace.
  const before = i === 0 ? '' : value[i - 1]
  if (before && !/\s/.test(before)) return null
  return { at: i, query: value.slice(i + 1, caret) }
}

// The computed-style properties the mirror div must copy so its text wraps and
// sizes exactly like the textarea's — otherwise the measured caret drifts.
const MIRROR_PROPS = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'tabSize',
] as const

/** Pixel position of the caret (relative to the textarea's padding box, already
 * corrected for scroll) via a throwaway mirror div. Returns top/left/line-height
 * so a popover can sit just under the caret's line. */
function caretCoordinates(
  textarea: HTMLTextAreaElement,
  caret: number,
): { top: number; left: number; height: number } {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const ms = mirror.style
  ms.position = 'absolute'
  ms.visibility = 'hidden'
  ms.whiteSpace = 'pre-wrap'
  ms.overflowWrap = 'break-word'
  ms.top = '0'
  ms.left = '0'
  const msRecord = ms as unknown as Record<string, string>
  const styleRecord = style as unknown as Record<string, string>
  for (const prop of MIRROR_PROPS) {
    msRecord[prop] = styleRecord[prop]
  }
  mirror.textContent = textarea.value.slice(0, caret)
  const marker = document.createElement('span')
  // A zero-width-space so the span has a box even at a line start.
  marker.textContent = '​'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const top = marker.offsetTop - textarea.scrollTop
  const left = marker.offsetLeft - textarea.scrollLeft
  const height = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3
  document.body.removeChild(mirror)
  return { top, left, height }
}

export interface MentionsProps {
  options: MentionOption[]
  /** Accessible label for the textarea (visually hidden). */
  label?: string
  placeholder?: string
  rows?: number
  /** Fired when a handle is committed into the text. */
  onMention?: (option: MentionOption) => void
  className?: string
}

/**
 * A hand-built, accessible @-mention textarea. Type freely; an "@" at a word
 * boundary opens a caret-anchored popover of matching handles. Arrows move the
 * selection, Enter or Tab commits it into the sentence, Escape closes the
 * popover without leaving the field. WAI-ARIA combobox semantics throughout;
 * under prefers-reduced-motion the popover's motion is dropped.
 */
export function Mentions({
  options,
  label = 'Write a note, type @ to mention',
  placeholder = 'Write something, and type @ to mention a page...',
  rows = 3,
  onMention,
  className = '',
}: MentionsProps) {
  const reduce = useReducedMotion()
  const uid = useId()
  const listId = `${uid}-list`
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const liveRef = useRef<HTMLSpanElement | null>(null)

  const [value, setValue] = useState('')
  const [active, setActive] = useState<ActiveQuery | null>(null)
  const [index, setIndex] = useState(0)
  const [coords, setCoords] = useState<{ top: number; left: number; height: number } | null>(null)
  // Caret we must restore after a programmatic insert (state updates are async,
  // so the DOM caret is set in a layout effect once the new value is painted).
  const pendingCaret = useRef<number | null>(null)

  const matches = useMemo(() => {
    if (!active) return []
    return options.filter((o) => subsequence(o.label, active.query)).slice(0, 6)
  }, [active, options])

  const open = active !== null && matches.length > 0

  // Recompute the active query and, if open, the caret anchor for the popover.
  const sync = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    const caret = ta.selectionStart ?? ta.value.length
    const next = activeQueryAt(ta.value, caret)
    setActive(next)
    if (next) setCoords(caretCoordinates(ta, caret))
  }, [])

  // Reset the highlighted option (and announce the count) whenever the match set
  // changes, so the first result is always the default pick.
  useEffect(() => {
    setIndex(0)
    if (liveRef.current) {
      liveRef.current.textContent = open
        ? `${matches.length} ${matches.length === 1 ? 'handle' : 'handles'} available`
        : ''
    }
  }, [active?.query, matches.length, open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore the caret after a programmatic value change (an insert).
  useLayoutEffect(() => {
    if (pendingCaret.current != null && taRef.current) {
      const pos = pendingCaret.current
      pendingCaret.current = null
      taRef.current.setSelectionRange(pos, pos)
      taRef.current.focus()
      sync()
    }
  }, [value, sync])

  const commit = useCallback(
    (option: MentionOption) => {
      const ta = taRef.current
      if (!ta || !active) return
      const caret = ta.selectionStart ?? ta.value.length
      const before = value.slice(0, active.at)
      const after = value.slice(caret)
      const inserted = `@${option.label} `
      const nextValue = before + inserted + after
      pendingCaret.current = before.length + inserted.length
      setValue(nextValue)
      setActive(null)
      onMention?.(option)
      if (liveRef.current) liveRef.current.textContent = `Mentioned ${option.label}`
    },
    [active, value, onMention],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!open) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setIndex((i) => (i + 1) % matches.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setIndex((i) => (i - 1 + matches.length) % matches.length)
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          commit(matches[index])
          break
        case 'Escape':
          e.preventDefault()
          setActive(null)
          break
        default:
          break
      }
    },
    [open, matches, index, commit],
  )

  const activeId = open ? `${uid}-opt-${matches[index]?.id}` : undefined

  return (
    <div className={`relative w-full max-w-lg ${className}`}>
      <label htmlFor={`${uid}-ta`} className="sr-only">
        {label}
      </label>
      <textarea
        id={`${uid}-ta`}
        ref={taRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value)
          // Defer to let the caret settle, then read the query at it.
          requestAnimationFrame(sync)
        }}
        onKeyDown={onKeyDown}
        onClick={sync}
        onKeyUp={(e) => {
          // Caret-moving keys that aren't the popover's own navigation.
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) sync()
        }}
        onScroll={() => active && sync()}
        onBlur={() => {
          // Let a click on an option land before the popover unmounts.
          window.setTimeout(() => setActive(null), 120)
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-sans text-[0.95rem] leading-relaxed text-white/90 placeholder:text-white/30 focus:border-[#DCF87C]/40 focus:outline-none focus:ring-2 focus:ring-[#DCF87C]/20"
      />

      {/* Caret-anchored popover. Positioned a line below the measured caret and
          clamped to the field's left edge so it never bleeds off the box. */}
      <AnimatePresence>
        {open && coords && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label="Mentionable handles"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(6px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(6px)' }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: EASE }}
            style={{
              top: coords.top + coords.height + 8,
              left: Math.max(0, Math.min(coords.left, 220)),
            }}
            className="absolute z-20 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#101010]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            {matches.map((o, i) => {
              const selected = i === index
              return (
                <li
                  key={o.id}
                  id={`${uid}-opt-${o.id}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setIndex(i)}
                  // onMouseDown (not click) so it fires before the textarea blur.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    commit(o)
                  }}
                  className="relative cursor-pointer rounded-xl px-3 py-2"
                >
                  {selected && (
                    <motion.span
                      layoutId={reduce ? undefined : `${uid}-mention-hl`}
                      className="absolute inset-0 -z-10 rounded-xl bg-[#DCF87C]/[0.12] ring-1 ring-inset ring-[#DCF87C]/25"
                      transition={{ duration: 0.18, ease: EASE }}
                    />
                  )}
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-medium text-[#DCF87C]/90">@</span>
                    <span className="truncate text-sm font-medium text-white/90">{o.label}</span>
                  </span>
                  {o.hint && (
                    <span className="mt-0.5 block truncate text-xs text-white/40">{o.hint}</span>
                  )}
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Polite narration of the match count and each committed handle. */}
      <span ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  )
}

export default Mentions
