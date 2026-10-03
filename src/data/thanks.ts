// With thanks — the honest acknowledgments for this site.
//
// Two kinds of debt are owed here, and both are real. First, the open-source
// software this portfolio is actually built on: every entry below is a genuine
// dependency in package.json, or the self-hosted type the site ships. Second,
// the work that set the bar — the public galleries whose spirit the Playground
// follows. Nothing here claims a partnership or an endorsement; it is simply an
// honest record of what this site stands on and learns from. Keep it truthful:
// no logo is borrowed, no relationship is implied, and the links all point at
// the real project homes.

export interface Credit {
  /** The project or tool, named as its makers name it. */
  name: string
  /** What it genuinely does for this site, in one honest line. */
  role: string
  /** The real project home. */
  href: string
  /** A short, honest note on the licence or nature, where it helps. */
  note?: string
}

export interface CreditGroup {
  /** Short editorial label for the group. */
  label: string
  /** One sentence framing the debt. */
  intro: string
  credits: Credit[]
}

export const CREDITS: CreditGroup[] = [
  {
    label: 'The stack it runs on',
    intro:
      'The open-source software this site is built with. Every one is a real dependency you can read in the package manifest.',
    credits: [
      {
        name: 'React',
        role: 'The component model the whole site is written in — every page, every piece of motion.',
        href: 'https://react.dev',
        note: 'MIT',
      },
      {
        name: 'React Router',
        role: 'The client-side router behind the deep-linkable pages and the transitions between them.',
        href: 'https://reactrouter.com',
        note: 'MIT',
      },
      {
        name: 'Framer Motion',
        role: 'The animation primitives under the springs, the shared-layout markers, and the reduced-motion paths.',
        href: 'https://motion.dev',
        note: 'MIT',
      },
      {
        name: 'Tailwind CSS',
        role: 'The utility layer the whole visual language is set in — the lime-on-ink palette, the spacing, the type scale.',
        href: 'https://tailwindcss.com',
        note: 'MIT',
      },
      {
        name: 'Vite',
        role: 'The build tool and dev server — the code-splitting that keeps first paint lean lives here.',
        href: 'https://vite.dev',
        note: 'MIT',
      },
      {
        name: 'TypeScript',
        role: 'Strict types across the entire codebase, so the site is as honest with the compiler as it is with you.',
        href: 'https://www.typescriptlang.org',
        note: 'Apache-2.0',
      },
    ],
  },
  {
    label: 'The type it is set in',
    intro:
      'Two open-source faces carry the whole site. Both are self-hosted and free to use, and both do real work here.',
    credits: [
      {
        name: 'Fraunces',
        role: 'The display serif for headlines — self-hosted as a variable font so the optical-size axis can track the rendered size.',
        href: 'https://fonts.google.com/specimen/Fraunces',
        note: 'SIL Open Font License',
      },
      {
        name: 'Inter',
        role: 'The sans that carries body copy and every label — by Rasmus Andersson, pairing a clean workhorse with the editorial serif.',
        href: 'https://rsms.me/inter/',
        note: 'SIL Open Font License',
      },
    ],
  },
  {
    label: 'The work that set the bar',
    intro:
      'This site never copies code from these, but it learns from them. They are the galleries whose spirit the hand-built Playground follows.',
    credits: [
      {
        name: 'React Bits',
        role: 'A gallery of animated React components that shows how much life a single interaction can carry. A standard to build toward, by hand.',
        href: 'https://reactbits.dev',
      },
      {
        name: '21st.dev',
        role: 'A community of beautifully-made interface components — a reminder that the small moments are where craft actually shows.',
        href: 'https://21st.dev',
      },
    ],
  },
]

/** Flat list of every credit, for counts. */
export const ALL_CREDITS: Credit[] = CREDITS.flatMap((g) => g.credits)
