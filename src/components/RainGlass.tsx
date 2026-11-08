import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Rain on a window — condensation fogging a pane of glass, with water beads that
// grow, break free, and slide, and a finger that wipes the fog away. It is the
// one piece in this family whose whole subject is the GLASS, not what is behind
// it: the backdrop (a blurred, out-of-focus night city, warm windows smeared
// into bokeh) is deliberately never in focus, because the only way to see it
// sharply is to clear the condensation — by letting a running drop cut a streak
// through the mist, or by dragging the pointer across the pane like a palm on a
// cold window. Distinct from the family's other water (the ripple tank's surface
// waves, the fluid sim's dye): this is water held by surface tension against a
// vertical sheet, which is a different physics and a different picture.
//
// How it reads as real glass. The pane carries three coupled layers that the
// frame composites in order. (1) A fog mask — a greyscale buffer where opaque
// means "cleared", transparent means "fogged". It starts empty (fully misted)
// and, crucially, is faded back toward fogged a hair every frame, so the glass
// slowly re-mists after you wipe it and a drop's streak heals over behind it;
// condensation is a living equilibrium here, not a one-way erase. (2) The sharp
// scene, shown through the mask (composite destination-in), so a wipe or a trail
// reveals the city in focus exactly where the glass was cleared. (3) The beads
// themselves, drawn on top as little lenses — a dark contact shadow, a cool rim,
// and a bright specular catch up and to the left — each also clearing a dab of
// fog beneath itself, since the water displaces the mist it sits on.
//
// The droplet life is the honest part. Tiny beads nucleate at random across the
// cold pane and occasionally grow; when one grows past the point where gravity
// beats surface tension it breaks free and runs, accelerating down the glass,
// cutting a cleared trail and ABSORBING every smaller bead it rolls over (radii
// add in quadrature, so a fat drop that has eaten its way down is visibly the
// sum of what it swept up) until it leaves at the bottom. The pointer is a warm
// palm: dragging it clears a wide swath of fog and pushes the small beads out of
// the way. No Math.random on a render path drives anything load-bearing — only
// the cosmetic nucleation — and everything is in device pixels on offscreen
// buffers so the composite stays crisp at any DPR.
//
// Honest and reachable: the canvas is decorative and aria-hidden, the pane
// carries one plain label, and the Wipe control is a real button. Under reduced
// motion nothing runs — a single still frame is drawn with a scatter of settled
// beads and a couple of healed trails, the city showing through them, re-drawn
// on resize. Props { className?, accent? }.

interface Bead {
  x: number
  y: number
  r: number
  vy: number
  sliding: boolean
}

const MAX_BEADS = 180
const STILL_BEADS = 90

// mulberry32 — a tiny deterministic PRNG, so the still frame is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function RainGlass({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const wipeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    // Offscreen buffers, all at the backing resolution so drawImage is 1:1.
    const sharp = document.createElement('canvas') // the city, in focus
    const blur = document.createElement('canvas') // the fogged pane
    const mask = document.createElement('canvas') // cleared = opaque
    const reveal = document.createElement('canvas') // sharp ∩ mask, per frame
    const sctx = sharp.getContext('2d')!
    const bctx = blur.getContext('2d')!
    const mctx = mask.getContext('2d')!
    const rctx = reveal.getContext('2d')!

    let bw = 0
    let bh = 0
    let beads: Bead[] = []
    let raf = 0
    const rng = mulberry32(0x7a1c9e3f)

    // The backdrop: a soft night sky and a jagged skyline of dark towers with
    // scattered warm (and a few cool) lit windows — an abstract city glow, not
    // any one place. Drawn once per layout into `sharp`, then blurred into
    // `blur` by a cheap down/up sample so the fogged pane is genuinely soft.
    function paintScene() {
      // Sky — deep blue-black, a faint warm sodium haze near the horizon.
      const sky = sctx.createLinearGradient(0, 0, 0, bh)
      sky.addColorStop(0, '#0a0e1a')
      sky.addColorStop(0.62, '#0d1322')
      sky.addColorStop(0.86, '#1a1626')
      sky.addColorStop(1, '#241a28')
      sctx.fillStyle = sky
      sctx.fillRect(0, 0, bw, bh)

      // A couple of soft glows (streetlamp / distant sign bloom).
      for (let i = 0; i < 3; i++) {
        const gx = (0.2 + rng() * 0.6) * bw
        const gy = (0.6 + rng() * 0.35) * bh
        const gr = bh * (0.25 + rng() * 0.2)
        const warm = i === 1
        const g = sctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
        g.addColorStop(0, warm ? 'rgba(255,196,120,0.16)' : 'rgba(150,180,230,0.12)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        sctx.fillStyle = g
        sctx.fillRect(0, 0, bw, bh)
      }

      // Skyline — overlapping rectangular towers rising from the bottom, each a
      // touch darker/lighter so the city has depth, with lit windows.
      const unit = Math.max(8, Math.round(bw / 42)) // window grid pitch
      let x = -unit
      while (x < bw + unit) {
        const tw = unit * (2 + Math.floor(rng() * 4))
        const th = bh * (0.28 + rng() * 0.5)
        const top = bh - th
        const shade = 8 + Math.floor(rng() * 12)
        sctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 10})`
        sctx.fillRect(x, top, tw, th)
        // Windows.
        for (let wy = top + unit; wy < bh - unit * 0.5; wy += unit) {
          for (let wx = x + unit * 0.5; wx < x + tw - unit * 0.5; wx += unit) {
            if (rng() > 0.4) continue
            const warm = rng() > 0.25
            const lit = 0.5 + rng() * 0.5
            sctx.fillStyle = warm
              ? `rgba(255,${180 + Math.floor(rng() * 50)},${110 + Math.floor(rng() * 40)},${lit})`
              : `rgba(${120 + Math.floor(rng() * 40)},${160 + Math.floor(rng() * 40)},200,${lit * 0.8})`
            sctx.fillRect(Math.round(wx), Math.round(wy), unit * 0.52, unit * 0.62)
          }
        }
        x += tw + unit * (rng() > 0.5 ? 0 : 1)
      }

      // Blur: downsample into a small buffer and draw it back up, twice, then
      // lay a thin cool-white film over it — the condensation lightens and
      // desaturates whatever is behind it.
      const ds = 10
      const sw = Math.max(1, Math.round(bw / ds))
      const sh = Math.max(1, Math.round(bh / ds))
      const tiny = document.createElement('canvas')
      tiny.width = sw
      tiny.height = sh
      const tctx = tiny.getContext('2d')!
      tctx.imageSmoothingEnabled = true
      tctx.drawImage(sharp, 0, 0, sw, sh)
      bctx.imageSmoothingEnabled = true
      bctx.clearRect(0, 0, bw, bh)
      bctx.drawImage(tiny, 0, 0, sw, sh, 0, 0, bw, bh)
      bctx.drawImage(blur, 0, 0) // second pass softens the upsample seams
      bctx.fillStyle = 'rgba(206,214,226,0.14)'
      bctx.fillRect(0, 0, bw, bh)
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      bw = Math.floor(w * dpr)
      bh = Math.floor(h * dpr)
      for (const c of [canvas!, sharp, blur, mask, reveal]) {
        c.width = bw
        c.height = bh
      }
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
      paintScene()
      mctx.clearRect(0, 0, bw, bh) // fully fogged
    }

    const R0 = () => bh * 0.006 // nucleation radius
    const RUN = () => bh * 0.022 // radius at which a bead breaks free

    function seedBeads(n: number, deterministic: boolean) {
      const rand = deterministic ? mulberry32(0x51edc0de) : rng
      for (let i = 0; i < n; i++) {
        beads.push({
          x: rand() * bw,
          y: rand() * bh,
          r: R0() * (1 + rand() * 2.4),
          vy: 0,
          sliding: false,
        })
      }
    }

    // Clear a soft disc of fog into the mask (opaque = cleared).
    function clearDisc(x: number, y: number, r: number, strength: number) {
      const g = mctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(255,255,255,${strength})`)
      g.addColorStop(0.7, `rgba(255,255,255,${strength * 0.7})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      mctx.fillStyle = g
      mctx.beginPath()
      mctx.arc(x, y, r, 0, Math.PI * 2)
      mctx.fill()
    }

    // Draw one bead as a little lens onto the main canvas.
    function drawBead(b: Bead) {
      const r = b.r
      // contact shadow, offset down-right
      ctx!.fillStyle = 'rgba(0,0,0,0.28)'
      ctx!.beginPath()
      ctx!.arc(b.x + r * 0.18, b.y + r * 0.22, r, 0, Math.PI * 2)
      ctx!.fill()
      // cool rim / body
      const body = ctx!.createRadialGradient(
        b.x - r * 0.3,
        b.y - r * 0.3,
        r * 0.1,
        b.x,
        b.y,
        r,
      )
      body.addColorStop(0, 'rgba(236,244,255,0.10)')
      body.addColorStop(0.75, 'rgba(200,214,232,0.04)')
      body.addColorStop(1, 'rgba(120,140,170,0.18)')
      ctx!.fillStyle = body
      ctx!.beginPath()
      ctx!.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx!.fill()
      // specular catch, upper-left — a hint of accent on the larger drops
      ctx!.fillStyle =
        r > RUN() * 0.8 ? `rgba(${ar},${ag},${ab},0.55)` : 'rgba(255,255,255,0.7)'
      ctx!.beginPath()
      ctx!.arc(b.x - r * 0.38, b.y - r * 0.4, Math.max(0.6, r * 0.2), 0, Math.PI * 2)
      ctx!.fill()
    }

    // Composite the three layers for one frame.
    function compose() {
      ctx!.clearRect(0, 0, bw, bh)
      ctx!.drawImage(blur, 0, 0) // fogged pane
      rctx.globalCompositeOperation = 'source-over'
      rctx.clearRect(0, 0, bw, bh)
      rctx.drawImage(sharp, 0, 0)
      rctx.globalCompositeOperation = 'destination-in'
      rctx.drawImage(mask, 0, 0)
      rctx.globalCompositeOperation = 'source-over'
      ctx!.drawImage(reveal, 0, 0) // sharp city through the cleared fog
      for (const b of beads) drawBead(b)
    }

    // --- static (reduced motion) -------------------------------------------
    function still() {
      beads = []
      mctx.clearRect(0, 0, bw, bh)
      seedBeads(STILL_BEADS, true)
      // A couple of healed-over trails for composition.
      const rand = mulberry32(0x1234abcd)
      for (let i = 0; i < 4; i++) {
        const tx = (0.15 + rand() * 0.7) * bw
        const len = bh * (0.3 + rand() * 0.5)
        const start = rand() * (bh - len)
        const rr = bh * (0.01 + rand() * 0.014)
        for (let y = start; y < start + len; y += rr * 0.6) clearDisc(tx, y, rr, 0.22)
        beads.push({ x: tx, y: start + len, r: rr * 1.6, vy: 0, sliding: false })
      }
      for (const b of beads) clearDisc(b.x, b.y, b.r * 0.9, 0.5)
      compose()
    }

    // --- live loop ----------------------------------------------------------
    function step() {
      // 1) fog slowly re-forms everywhere
      mctx.globalCompositeOperation = 'destination-out'
      mctx.fillStyle = 'rgba(0,0,0,0.012)'
      mctx.fillRect(0, 0, bw, bh)
      mctx.globalCompositeOperation = 'source-over'

      // 2) nucleate new beads
      if (beads.length < MAX_BEADS && rng() < 0.6) {
        beads.push({
          x: rng() * bw,
          y: rng() * bh,
          r: R0() * (0.6 + rng() * 1.1),
          vy: 0,
          sliding: false,
        })
      }

      const run = RUN()
      const next: Bead[] = []
      for (const b of beads) {
        if (!b.sliding) {
          // slow growth; a few beads tip over into running
          if (rng() < 0.03) b.r += R0() * (0.4 + rng() * 0.8)
          if (b.r >= run && rng() < 0.2) {
            b.sliding = true
            b.vy = bh * 0.0008
          }
          clearDisc(b.x, b.y, b.r * 0.9, 0.06) // water keeps its own patch clear
          next.push(b)
          continue
        }
        // sliding: accelerate, cut a trail, absorb the small beads it passes
        b.vy += bh * 0.00012 * (0.4 + b.r / run)
        const steps = Math.max(1, Math.ceil((b.vy * 16) / Math.max(1, b.r)))
        let dead = false
        for (let s = 0; s < steps && !dead; s++) {
          b.y += (b.vy * 16) / steps
          clearDisc(b.x, b.y, b.r * 0.85, 0.5)
          for (const o of beads) {
            if (o === b || o.sliding) continue
            const dx = o.x - b.x
            const dy = o.y - b.y
            if (dx * dx + dy * dy < (b.r + o.r) * (b.r + o.r)) {
              b.r = Math.sqrt(b.r * b.r + o.r * o.r)
              o.r = -1 // mark absorbed
            }
          }
          if (b.y - b.r > bh) dead = true
        }
        if (!dead) next.push(b)
      }
      beads = next.filter((b) => b.r > 0)

      compose()
      raf = requestAnimationFrame(step)
    }

    // Pointer = a palm dragged across the cold glass: clears a wide swath and
    // shoves small beads aside.
    let lastX = 0
    let lastY = 0
    let have = false
    function wipeAt(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect()
      const x = (clientX - rect.left) * (bw / rect.width)
      const y = (clientY - rect.top) * (bh / rect.height)
      const br = bh * 0.06
      if (have) {
        const dx = x - lastX
        const dy = y - lastY
        const dist = Math.hypot(dx, dy)
        const n = Math.max(1, Math.ceil(dist / (br * 0.5)))
        for (let i = 0; i <= n; i++) {
          clearDisc(lastX + (dx * i) / n, lastY + (dy * i) / n, br, 0.6)
        }
      } else {
        clearDisc(x, y, br, 0.6)
      }
      beads = beads.filter((b) => b.sliding || Math.hypot(b.x - x, b.y - y) > br * 0.8)
      lastX = x
      lastY = y
      have = true
    }
    function onMove(e: PointerEvent) {
      e.preventDefault()
      wipeAt(e.clientX, e.clientY)
    }
    function onLeave() {
      have = false
    }

    function wipeAll() {
      mctx.fillStyle = 'rgba(255,255,255,1)'
      mctx.fillRect(0, 0, bw, bh)
      beads = beads.filter((b) => b.sliding)
      if (reduce) compose()
    }

    layout()
    wipeRef.current = wipeAll

    if (reduce) {
      still()
      const roStill = new ResizeObserver(() => {
        layout()
        still()
      })
      roStill.observe(canvas)
      return () => {
        roStill.disconnect()
        wipeRef.current = null
      }
    }

    seedBeads(50, false)
    raf = requestAnimationFrame(step)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => {
      layout()
      beads = []
      seedBeads(50, false)
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      wipeRef.current = null
    }
  }, [reduce, accent])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={ref}
        aria-hidden
        className="absolute inset-0 h-full w-full cursor-pointer touch-none"
      />
      <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-[13rem]">
        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
            Condensation
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            The city is behind the fog. Drag across the glass, or wait for a drop to run, to
            clear a view — the pane slowly mists over again.
          </p>
        </div>
      </div>
      <div className="absolute bottom-5 right-5 z-10">
        <button
          type="button"
          onClick={() => wipeRef.current?.()}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          Wipe
        </button>
      </div>
    </div>
  )
}
