// The site's own repository, as an honest tree for the Colophon's FileTree.
//
// Every node here names something that genuinely exists in this repo. The
// counts on the big directories come from data/stats.ts (the same single source
// of truth the Library and Colophon read), so the tree can never claim more
// files than actually ship. The smaller directories are listed in full — those
// really are all the files they hold.

import type { FileNode } from '../components/FileTree'
import { COMPONENT_COUNT, PAGE_COUNT } from './stats'

export const REPO_TREE: FileNode[] = [
  {
    name: 'src',
    kind: 'dir',
    note: 'Everything the app is',
    children: [
      {
        name: 'components',
        kind: 'dir',
        count: COMPONENT_COUNT,
        note: 'Hand-built, one per file',
        children: [
          { name: 'Aurora.tsx', kind: 'file', note: 'The living backdrop' },
          { name: 'Modal.tsx', kind: 'file', note: 'The shared overlay primitive' },
          { name: 'FileTree.tsx', kind: 'file', note: 'This very tree' },
          { name: 'MagneticButton.tsx', kind: 'file', note: 'Buttons that lean in' },
          { name: 'CommandPalette.tsx', kind: 'file', note: 'Drive the site by keyboard' },
          { name: 'Reveal.tsx', kind: 'file', note: 'Scroll entrances' },
        ],
      },
      {
        name: 'pages',
        kind: 'dir',
        count: PAGE_COUNT,
        note: 'One file per route',
        children: [
          { name: 'Home.tsx', kind: 'file', note: 'The front door' },
          { name: 'Work.tsx', kind: 'file', note: 'The work, as a ledger' },
          { name: 'Range.tsx', kind: 'file', note: 'More than one project' },
          { name: 'Playground.tsx', kind: 'file', note: 'Live motion, hand-built' },
          { name: 'Colophon.tsx', kind: 'file', note: 'How this site is built' },
        ],
      },
      {
        name: 'data',
        kind: 'dir',
        note: 'Content, kept out of the views',
        children: [
          { name: 'projects.ts', kind: 'file', note: 'The work, typed' },
          { name: 'disciplines.ts', kind: 'file', note: 'The range' },
          { name: 'library.ts', kind: 'file', note: 'Every component, catalogued' },
          { name: 'stats.ts', kind: 'file', note: 'The honest counts' },
          { name: 'repoTree.ts', kind: 'file', note: 'This tree' },
        ],
      },
      {
        name: 'hooks',
        kind: 'dir',
        children: [{ name: 'useBerlinTime.ts', kind: 'file', note: 'The clock in the footer' }],
      },
      {
        name: 'lib',
        kind: 'dir',
        children: [{ name: 'fuzzy.ts', kind: 'file', note: 'Fuzzy match for search' }],
      },
      { name: 'App.tsx', kind: 'file', note: 'Routes and the shell' },
      { name: 'main.tsx', kind: 'file', note: 'The mount point' },
      { name: 'index.css', kind: 'file', note: 'Tailwind, tokens, @font-face' },
    ],
  },
  {
    name: 'public',
    kind: 'dir',
    note: 'Served as-is',
    children: [
      {
        name: 'fonts',
        kind: 'dir',
        children: [
          { name: 'fraunces-latin.woff2', kind: 'file', note: 'The display serif' },
          { name: 'fraunces-latin-ext.woff2', kind: 'file' },
        ],
      },
      { name: 'favicon.svg', kind: 'file', note: 'The orbit mark' },
      { name: 'og.png', kind: 'file', note: 'The share card' },
      { name: 'site.webmanifest', kind: 'file' },
    ],
  },
  { name: 'index.html', kind: 'file', note: 'The single page' },
  { name: 'vite.config.ts', kind: 'file', note: 'Build and dev server' },
  { name: 'tsconfig.json', kind: 'file', note: 'TypeScript, strict' },
  { name: 'package.json', kind: 'file', note: 'The dependency list — deliberately short' },
]
