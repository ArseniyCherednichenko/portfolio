import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Platonic — the five regular solids, built as line-drawings you can grab and
// tumble. It is the honest 3D companion to the Tesseract a place above it: that
// one holds a shape out of a plane you cannot picture; this one holds the whole
// family of shapes from the plane you can — the only five convex solids whose
// faces are all the same regular polygon meeting the same way at every corner.
// Euclid closes the Elements by proving there are exactly these five and no
// more, and that finiteness is the thing worth drawing.
//
// Nothing about the geometry is hand-counted. Each solid is just its vertex
// coordinates (the classic golden-ratio sets for the dodecahedron and the
// icosahedron), and the EDGES are DERIVED, not typed in: an edge is any pair of
// vertices at the shortest distance that occurs in the figure, so the tetra's
// six, the cube's twelve, the icosahedron's thirty all fall straight out of the
// points with nothing to miscount. The face count is never stored either — it is
// read back from Euler's formula, F = 2 − V + E, and shown live, so the readout
// is a computed fact about the object on screen rather than a label beside it.
//
// It is driven, not scripted. A real 3×3 rotation matrix holds the orientation;
// dragging pre-multiplies it by a screen-space pitch-and-yaw so you grab the
// solid where your finger lands (no gimbal lock, free tumble in any direction),
// and the release carries the throw's angular velocity, bleeding off on friction
// over a gentle idle drift so it is alive when untouched and steerable under your
// hand. Depth cues do the rest of the read: vertices are rotated, cast down by a
// perspective divide, and each edge is drawn far-to-near — distant edges thin and
// dim graphite, near edges thick and warming toward white with a lime glow — so
// the wireframe reads as a turning crystal, not a flat tangle. One canvas, one
// rAF loop off the frame delta (no wall clock), DPR-capped, ResizeObserver-driven.
// The canvas is decoration (aria-hidden); the solid picker is a real radiogroup
// and a polite live region speaks the current solid and its V/E/F. Under
// prefers-reduced-motion the loop never runs — the chosen solid is projected once
// at a flattering angle and held still, and the picker simply repaints it; a drag
// still turns it directly, with no throw and no idle.

const ACCENT: readonly [number, number, number] = [220, 248, 124]
const PHI = (1 + Math.sqrt(5)) / 2

type SolidKey = 'tetra' | 'cube' | 'octa' | 'dodeca' | 'icosa'

interface SolidMeta {
  key: SolidKey
  name: string
  short: string
  /** The regular polygon every face is. */
  face: string
}

const SOLIDS: readonly SolidMeta[] = [
  { key: 'tetra', name: 'Tetrahedron', short: 'Tetra', face: 'triangles' },
  { key: 'cube', name: 'Cube', short: 'Cube', face: 'squares' },
  { key: 'octa', name: 'Octahedron', short: 'Octa', face: 'triangles' },
  { key: 'dodeca', name: 'Dodecahedron', short: 'Dodeca', face: 'pentagons' },
  { key: 'icosa', name: 'Icosahedron', short: 'Icosa', face: 'triangles' },
]

// Raw vertex coordinates for each solid. The dodecahedron and icosahedron use
// the canonical golden-ratio sets; every solid is normalized to a unit radius so
// they all read at the same size on screen.
function rawVertices(key: SolidKey): number[][] {
  const P = PHI
  const I = 1 / P
  switch (key) {
    case 'tetra':
      return [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ]
    case 'cube': {
      const v: number[][] = []
      for (let i = 0; i < 8; i++) v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1])
      return v
    }
    case 'octa':
      return [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]
    case 'dodeca': {
      const v: number[][] = []
      for (let i = 0; i < 8; i++) v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1])
      v.push([0, I, P], [0, I, -P], [0, -I, P], [0, -I, -P])
      v.push([I, P, 0], [I, -P, 0], [-I, P, 0], [-I, -P, 0])
      v.push([P, 0, I], [P, 0, -I], [-P, 0, I], [-P, 0, -I])
      return v
    }
    case 'icosa':
      return [
        [0, 1, P],
        [0, 1, -P],
        [0, -1, P],
        [0, -1, -P],
        [1, P, 0],
        [1, -P, 0],
        [-1, P, 0],
        [-1, -P, 0],
        [P, 0, 1],
        [P, 0, -1],
        [-P, 0, 1],
        [-P, 0, -1],
      ]
  }
}

function normalize(v: number[][]): number[][] {
  return v.map(([x, y, z]) => {
    const r = Math.hypot(x, y, z) || 1
    return [x / r, y / r, z / r]
  })
}

// Edges are the vertex pairs separated by the shortest distance the figure
// contains — so they are computed from the points, never hand-listed.
function deriveEdges(v: number[][]): [number, number][] {
  const d = (a: number, b: number) =>
    Math.hypot(v[a][0] - v[b][0], v[a][1] - v[b][1], v[a][2] - v[b][2])
  let min = Infinity
  for (let a = 0; a < v.length; a++)
    for (let b = a + 1; b < v.length; b++) min = Math.min(min, d(a, b))
  const eps = min * 1.1 // the next-shortest chord in every Platonic solid is >1.1× the edge
  const e: [number, number][] = []
  for (let a = 0; a < v.length; a++)
    for (let b = a + 1; b < v.length; b++) if (d(a, b) <= eps) e.push([a, b])
  return e
}

// 3×3 row-major matrix helpers — a real rotation state, no Euler angles, so the
// tumble never locks and a grab turns the solid about the screen axes.
type Mat = number[]
function matMul(a: Mat, b: Mat): Mat {
  const c = new Array(9)
  for (let r = 0; r < 3; r++)
    for (let col = 0; col < 3; col++)
      c[r * 3 + col] =
        a[r * 3] * b[col] + a[r * 3 + 1] * b[3 + col] + a[r * 3 + 2] * b[6 + col]
  return c
}
function rotX(t: number): Mat {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [1, 0, 0, 0, c, -s, 0, s, c]
}
function rotY(t: number): Mat {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}
// Pre-multiply R by a screen-space yaw then pitch, so dragging rotates the solid
// about the axes of the screen the way grabbing a real object would.
function spin(R: Mat, pitch: number, yaw: number): Mat {
  return matMul(matMul(rotX(pitch), rotY(yaw)), R)
}

export function Platonic({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const [which, setWhich] = useState<SolidKey>('dodeca')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const meta = SOLIDS.find((s) => s.key === which)!

  // V / E / F for the live readout. Edges are derived; faces come from Euler's
  // formula, so the whole readout is computed from the geometry on screen.
  const counts = useMemo(() => {
    const verts = normalize(rawVertices(which))
    const edges = deriveEdges(verts)
    const V = verts.length
    const E = edges.length
    return { V, E, F: 2 - V + E }
  }, [which])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = ACCENT
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const verts = normalize(rawVertices(which))
    const edges = deriveEdges(verts)

    let w = 0
    let h = 0
    let scale = 1

    // Orientation and motion live in refs — nothing on the hot path touches React.
    let R: Mat = matMul(rotX(-0.42), rotY(0.6))
    let velYaw = 0
    let velPitch = 0
    let dragging = false
    let intro = reduce ? 1 : 0

    const proj = verts.map(() => ({ x: 0, y: 0, z: 0 }))

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      scale = Math.min(w, h) * 0.34
    }

    function project() {
      const dist = 3.2
      let minZ = Infinity
      let maxZ = -Infinity
      const s = scale * (0.86 + 0.14 * intro)
      for (let k = 0; k < verts.length; k++) {
        const [vx, vy, vz] = verts[k]
        const x = R[0] * vx + R[1] * vy + R[2] * vz
        const y = R[3] * vx + R[4] * vy + R[5] * vz
        const z = R[6] * vx + R[7] * vy + R[8] * vz
        const f = 1 / (dist - z)
        proj[k].x = x * f * s + w / 2
        proj[k].y = y * f * s + h / 2
        proj[k].z = z
        if (z < minZ) minZ = z
        if (z > maxZ) maxZ = z
      }
      return { minZ, maxZ }
    }

    function paint() {
      const { minZ, maxZ } = project()
      const span = maxZ - minZ || 1
      ctx!.clearRect(0, 0, w, h)
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      const fade = intro

      // Far-to-near so nearer edges sit brightest on top.
      const order = edges
        .map((e, i) => ({ i, z: (proj[e[0]].z + proj[e[1]].z) / 2 }))
        .sort((a, b) => a.z - b.z)

      for (const { i } of order) {
        const [a, b] = edges[i]
        const pa = proj[a]
        const pb = proj[b]
        const t = ((pa.z + pb.z) / 2 - minZ) / span // 0 far … 1 near
        const alpha = (0.1 + t * 0.72) * fade
        const r = Math.round(ar + (255 - ar) * t * 0.75)
        const g = Math.round(ag + (255 - ag) * t * 0.55)
        const bl = Math.round(ab * (0.5 + t * 0.5))
        ctx!.strokeStyle = `rgba(${r},${g},${bl},${alpha.toFixed(3)})`
        ctx!.lineWidth = 0.6 + t * 2.3
        ctx!.shadowBlur = t * t * 10
        ctx!.shadowColor = `rgba(${ar},${ag},${ab},${(t * 0.5).toFixed(3)})`
        ctx!.beginPath()
        ctx!.moveTo(pa.x, pa.y)
        ctx!.lineTo(pb.x, pb.y)
        ctx!.stroke()
      }
      ctx!.shadowBlur = 0

      // Vertices as small warm points, same near weighting.
      for (let k = 0; k < verts.length; k++) {
        const t = (proj[k].z - minZ) / span
        const rad = (1.1 + t * 2.7) * (0.7 + 0.3 * fade)
        ctx!.fillStyle = `rgba(${Math.round(ar + (255 - ar) * t)},${Math.round(
          ag + (255 - ag) * t * 0.7,
        )},${Math.round(ab)},${((0.3 + t * 0.6) * fade).toFixed(3)})`
        ctx!.beginPath()
        ctx!.arc(proj[k].x, proj[k].y, rad, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    layout()

    // Pointer-driven tumble, in both motion modes (direct manipulation is allowed
    // under reduced motion — it just carries no throw and no idle).
    let lastX = 0
    let lastY = 0
    let lastT = 0
    const ROT = 0.01 // rad per px

    function onDown(e: PointerEvent) {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      lastT = performance.now()
      velYaw = 0
      velPitch = 0
      canvas!.setPointerCapture(e.pointerId)
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return
      const now = performance.now()
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      const dt = Math.max(0.001, (now - lastT) / 1000)
      lastT = now
      R = spin(R, dy * ROT, dx * ROT)
      velYaw = (dx * ROT) / dt
      velPitch = (dy * ROT) / dt
      if (reduce) paint()
    }
    function onUp(e: PointerEvent) {
      dragging = false
      try {
        canvas!.releasePointerCapture(e.pointerId)
      } catch {
        /* capture may already be gone */
      }
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    if (reduce) {
      paint()
      const roStatic = new ResizeObserver(() => {
        layout()
        paint()
      })
      roStatic.observe(canvas)
      return () => {
        roStatic.disconnect()
        canvas.removeEventListener('pointerdown', onDown)
        canvas.removeEventListener('pointermove', onMove)
        canvas.removeEventListener('pointerup', onUp)
        canvas.removeEventListener('pointercancel', onUp)
      }
    }

    let raf = 0
    let last = performance.now()
    const CAP = 6 // clamp a wild throw
    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      intro += (1 - intro) * Math.min(1, dt * 4)
      if (!dragging) {
        // Inertia from the throw, bleeding off over a quiet idle drift.
        velYaw *= Math.pow(0.12, dt)
        velPitch *= Math.pow(0.12, dt)
        velYaw = Math.max(-CAP, Math.min(CAP, velYaw))
        velPitch = Math.max(-CAP, Math.min(CAP, velPitch))
        const idleYaw = 0.34
        const idlePitch = 0.07
        R = spin(R, (velPitch + idlePitch) * dt, (velYaw + idleYaw) * dt)
      }
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [which, reduce])

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative aspect-square w-full max-w-[420px]">
        <canvas ref={canvasRef} aria-hidden className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />
      </div>

      <div
        role="radiogroup"
        aria-label="Choose a Platonic solid"
        className="mt-6 flex flex-wrap items-center justify-center gap-2"
      >
        {SOLIDS.map((s) => {
          const active = s.key === which
          return (
            <button
              key={s.key}
              role="radio"
              aria-checked={active}
              onClick={() => setWhich(s.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                active
                  ? 'border-[#DCF87C]/60 bg-[#DCF87C]/15 text-[#DCF87C]'
                  : 'border-white/12 text-white/55 hover:border-white/25 hover:text-white/80'
              }`}
            >
              {s.short}
            </button>
          )
        })}
      </div>

      <p aria-live="polite" className="mt-4 text-center text-sm text-white/55">
        <span className="font-medium text-white/80">{meta.name}</span>
        <span className="text-white/35"> — {meta.face}, </span>
        <span className="tabular-nums">{counts.V}</span> vertices,{' '}
        <span className="tabular-nums">{counts.E}</span> edges,{' '}
        <span className="tabular-nums">{counts.F}</span> faces
      </p>
    </div>
  )
}
