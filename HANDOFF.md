# portfolio — Session Handoff

> Arseniy Cherednichenko's personal portfolio site. Living context for a fresh
> Claude session (or the daily routine). Goal: grow this into a polished,
> motion-led, professional portfolio over time, applying the craft from Guided.

## Stack
React 18 + Vite + TypeScript (strict) + **Tailwind v4** (via `@tailwindcss/vite`, classes auto-detected, no content config) + **Framer Motion** for animation + **react-router-dom v6** for client-side routing. Dark theme, lime accent `#DCF87C`.

## Architecture (multi-page)
- `src/main.tsx` wraps `<App/>` in `<BrowserRouter>`.
- `src/App.tsx` = route table only (`<Routes>`).
- `src/components/Layout.tsx` = persistent shell (Aurora + Nav + footer) with `<AnimatePresence>` page transitions (keyed on pathname) and a `ScrollManager` that scrolls to `#hash` targets or resets to top on navigation.
- Pages live in `src/pages/`: `Home.tsx` (hero/about/work/toolkit/contact + project modal), `Playground.tsx` (live motion experiments gallery), `NotFound.tsx` (404).
- Routes: `/` Home, `/playground` Playground, `*` NotFound. Section anchors use `/#work`, `/#about` so they work from any page.
- Shared data in `src/data/projects.ts` (`PROJECTS`, `SKILLS`, `Project` type).
- `vercel.json` rewrites all paths to `/index.html` so deep links resolve on static hosts.
- NEXT: project detail pages (`/work/:slug`), an About page, a Contact page/dialog, command palette.

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

## Existing components (`src/components/`) — extend these, don't reinvent
Aurora (ambient bg), GradientText (shine), RotatingWord, SpotlightCard (cursor glow), Marquee, MagneticButton, Nav (route-aware), Reveal, HeroOrbit, ScrollCue, Modal, Layout (shell + page transitions), TiltCard (3D cursor tilt + glare), AnimatedCounter (count-up on view). Homepage composed in `src/pages/Home.tsx`. Keyframes (`shine`, `marquee`) + reduced-motion guard live in `src/index.css`.

## Design bar
Make it look VERY good: crazy-good motion design, professional, cool. Build original animated components in the spirit of **React Bits** and **21st.dev** (animated/gradient text, aurora/particle/mesh backgrounds, spotlight & tilt cards, magnetic buttons, marquees, scroll-linked & scroll-velocity motion, staggered reveals, section/page transitions, animated counters). Use Framer Motion well; always respect `prefers-reduced-motion`. Never templated, never "AI-generated".

## The daily routine's job (per run) — DIRECT TO MAIN
1. Read this file + `git log --oneline -30` + `ls src/components` so you don't repeat work.
2. `git config user.email "ars7ars3@gmail.com"` / `user.name "Arseniy Cherednichenko"`. No Co-Authored-By.
3. `git fetch origin && git rebase origin/main` (work on main directly).
4. Build ONE substantial, coherent improvement (a new section/component, a real polish/a11y/responsive pass). Make it genuinely more impressive each run. Commit GRANULARLY.
5. VERIFY: `npm install` if needed, then `npm run typecheck` AND `npm run build` — both must pass. If not fixable cleanly, STOP without pushing.
6. `git push origin main` (rebase + retry if rejected). No PRs.
