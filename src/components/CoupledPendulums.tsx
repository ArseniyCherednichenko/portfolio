import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useReducedMotion } from 'framer-motion'

// Two coupled pendulums — the sympathetic-pendulum demo, where energy is not
// spent but lent. Hang two identical bobs of the same length side by side and
// join them with a light spring near the top. Lift the left one and let go: it
// swings, the spring tugs the right one into step, and over a slow beat the
// left pendulum winds down to a standstill while the right one, which started
// at rest, swings in its place with all the motion. Then it hands it back. The
// energy sloshes across the pair forever, a whole in motion that is never in
// motion in the same place twice.
//
// This is the coupled counterpart to the Pendulum wave in this family. That
// rack is a row of *independent* pendulums, each a pure cosine, tuned so the
// eye reads a travelling wave in their drift. This one is the opposite story:
// two pendulums that genuinely talk to each other through the spring, so the
// motion of one is the cause of the other's. And it is the gentle sibling of
// the Double pendulum's chaos — coupling two swings here gives order, a clean
// beat you can set your watch by, not a scatter.
//
// THE TRICK is that the whole thing is linear in the small-angle regime, so it
// has an *exact* closed form — no stepper, no integration drift, no Date.now.
// Any motion of the pair is a sum of two normal modes: the symmetric mode (both
// swing together, the spring never stretches, frequency ω_s = ω₀) and the
// antisymmetric mode (they swing opposite, the spring works hardest, a faster
// frequency ω_d = ω₀·√(1+2κ)). Release the left bob from rest with the right at
// rest and each mode is excited at half amplitude, so:
//     θ_L = ½A(cos ω_s t + cos ω_d t),  θ_R = ½A(cos ω_s t − cos ω_d t)
// — two cosines beating against each other. The product form makes the beat
// plain: θ_L rides a slow cos((ω_d−ω_s)/2 · t) envelope and θ_R a sin() one, so
// the energy, which goes as the envelope squared, reads cos² on the left and
// sin² on the right and the two ALWAYS SUM TO ONE. Nothing is created or lost;
// it only moves. The twin meter under the pendulums shows exactly that slosh.
//
// LIVE: press (or Space) to re-release from the clean start — left bob lifted,
// right at rest. The up/down arrows change the spring stiffness κ: a stiffer
// spring couples the two harder, so the energy crosses faster — the beat
// quickens, the readout updates. Home resets the spring to its default. The
// carrier swing keeps its true speed at any refresh rate because the phase is
// frame-accumulated, never read off the wall clock. Under reduced motion the
// loop never starts: a single frame is painted mid-handover, energy split
// across the pair with the spring visibly stretched, and the readout still
// reports that split — it is a labelled diagram, held still.

const OMEGA0 = (2 * Math.PI) / 2.6 // uncoupled swing: one period every 2.6s
const AMP = 0.42 // release amplitude, radians (~24deg)
const K_MIN = 0.06
const K_MAX = 0.42
const K_DEFAULT = 0.18
const K_STEP = 0.04
const COUPLE_FRAC = 0.5 // where down the rods the spring attaches (0 top, 1 bob)

export function CoupledPendulums({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  // Coupling lives in a ref so the arrows can tune it without restarting the
  // animation effect (which would reset the beat). A tiny bit of state mirrors
  // it only so the visible stiffness label re-renders.
  const kappaRef = useRef(K_DEFAULT)
  const [kappaLabel, setKappaLabel] = useState(K_DEFAULT)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let pivotY = 0
    let px1 = 0
    let px2 = 0
    let len = 0
    let bob = 0
    let raf = 0
    let t = 0 // seconds of phase, frame-accumulated — no wall clock
    let last = -1
    // A press gathers the pair back to the clean release: `blend` eases the
    // live phase toward 0 so the hand-off restarts as a lift, not a jump cut.
    let blend = 0

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      pivotY = Math.round(h * 0.13)
      const gap = Math.min(w * 0.34, 220)
      px1 = Math.round(w / 2 - gap / 2)
      px2 = Math.round(w / 2 + gap / 2)
      // Leave room at the foot for the twin energy meter.
      len = (h - pivotY) * 0.68
      bob = Math.max(6, Math.min(13, gap * 0.08))
    }

    // Draw the coupling spring as a zig-zag between the two rods at COUPLE_FRAC
    // down, its line brightening with how far it is stretched from its rest
    // length (the pivot gap) so the eye can see where the force lives.
    function spring(ax: number, ay: number, bxp: number, byp: number, rest: number) {
      const dx = bxp - ax
      const dy = byp - ay
      const dist = Math.hypot(dx, dy) || 1
      const stretch = Math.min(1, Math.abs(dist - rest) / (rest * 0.5))
      const coils = 9
      const amp = Math.min(7, bob * 0.7)
      const nx = -dy / dist // unit normal, for the zig-zag offset
      const ny = dx / dist
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${0.22 + stretch * 0.5})`
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      ctx!.moveTo(ax, ay)
      for (let i = 1; i < coils; i++) {
        const u = i / coils
        const side = i % 2 === 0 ? 1 : -1
        ctx!.lineTo(ax + dx * u + nx * amp * side, ay + dy * u + ny * amp * side)
      }
      ctx!.lineTo(bxp, byp)
      ctx!.stroke()
    }

    function bobAt(px: number, angle: number) {
      return { x: px + Math.sin(angle) * len, y: pivotY + Math.cos(angle) * len }
    }

    function drawBob(x: number, y: number, edge: number) {
      const glow = 0.3 + edge * 0.6
      ctx!.save()
      ctx!.globalCompositeOperation = 'lighter'
      const g = ctx!.createRadialGradient(x, y, 0, x, y, bob * 3.2)
      g.addColorStop(0, `rgba(${ar},${ag},${ab},${glow})`)
      g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(x, y, bob * 3.2, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.restore()

      ctx!.fillStyle = `rgba(${ar},${ag},${ab},0.92)`
      ctx!.beginPath()
      ctx!.arc(x, y, bob, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.fillStyle = 'rgba(255,255,255,0.5)'
      ctx!.beginPath()
      ctx!.arc(x - bob * 0.32, y - bob * 0.32, bob * 0.34, 0, Math.PI * 2)
      ctx!.fill()
    }

    function rod(px: number, bxp: number, byp: number) {
      ctx!.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(px, pivotY)
      ctx!.lineTo(bxp, byp)
      ctx!.stroke()
      ctx!.fillStyle = 'rgba(255,255,255,0.28)'
      ctx!.beginPath()
      ctx!.arc(px, pivotY, 1.5, 0, Math.PI * 2)
      ctx!.fill()
    }

    // The twin meter: energy held left vs right, as two bars growing out from
    // the centre of a single track. They always span the full width together,
    // which is the whole point — the pair's energy is conserved, only moved.
    function meter(eL: number, eR: number) {
      const y = h - Math.max(18, h * 0.07)
      const trackW = Math.min(w * 0.6, px2 - px1 + bob * 4)
      const x0 = w / 2 - trackW / 2
      const x1 = w / 2 + trackW / 2
      const cx = w / 2
      ctx!.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(x0, y)
      ctx!.lineTo(x1, y)
      ctx!.stroke()
      // centre tick
      ctx!.strokeStyle = 'rgba(255,255,255,0.22)'
      ctx!.beginPath()
      ctx!.moveTo(cx, y - 4)
      ctx!.lineTo(cx, y + 4)
      ctx!.stroke()
      ctx!.lineCap = 'round'
      ctx!.lineWidth = 3
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},0.85)`
      ctx!.beginPath()
      ctx!.moveTo(cx, y)
      ctx!.lineTo(cx - (trackW / 2) * eL, y)
      ctx!.stroke()
      ctx!.beginPath()
      ctx!.moveTo(cx, y)
      ctx!.lineTo(cx + (trackW / 2) * eR, y)
      ctx!.stroke()
      ctx!.lineCap = 'butt'
    }

    let readoutTick = 0

    function draw(phase: number) {
      ctx!.clearRect(0, 0, w, h)

      const k = kappaRef.current
      const ws = OMEGA0
      const wd = OMEGA0 * Math.sqrt(1 + 2 * k)
      const delta = (wd - ws) / 2 // half-difference: the beat (envelope) rate

      const cs = Math.cos(ws * phase)
      const cd = Math.cos(wd * phase)
      const thL = 0.5 * AMP * (cs + cd)
      const thR = 0.5 * AMP * (cs - cd)

      // The hanging bar.
      ctx!.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(px1 - bob, pivotY)
      ctx!.lineTo(px2 + bob, pivotY)
      ctx!.stroke()

      const bL = bobAt(px1, thL)
      const bR = bobAt(px2, thR)

      rod(px1, bL.x, bL.y)
      rod(px2, bR.x, bR.y)

      // Spring between the rods at the coupling height.
      const aL = { x: px1 + Math.sin(thL) * len * COUPLE_FRAC, y: pivotY + Math.cos(thL) * len * COUPLE_FRAC }
      const aR = { x: px2 + Math.sin(thR) * len * COUPLE_FRAC, y: pivotY + Math.cos(thR) * len * COUPLE_FRAC }
      spring(aL.x, aL.y, aR.x, aR.y, px2 - px1)

      const edgeL = Math.min(1, Math.abs(Math.sin(thL)) / Math.sin(AMP))
      const edgeR = Math.min(1, Math.abs(Math.sin(thR)) / Math.sin(AMP))
      drawBob(bL.x, bL.y, edgeL)
      drawBob(bR.x, bR.y, edgeR)

      // Envelope energies — cos²/sin² of the beat — summing to one exactly.
      const env = Math.cos(delta * phase)
      const eL = env * env
      const eR = 1 - eL
      meter(eL, eR)

      // Live readout, written straight to the DOM a few times a second.
      if (readoutRef.current && ++readoutTick % 8 === 0) {
        const beat = Math.PI / delta // seconds for a full there-and-back slosh
        readoutRef.current.textContent =
          `Left holds ${Math.round(eL * 100)}% · right ${Math.round(eR * 100)}% — beat ${beat.toFixed(1)}s`
      }
    }

    layout()

    if (reduce) {
      // A still frame mid-handover: energy split across the pair, spring
      // stretched, so the diagram shows the coupling at work at a glance.
      const k = kappaRef.current
      const delta = (OMEGA0 * Math.sqrt(1 + 2 * k) - OMEGA0) / 2
      const still = (Math.PI / (2 * delta)) * 0.62
      draw(still)
      if (readoutRef.current) {
        const env = Math.cos(delta * still)
        readoutRef.current.textContent =
          `Left holds ${Math.round(env * env * 100)}% · right ${Math.round((1 - env * env) * 100)}% — paused`
      }
      const ro = new ResizeObserver(() => {
        layout()
        draw(still)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      blend *= 0.9
      if (blend < 0.001) blend = 0
      t += dt
      draw(t * (1 - blend))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function release() {
      blend = 1
      t = 0
      last = -1
    }
    canvas.addEventListener('pointerdown', release)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', release)
    }
  }, [reduce, accent])

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = Math.min(K_MAX, +(kappaRef.current + K_STEP).toFixed(2))
      kappaRef.current = next
      setKappaLabel(next)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const next = Math.max(K_MIN, +(kappaRef.current - K_STEP).toFixed(2))
      kappaRef.current = next
      setKappaLabel(next)
    } else if (e.key === 'Home') {
      e.preventDefault()
      kappaRef.current = K_DEFAULT
      setKappaLabel(K_DEFAULT)
    }
  }

  return (
    <figure
      className={`group relative ${className}`}
      role="img"
      aria-label="Two coupled pendulums of equal length joined by a spring. Energy passes back and forth between them in a slow beat; a twin meter below shows how much motion each one holds, always summing to the whole."
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <canvas ref={ref} aria-hidden className="h-full w-full cursor-pointer touch-none" />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-3 text-[11px] text-white/45">
        <span ref={readoutRef} className="tabular-nums" aria-live="off">
          Press to release · arrows change the spring
        </span>
        <span className="tabular-nums text-white/35">spring {kappaLabel.toFixed(2)}</span>
      </figcaption>
    </figure>
  )
}
