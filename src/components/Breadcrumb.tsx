import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
}

// Small breadcrumb trail for the sub-pages. The last crumb is the current page
// and renders as plain (non-link) text.
export function Breadcrumb({ trail, className = '' }: { trail: ReadonlyArray<Crumb>; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-white/40">
        {trail.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.to ? (
              <Link to={c.to} className="transition-colors hover:text-white">
                {c.label}
              </Link>
            ) : (
              <span className="text-white/70">{c.label}</span>
            )}
            {i < trail.length - 1 && (
              <span aria-hidden className="text-white/25">
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
