import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { TONE, toLines, tokenize } from '../lib/tsx-highlight'

// A hand-built, syntax-highlighted code block — the piece the site kept
// pointing at but never had: a way to show its own source on the page, not a
// screenshot. No Prism, no Shiki, no highlight.js; the highlighter it draws
// with is a small, single-pass TSX tokenizer written for this repo's own
// idiom, so the "made, not assembled" thesis holds even here, down to the code
// viewer. That tokenizer used to live in this file; it now lives in
// `src/lib/tsx-highlight.ts` so the `Diff` viewer can colour two versions of a
// file with the exact same palette — one highlighter, two readers.
//
// The real text lives in the spans, so a screen reader reads the code and a
// browser find still hits it; the gutter numbers are unselectable so a drag-copy
// takes clean code, and the copy button hands over the exact source regardless.
// On scroll in, the lines settle up in a short stagger; reduced motion paints
// them at rest.

export function CodeBlock({
  code,
  filename,
  lang = 'tsx',
  highlightLines = [],
  className = '',
}: {
  /** The source to render. Shown verbatim; also what the copy button hands over. */
  code: string
  /** Optional file label for the header bar, e.g. "Reveal.tsx". */
  filename?: string
  /** Language chip label. Purely cosmetic. */
  lang?: string
  /** 1-based line numbers to mark with a lime edge. */
  highlightLines?: number[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Trim a single leading/trailing blank line so an embedded template literal
  // does not render an empty first row.
  const source = useMemo(() => code.replace(/^\n/, '').replace(/\s+$/, ''), [code])
  const lines = useMemo(() => toLines(tokenize(source)), [source])
  const marked = useMemo(() => new Set(highlightLines), [highlightLines])
  const gutterWidth = String(lines.length).length

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(source)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — best-effort, stay silent */
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#080909] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] ${className}`}
    >
      {/* Header bar — file label on the left, copy on the right. */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full bg-[#DCF87C]/70 shadow-[0_0_8px_1px_rgba(220,248,124,0.35)]"
          />
          <span className="truncate font-mono text-[12px] text-white/55">
            {filename ?? `snippet.${lang}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 sm:inline">
            {lang}
          </span>
          <button
            type="button"
            onClick={onCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
            className="group inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/55 transition-colors hover:border-[#DCF87C]/40 hover:text-white"
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCF87C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span className="text-[#DCF87C]">Copied</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* The code. A div rather than a <pre>: each line is its own row so it can
          stagger in and carry a gutter number, with whitespace-pre preserving
          the indentation inside the code column. */}
      <div className="overflow-x-auto px-1 py-3 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
        {lines.map((line, li) => {
          const number = li + 1
          const isMarked = marked.has(number)
          return (
            <motion.div
              key={li}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: reduce ? 0 : 0.3,
                delay: reduce ? 0 : Math.min(li * 0.015, 0.5),
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`flex items-start ${
                isMarked ? 'bg-[#DCF87C]/[0.06]' : ''
              }`}
            >
              <span
                aria-hidden
                className={`sticky left-0 mr-3 shrink-0 select-none border-l-2 bg-[#080909] pl-3 pr-2 text-right tabular-nums ${
                  isMarked ? 'border-[#DCF87C]/70 text-[#DCF87C]/60' : 'border-transparent text-white/20'
                }`}
                style={{ minWidth: `${gutterWidth + 2}ch` }}
              >
                {number}
              </span>
              <code className="whitespace-pre pr-4">
                {line.length === 0 ? (
                  ' '
                ) : (
                  line.map((tok, ti) => (
                    <span key={ti} className={TONE[tok.t]}>
                      {tok.v}
                    </span>
                  ))
                )}
              </code>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
