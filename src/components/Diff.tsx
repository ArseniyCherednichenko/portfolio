import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { TONE, tokenizeLine } from '../lib/tsx-highlight'

// A hand-built before/after code diff — the deliberate counterpart to the
// CodeBlock viewer, and the piece that let its highlighter earn a home in a
// shared lib. CodeBlock shows one version of a file; this shows two, and marks
// what moved between them: a GitHub / VS Code diff, rebuilt in the house
// language down to the line-matching, so the "made, not assembled" thesis holds
// here too. No diff library: the lines are matched by a classic longest-common-
// subsequence pass (the same algorithm `git diff` is built on), computed once
// and memoised, and both views are drawn from that single result.
//
// It reads in two shapes, toggled by a real control. UNIFIED stacks the change
// in one column — removals, then additions, each with a coloured edge and a +/-
// sign — the way a terminal diff reads. SPLIT sets the old file on the left and
// the new on the right, each changed line aligned with its counterpart and the
// gaps held open by blank filler rows, the way a review tool reads. Both carry
// two gutters: the old line number and the new, so a line that only exists on
// one side shows a number on one side only.
//
// The craft is in three places a bare pair of <pre>s skips. The matching is
// real — unchanged lines are found, not guessed, so a one-line insertion in the
// middle of a file marks exactly that one line and leaves the rest as context,
// never a wall of red-then-green. The colour is inside the site's world — the
// accent lime carries additions, a warm rose the removals, and the code itself
// keeps the CodeBlock palette underneath the tint, so a diff reads as part of
// the page. And it is honest to assistive tech: the signs are decorative, every
// changed line carries an sr-only "Added"/"Removed", filler rows are hidden, and
// a polite live region states the tally. On scroll in the rows settle up in a
// short stagger and each changed line's edge wipes down; reduced motion paints
// the whole thing at rest.

type RowKind = 'equal' | 'del' | 'add'

interface Op {
  kind: RowKind
  text: string
  /** 1-based line number in the "before" file, when the line exists there. */
  oldNo?: number
  /** 1-based line number in the "after" file, when the line exists there. */
  newNo?: number
}

// Longest-common-subsequence line diff. Fills a DP table of common-suffix
// lengths, then walks it from the top: equal lines advance both sides, and at a
// mismatch we take the step that preserves the longer common subsequence,
// preferring a deletion on a tie so a changed block reads removals-first.
// O(n·m) in time and space, which is nothing at the scale a readable diff lives
// at (tens of lines); a guard keeps a pathological input from running away.
function diffLines(before: string[], after: string[]): Op[] {
  const n = before.length
  const m = after.length

  // Guard: far past what a legible on-page diff should ever be — fall back to a
  // plain "all removed, then all added" rather than allocate a vast table.
  if (n * m > 400_000) {
    const ops: Op[] = []
    before.forEach((text, i) => ops.push({ kind: 'del', text, oldNo: i + 1 }))
    after.forEach((text, i) => ops.push({ kind: 'add', text, newNo: i + 1 }))
    return ops
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: Op[] = []
  let i = 0
  let j = 0
  let oldNo = 1
  let newNo = 1
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ kind: 'equal', text: before[i], oldNo: oldNo++, newNo: newNo++ })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: 'del', text: before[i], oldNo: oldNo++ })
      i++
    } else {
      ops.push({ kind: 'add', text: after[j], newNo: newNo++ })
      j++
    }
  }
  while (i < n) ops.push({ kind: 'del', text: before[i++], oldNo: oldNo++ })
  while (j < m) ops.push({ kind: 'add', text: after[j++], newNo: newNo++ })
  return ops
}

// Group the flat op list into segments: a run of unchanged lines, or a change
// block holding its removals and additions. Both views draw from this — unified
// walks it in order, split zips each block's two sides together.
interface Segment {
  equal?: Op
  dels?: Op[]
  adds?: Op[]
}

function toSegments(ops: Op[]): Segment[] {
  const segs: Segment[] = []
  let dels: Op[] = []
  let adds: Op[] = []
  const flush = () => {
    if (dels.length || adds.length) {
      segs.push({ dels, adds })
      dels = []
      adds = []
    }
  }
  for (const op of ops) {
    if (op.kind === 'equal') {
      flush()
      segs.push({ equal: op })
    } else if (op.kind === 'del') dels.push(op)
    else adds.push(op)
  }
  flush()
  return segs
}

const EASE = [0.16, 1, 0.3, 1] as const

// A colour role per line kind, all inside the site's world: lime for what came
// in, a warm rose for what went out, the muted greys for context.
const FILL: Record<RowKind, string> = {
  equal: '',
  add: 'bg-[#DCF87C]/[0.06]',
  del: 'bg-[#E8766B]/[0.07]',
}
const SIGN: Record<RowKind, string> = {
  equal: 'text-white/20',
  add: 'text-[#DCF87C]',
  del: 'text-[#E8766B]',
}
const NUM: Record<RowKind, string> = {
  equal: 'text-white/20',
  add: 'text-[#DCF87C]/55',
  del: 'text-[#E8766B]/55',
}
const SR: Record<RowKind, string> = { equal: '', add: 'Added. ', del: 'Removed. ' }
const MARK: Record<RowKind, string> = { equal: ' ', add: '+', del: '-' }

// The tokenized code for one physical line, in the CodeBlock palette. Memo-free
// on purpose: each line is tiny and the whole diff is memoised upstream.
function Code({ text }: { text: string }) {
  if (text.trim() === '') return <span className="whitespace-pre">{text === '' ? ' ' : text}</span>
  return (
    <span className="whitespace-pre">
      {tokenizeLine(text).map((tok, i) => (
        <span key={i} className={TONE[tok.t]}>
          {tok.v}
        </span>
      ))}
    </span>
  )
}

export interface DiffProps {
  /** The old version of the file, as one string. */
  before: string
  /** The new version of the file, as one string. */
  after: string
  /** Optional file label for the header bar. */
  filename?: string
  /** Language chip label. Purely cosmetic. */
  lang?: string
  /** Which view to open in. Defaults to unified. */
  defaultView?: 'unified' | 'split'
  className?: string
}

/**
 * A before/after code diff viewer: lines matched by a hand-built LCS pass,
 * shown unified or split, highlighted in the CodeBlock palette. Keyboard-
 * operable view toggle, reduced-motion aware, honest to assistive tech.
 */
export function Diff({
  before,
  after,
  filename,
  lang = 'tsx',
  defaultView = 'unified',
  className = '',
}: DiffProps) {
  const reduce = useReducedMotion()
  const toggleId = useId()
  const [view, setView] = useState<'unified' | 'split'>(defaultView)

  const { ops, segments, adds, dels, oldWidth, newWidth } = useMemo(() => {
    const strip = (s: string) => s.replace(/^\n/, '').replace(/\s+$/, '')
    const ops = diffLines(strip(before).split('\n'), strip(after).split('\n'))
    const adds = ops.filter((o) => o.kind === 'add').length
    const dels = ops.filter((o) => o.kind === 'del').length
    const oldWidth = String(Math.max(1, ...ops.map((o) => o.oldNo ?? 0))).length
    const newWidth = String(Math.max(1, ...ops.map((o) => o.newNo ?? 0))).length
    return { ops, segments: toSegments(ops), adds, dels, oldWidth, newWidth }
  }, [before, after])

  // A per-row reveal, capped so a long diff never staggers for seconds.
  const rowIn = (index: number) =>
    reduce
      ? false
      : {
          initial: { opacity: 0, y: 6 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-40px' },
          transition: { duration: 0.3, delay: Math.min(index * 0.012, 0.4), ease: EASE },
        }

  // The coloured left edge of a changed row, wiping down on reveal.
  function Edge({ kind }: { kind: RowKind }) {
    if (kind === 'equal') return <span aria-hidden className="w-[3px] shrink-0 self-stretch" />
    return (
      <motion.span
        aria-hidden
        className={`w-[3px] shrink-0 self-stretch ${kind === 'add' ? 'bg-[#DCF87C]' : 'bg-[#E8766B]'}`}
        initial={reduce ? false : { scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
        style={{ transformOrigin: 'top' }}
      />
    )
  }

  function Gutter({ no, width, kind }: { no?: number; width: number; kind: RowKind }) {
    return (
      <span
        aria-hidden
        className={`shrink-0 select-none px-2 text-right tabular-nums ${NUM[kind]}`}
        style={{ minWidth: `${width + 1}ch` }}
      >
        {no ?? ''}
      </span>
    )
  }

  // One line in the unified column.
  function UnifiedRow({ op, index }: { op: Op; index: number }) {
    return (
      <motion.div {...(rowIn(index) || {})} className={`flex items-stretch ${FILL[op.kind]}`}>
        <Edge kind={op.kind} />
        <Gutter no={op.oldNo} width={oldWidth} kind={op.kind} />
        <Gutter no={op.newNo} width={newWidth} kind={op.kind} />
        <span aria-hidden className={`shrink-0 select-none pl-1 pr-2 text-center ${SIGN[op.kind]}`} style={{ width: '1.5ch' }}>
          {MARK[op.kind]}
        </span>
        <code className="min-w-0 flex-1 pr-4">
          <span className="sr-only">{SR[op.kind]}</span>
          <Code text={op.text} />
        </code>
      </motion.div>
    )
  }

  // One side of a split row — a real line, or a blank filler holding the gap
  // open opposite a change. Filler rows are hidden from assistive tech.
  function SplitCell({ op, width, side, index }: { op: Op | null; width: number; side: 'old' | 'new'; index: number }) {
    if (!op) {
      return <div aria-hidden className="flex items-stretch bg-white/[0.015]" style={{ minHeight: '1.6em' }} />
    }
    const no = side === 'old' ? op.oldNo : op.newNo
    return (
      <motion.div {...(rowIn(index) || {})} className={`flex items-stretch ${FILL[op.kind]}`}>
        <Edge kind={op.kind} />
        <Gutter no={no} width={width} kind={op.kind} />
        <span aria-hidden className={`shrink-0 select-none pl-1 pr-2 text-center ${SIGN[op.kind]}`} style={{ width: '1.5ch' }}>
          {MARK[op.kind]}
        </span>
        <code className="min-w-0 flex-1 pr-4">
          <span className="sr-only">{SR[op.kind]}</span>
          <Code text={op.text} />
        </code>
      </motion.div>
    )
  }

  // Zip the segments into aligned left/right pairs for the split view.
  const splitRows = useMemo(() => {
    const left: (Op | null)[] = []
    const right: (Op | null)[] = []
    for (const seg of segments) {
      if (seg.equal) {
        left.push(seg.equal)
        right.push(seg.equal)
        continue
      }
      const d = seg.dels ?? []
      const a = seg.adds ?? []
      const rows = Math.max(d.length, a.length)
      for (let k = 0; k < rows; k++) {
        left.push(d[k] ?? null)
        right.push(a[k] ?? null)
      }
    }
    return { left, right }
  }, [segments])

  const Pill = ({ value, label }: { value: 'unified' | 'split'; label: string }) => {
    const active = view === value
    return (
      <button
        type="button"
        onClick={() => setView(value)}
        aria-pressed={active}
        className={`relative rounded-md px-3 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 ${
          active ? 'text-black' : 'text-white/55 hover:text-white'
        }`}
      >
        {active && (
          <motion.span
            layoutId={`${toggleId}-pill`}
            className="absolute inset-0 rounded-md bg-[#DCF87C]"
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 36 }}
          />
        )}
        <span className="relative">{label}</span>
      </button>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#080909] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] ${className}`}
    >
      {/* Header — file label and change tally on the left, the view toggle on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#DCF87C]/70 shadow-[0_0_8px_1px_rgba(220,248,124,0.35)]" />
          <span className="truncate font-mono text-[12px] text-white/55">{filename ?? `snippet.${lang}`}</span>
          <span className="ml-1 flex shrink-0 items-center gap-2 font-mono text-[11px]">
            <span className="text-[#DCF87C]">+{adds}</span>
            <span className="text-[#E8766B]">&minus;{dels}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label="Diff view">
          <Pill value="unified" label="Unified" />
          <Pill value="split" label="Split" />
        </div>
      </div>

      {/* The change tally, spoken once. */}
      <p role="status" aria-live="polite" className="sr-only">
        {adds} {adds === 1 ? 'addition' : 'additions'}, {dels} {dels === 1 ? 'deletion' : 'deletions'}. {view} view.
      </p>

      {view === 'unified' ? (
        <div className="overflow-x-auto py-3 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
          {ops.map((op, i) => (
            <UnifiedRow key={i} op={op} index={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
          <div className="overflow-x-auto py-3 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
            <div aria-hidden className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
              Before
            </div>
            {splitRows.left.map((op, i) => (
              <SplitCell key={i} op={op} width={oldWidth} side="old" index={i} />
            ))}
          </div>
          <div className="overflow-x-auto py-3 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
            <div aria-hidden className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
              After
            </div>
            {splitRows.right.map((op, i) => (
              <SplitCell key={i} op={op} width={newWidth} side="new" index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
