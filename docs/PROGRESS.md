# HaqLink build progress (single source of truth — update this after every step, never restart from zero)

Last updated: 2026-11-08. Sandbox limits: npm registry blocked (nothing can be installed or booted), local PostgreSQL 16 available on socket `/tmp/pgsock` (may need `pg_ctl start`), esbuild/TypeScript/zod/React available from `/opt/npm-tools`.

## State found on disk on 2026-11-08 (this workspace was restored to an earlier checkpoint)
Present: `server/db/migrations/001_init.sql` + `002_reference_data.sql`, `db/migrate.js`, `db/seed.js`, `db/roles.sql`, `server/src/{app,config,db,index}.js`,
`middleware/{auth,errors,rateLimit,security}.js`, `lib/{access,codes,directory,lawyerQueries,matching,money,reference,text,validators}.js`,
`routes/{quotations,requests}.js`, `client/src/App.jsx`, `client/package.json`, `scripts/check-compile.sh`, `docs/{PAGE_GUIDE,SERVER_GUIDE}.md`.
Missing (rebuild, do not re-plan): everything else below.

## Checklist
- [x] Stage 1 — client foundation: vite/tailwind/postcss config, index.html, main.jsx, index.css, `lib/*`, `hooks/*`, `context/*`, `components/ui/*`, `components/layout/*`, `components/lawyers/*`, `components/reports/*`; `scripts/check-contract.mjs`, `scripts/check-names.mjs`
- [x] Server S1 — `lib/{storage,credentialFile}.js`, `middleware/upload.js`, `routes/{reference,auth,me,lawyers,lawyerSelf}.js`, `db/demo.sql`, `db/retention.js`, `tests/unit.test.js`
- [x] Server S2 — `lib/{time,slots}.js`, `routes/{conversations,appointments,reviews,reports,admin}.js`
- [x] Stage 2 — pages: Home, FindLawyer, Categories, HowItWorks, About
- [x] Stage 3 — pages: LawyerProfile, NotFound (+ case experience, reviews)
- [ ] Stage 4 — (Login, Register, AuthModal, Account, client Overview/Requests/RequestDetail/Saved DONE) remaining: lawyer Overview/Profile
- [ ] Stage 5 — (DescribeProblem DONE) Messages
- [ ] Stage 6 — pages: FeeAssistant, client+lawyer Quotations/QuotationDetail
- [ ] Stage 7 — pages: Appointments (client, lawyer), admin Overview/Applications/ApplicationDetail/Reports/Reviews/Cases/Taxonomy/Users/Audit; Contact/Help/Terms/Privacy/Disclaimer
- [ ] Stage 8 — integration tests (written, not executable here), SECURITY.md, README.md, final verification

## Verified so far (be honest in the README)
- 2026-11-08: server complete (all routes written). Schema + demo.sql applied twice to PostgreSQL 16 (12 lawyers, 6 verified fixture, 7 cases, 0 reviews); directory queries (7 filter combos), admin list queries, dashboard/conversation/appointment/credential SQL and the double-booking EXCLUDE constraint executed against it. API itself NOT booted (npm registry blocked).
- 2026-11-09: client kit, layouts, LawyerCard, ReportDialog and both check scripts written; check scripts verified to run (only missing-page errors remain). Nothing else yet. (Earlier session, before the restore: schema + demo seed applied to PostgreSQL 16 and 13 unit tests passed — must be re-verified after rebuild.)
