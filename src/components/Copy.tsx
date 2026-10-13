import { type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCopied } from '../lib/clipboard'

const EASE = [0.16, 1, 0.3, 1] as const

interface CopyProps {
  /** The string written to the clipboard on press. */
  value: string
  /** The resting label. Omitted when `showLabel` is false. */
  label?: string
  /** The label shown while the copied flag is up. */
  copiedLabel?: string
  /** Hide the text and show only the morphing glyph (for tight rows). */
  showLabel?: boolean
  /** Override the full aria-label — useful when `value` is a long paragraph and
   * reading the whole thing back would be noise. */
  srLabel?: string
  /** Called after each press with whether the write landed, so a caller can
   * still raise a toast or a fallback hint. */
  onCopied?: (ok: boolean) => void
  /** How long the copied flag stays up, in ms. */
  resetMs?: number
  /** Stroke colour of the success check. Defaults to the house lime, which pops
   * on the dark ghost button; pass `currentColor` (or any value) when the
   * button sits on a coloured ground where lime would vanish. */
  checkColor?: string
  className?: string
}

// Copy — the site's one reusable copy-to-clipboard button. A small glyph morphs
// from a clipboard to a checkmark that *draws itself* on success (stroke
// pathLength 0 -> 1), the quiet, satisfying confirmation the hand-rolled "Copy"
// / "Copied" text swaps never had. Built on the shared `useCopied` hook, so its
// best-effort write and self-resetting flag match every other copy on the site.
//
// Honest and accessible: a real <button>, an aria-label that says what it does,
// and a polite live region that announces the copy to a screen reader without a
// visual toast. Reduced motion drops the draw and the cross-fade for an instant,
// legible swap — the checkmark simply appears, already complete.
export function Copy({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  showLabel = true,
  srLabel,
  onCopied,
  resetMs,
  checkColor = '#DCF87C',
  className,
}: CopyProps) {
  const [copied, copy] = useCopied(resetMs)
  const reduce = useReducedMotion()

  const handle = async () => {
    const ok = await copy(value)
    onCopied?.(ok)
  }

  const base =
    'inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-[#DCF87C]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black'

  return (
    <button
      type="button"
      onClick={() => void handle()}
      aria-label={srLabel ?? `${copied ? copiedLabel : label}: ${value}`}
      className={className ?? base}
    >
      <Glyph copied={copied} reduce={!!reduce} checkColor={checkColor} />
      {showLabel && (
        <span className="relative inline-grid">
          {/* Both labels share the same grid cell so the button never changes
              width as the text swaps — the longer of the two sets the box. */}
          <span aria-hidden className="col-start-1 row-start-1 opacity-0">
            {label.length >= copiedLabel.length ? label : copiedLabel}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'copied' : 'label'}
              className="col-start-1 row-start-1 text-left"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}
            >
              {copied ? copiedLabel : label}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  )
}

// The morphing mark: a clipboard outline that cross-fades to a checkmark whose
// stroke draws on. Fixed 1rem box so the button height never jumps on the swap.
function Glyph({
  copied,
  reduce,
  checkColor,
}: {
  copied: boolean
  reduce: boolean
  checkColor: string
}): ReactNode {
  return (
    <span aria-hidden className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            fill="none"
            stroke={checkColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute h-4 w-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.18, ease: EASE }}
          >
            <motion.path
              d="M20 6 9 17l-5-5"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
            />
          </motion.svg>
        ) : (
          <motion.svg
            key="copy"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute h-4 w-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.18, ease: EASE }}
          >
            <rect x="9" y="9" width="11" height="11" rx="2.2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  )
}
