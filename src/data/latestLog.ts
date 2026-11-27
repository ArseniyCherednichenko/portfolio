// A compact, standalone list of the most recent build-log headlines, for the
// Home page's "In the open" section.
//
// Why its own tiny module and not derived from `changelog.ts`: the Home chunk
// ships eagerly, while the full Changelog page is lazy-loaded. If Home imported
// anything from `changelog.ts`, that (large) module would be shared with the
// eager entry and Rollup would hoist the whole log — every long entry string —
// into the initial bundle, undoing the code split. This file imports nothing
// heavy, so the headlines cost almost nothing up front.
//
// CONTRACT — keep this list tight and glanceable, because every string here
// ships in the eager landing bundle and renders as a headline on the home page:
//   • `title`   — a short, scannable name for the thing that shipped. Keep it
//                 under ~56 characters. NOT a paragraph. NOT the full changelog
//                 sentence. The full prose lives on /changelog.
//   • `summary` — one honest line of context, under ~120 characters.
//   • `tag`     — the kind chip, matching a KIND_META label in changelog.ts
//                 ('Page' | 'Component' | 'Motion' | 'Polish' | 'Infra').
//
// Newest first, kept to the ~10 most recent. When you prepend a new entry each
// run, drop the oldest so the list never grows unbounded and the landing page
// stays premium. If you catch yourself pasting a long changelog paragraph in
// here, stop: that belongs in `changelog.ts`, and a glanceable headline belongs
// here.

export interface LogHeadline {
  /** The short name of the thing that shipped. Under ~56 chars, never prose. */
  title: string
  /** One honest line of context. Under ~120 chars. */
  summary: string
  /** The kind label shown as a chip, matching KIND_META in changelog.ts. */
  tag: string
}

export const LATEST_LOG: LogHeadline[] = [
  {
    title: 'One backend, two apps',
    summary:
      'The fifth essay. Holding a React web app and a native SwiftUI app to one shared backend, so the two never quietly drift.',
    tag: 'Page',
  },
  {
    title: 'A thermometer you read by which spheres float',
    summary:
      'GalileanThermometer — the needle instrument\'s quiet neighbour, read by buoyancy instead of a scale. Warm the liquid and it thins, so the densest spheres sink one by one; the temperature is the tag on the lowest one still afloat, derived from exactly that calibration so the reading and the spheres can never disagree. No heat, no fluid — just the honest rule.',
    tag: 'Component',
  },
  {
    title: 'An IBAN field that checks its own digits',
    summary:
      'IbanField — the bank-transfer sibling that gives the checkout family its European corner. It groups four at a time with the caret held under your edit, names the country from its ISO code (and the length the standard assigns it), and runs the mod-97 check digits as an honest typo test, never a claim the account is real. Nothing leaves the tab.',
    tag: 'Component',
  },
  {
    title: 'A card field that reads its own brand',
    summary:
      'CardField — the piece every checkout ends on, completing the money/phone/card family. The number groups 4-4-4-4 (4-6-5 for Amex) with the caret held under your edit; the brand is named from its real prefix, no logo borrowed; and the Luhn checksum runs as an honest typo test, never a claim the card is valid. Nothing leaves the tab.',
    tag: 'Component',
  },
  {
    title: 'Building with models, not around them',
    summary:
      'The fourth essay is up. Weave a model into the product along its grain instead of bolting a chatbot to the side: design the wrong path first, keep the model fenced by deterministic code, and be honest about which parts are a good guess.',
    tag: 'Page',
  },
  {
    title: 'A VU needle that leans after the signal',
    summary:
      'VuMeter — an analog VU meter with the one thing that makes it an instrument: ballistics. The needle runs a weighted second-order spring, so it lags each transient and settles with a hair of overshoot, chasing a level synthesised to read like programme material. Ride the gain fader past unity and it pegs into the red. Honest: no audio, a made-up signal, a relative scale.',
    tag: 'Component',
  },
  {
    title: 'A calendar you drag a whole stay across',
    summary:
      "DateRangePicker — the Calendar's harder sibling. A range is a span, not a cell, so the band that fills it bridges the grid's gaps to read as one continuous bar, not islands. Click a start, then an end (ordered for you); reach for the far day and the span previews live, growing night by night, with a count under the grid. Same date-grid keyboard contract as the single-date picker beside it.",
    tag: 'Component',
  },
  {
    title: 'A toolbar the selected text raises itself',
    summary:
      'SelectionToolbar — the overlay with no trigger. Highlight a phrase and a small bar rises over it: the popover anchors to an element, the context menu to the pointer, this one to the selection itself. Copy, highlight (a persistent lime mark via the CSS Custom Highlight API), or pull a quote — every button cancels its own mousedown so the selection survives the press.',
    tag: 'Component',
  },
  {
    title: 'A phone field that groups as you type',
    summary:
      'PhoneField — the honest sibling to the money field: same caret trick, different value. Digits group the way the chosen country writes them and the cursor stays under your edit. It reports clean E.164 and makes only a soft length check, never claiming to validate every numbering plan. The country is an accessible listbox of dial codes.',
    tag: 'Component',
  },
  {
    title: 'A money field whose caret stays put',
    summary:
      'CurrencyField — the money input the entry-field family never had. The hard part a lazy version skips is the caret: group the digits as you type and a naive input throws the cursor to the end, so this restores it to the same logical place under your edit. Shows grouped text, reports a clean number; locale and symbol come from Intl.',
    tag: 'Component',
  },
]
