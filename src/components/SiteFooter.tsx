import { motion, useReducedMotion } from 'framer-motion'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GradientText } from './GradientText'
import { MagneticButton } from './MagneticButton'
import { Popover } from './Popover'
import { Signature } from './Signature'
import { useContact } from './ContactDialog'
import { useShortcuts } from './Keyboard'
import { useToast } from './Toast'
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
      { to: '/range', label: 'The range' },
      { to: '/playground', label: 'Playground' },
      { to: '/reel', label: 'The reel' },
      { to: '/library', label: 'The library' },
      { to: '/toolkit', label: 'Toolkit' },
      { to: '/about', label: 'About' },
      { to: '/now', label: 'Now' },
      { to: '/uses', label: 'Uses' },
    ],
  },
  {
    title: 'In words',
    links: [
      { to: '/principles', label: 'Principles' },
      { to: '/writing', label: 'Writing' },
      { to: '/answers', label: 'Answers' },
      { to: '/craft', label: 'On motion' },
      { to: '/taste', label: 'Taste' },
      { to: '/design', label: 'Design language' },
      { to: '/specimen', label: 'Type specimen' },
      { to: '/resume', label: 'Résumé' },
      { to: '/bio', label: 'Bio' },
    ],
  },
  {
    title: 'This site',
    links: [
      { to: '/colophon', label: 'Colophon' },
      { to: '/changelog', label: 'Changelog' },
      { to: '/terminal', label: 'Terminal' },
      { to: '/atlas', label: 'Atlas' },
      { to: '/wander', label: 'Wander' },
      { to: '/numbers', label: 'By the numbers' },
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
            <SharePopover />
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
            {/* The name, signed — the site's personal mark, drawn by the pen as
                it scrolls into the footer. Hover to see it written again. */}
            <Signature height={58} className="mt-6 -ml-1 text-white/80" />
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

// One action row inside the share popover — a labelled control with a small
// mark, a hover wash, and a lime hairline that draws in from the left.
function ShareAction({
  onClick,
  href,
  icon,
  label,
  hint,
}: {
  onClick?: () => void
  href?: string
  icon: ReactNode
  label: string
  hint: string
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 transition-colors group-hover/act:border-[#DCF87C]/40 group-hover/act:text-[#DCF87C]"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white/85">{label}</span>
        <span className="block truncate text-xs text-white/40">{hint}</span>
      </span>
    </>
  )
  const cls =
    'group/act flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.05] focus-visible:outline-none'
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={onClick}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

// The footer's "Share" affordance — a click-popover of real, useful actions for
// the page you are on: copy its link, mail it, or open the source. Deliberately
// distinct from the "Get in touch" dialog (which is about reaching Arseniy);
// this is about passing the page along. Honest channels only.
function SharePopover() {
  const { toast } = useToast()

  const pageUrl = () => (typeof window === 'undefined' ? '' : window.location.href)

  const copyLink = (close: () => void) => {
    const url = pageUrl()
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast('Link copied to clipboard', { tone: 'success' }))
      .catch(() => toast('Could not copy — long-press the address bar instead', { tone: 'error' }))
    close()
  }

  const mailHref = () => {
    const url = pageUrl()
    const subject = encodeURIComponent('From Arseniy Cherednichenko’s portfolio')
    const body = encodeURIComponent(`Thought you might like this page:\n${url}\n`)
    return `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <Popover
      placement="top"
      label="Share this page"
      panelClassName="w-[17rem] p-2.5"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
        >
          <ShareGlyph />
          Share
        </button>
      }
    >
      {(close) => (
        <div>
          <p className="px-2.5 pb-2 pt-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/35">
            Share this page
          </p>
          <ShareAction
            onClick={() => copyLink(close)}
            icon={<LinkGlyph />}
            label="Copy link"
            hint="This page, to your clipboard"
          />
          <ShareAction
            onClick={close}
            href={mailHref()}
            icon={<MailGlyph />}
            label="Email a link"
            hint="Open a message with the URL"
          />
          <ShareAction
            onClick={close}
            href={GITHUB_URL}
            icon={<CodeGlyph />}
            label="View the source"
            hint="github.com/ArseniyCherednichenko"
          />
        </div>
      )}
    </Popover>
  )
}

// Small, crisp line marks for the share actions — no emoji, matching the site's
// restrained iconography (currentColor, 1.6 stroke).
function ShareGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
    </svg>
  )
}
function LinkGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  )
}
function MailGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}
function CodeGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 6l-3 12" />
    </svg>
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
