# GradeBoss

GradeBoss is the ultimate solution for the most demanding school tasks, from teachers to admins.

It is an **offline-first** web app (PWA) for managing classes, students,
courses, and grades, with a live dashboard that tracks student standings and course
performance. All school data lives on your device. Sign-in uses Google and is
limited to DepEd accounts.

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

That's it — open http://localhost:5173 and sign in with a DepEd Google account
(see below). After the first sign-in the app works fully offline and can be
installed to your device (Add to Home Screen).

## Google Sign-In

Only `@deped.gov.ph` Google accounts can sign up or sign in. One designated
Gmail address is allowed as super admin.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID of type **Web application**.
2. Add authorized JavaScript origins: `http://localhost:5173` and your production
   origin (for example `https://your-app.vercel.app`).
3. Copy `client/.env.example` to `client/.env.local` and set `VITE_GOOGLE_CLIENT_ID`
   to that client ID.
4. On Vercel, set the same `VITE_GOOGLE_CLIENT_ID` environment variable, then
   redeploy.

Restart `npm run dev` after changing `.env.local`. Sign-in requires a network
connection; the profile is then stored on-device (`gradeboss:auth`) so the PWA
keeps working offline.

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
  the signed-in Google profile is stored under `gradeboss:auth`.
- School records are not sent to a server. Clearing site data signs you out and
  resets the app to seed data.

## Deployment

The app is a static site. `vercel.json` builds the client (`npm run build --workspace
client`) and serves `client/dist`. Set `VITE_GOOGLE_CLIENT_ID` in the Vercel project
environment. No backend is required.

## Cloud Agent environment

`.cursor/environment.json` runs `npm install` and launches the client dev server on
port 5173.
