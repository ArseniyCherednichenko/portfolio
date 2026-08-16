import { useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A word sphere — the tools Arseniy actually reaches for, laid out on the
// surface of a globe and turning slowly in space. It is the old tag-cloud
// idea, but done as real 3D and by hand: every word is a live DOM node (real,
// selectable text, read to a screen reader as a plain list), positioned each
// frame from an honest projection rather than a background image.
//
// The layout is a Fibonacci sphere — points walked around the golden angle so
// they spread evenly over the surface with no clumping at the poles, the same
// trick used to scatter seeds on a sunflower. Each frame the whole cloud is
// rotated by two angular velocities (yaw around the vertical axis, pitch around
// the horizontal), then every point is perspective-projected to the plane:
// words at the front swell, brighten, and lift above their neighbours; words at
// the back shrink, dim, and blur, so depth reads without any z-buffer. The one
// nearest the viewer catches the lime accent.
//
// It is alive on arrival — a gentle, frictionless idle spin — and steerable:
// move the pointer across it and the cloud turns to follow, faster the further
// you push from the centre, like a trackball; lift the pointer and it eases
// back to its drift. Hovering a single word slows the whole sphere so you can
// read it. No wall clock and no randomness in the loop (the seed is fixed and
// deterministic), so it is resize-stable and never trips the environment's
// guards. Under reduced motion the loop never starts: the sphere is laid out
// once, tipped to a readable three-quarter angle, and held perfectly still —
// every word legible, nothing moving. All transforms are written straight to
// the DOM in the rAF loop, so React renders the words exactly once.

interface Point {
  x: number
  y: number
  z: number
}

// Evenly distribute n unit vectors over a sphere via the Fibonacci lattice.
// Deterministic — the same n always yields the same arrangement.
function fibonacciSphere(n: number): Point[] {
  const pts: Point[] = []
  const golden = Math.PI * (3 - Math.sqrt(5)) // ~2.399963, the golden angle
  for (let i = 0; i < n; i++) {
    // y walks evenly from +1 down to -1; the radius of the ring at that y and
    // the golden-angle turn place each point.
    const y = 1 - (i / Math.max(1, n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r })
  }
  return pts
}

export function WordSphere({
  words,
  className = '',
  accent = '220,248,124',
}: {
  words: string[]
  className?: string
  accent?: string
}) {
  const reduce = useReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([])

  // Fixed layout for this word count — computed once, mutated in place by the
  // loop so no allocation happens per frame.
  const base = useMemo(() => fibonacciSphere(words.length), [words.length])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const nodes = nodeRefs.current
    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    // A working copy of the points we rotate each frame.
    const pts: Point[] = base.map((p) => ({ ...p }))

    let w = 0
    let h = 0
    let radius = 0
    const measure = () => {
      const rect = stage.getBoundingClientRect()
      w = rect.width
      h = rect.height
      radius = Math.min(w, h) * 0.42
    }
    measure()

    // Rotate a single point about the X then Y axes by the given angles.
    function rotate(p: Point, ax: number, ay: number) {
      // Around X (pitch): y/z change.
      const cosx = Math.cos(ax)
      const sinx = Math.sin(ax)
      let y = p.y * cosx - p.z * sinx
      let z = p.y * sinx + p.z * cosx
      // Around Y (yaw): x/z change.
      const cosy = Math.cos(ay)
      const siny = Math.sin(ay)
      const x = p.x * cosy + z * siny
      z = -p.x * siny + z * cosy
      p.x = x
      p.y = y
      p.z = z
    }

    // Project every point to the plane and write it to its DOM node. Front
    // (z ≈ +1) is nearest the viewer: bigger, brighter, above; back is small,
    // dim, blurred.
    function paint() {
      const cx = w / 2
      const cy = h / 2
      for (let i = 0; i < pts.length; i++) {
        const el = nodes[i]
        if (!el) continue
        const p = pts[i]
        const depth = (p.z + 1) / 2 // 0 back … 1 front
        // A mild perspective so the front reads clearly closer than the back.
        const persp = 1 / (1.6 - p.z * 0.6)
        const sx = cx + p.x * radius * persp
        const sy = cy + p.y * radius * persp
        const scale = 0.62 + depth * 0.72
        const el2 = el
        el2.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%) scale(${scale})`
        el2.style.opacity = String(0.22 + depth * 0.78)
        el2.style.zIndex = String(Math.round(depth * 100))
        el2.style.filter = depth < 0.42 ? `blur(${(0.42 - depth) * 4}px)` : 'none'
        // The frontmost words take the accent; the rest stay cool white.
        el2.style.color =
          depth > 0.82
            ? `rgba(${ar},${ag},${ab},${(depth - 0.82) / 0.18})`
            : 'rgba(255,255,255,0.92)'
      }
    }

    if (reduce) {
      // A still, readable three-quarter view — tipped so few words hide behind
      // others, then held. No loop.
      for (const p of pts) rotate(p, -0.32, 0.6)
      paint()
      const ro = new ResizeObserver(() => {
        measure()
        paint()
      })
      ro.observe(stage)
      return () => ro.disconnect()
    }

    // Steering. Idle drift when the pointer is away; follow the pointer when it
    // is over the stage. `slow` dips the whole spin while a word is hovered so
    // it can be read.
    const idleYaw = 0.28 // radians/sec, gentle
    const idlePitch = 0.06
    let velYaw = idleYaw
    let velPitch = idlePitch
    let tgtYaw = idleYaw
    let tgtPitch = idlePitch
    let slow = 1

    function onMove(e: PointerEvent) {
      const rect = stage!.getBoundingClientRect()
      const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
      const ny = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
      const max = 2.4
      tgtYaw = nx * max
      tgtPitch = -ny * max
    }
    function onLeave() {
      tgtYaw = idleYaw
      tgtPitch = idlePitch
    }
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerleave', onLeave)

    // Hovering a word slows the sphere so it can be read.
    const enter = () => {
      slow = 0.12
    }
    const exit = () => {
      slow = 1
    }
    for (const el of nodes) {
      if (!el) continue
      el.addEventListener('pointerenter', enter)
      el.addEventListener('pointerleave', exit)
    }

    let raf = 0
    let last = -1
    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away

      // Ease the spin toward its target and apply the read-slow.
      velYaw += (tgtYaw - velYaw) * Math.min(1, dt * 4)
      velPitch += (tgtPitch - velPitch) * Math.min(1, dt * 4)
      const ax = velPitch * slow * dt
      const ay = velYaw * slow * dt
      for (const p of pts) rotate(p, ax, ay)
      paint()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(() => measure())
    ro.observe(stage)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
      for (const el of nodes) {
        if (!el) continue
        el.removeEventListener('pointerenter', enter)
        el.removeEventListener('pointerleave', exit)
      }
    }
  }, [base, reduce, accent])

  return (
    <div className={`relative ${className}`}>
      {/* A clean, ordered read for assistive tech — the visual cloud is decorative. */}
      <ul className="sr-only">
        {words.map((word) => (
          <li key={word}>{word}</li>
        ))}
      </ul>
      <div
        ref={stageRef}
        aria-hidden
        className="absolute inset-0 touch-none select-none [perspective:900px]"
      >
        {words.map((word, i) => (
          <span
            key={word}
            ref={(el) => {
              nodeRefs.current[i] = el
            }}
            className="absolute left-0 top-0 whitespace-nowrap text-sm font-semibold tracking-tight will-change-transform sm:text-base"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  )
}
