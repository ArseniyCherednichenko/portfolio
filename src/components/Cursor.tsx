import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'

// Site-wide custom cursor: a tight lime dot tracking the pointer plus a softer
// trailing ring that grows and fills over interactive elements and pulses on
// press. Activates only on fine pointers (mouse/trackpad) with motion allowed,
// so touch devices and reduced-motion users keep the native cursor untouched.
//
// Contextual labels: any element (or an ancestor) carrying a non-empty
// `data-cursor` attribute lends its value to the cursor as a small floating
// label — "View", "Open", "Copy", "Drag" — so the pointer narrates what a
// click will do before the click. The label trails the ring at a lower spring
// tension than the dot, so it settles a beat behind the pointer like a caption
// catching up. It is the premium, Vercel/Linear-style touch that ties the whole
// site's interactions together; empty `data-cursor` still marks a thing as
// interactive (the ring grows) without a caption, exactly as before.

const RING = 30 // base ring diameter (px)
const DOT = 6 // dot diameter (px)
const INTERACTIVE =
  'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor]'
// Elements that can carry a caption. Kept separate from INTERACTIVE so a bare
// link still grows the ring but only a declared `data-cursor` paints a label.
const LABELLED = '[data-cursor]'

export function Cursor() {
  const reduce = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [pressed, setPressed] = useState(false)
  // The current contextual caption, or null when the pointer is over nothing
  // that declares one.
  const [label, setLabel] = useState<string | null>(null)

  // Raw pointer position; the layers spring toward it at different tensions so
  // the dot snaps, the ring lags, and the label trails furthest behind.
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const ringX = useSpring(x, { stiffness: 320, damping: 28, mass: 0.45 })
  const ringY = useSpring(y, { stiffness: 320, damping: 28, mass: 0.45 })
  const dotX = useSpring(x, { stiffness: 1100, damping: 50, mass: 0.18 })
  const dotY = useSpring(y, { stiffness: 1100, damping: 50, mass: 0.18 })
  // The caption rides its own softer spring so it drifts in a beat behind the
  // ring rather than locking to it — the small lag reads as weight.
  const labelX = useSpring(x, { stiffness: 220, damping: 30, mass: 0.6 })
  const labelY = useSpring(y, { stiffness: 220, damping: 30, mass: 0.6 })

  // Only enable on devices with a fine pointer, and never under reduced motion.
  useEffect(() => {
    if (reduce) return
    const fine = window.matchMedia('(pointer: fine)')
    const update = () => setEnabled(fine.matches)
    update()
    fine.addEventListener('change', update)
    return () => fine.removeEventListener('change', update)
  }, [reduce])

  useEffect(() => {
    if (!enabled) return
    const onMove = (e: MouseEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true) // no-ops once true (useState bails on equal values)
    }
    const onOver = (e: MouseEvent) => {
      const el = e.target as Element | null
      setHovering(!!el?.closest?.(INTERACTIVE))
      // Read the caption from the nearest declaring ancestor. A present-but-
      // empty value marks interactivity without a word, so it collapses to null.
      const labelled = el?.closest?.(LABELLED) as HTMLElement | null
      const raw = labelled?.getAttribute('data-cursor')?.trim()
      setLabel(raw ? raw : null)
    }
    const onDown = () => setPressed(true)
    const onUp = () => setPressed(false)
    const onLeave = () => setVisible(false)
    const onEnter = () => setVisible(true)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)
    document.body.classList.add('cursor-none')

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
      document.body.classList.remove('cursor-none')
    }
  }, [enabled, x, y])

  if (!enabled) return null

  const spring = { type: 'spring' as const, stiffness: 380, damping: 26, mass: 0.5 }
  // A caption is only painted when the pointer is actually on screen.
  const showLabel = visible && label !== null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999]">
      <motion.div
        className="absolute top-0 left-0 rounded-full border border-[#DCF87C]"
        style={{
          x: ringX,
          y: ringY,
          width: RING,
          height: RING,
          marginLeft: -RING / 2,
          marginTop: -RING / 2,
        }}
        animate={{
          scale: pressed ? 0.78 : hovering ? 1.9 : 1,
          opacity: visible ? (hovering ? 0.9 : 0.6) : 0,
          backgroundColor: hovering
            ? 'rgba(220,248,124,0.12)'
            : 'rgba(220,248,124,0)',
        }}
        transition={spring}
      />
      <motion.div
        className="absolute top-0 left-0 rounded-full bg-[#DCF87C]"
        style={{
          x: dotX,
          y: dotY,
          width: DOT,
          height: DOT,
          marginLeft: -DOT / 2,
          marginTop: -DOT / 2,
        }}
        animate={{
          // The dot yields to the caption when one is showing, so the eye reads
          // the word instead of two competing marks.
          scale: hovering || showLabel ? 0 : pressed ? 0.6 : 1,
          opacity: visible ? 1 : 0,
        }}
        transition={spring}
      />
      {/* The floating caption. Sits just below-right of the pointer so it never
          hides under the hand, and springs in from a hair closer to the ring. */}
      <AnimatePresence>
        {showLabel && (
          <motion.div
            key={label}
            className="absolute top-0 left-0 origin-top-left whitespace-nowrap rounded-full bg-[#DCF87C] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black shadow-[0_6px_20px_-6px_rgba(220,248,124,0.6)]"
            // x/y track the pointer; the static margins nudge the whole pill
            // down-right so it clears the hand without breaking the spring.
            style={{ x: labelX, y: labelY, marginLeft: 16, marginTop: 14 }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.5 }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
