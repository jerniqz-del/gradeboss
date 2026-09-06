# GradeBoss

GradeBoss is the ultimate solution for the most demanding school tasks, from teachers to admins.

It is an **offline-first** web app (PWA) for managing classes, students,
courses, and grades, with a live dashboard that tracks student standings and course
performance. All school data lives on your device. There is no Google Sign-In.
The school admin registers with the official DepEd email (the same address used
for the school’s Cloudflare account). Personnel sign in with the DepEd emails
the school issued, or with a local profile.

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

That's it — open http://localhost:5173. Create the school admin account with the
official `@deped.gov.ph` email, or use a local profile. After that the app works
offline and can be installed (Add to Home Screen).

## School accounts (no Google)

The school admin creates a Cloudflare account using the school’s official DepEd
email, then issues DepEd emails to personnel. GradeBoss sign-in uses those
addresses plus an optional PIN — not Google OAuth.

1. First `@deped.gov.ph` account on a device becomes **School admin**.
2. Later emails on the same device sign in as teachers.
3. Optional: put the deployed PWA behind **Cloudflare Access** so only those
   school-issued emails can reach the site.

A **local profile** still writes `Documents/ecrecord_users_local` for fully
offline teachers.

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
  `localStorage`; classes imported from SF1 are stored under `gradeboss:classes`;
  the signed-in profile is stored under `gradeboss:auth`.
- School records are not sent to a server. Clearing site data signs you out and
  resets the app to seed data.

## Deployment

The app is a static site. `vercel.json` builds the client (`npm run build --workspace
client`) and serves `client/dist`. No Google client ID is required. No backend is
required. Optional: Cloudflare Access in front of the site.

## Cloud Agent environment

`.cursor/environment.json` runs `npm install` and launches the client dev server on
port 5173.
