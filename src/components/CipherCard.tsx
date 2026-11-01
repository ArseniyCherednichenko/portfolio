import { useEffect, useId, useRef, useState } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// A card with a secret written across it in cipher. The whole face is filled
// with a dense field of randomising glyphs you cannot read — until you move a
// pointer over it, and a soft round window of light follows the cursor,
// decrypting only the stretch of stream beneath it. Move on and the characters
// behind you scramble back into noise. The real message never hides: it sits on
// a layer above the cipher, always legible; the flourish is the paper it is
// printed on, not the words.
//
// It is a different mechanism from the two glyph pieces this library already
// has. The decrypting text resolves one line left to right and then holds; the
// letter-glitch field flickers a whole grid at once with nothing driving it.
// This one is pointer-masked: the stream runs everywhere all the time, but a
// radial mask keyed to the cursor is the only thing that lets any of it through,
// so the reveal is a place you point rather than a moment you wait for. The glow
// is a spring-followed motion value, so the window of light carries a little
// weight and lag as you flick across, and the lit characters take the site's
// lime so the decrypted patch reads as the one warm thing in a cold field.
//
// Honest to assistive tech: the cipher layer is aria-hidden noise, and the card
// is one labelled group stating the real message in full, so a screen reader
// hears the sentence once and never the scramble. It is reachable without a
// pointer — focus the card and the window eases to its centre and holds, lit,
// so a keyboard user gets the same decrypt. Under prefers-reduced-motion the
// scramble stops and the mask is dropped entirely: the field rests as a static,
// dim watermark with the message sitting clear above it, nothing moving.

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789$#%&@?/<>[]{}=+*·'

function randomField(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
  return out
}

export interface CipherCardProps {
  /** A short lime sigil printed with the message, e.g. a word or symbol. */
  sigil?: string
  /** The headline that stays legible above the cipher. */
  title: string
  /** The supporting line under the headline. */
  body: string
  /** How many glyphs fill the field. More is denser; the default suits the card. */
  density?: number
  className?: string
}

export function CipherCard({
  sigil = 'Decrypt',
  title,
  body,
  density = 520,
  className,
}: CipherCardProps) {
  const reduced = useReducedMotion()
  const labelId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [field, setField] = useState(() => randomField(density))

  // Pointer position as a fraction of the card (0..1), spring-followed so the
  // window of light lags and settles rather than snapping to the raw cursor.
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 260, damping: 28, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 260, damping: 28, mass: 0.6 })

  // The radius of the decrypt window opens from nothing to its full size as the
  // card becomes active, so the reveal grows in rather than popping on.
  const radius = useSpring(0, { stiffness: 180, damping: 26 })

  const cxPct = useMotionTemplate`${useTransform(sx, (n) => n * 100)}%`
  const cyPct = useMotionTemplate`${useTransform(sy, (n) => n * 100)}%`
  const rPx = useMotionTemplate`${radius}px`

  // The mask that reveals the cipher only inside the travelling window, and the
  // matching lime glow that pools under it. Both read the same spring values, so
  // light and legibility move together.
  const mask = useMotionTemplate`radial-gradient(${rPx} circle at ${cxPct} ${cyPct}, #000 0%, rgba(0,0,0,0.55) 55%, transparent 100%)`
  const glow = useMotionTemplate`radial-gradient(${rPx} circle at ${cxPct} ${cyPct}, rgba(220,248,124,0.16) 0%, transparent 70%)`

  // Re-scramble the field on a steady beat while the card is active, so the
  // characters under the light keep churning like a live decode. Idle (or
  // reduced) the field holds still — nothing animates when no one is looking.
  useEffect(() => {
    if (reduced || !active) return
    const id = window.setInterval(() => setField(randomField(density)), 70)
    return () => window.clearInterval(id)
  }, [reduced, active, density])

  useEffect(() => {
    radius.set(active ? 150 : 0)
  }, [active, radius])

  if (reduced) {
    return (
      <div
        role="group"
        aria-label={`${title}. ${body}`}
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 ${className ?? ''}`}
      >
        <p
          aria-hidden
          className="pointer-events-none absolute inset-0 break-all p-5 font-mono text-[11px] leading-[1.35] tracking-widest text-white/[0.06]"
        >
          {field}
        </p>
        <div className="relative flex min-h-[240px] flex-col items-center justify-center gap-3 px-8 py-14 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]/80">{sigil}</span>
          <span className="font-display text-3xl font-bold text-white sm:text-4xl">{title}</span>
          <span className="max-w-md text-sm leading-relaxed text-white/55">{body}</span>
        </div>
      </div>
    )
  }

  const activate = () => setActive(true)
  const deactivate = () => setActive(false)

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-labelledby={labelId}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        px.set((e.clientX - r.left) / r.width)
        py.set((e.clientY - r.top) / r.height)
      }}
      onPointerEnter={activate}
      onPointerLeave={deactivate}
      onFocus={() => {
        // Centre the window for a keyboard user, then light it.
        px.set(0.5)
        py.set(0.5)
        activate()
      }}
      onBlur={deactivate}
      className={`group/cipher relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 outline-none focus-visible:border-[#DCF87C]/40 ${className ?? ''}`}
    >
      <span id={labelId} className="sr-only">
        {title}. {body}
      </span>

      {/* The cipher field — a wall of noise, revealed only through the mask. Two
          copies stacked: a near-invisible base so the card never looks blank,
          and the lit lime copy that the travelling window uncovers. */}
      <p
        aria-hidden
        className="pointer-events-none absolute inset-0 break-all p-5 font-mono text-[11px] leading-[1.35] tracking-widest text-white/[0.05]"
      >
        {field}
      </p>
      <motion.p
        aria-hidden
        style={{ WebkitMaskImage: mask, maskImage: mask }}
        className="pointer-events-none absolute inset-0 break-all p-5 font-mono text-[11px] leading-[1.35] tracking-widest text-[#DCF87C]/70"
      >
        {field}
      </motion.p>
      {/* The warm pool of light under the window. */}
      <motion.div aria-hidden style={{ background: glow }} className="pointer-events-none absolute inset-0" />

      {/* The message — always legible, sitting above the cipher on its own
          layer, because the secret is the paper, not the words. */}
      <div className="relative flex min-h-[240px] flex-col items-center justify-center gap-3 px-8 py-14 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]/80">{sigil}</span>
        <span className="font-display text-3xl font-bold text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.6)] sm:text-4xl">
          {title}
        </span>
        <span className="max-w-md text-sm leading-relaxed text-white/60">{body}</span>
      </div>

      <span className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white/25 transition-opacity duration-300 group-hover/cipher:opacity-0 group-focus-within/cipher:opacity-0">
        Point to decrypt
      </span>
    </div>
  )
}
