import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import type { Project } from '../data/projects'

// A deterministic, generative "poster" for a project: drifting colour fields,
// a faint grid, and the project's name set large. This is honest brand art,
// not a screenshot, so it never claims to show something that does not exist.
// The same slug always produces the same composition.

// Small, stable string hash so a slug maps to a repeatable seed.
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Seeded pseudo-random generator (mulberry32) for repeatable layouts.
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// On-brand palette: lime anchor plus a few tasteful companions on dark.
const TONES = ['#DCF87C', '#34D399', '#38BDF8', '#A78BFA', '#FB923C', '#F472B6']

interface Orb {
  tone: string
  size: number
  x: number
  y: number
  drift: { x: number[]; y: number[] }
  duration: number
}

function buildOrbs(slug: string): Orb[] {
  const random = rng(hash(slug))
  // Lime always leads so every poster stays in the family.
  const tones = [TONES[0]]
  const rest = TONES.slice(1).sort(() => random() - 0.5)
  tones.push(rest[0], rest[1])

  return tones.map((tone, i) => {
    const size = 42 + random() * 34
    const x = 12 + random() * 64
    const y = 8 + random() * 64
    const amp = 14 + random() * 16
    const dir = random() > 0.5 ? 1 : -1
    return {
      tone,
      size,
      x,
      y,
      drift: {
        x: [0, dir * amp, dir * -amp * 0.6, 0],
        y: [0, -amp * 0.7, amp, 0],
      },
      duration: 16 + i * 4 + random() * 8,
    }
  })
}

export function ProjectPoster({
  project,
  className = '',
  rounded = 'rounded-3xl',
}: {
  project: Project
  className?: string
  rounded?: string
}) {
  const reduce = useReducedMotion()
  const orbs = useMemo(() => buildOrbs(project.slug), [project.slug])

  return (
    <div
      aria-hidden
      className={`relative isolate overflow-hidden border border-white/10 bg-[#0B0B0B] ${rounded} ${className}`}
    >
      {/* Drifting colour fields. */}
      {orbs.map((orb, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full blur-2xl"
          style={{
            width: `${orb.size}%`,
            height: `${orb.size}%`,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            backgroundColor: orb.tone,
            opacity: 0.28,
          }}
          animate={reduce ? undefined : orb.drift}
          transition={
            reduce ? undefined : { duration: orb.duration, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      ))}

      {/* Faint grid for structure. */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '38px 38px',
          maskImage: 'radial-gradient(ellipse at center, #000 55%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 55%, transparent 100%)',
        }}
      />

      {/* Subtle dark vignette so type stays legible over the colour. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />

      {/* The name, set large. */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/55">
          {project.year}
          {project.role ? ` · ${project.role}` : ''}
        </p>
        <p className="mt-2 font-display text-3xl font-bold leading-[0.95] tracking-tight text-white sm:text-5xl">
          {project.title}
        </p>
      </div>
    </div>
  )
}
