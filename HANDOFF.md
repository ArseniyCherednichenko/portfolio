# portfolio — Session Handoff

> Arseniy Cherednichenko's personal portfolio site. Living context for a fresh
> Claude session (or the daily routine). Goal: grow this into a polished,
> motion-led, professional portfolio over time, applying the craft from Guided.

## Stack
React 18 + Vite + TypeScript (strict) + **Tailwind v4** (via `@tailwindcss/vite`, classes auto-detected, no content config) + **Framer Motion** for animation. Dark theme, lime accent `#DCF87C`. Single-page for now (`src/App.tsx`).

## Run / verify
- `npm install`, `npm run dev`, `npm run build`, `npm run typecheck`.
- Tailwind v4: utilities work out of the box; arbitrary values like `text-[#DCF87C]`, `bg-white/[0.03]` are fine. No `tailwind.config` needed unless adding a theme.

## Conventions (hard)
- Commits authored as **ars7ars3@gmail.com** / "Arseniy Cherednichenko". NO `Co-Authored-By`.
- Commit GRANULARLY — one logical change per commit, as many as is coherent.
- **No emojis in the UI.** Keep copy honest — this is Arseniy's real site. Do NOT invent fake jobs, awards, clients, metrics, or testimonials. Use real, verifiable facts (co-founder of Guided, Berlin, student) or leave a clearly-marked placeholder for him to fill.
- Keep `npm run build` AND `npm run typecheck` green before every commit/PR.
- Design bar: calm, premium, fast. Real motion (entrance, scroll-reveal, hover), strong type hierarchy, generous spacing. Reuse ideas from Guided (gradient ambience, lime accent, serif/sans mix). Never ship something that looks templated or AI-generated.

## Roadmap / backlog (pull from here, build one coherent thing per run)
- Polish hero: animated gradient mesh / subtle grain, a magnetic or arrow CTA, scroll cue.
- Add a sticky/animated top nav with smooth-scroll to sections.
- About: add a short timeline or "now" block.
- Work: add more project cards (real ones only), case-study pages, hover previews.
- Add a "writing"/notes section (MDX) if wanted.
- Add a Fraunces serif display face for headlines (mix with Inter), like Guided.
- Motion: page-load orchestration, `useReducedMotion` support, section transitions, animated counters/skills bars.
- Responsive pass (mobile spacing/type), a11y (focus states, aria, color contrast), favicon + OG image + meta.
- Theme tokens file; light/dark toggle.
- Deploy notes (Vercel / GitHub Pages) in README.
- 404 page, smooth anchor scrolling, a contact form (mailto or a no-backend service).

## The daily routine's job (per run) — BRANCH + PR (this is his public showcase)
1. Read this file + `git log --oneline -20` + `gh pr list --state all --limit 20` so you don't repeat work.
2. `git config user.email "ars7ars3@gmail.com"` / `user.name "Arseniy Cherednichenko"`. No Co-Authored-By.
3. `git fetch origin`, branch off origin/main: `auto/<slug>`.
4. Build ONE coherent improvement from the roadmap (or an obvious polish/a11y/responsive win). Commit granularly.
5. VERIFY: `npm install` if needed, then `npm run typecheck` AND `npm run build` — both must pass. If not fixable cleanly, ABANDON without pushing.
6. Push the branch, open a PR with a clear title, what/why, a "How to test" note (run `npm run dev`, what to look at), and the Claude Code footer. Do NOT merge, do NOT push to main.
