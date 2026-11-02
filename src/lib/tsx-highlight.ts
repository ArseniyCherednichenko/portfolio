// A hand-built, single-pass TSX highlighter — the piece the site kept pointing
// at but never shared. It began life inside `CodeBlock`, the viewer that shows
// the site's own source on the page rather than a screenshot; no Prism, no
// Shiki, no highlight.js, so the "made, not assembled" thesis holds even here.
// It was lifted out into this module the moment a second surface — the `Diff`
// viewer, which highlights two versions of a file at once — needed exactly the
// same colouring. One tokenizer, one palette, two readers, no duplication.
//
// It is deliberately a *light* highlighter, not a parser: it knows comments,
// strings and template literals, numbers, keywords, function calls, JSX tag
// names, and Capitalised type/component names — enough to give real TSX a clear,
// readable colour without pretending to understand the grammar. The palette
// stays inside the site's world — lime for keywords, a warm sand for strings, a
// cool teal for numbers — so a snippet reads as part of the page, not a foreign
// theme dropped in.

export type TokenType =
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

export interface Token {
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
// span newlines; everything else is a single run. `toLines` splits any token
// that carries a '\n' back into per-line pieces, so the tokenizer never has to
// think about lines.
export function tokenize(src: string): Token[] {
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
export const TONE: Record<TokenType, string> = {
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

// Split a flat token stream into lines, so each rendered row is a real line
// with its own number. Only ws / string / comment tokens can carry a '\n'.
export function toLines(tokens: Token[]): Token[][] {
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

/** Tokenize a single physical line of source into coloured spans. Convenience
 * for callers (like the diff viewer) that already hold the text split by line
 * and want one line's tokens without the leading/trailing-line handling. */
export function tokenizeLine(line: string): Token[] {
  return tokenize(line).filter((t) => t.v !== '\n')
}
