import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A ratchet and pawl rebuilt as a working mechanism: a toothed wheel on a fixed
// axle, each tooth a long gentle slope that ends in a steep radial face, and a
// single spring-loaded pawl resting on the rim. Turn the wheel forward and the
// pawl rides up each slope and snaps down into the next notch — one click per
// tooth, the count ticking up. Try to turn it back and the steep face catches
// the pawl flat: the wheel will not move. Rotation in, monotonic advance out.
//
// It belongs in the rigid-mechanism corner beside the others that trade one
// kind of motion for another, but it is the only one that enforces a direction.
// The Scotch yoke turns rotation into a sine, the slider-crank into a lopsided
// stroke, the rack and pinion into a straight line, the Geneva into indexed
// steps — all of them run either way you drive them. The ratchet is the corner's
// mechanical diode: forward is free, reverse is impossible. It is the piece
// under every winch, socket wrench, hoist and zip tie — anywhere motion is
// allowed to accumulate but never to give itself back.
//
// The honest part is that there is exactly one stored value: a forward-only
// drive angle that never decreases. The wheel's rotation, the tooth count, the
// pawl's rise and fall, and the lock on reverse are all read from it, so they
// can never drift out of agreement. The tooth count is floor(drive / pitch):
// each full angular pitch of forward turn is one tooth passed, one click, one
// increment — and because the drive can only grow, the count can only grow with
// it. The pawl's height is read straight off the tooth profile at the contact
// point, so the arm rocks on the real surface rather than on a separate timer.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
// Shortest signed screen-angle delta, degrees, clockwise positive (y points
// down in SVG space, so a clockwise sweep reads as an increasing angle).
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180

// Fixed frame (SVG user units).
const VIEW_W = 460
const VIEW_H = 360
const O = { x: 210, y: 192 } // wheel axle
const N = 16 // teeth
const RP = 112 // pitch radius (where the pawl tip rests at a notch)
const ADD = 18 // tooth height above the root
const RA = RP + ADD // tip radius (the shoulder before each steep face)
const RD = RP // root radius — the notch the pawl drops into
const ALPHA = (2 * Math.PI) / N // angular pitch, one tooth-and-notch (radians)
const ALPHA_DEG = 360 / N
const HUB = 30 // hub disc radius

// The pawl: a stiff arm hinged at a fixed pivot, its nose resting on the rim at
// the top of the wheel. As a tooth passes, the nose is lifted along the slope
// and then snaps into the next notch — the arm rocks about this pivot.
const CONTACT_DEG = -90 // straight up from the axle: the pawl meets the rim here
const PIVOT = { x: O.x + 150, y: O.y - 150 } // fixed hinge, up and to the right

const polar = (r: number, ang: number) => ({
  x: O.x + r * Math.cos(ang),
  y: O.y + r * Math.sin(ang),
})

// Tooth surface radius at a world angle, given the wheel's rotation. Each tooth
// runs from a tip (RA) down a gentle slope to a root (RD) over one angular
// pitch, then jumps back up the steep radial face. t is the fraction travelled
// down the current slope, measured from the tip just behind the steep face.
const surfaceRadius = (worldAng: number, rotR: number) => {
  let t = ((worldAng - rotR) / ALPHA) % 1
  if (t < 0) t += 1
  return RA - (RA - RD) * t
}

export function Ratchet({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const gid = useId()

  // The one stored value: a forward-only drive angle in degrees. It never
  // decreases — that invariant *is* the mechanism.
  const [drive, setDrive] = useState(0)
  const [running, setRunning] = useState(false)
  // A brief flag raised when a reverse is attempted, so the lock reads visibly.
  const [locked, setLocked] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)
  const lockTimer = useRef<number | null>(null)

  const rotR = rad(drive)
  const teeth = Math.floor(drive / ALPHA_DEG + 1e-9) // clicks counted — monotonic

  // Raise the lock flag, then clear it after a beat. Used on any reverse push.
  const flashLock = useCallback(() => {
    setLocked(true)
    if (lockTimer.current) window.clearTimeout(lockTimer.current)
    lockTimer.current = window.setTimeout(() => setLocked(false), 450)
  }, [])

  // Continuous forward run (skipped under reduced motion, where Step clicks one
  // tooth). An unhurried turn so every click is legible.
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * ALPHA_DEG * 1.3) // ~1.3 teeth per second
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastT.current = 0
    }
  }, [running, reduce])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (lockTimer.current) window.clearTimeout(lockTimer.current)
    },
    [],
  )

  // The wheel outline: N asymmetric teeth. Each tooth is a tip at RA, a gentle
  // slope down to a root at RD over one pitch, then a steep radial face back up
  // to the next tip at the same angle. The gentle side is the one the pawl rides
  // forward; the steep side is the one that catches it on reverse.
  const wheelPath = useMemo(() => {
    let d = ''
    for (let i = 0; i < N; i++) {
      const tip = polar(RA, rotR + i * ALPHA) // shoulder just past a steep face
      const root = polar(RD, rotR + (i + 1) * ALPHA) // bottom of the gentle slope
      d += `${i === 0 ? 'M' : 'L'}${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L${root.x.toFixed(2)} ${root.y.toFixed(2)} `
    }
    return `${d.trim()} Z`
  }, [rotR])

  // The pawl, read off the surface. Its nose sits a touch proud of the rim at
  // the contact angle; the arm runs from the fixed pivot to that nose, so it
  // rocks as the nose rises up each slope and drops into each notch.
  const pawl = useMemo(() => {
    const r = surfaceRadius(rad(CONTACT_DEG), rotR) + 3
    const nose = polar(r, rad(CONTACT_DEG))
    // How high the nose sits between notch (0) and shoulder (1) — the click.
    const lift = (r - (RD + 3)) / (RA - RD)
    // A short backstop stub drawn on the far side of the nose, the spring return.
    const ang = Math.atan2(nose.y - PIVOT.y, nose.x - PIVOT.x)
    const perp = ang + Math.PI / 2
    const half = 7
    const a = { x: PIVOT.x + half * Math.cos(perp), y: PIVOT.y + half * Math.sin(perp) }
    const b = { x: PIVOT.x - half * Math.cos(perp), y: PIVOT.y - half * Math.sin(perp) }
    const noseW = 4.5
    const n1 = { x: nose.x + noseW * Math.cos(perp), y: nose.y + noseW * Math.sin(perp) }
    const n2 = { x: nose.x - noseW * Math.cos(perp), y: nose.y - noseW * Math.sin(perp) }
    const body = `M${a.x.toFixed(2)} ${a.y.toFixed(2)} L${n1.x.toFixed(2)} ${n1.y.toFixed(2)} L${n2.x.toFixed(2)} ${n2.y.toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`
    return { nose, body, lift }
  }, [rotR])

  const spoke = polar(HUB - 6, rotR) // hub keyway, so the turn reads on the disc

  // --- Pointer: drag forward to turn. Backward is rejected — that is the lock. ---
  const pointerAngle = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return lastPointer.current
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * VIEW_W
    const y = ((clientY - rect.top) / rect.height) * VIEW_H
    return norm((Math.atan2(y - O.y, x - O.x) * 180) / Math.PI)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    setRunning(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    lastPointer.current = pointerAngle(e.clientX, e.clientY)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const p = pointerAngle(e.clientX, e.clientY)
    const delta = shortest(lastPointer.current, p) // clockwise-positive
    lastPointer.current = p
    if (delta > 0.05) {
      setDrive((v) => v + delta) // forward: the wheel turns and counts up
    } else if (delta < -0.6) {
      flashLock() // a real backward push — the pawl holds, nothing moves
    }
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  const stepForward = useCallback((n = 1) => {
    setRunning(false)
    setDrive((v) => v + ALPHA_DEG * n)
  }, [])

  const toggleRun = useCallback(() => {
    if (reduce) {
      stepForward(1) // no sweep: advance exactly one tooth
      return
    }
    setRunning((r) => !r)
  }, [reduce, stepForward])

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const n = e.shiftKey ? 4 : 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') stepForward(n)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') flashLock() // reverse is locked
    else if (e.key === 'Home') {
      setRunning(false)
      setDrive(0)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={9999}
        aria-valuenow={teeth}
        aria-valuetext={`${teeth} ${teeth === 1 ? 'tooth' : 'teeth'} advanced, forward only — reverse is locked by the pawl`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Ratchet and pawl. Drag the wheel clockwise to turn it forward; it counts up one tooth per click and the pawl
          holds it against any backward push. Right or Up arrow advances one tooth, Shift for four, Left or Down attempts
          to reverse and is locked, Space runs or stops, Home returns to zero. A live region reads the number of teeth
          advanced.
        </span>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${gid}-disc`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </radialGradient>
            <radialGradient id={`${gid}-hub`} cx="0.4" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#DCF87C" stopOpacity="0.9" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.8" />
            </radialGradient>
            <linearGradient id={`${gid}-pawl`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>
          </defs>

          {/* Pitch circle — the ring the pawl rests on when seated in a notch */}
          <circle cx={O.x} cy={O.y} r={RP} fill="none" stroke="rgba(220,248,124,0.16)" strokeDasharray="2 6" strokeWidth={1} />

          {/* The toothed wheel: faint disc, sawtooth rim, lime hub with a keyway */}
          <circle cx={O.x} cy={O.y} r={RD} fill={`url(#${gid}-disc)`} />
          <path
            d={wheelPath}
            fill="rgba(16,16,16,0.92)"
            stroke={locked ? 'rgba(220,248,124,0.85)' : 'rgba(255,255,255,0.3)'}
            strokeWidth={locked ? 2 : 1.4}
            strokeLinejoin="round"
          />
          <circle cx={O.x} cy={O.y} r={HUB} fill="rgba(10,10,10,0.95)" stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} />
          <circle cx={O.x} cy={O.y} r={9} fill={`url(#${gid}-hub)`} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
          <line x1={O.x} y1={O.y} x2={spoke.x} y2={spoke.y} stroke="rgba(220,248,124,0.55)" strokeWidth={3} strokeLinecap="round" />

          {/* Forward-only arc arrow, swept around the top-left so the one
              permitted direction reads at a glance */}
          <path
            d={`M${O.x - 4} ${O.y - RA - 14} A ${RA + 14} ${RA + 14} 0 0 1 ${polar(RA + 14, rad(-150)).x} ${polar(RA + 14, rad(-150)).y}`}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <path d={`M${O.x - 12} ${O.y - RA - 20} L${O.x - 1} ${O.y - RA - 12} L${O.x - 12} ${O.y - RA - 8}`} fill="none" stroke="rgba(220,248,124,0.5)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* The spring behind the pawl — a hint of the force that keeps the nose
              pressed to the rim, drawn as a short zig from an anchor to the pivot */}
          <path
            d={`M${PIVOT.x + 34} ${PIVOT.y - 24} l-6 6 l10 4 l-10 4 l10 4 l-8 6`}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* The pawl: a fixed hinge and an arm whose nose rests on the rim */}
          <path d={pawl.body} fill={`url(#${gid}-pawl)`} stroke={locked ? '#DCF87C' : 'rgba(255,255,255,0.4)'} strokeWidth={locked ? 2 : 1.4} strokeLinejoin="round" />
          <circle cx={PIVOT.x} cy={PIVOT.y} r={7} fill="rgba(10,10,10,0.95)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.4} />
          <circle cx={PIVOT.x} cy={PIVOT.y} r={2.4} fill="rgba(255,255,255,0.5)" />
          {/* The nose, brightening as it drops into a notch (the click home) */}
          <circle
            cx={pawl.nose.x}
            cy={pawl.nose.y}
            r={4}
            fill={locked ? '#DCF87C' : `rgba(220,248,124,${(0.4 + (1 - pawl.lift) * 0.55).toFixed(2)})`}
            stroke="#0B0B0B"
            strokeWidth={1.2}
          />
        </svg>
      </div>

      {/* Live readout — the click count and the lock, always read from the one
          stored value so they can never disagree with the wheel */}
      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          {teeth} {teeth === 1 ? 'tooth' : 'teeth'}
        </span>
        <span
          className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur transition-colors ${
            locked ? 'border-[#DCF87C]/60 bg-[#DCF87C]/[0.12] text-[#DCF87C]' : 'border-white/10 bg-black/40 text-white/45'
          }`}
        >
          {locked ? 'Locked' : 'Forward only'}
        </span>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/[0.12]"
        >
          {reduce ? 'Step' : running ? 'Stop' : 'Run'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false)
            setDrive(0)
          }}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Reset
        </button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {locked ? 'Locked. The pawl holds the wheel; it will not turn backward.' : `${teeth} teeth advanced.`}
      </p>
    </div>
  )
}
