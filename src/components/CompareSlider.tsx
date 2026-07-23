import { useEffect, useRef, useState } from 'react'
import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// CompareSlider: a before/after wipe you drag. Two full-bleed layers are
// stacked; a vertical divider clips the top ("before") layer so the bottom
// ("after") layer shows through to its right. Grab the handle — or click
// anywhere on the frame — and the seam follows your pointer, wiping between
// the two states.
//
// Deliberately its own reveal, distinct from the site's others: ScratchReveal
// is a foil you erase, PixelTransition dissolves a grid, SpotlightReveal lights
// words under a torch. This one is the classic split wipe — a seam you slide,
// with a spring so the divider eases toward the pointer instead of snapping to
// it. The two children are always in the DOM, so both states stay selectable
// and screen-reader legible; the handle is a real ARIA slider you can also
// drive from the keyboard (arrows, Home/End).
//
// The position lives on a motion value (with a spring), not React state, so the
// hot path never re-renders — clip-path and the handle offset are motion
// templates. A tiny integer state exists only to keep aria-valuenow honest.
// When it first scrolls into view it sweeps the seam once to advertise that it
// moves; under prefers-reduced-motion that hint is skipped and the spring drops
// out (the seam still drags, since that is user-initiated, not imposed motion).
export function CompareSlider({
  before,
  after,
  beforeLabel = 'Before',
  afterLabel = 'After',
  initial = 50,
  className = '',
  ariaLabel = 'Drag to compare before and after',
}: {
  /** The layer revealed to the LEFT of the seam. Clipped by the divider. */
  before: React.ReactNode
  /** The layer revealed to the RIGHT of the seam. Sits underneath, full width. */
  after: React.ReactNode
  beforeLabel?: string
  afterLabel?: string
  /** Starting seam position, 0..100 (percent from the left). */
  initial?: number
  className?: string
  ariaLabel?: string
}) {
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { once: true, amount: 0.5 })

  // The seam position (0..100). Kept on a motion value; a spring smooths the
  // follow so the divider eases toward the pointer. Under reduced motion we
  // read the raw value so there is no easing at all.
  const pos = useMotionValue(initial)
  const spring = useSpring(pos, { stiffness: 300, damping: 34, mass: 0.6 })
  const track = reduce ? pos : spring

  // clip the "before" layer to [0, pos] from the left; offset the handle to pos.
  const clip = useMotionTemplate`inset(0 ${useTransform(track, (p) => 100 - p)}% 0 0)`
  const handleLeft = useMotionTemplate`${track}%`

  // Mirror the value into state only for aria-valuenow — never read on the hot
  // path, so dragging stays free of React re-renders.
  const [value, setValue] = useState(Math.round(initial))
  const touched = useRef(false)

  function set(next: number, viaUser: boolean) {
    const clamped = Math.max(0, Math.min(100, next))
    if (viaUser) touched.current = true
    pos.set(clamped)
    setValue(Math.round(clamped))
  }

  function posFromClientX(clientX: number) {
    const el = rootRef.current
    if (!el) return value
    const rect = el.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * 100
  }

  const dragging = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    set(posFromClientX(e.clientX), true)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    set(posFromClientX(e.clientX), true)
  }
  function onPointerUp() {
    dragging.current = false
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 4
    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        set(value - step, true)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        set(value + step, true)
        break
      case 'Home':
        set(0, true)
        break
      case 'End':
        set(100, true)
        break
      default:
        handled = false
    }
    if (handled) e.preventDefault()
  }

  // First scroll into view: sweep the seam once so it reads as draggable.
  useEffect(() => {
    if (!inView || reduce || touched.current) return
    const controls = animate(pos, [initial, initial + 16, initial - 18, initial], {
      duration: 1.7,
      ease: [0.22, 1, 0.36, 1],
      times: [0, 0.34, 0.68, 1],
      onUpdate: (v) => {
        if (!touched.current) setValue(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [inView, reduce, initial, pos])

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative isolate select-none overflow-hidden rounded-3xl border border-white/10 ${className}`}
      style={{ cursor: 'ew-resize', touchAction: 'pan-y' }}
    >
      {/* After (finished) layer — sits full-width underneath. */}
      <div className="absolute inset-0">{after}</div>

      {/* Before (structure) layer — clipped to the left of the seam. */}
      <motion.div className="absolute inset-0" style={{ clipPath: clip, WebkitClipPath: clip }}>
        {before}
      </motion.div>

      {/* Corner labels. The active one (whichever side is wider) brightens. */}
      <span
        className={`pointer-events-none absolute left-3 top-3 z-20 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm transition-colors ${
          value >= 50
            ? 'border-white/15 bg-black/40 text-white/60'
            : 'border-[#DCF87C]/40 bg-black/50 text-[#DCF87C]'
        }`}
      >
        {beforeLabel}
      </span>
      <span
        className={`pointer-events-none absolute right-3 top-3 z-20 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm transition-colors ${
          value < 50
            ? 'border-white/15 bg-black/40 text-white/60'
            : 'border-[#DCF87C]/40 bg-black/50 text-[#DCF87C]'
        }`}
      >
        {afterLabel}
      </span>

      {/* The seam: a lime line the height of the frame, with a round grab knob. */}
      <motion.div
        className="absolute inset-y-0 z-20 -ml-px w-0.5 bg-[#DCF87C] shadow-[0_0_16px_rgba(220,248,124,0.55)]"
        style={{ left: handleLeft }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={`${value}% ${afterLabel}, ${100 - value}% ${beforeLabel}`}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-[#DCF87C]/60 bg-black/70 text-[#DCF87C] backdrop-blur transition-shadow hover:shadow-[0_0_22px_rgba(220,248,124,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {/* Two chevrons pointing outward — the universal "drag me sideways". */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <path d="M9.5 7.5 5 12l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14.5 7.5 19 12l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </motion.div>
    </div>
  )
}
