import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCommandPalette } from './CommandPalette'
import { useContact } from './ContactDialog'
import { usePreferences } from './Preferences'
import { MobileMenu } from './MobileMenu'
import { NavMenu } from './NavMenu'
import { Tooltip } from './Tooltip'

// Floating translucent nav. Work, About, and Playground are real page links.
const PAGES: ReadonlyArray<readonly [string, string]> = [
  ['Work', '/work'],
  ['About', '/about'],
  ['Toolkit', '/toolkit'],
  ['Playground', '/playground'],
]

export function Nav() {
  const { open } = useCommandPalette()
  const { open: openContact } = useContact()
  const { open: openPrefs } = usePreferences()
  // Show the platform-correct modifier glyph in the search hint.
  const [mod, setMod] = useState('Ctrl')
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod('⌘')
  }, [])

  return (
    <nav className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(94%,820px)] items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl">
      <Tooltip content="Back to home" placement="bottom">
        <Link
          to="/"
          aria-label="Arseniy Cherednichenko — home"
          className="text-lg font-bold tracking-tight"
        >
          AC
        </Link>
      </Tooltip>
      <div className="hidden items-center gap-6 sm:flex">
        {PAGES.map(([label, to]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `text-sm transition-colors hover:text-white ${isActive ? 'text-[#DCF87C]' : 'text-white/60'}`
            }
          >
            {label}
          </NavLink>
        ))}
        <NavMenu />
      </div>
      <div className="flex items-center gap-2">
        <Tooltip content={`Search & jump anywhere · ${mod} K`} placement="bottom">
          <button
            type="button"
            onClick={open}
            aria-label="Open command palette"
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white/80 sm:flex"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" />
            </svg>
            <kbd className="hidden font-sans text-xs tracking-wide sm:inline">{mod} K</kbd>
          </button>
        </Tooltip>
        <Tooltip content="Preferences — tune the motion" placement="bottom">
          <button
            type="button"
            onClick={openPrefs}
            aria-label="Open preferences"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition hover:border-white/20 hover:text-white/80 sm:flex"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <circle cx="9" cy="6" r="2.4" fill="#0A0A0A" />
              <line x1="4" y1="14" x2="20" y2="14" />
              <circle cx="15" cy="14" r="2.4" fill="#0A0A0A" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip content="Email, GitHub, and more" placement="bottom">
          <button
            type="button"
            onClick={openContact}
            className="rounded-full bg-[#DCF87C] px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-105"
          >
            Get in touch
          </button>
        </Tooltip>
        <MobileMenu />
      </div>
    </nav>
  )
}
