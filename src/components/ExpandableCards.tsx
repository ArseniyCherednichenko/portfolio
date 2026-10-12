import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

const EASE = [0.16, 1, 0.3, 1] as const

// Focusable elements the Tab trap cycles through while a card is open — the
// standard set, minus anything removed from the tab order or disabled.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ExpandableCardItem {
  id: string
  /** Small eyebrow above the title on the card face. */
  kicker?: string
  title: string
  /** One line shown on the collapsed card and under the title when open. */
  blurb: string
  /** The rich content revealed only once the card expands. */
  body?: ReactNode
  /** Short labels shown as chips on the card and in the panel. */
  tags?: readonly string[]
  /** An optional call-to-action shown at the foot of the open panel. `to`
   * routes internally (react-router), `href` opens an external link. */
  action?: { label: string; to?: string; href?: string }
  /** Per-card accent hex. Defaults to the house lime; only tints this card. */
  accent?: string
}

const LIME = '#DCF87C'

/**
 * A grid of cards that expand in place. Click a card and it does not open a
 * separate dialog over the top — the card itself **morphs** into a larger
 * panel, growing from exactly where it sat via a Framer shared-layout
 * animation (`layoutId`), while a dimmed backdrop settles behind it. Close it
 * and the panel collapses back into the card it came from.
 *
 * Deliberately distinct from the surface family's other openers: the `Modal`
 * fades a fixed, centred dialog in from nowhere; `FlipCard` turns two faces on
 * a hinge; `PixelTransition` dissolves one face into another; `ExpandingPanels`
 * widens a spine in a row. This one is the *shared-element* transition — the
 * collapsed card and the open panel are one object that changes size and place,
 * the pattern people know from a photo grid tapping open or an app's card
 * blowing up to full screen.
 *
 * Honest a11y, not animation-only: each card is a real `button` carrying
 * `aria-expanded`/`aria-controls`; the open panel is a `role="dialog"` with
 * `aria-modal`, Escape to close, a focus trap, focus handed in on open and
 * restored to the triggering card on close, and the body scroll locked with
 * scrollbar-width compensation so the page never jumps.
 *
 * Reduced motion drops the morph entirely: the panel simply cross-fades in and
 * out, centred, and the cards never travel — the whole thing still opens,
 * reads, and closes exactly the same.
 */
export function ExpandableCards({
  items,
  columns = 3,
  className = '',
  label = 'Expandable cards',
}: {
  items: readonly ExpandableCardItem[]
  columns?: 2 | 3
  className?: string
  label?: string
}) {
  const reduce = useReducedMotion()
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = items.find((i) => i.id === activeId) ?? null

  const panelRef = useRef<HTMLDivElement>(null)
  // The card button focused when the panel opened, restored to on close.
  const restoreRef = useRef<HTMLElement | null>(null)
  const uid = useId()
  const panelId = `${uid}-panel`

  const close = useCallback(() => setActiveId(null), [])

  // A shared-layout morph needs the collapsed card and the open panel to carry
  // the same layoutId — but only when motion is allowed. Under reduced motion
  // we pass nothing, so the panel just fades in rather than flying in.
  const layoutIdFor = (id: string) => (reduce ? undefined : `expandable-${uid}-${id}`)

  // Escape to close + body-scroll lock (padding out the vanished scrollbar so
  // the page behind never shifts sideways), only while a card is open.
  useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    const { body, documentElement } = document
    const prevOverflow = body.style.overflow
    const prevPad = body.style.paddingRight
    const barWidth = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (barWidth > 0) body.style.paddingRight = `${barWidth}px`
    return () => {
      document.removeEventListener('keydown', onKey)
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPad
    }
  }, [active, close])

  // Move focus into the panel on open; return it to the card on close. Checked
  // on the next frame so the morph/mount settles first.
  useEffect(() => {
    if (!active) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel || panel.contains(document.activeElement)) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    })
    return () => {
      cancelAnimationFrame(raf)
      const panel = panelRef.current
      const restore = restoreRef.current
      if (restore && panel && panel.contains(document.activeElement)) {
        restore.focus?.()
      }
    }
  }, [active])

  // Keep Tab within the open panel.
  const onPanelKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
    if (nodes.length === 0) {
      e.preventDefault()
      panel.focus()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const el = document.activeElement
    if (e.shiftKey) {
      if (el === first || el === panel) {
        e.preventDefault()
        last.focus()
      }
    } else if (el === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  const gridCols = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={className}>
      <ul className={`grid list-none grid-cols-1 gap-4 ${gridCols}`}>
        {items.map((item) => {
          const isActive = activeId === item.id
          const accent = item.accent ?? LIME
          return (
            <li key={item.id} className="min-w-0">
              <motion.button
                type="button"
                layoutId={layoutIdFor(item.id)}
                onClick={() => setActiveId(item.id)}
                aria-expanded={isActive}
                aria-controls={isActive ? panelId : undefined}
                // While this card is the open one, its morphing twin carries the
                // visuals in the overlay — hide the placeholder so there is no
                // ghost behind the backdrop, but keep its box so the grid holds.
                style={{ opacity: isActive ? 0 : 1 }}
                className="group/exc relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left outline-none transition-colors hover:border-white/20 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 rounded-full transition-transform duration-500 ease-out group-hover/exc:scale-y-100"
                  style={{ background: accent }}
                />
                {item.kicker && (
                  <motion.span
                    layout={reduce ? false : 'position'}
                    className="text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: accent }}
                  >
                    {item.kicker}
                  </motion.span>
                )}
                <motion.span
                  layout={reduce ? false : 'position'}
                  className="mt-2 font-display text-xl font-bold leading-tight tracking-tight text-white"
                >
                  {item.title}
                </motion.span>
                <motion.span
                  layout={reduce ? false : 'position'}
                  className="mt-2 text-sm leading-relaxed text-white/55"
                >
                  {item.blurb}
                </motion.span>
                <span className="mt-auto pt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-white/40 transition-colors group-hover/exc:text-white/70">
                  Expand
                  <span aria-hidden className="transition-transform duration-300 group-hover/exc:translate-x-0.5">
                    -&gt;
                  </span>
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>

      {createPortal(
        <AnimatePresence>
          {active && (
            <motion.div
              key="exc-backdrop"
              className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              aria-label={label}
            >
              <motion.div
                key={active.id}
                ref={panelRef}
                layoutId={layoutIdFor(active.id)}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${panelId}-title`}
                id={panelId}
                tabIndex={-1}
                // Reduced motion: no layoutId morph, so animate a plain fade.
                initial={reduce ? { opacity: 0 } : false}
                animate={reduce ? { opacity: 1 } : undefined}
                exit={reduce ? { opacity: 0 } : undefined}
                transition={{ duration: reduce ? 0.18 : 0.4, ease: EASE }}
                className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#101010] outline-none sm:max-h-[86dvh] sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={onPanelKeyDown}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: active.accent ?? LIME }}
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
                >
                  <span aria-hidden className="text-2xl leading-none">
                    &times;
                  </span>
                </button>

                <div className="overflow-y-auto overscroll-contain p-8 sm:p-10">
                  {active.kicker && (
                    <motion.p
                      layout={reduce ? false : 'position'}
                      className="text-xs font-semibold uppercase tracking-[0.24em]"
                      style={{ color: active.accent ?? LIME }}
                    >
                      {active.kicker}
                    </motion.p>
                  )}
                  <motion.h3
                    layout={reduce ? false : 'position'}
                    id={`${panelId}-title`}
                    className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl"
                  >
                    {active.title}
                  </motion.h3>
                  <motion.p
                    layout={reduce ? false : 'position'}
                    className="mt-3 text-base leading-relaxed text-white/60"
                  >
                    {active.blurb}
                  </motion.p>

                  {/* Everything below is revealed content — it only exists in the
                      open panel, so it fades up after the morph settles. */}
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 0.12 }}
                  >
                    {active.body && (
                      <div className="mt-6 space-y-4 text-[0.95rem] leading-relaxed text-white/70">
                        {active.body}
                      </div>
                    )}

                    {active.tags && active.tags.length > 0 && (
                      <div className="mt-7">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
                          Reached for
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {active.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/70"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {active.action &&
                      (active.action.to ? (
                        <Link
                          to={active.action.to}
                          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
                        >
                          {active.action.label}
                          <span aria-hidden>-&gt;</span>
                        </Link>
                      ) : (
                        <a
                          href={active.action.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
                        >
                          {active.action.label}
                          <span aria-hidden>-&gt;</span>
                        </a>
                      ))}
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
