import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Galton board — the bean machine Francis Galton built in 1873 to make the
// normal curve fall out of pure chance. Pour beads in at the top; each one
// clatters down through a staggered lattice of pegs, and at every peg it takes
// a hair of a swerve left or right. Do that over N rows and a bead's landing
// bin is the sum of N independent left/right nudges — a binomial(N, ½) — so a
// whole crowd of beads, dropped one after another, piles up into the bell curve
// nobody drew. It is the site's answer to a plain histogram: instead of stating
// that the numbers are normal, it lets the distribution precipitate out of the
// physics in front of you.
//
// The physics is honest, not scripted. Each bead is a point mass under gravity
// integrated by semi-implicit Euler at a fixed substep; a peg is a real circle,
// and a contact is resolved the textbook way — push the bead back out along the
// contact normal and reflect the normal component of its velocity with a little
// restitution, plus a whisper of tangential randomness because no real bead
// strikes a peg dead-centre. That sensitivity to the strike is the whole point:
// the left/right outcome is genuine chaos seeded by where the bead met the peg,
// not a coin flipped in code. Below the pegs the beads fall between thin
// dividers into their bins and stack; the pile heights ARE the histogram, drawn
// as they grow. When the tallest column fills its bin the board sweeps clean and
// begins again, so the curve is redrawn endlessly.
//
// It is alive on arrival: it mounts with the bins already part-filled toward the
// binomial shape and beads falling, and it is live under the pointer — press to
// pour a stream from wherever you touch, so you can aim the beads and lean the
// pile, then release and watch the centre pull it back. No wall clock and no
// seeded RNG on the hot path beyond the honest per-strike jitter (Math.random,
// runtime) — the loop runs off the rAF delta, so it is resize-stable. Under
// reduced motion the loop never starts: the bins are filled to the exact
// binomial(N, ½) silhouette and painted still, so the point reads at a glance.
// Decorative, so aria-hidden.

const ROWS = 8 // peg rows → ROWS + 1 bins, a binomial(ROWS, ½)
const BINS = ROWS + 1
const G = 2000 // gravity, px/s² — tuned to the card, not earth
const PEG_E = 0.42 // restitution off a peg
const WALL_E = 0.3 // restitution off a divider or side wall
const SUBSTEPS = 4 // integration substeps per frame, for clean contacts
const MAX_BALLS = 110 // active beads cap, so the loop stays cheap
const AUTO_MS = 90 // one bead poured from the centre this often
const POUR_MS = 34 // faster pour while the pointer is held

// Pascal's triangle row for the reduced-motion silhouette and the mount seed —
// the exact shape the board converges to.
function binomialRow(n: number) {
  const row = [1]
  for (let k = 1; k <= n; k++) row.push((row[k - 1] * (n - k + 1)) / k)
  return row
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  active: boolean
  bin: number // -1 until it drops past the pegs into a bin column
}

export function Galton({
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
    let cx = 0
    let pegTop = 0
    let binTop = 0
    let floorY = 0
    let rowGap = 0
    let colGap = 0
    let pegR = 0
    let ballR = 0
    let unit = 0 // vertical spacing of stacked beads in a bin
    let capacity = 0 // beads a bin holds before the board resets
    let wallL = 0
    let wallR = 0
    const pegs: { x: number; y: number }[] = []
    const binX: number[] = [] // centre x of each of the BINS bins
    const counts = new Array<number>(BINS).fill(0)

    // A pool of beads reused in place, so a busy board never churns the GC.
    const pool: Ball[] = Array.from({ length: MAX_BALLS }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      active: false,
      bin: -1,
    }))

    let raf = 0
    let last = -1
    let autoAcc = 0 // ms accumulated toward the next centre drop
    let clearing = 0 // 0..1 fade while the full board sweeps clean
    let pourX = -1 // pointer x while held, else -1
    let pourAcc = 0

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      cx = w / 2
      pegTop = Math.round(h * 0.22)
      binTop = Math.round(h * 0.64)
      floorY = Math.round(h * 0.95)

      // Column spacing sized to the width; row spacing fills the peg band.
      colGap = (w * 0.88) / ROWS
      rowGap = (binTop - pegTop) / (ROWS + 1)
      pegR = Math.max(2, Math.min(colGap * 0.14, rowGap * 0.18, 6))
      ballR = Math.max(2.5, Math.min(colGap * 0.22, 6.5))
      unit = ballR * 1.7
      capacity = Math.max(3, Math.floor((floorY - binTop - unit * 0.5) / unit))

      // The staggered triangular lattice: row r has r+1 pegs, centred.
      pegs.length = 0
      for (let r = 0; r < ROWS; r++) {
        const y = pegTop + (r + 1) * rowGap
        for (let i = 0; i <= r; i++) {
          pegs.push({ x: cx + (i - r / 2) * colGap, y })
        }
      }

      // BINS gaps straddle the bottom row of pegs.
      binX.length = 0
      for (let j = 0; j < BINS; j++) binX.push(cx + (j - ROWS / 2) * colGap)
      wallL = binX[0] - colGap / 2
      wallR = binX[BINS - 1] + colGap / 2
    }

    function spawn(x: number) {
      let ball: Ball | null = null
      for (const b of pool)
        if (!b.active) {
          ball = b
          break
        }
      if (!ball) return // at the cap; let the board drain first
      ball.active = true
      ball.bin = -1
      ball.x = x + (Math.random() - 0.5) * colGap * 0.2
      ball.y = pegTop - rowGap * 0.6
      ball.vx = (Math.random() - 0.5) * 20
      ball.vy = 0
    }

    // Seed the bins toward the binomial shape so the bell is already forming on
    // arrival — honest, it is just the board caught mid-run.
    function seedBins() {
      const row = binomialRow(ROWS)
      const peak = Math.max(...row)
      const target = capacity * 0.42
      for (let j = 0; j < BINS; j++)
        counts[j] = Math.round((row[j] / peak) * target)
    }

    function stepBall(b: Ball, dt: number) {
      b.vy += G * dt
      b.x += b.vx * dt
      b.y += b.vy * dt

      if (b.bin < 0) {
        // In the peg field: resolve against every peg it overlaps.
        for (const p of pegs) {
          const dx = b.x - p.x
          const dy = b.y - p.y
          const min = pegR + ballR
          const d2 = dx * dx + dy * dy
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.0001
            const nx = dx / d
            const ny = dy / d
            b.x = p.x + nx * min
            b.y = p.y + ny * min
            const vn = b.vx * nx + b.vy * ny
            if (vn < 0) {
              b.vx -= (1 + PEG_E) * vn * nx
              b.vy -= (1 + PEG_E) * vn * ny
              // A whisper of tangential kick: real beads never strike dead
              // centre, and this seeds the honest left/right chaos.
              b.vx += (nx === 0 ? Math.random() - 0.5 : -ny) * 26 * (Math.random() - 0.5)
            }
          }
        }
        // Side walls of the whole board.
        if (b.x < wallL + ballR) {
          b.x = wallL + ballR
          if (b.vx < 0) b.vx = -b.vx * WALL_E
        } else if (b.x > wallR - ballR) {
          b.x = wallR - ballR
          if (b.vx > 0) b.vx = -b.vx * WALL_E
        }
        // Once past the last peg row, commit to a bin column.
        if (b.y > binTop) {
          let j = Math.round((b.x - cx) / colGap + ROWS / 2)
          b.bin = Math.max(0, Math.min(BINS - 1, j))
        }
      } else {
        // In a bin: constrained between its dividers, falling onto the pile.
        const lo = binX[b.bin] - colGap / 2 + ballR
        const hi = binX[b.bin] + colGap / 2 - ballR
        if (b.x < lo) {
          b.x = lo
          if (b.vx < 0) b.vx = -b.vx * WALL_E
        } else if (b.x > hi) {
          b.x = hi
          if (b.vx > 0) b.vx = -b.vx * WALL_E
        }
        const pileTop = floorY - counts[b.bin] * unit
        if (b.y + ballR >= pileTop) {
          counts[b.bin] += 1
          b.active = false
          if (counts[b.bin] >= capacity && clearing === 0) clearing = 0.0001
        }
      }
    }

    function drawStatic() {
      // Hopper — a small V at the top that funnels beads to the drop point.
      ctx!.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      ctx!.moveTo(cx - colGap * 0.9, pegTop - rowGap * 1.1)
      ctx!.lineTo(cx - ballR * 1.4, pegTop - rowGap * 0.2)
      ctx!.moveTo(cx + colGap * 0.9, pegTop - rowGap * 1.1)
      ctx!.lineTo(cx + ballR * 1.4, pegTop - rowGap * 0.2)
      ctx!.stroke()

      // Pegs.
      ctx!.fillStyle = 'rgba(255,255,255,0.28)'
      for (const p of pegs) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, pegR, 0, Math.PI * 2)
        ctx!.fill()
      }

      // Bin dividers.
      ctx!.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx!.lineWidth = 1
      for (let j = 0; j <= BINS; j++) {
        const x = wallL + (j / BINS) * (wallR - wallL)
        ctx!.beginPath()
        ctx!.moveTo(x, binTop)
        ctx!.lineTo(x, floorY)
        ctx!.stroke()
      }
    }

    function drawPiles(alpha: number) {
      for (let j = 0; j < BINS; j++) {
        const n = counts[j]
        if (n <= 0) continue
        const x = binX[j]
        for (let k = 0; k < n; k++) {
          const y = floorY - (k + 0.5) * unit
          // Settled beads sit calm and a touch dimmer than the live ones.
          const a = alpha * (0.5 + 0.4 * (k / Math.max(1, capacity)))
          ctx!.fillStyle = `rgba(${ar},${ag},${ab},${Math.min(0.92, a)})`
          ctx!.beginPath()
          ctx!.arc(x, y, ballR * 0.92, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }

    function drawBall(b: Ball) {
      // Glow.
      ctx!.save()
      ctx!.globalCompositeOperation = 'lighter'
      const g = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, ballR * 3)
      g.addColorStop(0, `rgba(${ar},${ag},${ab},0.5)`)
      g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(b.x, b.y, ballR * 3, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.restore()

      // Body with a cool highlight, echoing the cradle's bobs.
      const body = ctx!.createRadialGradient(
        b.x - ballR * 0.3,
        b.y - ballR * 0.3,
        ballR * 0.1,
        b.x,
        b.y,
        ballR,
      )
      body.addColorStop(0, `rgba(${ar},${ag},${ab},1)`)
      body.addColorStop(1, `rgba(${ar},${ag},${ab},0.72)`)
      ctx!.fillStyle = body
      ctx!.beginPath()
      ctx!.arc(b.x, b.y, ballR, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.fillStyle = 'rgba(255,255,255,0.5)'
      ctx!.beginPath()
      ctx!.arc(b.x - ballR * 0.32, b.y - ballR * 0.32, ballR * 0.3, 0, Math.PI * 2)
      ctx!.fill()
    }

    function render() {
      ctx!.clearRect(0, 0, w, h)
      drawStatic()
      drawPiles(clearing > 0 ? 1 - clearing : 1)
      for (const b of pool) if (b.active) drawBall(b)
    }

    layout()

    if (reduce) {
      // The exact converged silhouette, filled and held still.
      const row = binomialRow(ROWS)
      const peak = Math.max(...row)
      for (let j = 0; j < BINS; j++)
        counts[j] = Math.round((row[j] / peak) * capacity * 0.82)
      render()
      const ro = new ResizeObserver(() => {
        layout()
        for (let j = 0; j < BINS; j++)
          counts[j] = Math.round(
            (binomialRow(ROWS)[j] / peak) * capacity * 0.82,
          )
        render()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    seedBins()

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away so nothing jumps

      if (clearing > 0) {
        // Sweep the full board clean, then start the curve over.
        clearing += dt * 1.8
        if (clearing >= 1) {
          for (let j = 0; j < BINS; j++) counts[j] = 0
          for (const b of pool) b.active = false
          clearing = 0
        }
      } else {
        // Pour beads: a steady centre drip, plus an aimed stream while held.
        autoAcc += dt * 1000
        while (autoAcc >= AUTO_MS) {
          autoAcc -= AUTO_MS
          spawn(cx)
        }
        if (pourX >= 0) {
          pourAcc += dt * 1000
          while (pourAcc >= POUR_MS) {
            pourAcc -= POUR_MS
            spawn(pourX)
          }
        }
      }

      const sub = dt / SUBSTEPS
      for (let s = 0; s < SUBSTEPS; s++)
        for (const b of pool) if (b.active) stepBall(b, sub)

      render()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function clampPour(clientX: number) {
      const rect = canvas!.getBoundingClientRect()
      const x = clientX - rect.left
      return Math.max(wallL + ballR, Math.min(wallR - ballR, x))
    }
    function onDown(e: PointerEvent) {
      pourX = clampPour(e.clientX)
      pourAcc = POUR_MS // pour immediately on press
      canvas!.setPointerCapture?.(e.pointerId)
    }
    function onMove(e: PointerEvent) {
      if (pourX >= 0) pourX = clampPour(e.clientX)
    }
    function onUp() {
      pourX = -1
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full cursor-pointer touch-none ${className}`}
    />
  )
}
