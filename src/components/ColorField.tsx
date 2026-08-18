import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A hand-built HSV colour picker. The native <input type="color"> hands the
// whole job to the OS — an opaque dialog you cannot style, animate, place, or
// theme. This is the control rebuilt from the colour maths up: a saturation /
// value plane you drag a thumb across, a hue rail beneath it, a live editable
// hex, an optional screen eyedropper, and a strip of presets. Every surface is
// a real focusable control the keyboard drives.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number) => Math.round(v)

type HSV = { h: number; s: number; v: number }
type RGB = { r: number; g: number; b: number }

// --- Colour maths (all channels 0..1 except h in 0..360) ---

function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s
  const hp = (h % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = v - c
  return { r: r + m, g: g + m, b: b + m }
}

function rgbToHsv({ r, g, b }: RGB): HSV {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function rgbToHex({ r, g, b }: RGB): string {
  const to = (c: number) =>
    clamp(round(c * 255), 0, 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  }
}

const hexOf = (hsv: HSV) => rgbToHex(hsvToRgb(hsv))

// The relative luminance of a colour, so a swatch can pick a readable label.
function isLight({ h, s, v }: HSV): boolean {
  const { r, g, b } = hsvToRgb({ h, s, v })
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6
}

const DEFAULT_SWATCHES = [
  '#DCF87C', // the site lime
  '#0A0A0A',
  '#FFFFFF',
  '#F97066',
  '#FDB022',
  '#32D583',
  '#36BFFA',
  '#7A5AF8',
  '#F670C7',
]

// The EyeDropper API is Chromium-only; feature-detect so the control never
// promises what the browser can't do.
interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> }
}

/**
 * A hand-built HSV colour picker. Drag the thumb across the saturation /
 * brightness plane, slide the hue rail, type a hex, sample a pixel from the
 * screen (where the browser supports it), or tap a preset. Controlled
 * (`value` + `onChange`) or uncontrolled (`defaultValue`); values are hex.
 *
 * The plane and the hue rail are real `role="slider"` controls: focus either
 * and the arrow keys drive it — on the plane, left/right move saturation and
 * up/down brightness; Shift takes bigger steps. Everything reads its live hex
 * to assistive tech. Under prefers-reduced-motion the thumb's grab-swell and
 * the preset check come off; it stays a plain, fully usable picker.
 */
export function ColorField({
  defaultValue = '#DCF87C',
  value: controlledValue,
  onChange,
  swatches = DEFAULT_SWATCHES,
  className = '',
}: {
  defaultValue?: string
  value?: string
  onChange?: (hex: string) => void
  swatches?: string[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const planeId = useId()
  const hueId = useId()

  // The canonical state is HSV, not hex: a hex round-trip loses the hue when
  // saturation or value hits zero (black and greys have no defined hue), which
  // would make the plane and hue rail jump around as you drag into a corner.
  const seed = () => rgbToHsv(hexToRgb(controlledValue ?? defaultValue) ?? { r: 0.86, g: 0.97, b: 0.49 })
  const [hsv, setHsv] = useState<HSV>(seed)

  // When driven as a controlled component, follow the incoming hex — but only
  // when it names a different colour than the one our HSV already renders, so a
  // parent echoing our own onChange can't stomp the live hue mid-drag.
  const lastEmit = useRef<string>(hexOf(hsv))
  useEffect(() => {
    if (controlledValue === undefined) return
    const incoming = controlledValue.toUpperCase()
    if (incoming === hexOf(hsv).toUpperCase()) return
    const rgb = hexToRgb(controlledValue)
    if (rgb) setHsv(rgbToHsv(rgb))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue])

  const commit = useCallback(
    (next: HSV) => {
      const clamped: HSV = {
        h: ((next.h % 360) + 360) % 360,
        s: clamp(next.s, 0, 1),
        v: clamp(next.v, 0, 1),
      }
      setHsv(clamped)
      const hex = hexOf(clamped)
      lastEmit.current = hex
      onChange?.(hex)
    },
    [onChange],
  )

  const hex = hexOf(hsv)
  const rgb = hsvToRgb(hsv)
  const hueHex = hexOf({ h: hsv.h, s: 1, v: 1 })

  // --- Saturation / value plane ---
  const planeRef = useRef<HTMLDivElement>(null)
  const [grabbing, setGrabbing] = useState<null | 'plane' | 'hue'>(null)

  const planeFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = planeRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const s = clamp((clientX - r.left) / r.width, 0, 1)
      const v = 1 - clamp((clientY - r.top) / r.height, 0, 1)
      commit({ h: hsv.h, s, v })
    },
    [commit, hsv.h],
  )

  const onPlaneDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      setGrabbing('plane')
      planeFromPointer(e.clientX, e.clientY)
    },
    [planeFromPointer],
  )

  const onPlaneMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (grabbing !== 'plane') return
      planeFromPointer(e.clientX, e.clientY)
    },
    [grabbing, planeFromPointer],
  )

  const onPlaneKey = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const big = e.shiftKey ? 0.1 : 0.02
      let next: HSV | null = null
      switch (e.key) {
        case 'ArrowLeft':
          next = { ...hsv, s: hsv.s - big }
          break
        case 'ArrowRight':
          next = { ...hsv, s: hsv.s + big }
          break
        case 'ArrowUp':
          next = { ...hsv, v: hsv.v + big }
          break
        case 'ArrowDown':
          next = { ...hsv, v: hsv.v - big }
          break
        case 'Home':
          next = { ...hsv, s: 0 }
          break
        case 'End':
          next = { ...hsv, s: 1 }
          break
        default:
          return
      }
      e.preventDefault()
      commit(next)
    },
    [commit, hsv],
  )

  // --- Hue rail ---
  const hueRef = useRef<HTMLDivElement>(null)
  const hueFromPointer = useCallback(
    (clientX: number) => {
      const el = hueRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      commit({ ...hsv, h: clamp((clientX - r.left) / r.width, 0, 1) * 360 })
    },
    [commit, hsv],
  )

  const onHueDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      setGrabbing('hue')
      hueFromPointer(e.clientX)
    },
    [hueFromPointer],
  )

  const onHueMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (grabbing !== 'hue') return
      hueFromPointer(e.clientX)
    },
    [grabbing, hueFromPointer],
  )

  const onHueKey = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const big = e.shiftKey ? 24 : 4
      let h: number | null = null
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          h = hsv.h - big
          break
        case 'ArrowRight':
        case 'ArrowUp':
          h = hsv.h + big
          break
        case 'Home':
          h = 0
          break
        case 'End':
          h = 360
          break
        default:
          return
      }
      e.preventDefault()
      commit({ ...hsv, h })
    },
    [commit, hsv],
  )

  const endGrab = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    setGrabbing(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  // --- Hex input ---
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const applyHexDraft = useCallback(
    (raw: string) => {
      const rgb = hexToRgb(raw)
      if (rgb) commit(rgbToHsv(rgb))
      setHexDraft(null)
    },
    [commit],
  )

  // --- Copy feedback ---
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(hex).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1100)
    }).catch(() => {})
  }, [hex])

  // --- Eyedropper (Chromium only) ---
  const [hasDropper, setHasDropper] = useState(false)
  useEffect(() => {
    setHasDropper(typeof window !== 'undefined' && 'EyeDropper' in window)
  }, [])
  const pickFromScreen = useCallback(() => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
    if (!Ctor) return
    void new Ctor().open().then(({ sRGBHex }) => {
      const rgb = hexToRgb(sRGBHex)
      if (rgb) commit(rgbToHsv(rgb))
    }).catch(() => {})
  }, [commit])

  const swell = grabbing && !reduce ? 1.35 : 1

  return (
    <div className={`w-full max-w-[340px] select-none ${className}`}>
      {/* Saturation / value plane */}
      <div
        ref={planeRef}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${round(hsv.s * 100)}%, brightness ${round(hsv.v * 100)}%, ${hex}`}
        onPointerDown={onPlaneDown}
        onPointerMove={onPlaneMove}
        onPointerUp={endGrab}
        onPointerCancel={endGrab}
        onKeyDown={onPlaneKey}
        className="group relative aspect-[4/3] w-full cursor-crosshair touch-none overflow-hidden rounded-2xl outline-none ring-[#DCF87C] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ backgroundColor: hueHex }}
      >
        {/* White wash left→right (saturation), black wash top→bottom (value). */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
        {/* Thumb */}
        <motion.span
          className="pointer-events-none absolute z-10 block h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_6px_rgba(0,0,0,0.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
          animate={{ scale: swell }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>

      {/* Hue rail */}
      <div
        ref={hueRef}
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={round(hsv.h)}
        aria-valuetext={`Hue ${round(hsv.h)} degrees`}
        aria-labelledby={hueId}
        onPointerDown={onHueDown}
        onPointerMove={onHueMove}
        onPointerUp={endGrab}
        onPointerCancel={endGrab}
        onKeyDown={onHueKey}
        className="relative mt-4 h-4 w-full cursor-pointer touch-none rounded-full outline-none ring-[#DCF87C] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{
          background:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
      >
        <span id={hueId} className="sr-only">
          Hue
        </span>
        <motion.span
          className="pointer-events-none absolute top-1/2 z-10 block h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_6px_rgba(0,0,0,0.5)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueHex }}
          animate={{ scale: grabbing === 'hue' && !reduce ? 1.2 : 1 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>

      {/* Readout: preview + editable hex + copy + eyedropper */}
      <div className="mt-4 flex items-center gap-3">
        <span
          aria-hidden
          className="h-11 w-11 shrink-0 rounded-xl border border-white/15"
          style={{ backgroundColor: hex }}
        />
        <label className="sr-only" htmlFor={planeId}>
          Hex colour value
        </label>
        <div className="flex flex-1 items-center rounded-xl border border-white/12 bg-white/[0.03] px-3 focus-within:border-[#DCF87C]/60">
          <span aria-hidden className="font-mono text-sm text-white/40">
            #
          </span>
          <input
            id={planeId}
            value={(hexDraft ?? hex.replace(/^#/, '')).toUpperCase()}
            onChange={(e) => setHexDraft(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
            onFocus={() => setHexDraft(hex.replace(/^#/, ''))}
            onBlur={(e) => applyHexDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyHexDraft((e.target as HTMLInputElement).value)
            }}
            spellCheck={false}
            inputMode="text"
            aria-label="Hex colour value"
            className="w-full bg-transparent py-2.5 font-mono text-sm uppercase tracking-wide text-white outline-none"
          />
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white/70 transition-colors hover:border-white/25 hover:text-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        {hasDropper && (
          <button
            type="button"
            onClick={pickFromScreen}
            aria-label="Pick a colour from the screen"
            title="Pick from screen"
            className="shrink-0 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-white/70 transition-colors hover:border-white/25 hover:text-white"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M18 2l4 4-9 9-4 1 1-4 9-9zM3 21l5-5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* RGB read-back, honest and live */}
      <p className="mt-2 font-mono text-[0.7rem] tracking-wide text-white/35">
        rgb({round(rgb.r * 255)}, {round(rgb.g * 255)}, {round(rgb.b * 255)})
      </p>

      {/* Presets */}
      <div className="mt-4 flex flex-wrap gap-2">
        {swatches.map((s) => {
          const active = s.toUpperCase() === hex.toUpperCase()
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                const c = hexToRgb(s)
                if (c) commit(rgbToHsv(c))
              }}
              aria-label={`Set colour ${s}`}
              aria-pressed={active}
              className="relative h-7 w-7 rounded-full border border-white/15 outline-none ring-[#DCF87C] transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ backgroundColor: s }}
            >
              {active && (
                <motion.span
                  layoutId={reduce ? undefined : 'colorfield-active-swatch'}
                  className="absolute inset-0 rounded-full ring-2 ring-white"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
                />
              )}
              {active && (
                <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke={isLight(rgbToHsv(hexToRgb(s) ?? { r: 0, g: 0, b: 0 })) ? '#0A0A0A' : '#fff'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
