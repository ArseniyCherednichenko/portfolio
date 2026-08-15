import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Chladni plate — the 18th-century acoustics demonstration, in maths. Ernst
// Chladni drew a bow across the edge of a sand-strewn metal plate and the grains
// fled the parts that shook hardest and gathered along the lines that barely
// moved at all, tracing the plate's standing-wave pattern in sand. Drive the
// plate at a different frequency and a different figure appears. It is the same
// family as the Morphogen and the Phyllotaxis nearby — a pattern that emerges
// from a rule rather than being drawn — but the mechanism here is the one thing
// none of the others are: a *field the particles read*, not particles pushing on
// each other.
//
// The physics is the honest, standard model. For a square plate the vibration
// amplitude at a point is s(x,y) = sin(πnx)·sin(πmy) + sin(πmx)·sin(πny), with
// x,y over the unit square and (m,n) the mode — how many half-waves fit each
// way. The nodal lines, where s = 0, are the still places. Each grain of sand
// takes a random step whose length grows with how hard the plate shakes under
// it (|s|): out on an antinode it is flung about and can't rest; near a nodal
// line it barely moves, so over time the sand drains onto the lines and the
// figure precipitates out of noise. Nothing places the pattern — it is the walk
// biased by the field.
//
// It is alive: it mounts already sweeping slowly through a sequence of real
// modes, easing (m,n) between integer figures so the lines re-thread rather than
// snap. MOVE THE POINTER over the plate to tune it by hand — left-right sets one
// mode number, up-down the other — and the sand re-forms into whatever figure
// you land on; PRESS to strike the plate, tossing the settled sand back up so it
// re-gathers. No wall clock — the sweep advances off the rAF delta — so it is
// resize-stable. Under reduced motion the loop never starts: one figure is
// settled in a tight batch of up-front iterations and painted still. Decorative,
// so aria-hidden.

// A curated ring of mode pairs, each a legible Chladni figure, cycled when idle.
const MODES: [number, number][] = [
  [2, 3],
  [3, 4],
  [1, 4],
  [3, 5],
  [2, 5],
  [4, 5],
  [1, 3],
  [4, 6],
  [3, 7],
  [5, 6],
]

const COUNT = 2600 // grains of sand
const M_MIN = 1 // pointer-tunable mode range
const M_SPAN = 6
const MIN_WALK = 0.0016 // step even a still grain takes, so nothing locks forever
const SHAKE = 0.10 // how far an antinode flings a grain
const EASE = 0.045 // how fast the live mode chases its target
const DWELL = 190 // frames a swept figure is held before easing to the next

// The plate's vibration amplitude at (x,y) in the unit square for mode (m,n).
function amp(x: number, y: number, m: number, n: number) {
  return (
    Math.sin(Math.PI * n * x) * Math.sin(Math.PI * m * y) +
    Math.sin(Math.PI * m * x) * Math.sin(Math.PI * n * y)
  )
}

export function Chladni({
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
    let plate = 0 // side of the square plate in css px
    let ox = 0 // plate origin (top-left) in css px
    let oy = 0
    let raf = 0
    let last = -1

    // Grain positions in unit-square plate coordinates [0,1].
    const px = new Float32Array(COUNT)
    const py = new Float32Array(COUNT)
    function scatter() {
      for (let i = 0; i < COUNT; i++) {
        px[i] = Math.random()
        py[i] = Math.random()
      }
    }
    scatter()

    // Live mode, its sweep target, and the idle-sweep cursor.
    let curM = MODES[0][0]
    let curN = MODES[0][1]
    let tgtM = curM
    let tgtN = curN
    let modeIx = 0
    let dwell = DWELL
    let pointerActive = false

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Largest square that fits with a little breathing room.
      plate = Math.floor(Math.min(w, h) * 0.9)
      ox = Math.round((w - plate) / 2)
      oy = Math.round((h - plate) / 2)
    }

    // Advance the sand one step: each grain walks a distance set by how hard the
    // plate shakes beneath it, so the crowd drains onto the still nodal lines.
    function step() {
      for (let i = 0; i < COUNT; i++) {
        const a = Math.abs(amp(px[i], py[i], curM, curN))
        const d = MIN_WALK + a * SHAKE
        let nx = px[i] + (Math.random() * 2 - 1) * d
        let ny = py[i] + (Math.random() * 2 - 1) * d
        if (nx < 0) nx = -nx
        else if (nx > 1) nx = 2 - nx
        if (ny < 0) ny = -ny
        else if (ny > 1) ny = 2 - ny
        px[i] = nx
        py[i] = ny
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h)

      // The plate — a faint square the sand sits on.
      ctx!.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx!.lineWidth = 1
      ctx!.strokeRect(ox + 0.5, oy + 0.5, plate - 1, plate - 1)

      // Sand: small lime grains composited additively, so where they pile onto a
      // nodal line the light builds and the figure reads brightest along it.
      ctx!.save()
      ctx!.globalCompositeOperation = 'lighter'
      ctx!.fillStyle = `rgba(${ar},${ag},${ab},0.5)`
      const r = plate > 360 ? 1.15 : 0.9
      for (let i = 0; i < COUNT; i++) {
        const x = ox + px[i] * plate
        const y = oy + py[i] * plate
        ctx!.beginPath()
        ctx!.arc(x, y, r, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.restore()
    }

    layout()

    if (reduce) {
      // No loop: settle one figure in a tight batch of iterations and hold it.
      curM = 3
      curN = 5
      for (let k = 0; k < 260; k++) step()
      draw()
      const ro = new ResizeObserver(() => {
        layout()
        draw()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away

      // When left alone, sweep slowly through the curated modes; the pointer
      // overrides the target while it is on the plate.
      if (!pointerActive) {
        dwell -= 1
        if (dwell <= 0) {
          modeIx = (modeIx + 1) % MODES.length
          tgtM = MODES[modeIx][0]
          tgtN = MODES[modeIx][1]
          dwell = DWELL
        }
      }
      // Ease the live mode toward its target so the lines re-thread smoothly.
      curM += (tgtM - curM) * EASE
      curN += (tgtN - curN) * EASE

      step()
      draw()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // Pointer: tune the plate by position (x -> one mode, y -> the other) and
    // strike it on press to toss the settled sand back up.
    function tune(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect()
      const u = Math.min(1, Math.max(0, (clientX - rect.left - ox) / plate))
      const v = Math.min(1, Math.max(0, (clientY - rect.top - oy) / plate))
      tgtM = M_MIN + u * M_SPAN
      tgtN = M_MIN + v * M_SPAN
      pointerActive = true
    }
    function onMove(e: PointerEvent) {
      tune(e.clientX, e.clientY)
    }
    function onDown(e: PointerEvent) {
      scatter() // strike: sand jumps, then re-gathers on the new figure
      tune(e.clientX, e.clientY)
      canvas!.setPointerCapture?.(e.pointerId)
    }
    function onLeave() {
      // Hand back to the idle sweep from wherever the pointer left it.
      pointerActive = false
      dwell = DWELL
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < MODES.length; i++) {
        const d = (MODES[i][0] - tgtM) ** 2 + (MODES[i][1] - tgtN) ** 2
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      modeIx = best
      tgtM = MODES[best][0]
      tgtN = MODES[best][1]
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerup', onLeave)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerup', onLeave)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full cursor-crosshair touch-none ${className}`}
    />
  )
}
