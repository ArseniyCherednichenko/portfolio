import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Sonar: a plan-position radar scope, the one display in the Objects & toys
// family that sweeps rather than draws. Its neighbours each hold a figure of
// their own — the Oscilloscope traces a Lissajous on a CRT, the Harmonograph
// lays a seeded curve, the RadarChart spokes a silhouette out from a centre —
// but a PPI scope holds nothing. A single bearing line rotates around the dial
// at a steady rate, trailing a wedge of fading phosphor behind it, and the only
// things on the face are contacts: points at a bearing and a range that sit
// dark until the sweep crosses their bearing, flash bright, then fade on the
// afterglow the tube's phosphor would give them. So what you watch for is the
// same thing a real operator does — a blip lighting as the line passes it, then
// cooling before the next pass brings it back.
//
// The geometry is honest to an instrument: bearing is measured clockwise from
// north at the top, range runs from the centre out to the rim, the rings are
// range gates and the ticks around the edge are the compass card. A contact at
// bearing b and range fraction f sits at (c + f·R·sin b, c − f·R·cos b). Click
// anywhere on the face to drop a contact where the pointer is, so the sweep has
// something new to find on its next lap; Scatter drops a handful at random and
// Clear wipes the face.
//
// Drawn the house way: one canvas, one requestAnimationFrame loop with nothing
// on the React render path (the contacts live in a ref, their glow decays off
// the frame delta), device-pixel-ratio clamped and ResizeObserver-driven off a
// square wrapper. The canvas is aria-hidden; the scope carries a label and a
// live region reads how many contacts are on the face. Under
// prefers-reduced-motion the loop never starts — the rings and card are drawn
// once and every contact is shown already lit and still, so the whole picture
// is legible without a thing moving.

const LIME = '220, 248, 124'
const TAU = Math.PI * 2
const SWEEP_PERIOD = 4 // seconds for the bearing line to complete one lap
const TRAIL = 0.95 // radians of fading afterglow behind the sweep line
const GLOW_TAU = 0.85 // seconds for a struck contact's glow to fade by 1/e
const MAX_CONTACTS = 40

// A tiny seeded PRNG so the opening scatter is identical every load — a lively
// but deterministic field, not a fresh random one each time.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Contact {
  /** Bearing, radians clockwise from north (the top of the dial). */
  brg: number
  /** Range as a fraction of the scope radius, 0 at centre, 1 at the rim. */
  rad: number
  /** Phosphor glow, 1 the instant the sweep strikes it, decaying to 0. */
  lit: number
}

function seedContacts(): Contact[] {
  const rnd = mulberry32(2026)
  const n = 6
  const out: Contact[] = []
  for (let i = 0; i < n; i++) {
    out.push({ brg: rnd() * TAU, rad: 0.28 + rnd() * 0.64, lit: rnd() })
  }
  return out
}

export function Sonar({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef(0)

  const contactsRef = useRef<Contact[]>(seedContacts())
  // A static draw the reduced-motion path re-runs when the contacts change; the
  // motion path redraws every frame and never reads this.
  const redrawRef = useRef<(() => void) | null>(null)

  const [count, setCount] = useState(contactsRef.current.length)
  const [message, setMessage] = useState('')

  const syncCount = () => setCount(contactsRef.current.length)

  // Point on the dial for a bearing (clockwise from north) and range fraction.
  const place = (c: number, R: number, brg: number, frac: number): [number, number] => [
    c + frac * R * Math.sin(brg),
    c - frac * R * Math.cos(brg),
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let size = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    // The still parts of the scope: the lit well, the range rings, the
    // cross-hairs, and the compass card of ticks around the rim.
    const drawFace = (c: number, R: number) => {
      // Dark well with a faint lift toward the centre.
      const well = ctx.createRadialGradient(c, c, 0, c, c, R)
      well.addColorStop(0, 'rgba(26, 36, 24, 0.9)')
      well.addColorStop(0.7, 'rgba(10, 16, 10, 0.95)')
      well.addColorStop(1, 'rgba(4, 7, 4, 1)')
      ctx.beginPath()
      ctx.arc(c, c, R, 0, TAU)
      ctx.fillStyle = well
      ctx.fill()

      // Range rings.
      ctx.lineWidth = 1
      for (const f of [0.25, 0.5, 0.75, 1]) {
        ctx.beginPath()
        ctx.arc(c, c, R * f, 0, TAU)
        ctx.strokeStyle = `rgba(${LIME}, ${f === 1 ? 0.32 : 0.12})`
        ctx.stroke()
      }

      // Cross-hairs.
      ctx.beginPath()
      ctx.moveTo(c - R, c)
      ctx.lineTo(c + R, c)
      ctx.moveTo(c, c - R)
      ctx.lineTo(c, c + R)
      ctx.strokeStyle = `rgba(${LIME}, 0.1)`
      ctx.stroke()

      // Compass card: a tick every 15 degrees, longer and brighter at each 90.
      for (let d = 0; d < 360; d += 15) {
        const b = (d * Math.PI) / 180
        const cardinal = d % 90 === 0
        const [x0, y0] = place(c, R, b, cardinal ? 0.93 : 0.965)
        const [x1, y1] = place(c, R, b, 1)
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.strokeStyle = `rgba(${LIME}, ${cardinal ? 0.5 : 0.22})`
        ctx.lineWidth = cardinal ? 1.6 : 1
        ctx.stroke()
      }

      // Centre pip.
      ctx.beginPath()
      ctx.arc(c, c, 2.4, 0, TAU)
      ctx.fillStyle = `rgba(${LIME}, 0.55)`
      ctx.fill()
    }

    const drawContacts = (c: number, R: number) => {
      for (const k of contactsRef.current) {
        const [x, y] = place(c, R, k.brg, k.rad)
        const g = 0.13 + 0.87 * k.lit
        ctx.beginPath()
        ctx.arc(x, y, 2.6 + 3.2 * k.lit, 0, TAU)
        ctx.fillStyle = `rgba(${LIME}, ${g})`
        if (k.lit > 0.02) {
          ctx.shadowColor = `rgba(${LIME}, ${0.8 * k.lit})`
          ctx.shadowBlur = 18 * k.lit
        }
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // One full frame. `sweep` is the leading bearing of the sweep line; when it
    // is null (reduced motion) the afterglow and line are skipped and every
    // contact is drawn fully lit.
    const draw = (sweep: number | null) => {
      const s = size
      const c = s / 2
      const R = s * 0.46
      ctx.clearRect(0, 0, s, s)

      drawFace(c, R)

      if (sweep !== null) {
        // The afterglow wedge: a run of thin slices from the centre, brightest
        // at the leading edge and fading back over TRAIL radians.
        ctx.save()
        ctx.beginPath()
        ctx.arc(c, c, R, 0, TAU)
        ctx.clip()
        const slices = 48
        for (let i = 0; i < slices; i++) {
          const a0 = sweep - TRAIL * (i / slices)
          const a1 = sweep - TRAIL * ((i + 1) / slices)
          const [x0, y0] = place(c, R, a0, 1)
          const [x1, y1] = place(c, R, a1, 1)
          ctx.beginPath()
          ctx.moveTo(c, c)
          ctx.lineTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.closePath()
          ctx.fillStyle = `rgba(${LIME}, ${0.2 * (1 - i / slices)})`
          ctx.fill()
        }
        ctx.restore()

        // The bright leading line.
        const [lx, ly] = place(c, R, sweep, 1)
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.lineTo(lx, ly)
        ctx.strokeStyle = `rgba(${LIME}, 0.85)`
        ctx.lineWidth = 2
        ctx.shadowColor = `rgba(${LIME}, 0.7)`
        ctx.shadowBlur = 10
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      drawContacts(c, R)
    }

    const resize = () => {
      const w = Math.max(240, Math.floor(wrap.clientWidth))
      size = w
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(w * dpr)
      canvas.style.height = `${w}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(reduce ? null : 0)
    }

    resize()

    let ro: ResizeObserver | null = null
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(resize)
      ro.observe(wrap)
    }

    if (reduce) {
      // Every contact sits fully lit so the picture reads at rest.
      for (const k of contactsRef.current) k.lit = 1
      redrawRef.current = () => {
        for (const k of contactsRef.current) k.lit = 1
        draw(null)
      }
      redrawRef.current()
      return () => {
        if (ro) ro.disconnect()
        redrawRef.current = null
      }
    }

    let sweep = 0
    let prev = 0
    const inSwept = (b: number, from: number, to: number) =>
      to >= from ? b > from && b <= to : b > from || b <= to

    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const dt = Math.min(0.05, (now - lastRef.current) / 1000)
      lastRef.current = now

      prev = sweep
      sweep = (sweep + (TAU / SWEEP_PERIOD) * dt) % TAU

      const decay = Math.exp(-dt / GLOW_TAU)
      for (const k of contactsRef.current) {
        if (inSwept(k.brg, prev, sweep)) k.lit = 1
        else k.lit *= decay
      }

      draw(sweep)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (ro) ro.disconnect()
      lastRef.current = 0
    }
  }, [reduce])

  // In reduced motion there is no loop, so a change to the contacts has to
  // trigger a repaint by hand.
  useEffect(() => {
    if (reduce) redrawRef.current?.()
  }, [count, reduce])

  const addContact = (brg: number, rad: number) => {
    const list = contactsRef.current
    list.push({ brg: ((brg % TAU) + TAU) % TAU, rad: Math.max(0, Math.min(1, rad)), lit: 1 })
    if (list.length > MAX_CONTACTS) list.shift()
    syncCount()
    setMessage(`Contact dropped. ${list.length} on the scope.`)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const R = r.width * 0.46
    const dx = e.clientX - r.left - r.width / 2
    const dy = e.clientY - r.top - r.height / 2
    const dist = Math.hypot(dx, dy)
    if (dist > R * 1.04) return // outside the dial
    addContact(Math.atan2(dx, -dy), dist / R)
  }

  const scatter = () => {
    for (let i = 0; i < 4; i++) addContact(Math.random() * TAU, 0.2 + Math.random() * 0.75)
    setMessage(`Four contacts scattered. ${contactsRef.current.length} on the scope.`)
  }

  const clear = () => {
    contactsRef.current = []
    syncCount()
    setMessage('Scope cleared.')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      addContact(Math.random() * TAU, 0.2 + Math.random() * 0.75)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      clear()
    }
  }

  return (
    <div className={`flex w-full max-w-md flex-col items-center ${className}`}>
      <div
        ref={wrapRef}
        role="application"
        tabIndex={0}
        aria-labelledby={labelId}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: reduce ? 'default' : 'crosshair' }}
      >
        <span id={labelId} className="sr-only">
          A radar scope. A sweep line rotates around the dial and lights each contact as it passes its bearing. Click
          anywhere on the face to drop a contact where the pointer is; press Enter to drop one at a random bearing and
          range, and Delete to clear the scope.
        </span>
        <canvas ref={canvasRef} className="block w-full drop-shadow-[0_18px_44px_rgba(0,0,0,0.55)]" aria-hidden />
      </div>

      <p aria-live="polite" className="sr-only">
        {message || `${count} contacts on the scope.`}
      </p>

      <div className="mt-6 flex w-full items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
          {count} {count === 1 ? 'contact' : 'contacts'}
        </span>
        <span className="font-mono text-xs text-white/45">{reduce ? 'at rest' : 'sweeping'}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={scatter}
          className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C] transition-colors hover:bg-[#DCF87C]/[0.12]"
        >
          Scatter
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
