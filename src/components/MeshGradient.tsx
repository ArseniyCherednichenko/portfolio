import { useRef, type PointerEvent, type ReactNode } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion'

// MeshGradient — a living field of soft colour. A handful of large, blurred
// radial blobs sit at fixed anchors and idle-drift on their own slow loops, so
// the field is never still; on top of that the whole mesh leans toward the
// pointer, each blob parallaxing by its own depth so the colour seems to gather
// under the cursor. Distinct from its neighbours in the pointer-fields band:
// Aurora is a fixed ambient drift with no pointer, Iridescence is an oil-slick
// sheen, Beams are hard light shafts — this is a warm, liquid wash you steer.
//
// It is a backdrop, not a foreground: it renders its children above the mesh so
// a section can sit a headline straight on top of it. Everything is layered
// CSS gradients moved by transforms (no canvas, no per-frame React state), so it
// stays cheap. Under reduced motion the blobs hold their anchor positions and
// the pointer lean is disabled — a balanced, legible static mesh.

interface Blob {
  /** Anchor position as a percentage of the box. */
  x: number
  y: number
  /** Blob diameter as a percentage of the larger box edge. */
  size: number
  /** rgb tri:  the blob's colour. */
  color: string
  /** Peak opacity at the blob's centre. */
  alpha: number
  /** Parallax depth — how far this blob leans toward the pointer (px at full pull). */
  depth: number
  /** Idle-drift travel in px and its loop duration in seconds. */
  drift: number
  duration: number
}

// A palette anchored on the site's lime, warmed with emerald and cooled with a
// sky and a violet so the mesh reads as colour, not a single tint. Depths are
// staggered so the blobs separate into layers as the pointer moves.
const BLOBS: Blob[] = [
  { x: 22, y: 28, size: 62, color: '220, 248, 124', alpha: 0.5, depth: 46, drift: 26, duration: 19 },
  { x: 78, y: 24, size: 54, color: '52, 211, 153', alpha: 0.38, depth: 30, drift: 22, duration: 23 },
  { x: 68, y: 74, size: 66, color: '56, 189, 248', alpha: 0.3, depth: 60, drift: 30, duration: 27 },
  { x: 30, y: 78, size: 50, color: '167, 139, 250', alpha: 0.3, depth: 22, drift: 20, duration: 31 },
  { x: 50, y: 50, size: 46, color: '220, 248, 124', alpha: 0.26, depth: 38, drift: 16, duration: 21 },
]

const EASE = [0.16, 1, 0.3, 1] as const

function MeshBlob({
  blob,
  px,
  py,
  still,
}: {
  blob: Blob
  px: MotionValue<number>
  py: MotionValue<number>
  still: boolean
}) {
  // Lean toward the pointer: px/py run -1..1 across the box, scaled by this
  // blob's depth so near blobs travel further than far ones (parallax).
  const leanX = useTransform(px, (v) => v * blob.depth)
  const leanY = useTransform(py, (v) => v * blob.depth)
  // Warm slightly as the pointer nears the box centre-of-pull.
  const glow = useTransform([px, py] as const, ([x, y]: number[]) => {
    const d = Math.min(1, Math.hypot(x, y))
    return blob.alpha * (1 + d * 0.35)
  })

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${blob.x}%`,
        top: `${blob.y}%`,
        width: `${blob.size}%`,
        height: `${blob.size}%`,
        x: still ? 0 : leanX,
        y: still ? 0 : leanY,
        opacity: still ? blob.alpha : glow,
        marginLeft: `-${blob.size / 2}%`,
        marginTop: `-${blob.size / 2}%`,
        background: `radial-gradient(closest-side, rgba(${blob.color}, 1), rgba(${blob.color}, 0))`,
        filter: 'blur(56px)',
      }}
      animate={
        still
          ? undefined
          : {
              // A small, organic idle wander layered under the pointer lean.
              translateX: [0, blob.drift, -blob.drift * 0.6, 0],
              translateY: [0, -blob.drift * 0.7, blob.drift, 0],
            }
      }
      transition={
        still
          ? undefined
          : { duration: blob.duration, repeat: Infinity, ease: 'easeInOut' }
      }
    />
  )
}

export interface MeshGradientProps {
  /** Content laid over the mesh (sits above the colour). */
  children?: ReactNode
  /** Extra classes for the outer box — set the height/radius here. */
  className?: string
  /** Rounded corners on the colour layer. Default true. */
  rounded?: boolean
}

export function MeshGradient({ children, className = '', rounded = true }: MeshGradientProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)

  // Pointer position normalised to -1..1 across the box, spring-smoothed so the
  // lean glides rather than snaps.
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const px = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.6 })
  const py = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.6 })

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    rawX.set(((e.clientX - r.left) / r.width) * 2 - 1)
    rawY.set(((e.clientY - r.top) / r.height) * 2 - 1)
  }
  const onLeave = () => {
    rawX.set(0)
    rawY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`relative overflow-hidden ${className}`}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div aria-hidden className={`absolute inset-0 -z-0 bg-black ${rounded ? 'rounded-[inherit]' : ''}`}>
        <div className="absolute inset-0 overflow-hidden" style={rounded ? { borderRadius: 'inherit' } : undefined}>
          {BLOBS.map((blob, i) => (
            <MeshBlob key={i} blob={blob} px={px} py={py} still={!!reduce} />
          ))}
          {/* A fine top-lit vignette so the mesh grounds against the page. */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,transparent_40%,rgba(0,0,0,0.55))]" />
        </div>
      </div>
      {children != null && <div className="relative z-10">{children}</div>}
    </motion.div>
  )
}
