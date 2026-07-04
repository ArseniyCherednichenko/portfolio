import { useRef, type MouseEvent, type ReactNode } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

export interface ProfileCardProps {
  /** Display name, set in the display serif. */
  name: string
  /** One-line role, e.g. "Builder - Co-founder of Guided". */
  role: string
  /** Short place label shown with a pin. */
  location: string
  /** Small monogram, usually two initials. */
  initials: string
  /** Honest status line shown by the ping dot at the top. */
  status: string
  /** A few short discipline chips. */
  tags: readonly string[]
  /** Optional CTA rendered at the foot of the card. */
  action?: ReactNode
}

// A holographic identity card that tilts toward the cursor. Distinct from the
// generic TiltCard wrapper: this is a designed artifact — a person's card —
// with an iridescent sheen that shifts with the pointer, a travelling glare,
// a monogram, and structured identity content. The sheen is kept restrained
// and lime-forward so it reads as a premium iridescent film, not a toy rainbow.
// Reduced motion: the card sits still with a faint static sheen, fully legible.
export function ProfileCard({ name, role, location, initials, status, tags, action }: ProfileCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Pointer position within the card, 0..1 on each axis (centre = 0.5).
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  // How far the pointer is from centre, 0 (centre) .. 1 (corner). Drives the
  // sheen intensity so the holo brightens as you move off-centre.
  const dist = useMotionValue(0)

  const rx = useSpring(useTransform(py, [0, 1], [10, -10]), { stiffness: 180, damping: 16 })
  const ry = useSpring(useTransform(px, [0, 1], [-10, 10]), { stiffness: 180, damping: 16 })

  const gx = useTransform(px, [0, 1], ['0%', '100%'])
  const gy = useTransform(py, [0, 1], ['0%', '100%'])

  // Travelling glare highlight.
  const glare = useMotionTemplate`radial-gradient(240px circle at ${gx} ${gy}, rgba(255,255,255,0.14), transparent 62%)`

  // Iridescent sheen: a restrained lime -> cyan -> violet band whose position
  // tracks the pointer. Two layers (a broad diagonal sweep + a fine grating)
  // are blended so the film catches the light like a real holo card.
  const bx = useTransform(px, [0, 1], ['20%', '80%'])
  const by = useTransform(py, [0, 1], ['20%', '80%'])
  const sheen = useMotionTemplate`
    linear-gradient(115deg,
      transparent 20%,
      rgba(220,248,124,0.45) 34%,
      rgba(120,230,210,0.40) 46%,
      rgba(150,170,255,0.42) 58%,
      transparent 74%)`
  const sheenOpacity = useSpring(useTransform(dist, [0, 1], [0.12, 0.5]), { stiffness: 140, damping: 20 })

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const nx = (e.clientX - r.left) / r.width
    const ny = (e.clientY - r.top) / r.height
    px.set(nx)
    py.set(ny)
    dist.set(Math.min(1, Math.hypot(nx - 0.5, ny - 0.5) * 2))
  }
  function reset() {
    px.set(0.5)
    py.set(0.5)
    dist.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className="group relative w-full max-w-sm select-none rounded-[28px] border border-white/12 bg-gradient-to-b from-[#161616] to-[#0c0c0c] p-1 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      {/* Inner card face */}
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0d0d0d] px-7 py-8">
        {/* Iridescent holo film */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
          style={reduce ? { background: 'linear-gradient(115deg, transparent 30%, rgba(220,248,124,0.14) 50%, transparent 70%)' } : { background: sheen, backgroundSize: '220% 220%', backgroundPositionX: bx, backgroundPositionY: by, opacity: sheenOpacity }}
        />
        {/* Fine grating that only shows through the sheen, for the diffraction texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:repeating-linear-gradient(115deg,#fff_0px,#fff_1px,transparent_1px,transparent_5px)]"
        />
        {/* Travelling glare */}
        {!reduce && (
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glare }} />
        )}

        {/* Content sits above the film, lifted in Z for parallax depth */}
        <div className="relative" style={reduce ? undefined : { transform: 'translateZ(50px)' }}>
          {/* Top row: monogram + honest status */}
          <div className="flex items-center justify-between">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#DCF87C]/25 bg-[#DCF87C]/[0.06] font-display text-lg font-bold tracking-tight text-[#DCF87C]">
              {initials}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C]/70" />}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DCF87C]" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">{status}</span>
            </div>
          </div>

          {/* Identity */}
          <h3 className="mt-7 font-display text-3xl font-bold leading-[1.05] tracking-tight text-white">{name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{role}</p>

          {/* Location */}
          <p className="mt-4 flex items-center gap-1.5 text-sm text-white/45">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#DCF87C]/70" aria-hidden>
              <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {location}
          </p>

          {/* Discipline chips */}
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/60">
                {t}
              </span>
            ))}
          </div>

          {action && <div className="mt-7">{action}</div>}
        </div>
      </div>
    </motion.div>
  )
}
