import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Gravity: a bin of tags that behave like real objects. Each label is a
// physical body that falls under gravity, piles up on the floor, collides with
// the walls and with the other tags, and can be grabbed and flung with the
// pointer — it keeps the momentum of the throw. Deliberately a different
// paradigm from every other motion piece on the site: nothing else here
// simulates mass, contact, or a toss. The tags are the tools Arseniy actually
// reaches for, so the play is about his craft rather than any one project.
//
// Hand-rolled physics, no library. Bodies are axis-aligned boxes (pills read
// cleanly stacked without the ambiguity of rotated-box contact). One RAF loop
// integrates velocity, resolves wall + pairwise overlaps along the axis of
// least penetration, and writes each pill's transform directly — no React state
// on the hot path. DPR-independent (DOM, not canvas), ResizeObserver-driven,
// pointer-capture drag with velocity carried into the release. Under reduced
// motion it drops the simulation entirely and lays the tags out as a calm,
// fully readable static wrap.

interface Body {
  x: number // centre x
  y: number // centre y
  vx: number
  vy: number
  hw: number // half width
  hh: number // half height
  el: HTMLElement
  held: boolean
  resting: boolean
}

const GRAVITY = 2600 // px/s^2
const REST = 0.35 // wall/floor bounciness
const AIR = 0.992 // per-step air drag
const FRICTION = 0.86 // tangential damping on contact
const MAX_DT = 1 / 30 // clamp the step so a tab-out never explodes the sim

export function Gravity({
  items,
  className = '',
  accent,
}: {
  items: string[]
  className?: string
  /** Labels rendered in the lime accent instead of the neutral chrome. */
  accent?: string[]
}) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (reduce) return
    const wrap = wrapRef.current
    if (!wrap) return
    const els = pillRefs.current.filter(Boolean) as HTMLButtonElement[]
    if (!els.length) return

    let W = 0
    let H = 0
    let raf = 0
    let last = 0
    const bodies: Body[] = []

    // A small seeded scatter so the drop is lively but identical each mount.
    let seed = 20260708
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    function measure(first: boolean) {
      const rect = wrap!.getBoundingClientRect()
      W = rect.width
      H = rect.height
      els.forEach((el, i) => {
        const hw = el.offsetWidth / 2
        const hh = el.offsetHeight / 2
        if (first) {
          bodies.push({
            x: hw + rand() * Math.max(1, W - el.offsetWidth),
            y: -hh - rand() * H * 1.2 - i * 24, // staggered above the bin
            vx: (rand() - 0.5) * 120,
            vy: 0,
            hw,
            hh,
            el,
            held: false,
            resting: false,
          })
        } else {
          const b = bodies[i]
          b.hw = hw
          b.hh = hh
          // Keep everyone inside after a resize.
          b.x = Math.min(Math.max(b.x, hw), Math.max(hw, W - hw))
          b.y = Math.min(b.y, H - hh)
        }
      })
    }

    function clampWalls(b: Body) {
      if (b.x - b.hw < 0) {
        b.x = b.hw
        b.vx = Math.abs(b.vx) * REST
        b.vy *= FRICTION
      } else if (b.x + b.hw > W) {
        b.x = W - b.hw
        b.vx = -Math.abs(b.vx) * REST
        b.vy *= FRICTION
      }
      if (b.y + b.hh > H) {
        b.y = H - b.hh
        if (b.vy > 0) b.vy = -b.vy * REST
        b.vx *= FRICTION
        if (Math.abs(b.vy) < 24) b.vy = 0
      }
      // Let the top stay open so tags can be lifted out and dropped back in.
    }

    // Separate two overlapping boxes along the axis of least penetration and
    // damp the closing velocity there. Cheap, stable, order-independent enough
    // for a couple dozen bodies run every frame.
    function resolvePair(a: Body, b: Body) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const px = a.hw + b.hw - Math.abs(dx)
      if (px <= 0) return
      const py = a.hh + b.hh - Math.abs(dy)
      if (py <= 0) return

      if (px < py) {
        const s = dx < 0 ? -1 : 1
        const shift = (px / 2) * s
        if (!a.held) a.x -= shift
        if (!b.held) b.x += shift
        const rel = b.vx - a.vx
        if (rel * s < 0) {
          const imp = rel * 0.5
          if (!a.held) a.vx += imp
          if (!b.held) b.vx -= imp
        }
      } else {
        const s = dy < 0 ? -1 : 1
        const shift = (py / 2) * s
        if (!a.held) a.y -= shift
        if (!b.held) b.y += shift
        const rel = b.vy - a.vy
        if (rel * s < 0) {
          const imp = rel * 0.5 * (1 + REST)
          if (!a.held) a.vy += imp
          if (!b.held) b.vy -= imp
          // horizontal contact friction so stacks settle instead of skating
          if (!a.held) a.vx *= 0.98
          if (!b.held) b.vx *= 0.98
        }
      }
    }

    function step(dt: number) {
      for (const b of bodies) {
        if (b.held) continue
        b.vy += GRAVITY * dt
        b.vx *= AIR
        b.vy *= AIR
        b.x += b.vx * dt
        b.y += b.vy * dt
        clampWalls(b)
      }
      // Two relaxation passes keep piles from jittering apart.
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            resolvePair(bodies[i], bodies[j])
          }
        }
      }
      for (const b of bodies) clampWalls(b)
    }

    function paint() {
      for (const b of bodies) {
        b.el.style.transform = `translate3d(${b.x - b.hw}px, ${b.y - b.hh}px, 0)`
      }
    }

    function frame(t: number) {
      if (!last) last = t
      const dt = Math.min((t - last) / 1000, MAX_DT)
      last = t
      if (dt > 0) step(dt)
      paint()
      raf = requestAnimationFrame(frame)
    }

    // --- pointer drag -------------------------------------------------------
    const held = new Map<number, { body: Body; lastX: number; lastY: number; lastT: number }>()

    function localPoint(e: PointerEvent) {
      const rect = wrap!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function onDown(this: HTMLElement, e: PointerEvent) {
      const idx = els.indexOf(this as HTMLButtonElement)
      const b = bodies[idx]
      if (!b) return
      e.preventDefault()
      this.setPointerCapture(e.pointerId)
      b.held = true
      b.vx = 0
      b.vy = 0
      const p = localPoint(e)
      held.set(e.pointerId, { body: b, lastX: p.x, lastY: p.y, lastT: e.timeStamp })
      this.classList.add('is-grabbed')
    }

    function onMove(e: PointerEvent) {
      const h = held.get(e.pointerId)
      if (!h) return
      const p = localPoint(e)
      const b = h.body
      b.x = Math.min(Math.max(p.x, b.hw), Math.max(b.hw, W - b.hw))
      b.y = Math.max(p.y, b.hh)
      const dt = Math.max((e.timeStamp - h.lastT) / 1000, 1 / 240)
      // Track a smoothed throw velocity from the pointer motion.
      b.vx = (p.x - h.lastX) / dt
      b.vy = (p.y - h.lastY) / dt
      h.lastX = p.x
      h.lastY = p.y
      h.lastT = e.timeStamp
    }

    function endDrag(e: PointerEvent) {
      const h = held.get(e.pointerId)
      if (!h) return
      h.body.held = false
      // Cap the fling so a violent flick stays on screen.
      const cap = 2600
      h.body.vx = Math.max(-cap, Math.min(cap, h.body.vx))
      h.body.vy = Math.max(-cap, Math.min(cap, h.body.vy))
      h.body.el.classList.remove('is-grabbed')
      held.delete(e.pointerId)
    }

    measure(true)
    els.forEach((el) => {
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', endDrag)
      el.addEventListener('pointercancel', endDrag)
    })
    const ro = new ResizeObserver(() => measure(false))
    ro.observe(wrap)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      els.forEach((el) => {
        el.removeEventListener('pointerdown', onDown)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', endDrag)
        el.removeEventListener('pointercancel', endDrag)
      })
      ro.disconnect()
    }
  }, [reduce, items])

  if (reduce) {
    // Calm, fully readable static layout — no simulation.
    return (
      <div className={`flex flex-wrap content-center items-center justify-center gap-2.5 ${className}`}>
        {items.map((label) => (
          <span
            key={label}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              accent?.includes(label)
                ? 'border-[#DCF87C]/40 bg-[#DCF87C]/10 text-[#DCF87C]'
                : 'border-white/10 bg-white/[0.04] text-white/70'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={`relative touch-none select-none overflow-hidden ${className}`}>
      {items.map((label, i) => (
        <button
          key={label}
          ref={(el) => {
            pillRefs.current[i] = el
          }}
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          style={{ transform: 'translate3d(-9999px,-9999px,0)' }}
          className={`gravity-pill absolute left-0 top-0 cursor-grab whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium will-change-transform active:cursor-grabbing ${
            accent?.includes(label)
              ? 'border-[#DCF87C]/40 bg-[#DCF87C]/[0.12] text-[#DCF87C]'
              : 'border-white/12 bg-white/[0.05] text-white/75'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
