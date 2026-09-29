import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Geneva drive rebuilt as a working mechanism: turn the crank in a smooth,
// continuous circle and the star wheel answers in exact, indexed steps —
// motion, hold, motion, hold — one station per revolution.
//
// This is the rigid-mechanism corner's answer to a different question than the
// linkages beside it. The four-bar turns rotation into a curve; the
// Peaucellier turns it into a straight line; the Geneva turns *continuous*
// rotation into *intermittent* rotation. A pin on the driving crank enters a
// radial slot in the star wheel, sweeps it round by exactly one station, then
// slides out — and between steps a locking disc on the driver cradles a
// concave scallop of the wheel so it cannot drift. It is the movement that ran
// film projectors (one frame parked in the gate per turn) and indexed the
// tables of automatic machine tools.
//
// The single piece of state is the crank angle. The wheel angle is derived
// from it by the exact geometry of the mechanism, not a lookup or an easing
// curve: the pin's position sets the slot direction, and the wheel turns to
// follow it while the pin is engaged, then holds. The two can never disagree —
// this is the honest part. External Geneva geometry ties everything to one
// choice, the slot count n: the crank pin radius is the centre distance times
// sin(pi/n), so the pin enters and leaves each slot tangentially (no shock),
// the wheel moves for exactly 2*(90 - 180/n) degrees of crank rotation and is
// locked the rest of the turn, and in that window it advances by exactly one
// station, 360/n. An external drive also reverses sense — the wheel turns
// against the crank — which the mechanism does here for real.

const rad = (d: number) => (d * Math.PI) / 180
const norm = (d: number) => ((d % 360) + 360) % 360
const shortest = (a: number, b: number) => ((b - a + 540) % 360) - 180
const fold180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

// Fixed frame (SVG user units). Both wheel centres sit on the horizontal axis;
// the centre distance D is what the whole geometry is scaled around.
const OD = { x: 150, y: 150 } // driver (crank) centre
const OG = { x: 300, y: 150 } // star-wheel centre
const D = OG.x - OD.x // centre distance

interface Geom {
  n: number
  step: number // degrees per station, 360/n
  engage: number // half the crank window during which the wheel moves
  s: number // sin(pi/n) = pinRadius / D
  pinR: number // crank pin radius from OD
  rArm: number // slot mouth / arm-tip radius on the wheel
  rIn: number // closed inner end of each slot
  rBody: number // solid hub disc before the scallops bite the rim
  slotW: number // slot channel width
  rScC: number // scallop centre radius (from OG)
  rSc: number // scallop radius (the concave lock face)
  rCam: number // driver locking-disc radius
}

// Derive every dimension from the slot count so 4- and 6-slot wheels are both
// geometrically true, not two hand-tuned drawings.
function geom(n: number): Geom {
  const step = 360 / n
  const engage = 90 - 180 / n
  const s = Math.sin(Math.PI / n)
  const pinR = D * s
  // Pin distance from OG at the moment of entry/exit — the slot mouth must
  // reach at least this far out, or the pin would miss it.
  const entry = Math.sqrt(D * D + pinR * pinR - 2 * D * pinR * Math.cos(rad(engage)))
  const rArm = entry + 5
  const rIn = D - pinR - 12 // pin is deepest (D - pinR) at mid-engagement
  const rBody = rArm * 0.62
  const rScC = rArm
  const rSc = rArm - rBody + 6
  return { n, step, engage, s, pinR, rArm, rIn, rBody, slotW: 22, rScC, rSc, rCam: rSc * 0.9 }
}

interface Driven {
  wheel: number // absolute wheel rotation in degrees (negative: it turns against the crank)
  steps: number // completed index steps so far (which engagement centre we are nearest)
  a: number // crank angle folded to (-180, 180], measured from the centre line
  moving: boolean
}

// Solve the wheel angle for a crank angle. The engaged slot points from OG at
// the pin, so its bearing is atan2 of the pin about OG; the wheel follows that
// while the pin is inside the slot (|a| <= engage) and is otherwise locked at
// the boundary value it left off at — which is continuous across every seam.
function solve(deg: number, g: Geom): Driven {
  const steps = Math.round(deg / 360)
  const a = deg - steps * 360 // (-180, 180]
  const moving = Math.abs(a) <= g.engage
  let within: number
  if (moving) {
    const ar = rad(a)
    // Bearing of the pin as seen from OG (near 180deg at a = 0, pointing back
    // at the driver); only the ratio matters, so scale by s = pinR / D.
    const phi = (Math.atan2(g.s * Math.sin(ar), g.s * Math.cos(ar) - 1) * 180) / Math.PI
    within = fold180(phi - 180) // +step/2 at entry -> 0 at centre -> -step/2 at exit
  } else {
    within = a > 0 ? -g.step / 2 : g.step / 2
  }
  return { wheel: -steps * g.step + within, steps, a, moving }
}

// A stopped-motion capsule: one slot or scallop drawn as a thick round-capped
// line, used both to cut the mask and to draw the visible channel.
function pol(cx: number, cy: number, r: number, bearingDeg: number) {
  const b = rad(bearingDeg)
  return { x: cx + r * Math.cos(b), y: cy + r * Math.sin(b) }
}

export function GenevaDrive({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const maskId = useId()

  const [slots, setSlots] = useState(6)
  const g = useMemo(() => geom(slots), [slots])

  // Crank angle, unbounded so drag and spin cross the 0/360 seam without a snap.
  const [drive, setDrive] = useState(0)
  const [running, setRunning] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef(false)
  const lastPointer = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastT = useRef(0)

  const d = solve(drive, g)

  // Continuous spin (skipped under reduced motion, where Run indexes one station
  // in a single step rather than sweeping the in-between frames).
  useEffect(() => {
    if (!running || reduce) return
    const tick = (t: number) => {
      if (!lastT.current) lastT.current = t
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      setDrive((v) => v + dt * 60) // 60 deg/s -> a six-second crank revolution
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
    },
    [],
  )

  const pointerAngle = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return lastPointer.current
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 460
    const y = ((clientY - rect.top) / rect.height) * 300
    return norm((Math.atan2(y - OD.y, x - OD.x) * 180) / Math.PI)
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
    const stepDelta = shortest(lastPointer.current, p)
    lastPointer.current = p
    setDrive((v) => v + stepDelta)
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

  const nudge = (delta: number) => {
    setRunning(false)
    setDrive((v) => v + delta)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    const s = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-s)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(s)
    else if (e.key === 'Home') {
      setRunning(false)
      setDrive(0)
    } else if (e.key === 'End') {
      // Index one whole station forward.
      setRunning(false)
      setDrive((v) => Math.round(v / 360) * 360 + 360)
    } else if (e.key === ' ' || e.key === 'Enter') toggleRun()
    else handled = false
    if (handled) e.preventDefault()
  }

  const toggleRun = useCallback(() => {
    if (reduce) {
      // No sweep under reduced motion: index one station at once.
      setDrive((v) => Math.round(v / 360) * 360 + 360)
      return
    }
    setRunning((r) => !r)
  }, [reduce])

  const changeSlots = (n: number) => {
    setRunning(false)
    setSlots(n)
    setDrive(0)
  }

  const phase = Math.round(norm(drive))
  const station = ((d.steps % g.n) + g.n) % g.n
  const engagedSlot = d.moving ? station : -1

  // Slot local bearings: one always points back at the driver (180deg) at rest.
  const slotBearings = Array.from({ length: g.n }, (_, i) => 180 + i * g.step)
  const scallopBearings = slotBearings.map((b) => b + g.step / 2)

  // Driver: crank pin, and the locking-disc relief cut (the wedge the pin
  // sweeps through). Everything below is drawn from the one crank angle.
  const pin = pol(OD.x, OD.y, g.pinR, phase)
  const camGap = g.engage + 10 // the relief spans a touch wider than the move window
  const camStart = phase + camGap
  const camEnd = phase + 360 - camGap
  const camA = pol(OD.x, OD.y, g.rCam, camStart)
  const camB = pol(OD.x, OD.y, g.rCam, camEnd)
  const camLarge = camEnd - camStart > 180 ? 1 : 0

  return (
    <div className={`flex w-full max-w-2xl flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={phase}
        aria-valuetext={`Crank ${phase} degrees, ${d.moving ? 'indexing the wheel' : 'wheel locked'}, station ${station + 1} of ${g.n}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Geneva drive. Drag the crank to turn it, arrow keys nudge the crank angle, Shift for ten degrees, Space runs or
          stops it, Home returns to top-dead-centre and End indexes the wheel one station.
        </span>
        <svg
          ref={svgRef}
          viewBox="0 0 460 300"
          className="h-auto w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <defs>
            <radialGradient id={`${maskId}-body`} cx="0.4" cy="0.35" r="0.85">
              <stop offset="0" stopColor="rgba(255,255,255,0.20)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
            </radialGradient>
            <radialGradient id={`${maskId}-pin`} cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#DCF87C" stopOpacity="0.95" />
              <stop offset="1" stopColor="#c2e85a" stopOpacity="0.85" />
            </radialGradient>
            {/* The star-wheel silhouette: a disc, minus the scallops that bite
                the rim between arms, minus the slots cut into each arm. */}
            <mask id={maskId} maskUnits="userSpaceOnUse">
              <circle cx={OG.x} cy={OG.y} r={g.rArm} fill="#fff" />
              {scallopBearings.map((b, i) => {
                const c = pol(OG.x, OG.y, g.rScC, b)
                return <circle key={`sc${i}`} cx={c.x} cy={c.y} r={g.rSc} fill="#000" />
              })}
              {slotBearings.map((b, i) => {
                const inner = pol(OG.x, OG.y, g.rIn, b)
                const outer = pol(OG.x, OG.y, g.rArm + 8, b)
                return (
                  <line
                    key={`sl${i}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="#000"
                    strokeWidth={g.slotW}
                    strokeLinecap="round"
                  />
                )
              })}
            </mask>
          </defs>

          {/* --- Star wheel (driven), rotated by the derived wheel angle --- */}
          <g transform={`rotate(${d.wheel.toFixed(2)} ${OG.x} ${OG.y})`}>
            <circle cx={OG.x} cy={OG.y} r={g.rArm} fill={`url(#${maskId}-body)`} mask={`url(#${maskId})`} />
            {/* Slot wall definition + the engaged slot lit lime. */}
            {slotBearings.map((b, i) => {
              const inner = pol(OG.x, OG.y, g.rIn, b)
              const outer = pol(OG.x, OG.y, g.rArm, b)
              const lit = i === engagedSlot
              return (
                <line
                  key={`w${i}`}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={lit ? 'rgba(220,248,124,0.5)' : 'rgba(255,255,255,0.14)'}
                  strokeWidth={lit ? g.slotW - 7 : g.slotW - 2}
                  strokeLinecap="round"
                />
              )
            })}
            {/* Hub and bolts. */}
            <circle
              cx={OG.x}
              cy={OG.y}
              r={g.rBody * 0.5}
              fill="#12140f"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
            />
            {slotBearings.map((b, i) => {
              const c = pol(OG.x, OG.y, g.rBody * 0.5 - 8, b)
              return <circle key={`b${i}`} cx={c.x} cy={c.y} r="2" fill="rgba(255,255,255,0.4)" />
            })}
          </g>

          {/* --- Driver: locking disc, crank arm, pin --- */}
          {/* Locking disc arc: the face that cradles a scallop between steps. */}
          <path
            d={`M ${camA.x.toFixed(2)} ${camA.y.toFixed(2)} A ${g.rCam} ${g.rCam} 0 ${camLarge} 1 ${camB.x.toFixed(2)} ${camB.y.toFixed(2)}`}
            fill="none"
            stroke={d.moving ? 'rgba(255,255,255,0.18)' : 'rgba(220,248,124,0.35)'}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx={OD.x} cy={OD.y} r={g.rCam * 0.55} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
          {/* Crank arm out to the pin. */}
          <line
            x1={OD.x}
            y1={OD.y}
            x2={pin.x}
            y2={pin.y}
            stroke="#DCF87C"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx={OD.x} cy={OD.y} r="5" fill="rgba(255,255,255,0.55)" />
          {/* The pin — the whole conversation between the two wheels. */}
          <circle cx={pin.x} cy={pin.y} r="8" fill={`url(#${maskId}-pin)`} stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-lg border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-2 text-center font-mono text-lg tabular-nums text-[#DCF87C]">
          {phase.toString().padStart(3, '0')}&deg;
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-[#DCF87C]/70">crank</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-center font-mono text-sm tabular-nums text-white/70">
          <span className={d.moving ? 'text-[#DCF87C]' : 'text-white/50'}>{d.moving ? 'indexing' : 'locked'}</span>
          <span className="mx-2 text-white/20">·</span>
          station {station + 1}/{g.n}
        </div>
        <button
          type="button"
          onClick={toggleRun}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {reduce ? 'Index once' : running ? 'Stop' : 'Run'}
        </button>
        <div className="flex overflow-hidden rounded-lg border border-white/10">
          {[4, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => changeSlots(n)}
              aria-pressed={slots === n}
              className={`px-3 py-2 text-sm transition-colors ${
                slots === n ? 'bg-[#DCF87C]/15 text-[#DCF87C]' : 'bg-white/[0.03] text-white/60 hover:text-white'
              }`}
            >
              {n} slots
            </button>
          ))}
        </div>
      </div>

      <span aria-live="polite" className="sr-only">
        {`Crank at ${phase} degrees, ${d.moving ? 'wheel indexing' : 'wheel locked'}, station ${station + 1} of ${g.n}`}
      </span>
    </div>
  )
}
