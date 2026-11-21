# Server guide (for the authors of `server/src/routes/*`)

Express 5 + zod + pg + jsonwebtoken + bcryptjs + multer. ES modules. **The npm registry is blocked in this sandbox**, so
`express`, `pg`, `supertest`… are NOT installed: the API cannot be booted here. Verify with the static scripts and with real
SQL against the local PostgreSQL (see "Verifying"). Never claim you ran the API.

## What already exists (read these first; do not rewrite them)

`src/config.js` · `src/db.js` (`query`, `one`, `tx`, `audit`, `pool`; numeric → JS number, date → `'YYYY-MM-DD'` string) ·
`src/app.js` (mounts every route file — **the route file names and default-export factories are fixed**, see below) ·
`src/middleware/{auth,errors,rateLimit,security}.js` · `src/lib/{validators,text,money,codes,reference,lawyerQueries,directory,matching,access}.js` ·
`src/routes/{quotations,requests}.js` (finished; use them as the style reference) · `db/migrations/001_init.sql` (**the schema is the source of
truth for column names, enums and constraints — read all of it**) · `db/migrations/002_reference_data.sql`.

## Conventions

- Each route file: `export default function xRoutes({ limiters }) { const router = Router(); …; return router; }` (`reference.js` takes no args).
  A comment block at the top lists every endpoint: method + path, who may call it, request body, response shape, error codes. Client authors read it.
- Errors: `throw new HttpError(status, message, code, fields?)`, `notFound()`, `forbidden()`. Body shape is always `{ error: { code, message, fields? } }`.
  Validation: `parse(zodSchema, req.body)` (→ 400 `validation_error` with `fields`). Route params: `uuidParam(req.params.id)`. Express 5 forwards async errors itself.
- Auth: `requireAuth`, `requireRole('client')`; `req.user = { id, email, role, fullName, language }`. 401 signed out, 403 wrong role, **404** (not 403) when a row exists
  but is not yours. Ownership is checked in SQL or with the loaders in `lib/access.js`. Admins are not participants in private conversations/quotations.
- SQL: parameters only (`$1…`); never concatenate user input. Money is `numeric(12,2)`; dates `'YYYY-MM-DD'`; instants are `timestamptz` (UTC, serialised as ISO strings).
- JSON uses camelCase; map rows explicitly in a `mapX(row)` function — never `res.json(row)` (it would leak columns such as `password_hash`, `reference_number`, `stored_filename`).
- Write endpoints use `limiters.write`; login/register use `limiters.auth`; uploads use `limiters.upload`. Everything that changes state by an admin writes `audit(db, {...})`
  inside the same transaction. Reading sensitive data (downloading a credential document) is audited too.
- Privacy rules (non-negotiable): a lawyer can read a client's request text only while `conversations.request_shared_at IS NOT NULL AND request_id IS NOT NULL`;
  `public_email`/`public_phone` are returned only when the lawyer filled them in; credential files and `reference_number` are visible only to the owner and admins and
  files are streamed through an authorised route (never static, never a path in JSON); suspended/deleted accounts cannot sign in; drafts/suspended profiles are 404 to the public.
- Honest labelling: `verification_status = 'verified'` is the only thing that may be presented as "Verified". No endpoint states that anyone is licensed unless a credential row is `verified`.
- Do not add dependencies. Do not edit files you do not own; if a shared file needs a change, work around it and say so in your report.

## Route files, owners and endpoints

Paths below are the **contract with the client authors** (they are writing pages against this list at the same time). Add endpoints if needed; do not rename these.

**Author S1** — `reference.js`, `auth.js`, `me.js`, `lawyers.js`, `lawyerSelf.js` (+ `lib/storage.js`, `lib/credentialFile.js`, `middleware/upload.js`, `db/demo.sql`, `db/retention.js`, `tests/unit.test.js`)

| Endpoint | Notes |
|---|---|
| `GET /api/reference` | `{ categories:[{id,name,slug,description}], locations:[{id,name,region}], languages, helpTypes, consultPreferences, modes, feeTypes, currencies, limits:{ maxUploadMb, allowedUploadTypes, appointmentMinNoticeHours, appointmentHorizonDays } }` — active rows only |
| `POST /api/auth/register` | `{ role:'client'\|'lawyer', fullName, email, password, preferredLanguage?, acceptTerms:true, professionalTitle? }` → 201 `{ user }` + cookie. Never accepts `admin`; unknown keys ignored. Password ≥ 10 chars, 1 letter + 1 digit, ≤ 72. A lawyer gets a draft `lawyer_profiles` row (unique slug). |
| `POST /api/auth/login` | `{ email, password }` → `{ user }`. Same message for unknown email and wrong password (and a dummy bcrypt compare for timing). Suspended/deleted → 403 `account_suspended`. `limiters.auth`. Updates `last_login_at`. |
| `POST /api/auth/logout`, `GET /api/auth/me` | `me` → `{ user: null }` when signed out (never 401). `user = { id, email, role, fullName, language, phone, lawyer?: { profileId, slug, profileStatus, verificationStatus } }` |
| `GET /api/me/dashboard` | role-specific stats (client: openRequests, activeConversations, quotationsAwaitingResponse, upcomingAppointments, savedLawyers + `upcomingAppointments[]`; lawyer: inquiries awaiting reply, quotationRequests awaiting a proposal, pendingAppointments, upcomingAppointments + `verification` + `profile` completeness checklist). Admin → 403 (admins use `/api/admin/overview`). |
| `PATCH /api/me` · `POST /api/me/password` · `GET /api/me/export` · `POST /api/me/delete` | profile (`fullName`, `preferredLanguage`, `phone`); change password (`currentPassword`,`newPassword`, bumps `token_version`, re-issues the cookie); download the person's own data as JSON; close account (`password` required → anonymise: email `deleted-<id>@deleted.invalid`, name `Deleted account`, status `deleted`, `deleted_at`, token_version++, client requests removed, lawyer profile unpublished + public contact cleared; respond `{ ok, retentionDays }`) |
| `GET /api/me/saved` · `PUT /api/me/saved/:profileId` · `DELETE /api/me/saved/:profileId` | client only; `{ lawyers:[card] }` |
| `GET /api/lawyers` · `GET /api/lawyers/:slug` | directory (uses `lib/directory.js`) and public profile: card + `bio, qualifications, officeAddress, profileStatus, timezone, slotMinutes, contact{email?,phone?}, verification{status,verifiedAt,license{issuingBody,validUntil}\|null}, fixedFeeServices[], cases[] (published only, with `evidenceLevel`, `isDemo`, category), availability[{weekday,startTime,endTime}], saved` |
| `/api/lawyer/*` (role lawyer) | the whole lawyer workspace: own profile (private fields included) GET/PUT basics, specializations, fees, fixed-fee services CRUD, availability (weekly ranges, slot length, timezone; reject overlaps), case summaries CRUD (always resets to `pending`; confidentiality confirmation required), contact visibility, credentials (multipart upload, list, delete, owner download), verification application (submit, status, admin notes), publish / unpublish (honours `REQUIRE_VERIFICATION_TO_PUBLISH`; checklist errors say what is missing). Design the paths yourself and document them at the top of the file. |

**Author S2** — `conversations.js`, `appointments.js` (+ `lib/time.js`, `lib/slots.js`), `reviews.js`, `reports.js`, `admin.js`

| Endpoint | Notes |
|---|---|
| `POST /api/conversations` | client only. `{ lawyerSlug, message, shareRequest?: { requestId, consent:true } }` creates or reuses the (client, lawyer) conversation, stores the first message, and — only with explicit `consent:true` — sets `request_id`/`request_shared_at`. Lawyers can never start conversations. Target profile must be published. |
| `GET /api/conversations` · `GET /api/conversations/:id` | inbox for both roles (counterpart name + `verificationStatus` for the lawyer side, last message preview, unread flag, status, `requestShared`); thread = messages + shared request (lawyer sees it **only** if shared) + linked quotations & appointments summaries |
| `POST /api/conversations/:id/messages` · `POST /:id/read` · `PATCH /:id` | send (body ≤ 4000), mark read, close/reopen (`status: open\|closed`; closed conversations accept no new messages/quotations) |
| `POST /api/conversations/:id/share-request` · `DELETE /api/conversations/:id/share-request` | client shares (needs `requestId` they own + `consent:true`) / revokes |
| `GET /api/appointments/slots?lawyer=<slug>` | `{ timezone, slotMinutes, slots:[{ startsAt, endsAt }] }` bookable slots in the next `APPOINTMENT_HORIZON_DAYS`, after `APPOINTMENT_MIN_NOTICE_HOURS`, inside weekly availability, excluding requested/confirmed appointments. Public. |
| `POST /api/appointments` | client: `{ lawyerSlug, startsAt, mode, reason, consent:true }` (creates the conversation if there is none); validates slot, mode offered by the lawyer, double booking (409 `slot_taken`) |
| `GET /api/appointments` · `GET /:id` · `POST /:id/confirm` · `POST /:id/decline` · `POST /:id/cancel` · `POST /:id/complete` | both roles list their own (`?status=`); lawyer confirms (optional `meetingInstructions`, `note`), declines (note), completes (only after the start time); either side cancels while requested/confirmed; invalid transitions → 409 `invalid_state` |
| `GET /api/reviews/lawyer/:slug` · `GET /api/reviews/eligibility/:slug` · `POST /api/reviews` | public list (published only, author shown as first name + initial) with `summary{average,count,distribution}`; client eligibility `{ eligible, appointmentId?, reason }`; create `{ appointmentId, rating 1-5, body }` — only for the client's own **completed** appointment, once per appointment, text must not contain contact details (`containsContactDetails`) |
| `POST /api/reports` | any signed-in user: `{ targetType, targetId, reason, details? }`; target must exist and be reportable (published profile / published review / published case / a message in a conversation the reporter takes part in); duplicate open report → 409 |
| `/api/admin/*` (role admin) | `GET overview` (counts only: accounts by role, profiles by status/verification, pending applications, open reports, content awaiting moderation, requests/conversations/quotations/appointments totals); verification: list/detail applications, stream a credential file (audited), review a credential, approve / reject / request-more-info (sets `verification_status`, `verified_at/by`, application + credential statuses, audit); reports: list/detail/resolve/dismiss; reviews: list/hide/restore; cases: list/approve/reject/unpublish (+ set `evidence_level`); taxonomy: categories + locations list/create/update/(de)activate; users: list (search, role, status filters)/suspend/reinstate (reason required; cannot suspend yourself or another admin; suspension bumps `token_version`, sets lawyer profile `suspended`); audit: paginated list with filters. Every mutation audited. Paths are yours; document them at the top of the file. |

## Verifying (what is possible here)

Run from `/home/claude/haqlink`: `bash scripts/check-compile.sh`, `node scripts/check-names.mjs`, `node scripts/check-contract.mjs` (errors in files you do not own, or about missing client pages, are not yours).
Pure unit tests: `cd server && node --test tests/unit.test.js` (`server/node_modules` is a symlink to a folder that has zod, so modules that only need zod can be imported; anything importing `express`/`pg`/`bcryptjs`/`jsonwebtoken` cannot be executed).
SQL: a local PostgreSQL 16 runs as user `claude` on the socket `/tmp/pgsock` (`runuser -u claude -- psql -h /tmp/pgsock -d <db>`). **Create your own scratch database** (e.g. `createdb haqlink_<yourname>`, load `001_init.sql` + `002_reference_data.sql` + `demo.sql`) and run every non-trivial SQL statement you wrote through it (with realistic parameters substituted) to prove it parses and returns the columns your mapper reads. Drop your scratch DB when done. Never touch `haqlink` or `haqlink_test`.

## Final report format (short)

1. Files created. 2. Endpoint list as implemented (one line each). 3. Deviations from this guide / gaps. 4. What you verified (and how) and what you could not run.
