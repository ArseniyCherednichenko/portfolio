import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Mandelbrot explorer — the natural companion to the JuliaSet already on the
// shelf, and not a second copy of it but its map. The Julia set asks, for one
// fixed constant c, which starting points z stay bounded under z' = z*z + c.
// The Mandelbrot set asks the mirror question: start every point z = 0 and let
// c BE the point of the plane — for which c does the orbit stay bounded? So each
// pixel here is one whole Julia set collapsed to a yes/no dot, and the black
// body you see is exactly the atlas of every c whose Julia set is connected.
// Sitting the two side by side makes that relationship legible: this is the
// index, the Julia set is a single page from it.
//
// Where the Julia piece hands its one constant to the cursor, this one is built
// to be fallen into. Click (or press +) to dive toward a point and the frame
// eases in, doubling the magnification; the escape-time coastline keeps
// resolving finer detail the deeper you go, because the iteration budget grows
// with the zoom. Scroll to zoom around the pointer, drag- there is no drag; use
// the arrows to pan, and double-click (or press 0) to fall back out to the whole
// set. A live readout shows the centre and the magnification so the abstraction
// stays honest.
//
// The maths runs off the React render path: each settled frame iterates the grid
// into a raw pixel buffer with smooth (fractional) escape colouring through a
// precomputed lime-on-ink palette LUT, into a modest internal buffer that CSS
// upscales. A frame only repaints when the view actually moves, so at rest the
// loop costs almost nothing; the iteration cap keeps a deep dive affordable on a
// laptop and never trips the environment's guards. Under reduced motion the eased
// loop never runs: one crisp, fixed view is drawn and held, and clicks jump to
// the new frame instantly rather than gliding. Decorative, so the canvas is
// aria-hidden while the focusable frame carries the label and the controls.

// The opening frame: the whole set, nudged left so the body sits centred with a
// little air around the antenna.
const HOME = { cx: -0.6, cy: 0, half: 1.75 }
// A handsome deep-zoom target for the reduced-motion still — a seahorse valley
// on the west neck, rich without being pure filament.
const STILL = { cx: -0.745, cy: 0.1132, half: 0.028 }

export function Mandelbrot({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  // Surfaced so the coordinate and magnification behind the picture stay legible.
  const [readout, setReadout] = useState({ cx: HOME.cx, cy: HOME.cy, zoom: 1 })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    // A 256-entry palette LUT: deep ink -> a cool teal shadow -> the lime accent
    // -> near-white at the escape rim. Fast-escaping points bloom toward white,
    // slow near-boundary points sit dark, interior (never-escaping) points get
    // index 0 and stay ink-black, so the set reads as a solid body.
    const LUT = new Uint8ClampedArray(256 * 3)
    const stops: Array<[number, [number, number, number]]> = [
      [0.0, [8, 10, 9]],
      [0.35, [14, 40, 46]],
      [0.62, [ar, ag, ab]],
      [1.0, [245, 255, 235]],
    ]
    for (let i = 0; i < 256; i++) {
      const t = i / 255
      let s = 0
      while (s < stops.length - 2 && t > stops[s + 1][0]) s++
      const [t0, c0] = stops[s]
      const [t1, c1] = stops[s + 1]
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
      LUT[i * 3] = c0[0] + (c1[0] - c0[0]) * f
      LUT[i * 3 + 1] = c0[1] + (c1[1] - c0[1]) * f
      LUT[i * 3 + 2] = c0[2] + (c1[2] - c0[2]) * f
    }

    let bw = 0
    let bh = 0
    let img: ImageData | null = null
    let raf = 0
    const LOG2 = Math.log(2)

    // The live view and the frame it is easing toward. `half` is the half-width
    // of the plane shown, in complex units — smaller means deeper.
    const view = { ...(reduce ? STILL : HOME) }
    const target = { ...view }

    // Iteration budget grows with the zoom so deep frames keep resolving, but is
    // capped so a dive stays affordable. Home sits at the floor.
    function maxIter() {
      const depth = Math.log2(HOME.half / target.half)
      return Math.min(420, Math.round(110 + Math.max(0, depth) * 34))
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      const cssW = Math.max(1, rect.width)
      const cssH = Math.max(1, rect.height)
      // Render into a modest internal buffer and let CSS upscale it. Reduced
      // motion, drawn once and never eased, can afford a crisper grid.
      const cap = reduce ? 720 : 480
      bw = Math.max(1, Math.min(cap, Math.round(cssW)))
      bh = Math.max(1, Math.round(bw * (cssH / cssW)))
      canvas!.width = bw
      canvas!.height = bh
      img = ctx!.createImageData(bw, bh)
    }

    // Iterate the whole grid for the current view and write the pixel buffer.
    function render() {
      if (!img) return
      const data = img.data
      const halfX = view.half
      const halfY = halfX * (bh / bw)
      const dx = (halfX * 2) / bw
      const dy = (halfY * 2) / bh
      const left = view.cx - halfX
      const top = view.cy + halfY
      const MAX = maxIter()
      let p = 0
      for (let j = 0; j < bh; j++) {
        const cy = top - j * dy
        for (let i = 0; i < bw; i++) {
          const cx = left + i * dx
          let zx = 0
          let zy = 0
          let zx2 = 0
          let zy2 = 0
          let n = 0
          // Escape radius 4 (squared 16) keeps the smooth-colouring log term well
          // behaved. z -> z*z + c, with c the point of the plane.
          while (zx2 + zy2 < 16 && n < MAX) {
            zy = 2 * zx * zy + cy
            zx = zx2 - zy2 + cx
            zx2 = zx * zx
            zy2 = zy * zy
            n++
          }
          let idx = 0
          if (n < MAX) {
            const mag = zx2 + zy2
            const mu = n + 1 - Math.log(0.5 * Math.log(mag)) / LOG2
            let sN = mu / MAX
            if (sN < 0) sN = 0
            else if (sN > 1) sN = 1
            idx = (Math.pow(sN, 0.5) * 255) | 0
          }
          const q = idx * 3
          data[p] = LUT[q]
          data[p + 1] = LUT[q + 1]
          data[p + 2] = LUT[q + 2]
          data[p + 3] = 255
          p += 4
        }
      }
      ctx!.putImageData(img, 0, 0)
    }

    // --- interaction: everything below moves `target`; the loop eases to it. ---

    // Map a pointer event to its complex coordinate under the current view.
    function toPlane(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect()
      const nx = (clientX - rect.left) / rect.width
      const ny = (clientY - rect.top) / rect.height
      const halfY = view.half * (rect.height / rect.width)
      return {
        re: view.cx - view.half + nx * view.half * 2,
        im: view.cy + halfY - ny * halfY * 2,
      }
    }

    const MIN_HALF = 4e-5 // floor: about a 40,000x dive, past which doubles lose fidelity
    const MAX_HALF = HOME.half

    function zoomAround(px: number, py: number, factor: number) {
      const nextHalf = Math.max(MIN_HALF, Math.min(MAX_HALF, target.half * factor))
      // Keep the point under the cursor fixed as the frame scales.
      const k = nextHalf / target.half
      target.cx = px + (target.cx - px) * k
      target.cy = py + (target.cy - py) * k
      target.half = nextHalf
      settle()
    }

    function onClick(e: MouseEvent) {
      const pt = toPlane(e.clientX, e.clientY)
      // Recentre on the click and dive one octave.
      const nextHalf = Math.max(MIN_HALF, target.half * 0.5)
      target.cx = pt.re
      target.cy = pt.im
      target.half = nextHalf
      settle()
    }
    function onDouble(e: MouseEvent) {
      e.preventDefault()
      target.cx = HOME.cx
      target.cy = HOME.cy
      target.half = HOME.half
      settle()
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const pt = toPlane(e.clientX, e.clientY)
      zoomAround(pt.re, pt.im, e.deltaY < 0 ? 0.86 : 1 / 0.86)
    }
    function onKey(e: KeyboardEvent) {
      const step = view.half * 0.35
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault()
          zoomAround(target.cx, target.cy, 0.5)
          break
        case '-':
        case '_':
          e.preventDefault()
          zoomAround(target.cx, target.cy, 2)
          break
        case '0':
        case 'Home':
          e.preventDefault()
          target.cx = HOME.cx
          target.cy = HOME.cy
          target.half = HOME.half
          settle()
          break
        case 'ArrowLeft':
          e.preventDefault()
          target.cx -= step
          settle()
          break
        case 'ArrowRight':
          e.preventDefault()
          target.cx += step
          settle()
          break
        case 'ArrowUp':
          e.preventDefault()
          target.cy += step
          settle()
          break
        case 'ArrowDown':
          e.preventDefault()
          target.cy -= step
          settle()
          break
        default:
          return
      }
    }

    // Reflect the current view into the readout a few times a second — never at
    // animation rate, so React is never asked to re-render per frame.
    function pushReadout() {
      setReadout({ cx: view.cx, cy: view.cy, zoom: HOME.half / view.half })
    }

    resize()

    if (reduce) {
      // No easing loop: draw the still once and re-render on resize. Clicks and
      // keys still work, but jump straight to the new frame with no glide.
      render()
      pushReadout()
      const jump = () => {
        view.cx = target.cx
        view.cy = target.cy
        view.half = target.half
        render()
        pushReadout()
      }
      const onClickStill = (e: MouseEvent) => {
        onClick(e)
        jump()
      }
      const onDoubleStill = (e: MouseEvent) => {
        onDouble(e)
        jump()
      }
      const onWheelStill = (e: WheelEvent) => {
        onWheel(e)
        jump()
      }
      const onKeyStill = (e: KeyboardEvent) => {
        onKey(e)
        jump()
      }
      canvas.addEventListener('click', onClickStill)
      canvas.addEventListener('dblclick', onDoubleStill)
      canvas.addEventListener('wheel', onWheelStill, { passive: false })
      const wrap = wrapRef.current
      wrap?.addEventListener('keydown', onKeyStill)
      const ro = new ResizeObserver(() => {
        resize()
        render()
      })
      ro.observe(canvas)
      return () => {
        canvas.removeEventListener('click', onClickStill)
        canvas.removeEventListener('dblclick', onDoubleStill)
        canvas.removeEventListener('wheel', onWheelStill)
        wrap?.removeEventListener('keydown', onKeyStill)
        ro.disconnect()
      }
    }

    // `settling` gates the loop: it repaints while the view is chasing the target
    // and one final crisp frame when it arrives, then idles at near-zero cost.
    let settling = true
    let lastReadout = 0
    function settle() {
      settling = true
    }

    function frame(now: number) {
      if (settling) {
        const dcx = target.cx - view.cx
        const dcy = target.cy - view.cy
        // Ease the half in log-space so a deep dive feels linear, not front-loaded.
        const lh = Math.log(view.half)
        const lt = Math.log(target.half)
        const dlh = lt - lh
        view.cx += dcx * 0.16
        view.cy += dcy * 0.16
        view.half = Math.exp(lh + dlh * 0.16)

        const done =
          Math.abs(dcx) < view.half * 1e-3 &&
          Math.abs(dcy) < view.half * 1e-3 &&
          Math.abs(dlh) < 1e-3
        if (done) {
          view.cx = target.cx
          view.cy = target.cy
          view.half = target.half
          settling = false
        }
        render()
        if (now - lastReadout > 120) {
          pushReadout()
          lastReadout = now
        }
      }
      raf = requestAnimationFrame(frame)
    }

    canvas.addEventListener('click', onClick)
    canvas.addEventListener('dblclick', onDouble)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    const wrap = wrapRef.current
    wrap?.addEventListener('keydown', onKey)
    const ro = new ResizeObserver(() => {
      resize()
      settle()
    })
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('dblclick', onDouble)
      canvas.removeEventListener('wheel', onWheel)
      wrap?.removeEventListener('keydown', onKey)
      ro.disconnect()
    }
  }, [reduce, accent])

  const fmt = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(4)
  // Magnification, shown compactly: ×1, ×12, ×3.4k.
  const zoomLabel = (() => {
    const z = readout.zoom
    if (z >= 1000) return '×' + (z / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    if (z >= 10) return '×' + Math.round(z)
    return '×' + z.toFixed(1).replace(/\.0$/, '')
  })()

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="img"
      aria-label="Interactive Mandelbrot set. Click or press plus to zoom in, double-click or press zero to reset, arrow keys to pan."
      className={`group relative cursor-crosshair rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 ${className}`}
    >
      <canvas ref={ref} className="h-full w-full select-none" aria-hidden="true" />
      {/* A quiet hint, fading up on hover/focus so the frame invites the dive. */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-white/50 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        Click to zoom · double-click to reset
      </div>
      {/* Live readout of the centre coordinate and magnification. */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 font-mono text-[0.7rem] tabular-nums text-white/60 backdrop-blur-sm">
        c = {fmt(readout.cx)} {fmt(readout.cy)}i · {zoomLabel}
      </div>
    </div>
  )
}
