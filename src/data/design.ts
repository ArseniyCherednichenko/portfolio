// Single source of truth for the /design page — the site's own design language,
// documented from the real values it is built on. Nothing here is aspirational:
// every hex, token, weight, and curve below is one this site actually uses.
// Keep it in sync with src/index.css (colors, fonts) and the shared EASE /
// motion constants used across the pages. This page is a living style guide, so
// if a token here drifts from the code it is a bug, not a decoration.

export interface Swatch {
  /** Display name for the colour. */
  name: string
  /** The value to show and to copy — a hex or an `rgb()` string. */
  value: string
  /** Honest one-line note on where it lives in the interface. */
  note: string
  /** True for the near-black ground, so the chip gets a hairline border to read. */
  dark?: boolean
  /** True for the lime accent, so it can be highlighted as the one colour. */
  accent?: boolean
}

export interface SwatchGroup {
  label: string
  blurb: string
  swatches: Swatch[]
}

// The base palette: a near-black ground, one lime accent, and pure white.
// Deliberately tiny — the discipline is the point.
export const CORE_COLORS: SwatchGroup = {
  label: 'The base',
  blurb: 'Three colours carry the whole site. A near-black ground, one lime, and white.',
  swatches: [
    { name: 'Ink', value: '#0A0A0A', note: 'The ground. Every page sits on this near-black.', dark: true },
    { name: 'Lime', value: '#DCF87C', note: 'The one accent. Links, focus, the single point of colour.', accent: true },
    { name: 'White', value: '#FFFFFF', note: 'Text at full strength — reserved for headlines and key lines.' },
  ],
}

// The real work happens in the opacity ladder: white laid over the ink at a
// handful of fixed strengths does all the hierarchy, so the interface stays
// coherent without a second hue. These are the rungs the pages actually reach
// for, ordered brightest to faintest.
export const TEXT_LADDER: { token: string; opacity: number; role: string }[] = [
  { token: 'text-white', opacity: 100, role: 'Headlines and the sharpest lines' },
  { token: 'text-white/70', opacity: 70, role: 'Lead paragraphs and strong body' },
  { token: 'text-white/55', opacity: 55, role: 'The workhorse body colour' },
  { token: 'text-white/45', opacity: 45, role: 'Secondary copy and captions' },
  { token: 'text-white/30', opacity: 30, role: 'Labels, hints, quiet metadata' },
]

// Surfaces and edges: the same white, but a few percent strong, is how a card
// lifts off the ground or a hairline separates two blocks. Barely-there on
// purpose — the depth reads without ever going grey.
export const SURFACE_LADDER: { token: string; opacity: number; role: string }[] = [
  { token: 'bg-white/[0.02]', opacity: 2, role: 'A card, one breath above the ground' },
  { token: 'bg-white/[0.06]', opacity: 6, role: 'A hover, or a raised panel' },
  { token: 'border-white/10', opacity: 10, role: 'The default hairline between things' },
  { token: 'border-white/15', opacity: 15, role: 'A slightly firmer edge on a card' },
]

export interface TypeSpec {
  /** The family name as it appears in the stack. */
  family: string
  /** Display or Body — its job on the page. */
  role: string
  /** A short honest note on why it is here and where it is used. */
  note: string
  /** Rendering class: the display face or the UI sans. */
  className: string
  /** Weight range actually available / used. */
  weights: string
  /** A short specimen line to render in the face itself. */
  specimen: string
}

export const TYPE: TypeSpec[] = [
  {
    family: 'Fraunces',
    role: 'Display',
    note: 'A self-hosted variable serif on the optical-size axis, so headlines set their own contrast as they grow. It gives the site an editorial voice instead of an all-sans template.',
    className: 'font-display',
    weights: '300 – 700, opsz 9 – 144',
    specimen: 'Motion that earns its place',
  },
  {
    family: 'Inter',
    role: 'Body & UI',
    note: 'Carries every paragraph, label, and control. Neutral, legible at small sizes, and it stays out of the way so the serif can do the talking.',
    className: 'font-sans',
    weights: '400 – 700',
    specimen: 'The parts people touch, set to stay out of the way.',
  },
]

// The type scale, in rem, as the pages actually step through it. Shown as a
// specimen ladder so the rhythm is visible, not just described.
export interface TypeStep {
  label: string
  /** Tailwind size class, for the honest token label. */
  token: string
  /** rem value, for the visible size. */
  rem: number
  display?: boolean
}

export const TYPE_SCALE: TypeStep[] = [
  { label: 'Hero', token: 'text-7xl', rem: 4.5, display: true },
  { label: 'Page title', token: 'text-5xl', rem: 3, display: true },
  { label: 'Section', token: 'text-3xl', rem: 1.875, display: true },
  { label: 'Card title', token: 'text-xl', rem: 1.25, display: true },
  { label: 'Body', token: 'text-base', rem: 1 },
  { label: 'Small', token: 'text-sm', rem: 0.875 },
  { label: 'Label', token: 'text-xs', rem: 0.75 },
]

export interface MotionSpec {
  name: string
  /** The literal value, copyable. */
  value: string
  /** What it is for. */
  note: string
}

// The motion tokens. The signature is a single expo-out curve; almost every
// entrance on the site rides it. Springs are reserved for the things that
// should feel physical rather than merely eased.
export const SIGNATURE_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export const MOTION: MotionSpec[] = [
  { name: 'Signature ease', value: SIGNATURE_EASE, note: 'Expo-out. The house curve — most entrances and reveals ride it.' },
  { name: 'Reveal duration', value: '0.6s', note: 'The default for a section or card easing into view.' },
  { name: 'Hover response', value: '0.3s', note: 'Short and crisp, so a hover feels immediate, not sleepy.' },
  { name: 'Physical spring', value: 'stiffness 300, damping 30', note: 'For the things that should feel grabbed — magnets, drags, the orbit.' },
]
