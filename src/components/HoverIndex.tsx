import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

// An editorial index of large rows where hovering a row floats a generative
// preview panel that trails the cursor with a little spring lag — the
// awwwards-style "hover-reveal list". A genuinely new interaction kind for this
// library: not a field, a card, or a text effect, but a list whose entries
// summon a floating thumbnail. Distinct from FlowingMenu (a lime panel that
// slides in and stays inside the row) and ChromaGrid (a torch dimming a grid).
//
// The preview is honest brand art, generated deterministically per label — no
// screenshots, nothing claimed that does not exist. Rows are real links, so the
// component doubles as navigation and reads correctly to assistive tech; the
// floating panel is purely decorative (aria-hidden). On a touch device or under
// reduced motion the floating preview is dropped entirely and the rows are a
// clean, fully legible, fully clickable list.

export interface HoverIndexItem {
  /** The row label, set large in the display face. */
  label: string
  /** A short right-aligned note (a kind, a year, a one-word meta). */
  meta?: string
  /** Internal route — renders a router <Link>. */
  to?: string
  /** External URL — renders a new-tab anchor. Ignored if `to` is set. */
  href?: string
}

// Small, stable string hash so a label maps to a repeatable seed.
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Seeded pseudo-random generator (mulberry32) — deterministic, so a label
// always paints the same preview and nothing here trips the "no Math.random"
// resume rules on the hot path.
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// On-brand palette: lime always anchors, a couple of tasteful companions join.
const TONES = ['#DCF87C', '#34D399', '#38BDF8', '#A78BFA', '#FB923C', '#F472B6']

interface Blob {
  tone: string
  size: number
  x: number
  y: number
}

function previewBlobs(label: string): Blob[] {
  const random = rng(hash(label))
  const tones = [TONES[0]]
  const rest = TONES.slice(1).sort(() => random() - 0.5)
  tones.push(rest[0], rest[1])
  return tones.map((tone) => ({
    tone,
    size: 58 + random() * 44,
    x: random() * 72,
    y: random() * 58,
  }))
}

// True only for a real mouse/trackpad. Touch users keep the clean static list.
function useFinePointer() {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return
    const m = window.matchMedia('(pointer: fine)')
    const on = () => setFine(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return fine
}

const PREVIEW_W = 264
const PREVIEW_H = 176

function Preview({ label }: { label: string }) {
  const blobs = previewBlobs(label)
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0B0B0B]">
      {blobs.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-2xl"
          style={{
            width: `${b.size}%`,
            height: `${b.size}%`,
            left: `${b.x}%`,
            top: `${b.y}%`,
            backgroundColor: b.tone,
            opacity: 0.3,
          }}
        />
      ))}
      {/* Faint grid for structure. */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse at center, #000 55%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 55%, transparent 100%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
      <div className="absolute inset-0 flex items-end p-4">
        <p className="font-display text-xl font-bold leading-none tracking-tight text-white">
          {label}
        </p>
      </div>
    </div>
  )
}

function Row({
  item,
  index,
  onEnter,
  onLeave,
  active,
}: {
  item: HoverIndexItem
  index: number
  onEnter: () => void
  onLeave: () => void
  active: boolean
}) {
  const reduce = useReducedMotion()
  const num = String(index + 1).padStart(2, '0')

  const inner = (
    <>
      {/* Lime edge that grows in from the left on hover. */}
      <span
        aria-hidden
        className="absolute left-0 top-1/2 h-[62%] w-[3px] -translate-y-1/2 origin-center scale-y-0 rounded-full bg-[#DCF87C] transition-transform duration-300 ease-out group-hover:scale-y-100"
      />
      <span className="w-10 shrink-0 font-mono text-xs text-white/35 tabular-nums transition-colors group-hover:text-[#DCF87C]">
        {num}
      </span>
      <motion.span
        className="min-w-0 flex-1 truncate font-display text-2xl font-semibold tracking-tight text-white/80 transition-colors group-hover:text-white sm:text-3xl"
        animate={reduce ? undefined : { x: active ? 10 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {item.label}
      </motion.span>
      {item.meta ? (
        <span className="hidden shrink-0 text-xs uppercase tracking-[0.22em] text-white/35 transition-colors group-hover:text-white/60 sm:block">
          {item.meta}
        </span>
      ) : null}
      <span
        aria-hidden
        className="shrink-0 translate-x-[-6px] text-lg text-white/30 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-[#DCF87C] group-hover:opacity-100"
      >
        &rarr;
      </span>
    </>
  )

  const cls =
    'group relative flex items-center gap-4 border-b border-white/10 py-5 pl-4 pr-3 outline-none focus-visible:bg-white/[0.03]'

  return (
    <li>
      {item.to ? (
        <Link to={item.to} className={cls} onMouseEnter={onEnter} onMouseLeave={onLeave} data-cursor>
          {inner}
        </Link>
      ) : item.href ? (
        <a
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className={cls}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          data-cursor
        >
          {inner}
        </a>
      ) : (
        <div className={cls} onMouseEnter={onEnter} onMouseLeave={onLeave}>
          {inner}
        </div>
      )}
    </li>
  )
}

export function HoverIndex({
  items,
  className = '',
}: {
  items: HoverIndexItem[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const enabled = fine && !reduce

  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 260, damping: 28, mass: 0.5 })
  const sy = useSpring(y, { stiffness: 260, damping: 28, mass: 0.5 })

  function onMove(e: React.MouseEvent) {
    if (!enabled) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    // Float the preview to the right of the cursor, vertically centred on it,
    // clamped so it never spills out of the list's own box.
    let px = e.clientX - rect.left + 26
    let py = e.clientY - rect.top - PREVIEW_H / 2
    px = Math.max(8, Math.min(px, rect.width - PREVIEW_W - 8))
    py = Math.max(8, Math.min(py, rect.height - PREVIEW_H - 8))
    x.set(px)
    y.set(py)
  }

  return (
    <div ref={ref} className={`relative ${className}`} onMouseMove={onMove}>
      <ul className="border-t border-white/10">
        {items.map((item, i) => (
          <Row
            key={item.label}
            item={item}
            index={i}
            active={hovered === i}
            onEnter={() => setHovered(i)}
            onLeave={() => setHovered((h) => (h === i ? null : h))}
          />
        ))}
      </ul>

      {enabled ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-20"
          style={{ x: sx, y: sy, width: PREVIEW_W, height: PREVIEW_H }}
          animate={{ opacity: hovered !== null ? 1 : 0, scale: hovered !== null ? 1 : 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          <div className="h-full w-full drop-shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
            <AnimatePresence mode="wait">
              {hovered !== null ? (
                <motion.div
                  key={items[hovered].label}
                  className="h-full w-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <Preview label={items[hovered].label} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}
