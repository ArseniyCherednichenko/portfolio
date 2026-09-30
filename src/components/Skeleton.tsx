import { useReducedMotion } from 'framer-motion'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'

// The one piece of interface every product has and few build with any care: the
// moment *before* the content arrives. A run of rebuilt instruments had the
// Playground leaning mechanical, so this is a return to plain product craft —
// the loading placeholder, done properly.
//
// The point of a skeleton is honesty about time. It stands in for the real
// layout at the real size, so nothing jumps when the data lands; it says "this
// is coming" without a spinner's empty promise of "something is happening
// somewhere". The craft is in three places. First, a single shared clock: the
// specular sweep is a CSS animation applied by name (`skeleton-sweep`, in
// index.css), so every placeholder on a surface runs against the one document
// timeline and moves in phase — one object catching the light, not a dozen bars
// blinking out of step. Second, the shapes are real: `text` lays down ragged
// lines with a shorter last one the way a paragraph actually ends, `circle` is
// a true circle for an avatar, `block` takes any size for a thumbnail or a
// card. Third, reduced motion is a designed path, not a fallback: the global
// guard collapses the sweep to a single frame parked off-screen, so the block
// becomes a calm static tint that still reserves the exact space — the still
// version of the same idea, not a broken one.
//
// A skeleton is decorative to a screen reader — the real content it stands in
// for is what matters — so each placeholder is aria-hidden. The `SkeletonSwap`
// helper wraps the honest side of it: mark the region `aria-busy` while it
// holds the skeleton, and announce politely when the content takes its place.

/** block: an arbitrary rectangle (thumbnail, card, button). text: a stack of
 *  ragged lines. circle: a true circle (avatar, icon slot). */
export type SkeletonVariant = 'block' | 'text' | 'circle'

const BASE = 'relative overflow-hidden bg-white/[0.06]'
// The moving highlight. Kept subtle — a placeholder should read as quiet, not
// as a light show. Applied by name so the reduced-motion guard can still it.
const SWEEP_STYLE: CSSProperties = {
  background:
    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
  animation: 'skeleton-sweep 1.6s ease-in-out infinite',
}

function Sweep() {
  return <span aria-hidden className="pointer-events-none absolute inset-0" style={SWEEP_STYLE} />
}

/**
 * A loading placeholder that stands in for real content at its real size, so
 * the layout never jumps when the data lands. Three shapes — `block`, `text`,
 * `circle` — all lit by one shared sweep so a whole surface reads as a single
 * object catching the light. Decorative by construction (`aria-hidden`); pair
 * it with {@link SkeletonSwap} for the honest, announced hand-off to content.
 * Under prefers-reduced-motion the sweep parks off-screen and the block stays a
 * calm static tint, still holding the exact space.
 */
export function Skeleton({
  variant = 'block',
  width,
  height,
  radius = 8,
  lines = 3,
  lastLineWidth = '55%',
  className = '',
  style,
}: {
  variant?: SkeletonVariant
  /** block/circle: any CSS width. Ignored by text (lines fill their column). */
  width?: number | string
  /** block: any CSS height. circle: the diameter (defaults to `width`). */
  height?: number | string
  /** block corner radius in px. text uses a pill; circle is fully round. */
  radius?: number
  /** text: how many lines to lay down. */
  lines?: number
  /** text: width of the final, ragged line. */
  lastLineWidth?: number | string
  className?: string
  style?: CSSProperties
}) {
  if (variant === 'text') {
    return (
      <div className={`flex flex-col gap-2.5 ${className}`} style={style} aria-hidden>
        {Array.from({ length: Math.max(1, lines) }).map((_, i) => {
          const last = i === lines - 1 && lines > 1
          return (
            <span
              key={i}
              className={`${BASE} block h-[0.7em] rounded-full`}
              style={{ width: last ? lastLineWidth : '100%' }}
            >
              <Sweep />
            </span>
          )
        })}
      </div>
    )
  }

  if (variant === 'circle') {
    const size = width ?? height ?? 44
    return (
      <span
        className={`${BASE} inline-block rounded-full ${className}`}
        style={{ width: size, height: height ?? size, ...style }}
        aria-hidden
      >
        <Sweep />
      </span>
    )
  }

  return (
    <span
      className={`${BASE} block ${className}`}
      style={{ width: width ?? '100%', height: height ?? 16, borderRadius: radius, ...style }}
      aria-hidden
    >
      <Sweep />
    </span>
  )
}

/**
 * The honest hand-off. Holds `skeleton` while `loading` is true, then swaps to
 * `children` — marking the region `aria-busy` during the wait and announcing
 * politely once the content arrives, so assistive tech is told the truth about
 * timing that the visual sweep only implies. The loaded content fades and lifts
 * in (a short, once transition); under prefers-reduced-motion it simply
 * appears. Keep the skeleton's footprint close to the content's so nothing
 * jumps at the swap.
 */
export function SkeletonSwap({
  loading,
  skeleton,
  children,
  className = '',
  busyLabel = 'Loading',
  readyLabel = 'Loaded',
}: {
  loading: boolean
  skeleton: ReactNode
  children: ReactNode
  className?: string
  /** Announced (politely) while the skeleton is shown. */
  busyLabel?: string
  /** Announced (politely) the moment the content takes over. */
  readyLabel?: string
}) {
  const reduce = useReducedMotion()
  // Announce the transition to loaded only after it has actually happened, and
  // never on first mount if the content was ready from the start (nothing was
  // ever loading, so there is nothing to announce).
  const wasLoading = useRef(loading)
  const [justLoaded, setJustLoaded] = useState(false)
  useEffect(() => {
    if (wasLoading.current && !loading) setJustLoaded(true)
    wasLoading.current = loading
  }, [loading])

  return (
    <div className={`relative ${className}`} aria-busy={loading || undefined}>
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? busyLabel : justLoaded ? readyLabel : ''}
      </span>
      {loading ? (
        <div aria-hidden>{skeleton}</div>
      ) : (
        <div
          style={
            reduce
              ? undefined
              : { animation: 'skeleton-fade-in 0.4s cubic-bezier(0.16,1,0.3,1) both' }
          }
        >
          {children}
        </div>
      )}
    </div>
  )
}
