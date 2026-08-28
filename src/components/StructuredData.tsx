import { useEffect } from 'react'
import { GITHUB_URL } from '../data/contact'

// Machine-readable identity for the site — a single JSON-LD <script> that tells
// search engines and social crawlers who this is, in schema.org's vocabulary.
// The page already carries human-readable Open Graph tags (in index.html + the
// per-route Seo component); this is the structured counterpart, so a Person and
// the WebSite that presents them are legible to Google's knowledge graph and the
// like. Renders nothing.
//
// Honesty rules apply here as everywhere: only real, verifiable facts. No
// invented socials (GitHub is the one real profile), no fabricated employer
// beyond Guided, no claimed affiliations. The site URL is resolved from the live
// origin at runtime, so it stays correct on whatever host this deploys to —
// matching the relative-URL approach the Open Graph image already takes.

const NAME = 'Arseniy Cherednichenko'

function buildGraph(origin: string) {
  const personId = `${origin}/#person`
  const siteId = `${origin}/#website`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: NAME,
        url: origin,
        // How he actually describes the work — builder and co-founder, not a
        // borrowed title. Kept broad so Guided is one facet, not the whole.
        jobTitle: 'Software engineer and co-founder',
        description:
          'Builder and co-founder of Guided, based in Berlin. Interface engineering, motion design, and product craft.',
        worksFor: {
          '@type': 'Organization',
          name: 'Guided',
          description: 'A Socratic AI tutor.',
        },
        homeLocation: {
          '@type': 'Place',
          name: 'Berlin, Germany',
        },
        knowsAbout: [
          'Interface engineering',
          'Motion design',
          'React',
          'TypeScript',
          'SwiftUI',
          'Applied AI',
          'Product design',
        ],
        // Real profiles only.
        sameAs: [GITHUB_URL],
      },
      {
        '@type': 'WebSite',
        '@id': siteId,
        url: origin,
        name: NAME,
        description:
          'The personal portfolio of Arseniy Cherednichenko — interface engineering, motion design, and product craft, built in the open.',
        inLanguage: 'en',
        author: { '@id': personId },
        creator: { '@id': personId },
      },
    ],
  }
}

export function StructuredData() {
  useEffect(() => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://arseniy.dev'
    const id = 'ld-json-identity'
    let el = document.getElementById(id) as HTMLScriptElement | null
    if (!el) {
      el = document.createElement('script')
      el.type = 'application/ld+json'
      el.id = id
      document.head.appendChild(el)
    }
    el.textContent = JSON.stringify(buildGraph(origin))
    // Left in the head for crawlers; no cleanup so a client-side route change
    // never briefly drops it.
  }, [])

  return null
}
