import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { useAnimationFrame, useReducedMotion } from 'framer-motion'

// Sorter — a sorting algorithm taken apart while it runs. A row of bars, one per
// value, shuffled; pick an algorithm and watch it put them in order, every
// comparison and every swap drawn as it happens. Not the drag-reorder list
// (Sortable), where you set the order by hand — here the machine does the
// ordering and the point is to see *how*: the reading head sweeping a pass, the
// pivot partitioning its range, a merge writing two runs back into place, the
// sorted region growing lime from one end.
//
// Six classic algorithms, each hand-instrumented to record its own work as a
// list of frames — a snapshot of the bars, which indices it is touching this
// step, and which have been locked into their final place — so the picture and
// the algorithm are the same object. No sort library drives the animation; the
// animation *is* the sort, played back off the animation clock. The live
// comparison and swap counters are the algorithm's real cost, counted as it
// goes, so O(n log n) and O(n squared) read as the difference in how long the
// field churns before it settles.
//
// The field never sits still: when a sort finishes it holds on the ordered
// result for a beat, then reshuffles and runs again, a slow closed loop like the
// falling sand beside it. Switch algorithms mid-run and it rebuilds and starts
// the new one on a fresh shuffle.
//
// No Date.now, no Math.random on the hot path: a seeded PRNG makes each shuffle,
// bumped once per shuffle so successive runs differ without a wall clock, so the
// first paint is stable across reloads and reduced-motion renders. Under
// prefers-reduced-motion nothing auto-runs — the field is drawn sorted and
// still, and a Step control walks the chosen algorithm one comparison at a time
// so a keyboard reader can drive it at their own pace.

const N = 40 // number of bars

interface Frame {
  a: number[] // the bars, as values 1..N, in their positions this step
  active: number[] // indices being compared / moved this step
  done: number[] // indices locked into their final sorted place
  comps: number // cumulative comparisons up to and including this step
  swaps: number // cumulative swaps up to and including this step
}

type Builder = (input: number[]) => Frame[]

// A tiny deterministic PRNG so shuffles carry no wall clock and the first paint
// is stable. Seeded per shuffle from a counter that only ever climbs.
function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(seed: number): number[] {
  const a = Array.from({ length: N }, (_, i) => i + 1)
  const rnd = mulberry32(seed)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const range = (lo: number, hi: number): number[] => {
  const out: number[] = []
  for (let k = lo; k < hi; k++) out.push(k)
  return out
}

// Each generator mutates a working copy and records a frame at every meaningful
// step, tallying its real comparison and swap cost. Every list ends with one
// frame where the whole field is marked done, so the finish reads as a sweep to
// lime.

function bubble(input: number[]): Frame[] {
  const a = input.slice()
  const n = a.length
  const frames: Frame[] = []
  let comps = 0
  let swaps = 0
  const done: number[] = []
  const snap = (active: number[]) =>
    frames.push({ a: a.slice(), active, done: [...done], comps, swaps })
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      comps++
      snap([j, j + 1])
      if (a[j] > a[j + 1]) {
        ;[a[j], a[j + 1]] = [a[j + 1], a[j]]
        swaps++
        snap([j, j + 1])
      }
    }
    done.push(n - 1 - i)
  }
  frames.push({ a: a.slice(), active: [], done: range(0, n), comps, swaps })
  return frames
}

function insertion(input: number[]): Frame[] {
  const a = input.slice()
  const n = a.length
  const frames: Frame[] = []
  let comps = 0
  let swaps = 0
  const snap = (active: number[], sortedTo: number) =>
    frames.push({ a: a.slice(), active, done: range(0, sortedTo), comps, swaps })
  for (let i = 1; i < n; i++) {
    let j = i
    const key = a[i]
    snap([i], i)
    while (j > 0) {
      comps++
      snap([j - 1, j], i)
      if (a[j - 1] > key) {
        a[j] = a[j - 1]
        swaps++
        snap([j - 1, j], i)
        j--
      } else break
    }
    a[j] = key
    snap([j], i + 1)
  }
  frames.push({ a: a.slice(), active: [], done: range(0, n), comps, swaps })
  return frames
}

function selection(input: number[]): Frame[] {
  const a = input.slice()
  const n = a.length
  const frames: Frame[] = []
  let comps = 0
  let swaps = 0
  const snap = (active: number[], sortedTo: number) =>
    frames.push({ a: a.slice(), active, done: range(0, sortedTo), comps, swaps })
  for (let i = 0; i < n; i++) {
    let m = i
    for (let j = i + 1; j < n; j++) {
      comps++
      snap([m, j], i)
      if (a[j] < a[m]) m = j
    }
    if (m !== i) {
      ;[a[i], a[m]] = [a[m], a[i]]
      swaps++
    }
    snap([i, m], i + 1)
  }
  frames.push({ a: a.slice(), active: [], done: range(0, n), comps, swaps })
  return frames
}

function quick(input: number[]): Frame[] {
  const a = input.slice()
  const n = a.length
  const frames: Frame[] = []
  let comps = 0
  let swaps = 0
  const done = new Set<number>()
  const snap = (active: number[]) =>
    frames.push({ a: a.slice(), active, done: [...done], comps, swaps })
  const qs = (lo: number, hi: number) => {
    if (lo > hi) return
    if (lo === hi) {
      done.add(lo)
      return
    }
    const pivot = a[hi]
    let i = lo
    for (let j = lo; j < hi; j++) {
      comps++
      snap([j, hi])
      if (a[j] < pivot) {
        if (i !== j) {
          ;[a[i], a[j]] = [a[j], a[i]]
          swaps++
          snap([i, j])
        }
        i++
      }
    }
    ;[a[i], a[hi]] = [a[hi], a[i]]
    swaps++
    snap([i, hi])
    done.add(i)
    qs(lo, i - 1)
    qs(i + 1, hi)
  }
  qs(0, n - 1)
  frames.push({ a: a.slice(), active: [], done: range(0, n), comps, swaps })
  return frames
}

function merge(input: number[]): Frame[] {
  const a = input.slice()
  const n = a.length
  const frames: Frame[] = []
  let comps = 0
  let swaps = 0
  const snap = (active: number[]) =>
    frames.push({ a: a.slice(), active, done: [], comps, swaps })
  const ms = (lo: number, hi: number) => {
    if (hi <= lo) return
    const mid = (lo + hi) >> 1
    ms(lo, mid)
    ms(mid + 1, hi)
    const buf = a.slice(lo, hi + 1)
    const leftLen = mid - lo + 1
    const total = hi - lo + 1
    let i = 0
    let j = leftLen
    let k = lo
    while (i < leftLen && j < total) {
      comps++
      snap([lo + i, lo + j])
      if (buf[i] <= buf[j]) {
        a[k] = buf[i]
        i++
      } else {
        a[k] = buf[j]
        j++
        swaps++
      }
      snap([k])
      k++
    }
    while (i < leftLen) {
      a[k] = buf[i]
      i++
      snap([k])
      k++
    }
    while (j < total) {
      a[k] = buf[j]
      j++
      snap([k])
      k++
    }
  }
  ms(0, n - 1)
  frames.push({ a: a.slice(), active: [], done: range(0, n), comps, swaps })
  return frames
}

function heap(input: number[]): Frame[] {
  const a = input.slice()
  const n = a.length
  const frames: Frame[] = []
  let comps = 0
  let swaps = 0
  const done = new Set<number>()
  const snap = (active: number[]) =>
    frames.push({ a: a.slice(), active, done: [...done], comps, swaps })
  const sift = (root: number, size: number) => {
    for (;;) {
      let child = 2 * root + 1
      if (child >= size) break
      if (child + 1 < size) {
        comps++
        snap([child, child + 1])
        if (a[child + 1] > a[child]) child++
      }
      comps++
      snap([root, child])
      if (a[root] < a[child]) {
        ;[a[root], a[child]] = [a[child], a[root]]
        swaps++
        snap([root, child])
        root = child
      } else break
    }
  }
  for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n)
  for (let end = n - 1; end > 0; end--) {
    ;[a[0], a[end]] = [a[end], a[0]]
    swaps++
    snap([0, end])
    done.add(end)
    sift(0, end)
  }
  frames.push({ a: a.slice(), active: [], done: range(0, n), comps, swaps })
  return frames
}

interface Algo {
  key: string
  label: string
  build: Builder
  big: string // honest worst-case order, shown as a quiet tag
}

const ALGOS: Algo[] = [
  { key: 'quick', label: 'Quick', build: quick, big: 'n log n avg' },
  { key: 'merge', label: 'Merge', build: merge, big: 'n log n' },
  { key: 'heap', label: 'Heap', build: heap, big: 'n log n' },
  { key: 'insertion', label: 'Insertion', build: insertion, big: 'n squared' },
  { key: 'selection', label: 'Selection', build: selection, big: 'n squared' },
  { key: 'bubble', label: 'Bubble', build: bubble, big: 'n squared' },
]

const STEPS_PER_SEC = 90 // playback rate under normal motion
const REST_MS = 1500 // beat to hold on the sorted result before reshuffling

const BASE = 'rgba(255,255,255,0.16)'
const ACTIVE = 'rgba(255,255,255,0.92)'
const LIME = '#DCF87C'

export function Sorter({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const compsRef = useRef<HTMLSpanElement | null>(null)
  const swapsRef = useRef<HTMLSpanElement | null>(null)
  const liveRef = useRef<HTMLParagraphElement | null>(null)
  const labelId = useId()

  const [algo, setAlgo] = useState('quick')
  const [playing, setPlaying] = useState(true)

  // Everything the animation loop touches lives in refs so the loop never
  // re-subscribes and switching algorithm or shuffling can rebuild in place.
  const framesRef = useRef<Frame[]>([])
  const idxRef = useRef(0)
  const dataRef = useRef<number[]>([])
  const seedRef = useRef(0x9e3779b1)
  const algoRef = useRef(algo)
  const playingRef = useRef(playing)
  const restRef = useRef(0)
  const lastRef = useRef(0)
  const accRef = useRef(0)
  const dimsRef = useRef({ w: 0, h: 0, dpr: 1 })

  algoRef.current = algo
  playingRef.current = playing

  const buildFor = useCallback((key: string) => {
    const spec = ALGOS.find((x) => x.key === key) ?? ALGOS[0]
    framesRef.current = spec.build(dataRef.current)
    idxRef.current = reduce ? framesRef.current.length - 1 : 0
    accRef.current = 0
    restRef.current = 0
  }, [reduce])

  const reshuffle = useCallback(() => {
    seedRef.current = (seedRef.current + 0x6d2b79f5) | 0
    dataRef.current = shuffled(seedRef.current)
    buildFor(algoRef.current)
  }, [buildFor])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const frames = framesRef.current
    if (!canvas || !frames.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = dimsRef.current
    const f = frames[Math.min(idxRef.current, frames.length - 1)]
    ctx.clearRect(0, 0, w, h)

    const padX = 2
    const padTop = 10
    const padBottom = 12
    const usableW = w - padX * 2
    const usableH = h - padTop - padBottom
    const slot = usableW / N
    const gap = Math.min(3, slot * 0.28)
    const barW = slot - gap

    const activeSet = new Set(f.active)
    const doneSet = new Set(f.done)

    for (let i = 0; i < N; i++) {
      const v = f.a[i]
      const bh = Math.max(2, (v / N) * usableH)
      const x = padX + i * slot + gap / 2
      const y = h - padBottom - bh
      let color = BASE
      if (doneSet.has(i)) color = LIME
      else if (activeSet.has(i)) color = ACTIVE
      ctx.fillStyle = color
      ctx.fillRect(x, y, barW, bh)
      // a brighter cap on the touched bars, so the reading head reads as light
      if (activeSet.has(i) && !doneSet.has(i)) {
        ctx.fillStyle = LIME
        ctx.fillRect(x, y, barW, Math.min(3, bh))
      }
    }
  }, [])

  const writeReadouts = useCallback(() => {
    const frames = framesRef.current
    if (!frames.length) return
    const f = frames[Math.min(idxRef.current, frames.length - 1)]
    if (compsRef.current) compsRef.current.textContent = f.comps.toLocaleString()
    if (swapsRef.current) swapsRef.current.textContent = f.swaps.toLocaleString()
  }, [])

  // Size the canvas to its box, retina-aware, and repaint on resize.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      dimsRef.current = { w, h, dpr }
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [draw])

  // First build + rebuild whenever the algorithm changes: a fresh shuffle so
  // each algorithm is judged on its own field.
  useEffect(() => {
    reshuffle()
    draw()
    writeReadouts()
    if (liveRef.current) {
      const spec = ALGOS.find((x) => x.key === algo)
      liveRef.current.textContent = reduce
        ? `${spec?.label} sort, shown sorted. Use Step to walk it.`
        : `Running ${spec?.label} sort.`
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algo])

  useAnimationFrame((t) => {
    const dt = lastRef.current ? t - lastRef.current : 0
    lastRef.current = t
    if (reduce) return // static under reduced motion; Step drives it instead
    const frames = framesRef.current
    if (!frames.length) return

    if (restRef.current > 0) {
      restRef.current -= dt
      if (restRef.current <= 0) {
        reshuffle()
        writeReadouts()
      }
      draw()
      return
    }

    if (playingRef.current) {
      accRef.current += dt
      const spf = 1000 / STEPS_PER_SEC
      let stepped = false
      while (accRef.current >= spf && idxRef.current < frames.length - 1) {
        idxRef.current++
        accRef.current -= spf
        stepped = true
      }
      if (idxRef.current >= frames.length - 1) {
        restRef.current = REST_MS
        accRef.current = 0
      }
      if (stepped) writeReadouts()
    }
    draw()
  })

  const step = useCallback(() => {
    const frames = framesRef.current
    if (!frames.length) return
    if (idxRef.current >= frames.length - 1) {
      reshuffle()
    } else {
      idxRef.current++
    }
    draw()
    writeReadouts()
  }, [draw, reshuffle, writeReadouts])

  const currentBig = ALGOS.find((x) => x.key === algo)?.big ?? ''

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1"
        role="img"
        aria-labelledby={labelId}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      <p id={labelId} className="sr-only">
        A bar-chart visualisation of a sorting algorithm ordering {N} shuffled
        values; touched bars light up and sorted bars turn lime.
      </p>
      <p ref={liveRef} aria-live="polite" className="sr-only" />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Sorting algorithm"
        >
          {ALGOS.map((a) => {
            const on = a.key === algo
            return (
              <button
                key={a.key}
                type="button"
                aria-pressed={on}
                onClick={() => setAlgo(a.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  on
                    ? 'bg-[#DCF87C] text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90'
                }`}
              >
                {a.label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!reduce && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={playing}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          )}
          <button
            type="button"
            onClick={step}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Step
          </button>
          <button
            type="button"
            onClick={() => {
              reshuffle()
              draw()
              writeReadouts()
            }}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Shuffle
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] uppercase tracking-[0.2em] text-white/40">
        <span>
          Comparisons{' '}
          <span ref={compsRef} className="font-mono text-white/75 tracking-normal">
            0
          </span>
        </span>
        <span>
          Swaps{' '}
          <span ref={swapsRef} className="font-mono text-white/75 tracking-normal">
            0
          </span>
        </span>
        <span className="ml-auto normal-case tracking-normal text-white/35">
          worst case {currentBig}
        </span>
      </div>
    </div>
  )
}

export default Sorter
