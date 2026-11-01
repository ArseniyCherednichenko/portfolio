// A real, downloadable contact card (.vcf) built from the honest facts the rest
// of the site already states — name, Berlin, the one role, the real channels.
// No invented phone, company address, or title appears here that is not already
// true elsewhere. Reuses the single source of truth in data/contact.ts so the
// card can never drift from the channels shown on the page.
//
// vCard 3.0 is used deliberately: it is the most widely understood version
// across Apple Contacts, Google Contacts, and Outlook, so "Save my card"
// actually lands in a phone's address book rather than opening as text.

import { EMAIL, GITHUB_URL } from '../data/contact'

// vCard escaping for the structured text fields: backslash, comma, semicolon,
// and newline all carry meaning in the format and must be escaped in values.
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/**
 * Build a valid vCard 3.0 for Arseniy. `siteUrl` is passed in (rather than read
 * from `window` here) so the generator stays pure and testable; the caller
 * supplies the live origin at download time. Lines are joined with CRLF, as the
 * spec requires — some parsers reject a bare LF.
 */
export function buildVCard(siteUrl?: string): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    // Family;Given;Additional;Prefix;Suffix
    `N:${esc('Cherednichenko')};${esc('Arseniy')};;;`,
    `FN:${esc('Arseniy Cherednichenko')}`,
    // Honest: a developer and designer, and a co-founder of Guided.
    `TITLE:${esc('Developer and designer')}`,
    `ORG:${esc('Guided')}`,
    `ROLE:${esc('Co-founder')}`,
    `EMAIL;TYPE=INTERNET,PREF:${esc(EMAIL)}`,
    // ADR: PO;ext;street;locality;region;postcode;country — city and country
    // only, the one true fact about where the work is made.
    `ADR;TYPE=HOME:;;;${esc('Berlin')};;;${esc('Germany')}`,
    'TZ:Europe/Berlin',
    `URL;TYPE=GitHub:${esc(GITHUB_URL)}`,
  ]
  if (siteUrl) lines.push(`URL;TYPE=Portfolio:${esc(siteUrl)}`)
  lines.push(
    `NOTE:${esc('Berlin-based developer and designer. Co-founder of Guided, a Socratic AI tutor. Works across React, TypeScript, SwiftUI, and applied AI.')}`,
    'END:VCARD',
  )
  return lines.join('\r\n')
}

/**
 * Generate the vCard and hand it to the browser as a download. Dependency-free:
 * a Blob and a transient object URL, cleaned up on the next tick. Returns false
 * on a non-browser or locked-down environment so a caller can fall back to a
 * copy/hint instead of assuming the save landed. Never throws.
 */
export function downloadVCard(): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false
  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined
    const card = buildVCard(origin)
    const blob = new Blob([card], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'arseniy-cherednichenko.vcf'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoke on the next tick so the download has a frame to kick off first.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}
