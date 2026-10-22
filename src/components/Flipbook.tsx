import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

// A page-turning book you read with your hands — the one surface the Cards &
// surfaces family never had. The library already turns a single card over
// (FlipCard), fans a hand out (FanDeck), recedes a deck into depth (CardStack),
// and coverflows a gallery (CircularGallery); none of them is a *bound book*
// with a spine, a thickness of leaves, and one real page turn. This is that: a
// right-hand page that swings around the spine on a true `rotateY`, revealing
// the next page beneath, and you can throw it with a drag or step it with the
// keys.
//
// The whole turn rides one motion value, `rot` (0 at rest on the right,
// -180° lying flat to the left). A drag maps finger travel to that angle so the
// leaf follows the pointer around the spine and you feel its weight; releasing
// past the halfway mark lets it fall the rest of the way, and short of it the
// leaf springs back — a physical throw, not a click. The gesture decides its
// own direction on the first real move (drag left to go forward, right to go
// back) and holds it until release, so a wobble never flips the mode mid-turn.
//
// Only one leaf is ever live, and it carries no meaning: the *semantic* current
// page is the still one rendered beneath at rest, with its real links in the tab
// order, while the turning leaf and the page revealed under it are aria-hidden
// transients. Every change is spoken once through a polite live region, so the
// book reads to a screen reader as "page 3 of 10 — …", not as a flurry of
// rotating nodes. Under prefers-reduced-motion the 3D is dropped entirely: pages
// cross-fade in place, the drag is off, and the keys and buttons still turn it.

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 32 }
const SETTLE = { duration: 0.52, ease: [0.22, 1, 0.36, 1] as const }

export interface FlipbookProps {
  /** One node per page, rendered in order. The book paginates these 1-based. */
  pages: ReactNode[]
  /** Accessible name for the whole book. */
  'aria-label'?: string
  /** Start on this 0-based page. */
  defaultIndex?: number
  className?: string
}

type Mode = 'fwd' | 'back'

/**
 * A bound, page-turning book. A right-hand page swings around the spine on a
 * real `rotateY`; drag it to throw the turn, or step it with the controls and
 * arrow keys. One live leaf, the still page beneath it the semantic current
 * page; changes are announced through a polite live region. Reduced-motion
 * aware: the 3D drops to an in-place cross-fade and the drag is disabled.
 */
export function Flipbook({
  pages,
  'aria-label': ariaLabel = 'Flipbook',
  defaultIndex = 0,
  className = '',
}: FlipbookProps) {
  const reduce = useReducedMotion()
  const n = pages.length
  const labelId = useId()

  const [i, setI] = useState(() => Math.min(Math.max(defaultIndex, 0), Math.max(n - 1, 0)))
  // The live turn, or null at rest. `mode` fixes the direction for the gesture;
  // `to` is the destination index the turn commits to.
  const [turn, setTurn] = useState<{ mode: Mode; to: number } | null>(null)

  const rot = useMotionValue(0) // 0 at rest on the right, -180 lying left.
  const stageRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(1)
  const busyRef = useRef(false)
  const dragRef = useRef<{ startX: number; mode: Mode | null } | null>(null)

  const canPrev = i > 0
  const canNext = i < n - 1

  // The front face of the live leaf: forward turns show the page we are leaving,
  // backward turns show the page we are returning to (it ends up on top).
  const frontIndex = turn ? (turn.mode === 'fwd' ? i : turn.to) : i
  // The still page beneath the leaf: the destination on a forward turn (revealed
  // as the leaf swings off), the page we are leaving on a backward turn.
  const baseIndex = turn ? (turn.mode === 'fwd' ? turn.to : i) : i

  // A travelling shadow that deepens as the leaf stands up edge-on at 90°, so
  // the turn reads as a lifted page and not a flat swap.
  const liftShadow = useTransform(rot, [0, -90, -180], [0, 0.85, 0])

  // Keep a measured width so a drag maps finger travel to a half-turn cleanly.
  useEffect(() => {
    const measure = () => {
      if (stageRef.current) widthRef.current = Math.max(stageRef.current.offsetWidth, 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [])

  // Finish a turn: commit the index, drop the leaf, and reset the angle. Done in
  // one pass so the still page swaps under cover of the flat leaf, never flashing.
  const finish = useCallback((to: number) => {
    setI(to)
    setTurn(null)
    rot.set(0)
    busyRef.current = false
  }, [rot])

  const cancel = useCallback(() => {
    setTurn(null)
    rot.set(0)
    busyRef.current = false
  }, [rot])

  // Step one page in a direction — used by the buttons, the keys, and a click on
  // a page half. Reduced motion swaps instantly; otherwise a leaf runs the full
  // half-turn and commits on arrival.
  const step = useCallback(
    (mode: Mode) => {
      if (busyRef.current) return
      const to = mode === 'fwd' ? i + 1 : i - 1
      if (to < 0 || to > n - 1) return
      if (reduce) {
        setI(to)
        return
      }
      busyRef.current = true
      setTurn({ mode, to })
      // Forward runs 0 -> -180; backward comes in from the left, -180 -> 0.
      rot.set(mode === 'fwd' ? 0 : -180)
      const end = mode === 'fwd' ? -180 : 0
      animate(rot, end, { ...SETTLE, onComplete: () => finish(to) })
    },
    [i, n, reduce, rot, finish],
  )

  // ---- Pointer drag: throw the page around the spine ----------------------
  const onPointerDown = (e: ReactPointerEvent) => {
    if (reduce || busyRef.current || n < 2) return
    // Ignore drags that begin on a real control/link inside a page.
    if ((e.target as HTMLElement).closest('a,button,input,textarea,select')) return
    dragRef.current = { startX: e.clientX, mode: null }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    // Decide the direction once, after a small deadzone, then hold it.
    if (!d.mode) {
      if (Math.abs(dx) < 6) return
      const mode: Mode = dx < 0 ? 'fwd' : 'back'
      if ((mode === 'fwd' && !canNext) || (mode === 'back' && !canPrev)) {
        dragRef.current = null
        return
      }
      d.mode = mode
      busyRef.current = true
      setTurn({ mode, to: mode === 'fwd' ? i + 1 : i - 1 })
    }
    const w = widthRef.current
    if (d.mode === 'fwd') {
      // dx: 0 -> -w maps rot 0 -> -180.
      rot.set(Math.max(-180, Math.min(0, (dx / w) * 180)))
    } else {
      // dx: 0 -> w maps rot -180 -> 0.
      rot.set(Math.max(-180, Math.min(0, -180 + (dx / w) * 180)))
    }
  }

  const endDrag = (e: ReactPointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* capture may already be gone */
    }
    if (!d || !d.mode) {
      if (d) busyRef.current = false
      return
    }
    const mode = d.mode
    const current = rot.get()
    const past = Math.abs(current) >= 90
    if (mode === 'fwd') {
      if (past) animate(rot, -180, { ...SPRING, onComplete: () => finish(i + 1) })
      else animate(rot, 0, { ...SPRING, onComplete: cancel })
    } else {
      if (past) animate(rot, 0, { ...SPRING, onComplete: () => finish(i - 1) })
      else animate(rot, -180, { ...SPRING, onComplete: cancel })
    }
  }

  // Announce the resting page for assistive tech, once it settles.
  const [announce, setAnnounce] = useState('')
  useEffect(() => {
    if (!turn) setAnnounce(`Page ${i + 1} of ${n}`)
  }, [i, n, turn])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (busyRef.current) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      step('fwd')
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step('back')
    } else if (e.key === 'Home') {
      e.preventDefault()
      setI(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setI(n - 1)
    }
  }

  // Shadow opacity mirrored into state only so the overlay can read it as a
  // style string without a second motion component.
  const shadowStyle = { opacity: liftShadow }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <span id={labelId} className="text-sm font-medium text-white/70">
          {ariaLabel}
        </span>
        <span className="text-xs tabular-nums text-white/45">
          {Math.min(i + 1, n)} / {n}
        </span>
      </div>

      <div
        role="group"
        aria-labelledby={labelId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="group relative mt-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        {/* The book slab — a thickness of leaves on either side of the spine. */}
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-1.5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
          style={{ perspective: reduce ? undefined : 1400 }}
        >
          {/* Faux page edges stacked on the right, so the book has heft. */}
          <div aria-hidden className="pointer-events-none absolute inset-y-6 right-1 w-2 rounded-r-md bg-[repeating-linear-gradient(to_right,rgba(255,255,255,0.10),rgba(255,255,255,0.10)_1px,transparent_1px,transparent_3px)]" />

          <div
            ref={stageRef}
            className="relative aspect-[4/5] w-full select-none sm:aspect-[3/4]"
            style={{ transformStyle: reduce ? undefined : 'preserve-3d' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* Base layer — the still page. At rest it is the semantic current
                page with live links; during a turn it is the transient revealed
                page, hidden from AT. */}
            <div
              aria-hidden={!!turn}
              className="absolute inset-0 overflow-hidden rounded-xl"
            >
              <PageFace reduce={!!reduce}>{pages[baseIndex]}</PageFace>
            </div>

            {/* The turning leaf — only mounted during a turn. */}
            {turn && !reduce && (
              <motion.div
                aria-hidden
                className="absolute inset-0 origin-left rounded-xl"
                style={{ rotateY: rot, transformStyle: 'preserve-3d' }}
              >
                {/* Front face: the page on this side of the leaf. */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-xl"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <PageFace reduce={false}>{pages[frontIndex]}</PageFace>
                  {/* Spine gutter shade down the binding edge. */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/35 to-transparent" />
                </div>
                {/* Back face: a plain paper back, so the turn shows heft, not a
                    mirrored page. */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-bl from-white/[0.05] to-white/[0.01]"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/35 to-transparent" />
                </div>
                {/* Travelling lift shadow, deepest edge-on. */}
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-xl bg-black"
                  style={shadowStyle}
                />
              </motion.div>
            )}

            {/* Curled-corner affordance, calm until hovered. */}
            {!reduce && canNext && !turn && (
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-0 right-0 h-10 w-10 rounded-br-xl rounded-tl-xl bg-gradient-to-tl from-white/20 to-transparent opacity-50 transition-opacity duration-300 group-hover:opacity-90"
                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
              />
            )}
          </div>
        </div>

        {/* Controls — real buttons, labelled, under the book. */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => step('back')}
            disabled={!canPrev}
            className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-sm text-white/80 transition enabled:hover:border-[#DCF87C]/50 enabled:hover:text-white disabled:opacity-30"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => step('fwd')}
            disabled={!canNext}
            className="inline-flex h-9 items-center rounded-full bg-[#DCF87C] px-4 text-sm font-semibold text-black transition enabled:hover:brightness-105 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}

// One rendered page surface. Idle pages fade in gently; a turning leaf's front
// renders without the entrance so it doesn't re-animate mid-flight.
function PageFace({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  return (
    <div className="relative h-full w-full bg-[#0c0d0b] [background-image:radial-gradient(130%_90%_at_0%_0%,rgba(220,248,124,0.06),transparent_60%)]">
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.35 }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </div>
  )
}
