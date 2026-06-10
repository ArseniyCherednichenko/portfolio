import { motion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { Breadcrumb } from '../components/Breadcrumb'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useMeta } from '../hooks/useMeta'

const EASE = [0.16, 1, 0.3, 1] as const

interface UseGroup {
  group: string
  items: ReadonlyArray<readonly [string, string]>
}

export default function Uses() {
  useDocumentTitle('Uses — Arseniy Cherednichenko')
  useMeta('The tools Arseniy Cherednichenko builds with: TypeScript, SwiftUI, Tailwind, Framer Motion, and Supabase.')
  return (
    <article id="main" tabIndex={-1} className="outline-none">
      <header className="mx-auto w-full max-w-4xl px-6 pb-12 pt-36 sm:pt-44">
        <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Uses' }]} />
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-8 text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl"
        >
          What I <GradientText>build with</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          The tools I reach for most. Kept honest and current, not aspirational.
        </motion.p>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 pb-28">
        <div className="grid gap-10 sm:grid-cols-2">
          {USES.map((g, gi) => (
            <Reveal key={g.group} delay={gi * 0.04}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{g.group}</h2>
                <dl className="mt-5 grid gap-4">
                  {g.items.map(([name, note]) => (
                    <div key={name} className="flex flex-col gap-0.5">
                      <dt className="font-semibold text-white/85">{name}</dt>
                      <dd className="text-sm leading-relaxed text-white/50">{note}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </article>
  )
}

const USES: UseGroup[] = [
  {
    group: 'Languages',
    items: [
      ['TypeScript', 'My default. Strict mode, always.'],
      ['Swift', 'For native iOS with SwiftUI.'],
    ],
  },
  {
    group: 'Frameworks',
    items: [
      ['React', 'The web UI I build most things in.'],
      ['SwiftUI', 'Declarative native iOS.'],
      ['Vite', 'Fast dev server and builds.'],
    ],
  },
  {
    group: 'Design and motion',
    items: [
      ['Tailwind CSS', 'Utility-first styling, v4.'],
      ['Framer Motion', 'The animations across this site.'],
      ['GSAP', 'When motion gets more advanced.'],
      ['Figma', 'Design and quick prototyping.'],
    ],
  },
  {
    group: 'Backend and AI',
    items: [
      ['Supabase', 'Auth, Postgres, and storage.'],
      ['Claude', 'My pair-programmer and the AI in Guided.'],
      ['Node', 'Tooling and scripts.'],
    ],
  },
  {
    group: 'Setup',
    items: [
      ['VS Code', 'Where most of the work happens.'],
      ['Berlin', 'Home base and time zone.'],
    ],
  },
]
