import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'

// Another entry in the controls family's long quarrel with the platform: HTML
// gives you a label that cannot be changed and an input that is always open,
// but never the thing every settings screen, table cell, and profile field
// actually needs — a value that reads as plain text until you click it, turns
// into a field, and settles back to text once you are done. Products rebuild
// this constantly and most of them get the hard parts wrong.
//
// The hard parts a lazy version skips:
//
//  (1) The round trip and its focus. Clicking the value (or pressing Enter/F2
//      on it) swaps in an input that mounts already focused with its text
//      selected, so you can retype immediately; Escape reverts the draft and
//      returns focus to the trigger; Enter and blur both commit. Focus never
//      falls to the body between the two states.
//
//  (2) The width. The field is exactly as wide as its text, measured off a
//      hidden mirror that carries the same font, so entering edit mode does not
//      blow a short name out to a full-width box, and the field grows as you
//      type rather than scrolling its own content out of view.
//
//  (3) The save that might not land. A real inline edit is optimistic: it shows
//      the new value at once and saves in the background. So this commits
//      immediately, runs onCommit, and — if that rejects — rolls the value
//      back to what it was, shakes, and says so assertively. An inline edit
//      that cannot survive a failed save is a demo, not a control.
//
// Reduced motion keeps every one of those behaviours and drops only their
// motion: the width snaps, the save underline and the shake disappear, and the
// swap between text and field is instant and just as usable.

const SAVE_SWEEP_MS = 520

type Phase = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

export interface InlineEditProps {
  /** The current value shown when idle. */
  value: string
  /**
   * Commit handler. May be async; if it rejects (or throws), the value rolls
   * back to its previous committed state and the control reports the failure.
   * Return nothing / a resolved promise to accept the edit.
   */
  onCommit?: (value: string) => void | Promise<void>
  /** Accessible name for the field and its trigger, e.g. "Display name". */
  label: string
  /** Shown in the field, and as the idle value, when the value is empty. */
  placeholder?: string
  /** Reject a blank commit and keep editing. Default true. */
  required?: boolean
  /** Cap the input length. */
  maxLength?: number
  className?: string
}

/**
 * A click-to-edit field: a value that reads as text until you edit it in place.
 *
 * Click the value or press Enter/F2 to edit; Enter or blur commits, Escape
 * reverts. The field auto-sizes to its text, commits optimistically, and rolls
 * back on a rejected `onCommit`. A real `<button>` trigger and labelled input,
 * with polite/assertive live regions. Under prefers-reduced-motion the width,
 * the save sweep, and the error shake drop while every behaviour stays.
 */
export function InlineEdit({
  value,
  onCommit,
  label,
  placeholder = 'Empty',
  required = true,
  maxLength,
  className = '',
}: InlineEditProps) {
  const reduce = useReducedMotion()
  const [committed, setCommitted] = useState(value)
  const [draft, setDraft] = useState(value)
  const [phase, setPhase] = useState<Phase>('idle')
  const [invalid, setInvalid] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [error, setError] = useState('')

  // Width is measured off a hidden mirror so the field is exactly its text wide.
  const [width, setWidth] = useState<number>()
  const mirrorRef = useRef<HTMLSpanElement>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Set when Escape cancels, so the blur it triggers does not also commit.
  const cancellingRef = useRef(false)
  // Set when we leave edit mode by the user's own action, so focus returns to
  // the trigger (and not when the component simply re-renders).
  const refocusRef = useRef(false)
  const savedTimer = useRef<number | null>(null)

  const editing = phase === 'editing'
  const saving = phase === 'saving'

  // If the owner pushes a new value in while we are idle, follow it.
  useEffect(() => {
    if (phase === 'idle') setCommitted(value)
  }, [value, phase])

  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    },
    [],
  )

  const shake = useAnimationControls()

  // Measure the mirror whenever the text it carries changes. The mirror renders
  // the live draft while editing, otherwise the committed value or placeholder.
  const measureText = editing ? draft || placeholder : committed || placeholder
  useLayoutEffect(() => {
    const el = mirrorRef.current
    if (!el) return
    // A little slack past the glyphs so the caret and a trailing space have room.
    setWidth(Math.ceil(el.offsetWidth) + 4)
  }, [measureText, editing])

  const beginEdit = useCallback(() => {
    if (phase === 'saving') return
    setDraft(committed)
    setInvalid(false)
    setError('')
    setPhase('editing')
  }, [committed, phase])

  // Focus the input and select its text the moment it mounts.
  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  // After an edit resolves by the user's action, hand focus back to the value.
  useEffect(() => {
    if (!editing && refocusRef.current) {
      refocusRef.current = false
      triggerRef.current?.focus()
    }
  }, [editing])

  const runSave = useCallback(
    (next: string, prev: string) => {
      setPhase('saving')
      Promise.resolve()
        .then(() => onCommit?.(next))
        .then(() => {
          setPhase('saved')
          setAnnounce(`${label} saved: ${next || 'empty'}`)
          if (savedTimer.current) window.clearTimeout(savedTimer.current)
          savedTimer.current = window.setTimeout(() => setPhase('idle'), 900)
        })
        .catch(() => {
          // Roll the optimistic value back and report it.
          setCommitted(prev)
          setPhase('error')
          setError("Couldn't save — reverted")
          setAnnounce(`${label} could not be saved. Reverted to ${prev || 'empty'}.`)
          if (!reduce) shake.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } })
          if (savedTimer.current) window.clearTimeout(savedTimer.current)
          savedTimer.current = window.setTimeout(() => setPhase('idle'), 1400)
        })
    },
    [label, onCommit, reduce, shake],
  )

  // Commit the current draft. Rejects a blank value when required (and keeps
  // editing); a no-op change just closes; otherwise commits optimistically.
  const commit = useCallback(() => {
    const next = draft.trim()
    if (required && next === '') {
      setInvalid(true)
      inputRef.current?.focus()
      return
    }
    if (next === committed) {
      refocusRef.current = true
      setPhase('idle')
      return
    }
    const prev = committed
    setCommitted(next)
    refocusRef.current = true
    runSave(next, prev)
  }, [committed, draft, required, runSave])

  const cancel = useCallback(() => {
    cancellingRef.current = true
    setInvalid(false)
    setDraft(committed)
    refocusRef.current = true
    setPhase('idle')
    // Clear the guard after the blur it causes has flushed.
    window.setTimeout(() => {
      cancellingRef.current = false
    }, 0)
  }, [committed])

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  function onTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    // F2 is the long-standing "rename / edit in place" key; Enter/Space open too.
    if (e.key === 'F2' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      beginEdit()
    }
  }

  const showValue = committed || placeholder
  const isPlaceholder = committed === ''

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <motion.div
        animate={shake}
        className="relative inline-flex items-center"
        style={{ minHeight: 40 }}
      >
        {/* The width morph wraps whichever control is live; measured off the
            mirror so edit mode is the text's width, not a full box. */}
        <motion.div
          className="relative"
          animate={{ width }}
          transition={reduce || width == null ? { duration: 0 } : { type: 'spring', stiffness: 560, damping: 42 }}
          style={{ width }}
        >
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              aria-label={label}
              aria-invalid={invalid || undefined}
              value={draft}
              maxLength={maxLength}
              placeholder={placeholder}
              onChange={(e) => {
                setDraft(e.target.value)
                if (invalid) setInvalid(false)
              }}
              onKeyDown={onInputKeyDown}
              onBlur={() => {
                if (cancellingRef.current) return
                commit()
              }}
              className={`w-full rounded-lg border bg-white/[0.04] px-2.5 py-2 text-base font-medium text-white outline-none transition-colors placeholder:text-white/30 ${
                invalid
                  ? 'border-red-400/70 focus-visible:border-red-400'
                  : 'border-[#DCF87C]/60 focus-visible:border-[#DCF87C]'
              }`}
            />
          ) : (
            <button
              ref={triggerRef}
              type="button"
              onClick={beginEdit}
              onKeyDown={onTriggerKeyDown}
              disabled={saving}
              aria-label={`Edit ${label}: ${committed || 'empty'}`}
              className={`group flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-base font-medium outline-none transition-colors hover:border-white/15 hover:bg-white/[0.03] focus-visible:border-[#DCF87C]/50 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40 ${
                isPlaceholder ? 'text-white/35 italic' : 'text-white/90'
              } ${saving ? 'cursor-default opacity-70' : 'cursor-text'}`}
            >
              <span className="truncate">{showValue}</span>
              {/* A quiet pencil that warms on hover/focus, the only affordance
                  that this plain-looking text is editable. */}
              <PencilIcon className="ml-auto shrink-0 text-white/25 transition-colors group-hover:text-[#DCF87C]/80 group-focus-visible:text-[#DCF87C]/80" />
            </button>
          )}

          {/* The save underline — a lime sweep under the field while onCommit
              runs, so an optimistic value reads as in-flight, not already safe. */}
          {saving && !reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-x-1 bottom-0 h-0.5 origin-left rounded-full bg-[#DCF87C]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: SAVE_SWEEP_MS / 1000, ease: 'easeInOut' }}
            />
          )}
        </motion.div>

        {/* A check that fades in on a landed save, and clears itself. */}
        {phase === 'saved' && (
          <motion.span
            aria-hidden
            className="ml-2 text-[#DCF87C]"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <CheckIcon />
          </motion.span>
        )}
      </motion.div>

      {/* The one hint line, doubling as the inline validation and error channel.
          It never reflows the control — it sits below it. */}
      <span
        className={`pl-1 text-xs ${
          invalid || phase === 'error' ? 'text-red-300/90' : 'text-white/35'
        }`}
      >
        {invalid
          ? `${label} can't be empty`
          : phase === 'error'
            ? error
            : editing
              ? 'Enter to save, Esc to cancel'
              : saving
                ? 'Saving…'
                : 'Click to edit'}
      </span>

      {/* Hidden mirror the width is measured from — same font and padding as the
          live controls, so a measured width matches the rendered one. */}
      <span
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-pre px-2.5 text-base font-medium"
        style={{ left: -9999, top: -9999 }}
      >
        {measureText}
      </span>

      {/* Saved announcements are polite; a failed save and its rollback are
          assertive, because a value quietly reverting is exactly the thing a
          non-sighted user must not miss. */}
      <span className="sr-only" aria-live="polite">
        {phase === 'saved' ? announce : ''}
      </span>
      <span className="sr-only" aria-live="assertive">
        {phase === 'error' ? announce : ''}
      </span>
    </div>
  )
}

function PencilIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.5 7.5l3 3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  const reduce = useReducedMotion()
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
      />
    </svg>
  )
}
