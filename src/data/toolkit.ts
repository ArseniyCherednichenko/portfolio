// The tools Arseniy actually reaches for, grouped by what they are for.
// Keep this honest: every entry is something genuinely in use across Guided,
// this site, or day-to-day building. No aspirational padding.

export interface Tool {
  name: string
  /** One honest line on where this fits into the work. */
  note: string
}

export interface ToolGroup {
  label: string
  blurb: string
  tools: Tool[]
}

export const TOOLKIT: ToolGroup[] = [
  {
    label: 'Languages',
    blurb: 'The ground everything else is written on.',
    tools: [
      { name: 'TypeScript', note: 'Strict mode, everywhere. The default for anything I build for the web.' },
      { name: 'Swift', note: 'The language under the native iOS side of Guided.' },
      { name: 'JavaScript', note: 'Where TypeScript is overkill, and for quick scripts.' },
    ],
  },
  {
    label: 'Interface',
    blurb: 'How the things people touch get built.',
    tools: [
      { name: 'React', note: 'Most of my interface work lives here, including this site.' },
      { name: 'SwiftUI', note: 'The native iOS app for Guided, on a shared backend.' },
      { name: 'Tailwind CSS', note: 'Utility-first styling. v4 powers this site.' },
      { name: 'Framer Motion', note: 'Every animation here is a hand-built component.' },
    ],
  },
  {
    label: 'Backend and data',
    blurb: 'The parts users never see but always feel.',
    tools: [
      { name: 'Supabase', note: 'Auth, data, and the shared backend behind Guided.' },
      { name: 'Node', note: 'The runtime behind the tooling and services I write.' },
    ],
  },
  {
    label: 'Craft and tooling',
    blurb: 'The bench the work is made on.',
    tools: [
      { name: 'Figma', note: 'Where I sketch and design before I build.' },
      { name: 'Vite', note: 'Fast dev server and build for the frontend.' },
      { name: 'Git', note: 'Version control. This site is public and grows in the open.' },
    ],
  },
]

/** Flat list of tool names, e.g. for the homepage marquee. Single source of truth. */
export const SKILLS: string[] = TOOLKIT.flatMap((g) => g.tools.map((t) => t.name))

/** Total number of tools, for the toolkit page counter. */
export const TOOL_COUNT: number = SKILLS.length
