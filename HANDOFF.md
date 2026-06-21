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
- Pages live in `src/pages/`: `Home.tsx` (hero/about teaser/work/toolkit/contact + project modal), `About.tsx` (intro, Now block, How-I-work principles, Path timeline, CTA), `Work.tsx` (`/work` index — animated ledger of all projects), `Playground.tsx` (live motion experiments gallery), `WorkDetail.tsx` (`/work/:slug` project case study), `Contact.tsx` (`/contact` — deep-linkable contact page), `NotFound.tsx` (404).
- Routes: `/` Home, `/about` About, `/work` Work index, `/work/:slug` WorkDetail, `/playground` Playground, `/contact` Contact, `*` NotFound. Work, About, and Playground are real page links in Nav (NavLink active styling); Contact is reachable via the command palette Pages group, the contact dialog's "Contact page ->" link, and direct/deep links. The Home page still has a `#work` section with the project modal; its header has an "All work ->" link to `/work`.
- **Work index** (`Work.tsx`): intro header (Eyebrow/GradientText + an `AnimatedCounter` of `CASE_STUDIES.length` shipped), then a row-based "ledger" mapping `PROJECTS` to `WorkRow`s. Real rows are `<Link>`s to `/work/:slug` with hover micro-interactions (growing lime left-edge, title nudge, sliding arrow), number/role/year/stack; the `soon` placeholder renders a calm non-clickable row. Staggered scroll reveal, reduced-motion aware. Closing CTA. The command palette's Work entry and WorkDetail's "All work" back-links point here.
- Shared data in `src/data/projects.ts` (`PROJECTS`, `SKILLS`, `Project` type with `slug`/`role`/`sections`/`highlights` case-study fields; `getProject(slug)` and `CASE_STUDIES` helpers). About-page content (Now/Principles/Path) lives inline in `About.tsx` — keep it honest and current.
- **Project detail pages** (`WorkDetail.tsx`): title block (role/year/GradientText), Visit/Source CTAs, stack chips, a 3-up highlights grid, a two-column narrative from `sections`, and a "Next project" SpotlightCard cycling `CASE_STUDIES`. Unknown/placeholder slugs render an inline not-found. The Home project modal's primary CTA and the command palette's Projects entries both route here.
- `vercel.json` rewrites all paths to `/index.html` so deep links resolve on static hosts.
- **Command palette** (`src/components/CommandPalette.tsx`): site-wide Cmd/Ctrl+K. `CommandPaletteProvider` wraps the shell in `Layout`, owns the global shortcut + open state, and exposes `useCommandPalette()` (Nav uses it for its search button). Fuzzy-searches Pages, Projects (derived from `PROJECTS`), and Actions (email, copy email, GitHub). Arrow-key nav, Enter to run, Esc/backdrop to close; reduced-motion aware, dialog + listbox a11y.
- **Contact dialog** (`src/components/ContactDialog.tsx`): site-wide "Get in touch" modal. `ContactProvider` wraps the shell in `Layout` (outside `CommandPaletteProvider`, so the palette can use it) and exposes `useContact()`. Reuses the shared `Modal`; renders the shared `ChannelList`; ends with a "Contact page ->" link into `/contact`. Opened from the Nav "Get in touch" button, the footer link, the command palette's "Get in touch" action, and Home's "Other ways to reach me" link. Reduced-motion aware.
- **ChannelList** (`src/components/ChannelList.tsx`): shared, honest list of reach-me rows (Email mailto, Copy email with confirmation, GitHub) driven by `src/data/contact.ts` (`CHANNELS`, `EMAIL`, `GITHUB_URL`). Owns the row markup, copy-to-clipboard behaviour, and channel icons — single source of truth used by both the Contact dialog and the `/contact` page so they never drift. Staggered reveal, reduced-motion aware.
- **Contact page** (`Contact.tsx`): deep-linkable `/contact`. Header (Eyebrow/GradientText + intro), a two-column block — left `SpotlightCard` with the shared `ChannelList`, right column with a **live Berlin clock** (`useBerlinTime`, updates each second via `Intl.DateTimeFormat` `Europe/Berlin`, with an honest "around / probably asleep" status dot that pings only when awake + motion allowed) and a "no forms" note — a 3-up "What I am open to" honest-interests grid, and a closing line linking to `/work` and `/playground`. No fabricated availability or response-time promises.
- NEXT: an image lightbox, and screenshots/visuals on the project detail pages and Work index rows (currently text-only). A short no-backend contact note/form could still live on the `/contact` page. Consider surfacing Contact as a real Nav link if it earns the space.

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
Aurora (ambient bg), GradientText (shine), RotatingWord, SpotlightCard (cursor glow), Marquee, MagneticButton, Nav (route-aware), Reveal, HeroOrbit, ScrollCue, Modal, Layout (shell + page transitions), TiltCard (3D cursor tilt + glare), AnimatedCounter (count-up on view), Eyebrow (shared lime section label), CommandPalette (global Cmd+K). Homepage composed in `src/pages/Home.tsx`. Keyframes (`shine`, `marquee`) + reduced-motion guard live in `src/index.css`.

## Design bar
Make it look VERY good: crazy-good motion design, professional, cool. Build original animated components in the spirit of **React Bits** and **21st.dev** (animated/gradient text, aurora/particle/mesh backgrounds, spotlight & tilt cards, magnetic buttons, marquees, scroll-linked & scroll-velocity motion, staggered reveals, section/page transitions, animated counters). Use Framer Motion well; always respect `prefers-reduced-motion`. Never templated, never "AI-generated".

## The daily routine's job (per run) — DIRECT TO MAIN
1. Read this file + `git log --oneline -30` + `ls src/components` so you don't repeat work.
2. `git config user.email "ars7ars3@gmail.com"` / `user.name "Arseniy Cherednichenko"`. No Co-Authored-By.
3. `git fetch origin && git rebase origin/main` (work on main directly).
4. Build ONE substantial, coherent improvement (a new section/component, a real polish/a11y/responsive pass). Make it genuinely more impressive each run. Commit GRANULARLY.
5. VERIFY: `npm install` if needed, then `npm run typecheck` AND `npm run build` — both must pass. If not fixable cleanly, STOP without pushing.
6. `git push origin main` (rebase + retry if rejected). No PRs.
