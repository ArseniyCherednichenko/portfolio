import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GradientText } from './GradientText'
import { MagneticButton } from './MagneticButton'
import { useContact } from './ContactDialog'
import { useShortcuts } from './Keyboard'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { EMAIL, GITHUB_URL } from '../data/contact'
import { COMPONENT_COUNT } from '../data/stats'

// A link column in the footer's navigation grid. Grouped by intent — the
// making, the words, and the site's own meta — instead of one run-on line, so
// the footer reads as a map of the site rather than a wall of text.
interface FooterGroup {
  title: string
  links: { to: string; label: string }[]
}

const GROUPS: FooterGroup[] = [
  {
    title: 'The making',
    links: [
      { to: '/work', label: 'Work' },
      { to: '/playground', label: 'Playground' },
      { to: '/library', label: 'The library' },
      { to: '/toolkit', label: 'Toolkit' },
      { to: '/about', label: 'About' },
      { to: '/now', label: 'Now' },
    ],
  },
  {
    title: 'In words',
    links: [
      { to: '/writing', label: 'Writing' },
      { to: '/answers', label: 'Answers' },
      { to: '/craft', label: 'On motion' },
      { to: '/design', label: 'Design language' },
      { to: '/resume', label: 'Résumé' },
    ],
  },
  {
    title: 'This site',
    links: [
      { to: '/colophon', label: 'Colophon' },
      { to: '/changelog', label: 'Changelog' },
      { to: '/terminal', label: 'Terminal' },
      { to: '/contents', label: 'Index' },
      { to: '/contact', label: 'Contact' },
    ],
  },
]

// Global footer. Present on every page via Layout, so it doubles as the site's
// closing statement: a genuine invitation to get in touch, a grouped map of
// everywhere you can go, a live sense of where and when the site is made, and
// the quiet keyboard-driven hint. Real channels only — email and GitHub — no
// invented socials. Guided is not mentioned here; the footer is about the site
// and its maker, not a single project.
export function SiteFooter() {
  const { open } = useContact()
  const { openShortcuts } = useShortcuts()
  const { time, awake } = useBerlinTime()
  const reduce = useReducedMotion()
  const year = new Date().getFullYear()

  return (
    <footer className="relative mt-24 border-t border-white/10">
      {/* A soft lime bloom seated on the top edge — the same accent that runs
          through the site, sweeping once so the seam feels lit, not drawn. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px overflow-hidden">
        <motion.div
          className="h-px w-1/3 bg-[linear-gradient(90deg,transparent,#DCF87C,transparent)]"
          initial={reduce ? { opacity: 0.5, x: '100%' } : { x: '-120%' }}
          animate={reduce ? { opacity: 0.5, x: '100%' } : { x: ['-120%', '360%'] }}
          transition={reduce ? undefined : { duration: 9, ease: 'easeInOut', repeat: Infinity, repeatDelay: 3 }}
        />
      </div>

      <div className="mx-auto w-full max-w-5xl px-6">
        {/* CTA — the closing invitation. Honest: an open door, not a claim. */}
        <div className="flex flex-col gap-8 py-16 md:flex-row md:items-end md:justify-between">
          <div className="max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Have something in mind</p>
            <h2 className="font-display mt-4 text-3xl leading-[1.05] tracking-tight text-white sm:text-4xl">
              Let&rsquo;s make it <GradientText>worth the craft.</GradientText>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              A build, a collaboration, or just a good question about how something here is made — the door is open.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MagneticButton
              onClick={open}
              className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black"
            >
              Get in touch
            </MagneticButton>
            <a
              href={`mailto:${EMAIL}`}
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Email
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Navigation map — grouped, so the footer is a route index, not prose. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 border-t border-white/10 py-14 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="font-display text-lg tracking-tight text-white transition-colors hover:text-[#DCF87C]">
              Arseniy Cherednichenko
            </Link>
            <p className="mt-3 max-w-[24ch] text-sm leading-relaxed text-white/45">
              Co-founder of Guided. Building for the web in Berlin, one hand-made component at a time.
            </p>
          </div>
          {GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">{group.title}</p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <FooterLink to={link.to} label={link.label} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Meta row — a live sense of place and time, the making note, and the
            quiet keyboard hint. The clock ticks, so the footer is never stale. */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-8 text-sm text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/25'}`}
              />
              Berlin
            </span>
            <span aria-hidden className="text-white/20">·</span>
            <span className="tabular-nums text-white/50">{time}</span>
            <span aria-hidden className="text-white/20">·</span>
            <span>{awake ? 'likely awake' : 'probably asleep'}</span>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Built by hand · {COMPONENT_COUNT}+ components · {year}
            </span>
            <span aria-hidden className="hidden text-white/20 sm:inline">·</span>
            <button
              type="button"
              onClick={openShortcuts}
              className="hidden items-center gap-1.5 transition-colors hover:text-white/70 sm:inline-flex"
            >
              Press
              <kbd className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[11px] font-medium text-white/50">
                ?
              </kbd>
              for shortcuts
            </button>
          </p>
        </div>
      </div>
    </footer>
  )
}

// A single footer link with a lime hover and a hairline that draws in from the
// left — small, but it makes the map feel responsive under the cursor.
function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
    >
      <span className="h-px w-0 bg-[#DCF87C] transition-all duration-300 group-hover:w-4" aria-hidden />
      {label}
    </Link>
  )
}
