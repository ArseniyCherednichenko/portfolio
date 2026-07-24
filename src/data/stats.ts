// Single source of truth for the site's own honest counts.
//
// These describe what actually ships in this repo — the count of hand-built
// components in `src/components`, the number of real routed pages, and a few
// figures that state the site's making-by-hand ethos plainly. The daily
// routine keeps COMPONENT_COUNT and PAGE_COUNT current as the site grows.
//
// Kept in `data/` (not on a page) so the eager Home chunk can read the counts
// without pulling a whole page component into its bundle. Pages that showed
// these numbers first (Colophon, Contents, Changelog) re-import from here.

/** Hand-built components in `src/components`. Nothing off the shelf. This is
 * the literal count of files there, catalogued one by one on the /library
 * page (LIBRARY in src/data/library.ts) — keep the two in step. */
export const COMPONENT_COUNT = 89

/** Distinct routed pages the site serves. */
export const PAGE_COUNT = 20

export interface SiteStat {
  value: number
  /** e.g. "+" to read as "at least". */
  suffix?: string
  label: string
  /** One honest line under the figure. */
  detail: string
}

// The workbench, stated in numbers. Every figure here is literally true of this
// repository — no vanity metrics, no invented reach. The point they make
// together is the site's whole thesis: it is made, not assembled.
export const SITE_STATS: SiteStat[] = [
  {
    value: COMPONENT_COUNT,
    suffix: '+',
    label: 'Hand-built components',
    detail: 'The aurora, the cursor, every card — written here, not installed.',
  },
  {
    value: PAGE_COUNT,
    label: 'Pages, each its own',
    detail: 'Real routes and custom layouts, every one deep-linkable.',
  },
  {
    value: 0,
    label: 'Off-the-shelf UI kits',
    detail: 'No template, no component library. Nothing pulled from a shelf.',
  },
  {
    value: 1,
    label: 'Pair of hands',
    detail: 'Design, motion, and code — the whole site, built solo.',
  },
]
