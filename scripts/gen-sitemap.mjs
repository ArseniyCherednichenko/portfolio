// Generates dist/sitemap.xml after a build — and appends an absolute Sitemap:
// line to dist/robots.txt — but only when the deploy origin is actually known.
//
// The site deliberately never hard-codes its domain: the Open Graph image is a
// relative URL and StructuredData resolves the origin live at runtime, so the
// build stays correct on whatever host it lands on. A sitemap can't do that —
// the spec requires absolute <loc> URLs — so rather than bake in a guessed
// domain (worse than no sitemap), this reads the origin from the environment
// and, if none is set, writes nothing and leaves the permissive baseline
// robots.txt untouched. On Vercel, VERCEL_PROJECT_PRODUCTION_URL is set at build
// time; any host can also set SITE_URL explicitly.
//
// Zero dependencies, and bulletproof by design: it must never fail a deploy, so
// everything is wrapped and it always exits 0.
//
// Routes: the real, indexable pages. Keep this list in sync with the router
// (src/App.tsx) and the site index (src/data/contents.ts) — the same sync the
// command palette and the keyboard go-chords already keep by hand.

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')

// Static top-level pages (no dynamic segments, no 404 catch-all).
const PAGES = [
  '/',
  '/start',
  '/about',
  '/journey',
  '/now',
  '/status',
  '/berlin',
  '/uses',
  '/work',
  '/range',
  '/playground',
  '/reel',
  '/studio',
  '/toolkit',
  '/craft',
  '/taste',
  '/design',
  '/specimen',
  '/library',
  '/numbers',
  '/colophon',
  '/thanks',
  '/principles',
  '/writing',
  '/answers',
  '/contact',
  '/resume',
  '/bio',
  '/wander',
  '/atlas',
  '/terminal',
  '/keyboard',
  '/changelog',
  '/contents',
]

// Stable dynamic detail routes worth indexing in their own right: the real case
// studies and each discipline's deep page. These are the "more than one project"
// evidence pages, so they earn a spot in the sitemap. Keep in sync with the
// non-placeholder projects in src/data/projects.ts and the discipline ids in
// src/data/disciplines.ts.
const CASE_STUDIES = ['/work/guided', '/work/portfolio']
const DISCIPLINES = ['frontend', 'ios', 'backend', 'ai', 'motion'].map((id) => `/range/${id}`)

// Pages that genuinely move often get a daily hint; the rest, weekly.
const DAILY = new Set(['/', '/now', '/status', '/changelog', '/playground', '/library', '/numbers'])

function normalizeOrigin(raw) {
  if (!raw) return ''
  let origin = String(raw).trim()
  if (!origin) return ''
  // Vercel hands over a bare host (no scheme); add https if it's missing.
  if (!/^https?:\/\//i.test(origin)) origin = `https://${origin}`
  // Drop any trailing slash so joins don't double up.
  return origin.replace(/\/+$/, '')
}

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function main() {
  const origin = normalizeOrigin(process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL)
  if (!origin) {
    console.log('[sitemap] No SITE_URL / VERCEL_PROJECT_PRODUCTION_URL set — skipping sitemap (origin is never hard-coded).')
    return
  }
  if (!existsSync(DIST)) {
    console.log('[sitemap] No dist/ directory — run after the build. Skipping.')
    return
  }

  const lastmod = new Date().toISOString().slice(0, 10)
  const routes = [...PAGES, ...CASE_STUDIES, ...DISCIPLINES]

  const urls = routes
    .map((path) => {
      const loc = xmlEscape(origin + (path === '/' ? '/' : path))
      const changefreq = DAILY.has(path) ? 'daily' : 'weekly'
      const priority = path === '/' ? '1.0' : '0.7'
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8')

  // Append an absolute Sitemap: line to the deployed robots.txt so crawlers find
  // it without Search Console. The baseline public/robots.txt (already copied to
  // dist/) stays valid on hosts with no origin; here we enrich the real deploy.
  const robotsPath = join(DIST, 'robots.txt')
  try {
    let robots = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8') : 'User-agent: *\nAllow: /\n'
    if (!/^Sitemap:/im.test(robots)) {
      if (!robots.endsWith('\n')) robots += '\n'
      robots += `\nSitemap: ${origin}/sitemap.xml\n`
      writeFileSync(robotsPath, robots, 'utf8')
    }
  } catch {
    /* robots enrichment is best-effort — never fail the build over it */
  }

  console.log(`[sitemap] Wrote ${routes.length} URLs to dist/sitemap.xml for ${origin}`)
}

try {
  main()
} catch (err) {
  // Never fail a deploy over the sitemap.
  console.warn('[sitemap] Skipped after an error:', err && err.message ? err.message : err)
}
process.exit(0)
