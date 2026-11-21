# HaqLink — handoff (state as of 2026-11-10)

This is an **unfinished but substantial** build of the legal-services marketplace (React + Vite + Tailwind + React Router / Node + Express 5 / PostgreSQL). The whole **server is written**, the **client foundation and about two thirds of the pages are written**, and **18 pages plus the tests/README are still missing**. Nothing has been run end to end: the build sandbox could not reach the npm registry, so `npm install`, the API, the Vite build and the UI have **never been executed**. Treat everything below as "written and statically checked", not "tested".

`docs/PROGRESS.md` is the running checklist, `docs/PAGE_GUIDE.md` is the page-author brief (conventions, honesty rules, URL contract) and `docs/SERVER_GUIDE.md` is the API contract. Read those three first; they say how the code is meant to fit together.

## What exists

**Database** (`server/db/`): `migrations/001_init.sql` (20 tables, constraints, indexes, enums), `002_reference_data.sql` (9 legal categories, locations, languages), `demo.sql` (all-fictional demo data, re-runnable), `roles.sql` (least-privilege DB role), `migrate.js`, `seed.js`, `retention.js`.

**Server** (`server/src/`): config, db, security middleware (helmet, origin check, rate limits), cookie-JWT auth with role guards, upload middleware, and routes: `reference, auth, me, lawyers, lawyerSelf, requests, conversations, quotations, appointments, reviews, reports, admin`. Libraries for money, slots/time zones, matching, directory search, credential-file handling, profile-publish checklist.

**Client** (`client/src/`): Vite/Tailwind config, design system (`components/ui`, `layout`, `lawyers/LawyerCard`, `reports/ReportDialog`), contexts (auth with sign-in dialog, reference data, toasts), hooks, `lib/api.js`, and these pages:
- Public: Home, FindLawyer (URL-driven filters), LawyerProfile, Categories, HowItWorks, About, DescribeProblem, FeeAssistant, NotFound
- Auth/shared: Login, Register, Account, Messages
- Client: Overview, Requests, RequestDetail, Saved, Quotations, QuotationDetail
- Lawyer: Quotations, QuotationDetail

**Scripts** (`scripts/`): `check-compile.sh` (esbuild syntax check), `check-names.mjs` (undefined names / bad imports), `check-contract.mjs` (every client API call and link must match a server route / `<Route>`).

## What is still missing (App.jsx already routes to all of these)
1. **Pages (18):** `public/{Contact,Help,Terms,Privacy,Disclaimer}`, `client/Appointments`, `lawyer/{Overview,Profile,Appointments}`, `admin/{Overview,Applications,ApplicationDetail,Reports,Reviews,Cases,Taxonomy,Users,Audit}`. Their APIs exist already (see the endpoint comment block at the top of each route file: `appointments.js`, `lawyerSelf.js`, `admin.js`). Until they exist the Vite build fails on the missing imports — `node scripts/check-contract.mjs` lists exactly which.
2. **Tests:** `server/tests/unit.test.js` and `server/tests/integration/*` were not written (both folders are empty; `npm test` will currently run no server tests, and `vitest run` in `client/` exits non-zero when it finds no tests — add one test or `--passWithNoTests`).
3. **`README.md` and `docs/SECURITY.md`** were not written. Do a security pass yourself before any real use (see checklist below).

## Run it locally
Prerequisites: Node 20+ (22 recommended), PostgreSQL 14+.
```bash
createdb haqlink && createdb haqlink_test          # or create a role + DBs with psql
cp server/.env.example server/.env                 # then edit DATABASE_URL, DATABASE_URL_TEST and set JWT_SECRET (openssl rand -hex 48)
npm install                                        # root (concurrently)
npm run setup                                      # server + client dependencies
npm run db:migrate && npm run db:seed              # schema + fictional demo data
npm run dev                                        # API http://localhost:4000, web http://localhost:5173
```
Expect to fix small things on first run (nothing has been executed): typos, a prop a component does not accept, a response field a page reads that the API does not return. The three check scripts catch many of these before you start the server.

## Demo accounts (fictional; created by `demo.sql`)
Password for all: `Demo#Pass2026`

| Role | Email |
|---|---|
| Admin | `admin@demo.haqlink.test` |
| Client | `client@demo.haqlink.test`, `client2@demo.haqlink.test` |
| Lawyer | `lawyer1@demo.haqlink.test` … `lawyer12@demo.haqlink.test` |

All demo people, case summaries and fees are **fictional**; the "verified" flag on six demo lawyers is a fixture, not a real verification. There are **no demo reviews**, so "No reviews yet" and "Highest rated unavailable" are the expected states.

## What was and was not verified
Verified in the sandbox (2026-11-08/09):
- `001_init.sql`, `002_reference_data.sql` and `demo.sql` applied (twice) to a real PostgreSQL 16; directory-filter queries, admin list queries, dashboard/conversation/appointment/credential queries and the double-booking exclusion constraint executed against it.
- Every `.js/.jsx` file compiles (`check-compile.sh`: 102 files).

NOT run anywhere: `npm install`, the API server, any integration test, the Vite build, the UI in a browser, file upload, login/cookies end to end, or any browser/mobile layout check.

## Not operational by design (documented, not faked)
Real-time chat (messages are asynchronous in-app messages), video calls, SMS/email notifications, online payments, password reset by email, virus scanning of uploaded documents. Appointments are requests that a lawyer confirms; a "verified" lawyer means an administrator reviewed the submitted credentials in this app — there is no integration with any bar association.

## Before real use (not done; needs people, not code)
- Terms, Privacy and Disclaimer pages must be written/reviewed by qualified counsel; no compliance with Ethiopian or any other law is claimed anywhere.
- Confirm with qualified local counsel the rules on lawyer advertising, publishing case outcomes and client confidentiality, and design a real verification procedure.
- "HaqLink" is a placeholder name (`client/src/lib/brand.js`, `index.html`, `public/favicon.svg`). Set `VITE_SUPPORT_EMAIL` once a real support inbox exists.
- HTTPS, production secrets, backups, the least-privilege role in `server/db/roles.sql`, decide `REQUIRE_VERIFICATION_TO_PUBLISH`, set `DELETED_ACCOUNT_RETENTION_DAYS` with advice, schedule `npm --prefix server run retention:purge`.
- Never load `demo.sql` into a production database.
