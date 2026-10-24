import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A fidget spinner, rebuilt as an object with honest angular momentum. Grab a
// lobe and swing it, and the throw you give it is the throw it keeps: on
// release the spinner carries your wrist's angular velocity and winds down
// against bearing friction, exactly as the toy does in a hand. Or press Flick
// for a strong random spin without a pointer. A live readout counts the
// revolutions per minute down as it slows and tallies the total turns, so the
// decay is something you can read, not just watch.
//
// Distinct from its neighbours in the toys family. The Turntable is a platter
// you nudge to a steady speed; the Dice is a throw that settles on a face; the
// Magic 8-ball answers in words. This one is about *spin-down* — the single
// gesture of a flick and the long, honest coast back to rest — and it is the
// one here whose whole point is a quantity (rpm) decaying in real time.
//
// The physics is real, not scripted. Angular velocity integrates the rotation
// each frame and decays under two frictions at once: a viscous term (omega *=
// e^(-k*dt), the air and bearing drag that dominates while it is fast) and a
// small Coulomb term (a constant deg/s shaved off each second, the dry seal
// friction that finally brings it to a dead stop rather than an endless crawl).
// Grabbing it mid-spin kills the momentum and hands control back to the wrist,
// the way catching a real spinner does.
//
// Built as pure inline SVG transformed by hand in the animation loop — the
// rotating group's transform is written directly, never through React state, so
// a fast spin costs no re-renders; only the throttled rpm/turns readout updates
// React. The body is neutral metal with a lime bearing and lime lobe rims, the
// house accent carrying the one bit that should read as "live". The spinner is
// a labelled button (Enter/Space flicks it) and the rpm is announced politely.
//
// Reduced motion: no continuous spin and no vestibular travel. A flick instead
// lands the spinner at a new resting orientation at once, dragging turns it
// directly with no momentum on release, and the readout shows a dash with a
// note — the toy stays operable as a thing you can turn by hand, just without
// the coast.

interface FidgetSpinnerProps {
  /** Width/height of the spinner in px. */
  size?: number
  className?: string
}

// Viscous drag: fraction of angular velocity kept per second, applied as a
// continuous decay (omega *= e^(-DRAG*dt)). Higher = stops sooner.
const DRAG = 0.9
// Coulomb (dry) friction: deg/s of angular velocity removed each second,
// independent of speed. This is what finally parks it instead of an asymptote.
const COULOMB = 90
// Below this |omega| (deg/s) the spinner is treated as stopped.
const STOP = 8
// A flick from the button, in deg/s. ~2160 deg/s = 360 rpm.
const FLICK_MIN = 1500
const FLICK_MAX = 2400
// Cap on the speed a wrist-throw can impart, so a frantic drag stays physical.
const MAX_OMEGA = 3600

// Shortest signed difference between two angles (deg), in (-180, 180].
function angleDelta(to: number, from: number): number {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function FidgetSpinner({ size = 240, className = '' }: FidgetSpinnerProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const [rpm, setRpm] = useState(0)
  const [turns, setTurns] = useState(0)
  const [spinning, setSpinning] = useState(false)

  const groupRef = useRef<SVGGElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Live physics state kept in refs so the loop never leans on React.
  const rotation = useRef(0) // current angle, deg
  const omega = useRef(0) // angular velocity, deg/s
  const revAccum = useRef(0) // |degrees| travelled since reset, for the turns tally
  const rafRef = useRef<number | null>(null)
  const lastTs = useRef(0)
  const readoutTs = useRef(0)

  // Drag bookkeeping.
  const dragging = useRef(false)
  const pointerId = useRef<number | null>(null)
  const lastAngle = useRef(0) // last pointer angle to the centre, deg
  const samples = useRef<{ t: number; rot: number }[]>([]) // recent (time, rotation) for release velocity

  const applyTransform = useCallback(() => {
    const g = groupRef.current
    if (g) g.setAttribute('transform', `rotate(${rotation.current} 100 100)`)
  }, [])

  const pushReadout = useCallback(
    (force = false) => {
      const now = performance.now()
      if (!force && now - readoutTs.current < 90) return
      readoutTs.current = now
      setRpm(Math.round((Math.abs(omega.current) / 360) * 60))
      setTurns(Math.floor(revAccum.current / 360))
    },
    [],
  )

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const tick = useCallback(
    (ts: number) => {
      if (lastTs.current === 0) lastTs.current = ts
      let dt = (ts - lastTs.current) / 1000
      lastTs.current = ts
      // Guard against a huge dt after a tab is backgrounded — never teleport.
      if (dt > 0.05) dt = 0.05

      // Viscous decay, then a flat Coulomb shave toward zero.
      omega.current *= Math.exp(-DRAG * dt)
      const shave = COULOMB * dt
      if (Math.abs(omega.current) <= shave) omega.current = 0
      else omega.current -= Math.sign(omega.current) * shave

      const step = omega.current * dt
      rotation.current += step
      revAccum.current += Math.abs(step)
      applyTransform()
      pushReadout()

      if (Math.abs(omega.current) < STOP) {
        omega.current = 0
        rafRef.current = null
        lastTs.current = 0
        setSpinning(false)
        pushReadout(true)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [applyTransform, pushReadout],
  )

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return
    lastTs.current = 0
    setSpinning(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const flick = useCallback(() => {
    if (reduce) {
      // No coast: land at a fresh resting orientation at once.
      rotation.current += 120 + Math.random() * 300
      applyTransform()
      setRpm(0)
      setTurns((t) => t + 1)
      return
    }
    const dir = Math.random() < 0.5 ? -1 : 1
    omega.current = dir * (FLICK_MIN + Math.random() * (FLICK_MAX - FLICK_MIN))
    pushReadout(true)
    startLoop()
  }, [reduce, applyTransform, pushReadout, startLoop])

  // Pointer angle (deg) from the spinner's centre.
  const angleAt = useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current
    if (!svg) return 0
    const r = svg.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Catch a spinning toy: kill the coast, hand control to the wrist.
      stopLoop()
      omega.current = 0
      lastTs.current = 0
      setSpinning(false)
      dragging.current = true
      pointerId.current = e.pointerId
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      lastAngle.current = angleAt(e.clientX, e.clientY)
      samples.current = [{ t: performance.now(), rot: rotation.current }]
    },
    [stopLoop, angleAt],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || e.pointerId !== pointerId.current) return
      const a = angleAt(e.clientX, e.clientY)
      rotation.current += angleDelta(a, lastAngle.current)
      lastAngle.current = a
      applyTransform()
      const now = performance.now()
      samples.current.push({ t: now, rot: rotation.current })
      // Keep only the last ~120ms of travel for the release-velocity estimate.
      while (samples.current.length > 2 && now - samples.current[0].t > 120) {
        samples.current.shift()
      }
    },
    [angleAt, applyTransform],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || e.pointerId !== pointerId.current) return
      dragging.current = false
      pointerId.current = null
      ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
      if (reduce) return // no momentum under reduced motion

      const s = samples.current
      if (s.length >= 2) {
        const first = s[0]
        const last = s[s.length - 1]
        const dtSec = (last.t - first.t) / 1000
        if (dtSec > 0) {
          let w = (last.rot - first.rot) / dtSec
          w = Math.max(-MAX_OMEGA, Math.min(MAX_OMEGA, w))
          omega.current = w
          if (Math.abs(w) >= STOP) {
            pushReadout(true)
            startLoop()
          }
        }
      }
      samples.current = []
    },
    [reduce, pushReadout, startLoop],
  )

  useEffect(() => stopLoop, [stopLoop])

  const S = size
  const liveRpm = reduce ? '—' : spinning ? `${rpm}` : `${rpm}`

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div style={{ width: S, height: S }} className="relative flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          width={S}
          height={S}
          role="button"
          tabIndex={0}
          aria-label={
            reduce
              ? 'Fidget spinner. Press to turn it to a new position, or drag a lobe to turn it.'
              : spinning
                ? `Fidget spinner, spinning at ${rpm} rpm. Press to flick it again, or grab it to stop.`
                : 'Fidget spinner. Press to flick it, or drag a lobe to spin it.'
          }
          aria-describedby={`${id}-live`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              flick()
            }
          }}
          className="cursor-grab touch-none select-none rounded-full outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
          style={{ display: 'block' }}
        >
          <defs>
            <radialGradient id={`${id}-body`} cx="38%" cy="32%" r="80%">
              <stop offset="0%" stopColor="#2b2b2e" />
              <stop offset="55%" stopColor="#171719" />
              <stop offset="100%" stopColor="#0a0a0b" />
            </radialGradient>
            <radialGradient id={`${id}-cap`} cx="40%" cy="34%" r="72%">
              <stop offset="0%" stopColor="#4a4a4e" />
              <stop offset="100%" stopColor="#1c1c1f" />
            </radialGradient>
            <radialGradient id={`${id}-hub`} cx="42%" cy="36%" r="70%">
              <stop offset="0%" stopColor="#e9ffa6" />
              <stop offset="55%" stopColor="#DCF87C" />
              <stop offset="100%" stopColor="#9bc23a" />
            </radialGradient>
          </defs>

          {/* The rotating body: a three-lobe spinner around a central bearing. */}
          <g ref={groupRef} transform="rotate(0 100 100)">
            {/* Three arms + lobes at 0, 120, 240 degrees. */}
            {[0, 120, 240].map((deg) => {
              const rad = (deg * Math.PI) / 180
              const lx = 100 + Math.cos(rad) * 54
              const ly = 100 + Math.sin(rad) * 54
              return (
                <g key={deg}>
                  {/* Web joining the hub to the lobe */}
                  <path
                    d={`M 100 100 L ${lx} ${ly}`}
                    stroke={`url(#${id}-body)`}
                    strokeWidth="46"
                    strokeLinecap="round"
                  />
                  {/* Outer bearing lobe */}
                  <circle cx={lx} cy={ly} r="30" fill={`url(#${id}-body)`} />
                  <circle cx={lx} cy={ly} r="30" fill="none" stroke="#DCF87C" strokeWidth="1.5" opacity="0.55" />
                  {/* Weight cap in the lobe */}
                  <circle cx={lx} cy={ly} r="17" fill={`url(#${id}-cap)`} />
                  <circle cx={lx} cy={ly} r="17" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                  {/* A mark on each cap so the spin is unmistakable */}
                  <circle cx={lx} cy={ly - 10} r="2.4" fill="rgba(255,255,255,0.28)" />
                </g>
              )
            })}

            {/* Central body disc under the hub */}
            <circle cx="100" cy="100" r="40" fill={`url(#${id}-body)`} />
            <circle cx="100" cy="100" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

            {/* The lime centre bearing — the live heart of the toy */}
            <circle cx="100" cy="100" r="22" fill={`url(#${id}-hub)`} />
            <circle cx="100" cy="100" r="22" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
            {/* Bearing inner race + a notch, so the hub itself reads as turning */}
            <circle cx="100" cy="100" r="9" fill="#12140b" />
            <circle cx="100" cy="100" r="9" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
            <rect x="98.5" y="79" width="3" height="9" rx="1.5" fill="#12140b" />
          </g>
        </svg>
      </div>

      <div className="mt-8 flex w-full max-w-sm flex-col items-center">
        <div className="flex items-end gap-8">
          <div className="flex flex-col items-center">
            <span
              id={`${id}-live`}
              aria-live="polite"
              className="font-display text-4xl font-semibold tabular-nums leading-none text-[#DCF87C]"
            >
              {liveRpm}
            </span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">rpm</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-display text-4xl font-semibold tabular-nums leading-none text-white/85">
              {turns}
            </span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">turns</span>
          </div>
        </div>

        <button
          type="button"
          onClick={flick}
          className="mt-6 rounded-full border border-white/15 bg-white/[0.04] px-6 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          {reduce ? 'Turn it' : 'Flick'}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-white/35">
          {reduce
            ? 'Motion reduced — it turns to a new position instead of coasting.'
            : 'Grab a lobe and swing it, or press Flick. Catch it to stop.'}
        </p>
      </div>
    </div>
  )
}
