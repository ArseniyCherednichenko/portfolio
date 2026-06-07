# portfolio

Personal site of **Arseniy Cherednichenko** — builder, co-founder of Guided, Berlin.

React + Vite + TypeScript + Tailwind v4 + Framer Motion. Dark, calm, motion-led.

```bash
npm install
npm run dev      # local dev
npm run build    # production build
npm run typecheck
```

## Routes

Client-side routing via `react-router-dom`:

- `/` — home (hero, work, toolkit, playground, approach, contact)
- `/work/:slug` — project case studies (e.g. `/work/guided`)
- `*` — 404

## Deploy

Any static host works. `vercel.json` rewrites every path to `index.html` so
deep links to client-side routes resolve. On other hosts, configure an
equivalent SPA fallback.

Built incrementally — see `HANDOFF.md` for the roadmap.
