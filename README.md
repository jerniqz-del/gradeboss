# GradeBoss

GradeBoss is the ultimate solution for the most demanding school tasks, from teachers to admins.

It is an **offline-first, local-only** web app (PWA) for managing classes, students,
courses, and grades, with a live dashboard that tracks student standings and course
performance. All data lives on your device — there is **no backend and no sign-in**.

## Tech stack

- **Client**: React 18 + TypeScript + Vite (PWA via `vite-plugin-pwa`)
- **Storage**: on-device `localStorage` (seeded automatically on first run)
- **SF1 import**: DepEd School Form 1 (`.xls`/`.xlsx`) parsing via SheetJS
- **Tooling**: npm workspaces, ESLint (flat config), TypeScript

## Project layout

```
.
├── client/       # React + Vite PWA (port 5173) — the whole app
├── planning/     # design docs (sync bridge spec, pricing model)
└── package.json  # npm workspaces + root scripts
```

## Getting started

Requires Node.js >= 20.

```bash
npm install     # install dependencies
npm run dev     # start the web client at http://localhost:5173
```

That's it — open http://localhost:5173. The app works fully offline and can be
installed to your device (Add to Home Screen).

## Useful scripts

Run from the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | Run the web client |
| `npm run build` | Build the client for production (emits the PWA service worker) |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Type-check the client |
| `npm run lint` | Lint the client |

## Data & storage

- Students, courses, and grades are stored under the `gradeboss:data` key in
  `localStorage`; classes imported from SF1 are stored under `gradeboss:classes`.
- Nothing is sent to a server. Clearing site data resets the app to seed data.

## Deployment

The app is a static site. `vercel.json` builds the client (`npm run build --workspace
client`) and serves `client/dist`. No backend or environment variables are required.

## Cloud Agent environment

`.cursor/environment.json` runs `npm install` and launches the client dev server on
port 5173.
