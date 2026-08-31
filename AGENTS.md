# GradeBoss — Contributor & Agent Guide

## Golden rules (apply to EVERYTHING built in this app)

These are non-negotiable requirements for every feature, page, component, and
change in GradeBoss. Treat them as acceptance criteria — a change is not "done"
until it satisfies both.

### 1. Responsive & adaptive by default

GradeBoss must work and look great on **desktop, macOS, Android, and iOS**, at
every screen size.

- Author CSS **mobile-first** and layer larger layouts with `min-width` media
  queries. The established breakpoints are `600px` (tablet) and `900px`
  (desktop); reuse them for consistency.
- Layout adapts by form factor: a bottom tab bar + top bar on phones, a
  persistent sidebar on desktop (see `client/src/App.tsx` / `styles.css`).
- Use fluid sizing (`clamp()`, `%`, `fr`, `minmax()`) instead of fixed pixel
  widths for anything that spans the viewport.
- Respect device safe areas with the `--safe-*` CSS variables
  (`env(safe-area-inset-*)`) and set `viewport-fit=cover` (already in
  `index.html`). Prefer `100dvh` over `100vh` for full-height layouts.
- Keep touch targets comfortable (~44px) and set form inputs to `font-size:
  16px` so iOS does not auto-zoom on focus.
- Make wide content (e.g. tables) scroll gracefully on small screens rather
  than overflowing the page.

### 2. Installable & offline-capable (PWA)

GradeBoss must be **downloadable/installable** and usable **offline** on every
platform.

- The app is a Progressive Web App via `vite-plugin-pwa` (configured in
  `client/vite.config.ts`): web manifest, icons, and a service worker.
- Any new static assets must be precached; new API calls that should work
  offline must be added to the Workbox `runtimeCaching` rules (API GETs use
  `NetworkFirst` with a cache fallback).
- Keep the app shell functional offline. Surface offline state to the user
  (see the offline banner in `App.tsx`) instead of failing silently.
- When adding routes/screens, ensure `navigateFallback` still resolves them so
  a hard refresh works offline.
- Regenerate icons with `npm run generate:icons --workspace client` if the
  logo (`client/public/logo.svg`) changes.

### How to verify before finishing

- Check the layout at phone (~390px), tablet (~768px), and desktop (~1280px)
  widths.
- Build the client and confirm the service worker + manifest are emitted, and
  that the app loads offline (DevTools → Application, or toggle offline and
  reload).

## Project overview

Full-stack TypeScript app managed with npm workspaces:

- `client/` — React 18 + Vite PWA (dev port 5173, preview port 4173)
- `server/` — Express API + JSON file store (port 3001)

## Commands (run from repo root)

| Command | Description |
| --- | --- |
| `npm run dev` | Run API + client together |
| `npm run build` | Build server + client (emits the PWA service worker) |
| `npm run typecheck` | Type-check both workspaces |
| `npm run lint` | Lint both workspaces |
| `npm run test` | Run the API test suite |

Always run `npm run typecheck`, `npm run lint`, and `npm run test` before
committing.
