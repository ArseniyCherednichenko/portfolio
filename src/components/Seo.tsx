import { useEffect } from 'react'

// Per-route document head. Every page shared one static <title> before this;
// now each view sets an honest, distinct title + description and keeps the
// Open Graph / Twitter tags in sync. Renders nothing.

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

function apply(title: string, description: string) {
  document.title = title
  setMeta('name', 'description', description)
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', window.location.href)
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
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
