import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCommandPalette } from './CommandPalette'
import { useContact } from './ContactDialog'

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
  // Show the platform-correct modifier glyph in the search hint.
  const [mod, setMod] = useState('Ctrl')
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod('⌘')
  }, [])

  return (
    <nav className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(92%,760px)] items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl">
      <Link to="/" className="text-lg font-bold tracking-tight">
        AC
      </Link>
      <div className="hidden gap-7 sm:flex">
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
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={open}
          aria-label="Open command palette"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white/80"
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
        <button
          type="button"
          onClick={openContact}
          className="rounded-full bg-[#DCF87C] px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-105"
        >
          Get in touch
        </button>
      </div>
    </nav>
  )
}
