import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Seo } from '../components/Seo'
import { Aurora } from '../components/Aurora'
import { Beams } from '../components/Beams'
import { Threads } from '../components/Threads'
import { Lightning } from '../components/Lightning'
import { Iridescence } from '../components/Iridescence'
import { Particles } from '../components/Particles'
import { MeshGradient } from '../components/MeshGradient'
import { Squares } from '../components/Squares'
import { Orb } from '../components/Orb'
import { Meteors } from '../components/Meteors'
import { GradientText } from '../components/GradientText'
import { MagneticButton } from '../components/MagneticButton'
import { REEL, type ReelBackdrop, type ReelScene } from '../data/reel'

const EASE = [0.16, 1, 0.3, 1] as const

// Each backdrop is a real hand-built component, mounted full-bleed for its scene
// and only while that scene is on or next to the screen (see `live` below), so
// at most a couple of canvases ever run at once. A soft radial mask and a floor
// gradient keep every backdrop legible under the centred copy.
function Backdrop({ kind }: { kind: ReelBackdrop }) {
  switch (kind) {
    case 'aurora':
      return <Aurora scoped />
    case 'mesh':
      // MeshGradient fills its parent; strip the rounding for a full-bleed scene.
      return <MeshGradient rounded={false} className="absolute inset-0 h-full w-full" />
    case 'beams':
      return <Beams className="absolute inset-0" count={20} />
    case 'threads':
      return <Threads className="absolute inset-0" count={18} amplitude={16} />
    case 'lightning':
      return <Lightning className="absolute inset-0" count={6} />
    case 'iridescence':
      return <Iridescence className="absolute inset-0" />
    case 'particles':
      return <Particles className="absolute inset-0" />
    case 'squares':
      return <Squares className="absolute inset-0" />
    case 'meteors':
      return (
        <div className="absolute inset-0">
          <Meteors count={26} />
        </div>
      )
    case 'orb':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Orb size={320} className="opacity-90" />
        </div>
      )
    default:
      return null
  }
}

function Scene({
  scene,
  index,
  total,
  live,
  registerRef,
}: {
  scene: ReelScene
  index: number
  total: number
  live: boolean
  registerRef: (el: HTMLElement | null) => void
}) {
  const reduce = useReducedMotion()
  const num = String(index + 1).padStart(2, '0')
  const totalStr = String(total).padStart(2, '0')

  return (
    <section
      id={`scene-${scene.id}`}
      ref={registerRef}
      data-scene={index}
      className="reel-scene relative flex min-h-[100svh] w-full snap-start items-center justify-center overflow-hidden"
    >
      {/* Live backdrop, mounted only near the viewport. A quiet placeholder tint
          holds the frame otherwise so nothing flashes on the way in. */}
      <div className="absolute inset-0 -z-10 bg-[#0A0A0A]">
        {live ? <Backdrop kind={scene.backdrop} /> : null}
      </div>
      {/* Legibility floor: darkened top/bottom so centred copy always holds. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.72)_0%,rgba(10,10,10,0.28)_38%,rgba(10,10,10,0.35)_62%,rgba(10,10,10,0.82)_100%)]"
      />

      <div className="relative mx-auto w-full max-w-3xl px-6 text-center">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.6 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="font-mono text-xs uppercase tracking-[0.42em] text-[#DCF87C]"
        >
          {scene.eyebrow}
        </motion.p>

        <motion.h2
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.6 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
          className="mx-auto mt-6 max-w-[16ch] font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl"
        >
          {scene.statement}
        </motion.h2>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.6 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
          className="mx-auto mt-6 max-w-[52ch] text-base leading-relaxed text-white/70 sm:text-lg"
        >
          {scene.note}
        </motion.p>
      </div>

      {/* Corner metadata: scene number and the honest name of what's on show. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-8 sm:px-10">
        <span className="font-mono text-xs tracking-[0.3em] text-white/45">
          {num} <span className="text-white/25">/ {totalStr}</span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
          {scene.made}
        </span>
      </div>
    </section>
  )
}

// The /reel page: "The reel" — an art-directed run of full-screen scenes, each a
// real backdrop component paired with one line of how I think about making
// things. Deliberately not the Playground (a lab with controls): this is a
// designed sequence, a showreel and a small manifesto, that centres the point of
// view rather than any one project. Snap-scrolls between scenes, arrow-key and
// dot navigable, and mounts each heavy backdrop only near the viewport.
export default function Reel() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const total = REEL.length
  const [active, setActive] = useState(0)
  const sceneRefs = useRef<(HTMLElement | null)[]>([])

  // Track the scene whose middle is nearest the viewport centre — exactly one is
  // "active" at a time, driving the rail, the counter, and which backdrops live.
  useEffect(() => {
    const els = sceneRefs.current.filter(Boolean) as HTMLElement[]
    if (els.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.scene)
            if (!Number.isNaN(idx)) setActive(idx)
          }
        })
      },
      // A thin band across the viewport centre: a scene flips active as its
      // middle crosses the midline, so the reading state matches what you see.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Proximity scroll-snap, scoped to this page and skipped under reduced motion
  // so it never fights an intentional slow scroll. Restored on unmount.
  useEffect(() => {
    if (reduce) return
    const root = document.documentElement
    const prev = root.style.scrollSnapType
    root.style.scrollSnapType = 'y proximity'
    return () => {
      root.style.scrollSnapType = prev
    }
  }, [reduce])

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(REEL.length - 1, idx))
    const el = sceneRefs.current[clamped]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Keyboard: step through scenes without touching the wheel. Ignored while the
  // focus is in a field so the site's other shortcuts still behave.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
        case 'j':
          e.preventDefault()
          goTo(active + 1)
          break
        case 'ArrowUp':
        case 'PageUp':
        case 'k':
          e.preventDefault()
          goTo(active - 1)
          break
        case 'Home':
          e.preventDefault()
          goTo(0)
          break
        case 'End':
          e.preventDefault()
          goTo(REEL.length - 1)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, goTo])

  return (
    <>
      <Seo
        title="The reel"
        description="A hand-built showreel — nine full-screen scenes, each a live motion component paired with how Arseniy Cherednichenko thinks about craft. Not a client pitch: a point of view."
      />

      {/* Fixed progress rail (pointer + keyboard). Hidden on small screens where
          the corner counter carries the same information. */}
      <nav
        aria-label="Reel scenes"
        className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
      >
        {REEL.map((scene, i) => {
          const on = i === active
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Scene ${i + 1}: ${scene.eyebrow}`}
              aria-current={on ? 'true' : undefined}
              className="group relative flex items-center"
            >
              <span
                className={`block h-2 w-2 rounded-full transition-all duration-300 ${
                  on ? 'scale-125 bg-[#DCF87C]' : 'bg-white/25 group-hover:bg-white/60'
                }`}
              />
              <span
                className={`pointer-events-none absolute right-6 whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] backdrop-blur transition-opacity duration-200 ${
                  on ? 'text-[#DCF87C]' : 'text-white/70'
                } opacity-0 group-hover:opacity-100`}
              >
                {scene.eyebrow}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Live scene counter, top-left, under the nav. */}
      <div className="pointer-events-none fixed left-5 top-24 z-30 hidden font-mono text-xs tracking-[0.3em] text-white/45 sm:block">
        <span className="text-[#DCF87C]">{String(active + 1).padStart(2, '0')}</span>
        <span className="text-white/25"> / {String(total).padStart(2, '0')}</span>
      </div>

      <div className="relative">
        {REEL.map((scene, i) => (
          <Scene
            key={scene.id}
            scene={scene}
            index={i}
            total={total}
            // Mount a backdrop only while its scene is on or beside the screen.
            live={Math.abs(i - active) <= 1}
            registerRef={(el) => {
              sceneRefs.current[i] = el
            }}
          />
        ))}

        {/* Closing hand-off: the reel ends by pointing back at the real work and
            the lab, so it leads somewhere instead of just stopping. */}
        <section className="relative flex min-h-[70svh] snap-start flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.42em] text-[#DCF87C]">Fin</p>
          <h2 className="mx-auto mt-6 max-w-[18ch] font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            <GradientText>That is the taste. Here is the work.</GradientText>
          </h2>
          <p className="mx-auto mt-6 max-w-[48ch] text-base leading-relaxed text-white/65">
            Every scene you just scrolled is a component that runs somewhere on this
            site. See where they live, or open the lab and pull them apart.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <MagneticButton
              onClick={() => navigate('/work')}
              className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white"
            >
              See the work
            </MagneticButton>
            <MagneticButton
              onClick={() => navigate('/playground')}
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition-colors hover:border-white/40 hover:text-white"
            >
              Open the playground
            </MagneticButton>
          </div>
        </section>
      </div>
    </>
  )
}
