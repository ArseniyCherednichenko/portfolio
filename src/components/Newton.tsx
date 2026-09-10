import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Newton — the Newton–Raphson fractal, the third member of the site's
// escape-time family and a different question from the two beside it. The
// Julia and Mandelbrot sets ask whether an orbit escapes to infinity; this one
// asks the opposite — where does it land? Newton's method is the schoolbook way
// to find a root of a function: stand at a guess z, follow the tangent of the
// curve down to where it crosses zero, and repeat; for well-behaved starts it
// converges in a few steps. Run it on the complex plane for f(z) = z^3 - a,
// which has three roots evenly spaced on a circle, and colour every starting
// point by WHICH of the three roots it falls into (the basin) and HOW FAST it
// gets there (the shade). The three basins do not meet along clean borders —
// between any two lies a filigree of the third, and between those, more, all
// the way down: a fractal boundary that is the whole appeal.
//
// Cheap by the same trick as the Plasma beside it: the iteration runs on a
// coarse offscreen buffer (one pixel per SCALE screen pixels) written in one
// putImageData, then drawImage upscales it soft onto the visible canvas. The
// per-pixel inner loop early-outs the moment a guess lands near a root, and the
// three basin colours are three restrained tints of the site's palette — lime,
// a cool mint, a warm amber — shaded ink-to-tint-to-white by convergence speed,
// so the plane reads as folded light rather than a rainbow.
//
// It is alive without a wall clock beyond a slow phase: the constant a rides a
// unit circle, so the three roots turn and the whole basin structure wheels and
// re-folds. The pointer leans that phase, so moving across it winds the fractal
// forward or back under the cursor. Under reduced motion there is no loop and
// no pointer: painted once at a fixed phase, re-drawn only on resize.
export function Newton({
  className = '',
  speed = 1,
  scale = 3,
  interactive = true,
}: {
  className?: string
  /** Time multiplier for the slow winding of the roots. */
  speed?: number
  /** Screen pixels per computed buffer pixel — bigger is coarser and faster. */
  scale?: number
  /** Let the pointer lean the winding phase. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Three basin tints, one per root, kept inside the site's single-accent
    // language: lime is the accent, the mint and amber are cool/warm neighbours
    // desaturated so the plane never reads as a rainbow. Each is [r,g,b].
    const TINTS: [number, number, number][] = [
      [220, 248, 124], // lime
      [120, 214, 198], // cool mint
      [232, 196, 122], // warm amber
    ]

    // Offscreen coarse buffer, computed then upscaled onto the visible canvas.
    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d')
    if (!bctx) return

    const MAX_ITER = 26
    const TOL2 = 1e-4 // squared distance to a root that counts as converged

    let w = 0
    let h = 0
    let bw = 0
    let bh = 0
    let img: ImageData | null = null
    let raf = 0
    let last = 0
    // Extra phase the pointer winds in, eased toward a target so it never jumps.
    let lean = 0
    let leanTarget = 0

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas!.width = w
      canvas!.height = h
      bw = Math.max(1, Math.ceil(w / scale))
      bh = Math.max(1, Math.ceil(h / scale))
      buf.width = bw
      buf.height = bh
      img = bctx!.createImageData(bw, bh)
      ctx!.imageSmoothingEnabled = true
    }

    function render(phase: number) {
      if (!img) return
      const data = img.data
      // a rides the unit circle; f(z) = z^3 - a, so its three roots are the cube
      // roots of a and they turn with the phase.
      const ar = Math.cos(phase)
      const ai = Math.sin(phase)
      // The three roots of z^3 = a, precomputed once per frame.
      const mag = Math.cbrt(Math.hypot(ar, ai)) // = 1, but kept honest
      const arg = Math.atan2(ai, ar)
      const rootRe = [0, 0, 0]
      const rootIm = [0, 0, 0]
      for (let k = 0; k < 3; k++) {
        const a = (arg + 2 * Math.PI * k) / 3
        rootRe[k] = mag * Math.cos(a)
        rootIm[k] = mag * Math.sin(a)
      }

      // Map the buffer onto a fixed window of the complex plane, aspect-correct
      // so the roots never stretch when the panel changes shape.
      const aspect = bw / bh
      const spanY = 2.6
      const spanX = spanY * aspect
      let i = 0
      for (let y = 0; y < bh; y++) {
        const zi0 = (y / bh - 0.5) * spanY
        for (let x = 0; x < bw; x++) {
          const zr0 = (x / bw - 0.5) * spanX
          let zr = zr0
          let zi = zi0
          let it = 0
          let basin = -1
          for (; it < MAX_ITER; it++) {
            // z^2 and z^3
            const zr2 = zr * zr - zi * zi
            const zi2 = 2 * zr * zi
            const zr3 = zr2 * zr - zi2 * zi
            const zi3 = zr2 * zi + zi2 * zr
            // f = z^3 - a, f' = 3 z^2
            const fr = zr3 - ar
            const fi = zi3 - ai
            const dr = 3 * zr2
            const di = 3 * zi2
            const den = dr * dr + di * di
            if (den < 1e-12) break // stationary point; leave as boundary
            // z -= f / f'  (complex division)
            zr -= (fr * dr + fi * di) / den
            zi -= (fi * dr - fr * di) / den
            // Converged near a root?
            const d0r = zr - rootRe[0]
            const d0i = zi - rootIm[0]
            if (d0r * d0r + d0i * d0i < TOL2) {
              basin = 0
              break
            }
            const d1r = zr - rootRe[1]
            const d1i = zi - rootIm[1]
            if (d1r * d1r + d1i * d1i < TOL2) {
              basin = 1
              break
            }
            const d2r = zr - rootRe[2]
            const d2i = zi - rootIm[2]
            if (d2r * d2r + d2i * d2i < TOL2) {
              basin = 2
              break
            }
          }

          let r: number
          let g: number
          let b: number
          if (basin < 0) {
            // Never settled — the fractal boundary itself. Near-ink.
            r = 10
            g = 12
            b = 14
          } else {
            const tint = TINTS[basin]
            // Fewer iterations = deeper in a basin = brighter; a smooth ramp
            // from ink up through the tint and on toward a white specular.
            const f = 1 - it / MAX_ITER // 0..1, high near a root
            const s = f * f // bias the light toward the fast-converging centres
            // ink -> tint
            let rr = 8 + (tint[0] - 8) * s
            let gg = 9 + (tint[1] - 9) * s
            let bb = 12 + (tint[2] - 12) * s
            // lift the very fastest toward white so basin cores glow
            const hot = s > 0.72 ? (s - 0.72) / 0.28 : 0
            rr += (255 - rr) * hot * 0.55
            gg += (255 - gg) * hot * 0.55
            bb += (255 - bb) * hot * 0.55
            r = rr
            g = gg
            b = bb
          }
          data[i] = r
          data[i + 1] = g
          data[i + 2] = b
          data[i + 3] = 255
          i += 4
        }
      }
      bctx!.putImageData(img, 0, 0)
      ctx!.drawImage(buf, 0, 0, bw, bh, 0, 0, w, h)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      // Horizontal travel winds the phase forward or back — up to ~a full turn.
      leanTarget = nx * Math.PI * 2
    }
    function onLeave() {
      leanTarget = 0
    }

    resize()

    if (reduce) {
      // A fixed, already-formed phase — the three basins clearly separated.
      render(0.5)
      const ro = new ResizeObserver(() => {
        resize()
        render(0.5)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const start = performance.now()
    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      // Throttle to ~30fps: the winding is slow, so half the frames look the
      // same and cost nothing.
      if (now - last < 33) return
      last = now
      lean += (leanTarget - lean) * 0.06
      render(((now - start) / 1000) * 0.35 * speed + lean)
    }
    if (interactive) {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, speed, scale, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
