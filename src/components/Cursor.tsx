import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'

// Site-wide custom cursor: a tight lime dot tracking the pointer plus a softer
// trailing ring that grows and fills over interactive elements and pulses on
// press. Activates only on fine pointers (mouse/trackpad) with motion allowed,
// so touch devices and reduced-motion users keep the native cursor untouched.

const RING = 30 // base ring diameter (px)
const DOT = 6 // dot diameter (px)
const INTERACTIVE =
  'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor]'

export function Cursor() {
  const reduce = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [pressed, setPressed] = useState(false)

  // Raw pointer position; both layers spring toward it at different tensions
  // so the dot snaps and the ring lags into place.
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const ringX = useSpring(x, { stiffness: 320, damping: 28, mass: 0.45 })
  const ringY = useSpring(y, { stiffness: 320, damping: 28, mass: 0.45 })
  const dotX = useSpring(x, { stiffness: 1100, damping: 50, mass: 0.18 })
  const dotY = useSpring(y, { stiffness: 1100, damping: 50, mass: 0.18 })

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
          scale: hovering ? 0 : pressed ? 0.6 : 1,
          opacity: visible ? 1 : 0,
        }}
        transition={spring}
      />
    </div>
  )
}
