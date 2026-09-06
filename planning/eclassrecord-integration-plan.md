# E-Class Record → GradeBoss Integration Plan

> **Living document.** This file is the single source of truth for porting
> [jerniqz-del/eclassrecord](https://github.com/jerniqz-del/eclassrecord) desktop
> features into the GradeBoss PWA. Update the **Phase status** table and
> **Progress log** whenever a phase starts, completes, or is blocked.

| Field | Value |
| --- | --- |
| **Created** | 2026-09-05 |
| **Last updated** | 2026-09-06 |
| **Source repo** | `jerniqz-del/eclassrecord` (Electron desktop, v1.9.x) |
| **Target repo** | `jerniqz-del/gradeboss` (React PWA, v1.0.x) |
| **Overall status** | 🔄 Phase 11 complete — Phase 12 next |
| **Active phase** | 12 (Calendar & workplace dashboard) |

---

## 1. Purpose

GradeBoss is an offline-first DepEd PWA. E-Class Record is a mature desktop app
with full DepEd-compliant grading, advisory consolidation, attendance, exports, and
teacher tools. This plan defines **phased work** to duplicate E-Class Record's
features in GradeBoss while preserving GradeBoss golden rules:

- Responsive & adaptive (mobile-first, 600px / 900px breakpoints, safe areas)
- Installable & offline-capable (PWA, service worker, runtime caching)
- Google DepEd sign-in (GradeBoss-specific; E-Class Record uses local PIN profiles)

Each phase has **entry criteria**, **deliverables**, **acceptance tests**, and a
**status** that must be updated when the phase finishes.

---

## 2. Executive summary

### What E-Class Record has (desktop)

| Area | Scope |
| --- | --- |
| **Grading engine** | WW / PT / ST1 / ST2 / TE components, HPS, 3 terms, transmutation (DO 015 transition & zero-based, DO 8 legacy, KS2 trimester, G1–3 descriptive), MAPEH split, SHS subject presets |
| **Teaching loads** | Grade 1–12 + SHS catalog, section, subject, policy auto-detection, component weights |
| **Roster** | SF1 import, CSV paste, learner transfer, LRN, avatars, sex-block sort |
| **Advisory** | Grade consolidation, General Average, Grade Transfer File JSON import/export |
| **Attendance** | Monthly grid, roll call, SF2 PDF |
| **Exports** | CSV, Excel (official DepEd templates), PDF (class record, learner reports, SF2), print CSS |
| **Teacher tools** | Performance checklist, randomizer, name picker, grade simulator, classroom mgmt, offline games |
| **Calendar** | Official DepEd calendar pack + local events + birthdays |
| **Data safety** | JSON backup (PIN-encrypted), multi-profile, integrity checker, shared-folder sync, Android companion |
| **UI** | 13 primary views, dense score grid, keyboard navigation, dashboard workplace |

~76 renderer JS modules, ~1,083 lines in `grading.js` alone, 50+ Node test scripts.

### What GradeBoss has today (web)

| Area | Scope |
| --- | --- |
| **Auth** | Google OAuth (`@deped.gov.ph`), offline profile cache |
| **Storage** | IndexedDB schema v2 (`teachingLoads`, profile, legacy gradebook, advisory); `localStorage` kept as SF1 history + migration source |
| **SF1** | Import links to matching teaching-load rosters (grade + section + SY) |
| **Gradebook** | DepEd teaching loads + score grid (WW/PT/ST/TE, terms, transmutation); G1–12 |
| **Advisory** | One active class per SY, grade matrix, GA (MAPEH once), GTF v1.0 export/import |
| **Views** | Dashboard, Advisory, Attendance, Classes, Students, Loads, Sheet, Plans (backup), Profile |
| **Exports** | CSV, JSON backup, DepEd ECR Excel, class-record / learner / completion / analysis / advisory / SF2 PDFs |
| **PWA** | Vite + Workbox, offline banner, install prompt; `/templates/` CacheFirst for optional ECR overlay |
| **UI** | Material-inspired flat + elevation, light/dark/system themes |
| **Planning** | Sync bridge spec (`planning/sync-bridge-spec.md`), pricing page |

### Critical architectural gaps

1. **~~Disconnected data~~** — Phase 4 links SF1 imports to teaching-load rosters (LRN merge). `gradeboss:classes` remains an import history.
2. **No DepEd grading model** — no components, terms, weights, transmutation, or policy modes.
3. **Storage too shallow** — flat `Student` / `Course` / `Grade` cannot hold assessments, HPS, or term structure.
4. **~~No exports~~** — Phase 6 CSV/JSON/print; Phase 8 SF2 PDF; Phase 9 Excel + class/learner/advisory PDFs.
5. **~~Electron-only I/O~~** — CSV/JSON File API (Phase 6); SF2/class/learner/advisory PDFs and SheetJS Excel in the browser (Phases 8–9).

---

## 3. Target architecture (GradeBoss)

```
client/src/
├── domain/                 # Pure TS: grading formulas, transmutation, policy detection
├── models/                 # TeachingLoad, Learner, Assessment, Score, Advisory, Attendance
├── storage/                # IndexedDB (primary) + localStorage migration layer
├── features/
│   ├── teaching-loads/
│   ├── grading-sheet/
│   ├── advisory/
│   ├── attendance/
│   ├── exports/
│   ├── teacher-tools/
│   └── calendar/
├── components/             # Shared UI (tables, score cells, modals)
└── App.tsx                 # Shell + routing (split from monolith over time)
```

**Storage migration:** Move from `localStorage` to **IndexedDB** (via `idb` or Dexie) for
schema v1 with versioning. Keep `localStorage` keys as migration source. Align with
`planning/sync-bridge-spec.md` (outbox + E2EE envelopes) in Phase 11.

**Computation rule:** All DepEd math lives in `domain/` as pure functions with unit tests
ported from E-Class Record's `scripts/test-*.js` patterns.

---

## 4. Phase status tracker

Update this table when a phase changes state. Use: ⬜ Not started · 🔄 In progress · ✅ Complete · ⏸ Blocked

| Phase | Name | Status | Started | Completed | PR / notes |
| --- | --- | --- | --- | --- | --- |
| 0 | Discovery & parity mapping | ✅ Complete | 2026-09-05 | 2026-09-05 | This document |
| 1 | Data foundation & storage | ✅ Complete | 2026-09-05 | 2026-09-05 | PR #4 |
| 2 | DepEd grading engine (domain) | ✅ Complete | 2026-09-05 | 2026-09-05 | [PR #5](https://github.com/jerniqz-del/gradeboss/pull/5) (stacked on #4) |
| 3 | Teaching loads & score grid UI | ✅ Complete | 2026-09-05 | 2026-09-05 | [PR #6](https://github.com/jerniqz-del/gradeboss/pull/6) |
| 4 | Roster operations & SF1 linking | ✅ Complete | 2026-09-05 | 2026-09-05 | [PR #7](https://github.com/jerniqz-del/gradeboss/pull/7) |
| 5 | Term summary, pass/fail & dashboard | ✅ Complete | 2026-09-05 | 2026-09-05 | [PR #8](https://github.com/jerniqz-del/gradeboss/pull/8) |
| 6 | Export, print & backup (CSV/JSON) | ✅ Complete | 2026-09-06 | 2026-09-06 | [PR #9](https://github.com/jerniqz-del/gradeboss/pull/9) (stacked on #8) |
| 7 | Advisory class & grade transfer | ✅ Complete | 2026-09-06 | 2026-09-06 | [PR #10](https://github.com/jerniqz-del/gradeboss/pull/10) (stacked on #9) |
| 8 | Attendance tracker & SF2 | ✅ Complete | 2026-09-06 | 2026-09-06 | [PR #11](https://github.com/jerniqz-del/gradeboss/pull/11) |
| 9 | Excel & PDF reports | ✅ Complete | 2026-09-06 | 2026-09-06 | [PR #12](https://github.com/jerniqz-del/gradeboss/pull/12) |
| 10 | Performance checklist & quick grade | ✅ Complete | 2026-09-06 | 2026-09-06 | [PR #13](https://github.com/jerniqz-del/gradeboss/pull/13) |
| 11 | Teacher tools & classroom suite | ✅ Complete | 2026-09-06 | 2026-09-06 | P1+P2; P3/P4 deferred |
| 12 | Calendar & workplace dashboard | ⬜ Not started | — | — | |
| 13 | Encrypted backup, sync bridge & mobile | ⬜ Not started | — | — | |
| 14 | Help center, polish & release parity | ⬜ Not started | — | — | |

---

## 5. Phase details

### Phase 0 — Discovery & parity mapping ✅

**Goal:** Understand E-Class Record scope and define phased port strategy.

**Deliverables:**
- [x] Repo review (`jerniqz-del/eclassrecord`)
- [x] Feature inventory and gap analysis vs GradeBoss
- [x] This living plan document

**Key source files reviewed:**

| E-Class Record path | Purpose |
| --- | --- |
| `src/renderer/js/grading.js` | DepEd computation engine |
| `src/renderer/js/database.js` | Profile DB schema v7 |
| `src/renderer/js/classroom-records-core.js` | Teaching load CRUD |
| `src/renderer/js/advisory-*.js` | Advisory subsystem (8 modules) |
| `src/renderer/js/import-export.js` | CSV/JSON backup |
| `src/main/excel-exporter.js` | DepEd Excel template fill |
| `src/main/sf1-reader.js` | SF1 spreadsheet parser |
| `docs/grade-transfer-schema-v1.0.md` | Advisory grade exchange format |

**Acceptance:** Plan approved; Phase 1 entry criteria met.

---

### Phase 1 — Data foundation & storage ✅

**Goal:** Replace flat gradebook storage with a DepEd-ready schema and IndexedDB layer.

**Entry criteria:** Phase 0 complete.

**Work items:**

1. Define TypeScript models mirroring E-Class Record `Assignment`, `Learner`, `Assessment`, `Score`:
   - `TeachingLoad` (gradeLevel, section, subject, subjectGroup, policy, schoolYear, weights)
   - `Learner` (LRN, name parts, sex, birthdate, modality, remarks, avatarPresetId)
   - `Assessment` (term, component WW|PT|ST1|ST2|TE, title, maxScore/HPS, date, mapePart?)
   - `Score` (learnerId, assessmentId, value)
   - `TeacherProfile` (name, schoolId, schoolName, region, division, district, schoolYear, currentTerm)
2. Implement IndexedDB store with schema versioning and migration from existing `localStorage` keys.
3. Unify `gradeboss:classes` SF1 imports into `TeachingLoad` entities (optional link at first, full merge in Phase 4).
4. Add repository layer (`storage/teaching-loads.ts`, etc.) replacing direct `api.ts` CRUD.
5. Seed data updated to demonstrate one sample teaching load with term structure.

**E-Class Record reference:** `database.js`, `classroom-records-core.js`

**Deliverables:**
- [x] IndexedDB schema v1 + migration script (`client/src/storage/`)
- [x] Type definitions in `client/src/models/`
- [x] Repository tests (Vitest — `client/src/storage/migrate.test.ts`)
- [x] Legacy `Student`/`Course`/`Grade` compat shim via `legacyGradebook` store + `api.ts`

**Acceptance tests:**
- [x] Fresh install seeds sample teaching load in IndexedDB
- [x] Existing `localStorage` data migrates without loss
- [x] App loads offline after migration (PWA build unchanged)
- [x] `npm run typecheck`, `lint`, `test` pass

**Exit criteria:** All deliverables merged; Phase status → ✅; Progress log updated.

---

### Phase 2 — DepEd grading engine (domain) ✅

**Goal:** Port computation logic from `grading.js` to pure TypeScript with full test coverage.

**Entry criteria:** Phase 1 models exist.

**Work items:**

1. Port transmutation tables:
   - `DO15_TRANSITION` (41-step adjusted table, SY 2026–2027)
   - `DO15_ZERO` (rounded IG, SY 2027–2028+)
   - `DO15_DESCRIPTIVE` (A–E for Grades 1–3)
   - `KEY_STAGE_2_TRIMESTER` (Grades 4–6)
   - Legacy DO 8 s. 2015 compatibility
2. Implement component PS, exam PS (ST1×30% + ST2×30% + TE×40%), initial grade, transmuted grade.
3. Policy auto-detection from grade level + subject (mirror E-Class Record presets).
4. Weight presets: Core 20/50/30, Skills 20/60/20, SHS group variants.
5. MAPEH: separate `music_arts` / `pe_health` parts; consolidated average.
6. Pass/fail rules (≥75 numeric; A/B/C descriptive).

**E-Class Record reference:** `grading.js`, `scripts/test-grading*.js`, `scripts/test-transmutation*.js`

**Deliverables:**
- [x] `client/src/domain/grading/` module
- [x] 40+ unit tests covering edge cases from desktop test scripts
- [x] Policy detection helper
- [x] Exported API documented in code

**Acceptance tests:**
- Golden-file tests match E-Class Record outputs for sample inputs
- All transmutation boundaries (e.g. IG 99.50 → TG 100) verified
- MAPEH consolidation matches desktop

**Exit criteria:** Engine tested in isolation; no UI dependency.

---

### Phase 3 — Teaching loads & score grid UI ✅

**Goal:** Replace generic Courses/Gradebook with DepEd grading sheet experience.

**Entry criteria:** Phases 1–2 complete.

**Work items:**

1. **Teaching Loads view** — create/edit/delete loads; grade, section, subject picker; SHS catalog; policy + weights display.
2. **Grading Sheet view** — term tabs (1, 2, 3, Summary); dense score grid; HPS row; component column groups (WW 1–5, PT 1–3, ST1, ST2, TE).
3. Keyboard navigation (Arrow / Enter) for score cells.
4. Inline HPS adjustment per assessment column.
5. Real-time computed PS, IG, TG columns (read-only) using Phase 2 engine.
6. MAPEH dual-sheet toggle (Music & Arts / PE & Health).
7. Mobile: horizontally scrollable grid with sticky learner names; desktop: full grid.

**E-Class Record reference:** `record` view, `grading.js` renderers, score grid CSS modules

**Deliverables:**
- [x] `features/teaching-loads/` and `features/grading-sheet/` React modules
- [x] Responsive score grid component
- [x] Navigation updates (replace Courses + Gradebook with Loads + Grading Sheet)

**Acceptance tests:**
- Enter scores for 30 learners × 10 assessments; computed grades match Phase 2 tests
- Grid usable at 390px, 768px, 1280px widths
- Works offline after first load

**Exit criteria:** Teachers can manage loads and enter term scores end-to-end.

---

### Phase 4 — Roster operations & SF1 linking ✅

**Goal:** Full learner management connected to teaching loads.

**Entry criteria:** Phase 3 score grid exists.

**Work items:**

1. Link SF1 import → create/update teaching load roster (merge with existing `sf1.ts` parser).
2. Manual learner CRUD (LRN, last/first/middle name, extension, sex, birthdate, modality, remarks).
3. DepEd roster sort (male block, then female).
4. Bulk CSV paste import.
5. Clone roster from another teaching load.
6. Learner transfer between sections (transferred-out / transferred-in grade handling).
7. Learner avatars (100 bundled presets, auto by sex, manual override) — static assets precached in PWA.
8. Extend grade levels to 1–12 (remove G9–12-only restriction).

**E-Class Record reference:** `learners.js`, `import-export.js`, `learner-avatars.js` (no `sf1-import.js` / `learner-transfer.js` in desktop)

**Deliverables:**
- [x] Roster panel in Teaching Loads view (`features/roster/`)
- [x] SF1 → load workflow (Classes import applies roster to matching grade/section/SY loads)
- [x] Avatar picker (procedural SVG, 50M + 50F + 1 neutral — same as desktop; no PNG bundle)

**Acceptance tests:**
- [x] Generated SF1 `.xlsx` import places learners on the matching teaching load and score grid
- [x] Transfer learner preserves completed term grades as T/I and marks later terms T/O
- [x] Roster sort is male block → female block → Filipino alpha

**Exit criteria:** SF1 classes and gradebook fully unified.

---

### Phase 5 — Term summary, pass/fail & dashboard ✅

**Goal:** Summary grades and dashboard reflect DepEd completion state.

**Entry criteria:** Phase 3 grading sheet functional.

**Work items:**

1. [x] Summary tab: term final grades, annual average, pass/fail badges (≥75).
2. [x] Descriptive grade display for G1–3 policy.
3. [x] Dashboard cards per teaching load: completion %, missing scores, class average.
4. [x] Student standings table using transmuted grades (not flat percentage).
5. [x] Course/subject performance bars by term.
6. [x] Workplace-style pending tasks (missing HPS, incomplete terms) — lightweight v1.

**E-Class Record reference:** `dashboard.js`, `dashboard-grade-insights.js`, Summary tab in grading sheet

**Deliverables:**
- [x] Updated Dashboard view (`features/dashboard/DashboardView.tsx`)
- [x] Summary computation hooks in domain layer (`domain/grading/summary.ts`, `insights.ts`)

**Acceptance tests:**
- [x] Summary matches manual calculation for sample class
- [x] Dashboard completion % accurate when scores missing

**Exit criteria:** Dashboard reflects real DepEd grading state.

---

### Phase 6 — Export, print & backup (CSV/JSON) ✅

**Goal:** Data portability matching desktop JSON/CSV backup.

**Entry criteria:** Phase 5 summary grades computed.

**Work items:**

1. [x] **CSV export** — term grid and summary (download via Blob).
2. [x] **JSON backup/restore** — full profile export/import via File API.
3. [x] **Print CSS** — `@media print` for grading sheet and summary (landscape option).
4. [x] Replace Plans page "Export & import backup" placeholder with working feature.
5. [x] Optional: local PIN wrap for backup files (port from E-Class Record encrypted envelope).

**E-Class Record reference:** `import-export.js`, `backup-recovery.js`, print CSS modules

**Deliverables:**
- [x] Export menu in Settings or Profile (`BackupPanel` on Plans + Profile; CSV/print on the sheet)
- [x] Import with validation + merge strategy
- [x] Print stylesheet

**Acceptance tests:**
- [x] Export → clear storage → import restores all loads and scores
- [x] Printed output readable on A4 landscape

**Exit criteria:** Teachers can backup and restore offline data.

---

### Phase 7 — Advisory class & grade transfer ✅

**Goal:** Adviser dashboard with grade consolidation and offline exchange.

**Entry criteria:** Phase 5 summary grades; Phase 6 JSON I/O.

**Work items:**

1. Advisory store schema (classes, learners, subjects, grades, import batches) — port from `advisory-data.js`.
2. One active advisory class per school year.
3. Grade consolidation matrix: learner × subject × term.
4. General Average computation (included subjects only; MAPEH as Music&Arts + PE&Health).
5. **Grade Transfer File** JSON v1.0 — export from subject teacher loads; import to advisory with LRN match, conflict resolution, audit trail.
6. Special classes (Journalism, etc.) with GA inclusion toggle.
7. Advisory grade report view.

**E-Class Record reference:** `advisory-*.js` (8 modules), `docs/grade-transfer-schema-v1.0.md`, `docs/advisory-class-guide.md`

**Deliverables:**
- [x] Advisory view (new nav item)
- [x] Grade transfer import/export UI
- [x] GA computation tests

**Acceptance tests:**
- [x] Subject teacher exports term finals → adviser imports → GA matches expected
- [x] Import conflict UI handles duplicate LRN grades
- [x] Round-trip JSON validates against schema v1.0

**Exit criteria:** Advisory workflow matches desktop core path.

---

### Phase 8 — Attendance tracker & SF2 ✅

**Goal:** Monthly attendance with SF2 output.

**Entry criteria:** Phase 4 roster linked to loads.

**Work items:**

1. [x] Monthly attendance grid per teaching load.
2. [x] Statuses: present, absent, tardy, excused, no classes.
3. [x] Roll-call modal, filters, statistics.
4. [x] SF2 PDF generation (client-side: jsPDF or pdfmake).
5. [x] Print layout for SF2 (`@page` landscape).

**E-Class Record reference:** `attendance-*.js`, SF2 PDF templates in main process (reimplement in browser)

**Deliverables:**
- [x] Attendance view (`features/attendance/`)
- [x] SF2 PDF download (`sf2-pdf.ts`, lazy-loaded)

**Acceptance tests:**
- [x] Month grid persists offline
- [x] SF2 present counts match grid totals
- [x] PDF renders on mobile and desktop

**Exit criteria:** SF2 generation works without Electron.

---

### Phase 9 — Excel & PDF reports

**Goal:** Official DepEd Excel templates and class record PDFs.

**Entry criteria:** Phases 3, 5, 7 stable.

**Work items:**

1. [x] Port `excel-exporter.js` logic to client-side SheetJS template fill.
2. [x] Official DepEd ECR cell map generated in-browser (optional `/templates/ecr.xlsx` overlay; not bundling 1.3MB `Templates.xlsx`).
3. [x] PDF class record (per term + summary, plus full-year) — client-side jsPDF.
4. [x] Learner progress cards PDF.
5. [x] Term completion report PDF.
6. [x] Compact class analysis PDF (stats + item MPS + ranking; full UI remains Phase 11).
7. [x] Advisory grade report PDF (finals / terms 1–3).

**E-Class Record reference:** `src/main/excel-exporter.js`, PDF generation in `main.js`

**Deliverables:**
- [x] Excel export action per teaching load (`features/exports/excel.ts`)
- [x] PDF report menu on the grading sheet + Advisory PDF buttons
- [x] Template asset management (`/templates/` CacheFirst; generated skeleton offline)

**Acceptance tests:**
- [x] Exported Excel is a valid `.xlsx` with TERM/SUMMARY (or MAPEH) sheets and official cell refs (B13 males, B64 females, HPS F11)
- [x] PDF blobs are `%PDF` and cover class record, learner cards, completion, analysis, and advisory

**Exit criteria:** Primary export formats available in browser.

---

### Phase 10 — Performance checklist & quick grade

**Goal:** Checklist workflow and faster score entry.

**Entry criteria:** Phase 3 score grid.

**Work items:**

1. [x] Performance Checklist view — repeatable criteria columns (Recitation, Notebook, Assignment, custom).
2. [x] HPS-aware +/- controls, bulk mark, notes, undo/reset.
3. [x] PIN-confirmed publication to compatible WW/PT scores (optional local PIN from Phase 6).
4. [x] Quick Grade Entry wizard (sequential learner scoring).
5. [x] Score history / undo-redo stack for grading sheet.
6. [x] Score transfer between classes (preview + confirm).

**E-Class Record reference:** `performance-checklist.js`, quick grade modals, score history modules

**Deliverables:**
- [x] Checklist feature module (`features/checklist/`, `domain/checklist/`)
- [x] Quick grade overlay
- [x] Undo/redo for score grid

**Acceptance tests:**
- [x] Publish checklist → WW column updates with correct HPS cap
- [x] Undo restores prior score state

**Exit criteria:** Checklist-to-grade pipeline works.

---

### Phase 11 — Teacher tools & classroom suite ✅

**Goal:** Classroom management utilities from desktop app.

**Entry criteria:** Phase 4 roster with avatars.

**Work items (prioritized sub-deliveries):**

| Priority | Feature | E-Class Record module |
| --- | --- | --- |
| P1 | Group Randomizer (sex-balanced, printable) | randomizer modules |
| P1 | Name Picker (no-repeat roulette + avatars) | name picker modules |
| P1 | Grade Simulator (what-if scoring) | simulator |
| P2 | Class Analysis (stats, rankings, distribution) | `class-analysis.js` |
| P3 | Classroom timer, agenda, participation tracker | classroom-management-*.js — deferred to Phase 12+ |
| P3 | Seating chart, exit tickets, anecdotal notes | deferred to Phase 12+ |
| P4 | Offline games (2048, Sudoku, etc.) | deferred (PWA cache size) |

**Deliverables:**
- [x] Teacher Tools view (new nav section)
- [x] P1 features first; P3/P4 optional stretch (deferred)

**Acceptance tests:**
- [x] Randomizer produces balanced groups for sample roster
- [x] Simulator recomputes TG using Phase 2 engine

**Exit criteria:** P1 tools shipped; P3/P4 tracked as follow-ups if deferred.

---

### Phase 12 — Calendar & workplace dashboard

**Goal:** School calendar integration and task-oriented dashboard.

**Entry criteria:** Phase 5 dashboard basics.

**Work items:**

1. Import `deped-calendar.json` from E-Class Record `data/` (official holidays/events).
2. Local events + learner birthdays (Feb 29 handling).
3. Calendar view with class-scoped filters.
4. Dashboard workplace panel: pending imports, missing grades, advisory conflicts.
5. Dashboard optimization analytics (component performance insights).

**E-Class Record reference:** `calendar.js`, `calendar-*.js`, `dashboard-workplace*.js`

**Deliverables:**
- Calendar view
- Enhanced dashboard task list

**Acceptance tests:**
- Official DepEd dates display for current SY
- Birthday indicators appear for roster birthdates

**Exit criteria:** Calendar and workplace tasks visible on dashboard.

---

### Phase 13 — Encrypted backup, sync bridge & mobile

**Goal:** Multi-device sync and optional mobile companion parity.

**Entry criteria:** Phase 6 backup; `planning/sync-bridge-spec.md` reviewed.

**Work items:**

1. Implement local outbox / change-log on IndexedDB records.
2. Client-side E2EE envelope encryption (WebCrypto AES-GCM).
3. Cloudflare Worker sync bridge (auth, push/pull/ack) per sync spec.
4. Device pairing (QR + PIN) for enrolling second device.
5. Billing integration (PayMongo) tied to Plans page.
6. Evaluate Android companion: PWA-only vs future Capacitor wrapper vs BLE sync deferral.

**E-Class Record reference:** `shared-folder-sync.js`, `mobile-sync.js`, Android app in `android/`

**Deliverables:**
- Sync client in GradeBoss
- Worker deployment (separate repo or `workers/` in gradeboss)
- Updated Plans page with working checkout

**Acceptance tests:**
- Two browsers sync score change within 60s when online
- Offline edits merge without data loss
- Free tier = 1 device enforced

**Exit criteria:** Paid sync feature operational per pricing model.

**Note:** Desktop shared-folder sync is Electron-specific; web equivalent is cloud bridge or LAN WebRTC (spec open decision #3 in sync-bridge-spec).

---

### Phase 14 — Help center, polish & release parity

**Goal:** Production-ready UX, documentation, and remaining desktop polish.

**Entry criteria:** Phases 1–13 substantially complete.

**Work items:**

1. Help Center (searchable topics ported from E-Class Record docs).
2. Guided onboarding tour (12-step equivalent, adapted for web).
3. Settings view: teacher profile, school info, preferences (auto-blur/spectator, numerical equivalents, trimester layout toggle).
4. Database integrity checker + repair.
5. Low-spec performance mode (reduce animations).
6. Changelog / welcome modal on version bump.
7. Admin test mode with mock data (super-admin only).
8. Final responsive + PWA audit (390 / 768 / 1280px; offline reload all routes).
9. Comprehensive E2E test suite (Playwright).

**E-Class Record reference:** `help.js`, `help-assistant.js`, `settings` view, `admin-testing.js`

**Deliverables:**
- Help & Settings views
- E2E test CI workflow
- Release checklist doc

**Acceptance tests:**
- New teacher completes tour and enters first grade without docs
- All nav routes work offline after SW precache
- E2E covers SF1 import → score entry → export

**Exit criteria:** Feature parity sign-off against Phase 0 inventory.

---

## 6. E-Class Record → GradeBoss module mapping

| E-Class Record module | GradeBoss target | Phase |
| --- | --- | --- |
| `database.js` | `storage/db.ts` | 1 |
| `grading.js` | `domain/grading/` | 2 |
| `classroom-records-core.js` | `features/teaching-loads/` | 3 |
| Score grid renderers | `features/grading-sheet/` | 3 |
| `sf1-reader.js` + import UI | Extend `sf1.ts` + Phase 4 UI | 4 |
| `learners.js` | `features/roster/` | 4 |
| `dashboard*.js` | `features/dashboard/` | 5, 12 |
| `import-export.js` | `features/exports/` | 6 |
| `advisory-*.js` | `features/advisory/` | 7 |
| `attendance-*.js` | `features/attendance/` | 8 |
| `excel-exporter.js` | `features/exports/excel.ts` | 9 |
| PDF in `main.js` | `features/exports/pdf.ts` | 9 |
| Performance checklist | `features/checklist/` | 10 |
| Randomizer / name picker | `features/teacher-tools/` | 11 |
| `calendar*.js` | `features/calendar/` | 12 |
| Shared-folder / mobile sync | `features/sync/` + Worker | 13 |
| `help.js`, settings | `features/settings/`, `features/help/` | 14 |

---

## 7. Cross-cutting requirements (every phase)

- [ ] Mobile-first CSS; reuse 600px / 900px breakpoints
- [ ] Touch targets ≥ 44px; form inputs 16px
- [ ] Safe-area insets on nav chrome
- [ ] New static assets added to PWA precache (`vite.config.ts`)
- [ ] New GET routes covered by `navigateFallback`
- [ ] Offline state surfaced (existing offline banner)
- [ ] `npm run typecheck`, `lint`, `test` before merge
- [ ] Update **this file** when phase completes

---

## 8. Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| IndexedDB migration breaks existing users | High | Versioned schema; export before migrate; rollback path |
| Grading formula drift vs desktop | High | Golden-file tests from E-Class Record scripts |
| Excel/PDF in browser vs Electron | Medium | SheetJS + jsPDF; visual QA against desktop output |
| PWA cache size (templates, avatars, games) | Medium | Lazy load; optional downloads; tier assets by phase |
| Monolithic `App.tsx` growth | Medium | Split by feature modules starting Phase 3 |
| Android BLE sync not portable to web | Low | Defer to PWA + cloud sync; document limitation |
| SF9/SF10 not in E-Class Record | N/A | Out of scope unless added to desktop first |

---

## 9. Out of scope (unless desktop adds them)

- SF9 / SF10 generation (not implemented in E-Class Record desktop)
- NSIS installer / Electron auto-updater (PWA uses service worker updates)
- Sidebar sponsor ads / community relay
- School Cloud grade pilot (optional Phase 13+ extension)
- Windows-only shared-folder sync (replace with cloud bridge)

---

## 10. Progress log

Append a row when a phase status changes. **Do not delete entries.**

| Date | Phase | Event | Updated by |
| --- | --- | --- | --- |
| 2026-09-05 | 0 | Discovery complete; initial plan published | Agent |
| 2026-09-05 | 1 | Started Phase 1 — data foundation & storage | Agent |
| 2026-09-05 | 1 | Phase 1 complete — IndexedDB schema v1, models, migration, repositories, Vitest | Agent |
| 2026-09-05 | 2 | Started Phase 2 — DepEd grading engine (domain) | Agent |
| 2026-09-05 | 2 | Phase 2 complete — TS grading engine, transmutation tables, golden-file tests vs eclassrecord `grading.js` | Agent |
| 2026-09-05 | 3 | Started Phase 3 — teaching loads & score grid UI | Agent |
| 2026-09-05 | 3 | Phase 3 complete — Loads + grading sheet UI, live PS/IG/TG, MAPEH tabs, summary | Agent |
| 2026-09-05 | 4 | Started Phase 4 — roster operations & SF1 linking | Agent |
| 2026-09-05 | 4 | Phase 4 complete — SF1→load merge, learner CRUD, DepEd sort, CSV/clone/transfer, procedural avatars, G1–12 | Agent |
| 2026-09-05 | 5 | Started Phase 5 — term summary, pass/fail & dashboard | Agent |
| 2026-09-05 | 5 | Phase 5 complete — year-result/insights domain, summary pass/fail, DepEd dashboard | Agent |
| 2026-09-06 | 6 | Started Phase 6 — export, print & backup | Agent |
| 2026-09-06 | 6 | Phase 6 complete — CSV term/summary, JSON backup replace/merge, optional PIN, print CSS | Agent |
| 2026-09-06 | 7 | Started Phase 7 — advisory class & grade transfer | Agent |
| 2026-09-06 | 7 | Phase 7 complete — Advisory view, GTF v1.0 export/import, GA + conflict tests | Agent |
| 2026-09-06 | 8 | Started Phase 8 — attendance tracker & SF2 | Agent |
| 2026-09-06 | 8 | Phase 8 complete — monthly grid, roll call, SF2 preview/print/PDF | Agent |
| 2026-09-06 | 9 | Started Phase 9 — Excel & PDF reports | Agent |
| 2026-09-06 | 9 | Phase 9 complete — DepEd ECR Excel, class/learner/completion/analysis/advisory PDFs | Agent |
| 2026-09-06 | 10 | Started Phase 10 — performance checklist & quick grade | Agent |
| 2026-09-06 | 10 | Phase 10 complete — checklist publish to WW/PT, quick grade, undo/redo, score transfer | Agent |
| 2026-09-06 | 11 | Started Phase 11 — teacher tools & classroom suite | Agent |
| 2026-09-06 | 11 | Phase 11 complete — group randomizer, name picker, grade simulator, class analysis; P3/P4 deferred | Agent |

### How to update when a phase finishes

1. Set phase row in **§4 Phase status tracker** to ✅ Complete; fill Started/Completed dates and PR link.
2. Check off deliverables in the phase section.
3. Append a row to **§10 Progress log**.
4. Set **Active phase** in the header table to the next phase (or — if between phases).
5. Update **Last updated** date in the header.

---

## 11. Related documents

| Document | Path |
| --- | --- |
| GradeBoss contributor guide | `AGENTS.md` |
| Sync bridge technical spec | `planning/sync-bridge-spec.md` |
| Pricing calculator | `planning/pricing-calculator.html` |
| E-Class Record advisory guide | `eclassrecord/docs/advisory-class-guide.md` (source repo) |
| Grade Transfer schema v1.0 | `eclassrecord/docs/grade-transfer-schema-v1.0.md` (source repo) |
| E-Class Record implementation history | `eclassrecord/docs/implementation-history.md` (source repo) |

---

## 12. Decision log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-09-05 | IndexedDB over localStorage for schema v1 | E-Class Record JSON model too large/complex for localStorage |
| 2026-09-05 | Port `grading.js` as pure TS domain module first | Highest risk / highest value; enables all downstream UI |
| 2026-09-05 | Keep Google DepEd auth; add optional local PIN later | GradeBoss identity model differs from desktop profiles |
| 2026-09-05 | 15 phases (0–14) | Groups work into shippable increments without multi-month blocks |
| 2026-09-05 | Port desktop procedural SVG avatars instead of 100 PNG files | Matches eclassrecord `learner-avatars.js`; keeps PWA cache small and works offline |
| 2026-09-06 | Generate DepEd ECR workbook from the official cell map instead of bundling `Templates.xlsx` (1.3MB) | Protects PWA cache size; optional `/templates/ecr.xlsx` overlay with CacheFirst |

---

*Next action: Begin **Phase 12 — Calendar & workplace dashboard**.*
