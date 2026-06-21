// Single source of truth for how to reach Arseniy. Real, verifiable channels
// only — no invented socials. Consumed by the global contact dialog (and any
// future /contact page) so every surface stays in sync.

export const EMAIL = 'ars7ars3@gmail.com'
export const GITHUB_URL = 'https://github.com/ArseniyCherednichenko'

export type ChannelKind = 'email' | 'copy' | 'github'

export interface Channel {
  kind: ChannelKind
  label: string
  /** Secondary line shown under the label. */
  detail: string
  /** External/anchor target. Omitted for the copy action (handled in code). */
  href?: string
}

export const CHANNELS: readonly Channel[] = [
  {
    kind: 'email',
    label: 'Email',
    detail: EMAIL,
    href: `mailto:${EMAIL}`,
  },
  {
    kind: 'copy',
    label: 'Copy email address',
    detail: 'To your clipboard',
  },
  {
    kind: 'github',
    label: 'GitHub',
    detail: 'github.com/ArseniyCherednichenko',
    href: GITHUB_URL,
  },
]
