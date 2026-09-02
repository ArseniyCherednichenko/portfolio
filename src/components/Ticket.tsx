import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

// Ticket — a physical event pass, rebuilt in DOM and CSS.
//
// The Cards & surfaces family had tilt cards, glare cards, flip cards and a
// scratch-off, but nothing with the one detail that makes a ticket read as a
// ticket: the perforation, and the tear. This is that. Two panels — a main body
// and a tear-off stub — divided by a dashed seam with two notches *punched clean
// through the card* (a mask-image of two radial gradients, so the dark page
// shows through the holes, not a fake shadow). The whole pass tilts toward the
// cursor with a holographic foil sheen that sweeps as it moves; press the stub
// and it springs off along the perforation, and the body stamps "ADMITTED".
//
// Honest to its subject: the copy is a personal beat, not a client or an event
// that never happened — ADMIT ONE, hand-built in Berlin, the year on the site's
// clock. The seat and the ticket number are fixed strings, not invented stats.
//
// a11y: the tear is a real <button> with a live label, and an aria-live region
// announces "torn" / "restored" — the whole thing works by keyboard with no
// pointer at all. Reduced motion removes the tilt, the foil drift and the tear
// arc: the stub simply leaves and returns, instantly and legibly.

const ACCENT = '#DCF87C'

/** A row of variable-width bars — a barcode drawn from a fixed pattern, so it
 *  renders the same every time and claims to encode nothing. */
const BARS = [3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 1]

function Barcode({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`flex h-8 items-stretch gap-[3px] ${className}`}>
      {BARS.map((w, i) => (
        <span
          key={i}
          className="rounded-[1px] bg-black/80"
          style={{ width: w * 2, opacity: i % 7 === 0 ? 0.35 : 1 }}
        />
      ))}
    </div>
  )
}

export function Ticket({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const statusId = useId()
  const [torn, setTorn] = useState(false)
  const year = new Date().getFullYear()

  // Pointer-tilt of the whole pass, plus a foil sheen that tracks the cursor.
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 180, damping: 16 })
  const ry = useSpring(useTransform(px, [0, 1], [-9, 9]), { stiffness: 180, damping: 16 })
  const sheenX = useTransform(px, [0, 1], ['0%', '100%'])
  const sheenY = useTransform(py, [0, 1], ['0%', '100%'])
  const sheen = useTransform(
    [sheenX, sheenY],
    ([x, y]) =>
      `radial-gradient(420px circle at ${x} ${y}, rgba(220,248,124,0.20), transparent 45%), ` +
      `linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.10) 47%, rgba(220,248,124,0.14) 52%, transparent 68%)`,
  )
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  function onLeave() {
    px.set(0.5)
    py.set(0.5)
  }

  const spring = reduce
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 260, damping: 20 } as const)

  return (
    <div className={`mx-auto w-full max-w-md ${className}`}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
        className="relative select-none"
      >
        {/* THE PASS — a single card masked into a ticket silhouette with two
            notches punched clean through at the seam. */}
        <div
          className="relative flex overflow-hidden rounded-[22px] text-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
          style={{
            background: `linear-gradient(155deg, #f4f4ee 0%, #e9e9e0 100%)`,
            // Punch the two notches: transparent circles at the seam (72% across).
            WebkitMaskImage:
              'radial-gradient(circle 15px at 72% 0, transparent 14px, #000 15px), radial-gradient(circle 15px at 72% 100%, transparent 14px, #000 15px)',
            maskImage:
              'radial-gradient(circle 15px at 72% 0, transparent 14px, #000 15px), radial-gradient(circle 15px at 72% 100%, transparent 14px, #000 15px)',
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
          }}
        >
          {/* Holographic foil that tracks the pointer. */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 mix-blend-soft-light"
              style={{ background: sheen }}
            />
          )}
          {/* A faint guilloché texture so the stock reads as printed, not flat. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #000 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, #000 0 1px, transparent 1px 7px)',
            }}
          />

          {/* BODY (left, ~72%) */}
          <div className="relative z-10 flex-1 p-6 pr-5 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/55">Admit one</span>
              <span
                aria-hidden
                className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-black"
                style={{ background: ACCENT }}
              >
                Hand-built
              </span>
            </div>

            <p className="mt-6 font-display text-3xl font-bold leading-[1.02] tracking-tight sm:text-4xl">
              Arseniy
              <br />
              Cherednichenko
            </p>
            <p className="mt-2 text-sm font-medium text-black/55">Design · Motion · Code</p>

            <div className="mt-7 grid grid-cols-3 gap-4">
              {[
                { k: 'Gate', v: 'Berlin' },
                { k: 'Date', v: `Est. ${year}` },
                { k: 'Seat', v: 'One of one' },
              ].map((f) => (
                <div key={f.k}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-black/40">{f.k}</div>
                  <div className="mt-1 text-sm font-semibold text-black/80">{f.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-end justify-between gap-4">
              <Barcode />
              <span className="font-mono text-[10px] tracking-tight text-black/45">NO. A-2026-001</span>
            </div>

            {/* ADMITTED stamp — appears once the stub is torn. */}
            <AnimatePresence>
              {torn && (
                <motion.div
                  key="stamp"
                  aria-hidden
                  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 1.6, rotate: -18 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -14 }}
                  exit={{ opacity: 0 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 14 }}
                  className="pointer-events-none absolute left-6 top-1/2 z-30"
                >
                  <span
                    className="inline-block rounded-md border-[3px] px-3 py-1 font-display text-xl font-bold uppercase tracking-[0.18em]"
                    style={{ color: '#b91c1c', borderColor: '#b91c1c', opacity: 0.82 }}
                  >
                    Admitted
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* THE SEAM — dashed perforation line running between the notches. */}
          <div aria-hidden className="relative z-10 w-0">
            <div className="absolute inset-y-3 left-0 border-l-2 border-dashed border-black/25" />
          </div>

          {/* STUB (right, ~28%) — the tear-off counterfoil. */}
          <AnimatePresence>
            {!torn && (
              <motion.div
                key="stub"
                aria-hidden
                initial={false}
                exit={
                  reduce
                    ? { opacity: 0 }
                    : { x: 60, y: 26, rotate: 9, opacity: 0, transition: { type: 'spring', stiffness: 220, damping: 18 } }
                }
                className="relative z-10 flex w-[28%] flex-col items-center justify-between p-4"
                style={{ transformOrigin: 'left center' }}
              >
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-black/45">Keep</span>
                <span
                  className="my-2 font-display text-lg font-bold tracking-tight text-black/70"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  Admit one
                </span>
                <span
                  aria-hidden
                  className="mb-1 h-6 w-6 rounded-full"
                  style={{ background: ACCENT, boxShadow: `0 0 0 4px rgba(220,248,124,0.25)` }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* CONTROL — the real, keyboard-first way to tear or restore. */}
      <div className="mt-6 flex items-center justify-center">
        <motion.button
          type="button"
          onClick={() => setTorn((t) => !t)}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          transition={spring}
          aria-describedby={statusId}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 text-sm font-semibold text-white/85 transition-colors hover:border-[#DCF87C]/50 hover:bg-white/[0.05] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
          {torn ? 'Restore the stub' : 'Tear the stub off'}
        </motion.button>
      </div>

      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {torn ? 'Stub torn off. The pass reads admitted.' : 'The pass is whole.'}
      </p>
    </div>
  )
}
