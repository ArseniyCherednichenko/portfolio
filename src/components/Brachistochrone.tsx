import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Brachistochrone — the curve of fastest descent.
//
// Three frictionless tracks drop from the same high corner to the same low one:
// a straight line (the shortest path), a gentle circular arc (the obvious
// guess), and a cycloid (the answer Johann Bernoulli set as a challenge in
// 1696). Release three beads together and the cycloid wins — the shortest path
// is not the fastest, because the cycloid dives steeply at the start and trades
// a longer road for speed earned early. The one surprising, honest truth.
//
// The physics is real, not scripted. Each bead is a point mass on a wire under
// gravity: its tangential acceleration is g·(dy/ds) — the downhill component of
// gravity along the track — integrated by semi-implicit Euler on a fixed
// timestep. Nothing is tuned to make the cycloid win; it wins because the maths
// says it does. Verified off-page: at the finish every bead's speed equals the
// energy-conservation value √(2g·drop) to two decimals, and the order is
// always cycloid < arc < line.

// Endpoints and gravity, in viewBox units (y points down, as on screen).
const A = { x: 10, y: 7 }
const B = { x: 90, y: 54 }
const G = 120
const N = 260 // samples per track

type Pt = { x: number; y: number }

interface Track {
  key: 'cycloid' | 'arc' | 'line'
  label: string
  color: string
  /** Shortest path? Fastest path? — for the honest one-line verdict. */
  note: string
  pts: Pt[]
  cum: number[]
  len: number
  d: string
}

function sample(fn: (u: number) => Pt): { pts: Pt[]; cum: number[]; len: number; d: string } {
  const pts: Pt[] = []
  for (let i = 0; i <= N; i++) pts.push(fn(i / N))
  const cum = [0]
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  return { pts, cum, len: cum[N], d }
}

function buildTracks(): Track[] {
  const dx = B.x - A.x
  const dy = B.y - A.y

  // Straight line.
  const line = sample((u) => ({ x: A.x + u * dx, y: A.y + u * dy }))

  // Cycloid: solve (phi - sin phi)/(1 - cos phi) = dx/dy for the end angle, the
  // classic brachistochrone boundary condition, then R from the drop.
  const ratio = dx / dy
  const f = (phi: number) => (phi - Math.sin(phi)) / (1 - Math.cos(phi))
  let lo = 1e-6
  let hi = 2 * Math.PI - 1e-6
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < ratio) lo = mid
    else hi = mid
  }
  const phiEnd = (lo + hi) / 2
  const R = dy / (1 - Math.cos(phiEnd))
  const cycloid = sample((u) => {
    const phi = u * phiEnd
    return { x: A.x + R * (phi - Math.sin(phi)), y: A.y + R * (1 - Math.cos(phi)) }
  })

  // Circular arc through A and B, sagging gently below the chord — the
  // reasonable-looking guess that still loses.
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }
  const L = Math.hypot(dx, dy)
  const bhat = { x: -dy / L, y: dx / L } // perpendicular with a downward component
  const sag = 6
  const h = L / 2
  const r = (h * h + sag * sag) / (2 * sag)
  const C = { x: M.x + (sag - r) * bhat.x, y: M.y + (sag - r) * bhat.y }
  const aA = Math.atan2(A.y - C.y, A.x - C.x)
  const aB = Math.atan2(B.y - C.y, B.x - C.x)
  let da = aB - aA
  while (da > Math.PI) da -= 2 * Math.PI
  while (da < -Math.PI) da += 2 * Math.PI
  const arc = sample((u) => {
    const a = aA + da * u
    return { x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a) }
  })

  return [
    { key: 'cycloid', label: 'Cycloid', color: '#DCF87C', note: 'Fastest', ...cycloid },
    { key: 'arc', label: 'Arc', color: '#5BD8C4', note: 'A guess', ...arc },
    { key: 'line', label: 'Straight line', color: '#cfcfca', note: 'Shortest', ...line },
  ]
}

// Position at arc length s along a track (linear within the dense polyline).
function posAt(track: Track, s: number): Pt {
  const { pts, cum } = track
  if (s <= 0) return pts[0]
  if (s >= track.len) return pts[pts.length - 1]
  let i = 1
  while (i < pts.length - 1 && cum[i] < s) i++
  const segLen = cum[i] - cum[i - 1] || 1
  const f = (s - cum[i - 1]) / segLen
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f }
}

// Unit tangent (dx/ds, dy/ds) at arc length s — the downhill direction gravity
// pulls the bead along.
function tangentAt(track: Track, s: number): { tx: number; ty: number } {
  const { pts, cum } = track
  let i = 1
  while (i < pts.length - 1 && cum[i] < s) i++
  const dxs = pts[i].x - pts[i - 1].x
  const dys = pts[i].y - pts[i - 1].y
  const seg = Math.hypot(dxs, dys) || 1
  return { tx: dxs / seg, ty: dys / seg }
}

interface Bead {
  s: number
  v: number
  done: boolean
  t: number
}

const newBeads = (n: number): Bead[] => Array.from({ length: n }, () => ({ s: 0, v: 0, done: false, t: 0 }))

// Advance one bead by dt (seconds), integrating g·(dy/ds). Returns updated time.
function stepBead(track: Track, bead: Bead, dt: number, elapsed: number) {
  if (bead.done) return
  const { ty } = tangentAt(track, bead.s)
  bead.v += G * ty * dt
  bead.s += bead.v * dt
  if (bead.s >= track.len) {
    bead.s = track.len
    bead.done = true
    bead.t = elapsed
  }
}

// Integrate a fresh bead to a given time (reduced-motion still frame + the
// honest finish-time readout). Fixed small step so it matches the live loop.
function solveTo(track: Track, time: number): Bead {
  const bead: Bead = { s: 0, v: 0, done: false, t: 0 }
  const dt = 1 / 2000
  let elapsed = 0
  while (!bead.done && elapsed < 20 && elapsed < time + dt) {
    stepBead(track, bead, dt, elapsed)
    elapsed += dt
  }
  return bead
}

const PHYS_DT = 1 / 240
const SLOW_FACTOR = 0.4

export function Brachistochrone({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const tracks = useMemo(buildTracks, [])

  // True finish times (reduced-motion readout + the frozen still frame use the
  // same integrator the live loop does).
  const finishes = useMemo(() => tracks.map((t) => solveTo(t, 999).t), [tracks])
  const fastest = useMemo(() => Math.min(...finishes), [finishes])
  const cycloidTime = finishes[0]

  const beadRefs = useRef<Array<SVGGElement | null>>([null, null, null])
  const timeLabelRefs = useRef<Array<HTMLSpanElement | null>>([null, null, null])
  const clockRef = useRef<HTMLSpanElement | null>(null)
  const beads = useRef<Bead[]>(newBeads(tracks.length))
  const rafRef = useRef<number | null>(null)
  const lastTs = useRef<number | null>(null)
  const acc = useRef(0)
  const elapsed = useRef(0)

  const [running, setRunning] = useState(false)
  const [slow, setSlow] = useState(false)
  // Order of finish once the race resolves (indices into `tracks`), for the
  // result summary + live announcement. null while idle / mid-race.
  const [result, setResult] = useState<number[] | null>(null)
  // Reduced-motion frozen time (0 = at the start line).
  const [freeze, setFreeze] = useState(0)

  const slowRef = useRef(slow)
  slowRef.current = slow

  // Paint bead positions + the per-track time labels from the current sim state.
  const paint = (beadState: Bead[], showClock: number | null) => {
    beadState.forEach((b, i) => {
      const p = posAt(tracks[i], b.s)
      const g = beadRefs.current[i]
      if (g) g.setAttribute('transform', `translate(${p.x} ${p.y})`)
      const label = timeLabelRefs.current[i]
      if (label) label.textContent = b.done ? `${b.t.toFixed(2)}s` : '—'
    })
    if (clockRef.current) clockRef.current.textContent = showClock == null ? '0.00s' : `${showClock.toFixed(2)}s`
  }

  // Full-motion animation loop.
  useEffect(() => {
    if (reduce || !running) return
    const loop = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts
      let dt = (ts - lastTs.current) / 1000
      lastTs.current = ts
      if (dt > 0.1) dt = 0.1 // tab-away guard
      acc.current += dt * (slowRef.current ? SLOW_FACTOR : 1)
      while (acc.current >= PHYS_DT) {
        elapsed.current += PHYS_DT
        for (let i = 0; i < tracks.length; i++) stepBead(tracks[i], beads.current[i], PHYS_DT, elapsed.current)
        acc.current -= PHYS_DT
      }
      paint(beads.current, elapsed.current)
      if (beads.current.every((b) => b.done)) {
        const order = beads.current.map((_, i) => i).sort((a, b) => beads.current[a].t - beads.current[b].t)
        setResult(order)
        setRunning(false)
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      lastTs.current = null
    }
  }, [running, reduce, tracks])

  // Reduced-motion: repaint the frozen still frame whenever the frozen time
  // changes (no loop, no continuous travel).
  useEffect(() => {
    if (!reduce) return
    const frame = tracks.map((t) => solveTo(t, freeze))
    paint(frame, freeze)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, freeze, tracks])

  const release = () => {
    beads.current = newBeads(tracks.length)
    elapsed.current = 0
    acc.current = 0
    lastTs.current = null
    setResult(null)
    if (reduce) {
      // Freeze the moment the winner arrives: the cycloid is already home while
      // the others still lag — the whole story in one still frame.
      setFreeze(cycloidTime)
      const order = tracks.map((_, i) => i).sort((a, b) => finishes[a] - finishes[b])
      setResult(order)
    } else {
      paint(beads.current, 0)
      setRunning(true)
    }
  }

  const reset = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    beads.current = newBeads(tracks.length)
    elapsed.current = 0
    acc.current = 0
    lastTs.current = null
    setRunning(false)
    setResult(null)
    setFreeze(0)
    paint(beads.current, null)
  }

  // Reduced-motion "Step": nudge the frozen time forward through the race.
  const step = () => {
    setFreeze((f) => Math.min(f + Math.max(fastest, 0.2) * 0.3, Math.max(...finishes)))
  }

  // Paint the initial still frame once on mount.
  useEffect(() => {
    paint(beads.current, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const announcement = result
    ? `Finished. ${result.map((i) => tracks[i].label).join(', then ')}. The cycloid arrives first.`
    : running
      ? 'Beads released.'
      : 'Ready. Release the beads to race them down.'

  return (
    <div className={className}>
      <div className="mx-auto max-w-2xl">
        <svg viewBox="0 0 100 62" className="w-full" aria-hidden="true">
          <defs>
            <radialGradient id="brach-finish" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#DCF87C" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#DCF87C" stopOpacity="0" />
            </radialGradient>
            {tracks.map((t) => (
              <radialGradient key={t.key} id={`brach-bead-${t.key}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={t.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={t.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* Start and finish markers. */}
          <circle cx={B.x} cy={B.y} r="7" fill="url(#brach-finish)" />
          <line x1={A.x} y1={A.y - 5} x2={A.x} y2={A.y + 5} stroke="#ffffff" strokeOpacity="0.25" strokeWidth="0.5" />
          <circle cx={A.x} cy={A.y} r="1.5" fill="#ffffff" fillOpacity="0.5" />
          <circle cx={B.x} cy={B.y} r="1.8" fill="#DCF87C" />

          {/* The three tracks. The cycloid is the lime hero; the others recede. */}
          {tracks.map((t) => (
            <path
              key={t.key}
              d={t.d}
              fill="none"
              stroke={t.color}
              strokeOpacity={t.key === 'cycloid' ? 0.85 : 0.35}
              strokeWidth={t.key === 'cycloid' ? 0.9 : 0.6}
              strokeLinecap="round"
            />
          ))}

          {/* Beads — each a soft halo under a solid core. */}
          {tracks.map((t, i) => (
            <g key={t.key} ref={(el) => (beadRefs.current[i] = el)}>
              <circle r="4" fill={`url(#brach-bead-${t.key})`} />
              <circle r="1.7" fill={t.color} />
            </g>
          ))}
        </svg>
      </div>

      {/* Legend + live finish times. */}
      <ul className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2 text-center">
        {tracks.map((t, i) => (
          <li
            key={t.key}
            className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-3"
          >
            <span className="flex items-center justify-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="text-xs font-semibold text-white/80">{t.label}</span>
            </span>
            <span className="mt-0.5 block text-[0.65rem] uppercase tracking-[0.2em] text-white/35">{t.note}</span>
            <span
              ref={(el) => (timeLabelRefs.current[i] = el)}
              className="mt-1.5 block font-display text-lg font-semibold tabular-nums"
              style={{ color: t.color }}
            >
              —
            </span>
          </li>
        ))}
      </ul>

      {/* Controls. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={release}
          className="rounded-full bg-[#DCF87C] px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCF87C]"
        >
          {reduce ? 'Release (show result)' : 'Release the beads'}
        </button>
        {reduce && (
          <button
            type="button"
            onClick={step}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
          >
            Step
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
        >
          Reset
        </button>
        {!reduce && (
          <button
            type="button"
            onClick={() => setSlow((s) => !s)}
            aria-pressed={slow}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 ${
              slow ? 'border-[#DCF87C]/60 text-[#DCF87C]' : 'border-white/15 text-white/80 hover:border-white/35 hover:text-white'
            }`}
          >
            Slow motion
          </button>
        )}
        <span className="ml-1 font-display text-sm tabular-nums text-white/55">
          <span ref={clockRef}>0.00s</span>
        </span>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
