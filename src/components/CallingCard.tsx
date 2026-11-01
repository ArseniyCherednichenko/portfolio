import { useCallback, useRef, useState } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { EMAIL, GITHUB_URL } from '../data/contact'
import { downloadVCard } from '../lib/vcard'
import { useCopied } from '../lib/clipboard'
import { useToast } from './Toast'

// A premium, pointer-reactive "calling card" — the physical business card the
// site never had, made interactive. It leans and lights toward the cursor in
// real 3D, and its one real job is useful: "Save contact card" generates a
// spec-correct vCard (.vcf) from the honest facts and hands it to the browser,
// so a visitor can drop Arseniy straight into their address book. Everything on
// it is already true elsewhere on the site; nothing is invented.
//
// Motion is all spring-driven and collapses to a calm, flat, glare-free state
// under prefers-reduced-motion. The tilt layer is decorative (aria-hidden on the
// visual flourish); the email and GitHub are real, focusable controls.

const SPRING = { stiffness: 150, damping: 18, mass: 0.6 } as const
// How far the card tips, in degrees, at the edges. Restraint over spectacle.
const MAX_TILT = 9

export function CallingCard({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const { toast } = useToast()
  const [copied, copy] = useCopied(1400)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Pointer position as -0.5..0.5 fractions of the card, spring-followed.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, SPRING)
  const sy = useSpring(py, SPRING)
  const rotateX = useTransform(sy, [-0.5, 0.5], [MAX_TILT, -MAX_TILT])
  const rotateY = useTransform(sx, [-0.5, 0.5], [-MAX_TILT, MAX_TILT])
  // A lime glare that tracks the pointer across the face.
  const glareX = useTransform(sx, [-0.5, 0.5], ['0%', '100%'])
  const glareY = useTransform(sy, [-0.5, 0.5], ['0%', '100%'])
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(220,248,124,0.16), transparent 60%)`

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduce) return
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      px.set((e.clientX - r.left) / r.width - 0.5)
      py.set((e.clientY - r.top) / r.height - 0.5)
    },
    [px, py, reduce],
  )

  const onLeave = useCallback(() => {
    px.set(0)
    py.set(0)
  }, [px, py])

  const onSave = useCallback(() => {
    const ok = downloadVCard()
    if (ok) {
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2200)
      toast('Contact card saved to your downloads', { tone: 'success' })
    } else {
      toast('Could not save the card — email works too', { tone: 'error' })
    }
  }, [toast])

  const onCopy = useCallback(async () => {
    const ok = await copy(EMAIL)
    if (ok) toast('Email address copied', { tone: 'success' })
  }, [copy, toast])

  return (
    <div
      className={className}
      style={{ perspective: reduce ? undefined : '1100px' }}
    >
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/12 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-7 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
      >
        {/* Pointer-tracked lime glare — decorative, off under reduced motion. */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: glare }}
          />
        )}
        {/* A hairline top edge catch-light. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DCF87C]/50 to-transparent"
        />

        <div className="relative" style={reduce ? undefined : { transform: 'translateZ(40px)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-[#DCF87C]/80">
              Calling card
            </span>
            <span className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/35">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#DCF87C]" />
              Berlin
            </span>
          </div>

          <p className="mt-6 font-display text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl">
            Arseniy
            <br />
            Cherednichenko
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            Developer and designer · co-founder of Guided
          </p>

          <div className="mt-6 h-px w-full bg-white/10" />

          <div className="mt-5 space-y-2.5 text-sm">
            <a
              href={`mailto:${EMAIL}`}
              data-cursor
              className="group flex items-center gap-2.5 text-white/70 transition-colors hover:text-[#DCF87C] focus:outline-none focus-visible:text-[#DCF87C]"
            >
              <GlyphBox>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </GlyphBox>
              <span className="truncate">{EMAIL}</span>
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor
              className="group flex items-center gap-2.5 text-white/70 transition-colors hover:text-[#DCF87C] focus:outline-none focus-visible:text-[#DCF87C]"
            >
              <GlyphBox>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.93.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.26-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.39.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
                </svg>
              </GlyphBox>
              <span className="truncate">github.com/ArseniyCherednichenko</span>
            </a>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <motion.button
              type="button"
              onClick={onSave}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#e6ff8f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
            >
              {saved ? (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                  Save contact card
                </>
              )}
            </motion.button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40"
            >
              {copied ? 'Copied' : 'Copy email'}
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/35">
            Saves a .vcf — drops straight into your contacts on phone or desktop.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function GlyphBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition-colors group-hover:border-[#DCF87C]/40 group-hover:text-[#DCF87C]">
      {children}
    </span>
  )
}
