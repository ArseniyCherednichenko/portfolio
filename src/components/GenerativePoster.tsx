import { useEffect, useMemo, useRef } from 'react'

// A generative poster, drawn from a seed. The whole picture is a pure function
// of four values — a motif, a palette, a density, and an integer seed — so the
// same settings paint the exact same poster every time, on screen and in the
// downloaded PNG. No randomness leaks in from `Math.random` or the wall clock:
// every "random" choice comes from a seeded `mulberry32`, the same deterministic
// generator the Playground pieces use, so a shared link reproduces a poster
// pixel-for-pixel on someone else's machine.
//
// The renderer (`paintPoster`) takes a bare 2D context and its dimensions, which
// is what lets the /studio page paint the small on-screen preview and, on
// download, a large offscreen canvas from the identical code — the export is not
// a screenshot, it is the same drawing composed at print resolution.

// --- Seeded RNG. mulberry32: tiny, fast, deterministic. ---
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

export type PosterMotif = 'bloom' | 'flow' | 'rings'

export interface PosterPalette {
  /** Stable id, used in the URL and the segmented control. */
  id: string
  /** Human label. */
  label: string
  /** Page/canvas background. */
  bg: string
  /** Two or three ink colours the marks are drawn in. */
  inks: readonly string[]
}

// Honest colour choices only — no claim attaches to a palette, it is just paint.
// The first is the site's own lime-on-ink; the others are tasteful alternates.
export const POSTER_PALETTES: readonly PosterPalette[] = [
  { id: 'lime', label: 'Lime', bg: '#0A0A0A', inks: ['#DCF87C', '#A6C64B', '#EAF7C0'] },
  { id: 'ink', label: 'Ink', bg: '#0A0A0A', inks: ['#FFFFFF', '#9AA0AA', '#565B65'] },
  { id: 'ember', label: 'Ember', bg: '#140B08', inks: ['#F4A259', '#E4572E', '#F5E6C4'] },
  { id: 'tide', label: 'Tide', bg: '#06121A', inks: ['#7CD4F8', '#4C8FB3', '#CFEFFB'] },
]

export const POSTER_MOTIFS: ReadonlyArray<{ id: PosterMotif; label: string; note: string }> = [
  { id: 'bloom', label: 'Bloom', note: 'A phyllotactic head — the sunflower packing, seeded and tinted.' },
  { id: 'flow', label: 'Flow', note: 'Streamlines drifting through a seeded vector field.' },
  { id: 'rings', label: 'Rings', note: 'Concentric orbits, scattered with beads on a seeded round.' },
]

export function paletteById(id: string): PosterPalette {
  return POSTER_PALETTES.find((p) => p.id === id) ?? POSTER_PALETTES[0]
}

export interface PosterOptions {
  seed: number
  motif: PosterMotif
  palette: PosterPalette
  /** 0..1 — how busy the composition is. */
  density: number
}

// Parse "#rrggbb" into an [r,g,b] triple for alpha compositing.
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5)) // ~137.5 deg, the golden angle

/**
 * Paint one poster into a 2D context sized `w`x`h`. Pure and deterministic:
 * only `opts` and the dimensions decide the pixels. Called for both the live
 * preview and the high-resolution export, so the download matches the screen.
 */
export function paintPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: PosterOptions,
) {
  const { seed, motif, palette, density } = opts
  const rand = mulberry32(seed)
  const cx = w / 2
  const cy = h / 2
  const unit = Math.min(w, h)

  // --- Ground: the background, then a soft radial lift so the centre glows. ---
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, w, h)
  const [br, bg, bb] = rgb(palette.bg)
  const lift = ctx.createRadialGradient(cx, cy * 0.86, unit * 0.05, cx, cy, unit * 0.9)
  lift.addColorStop(0, `rgba(${Math.min(255, br + 16)},${Math.min(255, bg + 16)},${Math.min(255, bb + 18)},0.9)`)
  lift.addColorStop(1, `rgba(${br},${bg},${bb},0)`)
  ctx.fillStyle = lift
  ctx.fillRect(0, 0, w, h)

  const inks = palette.inks.map(rgb)
  const pick = () => inks[Math.floor(rand() * inks.length)]

  ctx.save()
  // Marks accumulate light, so density sums toward the accent rather than muddying.
  ctx.globalCompositeOperation = 'lighter'

  if (motif === 'bloom') {
    // Vogel's phyllotaxis: seed i at angle i*golden + drift, radius c*sqrt(i).
    const count = Math.round(600 + density * 2600)
    const spread = unit * 0.44
    const c = spread / Math.sqrt(count)
    const drift = rand() * Math.PI * 2
    const wobble = 0.004 * (rand() - 0.5)
    for (let i = 1; i <= count; i++) {
      const r = c * Math.sqrt(i)
      const th = i * (GOLDEN + wobble) + drift
      const x = cx + r * Math.cos(th)
      const y = cy + r * Math.sin(th)
      const rr = i / count
      const [ir, ig, ib] = inks[Math.floor((rr + rand() * 0.15) * inks.length) % inks.length]
      const dot = unit * 0.001 + rr * unit * 0.006
      const alpha = 0.12 + rr * 0.5
      ctx.beginPath()
      ctx.fillStyle = `rgba(${ir},${ig},${ib},${alpha})`
      ctx.arc(x, y, dot, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (motif === 'flow') {
    // A seeded vector field: a small sum of sines whose frequencies and phases
    // come from the RNG. Each streamline integrates through it and is stroked.
    const a1 = 1.6 + rand() * 2.4
    const b1 = 1.6 + rand() * 2.4
    const a2 = 2.4 + rand() * 3.2
    const b2 = 2.4 + rand() * 3.2
    const p1 = rand() * Math.PI * 2
    const p2 = rand() * Math.PI * 2
    const swirl = 0.6 + rand() * 1.1
    const field = (x: number, y: number) => {
      const nx = x / w
      const ny = y / h
      const v =
        Math.sin(nx * a1 + ny * b1 + p1) +
        0.5 * Math.sin(nx * a2 - ny * b2 + p2) +
        0.25 * Math.sin((nx - ny) * (a1 + a2) * 0.5)
      return v * Math.PI * swirl
    }
    const lines = Math.round(140 + density * 460)
    const steps = 150
    const step = unit * 0.006
    ctx.lineWidth = Math.max(1, unit * 0.0016)
    ctx.lineCap = 'round'
    for (let l = 0; l < lines; l++) {
      let x = rand() * w
      let y = rand() * h
      const [ir, ig, ib] = pick()
      ctx.strokeStyle = `rgba(${ir},${ig},${ib},0.12)`
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < steps; s++) {
        const ang = field(x, y)
        x += Math.cos(ang) * step
        y += Math.sin(ang) * step
        if (x < -unit || x > w + unit || y < -unit || y > h + unit) break
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else {
    // Rings: concentric orbits, each scattered with beads at seeded angles, plus
    // a faint guide circle so the structure reads even where the beads are sparse.
    const ringCount = Math.round(9 + density * 26)
    const maxR = unit * 0.46
    for (let ri = 1; ri <= ringCount; ri++) {
      const r = (ri / ringCount) * maxR
      const [gr, gg, gb] = inks[ri % inks.length]
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.06)`
      ctx.lineWidth = Math.max(1, unit * 0.0012)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      const beads = Math.round(6 + ri * (2 + density * 4))
      const phase = rand() * Math.PI * 2
      for (let bi = 0; bi < beads; bi++) {
        const jitter = (rand() - 0.5) * 0.25
        const th = phase + (bi / beads) * Math.PI * 2 + jitter
        const rr = r + (rand() - 0.5) * (maxR / ringCount) * 0.7
        const x = cx + rr * Math.cos(th)
        const y = cy + rr * Math.sin(th)
        const [ir, ig, ib] = pick()
        const dot = unit * 0.0016 + rand() * unit * 0.004
        ctx.beginPath()
        ctx.fillStyle = `rgba(${ir},${ig},${ib},0.55)`
        ctx.arc(x, y, dot, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  ctx.restore()

  // --- Fine grain: a fixed budget of seeded specks, so texture is deterministic
  // and cheap at any resolution rather than scaling with the pixel count. ---
  const specks = 1400
  const [wr, wg, wb] = inks[0]
  for (let i = 0; i < specks; i++) {
    const x = rand() * w
    const y = rand() * h
    ctx.fillStyle = `rgba(${wr},${wg},${wb},${rand() * 0.05})`
    ctx.fillRect(x, y, 1, 1)
  }

  // --- The mark: a quiet wordmark and the seed, so a downloaded poster carries
  // where it came from. Honest — just the initials and the number that made it. ---
  const pad = unit * 0.055
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = `rgba(${wr},${wg},${wb},0.9)`
  ctx.font = `700 ${unit * 0.03}px Georgia, 'Times New Roman', serif`
  ctx.fillText('AC', pad, h - pad)
  ctx.fillStyle = `rgba(${wr},${wg},${wb},0.4)`
  ctx.font = `500 ${unit * 0.018}px ui-monospace, 'SF Mono', Menlo, monospace`
  const tag = `studio · seed ${seed}`
  const tw = ctx.measureText(tag).width
  ctx.fillText(tag, w - pad - tw, h - pad)
}

/**
 * The live preview canvas. Repaints whenever the options change, and on resize,
 * at device-pixel resolution. The poster is a still composition — there is no
 * animation loop, so it is inert under reduced motion by construction and needs
 * no guard. Decorative, so aria-hidden with a described sibling on the page.
 */
export function GenerativePoster({
  options,
  className = '',
}: {
  options: PosterOptions
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Stable dependency key so the paint effect only re-runs on a real change.
  const key = useMemo(
    () => `${options.seed}|${options.motif}|${options.palette.id}|${options.density.toFixed(3)}`,
    [options.seed, options.motif, options.palette.id, options.density],
  )

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    function render() {
      const rect = canvas!.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintPoster(ctx!, w, h, options)
    }

    render()
    const ro = new ResizeObserver(render)
    ro.observe(canvas)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return <canvas ref={ref} aria-hidden="true" className={className} />
}
