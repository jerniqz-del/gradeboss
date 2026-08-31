# GradeBoss

GradeBoss is the ultimate solution for the most demanding school tasks, from teachers to admins.

It is a full-stack web app for managing students, courses, and grades, with a live
dashboard that tracks student standings and course performance.

## Tech stack

- **Client**: React 18 + TypeScript + Vite
- **Server**: Express + TypeScript (Node's built-in test runner for API tests)
- **Storage**: dependency-free JSON file store (seeded automatically on first run)
- **Tooling**: npm workspaces, ESLint (flat config), TypeScript

## Project layout

```
.
├── client/   # React + Vite frontend (port 5173)
├── server/   # Express API (port 3001)
└── package.json  # npm workspaces + root scripts
```

## Getting started

Requires Node.js >= 20.

```bash
npm install     # install all workspace dependencies
npm run dev     # start API (3001) and web client (5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the
Express API, so no extra configuration is needed.

## Useful scripts

Run from the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and client together |
| `npm run dev:server` | Run only the API |
| `npm run dev:client` | Run only the web client |
| `npm run build` | Build the server and client for production |
| `npm run start` | Run the compiled API server |
| `npm run typecheck` | Type-check both workspaces |
| `npm run lint` | Lint both workspaces |
| `npm run test` | Run the API test suite |

## API overview

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Service health check |
| GET | `/api/students` | List students |
| POST | `/api/students` | Create a student |
| DELETE | `/api/students/:id` | Remove a student |
| GET | `/api/courses` | List courses |
| POST | `/api/courses` | Create a course |
| GET | `/api/grades` | List grades |
| POST | `/api/grades` | Record a grade |
| GET | `/api/stats` | Aggregate dashboard statistics |

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent dev environment: it runs
`npm install`, then launches the `server` and `client` dev servers as terminals
and exposes ports 3001 and 5173.
