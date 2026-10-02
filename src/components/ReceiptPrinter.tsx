import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A thermal receipt printer. Press the button and paper feeds out of the slot,
// printing a short receipt one line at a time; press again to tear it off at the
// perforation and leave a fresh roll ready.
//
// Distinct from its neighbours in the paper/card family. The Ticket comes apart
// at a tear; the Polaroid develops a latent image; the Folder opens. This one
// *prints and feeds* — the signature is the line-by-line emergence from the
// slot, each line burning in out of a soft blur the way a thermal head lays
// down heat, and the whole strip growing downward as it feeds. No canvas: the
// receipt is real, selectable DOM text, so a screen reader and a cursor both
// get the words.
//
// Honest about what it prints. The slip is not a gag order total — it is a true
// summary of this site and the person behind it: Berlin, co-founder of Guided,
// a student, built by hand and open source, with the live component and page
// counts passed in from the site's own stats so the numbers can never drift
// from the catalogue. The barcode is decorative and marked aria-hidden; the
// timestamp is the real local time the slip was printed.
//
// State is a small machine — idle → printing → done → (tear) → idle — so the
// buttons, the live announcements and the paper all read off one value and can
// never disagree. Under prefers-reduced-motion the feed, the per-line burn-in
// and the tear arc are all dropped: the whole slip appears at once and the tear
// resets instantly, so it stays a usable, legible object with no travel.

type Line =
  | { kind: 'center'; text: string; strong?: boolean; small?: boolean }
  | { kind: 'row'; label: string; value: string }
  | { kind: 'rule' }
  | { kind: 'barcode' }
  | { kind: 'stamp'; text: string }

interface ReceiptPrinterProps {
  /** Live component total from the site's stats, printed on the slip. */
  componentCount?: number
  /** Live page total from the site's stats, printed on the slip. */
  pageCount?: number
  className?: string
}

type Phase = 'idle' | 'printing' | 'done' | 'tearing'

// A deterministic bar pattern for the decorative barcode — fixed so it renders
// the same every print and never flickers. Values are widths in px.
const BARCODE: number[] = [2, 1, 3, 1, 1, 2, 1, 4, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2]

function buildLines(components: number, pages: number): Line[] {
  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return [
    { kind: 'center', text: 'ARSENIY CHEREDNICHENKO', strong: true },
    { kind: 'center', text: 'Developer / designer', small: true },
    { kind: 'center', text: 'Berlin', small: true },
    { kind: 'rule' },
    { kind: 'row', label: 'Co-founder', value: 'Guided' },
    { kind: 'row', label: 'Currently', value: 'Student' },
    { kind: 'row', label: 'This site', value: 'Open source' },
    { kind: 'rule' },
    { kind: 'row', label: 'Components', value: String(components) },
    { kind: 'row', label: 'Pages', value: String(pages) },
    { kind: 'row', label: 'Templates', value: '0' },
    { kind: 'rule' },
    { kind: 'center', text: 'Built by hand in Berlin', small: true },
    { kind: 'center', text: 'Thank you for scrolling', small: true },
    { kind: 'barcode' },
    { kind: 'center', text: `PRINTED ${stamp.toUpperCase()}`, small: true },
    { kind: 'stamp', text: 'PAID IN PIXELS' },
  ]
}

function LineRow({ line, dim }: { line: Line; dim: number }) {
  // `dim` is a tiny per-line opacity jitter (0.9–1) to mimic uneven thermal
  // density — deterministic, so it never shimmers.
  const base = 'font-mono text-[#2b2a26]'
  if (line.kind === 'rule') {
    return <div aria-hidden className="my-2 border-t border-dashed border-[#2b2a26]/35" />
  }
  if (line.kind === 'barcode') {
    return (
      <div aria-hidden className="my-3 flex items-end justify-center gap-[2px]" style={{ height: 38 }}>
        {BARCODE.map((w, i) => (
          <span
            key={i}
            style={{ width: w, height: i % 3 === 0 ? 38 : 30 }}
            className="block bg-[#2b2a26]"
          />
        ))}
      </div>
    )
  }
  if (line.kind === 'stamp') {
    return (
      <div className="mt-3 flex justify-center">
        <span
          className="rounded-[4px] border-2 border-[#b4472e]/70 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-[#b4472e]/80"
          style={{ transform: 'rotate(-5deg)', opacity: dim }}
        >
          {line.text}
        </span>
      </div>
    )
  }
  if (line.kind === 'row') {
    return (
      <div className={`${base} flex items-baseline justify-between gap-2 text-[13px]`} style={{ opacity: dim }}>
        <span className="uppercase tracking-wide">{line.label}</span>
        <span
          aria-hidden
          className="mx-1 min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-[#2b2a26]/40"
        />
        <span className="font-semibold tabular-nums">{line.value}</span>
      </div>
    )
  }
  // center
  return (
    <div
      className={`${base} text-center ${
        line.strong ? 'text-[15px] font-bold tracking-[0.12em]' : line.small ? 'text-[11px] tracking-wide' : 'text-[13px]'
      }`}
      style={{ opacity: dim }}
    >
      {line.text}
    </div>
  )
}

export function ReceiptPrinter({ componentCount = 267, pageCount = 32, className = '' }: ReceiptPrinterProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const [phase, setPhase] = useState<Phase>('idle')
  const [lines, setLines] = useState<Line[]>([])
  const [printed, setPrinted] = useState(0)
  const [announce, setAnnounce] = useState('')
  const timer = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => () => clear(), [clear])

  const print = useCallback(() => {
    if (phase === 'printing' || phase === 'tearing') return
    const next = buildLines(componentCount, pageCount)
    setLines(next)
    setAnnounce('Printing receipt')
    if (reduce) {
      // No feed: the whole slip appears at once.
      setPrinted(next.length)
      setPhase('done')
      setAnnounce('Receipt printed')
      return
    }
    setPrinted(0)
    setPhase('printing')
    let i = 0
    clear()
    timer.current = window.setInterval(() => {
      i += 1
      setPrinted(i)
      if (i >= next.length) {
        clear()
        setPhase('done')
        setAnnounce('Receipt printed')
      }
    }, 130)
  }, [phase, reduce, componentCount, pageCount, clear])

  const tear = useCallback(() => {
    if (phase !== 'done') return
    if (reduce) {
      setPhase('idle')
      setLines([])
      setPrinted(0)
      setAnnounce('Torn off. Ready for the next.')
      return
    }
    setPhase('tearing')
    setAnnounce('Torn off')
    window.setTimeout(() => {
      setPhase('idle')
      setLines([])
      setPrinted(0)
    }, 620)
  }, [phase, reduce])

  const visible = lines.slice(0, printed)
  const hasPaper = phase !== 'idle' && visible.length > 0

  return (
    <div className={`mx-auto flex w-full max-w-sm flex-col items-center ${className}`}>
      {/* Printer unit */}
      <div className="relative z-10 w-full max-w-[20rem]">
        <div className="relative rounded-2xl border border-white/12 bg-gradient-to-b from-[#222521] to-[#121311] px-5 pb-4 pt-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/40">Thermal</span>
            <span className="flex items-center gap-1.5">
              <motion.span
                className="block h-2 w-2 rounded-full bg-[#DCF87C]"
                style={{ boxShadow: '0 0 8px rgba(220,248,124,0.7)' }}
                animate={
                  reduce || phase !== 'printing' ? { opacity: 0.9 } : { opacity: [0.35, 1, 0.35] }
                }
                transition={{ duration: 0.8, repeat: phase === 'printing' ? Infinity : 0 }}
              />
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
                {phase === 'printing' ? 'busy' : 'ready'}
              </span>
            </span>
          </div>
          {/* Paper slot */}
          <div className="mt-3 h-2 w-full rounded-full bg-black shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)]" />
        </div>
      </div>

      {/* Paper strip emerging from the slot */}
      <div className="relative w-[18rem] max-w-full" style={{ marginTop: -2 }}>
        <AnimatePresence>
          {hasPaper ? (
            <motion.div
              key="paper"
              initial={false}
              animate={
                phase === 'tearing' && !reduce
                  ? { y: 220, rotate: 2.5, opacity: 0 }
                  : { y: 0, rotate: 0, opacity: 1 }
              }
              transition={
                phase === 'tearing'
                  ? { duration: 0.55, ease: [0.4, 0, 0.9, 0.3] }
                  : { duration: 0 }
              }
              className="relative mx-auto origin-top"
              style={{ width: '17rem' }}
            >
              {/* perforation / tear line */}
              <div aria-hidden className="flex justify-center gap-[3px] px-3">
                {Array.from({ length: 22 }, (_, i) => (
                  <span key={i} className="mt-[1px] h-[3px] w-[3px] rounded-full bg-[#e7e3d8]" />
                ))}
              </div>
              <div
                className="relative overflow-hidden rounded-b-[3px] px-5 pb-6 pt-3"
                style={{
                  background: 'linear-gradient(180deg,#f4f1e8 0%,#efeadd 100%)',
                  boxShadow: '0 14px 26px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
                }}
              >
                <div className="space-y-[6px]">
                  {visible.map((line, i) => {
                    const dim = 0.9 + ((i * 37) % 11) / 100
                    const row = <LineRow line={line} dim={dim} />
                    if (reduce) return <div key={i}>{row}</div>
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                      >
                        {row}
                      </motion.div>
                    )
                  })}
                </div>

                {/* print head sweep, only while feeding */}
                {phase === 'printing' && !reduce ? (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 h-5"
                    style={{
                      background: 'linear-gradient(180deg,rgba(220,248,124,0) 0%,rgba(220,248,124,0.18) 60%,rgba(0,0,0,0.08) 100%)',
                      bottom: 24,
                    }}
                    animate={{ opacity: [0.5, 0.9, 0.5] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                  />
                ) : null}
              </div>
              {/* torn bottom edge */}
              <div aria-hidden className="flex justify-center gap-[3px] px-3">
                {Array.from({ length: 22 }, (_, i) => (
                  <span
                    key={i}
                    className="h-[4px] w-[6px]"
                    style={{
                      background: 'linear-gradient(180deg,#efeadd,#e4dece)',
                      clipPath: i % 2 === 0 ? 'polygon(0 0,100% 0,50% 100%)' : 'polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="mt-7 flex items-center gap-3">
        <button
          type="button"
          onClick={print}
          disabled={phase === 'printing' || phase === 'tearing' || phase === 'done'}
          className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white disabled:opacity-40"
        >
          {phase === 'printing' ? 'Printing…' : 'Print receipt'}
        </button>
        <button
          type="button"
          onClick={tear}
          disabled={phase !== 'done'}
          className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white disabled:opacity-40"
        >
          Tear off
        </button>
      </div>

      <span id={`${id}-live`} aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  )
}
