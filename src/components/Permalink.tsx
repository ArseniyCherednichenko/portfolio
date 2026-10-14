import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { useCopied } from '../lib/clipboard'

const EASE = [0.16, 1, 0.3, 1] as const

interface PermalinkProps {
  /** The id of the element this links to — the section's own `id`, which the
   * router's scroll-to-hash effect already honours as a deep-link target. */
  id: string
  /** What the section is, read back to assistive tech ("Copy link to Range"). */
  label?: string
  className?: string
}

// Permalink — the small chain glyph that makes any section on the site a
// shareable deep link. It lives beside a section's label (threaded through the
// shared `Eyebrow`), stays nearly invisible at rest, and surfaces on hover or
// keyboard focus. Pressing it copies the absolute URL to this section
// (origin + path + `#id`) and writes the hash into the address bar with
// `replaceState` — no history entry, and crucially no re-fire of the app's
// scroll-to-hash effect, so the page does not jump under the reader.
//
// Honest and self-contained: a real <button>, an aria-label that says what it
// does, and the house success idiom — the chain cross-fades to a checkmark that
// draws itself in — so it needs no toast provider to confirm. Reduced motion
// drops the draw and the cross-fade for an instant, legible swap.
export function Permalink({ id, label, className }: PermalinkProps) {
  const [copied, copy] = useCopied(1400)
  const reduce = useReducedMotion()

  const handle = async () => {
    if (typeof window === 'undefined') return
    const { origin, pathname } = window.location
    const url = `${origin}${pathname}#${id}`
    const ok = await copy(url)
    // Mirror the hash into the address bar so a plain reload lands here too.
    // replaceState keeps history tidy and does not trip the router's
    // scroll-to-hash listener, so the view holds still.
    if (ok) {
      try {
        window.history.replaceState(null, '', `#${id}`)
      } catch {
        // History can be locked down in some embeds; the copy already landed,
        // which is the part that matters.
      }
    }
  }

  const srLabel = label ? `Copy link to ${label}` : 'Copy link to this section'

  return (
    <button
      type="button"
      onClick={() => void handle()}
      aria-label={srLabel}
      className={
        className ??
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#DCF87C]/70 opacity-0 outline-none transition-[opacity,color] duration-200 hover:text-[#DCF87C] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-70'
      }
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.svg
              key="check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
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
              key="link"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute h-4 w-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.18, ease: EASE }}
            >
              {/* A chain of two links — the universal "anchor" mark. */}
              <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.42 1.42" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-2.83 2.83a5 5 0 0 0 7.07 7.07l1.42-1.42" />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Section link copied to clipboard' : ''}
      </span>
    </button>
  )
}
