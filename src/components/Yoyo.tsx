import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Yoyo — a working yo-yo with honest rotational physics, and the momentum
// toy this family was missing beside the Fidget spinner and the Turntable.
// Where the spinner is an rpm winding down in place and the Turntable a platter
// you nudge to a steady speed, a yo-yo trades height for spin and back again:
// thrown down, it falls slowly because most of gravity's pull goes into
// spinning it up rather than dropping it, so it reaches the bottom turning
// fast; there, with the string fully out, it "sleeps", its centre still while
// the stored spin bleeds off to friction; a tug then lets the string catch,
// and the spin it has left is spent climbing back up. The honest, teachable
// part is the sleep: sleep too long and the spin falls below what the climb
// costs, and the yo-yo dies at the bottom — you have to reel it in by hand,
// exactly as a real one does.
//
// The whole state is three numbers kept in a ref and integrated on a fixed
// substep off the frame clock — the string paid out, the centre's speed, and
// the spin — so pitch and feel read the same on any monitor and nothing is
// scripted: the slow fall, the fast sleep and the stall-and-fall-back when a
// throw is too weak all fall straight out of the integration. Pure inline SVG
// transformed in the loop, so a fast spin costs no re-renders; a live readout
// reads the phase and the rpm. Under prefers-reduced-motion the loop never
// runs — the yo-yo is shown asleep at the bottom with its spin blurred into a
// ring, and the one control snaps between thrown and reeled-in states so it
// stays fully operable with no travel.

// A falling yo-yo does not drop at g: the string unwinding from the axle forces
// most of the fall into spin, so the centre accelerates at a fraction of g set
// by the disc's moment of inertia against the axle radius. We fold that whole
// relation into one tuned fraction — a believable "about a fifth of gravity" —
// rather than carrying a literal axle radius, and spin is read off the centre's
// speed through one effective winding radius. The feel is honest; the numbers
// are chosen so a throw fills the frame in about a second.
const G = 2000 // px/s^2, the drawing-space gravity
const FALL = 0.22 // fraction of g that actually drops the centre; the rest spins it
const A = G * FALL // centre acceleration, down the string
const R_EFF = 6 // effective winding radius: spin = speed / R_EFF
const STRING = 220 // px, the full length of string paid out at the bottom
const TOP_Y = 40 // y of the fixed finger anchor in viewBox units
const CX = 160 // centre x in viewBox units
const DISC_R = 36 // disc radius in viewBox units
const VB_W = 320
const VB_H = 340

// Sleep losses: the spin bleeds off under a viscous term (fast while fast) and a
// small constant dry-friction term that finally stops it. domega/dt = -(b*w + c).
// Tuned so a good throw sleeps for several seconds and still comes home, and
// only a long sleep slows the axle below the grip threshold and dies.
const SLEEP_VISC = 0.26 // 1/s
const SLEEP_DRY = 0.7 // rad/s^2
// Below this spin the string can no longer grip the axle to climb: the yo-yo is
// asleep for good and must be reeled in by hand.
const RETURN_MIN = 16 // rad/s (~150 rpm)
const REEL_SPEED = 170 // px/s, the hand winding a dead yo-yo back up
// The climb speed a tug supplies — the flick of the hand that engages the
// string, enough to carry the yo-yo home against the same gravity it fell under.
const V_RETURN = Math.sqrt(2 * A * STRING) * 1.08

type Phase = 'idle' | 'down' | 'sleep' | 'up' | 'reel'

interface YoyoState {
  phase: Phase
  s: number // string paid out, 0 (wound at top) .. STRING (bottom)
  v: number // centre speed along the string, +down
  omega: number // spin, rad/s, always >= 0
  omegaReturn: number // spin captured at the tug, spent over the climb
  angle: number // drawn rotation, rad
}

export interface YoyoProps {
  className?: string
}

export function Yoyo({ className = '' }: YoyoProps) {
  const reduce = useReducedMotion()

  const svgRef = useRef<SVGSVGElement | null>(null)
  const discRef = useRef<SVGGElement | null>(null)
  const spokeRef = useRef<SVGGElement | null>(null)
  const stringRef = useRef<SVGLineElement | null>(null)
  const blurRef = useRef<SVGCircleElement | null>(null)

  const stateRef = useRef<YoyoState>({ phase: 'idle', s: 0, v: 0, omega: 0, omegaReturn: 0, angle: 0 })
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number>(0)
  const accRef = useRef<number>(0)
  const runnerRef = useRef<(() => void) | null>(null)

  // Mirrored into React only for the readout and the button label, throttled so
  // the physics never pays for a render.
  const [phase, setPhase] = useState<Phase>('idle')
  const [rpm, setRpm] = useState<number>(0)
  const uiRef = useRef<{ phase: Phase; rpm: number }>({ phase: 'idle', rpm: 0 })

  // Draw the current state straight to the DOM.
  const paint = useCallback(() => {
    const st = stateRef.current
    const discY = TOP_Y + st.s
    if (discRef.current) discRef.current.setAttribute('transform', `translate(${CX} ${discY})`)
    if (spokeRef.current) {
      const deg = (st.angle * 180) / Math.PI
      spokeRef.current.setAttribute('transform', `rotate(${deg})`)
      // Fade the spokes as it spins faster so they smear into a disc, the way a
      // fast wheel reads to the eye; the blur ring takes over the look. Under
      // reduced motion there is no live spin, so the still frame simply reads
      // "thrown" (blurred) or "wound" (crisp) from where the disc sits.
      if (reduce) {
        const thrown = st.s > 1
        spokeRef.current.setAttribute('opacity', thrown ? '0.14' : '1')
        if (blurRef.current) blurRef.current.setAttribute('opacity', thrown ? '0.42' : '0')
      } else {
        const spin = Math.min(1, st.omega / 40)
        spokeRef.current.setAttribute('opacity', String(1 - 0.85 * spin))
        if (blurRef.current) blurRef.current.setAttribute('opacity', String(0.5 * spin))
      }
    }
    if (stringRef.current) stringRef.current.setAttribute('y2', String(discY - DISC_R + 2))
  }, [reduce])

  const syncUi = useCallback(() => {
    const st = stateRef.current
    const nextRpm = Math.round((st.omega * 60) / (2 * Math.PI))
    const prev = uiRef.current
    if (prev.phase !== st.phase || Math.abs(prev.rpm - nextRpm) >= 5 || (nextRpm === 0 && prev.rpm !== 0)) {
      uiRef.current = { phase: st.phase, rpm: nextRpm }
      setPhase(st.phase)
      setRpm(nextRpm)
    }
  }, [])

  // One fixed physics substep.
  const step = useCallback((dt: number) => {
    const st = stateRef.current
    switch (st.phase) {
      case 'down': {
        st.v += A * dt
        st.s += st.v * dt
        st.omega = st.v / R_EFF
        if (st.s >= STRING) {
          // String fully out: the centre stops, the spin is kept — it sleeps.
          st.s = STRING
          st.omega = st.v / R_EFF
          st.v = 0
          st.phase = 'sleep'
        }
        break
      }
      case 'sleep': {
        st.omega = Math.max(0, st.omega - (SLEEP_VISC * st.omega + SLEEP_DRY) * dt)
        break
      }
      case 'up': {
        // Climbing home on the tug: the flick engages the string and the yo-yo
        // rises, decelerating against the same gravity it fell under, while the
        // string winding back on spends the stored spin — so the axle winds
        // down toward still as it reaches the top.
        st.v += A * dt // gravity opposes the upward (negative) motion
        st.s += st.v * dt
        st.omega = st.omegaReturn * Math.max(0, Math.min(1, st.s / STRING))
        if (st.s <= 0) {
          st.s = 0
          st.v = 0
          st.omega = 0
          st.omegaReturn = 0
          st.phase = 'idle'
        }
        break
      }
      case 'reel': {
        // A dead yo-yo wound back up by hand: no spin, a steady climb.
        st.s += -REEL_SPEED * dt
        st.omega = 0
        if (st.s <= 0) {
          st.s = 0
          st.v = 0
          st.phase = 'idle'
        }
        break
      }
      case 'idle':
      default:
        break
    }
    // Advance the drawn rotation by the live spin (down/up turn one way).
    st.angle += st.omega * dt
  }, [])

  // The loop: a fixed-substep accumulator so the integration is frame-rate
  // independent, and it parks itself the moment the yo-yo is idle at the top.
  useEffect(() => {
    if (reduce) return
    const tick = (now: number) => {
      const st = stateRef.current
      const last = lastRef.current || now
      lastRef.current = now
      let frame = (now - last) / 1000
      if (frame > 0.05) frame = 0.05 // clamp a long stall (tab switch)
      accRef.current += frame
      const SUB = 1 / 240
      let guard = 0
      while (accRef.current >= SUB && guard < 32) {
        step(SUB)
        accRef.current -= SUB
        guard += 1
      }
      paint()
      syncUi()
      if (st.phase === 'idle') {
        rafRef.current = null
        lastRef.current = 0
        accRef.current = 0
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    // Only run when something is in motion; start() kicks it.
    const maybeStart = () => {
      if (rafRef.current == null && stateRef.current.phase !== 'idle') {
        lastRef.current = 0
        accRef.current = 0
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    runnerRef.current = maybeStart
    paint()
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      runnerRef.current = null
    }
  }, [reduce, step, paint, syncUi])

  // The single control: throw it, bring it back, or reel a dead one in.
  const act = useCallback(() => {
    const st = stateRef.current
    if (reduce) {
      // No travel: snap between thrown-asleep and wound-at-top.
      if (st.phase === 'idle') {
        st.phase = 'sleep'
        st.s = STRING
        st.v = 0
        st.omega = 0
      } else {
        st.phase = 'idle'
        st.s = 0
        st.v = 0
        st.omega = 0
      }
      st.angle = 0
      paint()
      syncUi()
      return
    }
    if (st.phase === 'idle') {
      st.phase = 'down'
      st.s = 0
      st.v = 0
      st.omega = 0
    } else if (st.phase === 'sleep') {
      if (st.omega >= RETURN_MIN) {
        // Tug: the flick engages the string and the stored spin carries it home.
        st.phase = 'up'
        st.omegaReturn = st.omega
        st.v = -V_RETURN
      } else {
        // Asleep for good: reel it in.
        st.phase = 'reel'
      }
    } else if (st.phase === 'down') {
      // A tug mid-fall still tries to bring it home on whatever spin it has.
      if (st.omega >= RETURN_MIN) {
        st.phase = 'up'
        st.omegaReturn = st.omega
        st.v = -V_RETURN
      } else {
        st.phase = 'reel'
      }
    }
    runnerRef.current?.()
    syncUi()
  }, [reduce, paint, syncUi])

  const label =
    phase === 'idle'
      ? 'Throw it'
      : phase === 'sleep'
      ? rpm >= Math.round((RETURN_MIN * 60) / (2 * Math.PI))
        ? 'Bring it back'
        : 'Reel it in'
      : phase === 'down'
      ? 'Bring it back'
      : phase === 'up'
      ? 'Coming home'
      : 'Reeling in'

  const phaseText =
    phase === 'idle'
      ? 'Wound, at rest'
      : phase === 'down'
      ? 'Falling, spinning up'
      : phase === 'sleep'
      ? rpm >= Math.round((RETURN_MIN * 60) / (2 * Math.PI))
        ? 'Sleeping at the bottom'
        : 'Slept out — reel it in'
      : phase === 'up'
      ? 'Climbing home'
      : 'Reeling in by hand'

  // Reduced-motion still frame: asleep at the bottom with the spin blurred.
  const staticS = reduce ? STRING : stateRef.current.s
  const staticDiscY = TOP_Y + (reduce ? staticS : 0)

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        className="h-auto w-full max-w-[320px] select-none overflow-visible"
        role="img"
        aria-label="A yo-yo on a string, thrown and brought back"
      >
        <defs>
          <radialGradient id="yoyo-face" cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#2a2f1c" />
            <stop offset="55%" stopColor="#1a1d12" />
            <stop offset="100%" stopColor="#0c0e08" />
          </radialGradient>
          <linearGradient id="yoyo-string" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.18)" />
          </linearGradient>
        </defs>

        {/* The finger loop the string hangs from. */}
        <circle cx={CX} cy={TOP_Y - 10} r={7} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} />

        {/* The string. y2 is driven in the loop; set an honest default here. */}
        <line
          ref={stringRef}
          x1={CX}
          y1={TOP_Y}
          x2={CX}
          y2={reduce ? staticDiscY - DISC_R + 2 : TOP_Y - DISC_R + 2}
          stroke="url(#yoyo-string)"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* The disc. In the live version this group is translated each frame; in
            the reduced-motion still it is placed at the bottom. */}
        <g ref={discRef} transform={`translate(${CX} ${reduce ? staticDiscY : TOP_Y})`}>
          {/* Soft contact shadow under the body to seat it in space. */}
          <ellipse cx={0} cy={DISC_R + 8} rx={DISC_R * 0.7} ry={4} fill="rgba(0,0,0,0.5)" />
          {/* The body. */}
          <circle r={DISC_R} fill="url(#yoyo-face)" stroke="rgba(220,248,124,0.25)" strokeWidth={1.5} />
          {/* The blurred spin ring, faded in with speed. */}
          <circle
            ref={blurRef}
            r={DISC_R * 0.62}
            fill="none"
            stroke="#DCF87C"
            strokeWidth={DISC_R * 0.5}
            opacity={reduce ? 0.42 : 0}
          />
          {/* The spokes — a fixed cross of grooves that read the rotation; they
              fade as the spin blurs them into the ring above. */}
          <g ref={spokeRef} opacity={reduce ? 0.14 : 1}>
            <line x1={-DISC_R * 0.8} y1={0} x2={DISC_R * 0.8} y2={0} stroke="rgba(220,248,124,0.7)" strokeWidth={2} />
            <line x1={0} y1={-DISC_R * 0.8} x2={0} y2={DISC_R * 0.8} stroke="rgba(220,248,124,0.4)" strokeWidth={2} />
            <circle r={DISC_R * 0.5} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          </g>
          {/* The axle hub and its highlight. */}
          <circle r={5} fill="#0c0e08" stroke="rgba(220,248,124,0.5)" strokeWidth={1.5} />
          <circle cx={-DISC_R * 0.34} cy={-DISC_R * 0.34} r={DISC_R * 0.22} fill="rgba(255,255,255,0.08)" />
        </g>
      </svg>

      <div className="flex flex-col items-center gap-3">
        <div
          className="min-w-[13rem] text-center text-sm text-white/55"
          aria-live="polite"
        >
          <span className="font-medium text-white/80">{phaseText}</span>
          <span className="mx-2 text-white/20">·</span>
          <span className="tabular-nums">{reduce ? '—' : `${Math.max(0, rpm)} rpm`}</span>
        </div>
        <button
          type="button"
          onClick={act}
          disabled={phase === 'reel' || phase === 'up'}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/[0.08] px-6 py-2 text-sm font-semibold tracking-wide text-[#DCF87C] transition hover:bg-[#DCF87C]/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {label}
        </button>
      </div>
    </div>
  )
}
