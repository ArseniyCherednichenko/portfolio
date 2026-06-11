# portfolio — Session Handoff

> Arseniy Cherednichenko's personal portfolio site. Living context for a fresh
> Claude session (or the daily routine). Goal: grow this into a polished,
> motion-led, professional portfolio over time, applying the craft from Guided.

## Stack
React 18 + Vite + TypeScript (strict) + **Tailwind v4** (via `@tailwindcss/vite`, classes auto-detected, no content config) + **Framer Motion** for animation + **react-router-dom v6** for client-side routing. Dark theme, lime accent `#DCF87C`.

## Architecture (routing)
- `src/main.tsx` wraps the app in `<BrowserRouter>`.
- `src/App.tsx` is the route table: a `Layout` route with children `index` (Home), `work/:slug` (WorkDetail), and `*` (NotFound).
- `src/components/Layout.tsx` holds the persistent chrome (Aurora, Grain, ScrollProgress, RouteProgress, CommandPalette, BackToTop, CursorDot, Nav, footer) + `<PageTransition/>` (the animated Outlet). `SectionDots` only render on `/`.
- **Navigation feel:** `PageTransition` re-keys the Outlet on `pathname` so each route fades/lifts in (entrance-only, so ScrollManager's scroll-to-top and `/#section` anchor jumps still work; same-route hash links don't replay it). `RouteProgress` sweeps a lime bar across the top on each navigation as a tactile "you moved" cue. `Nav` renders an active-state pill that slides between links via a shared `layoutId`. All three honor `prefers-reduced-motion`.
- `src/components/ScrollManager.tsx` handles scroll on route/hash change (top on nav, scroll-to-section for `/#id`).
- Pages live in `src/pages/` (Home, WorkDetail, NotFound). Project content is centralized in `src/data/projects.ts` (used by the work grid, case-study pages, and command palette). Add real projects there.
- Section nav uses `/#section` links so they work from any route. `vercel.json` rewrites all paths to `index.html` for SPA deep-links.
- The reusable `Modal` is the dialog base (backdrop blur, slide-up on mobile, escape to close, scroll lock; `size="md"|"lg"` widens the panel for content-heavy dialogs). `ContactDialog` (mounted globally in `Layout`) builds on it: an honest "compose a message" form that assembles a `mailto:` link (no backend). It opens anywhere via a `window` `open-contact` event — dispatched by the nav "Get in touch" button, the home contact CTA, the Playground dialog demo, and the command palette's "Compose a message" entry.
- `ProjectQuickLook` (also global in `Layout`) previews any project in place: role, summary, stack, the opening sections of the case study, and links, with a button on to the full `/work/:slug` page. Open it with the `openProjectQuickLook(slug)` helper (dispatches an `open-project` CustomEvent carrying the slug). The home work cards open it on click; the command palette adds a per-project `project:<slug>` "quick look" entry.
- Global popups follow an event convention: dispatch `new Event('open-<name>')` to open them. The command palette supports `action:<name>` targets (turned into `open-<name>` events) and `project:<slug>` targets (turned into a quick-look), so new dialogs can be palette-triggered without bespoke wiring.

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
Aurora (ambient bg), GradientText (shine), RotatingWord, SpotlightCard (cursor glow), Marquee, MagneticButton, Nav, Reveal, **DotGrid** (cursor-reactive canvas dot field, no particle lib — featured on /playground), **Scramble** (decode-on-view text, also drives Home's section eyebrows; `hoverable` replays on hover). The full component set is larger — `ls src/components` before adding. Homepage composed in `src/pages/Home.tsx` (hero, about, work, toolkit, playground, approach, contact, faq). Keyframes (`shine`, `marquee`) + reduced-motion guard live in `src/index.css`.

## Design bar
Make it look VERY good: crazy-good motion design, professional, cool. Build original animated components in the spirit of **React Bits** and **21st.dev** (animated/gradient text, aurora/particle/mesh backgrounds, spotlight & tilt cards, magnetic buttons, marquees, scroll-linked & scroll-velocity motion, staggered reveals, section/page transitions, animated counters). Use Framer Motion well; always respect `prefers-reduced-motion`. Never templated, never "AI-generated".

## The daily routine's job (per run) — DIRECT TO MAIN
1. Read this file + `git log --oneline -30` + `ls src/components` so you don't repeat work.
2. `git config user.email "ars7ars3@gmail.com"` / `user.name "Arseniy Cherednichenko"`. No Co-Authored-By.
3. `git fetch origin && git rebase origin/main` (work on main directly).
4. Build ONE substantial, coherent improvement (a new section/component, a real polish/a11y/responsive pass). Make it genuinely more impressive each run. Commit GRANULARLY.
5. VERIFY: `npm install` if needed, then `npm run typecheck` AND `npm run build` — both must pass. If not fixable cleanly, STOP without pushing.
6. `git push origin main` (rebase + retry if rejected). No PRs.
