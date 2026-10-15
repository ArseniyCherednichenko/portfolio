// braille — a tiny Grade-1 (uncontracted) English Braille encoder, shared by
// the Braille display component. Braille is not a font you set and move; it is
// a six-dot code, so like the 5x7 bitmap next door this is a lookup table, not
// a typeface. Each cell is six positions in two columns of three:
//
//     1 4
//     2 5
//     3 6
//
// A cell is stored as a 6-bit mask: bit (n-1) set means dot n is raised. That
// is the whole alphabet, the ten digits (behind a number sign, the way real
// braille disambiguates them from the first ten letters), common punctuation,
// and the two prefix signs — capital and number — that a reader expects.

/** Dot n (1..6) occupies this bit of a cell mask. */
export const dotBit = (n: number): number => 1 << (n - 1)

/** Build a mask from a list of raised dot numbers. */
const cell = (...dots: number[]): number => dots.reduce((m, d) => m | dotBit(d), 0)

/** The two prefix cells a sighted reader rarely notices but a braille reader
 * relies on: the capital sign precedes a capital letter, the number sign turns
 * the following a–j into the digits 1–0. */
export const CAPITAL_SIGN = cell(6)
export const NUMBER_SIGN = cell(3, 4, 5, 6)

/** a–z, by their standard six-dot patterns. */
const LETTERS: Record<string, number> = {
  a: cell(1), b: cell(1, 2), c: cell(1, 4), d: cell(1, 4, 5), e: cell(1, 5),
  f: cell(1, 2, 4), g: cell(1, 2, 4, 5), h: cell(1, 2, 5), i: cell(2, 4), j: cell(2, 4, 5),
  k: cell(1, 3), l: cell(1, 2, 3), m: cell(1, 3, 4), n: cell(1, 3, 4, 5), o: cell(1, 3, 5),
  p: cell(1, 2, 3, 4), q: cell(1, 2, 3, 4, 5), r: cell(1, 2, 3, 5), s: cell(2, 3, 4), t: cell(2, 3, 4, 5),
  u: cell(1, 3, 6), v: cell(1, 2, 3, 6), w: cell(2, 4, 5, 6), x: cell(1, 3, 4, 6), y: cell(1, 3, 4, 5, 6), z: cell(1, 3, 5, 6),
}

/** Digits ride on the first ten letters, so 1→a … 9→i, 0→j. */
const DIGIT_LETTER = 'jabcdefghi' // index by the digit itself: '0'→'j', '1'→'a' …

/** Punctuation, in the standard English Braille positions. */
const PUNCT: Record<string, number> = {
  ',': cell(2), ';': cell(2, 3), ':': cell(2, 5), '.': cell(2, 5, 6),
  '!': cell(2, 3, 5), '?': cell(2, 3, 6), "'": cell(3), '-': cell(3, 6),
  '/': cell(3, 4), '(': cell(1, 2, 6), ')': cell(3, 4, 5),
}

/**
 * Turn a string into the sequence of six-dot cells a braille line would hold,
 * inserting the capital and number prefix cells where a reader expects them.
 * An unknown character becomes one blank cell (a space) rather than vanishing,
 * so the spacing of the line stays honest to the input.
 */
export function cellsFor(text: string): number[] {
  const out: number[] = []
  let numberMode = false
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      if (!numberMode) {
        out.push(NUMBER_SIGN)
        numberMode = true
      }
      out.push(LETTERS[DIGIT_LETTER[ch.charCodeAt(0) - 48]])
      continue
    }
    // Any non-digit ends number mode; the next digit re-arms the sign.
    numberMode = false
    if (ch === ' ') {
      out.push(0)
      continue
    }
    const lower = ch.toLowerCase()
    if (lower >= 'a' && lower <= 'z') {
      if (ch !== lower) out.push(CAPITAL_SIGN) // an uppercase letter
      out.push(LETTERS[lower])
      continue
    }
    if (ch in PUNCT) {
      out.push(PUNCT[ch])
      continue
    }
    out.push(0)
  }
  return out
}
