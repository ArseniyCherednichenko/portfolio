import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A double pendulum — the smallest machine that refuses to be predicted. One arm
// hangs from a fixed pivot; a second hangs from the tip of the first. Two rods,
// two weights, one law of gravity, and the whole thing is deterministic to the
// last decimal — and yet no one can tell you where the lower weight will be a
// minute from now, because the equations that govern it are chaotic: change the
// starting angle by a hair and the paths diverge into completely different
// lives. That is the piece's whole argument, so it does not show one pendulum,
// it shows a family of them, all released from all-but-identical starts, and
// lets you watch the family come apart. For the first few seconds they swing as
// one, a single arm; then the hairline differences amplify, the arms peel away
// from each other, and a tidy line of clones fans into chaos.
//
// The physics is honest. Each pendulum integrates the real double-pendulum
// equations of motion with RK4 on a small fixed timestep — an accumulator eats
// the rAF delta in 1/240s bites, so the simulation is frame-rate independent and
// numerically stable, and the divergence you see is the true sensitive
// dependence on initial conditions, not a rendering trick. The only liberty is a
// whisper of damping, the air resistance a real pendulum feels, which keeps an
// always-on decorative loop from drifting to infinity over a long visit. The
// hairline offsets that separate the clones come from a fixed integer hash of
// each one's index, so the same family diverges the same way every load and it
// never touches Math.random; time is the rAF delta alone, never Date.now.
//
// Each weight's tip draws a short, fading trail, so the fan leaves a bloom of
// arcs behind it — the signature scribble of chaos. The pointer aims the drop:
// press anywhere and the whole family re-releases from rest, every arm pointing
// at the cursor, and falls again from there. One canvas, one loop, drawn DPR-
// aware. Under prefers-reduced-motion the loop never starts — a single pendulum
// is laid out once at a settled pose with a few faint ghosts behind it to hint
// at the family, and held perfectly still. Decorative, so aria-hidden.

const COUNT = 11 // pendulums in the family
const EPS = 0.0009 // hairline spread between neighbours, radians
const GRAV = 1.0 // gravity in sim units
const M1 = 1.0
const M2 = 1.0
const DAMP = 0.9999 // per-substep velocity retention (air resistance)
const STEP = 1 / 240 // fixed integration substep, seconds
const MAX_SUB = 10 // cap substeps per frame (no spiral of death)
const TRAIL = 46 // tip-trail length, points
const TAU = Math.PI * 2

// A fast, deterministic integer hash → a number in [0, 1). Stands in for a PRNG
// so every clone's offset is fixed by its index, never rolled at runtime.
function hash(n: number): number {
  let x = n | 0
  x = (x ^ 61) ^ (x >>> 16)
  x = x + (x << 3)
  x = x ^ (x >>> 4)
  x = Math.imul(x, 0x27d4eb2d)
  x = x ^ (x >>> 15)
  return (x >>> 0) / 4294967296
}

interface State {
  th1: number
  th2: number
  w1: number
  w2: number
}

// The double-pendulum accelerations for a given state — the real equations of
// motion, θ measured from the downward vertical. Returns the two angular
// accelerations; the angular velocities are the state's own w1/w2.
function accel(s: State, l1: number, l2: number): [number, number] {
  const { th1, th2, w1, w2 } = s
  const d = th1 - th2
  const sd = Math.sin(d)
  const cd = Math.cos(d)
  const den = 2 * M1 + M2 - M2 * Math.cos(2 * d)

  const a1 =
    (-GRAV * (2 * M1 + M2) * Math.sin(th1) -
      M2 * GRAV * Math.sin(th1 - 2 * th2) -
      2 * sd * M2 * (w2 * w2 * l2 + w1 * w1 * l1 * cd)) /
    (l1 * den)

  const a2 =
    (2 * sd * (w1 * w1 * l1 * (M1 + M2) + GRAV * (M1 + M2) * Math.cos(th1) + w2 * w2 * l2 * M2 * cd)) /
    (l2 * den)

  return [a1, a2]
}

// One RK4 step of size h. RK4 keeps the energy drift low enough that the
// chaotic divergence you see is the physics, not the integrator.
function rk4(s: State, l1: number, l2: number, h: number): State {
  const deriv = (st: State) => {
    const [a1, a2] = accel(st, l1, l2)
    return { th1: st.w1, th2: st.w2, w1: a1, w2: a2 }
  }
  const add = (st: State, k: ReturnType<typeof deriv>, f: number): State => ({
    th1: st.th1 + k.th1 * f,
    th2: st.th2 + k.th2 * f,
    w1: st.w1 + k.w1 * f,
    w2: st.w2 + k.w2 * f,
  })

  const k1 = deriv(s)
  const k2 = deriv(add(s, k1, h / 2))
  const k3 = deriv(add(s, k2, h / 2))
  const k4 = deriv(add(s, k3, h))

  return {
    th1: s.th1 + ((k1.th1 + 2 * k2.th1 + 2 * k3.th1 + k4.th1) * h) / 6,
    th2: s.th2 + ((k1.th2 + 2 * k2.th2 + 2 * k3.th2 + k4.th2) * h) / 6,
    w1: (s.w1 + ((k1.w1 + 2 * k2.w1 + 2 * k3.w1 + k4.w1) * h) / 6) * DAMP,
    w2: (s.w2 + ((k1.w2 + 2 * k2.w2 + 2 * k3.w2 + k4.w2) * h) / 6) * DAMP,
  }
}

export function DoublePendulum({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    let w = 0
    let h = 0
    let pivotX = 0
    let pivotY = 0
    let l1 = 0 // upper arm length, pixels
    let l2 = 0 // lower arm length, pixels

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      pivotX = w / 2
      pivotY = h * 0.36
      const reach = Math.min(h * 0.3, w * 0.24)
      l1 = reach
      l2 = reach
    }
    layout()

    // The family, released from a near-horizontal drop so gravity does the
    // entrance. Each clone is nudged off its neighbour by a hash-fixed hairline,
    // so the release is deterministic and the divergence reproducible.
    const startAngle = -Math.PI / 2 + 0.9 // just above horizontal on one side
    function makeFamily(base: number): State[] {
      const fam: State[] = []
      for (let i = 0; i < COUNT; i++) {
        const jitter = (hash(i * 2 + 1) - 0.5) * EPS
        fam.push({ th1: base, th2: base + i * EPS + jitter, w1: 0, w2: 0 })
      }
      return fam
    }
    let family = makeFamily(startAngle)
    // Per-clone fading tip trails, as flat [x, y, x, y, ...] ring-ish buffers.
    let trails: number[][] = family.map(() => [])

    // The lower-weight position for a clone, in pixels.
    function tip(s: State): [number, number, number, number] {
      const x1 = pivotX + Math.sin(s.th1) * l1
      const y1 = pivotY + Math.cos(s.th1) * l1
      const x2 = x1 + Math.sin(s.th2) * l2
      const y2 = y1 + Math.cos(s.th2) * l2
      return [x1, y1, x2, y2]
    }

    // Colour walks across the family, graphite through to lime, so the fan reads
    // as a spectrum rather than a tangle.
    function armColour(k: number, alpha: number): string {
      const cr = Math.round(120 + (ar - 120) * k)
      const cg = Math.round(120 + (ag - 120) * k)
      const cb = Math.round(128 + (ab - 128) * k)
      return `rgba(${cr},${cg},${cb},${alpha})`
    }

    function paint(fam: State[], trls: number[][], intro: number) {
      ctx!.clearRect(0, 0, w, h)

      // A soft pool of light behind the pivot.
      const glow = ctx!.createRadialGradient(pivotX, pivotY, 0, pivotX, pivotY, (l1 + l2) * 1.2)
      glow.addColorStop(0, `rgba(${ar},${ag},${ab},0.06)`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.fillStyle = glow
      ctx!.fillRect(0, 0, w, h)

      // Tip trails first, so the arms sit over them.
      ctx!.lineWidth = 1.4
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      for (let i = 0; i < fam.length; i++) {
        const t = trls[i]
        if (t.length < 4) continue
        const k = fam.length > 1 ? i / (fam.length - 1) : 1
        for (let p = 2; p < t.length; p += 2) {
          const a = (p / t.length) * 0.5 * intro
          ctx!.strokeStyle = armColour(k, a)
          ctx!.beginPath()
          ctx!.moveTo(t[p - 2], t[p - 1])
          ctx!.lineTo(t[p], t[p + 1])
          ctx!.stroke()
        }
      }

      // The arms and weights. Faint for the crowd, brighter for the leading
      // clone so the eye has an anchor.
      for (let i = 0; i < fam.length; i++) {
        const k = fam.length > 1 ? i / (fam.length - 1) : 1
        const lead = i === fam.length - 1
        const [x1, y1, x2, y2] = tip(fam[i])
        const armA = (lead ? 0.85 : 0.28) * intro

        ctx!.strokeStyle = armColour(k, armA)
        ctx!.lineWidth = lead ? 2 : 1.2
        ctx!.beginPath()
        ctx!.moveTo(pivotX, pivotY)
        ctx!.lineTo(x1, y1)
        ctx!.lineTo(x2, y2)
        ctx!.stroke()

        // Weights.
        ctx!.fillStyle = armColour(k, (lead ? 0.9 : 0.4) * intro)
        if (lead) {
          ctx!.shadowColor = `rgba(${ar},${ag},${ab},0.7)`
          ctx!.shadowBlur = 10
        }
        ctx!.beginPath()
        ctx!.arc(x1, y1, lead ? 3.2 : 2, 0, TAU)
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(x2, y2, lead ? 4.6 : 2.6, 0, TAU)
        ctx!.fill()
        ctx!.shadowBlur = 0
      }

      // The pivot.
      ctx!.fillStyle = 'rgba(255,255,255,0.55)'
      ctx!.beginPath()
      ctx!.arc(pivotX, pivotY, 3, 0, TAU)
      ctx!.fill()
    }

    if (reduce) {
      // A single settled pendulum with a few faint ghosts, held still.
      function still() {
        ctx!.clearRect(0, 0, w, h)
        const glow = ctx!.createRadialGradient(pivotX, pivotY, 0, pivotX, pivotY, (l1 + l2) * 1.2)
        glow.addColorStop(0, `rgba(${ar},${ag},${ab},0.06)`)
        glow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx!.fillStyle = glow
        ctx!.fillRect(0, 0, w, h)
        const poses: Array<[number, number, number]> = [
          [0.7, 1.7, 0.22],
          [0.55, 1.2, 0.16],
          [0.85, 2.1, 0.16],
        ]
        for (const [t1, t2, alpha] of poses) {
          const s: State = { th1: t1, th2: t2, w1: 0, w2: 0 }
          const [x1, y1, x2, y2] = tip(s)
          ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${alpha})`
          ctx!.lineWidth = alpha > 0.2 ? 2 : 1.2
          ctx!.lineCap = 'round'
          ctx!.lineJoin = 'round'
          ctx!.beginPath()
          ctx!.moveTo(pivotX, pivotY)
          ctx!.lineTo(x1, y1)
          ctx!.lineTo(x2, y2)
          ctx!.stroke()
          ctx!.fillStyle = `rgba(${ar},${ag},${ab},${alpha + 0.1})`
          ctx!.beginPath()
          ctx!.arc(x1, y1, 2.6, 0, TAU)
          ctx!.fill()
          ctx!.beginPath()
          ctx!.arc(x2, y2, 3.6, 0, TAU)
          ctx!.fill()
        }
        ctx!.fillStyle = 'rgba(255,255,255,0.55)'
        ctx!.beginPath()
        ctx!.arc(pivotX, pivotY, 3, 0, TAU)
        ctx!.fill()
      }
      still()
      const ro = new ResizeObserver(() => {
        layout()
        still()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Press to re-release the whole family, every arm aimed at the pointer.
    function onDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const dx = e.clientX - rect.left - pivotX
      const dy = e.clientY - rect.top - pivotY
      // Angle from the downward vertical toward the pointer.
      const aim = Math.atan2(dx, dy)
      family = makeFamily(aim)
      trails = family.map(() => [])
      intro = 0
    }
    canvas.addEventListener('pointerdown', onDown)

    let raf = 0
    let last = -1
    let acc = 0 // leftover real time to integrate, seconds
    let intro = 0 // 0..1 fade-in on release

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away
      intro = Math.min(1, intro + dt * 2)

      acc += dt
      let sub = 0
      while (acc >= STEP && sub < MAX_SUB) {
        for (let i = 0; i < family.length; i++) family[i] = rk4(family[i], l1, l2, STEP)
        acc -= STEP
        sub++
      }
      if (sub >= MAX_SUB) acc = 0 // shed backlog after a long stall

      // Record tips into the fading trails.
      for (let i = 0; i < family.length; i++) {
        const [, , x2, y2] = tip(family[i])
        const t = trails[i]
        t.push(x2, y2)
        if (t.length > TRAIL * 2) t.splice(0, t.length - TRAIL * 2)
      }

      paint(family, trails, intro)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(() => {
      layout()
      // Positions scale with layout; drop the trails so they don't smear across
      // the old geometry.
      trails = family.map(() => [])
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [reduce, accent])

  return <canvas ref={ref} aria-hidden className={`block touch-none select-none ${className}`} />
}
