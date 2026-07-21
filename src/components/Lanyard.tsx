import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Lanyard: a name badge hanging from a pinned cord that swings with real
// pendulum physics. Grab the badge and throw it — it swings out, arcs back, and
// settles under gravity and damping, tilting with the cord the whole way. A
// deliberately different *kind* of motion from the rest of the library: Gravity
// tumbles free bodies in a bin, Ribbons trail after the cursor, SphereMenu spins
// a draggable ball — this is a single constrained mass on a cord, a driven
// damped pendulum you can grab and let go. The badge is real HTML (crisp type,
// the site's own faces) positioned and rotated off a physics loop that runs on
// refs, so nothing re-renders React on the hot path.
//
// Stable by construction: the state is an angle and an angular velocity, so it
// can never explode — it always damps back to hanging straight down. Under
// reduced motion it simply hangs still, with no loop and no listeners.

export interface LanyardProps {
  /** The big line on the badge — a real name, not a placeholder. */
  name?: string
  /** The small line under it. */
  role?: string
  /** The tiny top strip on the card. */
  tag?: string
  className?: string
}

// Tuning. GRAV sets the swing tempo (accel scales with GRAV / length, so the
// period tracks the cord length); DAMP bleeds energy so a throw settles rather
// than swinging forever. DAMP * dt stays well under 2, so integration is stable.
const GRAV = 2600
const DAMP = 1.35
const MAX_DT = 0.032

export function Lanyard({
  name = 'Arseniy Cherednichenko',
  role = 'Builder · Berlin',
  tag = 'Hello, my name is',
  className = '',
}: LanyardProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const cordRef = useRef<SVGPathElement>(null)
  const strapRef = useRef<SVGPathElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const wrap = wrapRef.current
    const badge = badgeRef.current
    const cord = cordRef.current
    const strap = strapRef.current
    if (!wrap || !badge || !cord || !strap) return

    let w = 0
    let h = 0
    // Pivot (the pin) and cord length, recomputed on resize.
    let px = 0
    let py = 0
    let L = 0

    // Pendulum state: angle from straight-down, and angular velocity.
    let theta = reduce ? 0 : -0.62
    let omega = 0

    // Drag bookkeeping.
    const drag = { active: false, id: -1, prev: theta, prevT: 0 }

    function measure() {
      const rect = wrap!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      px = w / 2
      py = Math.max(18, h * 0.06)
      // Cord reaches a little past mid-height; the badge body hangs below it.
      L = Math.max(90, Math.min(h * 0.46, h - py - 150))
    }

    // Place the badge and redraw the cord for the current angle.
    function place() {
      const ax = px + Math.sin(theta) * L
      const ay = py + Math.cos(theta) * L
      const deg = (theta * 180) / Math.PI
      // The badge attaches at its top-centre to the cord end.
      badge!.style.transform = `translate(-50%, 0) translate(${ax}px, ${ay}px) rotate(${deg}deg)`
      badge!.style.transformOrigin = '50% 0'

      // A soft sag in the cord, biased by the swing so it reads as fabric, not a
      // rigid rod. Control point sits at the midpoint, nudged sideways.
      const mx = (px + ax) / 2 + Math.sin(theta) * 10
      const my = (py + ay) / 2 + 10
      const d = `M ${px} ${py} Q ${mx} ${my} ${ax} ${ay}`
      cord!.setAttribute('d', d)
      strap!.setAttribute('d', d)
    }

    function angleFromPoint(clientX: number, clientY: number) {
      const rect = wrap!.getBoundingClientRect()
      const dx = clientX - rect.left - px
      const dy = clientY - rect.top - py
      // Angle of the vector from the pivot, measured from straight-down.
      return Math.atan2(dx, Math.max(1, dy))
    }

    measure()
    place()

    // Reduced motion: hang still, no loop, no listeners — just keep it placed
    // correctly through resizes.
    if (reduce) {
      const ro = new ResizeObserver(() => {
        measure()
        place()
      })
      ro.observe(wrap)
      return () => ro.disconnect()
    }

    let raf = 0
    let last = performance.now()

    function frame(now: number) {
      let dt = (now - last) / 1000
      last = now
      if (dt > MAX_DT) dt = MAX_DT

      if (!drag.active) {
        // Driven damped pendulum. Accel pulls back toward straight-down; damping
        // bleeds the swing so a throw comes to rest.
        const accel = -(GRAV / L) * Math.sin(theta) - DAMP * omega
        omega += accel * dt
        theta += omega * dt
      }
      place()
      raf = requestAnimationFrame(frame)
    }

    function onDown(e: PointerEvent) {
      drag.active = true
      drag.id = e.pointerId
      drag.prev = theta
      drag.prevT = performance.now()
      omega = 0
      badge!.setPointerCapture?.(e.pointerId)
      badge!.style.cursor = 'grabbing'
      theta = angleFromPoint(e.clientX, e.clientY)
      place()
    }

    function onMove(e: PointerEvent) {
      if (!drag.active || e.pointerId !== drag.id) return
      const next = angleFromPoint(e.clientX, e.clientY)
      const now = performance.now()
      const dt = Math.max(0.001, (now - drag.prevT) / 1000)
      // Carry the throw velocity from how fast the angle is changing.
      omega = (next - drag.prev) / dt
      drag.prev = next
      drag.prevT = now
      theta = next
      place()
    }

    function onUp(e: PointerEvent) {
      if (e.pointerId !== drag.id) return
      drag.active = false
      drag.id = -1
      badge!.releasePointerCapture?.(e.pointerId)
      badge!.style.cursor = 'grab'
      // Clamp any wild flick so the release always reads as a swing, not a spin.
      omega = Math.max(-14, Math.min(14, omega))
    }

    badge!.style.cursor = 'grab'
    badge!.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    const ro = new ResizeObserver(() => {
      measure()
      place()
    })
    ro.observe(wrap)

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      badge!.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      ro.disconnect()
    }
  }, [reduce, name, role, tag])

  return (
    <div ref={wrapRef} className={`relative h-full w-full select-none overflow-hidden ${className}`}>
      {/* The pin the cord hangs from. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[6%] z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-white/10 shadow-[0_0_12px_rgba(220,248,124,0.35)]"
      />

      {/* The cord: a muted strap with a thin lime keeper down its centre. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
        <path ref={strapRef} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={6} strokeLinecap="round" />
        <path ref={cordRef} fill="none" stroke="rgba(220,248,124,0.7)" strokeWidth={1.5} strokeLinecap="round" />
      </svg>

      {/* The badge — real HTML so the type stays crisp and on-brand. */}
      <div
        ref={badgeRef}
        role="img"
        aria-label={`${name}. ${role}.`}
        data-cursor
        className="absolute left-0 top-0 z-10 w-[220px] max-w-[78%] touch-none rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 pt-3 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] will-change-transform"
      >
        {/* Grommet the cord threads through. */}
        <div
          aria-hidden
          className="absolute left-1/2 top-2 h-2.5 w-8 -translate-x-1/2 rounded-full border border-white/20 bg-black/40"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">{tag}</span>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#DCF87C] shadow-[0_0_8px_rgba(220,248,124,0.8)]" />
        </div>
        <div className="mt-3 font-display text-lg font-bold leading-tight tracking-tight text-white">{name}</div>
        <div className="mt-1 text-sm text-white/55">{role}</div>
        <div className="mt-4 h-px w-full bg-white/10" />
        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/30">
          <span>Access</span>
          <span className="text-[#DCF87C]/70">All areas</span>
        </div>
      </div>
    </div>
  )
}
