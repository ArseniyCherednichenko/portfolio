import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// An epicyclic (planetary) gear set — the Gear train's honest counterpart. A
// gear train lays its wheels out in a row and the end-to-end ratio is just the
// product of the meshes along it; an epicyclic set folds that train onto a
// single axis. A central sun gear, a ring of planet gears carried on an arm
// (the carrier), and an internal ring gear that encloses them all turn about one
// centre. The trick, and the reason it runs every automatic gearbox, the
// Antikythera mechanism and a cordless drill's reduction, is that THREE members
// share that axis — sun, carrier, ring — and which ratio you get depends on
// which one you hold still. Hold the ring and drive the sun: the carrier crawls
// round, a big reduction, same direction. Hold the sun and drive the carrier:
// the ring races ahead, an overdrive. Hold the carrier and drive the sun: the
// planets spin in place as idlers and the ring turns backwards — a reverse gear.
// One mechanism, three ratios, no wheels added or removed.
//
// It is the same rigid-mechanism honesty as the Gear train: nothing is scripted.
// A single degree of freedom — the input member's angle — fixes every other
// angle through Willis's fundamental train equation
//   (ω_ring − ω_carrier) / (ω_sun − ω_carrier) = −Z_sun / Z_ring,
// which is exactly the rolling condition of the two meshes written once. Solve
// it for the held and output members and each becomes an AFFINE function of the
// input, θ = C·θ_in + Q, with C fixed by the teeth and Q a one-time phase set so
// the teeth actually mesh at home. The planets' own spin falls out of the sun
// mesh, θ_planet = θ_carrier − (Z_sun/Z_planet)(θ_sun − θ_carrier), so a planet
// genuinely rolls on the sun and the ring at once — the picture and the kinematics
// are the same object. The tooth counts obey the two laws a real set must:
// Z_ring = Z_sun + 2·Z_planet (the planets bridge sun to ring), and
// (Z_sun + Z_ring) is divisible by the planet count (so three equally spaced
// planets all mesh). With both satisfied every planet sits an integer number of
// teeth from the next on both the sun and the ring, so one phase constant meshes
// all three.
//
// Canvas sibling of the Gear train: one rAF loop that sleeps when nothing turns,
// DPR-capped, ResizeObserver-driven, physics in refs with no per-frame React
// state, no Date.now or Math.random on the hot path. The canvas is aria-hidden
// decoration with an sr-only account; the mode chips, Run and Reverse are real
// labelled buttons, so the whole thing is drivable and switchable without a
// pointer, and you can also drag any member that is not the one being held.
// Switching the held member returns the set to its meshed home. Under reduced
// motion it is painted once at rest and never auto-turns; dragging a member still
// drives it, just without the idle spin or the fly-wheel coast.

interface PlanetaryGearsProps {
  className?: string
}

// Tooth counts. Z_ring = Z_sun + 2·Z_planet = 18 + 24 = 42, and
// Z_sun + Z_ring = 60 is divisible by the 3 planets — both assembly laws hold.
const Z_SUN = 18
const Z_PLANET = 12
const Z_RING = Z_SUN + 2 * Z_PLANET // 42
const N_PLANETS = 3

// Pitch radii in module units (radius = teeth / 2).
const R_SUN = Z_SUN / 2 // 9
const R_PLANET = Z_PLANET / 2 // 6
const R_CARRIER = R_SUN + R_PLANET // 15 — the orbit radius of a planet centre
const R_RING = Z_RING / 2 // 21

const ADDENDUM = 1 // a tooth reaches one module past the pitch circle
const DEDENDUM = 1.2 // and a little further the other way

// The three ways to run the set. Each names the held member and gives the
// affine coefficients C_sun / C_carrier / C_ring of each member's angle in the
// input angle. Derived once from the teeth, not hand-tuned.
interface Mode {
  key: 'ring' | 'sun' | 'carrier'
  held: string
  input: 'sun' | 'carrier'
  output: string
  Cs: number
  Cc: number
  Cr: number
}

const SUM = Z_SUN + Z_RING // 60

const MODES: Mode[] = [
  // Ring held, drive the sun → the carrier reduces, same direction.
  { key: 'ring', held: 'Ring', input: 'sun', output: 'carrier', Cs: 1, Cc: Z_SUN / SUM, Cr: 0 },
  // Sun held, drive the carrier → the ring overdrives, same direction.
  { key: 'sun', held: 'Sun', input: 'carrier', output: 'ring', Cs: 0, Cc: 1, Cr: SUM / Z_RING },
  // Carrier held, drive the sun → the planets idle and the ring reverses.
  { key: 'carrier', held: 'Carrier', input: 'sun', output: 'ring', Cs: 1, Cc: 0, Cr: -Z_SUN / Z_RING },
]

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

// Base carrier angle of planet k at the home position (θ_in = 0).
const PLANET_BASE = Array.from({ length: N_PLANETS }, (_, k) => (k * Math.PI * 2) / N_PLANETS)

// Each planet's tooth phase at home, set so a planet GAP faces the sun along the
// line of centres — the external-external meshing law (a tooth of the sun meets a
// gap of the planet along φ), the same law the Gear train uses.
const PLANET_PHASE = PLANET_BASE.map(
  (phi) => phi + Math.PI + (Math.PI + Z_SUN * phi) / Z_PLANET,
)

// The ring's tooth phase at home: an internal GAP centred on the outward tooth
// of planet 0 (which points along φ = 0). A half-tooth offset seats the planet
// crest in the ring's valley; the assembly law makes the same offset mesh all
// three planets.
const RING_PHASE = Math.PI / Z_RING

export function PlanetaryGears({ className = '' }: PlanetaryGearsProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [modeKey, setModeKey] = useState<Mode['key']>('ring')
  const modeRef = useRef<Mode>(MODES[0])
  const [running, setRunning] = useState(false)
  const runningFlag = useRef(false)

  // The end-to-end ratio for the current mode, in lowest terms, plus a word.
  const ratio = useMemo(() => {
    if (modeKey === 'ring') {
      const g = gcd(SUM, Z_SUN)
      return { a: SUM / g, b: Z_SUN / g, word: 'reduction', note: 'sun drives, carrier out' }
    }
    if (modeKey === 'sun') {
      const g = gcd(Z_RING, SUM)
      return { a: Z_RING / g, b: SUM / g, word: 'overdrive', note: 'carrier drives, ring out' }
    }
    const g = gcd(Z_RING, Z_SUN)
    return { a: Z_RING / g, b: Z_SUN / g, word: 'reverse', note: 'sun drives, ring out, backwards' }
  }, [modeKey])

  // Screen transform fitting the unit-space set into the canvas.
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })
  const dprRef = useRef(1)

  // Single degree of freedom and its rate; everything else derives.
  const thetaIn = useRef(0)
  const omega = useRef(0)
  const dirRef = useRef(1)

  // Pointer interaction: which member is grabbed, and the last pointer angle.
  const dragRef = useRef<{ coeff: number; prevAngle: number } | null>(null)

  const IDLE_SPEED = 0.5 // rad/s of the input when running
  const FRICTION = 0.6 // per-second velocity retention while coasting

  // Draw one toothed wheel (external) centred at (cx, cy), pitch radius rp in
  // px, with `teeth` teeth rotated to `theta`. Mirrors the Gear train's look.
  const drawExternal = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      rpPx: number,
      scale: number,
      teeth: number,
      theta: number,
      accent: boolean,
    ) => {
      const outer = rpPx + ADDENDUM * scale
      const root = rpPx - DEDENDUM * scale
      const step = (Math.PI * 2) / teeth
      ctx.beginPath()
      for (let k = 0; k < teeth; k++) {
        const a = theta + k * step
        const v0x = cx + Math.cos(a - step * 0.5) * root
        const v0y = cy + Math.sin(a - step * 0.5) * root
        const t0x = cx + Math.cos(a - step * 0.28) * outer
        const t0y = cy + Math.sin(a - step * 0.28) * outer
        const t1x = cx + Math.cos(a + step * 0.28) * outer
        const t1y = cy + Math.sin(a + step * 0.28) * outer
        if (k === 0) ctx.moveTo(v0x, v0y)
        else ctx.lineTo(v0x, v0y)
        ctx.lineTo(t0x, t0y)
        ctx.lineTo(t1x, t1y)
      }
      ctx.closePath()
      const grad = ctx.createRadialGradient(
        cx - outer * 0.3,
        cy - outer * 0.3,
        outer * 0.1,
        cx,
        cy,
        outer,
      )
      grad.addColorStop(0, accent ? 'rgba(40,46,28,1)' : 'rgba(30,30,30,1)')
      grad.addColorStop(1, 'rgba(11,11,11,1)')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(0.8, scale * 0.05)
      ctx.strokeStyle = accent ? 'rgba(220,248,124,0.7)' : 'rgba(255,255,255,0.16)'
      ctx.stroke()

      // Hub, bore, spokes and a lime index mark, so a slow turn stays legible.
      const hub = Math.max(root * 0.26, scale * 0.5)
      const spokes = teeth >= 18 ? 6 : teeth >= 12 ? 5 : 4
      ctx.strokeStyle = accent ? 'rgba(220,248,124,0.4)' : 'rgba(255,255,255,0.14)'
      ctx.lineWidth = Math.max(1, scale * 0.07)
      for (let s = 0; s < spokes; s++) {
        const a = theta + (s * Math.PI * 2) / spokes
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * hub, cy + Math.sin(a) * hub)
        ctx.lineTo(cx + Math.cos(a) * root * 0.84, cy + Math.sin(a) * root * 0.84)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(cx, cy, hub, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(18,18,18,1)'
      ctx.fill()
      ctx.strokeStyle = accent ? 'rgba(220,248,124,0.5)' : 'rgba(255,255,255,0.22)'
      ctx.lineWidth = Math.max(1, scale * 0.06)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, hub * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fill()

      const mrx = cx + Math.cos(theta) * rpPx * 0.66
      const mry = cy + Math.sin(theta) * rpPx * 0.66
      const mr = Math.max(1.4, scale * 0.11)
      const glow = ctx.createRadialGradient(mrx, mry, 0, mrx, mry, mr * 2.4)
      glow.addColorStop(0, 'rgba(220,248,124,0.95)')
      glow.addColorStop(1, 'rgba(220,248,124,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(mrx, mry, mr * 2.4, 0, Math.PI * 2)
      ctx.fill()
    },
    [],
  )

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = sizeRef.current
    const dpr = dprRef.current
    const { scale, ox, oy } = viewRef.current
    const mode = modeRef.current
    const t = thetaIn.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const cx = ox
    const cy = oy
    const thetaSun = mode.Cs * t
    const thetaCarrier = mode.Cc * t
    const thetaRing = mode.Cr * t + RING_PHASE
    const Cp = mode.Cc - (Z_SUN / Z_PLANET) * (mode.Cs - mode.Cc)

    // --- Internal ring gear: an annulus with inward-pointing teeth. ---
    const ringPitch = R_RING * scale
    const ringTip = ringPitch - ADDENDUM * scale // teeth point inward
    const ringValley = ringPitch + DEDENDUM * scale // valleys sit outward
    const ringOuter = ringPitch + 3 * scale
    const stepR = (Math.PI * 2) / Z_RING
    ctx.beginPath()
    ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2)
    // Inner toothed boundary, traced the opposite way for an even-odd hole.
    for (let k = 0; k < Z_RING; k++) {
      const a = thetaRing + k * stepR
      const v0x = cx + Math.cos(a - stepR * 0.5) * ringValley
      const v0y = cy + Math.sin(a - stepR * 0.5) * ringValley
      const t0x = cx + Math.cos(a - stepR * 0.28) * ringTip
      const t0y = cy + Math.sin(a - stepR * 0.28) * ringTip
      const t1x = cx + Math.cos(a + stepR * 0.28) * ringTip
      const t1y = cy + Math.sin(a + stepR * 0.28) * ringTip
      if (k === 0) ctx.moveTo(v0x, v0y)
      else ctx.lineTo(v0x, v0y)
      ctx.lineTo(t0x, t0y)
      ctx.lineTo(t1x, t1y)
    }
    ctx.closePath()
    const ringAccent = mode.held === 'Ring'
    const rg = ctx.createRadialGradient(cx, cy, ringPitch * 0.7, cx, cy, ringOuter)
    rg.addColorStop(0, 'rgba(14,14,14,1)')
    rg.addColorStop(1, ringAccent ? 'rgba(32,38,22,1)' : 'rgba(24,24,24,1)')
    ctx.fillStyle = rg
    ctx.fill('evenodd')
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(0.8, scale * 0.05)
    ctx.strokeStyle = ringAccent ? 'rgba(220,248,124,0.6)' : 'rgba(255,255,255,0.14)'
    ctx.stroke()
    // A lime index mark on the ring body so its (often slow) turn is readable.
    const rmx = cx + Math.cos(thetaRing) * (ringPitch + 1.5 * scale)
    const rmy = cy + Math.sin(thetaRing) * (ringPitch + 1.5 * scale)
    const rmr = Math.max(1.6, scale * 0.12)
    const rglow = ctx.createRadialGradient(rmx, rmy, 0, rmx, rmy, rmr * 2.4)
    rglow.addColorStop(0, 'rgba(220,248,124,0.95)')
    rglow.addColorStop(1, 'rgba(220,248,124,0)')
    ctx.fillStyle = rglow
    ctx.beginPath()
    ctx.arc(rmx, rmy, rmr * 2.4, 0, Math.PI * 2)
    ctx.fill()

    // --- Carrier arm: a plate joining the planet centres through the middle. ---
    const carrierAccent = mode.held === 'Carrier'
    ctx.strokeStyle = carrierAccent ? 'rgba(220,248,124,0.42)' : 'rgba(255,255,255,0.12)'
    ctx.lineWidth = Math.max(2, scale * 0.5)
    ctx.lineCap = 'round'
    for (let k = 0; k < N_PLANETS; k++) {
      const pa = PLANET_BASE[k] + thetaCarrier
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(pa) * R_CARRIER * scale, cy + Math.sin(pa) * R_CARRIER * scale)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'

    // --- Sun gear. ---
    drawExternal(ctx, cx, cy, R_SUN * scale, scale, Z_SUN, thetaSun, mode.held === 'Sun')

    // --- Planets. ---
    for (let k = 0; k < N_PLANETS; k++) {
      const pa = PLANET_BASE[k] + thetaCarrier
      const pcx = cx + Math.cos(pa) * R_CARRIER * scale
      const pcy = cy + Math.sin(pa) * R_CARRIER * scale
      const spin = Cp * t + PLANET_PHASE[k]
      drawExternal(ctx, pcx, pcy, R_PLANET * scale, scale, Z_PLANET, spin, false)
    }
  }, [drawExternal])

  // Fit the whole set (bounded by the ring's outer edge) into the canvas.
  const layout = useCallback(() => {
    const { w, h } = sizeRef.current
    if (!w || !h) return
    const extent = R_RING + 3 // ring outer radius in module units
    const pad = Math.min(w, h) * 0.07
    const scale = Math.min((w - pad * 2) / (2 * extent), (h - pad * 2) / (2 * extent))
    viewRef.current = { scale, ox: w / 2, oy: h / 2 }
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const w = Math.round(wrap.clientWidth)
      const h = Math.round(wrap.clientHeight)
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { w, h }
      dprRef.current = dpr
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      layout()
      paint()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [layout, paint])

  // rAF loop that sleeps when nothing turns.
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const loopFlag = useRef(false)

  const step = useCallback(
    (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now

      const dragging = !!dragRef.current
      if (!dragging) {
        if (runningFlag.current && !reduce) {
          const target = IDLE_SPEED * dirRef.current
          omega.current += (target - omega.current) * Math.min(1, dt * 2.5)
          thetaIn.current += omega.current * dt
        } else {
          thetaIn.current += omega.current * dt
          omega.current *= Math.pow(FRICTION, dt)
          if (Math.abs(omega.current) < 0.0008) omega.current = 0
        }
      }

      paint()

      const alive = dragging || runningFlag.current || Math.abs(omega.current) > 0.0008
      if (alive && !reduce) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        loopFlag.current = false
        lastRef.current = 0
      }
    },
    [paint, reduce],
  )

  const wake = useCallback(() => {
    if (reduce && !dragRef.current) return
    if (loopFlag.current) return
    loopFlag.current = true
    lastRef.current = 0
    rafRef.current = requestAnimationFrame(step)
  }, [reduce, step])

  useEffect(() => {
    if (reduce) {
      paint()
      return
    }
    setRunning(true)
    runningFlag.current = true
    wake()
    return () => cancelAnimationFrame(rafRef.current)
  }, [reduce, wake, paint])

  // Which member a pointer lands on, and the drag coefficient that maps its
  // angular motion about the centre back to the input angle. The held member
  // has coefficient 0 — it is locked and cannot be dragged.
  const memberAt = useCallback((clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { scale, ox, oy } = viewRef.current
    const dx = clientX - rect.left - ox
    const dy = clientY - rect.top - oy
    const r = Math.hypot(dx, dy) / scale
    const mode = modeRef.current
    let coeff = 0
    if (r <= R_SUN + ADDENDUM + 0.5) coeff = mode.Cs // sun
    else if (r >= R_CARRIER - R_PLANET - 0.5 && r <= R_CARRIER + R_PLANET + 0.5) coeff = mode.Cc // planet band → carrier
    else if (r >= R_RING - ADDENDUM - 1 && r <= R_RING + 4) coeff = mode.Cr // ring body
    else return null
    if (Math.abs(coeff) < 1e-6) return null // the held member is locked
    return coeff
  }, [])

  const centreAngle = useCallback((clientX: number, clientY: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    const { ox, oy } = viewRef.current
    return Math.atan2(clientY - rect.top - oy, clientX - rect.left - ox)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    const coeff = memberAt(e.clientX, e.clientY)
    if (coeff === null) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { coeff, prevAngle: centreAngle(e.clientX, e.clientY) }
    omega.current = 0
    wake()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const cur = centreAngle(e.clientX, e.clientY)
    let d = cur - drag.prevAngle
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    drag.prevAngle = cur
    const dIn = d / drag.coeff
    thetaIn.current += dIn
    omega.current = dIn / (1 / 60)
    if (!loopFlag.current) paint()
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    dragRef.current = null
    if (reduce) omega.current = 0
    wake()
  }

  const chooseMode = (m: Mode) => {
    modeRef.current = m
    setModeKey(m.key)
    // Return to the meshed home so switching never shows a jump.
    thetaIn.current = 0
    omega.current = 0
    paint()
    if (runningFlag.current) wake()
  }

  const toggleRun = () => {
    const next = !runningFlag.current
    runningFlag.current = next
    setRunning(next)
    if (next) wake()
  }

  const reverse = () => {
    dirRef.current *= -1
    omega.current *= -1
    if (!runningFlag.current) omega.current += dirRef.current * IDLE_SPEED * 0.6
    wake()
  }

  const mode = MODES.find((m) => m.key === modeKey) ?? MODES[0]

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      <div
        ref={wrapRef}
        className="relative aspect-square w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(130%_130%_at_30%_15%,#141414,#0a0a0a)] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9),inset_0_0_70px_rgba(0,0,0,0.55)]"
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>

      {/* Held-member chips — the whole point: one set, three ratios. */}
      <div className="flex w-full max-w-xl flex-col gap-3">
        <div className="flex items-center justify-center gap-2" role="group" aria-label="Which member to hold still">
          {MODES.map((m) => {
            const on = m.key === modeKey
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => chooseMode(m)}
                aria-pressed={on}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  on
                    ? 'border-[#DCF87C]/60 bg-[#DCF87C]/10 text-[#DCF87C]'
                    : 'border-white/15 bg-white/[0.03] text-white/70 hover:border-[#DCF87C]/40 hover:text-white'
                }`}
              >
                Hold {m.held}
              </button>
            )
          })}
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-white/40">
            <span className="tabular-nums text-white/75">
              {ratio.a} : {ratio.b}
            </span>{' '}
            {ratio.word}
            <span className="text-white/30"> · {ratio.note}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reverse}
              aria-label="Reverse the direction"
              className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
            >
              Reverse
            </button>
            <button
              type="button"
              onClick={toggleRun}
              aria-pressed={running}
              aria-describedby={id}
              className="rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
            >
              {running ? 'Stop' : 'Run'}
            </button>
          </div>
        </div>
      </div>

      <span id={id} className="sr-only">
        {reduce
          ? `An epicyclic (planetary) gear set, shown at rest: a central sun gear, ${N_PLANETS} planet gears on a carrier, inside an internal ring gear. Currently holding the ${mode.held.toLowerCase()} still. Use the Hold chips to change which member is fixed, which changes the ratio; drag any member that is not held to turn the set.`
          : `An epicyclic (planetary) gear set: a central sun gear, ${N_PLANETS} planet gears on a carrier, inside an internal ring gear. Currently holding the ${mode.held.toLowerCase()} still — ${mode.input} drives, ${mode.output} is the output. Press Run to turn it, Reverse to flip direction, the Hold chips to change which member is fixed, or drag any member that is not held. Every angle follows from one input through the gear teeth.`}
      </span>
    </div>
  )
}
