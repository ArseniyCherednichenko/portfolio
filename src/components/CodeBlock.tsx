import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A hand-built, syntax-highlighted code block — the piece the site kept
// pointing at but never had: a way to show its own source on the page, not a
// screenshot. No Prism, no Shiki, no highlight.js; the highlighter below is a
// small, single-pass TSX tokenizer written for this repo's own idiom, so the
// "made, not assembled" thesis holds even here, down to the code viewer.
//
// It is deliberately a *light* highlighter, not a parser: it knows comments,
// strings and template literals, numbers, keywords, function calls, JSX tag
// names, and Capitalised type/component names — enough to give real TSX a clear,
// readable colour without pretending to understand the grammar. The palette
// stays inside the site's world — lime for keywords, a warm sand for strings, a
// cool teal for numbers — so a snippet reads as part of the page, not a foreign
// theme dropped in.
//
// The real text lives in the spans, so a screen reader reads the code and a
// browser find still hits it; the gutter numbers are unselectable so a drag-copy
// takes clean code, and the copy button hands over the exact source regardless.
// On scroll in, the lines settle up in a short stagger; reduced motion paints
// them at rest.

type TokenType =
  | 'ws'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'fn'
  | 'type'
  | 'tag'
  | 'punct'
  | 'plain'

interface Token {
  t: TokenType
  v: string
}

// The words that read as language, not identifiers. Kept to the TS/JS/TSX set
// this repo actually uses, so nothing lights up that shouldn't.
const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'const', 'let', 'var', 'function',
  'return', 'type', 'interface', 'enum', 'as', 'satisfies', 'class', 'extends',
  'implements', 'new', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
  'break', 'continue', 'of', 'in', 'await', 'async', 'yield', 'this', 'super',
  'null', 'undefined', 'true', 'false', 'void', 'typeof', 'keyof', 'readonly',
  'public', 'private', 'protected', 'static', 'get', 'set', 'try', 'catch',
  'finally', 'throw', 'delete', 'instanceof', 'namespace', 'declare', 'infer',
])

// One left-to-right pass. Strings, template literals, and block comments may
// span newlines; everything else is a single run. The renderer splits any
// token that carries a '\n' back into per-line pieces, so the tokenizer never
// has to think about lines.
function tokenize(src: string): Token[] {
  const toks: Token[] = []
  const push = (t: TokenType, v: string) => {
    if (v) toks.push({ t, v })
  }
  const n = src.length
  const isWord = (c: string) => /[A-Za-z0-9_$]/.test(c)
  let i = 0

  while (i < n) {
    const c = src[i]

    // Whitespace (including newlines) — passed through untouched.
    if (/\s/.test(c)) {
      let j = i + 1
      while (j < n && /\s/.test(src[j])) j++
      push('ws', src.slice(i, j))
      i = j
      continue
    }

    // Line comment.
    if (c === '/' && src[i + 1] === '/') {
      let j = i + 2
      while (j < n && src[j] !== '\n') j++
      push('comment', src.slice(i, j))
      i = j
      continue
    }

    // Block comment (can span lines).
    if (c === '/' && src[i + 1] === '*') {
      let j = i + 2
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++
      j = Math.min(n, j + 2)
      push('comment', src.slice(i, j))
      i = j
      continue
    }

    // String or template literal. Template literals can span lines; we do not
    // try to re-highlight the inside of a ${…} — honest to "light", not a parser.
    if (c === '"' || c === "'" || c === '`') {
      const q = c
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === q) {
          j++
          break
        }
        j++
      }
      push('string', src.slice(i, j))
      i = j
      continue
    }

    // Number (int, float, hex, with separators).
    if (/[0-9]/.test(c)) {
      let j = i + 1
      while (j < n && /[0-9a-fx._]/i.test(src[j])) j++
      push('number', src.slice(i, j))
      i = j
      continue
    }

    // JSX / HTML tag open: `<`, an optional `/`, then a tag name. Everything
    // else about JSX (attributes, expression braces) reads as plain/punct,
    // which is enough to make the markup legible without a real JSX parse.
    if (c === '<' && /[A-Za-z/]/.test(src[i + 1] ?? '')) {
      let j = i + 1
      let open = '<'
      if (src[j] === '/') {
        open += '/'
        j++
      }
      push('punct', open)
      let k = j
      while (k < n && /[A-Za-z0-9._-]/.test(src[k])) k++
      if (k > j) push('tag', src.slice(j, k))
      i = k
      continue
    }

    // Identifier — a keyword, a call (followed by `(`), a Capitalised
    // type/component, or a plain name.
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1
      while (j < n && isWord(src[j])) j++
      const word = src.slice(i, j)
      let k = j
      while (k < n && /\s/.test(src[k])) k++
      const next = src[k]
      let t: TokenType = 'plain'
      if (KEYWORDS.has(word)) t = 'keyword'
      else if (next === '(') t = 'fn'
      else if (/^[A-Z]/.test(word)) t = 'type'
      push(t, word)
      i = j
      continue
    }

    // Anything else — one punctuation / operator character.
    push('punct', c)
    i++
  }

  return toks
}

// The token colours, all inside the site's world: lime carries the language,
// a warm sand the strings, a cool teal the numbers, a pale lime the types and
// tags, near-white the calls, and the muted greys everything structural.
const TONE: Record<TokenType, string> = {
  ws: '',
  comment: 'text-white/30 italic',
  string: 'text-[#E3C08D]',
  number: 'text-[#84D6C6]',
  keyword: 'text-[#DCF87C]',
  fn: 'text-[#F1F1E8]',
  type: 'text-[#BFE08C]',
  tag: 'text-[#BFE08C]',
  punct: 'text-white/40',
  plain: 'text-white/75',
}

// Split the flat token stream into lines, so each rendered row is a real line
// with its own number. Only ws / string / comment tokens can carry a '\n'.
function toLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]]
  for (const tok of tokens) {
    if (!tok.v.includes('\n')) {
      lines[lines.length - 1].push(tok)
      continue
    }
    const parts = tok.v.split('\n')
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ t: tok.t, v: part })
    })
  }
  return lines
}

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
