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

That's it — open http://localhost:5173 and create a **local profile**. After that
the app works offline and can be installed (Add to Home Screen).

## Local profile first, then school Cloudflare

1. Every person creates a **local profile**. Data stays on the device under
   `Documents/ecrecord_users_local`.
2. The **school admin** creates the school Cloudflare account with the official
   DepEd email, then in Profile marks Cloudflare ready and issues **teaching**
   or **non-teaching** accounts.
3. When that person’s school-issued email exists and Cloudflare is ready, they
   open Profile → **Sync local profile** and enter the email (and PIN) the admin
   gave them.

There is no Google Sign-In. Cloudflare Access can later sit in front of the
deployed PWA using those same school-issued emails.

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
