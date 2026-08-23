import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

const EASE = [0.16, 1, 0.3, 1] as const

export type TourSide = 'top' | 'bottom' | 'left' | 'right' | 'auto'

export interface TourStep {
  /** The element this step highlights. Its live rect drives the spotlight. */
  target: RefObject<HTMLElement | null>
  /** The step card heading. */
  title: string
  /** A sentence or two of body copy for the step. */
  body: ReactNode
  /** Preferred side of the target to seat the card. Defaults to 'auto'. */
  side?: TourSide
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface CardPos {
  x: number
  y: number
  /** The side actually used after any viewport flip. */
  side: 'top' | 'bottom' | 'left' | 'right'
  /** Arrow offset (px) along the card's near edge, aimed at the target centre. */
  ax: number
  ay: number
}

const PAD = 8 // breathing room the spotlight leaves around the target
const CARD_W = 320
const GAP = 16 // distance from the padded target to the card
const M = 12 // keep this much clear of every viewport edge

// Read a step's target rect, padded, in viewport coordinates. Falls back to a
// small rect at the viewport centre if the element is not mounted yet.
function measure(el: HTMLElement | null): Rect {
  if (!el) {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    return { x: cx - 1, y: cy - 1, w: 2, h: 2 }
  }
  const r = el.getBoundingClientRect()
  return {
    x: r.left - PAD,
    y: r.top - PAD,
    w: r.width + PAD * 2,
    h: r.height + PAD * 2,
  }
}

// Choose a side for the card that fits the viewport, then clamp it on-screen.
function placeCard(spot: Rect, prefer: TourSide, cardH: number): CardPos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cx = spot.x + spot.w / 2
  const cy = spot.y + spot.h / 2

  const fits = {
    bottom: spot.y + spot.h + GAP + cardH <= vh - M,
    top: spot.y - GAP - cardH >= M,
    right: spot.x + spot.w + GAP + CARD_W <= vw - M,
    left: spot.x - GAP - CARD_W >= M,
  }
  const order: ('top' | 'bottom' | 'left' | 'right')[] =
    prefer === 'auto'
      ? ['bottom', 'top', 'right', 'left']
      : [prefer, 'bottom', 'top', 'right', 'left']
  let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
  for (const s of order) {
    if (fits[s]) {
      side = s
      break
    }
  }

  let x = 0
  let y = 0
  if (side === 'bottom') {
    y = spot.y + spot.h + GAP
    x = cx - CARD_W / 2
  } else if (side === 'top') {
    y = spot.y - GAP - cardH
    x = cx - CARD_W / 2
  } else if (side === 'right') {
    x = spot.x + spot.w + GAP
    y = cy - cardH / 2
  } else {
    x = spot.x - GAP - CARD_W
    y = cy - cardH / 2
  }
  x = Math.max(M, Math.min(x, vw - M - CARD_W))
  y = Math.max(M, Math.min(y, vh - M - cardH))

  // Arrow tucks against the card's near edge, aimed at the target centre,
  // never past the rounded corners.
  const ax = Math.max(16, Math.min(cx - x - 5, CARD_W - 26))
  const ay = Math.max(16, Math.min(cy - y - 5, cardH - 26))
  return { x, y, side, ax, ay }
}

/**
 * A guided **coachmark tour** — the Overlays family's onboarding primitive, and
 * the piece its modals and popovers never covered: instead of pulling the eye
 * into a dialog and away from the product, it dims the page and cuts a
 * **spotlight** around one real element at a time, then **glides** that
 * spotlight from step to step while an anchored card explains each in turn.
 *
 * The dim and the highlight are one element: a transparent, rounded cutout whose
 * enormous spread `box-shadow` darkens the rest of the page, so animating its
 * rect moves the shadow, the ring, and the hole together in lock-step. The card
 * is measured and placed on whichever side of the target fits, flipping and
 * clamping inside the viewport, with an arrow tracking the target's centre.
 *
 * Accessibility: the overlay is a labelled `role="dialog"` (`aria-modal`); focus
 * moves onto the card on open and after every step and is trapped inside it;
 * Escape ends the tour, the arrow keys and Enter walk the steps, and focus is
 * returned to wherever it was. The whole surface blocks page interaction while
 * open, so the only way through is the card. Under reduced motion the spotlight
 * jumps rather than glides and the card simply fades.
 */
export function Tour({
  steps,
  open,
  onClose,
  onFinish,
  label = 'Guided tour',
}: {
  /** The ordered steps. Each highlights a target element. */
  steps: TourStep[]
  /** Whether the tour is running. */
  open: boolean
  /** Called when the tour is dismissed or completed. */
  onClose: () => void
  /** Called once when the last step is confirmed (before onClose). */
  onFinish?: () => void
  /** Accessible name for the tour dialog. */
  label?: string
}) {
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [index, setIndex] = useState(0)
  const [spot, setSpot] = useState<Rect | null>(null)
  const [card, setCard] = useState<CardPos | null>(null)
  const id = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const count = steps.length
  const step = steps[Math.min(index, count - 1)]
  const first = index === 0
  const last = index >= count - 1

  useEffect(() => setMounted(true), [])

  // Fresh run always starts at the top.
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  const end = useCallback(() => onClose(), [onClose])
  const next = useCallback(() => {
    if (last) {
      onFinish?.()
      onClose()
    } else {
      setIndex((i) => Math.min(i + 1, count - 1))
    }
  }, [last, count, onFinish, onClose])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  // Bring the target into view (respecting reduced motion), then measure the
  // spotlight and place the card. Re-runs on step change; keeps pinned on
  // scroll and resize.
  useLayoutEffect(() => {
    if (!open || !step) return
    let raf = 0
    const el = step.target.current
    el?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'center',
      inline: 'center',
    })
    const sync = () => {
      const s = measure(step.target.current)
      setSpot(s)
      const h = cardRef.current?.offsetHeight ?? 200
      setCard(placeCard(s, step.side ?? 'auto', h))
    }
    // One frame later, after any scroll settles and the card has a height.
    raf = requestAnimationFrame(() => {
      sync()
      // A second pass once the card has really measured its content height.
      requestAnimationFrame(sync)
    })
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [open, index, step, reduce])

  // Remember focus on open; hand it back on close.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      return
    }
    const back = restoreRef.current
    if (back && typeof back.focus === 'function') back.focus({ preventScroll: true })
  }, [open])

  // Move focus onto the card on open and after every step.
  useEffect(() => {
    if (!open) return
    const el = cardRef.current
    if (!el) return
    const primary = el.querySelector<HTMLElement>('[data-tour-primary]')
    ;(primary ?? el).focus({ preventScroll: true })
  }, [open, index])

  // Keyboard: Escape ends; arrows and Enter walk the steps; Tab is trapped in
  // the card so focus can never fall back to the dimmed page.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        end()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Tab') {
        const el = cardRef.current
        if (!el) return
        const f = Array.from(
          el.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
          ),
        )
        if (f.length === 0) return
        const firstEl = f[0]
        const lastEl = f[f.length - 1]
        const active = document.activeElement
        if (e.shiftKey && active === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, end, next, prev])

  if (!mounted || count === 0) return null

  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 34, mass: 0.9 }

  const arrowStyle =
    card?.side === 'top'
      ? { bottom: -5, left: card.ax }
      : card?.side === 'bottom'
        ? { top: -5, left: card.ax }
        : card?.side === 'left'
          ? { right: -5, top: card.ay }
          : { left: -5, top: card?.ay ?? 0 }

  return createPortal(
    <AnimatePresence>
      {open && step && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}
          className="fixed inset-0"
          style={{ zIndex: 200 }}
        >
          {/* Full-screen blocker: the shadow area of the cutout is not
              hit-testable, so this catches every stray click on the page. */}
          <div className="absolute inset-0 cursor-default" aria-hidden />

          {/* The spotlight: one transparent rounded rect whose vast spread
              shadow dims everything else. Animating its rect glides the hole,
              the ring, and the dim together. */}
          {spot && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute rounded-xl"
              initial={false}
              animate={{ top: spot.y, left: spot.x, width: spot.w, height: spot.h }}
              transition={spring}
              style={{
                boxShadow: '0 0 0 9999px rgba(6, 6, 6, 0.74)',
                outline: '1px solid rgba(220, 248, 124, 0.9)',
                outlineOffset: 2,
              }}
            >
              {/* A soft accent halo hugging the ring. */}
              <span
                className="absolute -inset-0.5 rounded-xl"
                style={{ boxShadow: '0 0 0 3px rgba(220, 248, 124, 0.16)' }}
              />
            </motion.div>
          )}

          {/* The step card, anchored to whichever side of the target fits. */}
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            id={id}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            animate={{
              opacity: card ? 1 : 0,
              scale: 1,
              left: card?.x ?? 0,
              top: card?.y ?? 0,
            }}
            transition={{ ...spring, opacity: { duration: reduce ? 0.12 : 0.2, ease: EASE } }}
            className="absolute w-[320px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/10 bg-[#161616]/97 p-5 text-left shadow-2xl shadow-black/60 outline-none backdrop-blur-md"
            style={{ visibility: card ? 'visible' : 'hidden' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[#DCF87C]">
                Step {index + 1} of {count}
              </span>
              <button
                type="button"
                onClick={end}
                className="-mr-1 -mt-1 rounded-md p-1 text-white/40 transition hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DCF87C]"
                aria-label="End tour"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                  <path
                    d="M3.5 3.5l8 8m0-8l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-white">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{step.body}</p>

            {/* Progress rail — a dot per step; the active one is a lime pill. */}
            <div className="mt-5 flex items-center gap-3">
              <div className="flex items-center gap-1.5" aria-hidden>
                {steps.map((_, i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 rounded-full"
                    animate={{
                      width: i === index ? 18 : 6,
                      backgroundColor:
                        i === index
                          ? 'rgba(220, 248, 124, 1)'
                          : i < index
                            ? 'rgba(220, 248, 124, 0.4)'
                            : 'rgba(255, 255, 255, 0.16)',
                    }}
                    transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
                  />
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!first && (
                  <button
                    type="button"
                    onClick={prev}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DCF87C]"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  data-tour-primary
                  onClick={next}
                  className="rounded-lg bg-[#DCF87C] px-3.5 py-1.5 text-sm font-semibold text-black transition hover:bg-[#e6ff97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCF87C]"
                >
                  {last ? 'Done' : 'Next'}
                </button>
              </div>
            </div>

            {/* Arrow: a rotated nub tucked against the near edge, aimed at the
                target, filled to the card colour so it reads as one shape. */}
            {card && (
              <span
                aria-hidden
                style={arrowStyle}
                className="absolute h-2.5 w-2.5 rotate-45 border border-white/10 bg-[#161616]"
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
