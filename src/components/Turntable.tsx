import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A record deck you can actually spin. Not a field, card, or text effect but an
// *object with momentum*: hit play and the platter eases up to speed and the
// tonearm swings down onto the lead-in groove; grab the vinyl and you scrub it
// by hand, and when you let go it keeps the spin you gave it and coasts down on
// friction. Distinct from Clock (a passive dial), SplitFlap (a flipping board)
// and Lanyard (a swinging pendulum): here you impart angular velocity to a
// free-spinning platter and physics carries it. Honest to a11y — the deck is a
// real play/stop toggle with aria-pressed, the platter and arm are decorative
// and aria-hidden, and under reduced motion nothing spins: the record sits
// still, tonearm resting on it, with a plain readable label.

interface TurntableProps {
  /** Line printed on the record label — the "track" title. */
  title?: string
  /** Small second line on the label. */
  subtitle?: string
  className?: string
}

// 33 1/3 rpm, the LP standard, expressed as degrees per second.
const SPIN_SPEED = (33.333 / 60) * 360 // ~200 deg/s
// How hard a released free spin bleeds off, and how fast the platter eases to
// or from target speed while playing. Higher = snappier.
const FRICTION = 1.8
const SPIN_UP = 2.6

function angleFromCenter(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
}

export function Turntable({
  title = 'Side A',
  subtitle = 'hand-built in Berlin',
  className = '',
}: TurntableProps) {
  const reduce = useReducedMotion()
  const [playing, setPlaying] = useState(false)
  const [grabbing, setGrabbing] = useState(false)
  const id = useId()

  const rotation = useMotionValue(0)
  const platterRef = useRef<HTMLDivElement>(null)

  // Physics state kept in refs so the rAF loop reads live values without
  // re-rendering. velocity is deg/s; while a pointer holds the platter we drive
  // rotation directly and measure the velocity it imparts.
  const velocity = useRef(0)
  const dragging = useRef(false)
  const lastAngle = useRef(0)
  const lastDelta = useRef(0)

  useAnimationFrame((_, deltaMs) => {
    if (reduce) return
    const dt = Math.min(deltaMs, 64) / 1000 // clamp long frames (tab was hidden)
    if (dragging.current) {
      // While held, rotation is set from the pointer; keep the platter's own
      // velocity in sync with the last hand motion so a release coasts on.
      velocity.current = lastDelta.current
      return
    }
    // Free platter: ease toward playing speed, or coast down to a stop.
    const target = playing ? SPIN_SPEED : 0
    const k = playing ? SPIN_UP : FRICTION
    velocity.current += (target - velocity.current) * Math.min(1, k * dt)
    if (!playing && Math.abs(velocity.current) < 0.4) velocity.current = 0
    if (velocity.current !== 0) rotation.set(rotation.get() + velocity.current * dt)
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduce || !platterRef.current) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragging.current = true
      setGrabbing(true)
      lastAngle.current = angleFromCenter(platterRef.current, e.clientX, e.clientY)
      lastDelta.current = 0
    },
    [reduce],
  )

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !platterRef.current) return
    const a = angleFromCenter(platterRef.current, e.clientX, e.clientY)
    let d = a - lastAngle.current
    if (d > 180) d -= 360
    else if (d < -180) d += 360
    lastAngle.current = a
    rotation.set(rotation.get() + d)
    // Convert this frame's hand motion into an angular velocity (deg/s) so the
    // coast after release matches how hard the platter was flung. ~60fps.
    lastDelta.current = d * 60
  }, [rotation])

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    dragging.current = false
    setGrabbing(false)
    velocity.current = lastDelta.current
  }, [])

  // The tonearm rests off to the side; on play it swings down onto the record.
  const armDown = reduce || playing
  const armRest = -26
  const armPlay = 6

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      <div className="relative" style={{ width: 320, height: 320 }}>
        {/* Deck plinth */}
        <div className="absolute inset-0 rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]" />
        <div className="absolute inset-3 rounded-[1.6rem] border border-white/[0.06] bg-[radial-gradient(120%_120%_at_30%_20%,#1f1f1f,#111)]" />

        {/* Platter + vinyl */}
        <motion.div
          ref={platterRef}
          aria-hidden
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 select-none rounded-full ${
            reduce ? '' : grabbing ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ rotate: rotation, touchAction: 'none' }}
        >
          {/* Vinyl body with fine grooves */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'repeating-radial-gradient(circle at center, #0a0a0a 0px, #0a0a0a 1px, #141414 2px, #0a0a0a 3px)',
              boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9), 0 10px 30px -10px rgba(0,0,0,0.8)',
            }}
          />
          {/* A single lit groove that sweeps as it turns — the light on the wax */}
          <div
            className="absolute inset-0 rounded-full opacity-70"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(220,248,124,0.14) 18deg, transparent 40deg, transparent 200deg, rgba(255,255,255,0.06) 220deg, transparent 250deg)',
            }}
          />
          {/* Centre label */}
          <div className="absolute left-1/2 top-1/2 flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#DCF87C] text-center shadow-[inset_0_0_0_4px_rgba(0,0,0,0.15)]">
            <span className="font-display text-sm font-bold leading-none text-[#111]">{title}</span>
            <span className="mt-1 max-w-[74px] text-[0.55rem] font-medium uppercase leading-tight tracking-[0.12em] text-black/55">
              {subtitle}
            </span>
            {/* spindle hole */}
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0d0d0d]" />
          </div>
        </motion.div>

        {/* Spindle pin (static, above the label hole) */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#eee] to-[#888] shadow" />

        {/* Tonearm, hinged from the top-right corner */}
        <motion.div
          aria-hidden
          className="absolute right-6 top-6 origin-top-right"
          style={{ width: 150, height: 12 }}
          initial={false}
          animate={{ rotate: armDown ? armPlay : armRest }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 16 }}
        >
          {/* pivot base */}
          <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full border border-white/15 bg-gradient-to-b from-[#2a2a2a] to-[#141414]" />
          {/* arm tube */}
          <span className="absolute right-1 top-1/2 h-[3px] w-[132px] -translate-y-1/2 rounded-full bg-gradient-to-l from-[#cfcfcf] to-[#7c7c7c]" />
          {/* headshell + stylus */}
          <span className="absolute left-0 top-1/2 h-4 w-6 -translate-y-1/2 rounded-sm bg-gradient-to-b from-[#e8e8e8] to-[#9a9a9a]" />
          <span className="absolute -left-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#DCF87C]" />
        </motion.div>
      </div>

      {/* Play / stop */}
      <button
        type="button"
        aria-pressed={playing}
        aria-describedby={id}
        onClick={() => setPlaying((v) => !v)}
        className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
      >
        <span
          className={`grid h-4 w-4 place-items-center transition-colors ${
            playing ? 'text-[#DCF87C]' : 'text-white/60'
          }`}
          aria-hidden
        >
          {playing ? (
            <span className="flex gap-[3px]">
              <span className="h-3 w-[3px] rounded-full bg-current" />
              <span className="h-3 w-[3px] rounded-full bg-current" />
            </span>
          ) : (
            <span className="block h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current" />
          )}
        </span>
        {playing ? 'Stop' : 'Play'}
      </button>
      <span id={id} className="sr-only">
        {reduce
          ? 'A record deck, shown at rest.'
          : 'Play or stop the record. You can also grab the vinyl and spin it by hand.'}
      </span>
    </div>
  )
}
