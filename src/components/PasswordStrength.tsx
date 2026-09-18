import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useMemo, useState, type ReactNode } from 'react'

// The controls family had entry fields — the segmented CodeInput, the TagInput,
// the NumberField spinner — but never the one form control that has to *talk
// back* as you type: a password field with a live strength read-out. This fills
// that gap, and the point of it is honesty. It does not fake a number. The
// estimate is a real, transparent entropy model: it counts the character
// classes present to size the pool an attacker would have to search (26 + 26 +
// 10 + ~33), takes bits = length x log2(pool), then *dampens* that by how much
// of the string is actually distinct — "aaaaaaaa" earns a fraction of what its
// length would suggest — so a repeated or tiny alphabet can't buy a strong
// score. Everything the meter claims is spelled out: the bit figure is shown,
// the five requirements tick over live, and the band is labelled in words, not
// left as an unexplained coloured bar. The motion is spring-driven — the meter
// segments stagger in, each requirement's check draws itself, the reveal toggle
// crossfades — and under prefers-reduced-motion every one of those becomes a
// plain, instant state change while the control stays exactly as usable.

export interface PasswordAnalysis {
  /** Estimated bits of entropy after the distinct-character damping. */
  bits: number
  /** 0 (empty) to 5 (excellent) — the number of lit meter segments. */
  score: number
  /** Word label for the band, e.g. "Fair". */
  label: string
  /** Which requirements the current value satisfies. */
  checks: { id: string; label: string; met: boolean }[]
}

const REQS: { id: string; label: string; test: (pw: string) => boolean }[] = [
  { id: 'len', label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

const BANDS = ['Empty', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const

// One colour per lit-segment count, muted rose through the lime accent. Kept as
// literals so the segments and the read-out always agree.
const LEVEL_COLOR = ['#3a3a3a', '#f0787a', '#f0a35a', '#f5d15a', '#bfe06a', '#DCF87C']

/**
 * Estimate password strength with a small, honest entropy model. Sizes the
 * search pool from the character classes present, scales by length in bits, and
 * damps the result by the fraction of distinct characters so repetition can't
 * inflate it. Returns the bit figure, a 0–5 score, a word label, and the live
 * requirement checklist. Pure and deterministic — no wordlist, no library.
 */
export function analyzePassword(pw: string): PasswordAnalysis {
  const checks = REQS.map((r) => ({ id: r.id, label: r.label, met: r.test(pw) }))
  if (pw.length === 0) {
    return { bits: 0, score: 0, label: BANDS[0], checks }
  }

  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33

  const distinct = new Set(pw).size
  const variety = distinct / pw.length // 1 = all unique, low = repetitive
  const raw = pw.length * Math.log2(Math.max(pool, 2))
  const bits = Math.round(raw * (0.45 + 0.55 * variety))

  // Bit thresholds → 1..5 lit segments. Deliberately conservative: a short,
  // single-class string never reaches the top band.
  let score = 1
  if (bits >= 28) score = 2
  if (bits >= 44) score = 3
  if (bits >= 64) score = 4
  if (bits >= 88) score = 5

  return { bits, score, label: BANDS[score], checks }
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

/**
 * A password field that talks back. Type into it and a five-segment meter,
 * a bit-of-entropy read-out, a word band, and a five-point requirement
 * checklist all update live; a toggle reveals or masks the value. The strength
 * figure comes from {@link analyzePassword} — a transparent entropy estimate,
 * not a wordlist score. Controlled (`value` + `onChange`) or uncontrolled
 * (`defaultValue`). Honest to assistive tech: a real labelled input, the meter
 * mirrored in a polite live region, the reveal button carrying its pressed
 * state. Under prefers-reduced-motion the springs and draw-ons come off and it
 * stays a plain, fully usable field.
 */
export function PasswordStrength({
  value: controlledValue,
  defaultValue = '',
  onChange,
  label = 'Password',
  placeholder = 'Type a password',
  showChecklist = true,
  className = '',
}: {
  value?: string
  defaultValue?: string
  onChange?: (value: string, analysis: PasswordAnalysis) => void
  label?: string
  placeholder?: string
  /** Show the live requirement checklist below the meter. */
  showChecklist?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const id = useId()
  const isControlled = controlledValue !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const value = isControlled ? controlledValue : uncontrolled
  const [reveal, setReveal] = useState(false)

  const analysis = useMemo(() => analyzePassword(value), [value])
  const { bits, score, label: band, checks } = analysis
  const color = LEVEL_COLOR[score]

  function setValue(next: string) {
    if (!isControlled) setUncontrolled(next)
    onChange?.(next, analyzePassword(next))
  }

  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 520, damping: 32 }

  return (
    <div className={`w-full max-w-[380px] ${className}`}>
      <label
        htmlFor={`${id}-input`}
        className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/45"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={`${id}-input`}
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          spellCheck={false}
          aria-describedby={`${id}-band`}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-12 font-mono text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-[#DCF87C]/60 focus:bg-white/[0.05]"
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-pressed={reveal}
          aria-label={reveal ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/40 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        >
          <EyeIcon off={!reveal} />
        </button>
      </div>

      {/* The five-segment meter. Lit segments take the band colour and, unless
          motion is off, scale in from the left on a short stagger. */}
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => {
          const lit = i < score
          return (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full w-full origin-left rounded-full"
                initial={false}
                animate={{
                  scaleX: lit ? 1 : 0,
                  backgroundColor: lit ? color : 'rgba(255,255,255,0)',
                }}
                transition={reduce ? { duration: 0 } : { ...spring, delay: lit ? i * 0.04 : 0 }}
              />
            </div>
          )
        })}
      </div>

      {/* Word band + honest bit read-out, mirrored to a polite live region. */}
      <div className="mt-2 flex items-baseline justify-between text-xs">
        <motion.span
          id={`${id}-band`}
          key={band}
          role="status"
          aria-live="polite"
          initial={reduce ? false : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="font-semibold"
          style={{ color: score === 0 ? 'rgba(255,255,255,0.35)' : color }}
        >
          {band}
        </motion.span>
        <span className="font-mono tabular-nums text-white/35">
          {value.length === 0 ? 'estimate' : `~${bits} bits`}
        </span>
      </div>

      {showChecklist && (
        <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {checks.map((c) => (
            <Requirement key={c.id} met={c.met} reduce={!!reduce}>
              {c.label}
            </Requirement>
          ))}
        </ul>
      )}
    </div>
  )
}

function Requirement({
  met,
  reduce,
  children,
}: {
  met: boolean
  reduce: boolean
  children: ReactNode
}) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors"
        style={{
          backgroundColor: met ? 'rgba(220,248,124,0.16)' : 'rgba(255,255,255,0.05)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {met ? (
            <motion.svg
              key="check"
              viewBox="0 0 24 24"
              width="10"
              height="10"
              fill="none"
              stroke="#DCF87C"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <motion.path
                d="M5 13l4 4L19 7"
                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduce ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
              />
            </motion.svg>
          ) : (
            <motion.span
              key="dot"
              className="h-1 w-1 rounded-full bg-white/25"
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
            />
          )}
        </AnimatePresence>
      </span>
      <span className={met ? 'text-white/75' : 'text-white/40'}>{children}</span>
    </li>
  )
}
