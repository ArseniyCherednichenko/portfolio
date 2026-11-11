import { useEffect } from 'react'

// Per-route document head. Every page shared one static <title> before this;
// now each view sets an honest, distinct title + description, keeps the Open
// Graph / Twitter tags in sync, and points the canonical <link> at the clean
// URL for the route. Renders nothing.

const SITE_NAME = 'Arseniy Cherednichenko'
const DEFAULT_TITLE = 'Arseniy Cherednichenko — Builder, co-founder of Guided'
const DEFAULT_DESC =
  'Builder and co-founder of Guided, based in Berlin. Interface engineering, motion design, and product craft.'

type SeoProps = {
  /** Page-specific title; the site name is appended automatically. */
  title?: string
  description?: string
}

// Find an existing meta tag or create it, then set its content.
function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

// Point the canonical <link> at the clean URL for the current route — origin +
// pathname, with the query string and hash dropped. This is the honest canonical
// for a single-page app: a page like /studio can carry its whole state in the
// query (?seed=…), and without this every seed variant looks to a crawler like a
// separate page competing with the base route. The origin is read live from the
// document, exactly as StructuredData resolves it, so it stays correct on
// whatever host the site deploys to rather than hard-coding a domain the site
// deliberately never pins. The social og:url keeps the full href so a shared
// seed link still previews that exact poster.
function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function apply(title: string, description: string) {
  document.title = title
  setMeta('name', 'description', description)
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', window.location.href)
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setCanonical(window.location.origin + window.location.pathname)
}

export function Seo({ title, description }: SeoProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE
  const desc = description ?? DEFAULT_DESC

  useEffect(() => {
    apply(fullTitle, desc)
    return () => apply(DEFAULT_TITLE, DEFAULT_DESC)
  }, [fullTitle, desc])

  return null
}
