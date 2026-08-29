// A small, dependency-free fuzzy matcher for the command palette.
//
// It does a subsequence match — every character of the query must appear in the
// target, in order, but not necessarily adjacent — so "wrk" still finds "Work"
// and "dsgnlang" finds "Design language". A match returns a score (higher is
// better) and the target indices that were hit, so the UI can highlight exactly
// the letters that matched.
//
// The scoring rewards the things that make a hit feel "right": letters that land
// on a word boundary (the start, or just after a space/dash/slash/dot), runs of
// adjacent letters, and matches that begin early in the target. Shorter targets
// win narrow ties, so "Now" beats "By the numbers" for the query "now".

export interface FuzzyResult {
  /** Whether the query is a subsequence of the target at all. */
  matched: boolean
  /** Relative quality of the match; only meaningful when `matched`. */
  score: number
  /** Indices into the ORIGINAL target string that were matched, ascending. */
  indices: number[]
}

const BOUNDARY = /[\s\-_/·.,:()]/

const NO_MATCH: FuzzyResult = { matched: false, score: 0, indices: [] }

/**
 * Greedy subsequence match of `query` against `target`, case-insensitive.
 * An empty query trivially matches with a neutral score.
 */
export function fuzzyMatch(query: string, target: string): FuzzyResult {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (q.length === 0) return { matched: true, score: 0, indices: [] }
  if (q.length > t.length) return NO_MATCH

  const indices: number[] = []
  let score = 0
  let prev = -2
  let ti = 0

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    // Advance through the target until the query character is found.
    while (ti < t.length && t[ti] !== ch) ti++
    if (ti >= t.length) return NO_MATCH

    indices.push(ti)
    score += 1
    // Adjacent to the previous match — reward contiguous runs.
    if (prev === ti - 1) score += 6
    // Sitting on a word boundary — the strongest signal of intent.
    if (ti === 0 || BOUNDARY.test(t[ti - 1])) score += 10
    prev = ti
    ti++
  }

  // Prefer matches that start early and targets that carry less noise.
  score -= indices[0] * 0.5
  score -= t.length * 0.05
  return { matched: true, score, indices }
}

/** Contiguous [start, end) runs from a sorted index list, for highlighting. */
export function toRanges(indices: number[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  for (const i of indices) {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === i) last[1] = i + 1
    else ranges.push([i, i + 1])
  }
  return ranges
}
