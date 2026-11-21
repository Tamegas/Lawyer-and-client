# Client page guide

Conventions every page in `client/src/pages/**` follows. Read this, then read the shared kit once before writing code.

## Where things live

```
client/src/
  App.jsx                    route table (do not edit): each page is a lazy import with a DEFAULT export
  pages/{public,auth,shared,client,lawyer,admin}/*.jsx
  components/ui/*            the UI kit (import from components/ui/index.js)
  components/layout/*        Navbar, Footer, PublicLayout, DashboardLayout, RouteGuards, ErrorBoundary
  components/lawyers/*       LawyerCard, Avatar
  components/reports/*       ReportDialog (report a profile / review / case / message)
  components/<feature>/*     NEW private components for one feature (create these as you need them)
  context/*                  useAuth, useReference / useReferenceOptions, useToast
  hooks/*                    useApi (GET + state), useForm (values + server field errors), useDocumentTitle, useDebounced
  lib/*                      api (fetch wrapper), format (money/dates), labels (status → label + tone), brand
server/src/routes/*.js       THE API CONTRACT. Read the route files for every endpoint you call:
                             request body schema (zod), response shape, who may call it, error codes.
server/db/migrations/001_init.sql   the enums/status values (what a status string can be)
```

**Do not edit shared files** (`App.jsx`, `components/ui/*`, `components/layout/*`, `components/lawyers/*`, `components/reports/*`, `context/*`, `hooks/*`, `lib/*`, `index.css`, `tailwind.config.js`, anything in `server/`). Create new files under `pages/<your area>/` and `components/<your feature>/`. If you believe a shared file or the API needs a change, say so in your final report and work around it meanwhile.

## Hard rules

1. **Only real endpoints.** Call `api.get('/lawyers')`, ``api.post(`/requests/${id}/x`, body)``, `useApi('/me/dashboard')` — paths are relative to `/api`, and must be a literal or template literal that starts with the endpoint, so `node scripts/check-contract.mjs` can verify it against the server's routes. Never invent an endpoint, a response field, or a status value: read the route code.
2. **No new dependencies.** React 19, react-router-dom 7, Tailwind 3 and the UI kit only. No icon library (use `<Icon name>`; read `Icon.jsx` for the names — pick the closest existing one), no date library, no form library, no markdown renderer.
3. **Render user text as text.** Never `dangerouslySetInnerHTML`. Preserve line breaks with `whitespace-pre-line`.
4. **Authorization lives on the server.** Hide buttons a role cannot use, but never rely on that. Handle 401/403/404 from the API gracefully.
5. **Status vocabulary** comes from `lib/labels.js` (`quotationStatusInfo`, `appointmentStatusInfo`, `verificationInfo`, …) rendered with `<StatusBadge info={…}>`. Money via `formatMoney` / `formatFee`; dates via `formatDate` / `formatDateTime` (appointment times are UTC instants shown in the viewer's zone — show `viewerTimeZone()` next to them).
6. **Every data view has all four states:** loading (`Loadable`, `Skeleton`, `PageLoader`), error (`ErrorState` with retry), empty (`EmptyState` with a next action) and content.
7. **Forms:** `useForm`; `TextField`/`SelectField`/`TextAreaField`/`CheckboxField`/`RadioGroup` from the kit (they wire label, hint, error and `aria-describedby`). On submit: client-side checks for obvious things, then `try { await api… } catch (err) { if (!form.applyError(err)) setFormError(errorMessage(err)); }` and show a non-field error in an `<Alert tone="danger">` near the submit button. Disable/`loading` the submit button while saving so nothing double-submits. Success → `useToast().success(...)` and update the UI (navigate, `reload()`, or `setData`).
8. **Dialogs:** use `<Modal>` (native `<dialog>`: focus trap, Esc, focus return are handled). Put long forms in a Modal only when the user should not lose the page behind it.
9. **Accessibility:** one `<h1>` per page (`PageHeader` renders it on dashboard pages), logical heading order, visible labels (no placeholder-only inputs), 44px touch targets (`Button` md), colour never the only signal (badges carry text), `aria-live="polite"` for async status text, tables must have `<caption className="sr-only">` + `scope="col"` headers, and wide tables scroll inside `overflow-x-auto` or switch to stacked cards on mobile.
10. **Responsive, mobile first.** Check 360px: no horizontal page scroll, stack columns, wrap button rows (`flex flex-wrap gap-2`).
11. **Set the page title:** `useDocumentTitle('Find a lawyer')` at the top of every page.
12. **Style** with the existing tokens only: `navy-*` (primary), `gold-*` (accent; gold text on white = `gold-700`, on navy = `gold-300`), `slate-*` text, `font-serif` for headings, `shadow-card` / `shadow-lift`, `rounded-xl/2xl`, `animate-fade-up` for subtle entrance. Public pages use `Section` + `Container` + `SectionHeading`; dashboard pages use `PageHeader` + `Card`. Look at `LawyerCard.jsx` and `DashboardLayout.jsx` for the house style, and follow the `frontend-design` mindset: intentional hierarchy and spacing, no generic template feel — but stay inside the palette.

## Honesty and legal-safety rules (from the product spec — non-negotiable)

- Lawyers are **legal representatives**, never "defendants". Fictional seed data is labelled (`lawyer.isDemo` → the "Demo profile · fictional" badge; keep it visible wherever a demo lawyer is shown).
- Say **"Verified" only** when `verificationStatus === 'verified'`; otherwise show the real status via `verificationInfo`. Never write "all lawyers are verified" or "licensed lawyers" about the directory in general.
- Ratings only when `rating` exists (genuine reviews). Otherwise "No reviews yet". Fee absent → **"Contact for pricing"**.
- **Never promise or imply an outcome.** No "win your case", "guaranteed", "best lawyer". Case outcomes are labelled by evidence level: a lawyer-submitted claim is not a documented outcome (`evidenceInfo`).
- The site **does not give legal advice** and does not replace a lawyer; say so wherever a person describes a problem or reads about fees.
- **Do not claim compliance with Ethiopian law (or any law)**, do not cite statutes or legal deadlines, and do not invent legal requirements.
- **Consent before sharing:** nothing a client wrote is shown to a lawyer until the client has explicitly ticked the consent box on that action. Show *what* will be shared and *with whom* next to the box. The client can withdraw sharing later where the API supports it.
- **Do not collect unnecessary sensitive data**; remind people not to put national ID numbers, passwords, or confidential documents in descriptions. No file upload for clients in this version (lawyers upload verification documents only).
- Private contact details (email/phone) are never shown unless the API returns them (the lawyer chose to publish them). Do not build UI that tries to reveal them.
- **Features that are not operational must say so:** real-time chat (messages are asynchronous in-app inquiries), video calls (the lawyer shares a link/instructions in the conversation), SMS/email notifications, online payments and profile-photo upload do not exist in this version. Never show a button that looks like it does one of these; where a page mentions them, label them "not available yet".
- No invented testimonials, statistics, media logos, awards or user counts anywhere. If a number is shown it comes from the API.

## Verifying your work (the app cannot be booted in this sandbox — npm registry is blocked)

Run from `/home/claude/haqlink` and fix everything these report **for your files**:

```bash
bash scripts/check-compile.sh        # every .js/.jsx must compile (syntax + JSX)
node scripts/check-contract.mjs      # every API call must match a real route+verb; every internal link a <Route>
node scripts/check-names.mjs         # TypeScript name resolution: undefined variables/components, bad named imports, missing files
```

`check-names` is the one that catches `<Foo />` / `formatMoney()` used without an import and importing a name a module does not export (e.g. a UI-kit component that does not exist). Run it often, not just at the end. Other agents are writing other pages at the same time, so errors in files you do not own (including "cannot find module './pages/…'" for pages that are not written yet) are not yours to fix; filter the output to your own paths.

Also re-read your own code once looking for: hooks called conditionally, effects with missing cleanup, state set after unmount, `key` props on lists, and fields the API does not actually return. Imports are relative (`../../components/ui/index.js`); include the `.jsx`/`.js` extension.

## Final report format (keep it short)

1. Files created (paths). 2. Endpoints used. 3. Anything you needed that does not exist (API gaps, missing UI-kit pieces, missing icons) or any contract oddity you worked around. 4. What you could not verify. Do not paste code in the report.

## Coordination notes (parallel authors)

**URL contract — every page links to these, exactly:**

| Route | Notes |
|---|---|
| `/lawyers?q=&category=<slug>&location=<id>&minExperience=&minFee=&maxFee=&language=&available=true&verified=true&mode=online\|in_person&sort=relevance\|experience\|fee_asc\|rating&page=` | Same names as `GET /api/lawyers`. `FindLawyer` reads/writes exactly these; other pages that link into the directory use only these. |
| `/lawyers/:slug` | Profile. Optional `?action=contact\|estimate\|appointment` opens that dialog on arrival (signed-out visitors are asked to sign in first). |
| `/describe-problem?category=<slug>` | Optional category preselect. |
| `/fee-assistant`, `/how-it-works`, `/categories`, `/help`, `/terms`, `/privacy`, `/disclaimer`, `/contact`, `/about` | Public info pages. |
| `/messages`, `/messages/:conversationId` | Conversation list / thread (both roles). |
| `/client/requests/:id`, `/client/quotations/:id`, `/lawyer/quotations/:id`, `/admin/applications/:id` | Detail pages. |

**Who owns which private-component folder** (create only inside your own; never import from another author's folder — duplicate a few lines instead):
`components/home` + `components/directory` (A) · `components/profile` (B) · `components/problem` + `components/fees` + `components/info` (C) · `components/auth` + `components/account` + `components/client` (D) · `components/messages` + `components/quotes` + `components/appointments` (E) · `components/lawyer` (F) · `components/admin` (G).

**Demo data you can rely on** (`server/db/demo.sql`): 12 fictional lawyers (6 with the fixture status "verified"), 6 fictional case summaries, **no reviews** (so "No reviews yet" and "Highest rated unavailable" must look right), 9 categories, 9 locations, one sample request/conversation/quotation, two appointments. Accounts (password `Demo#Pass2026`): `admin@demo.haqlink.test`, `client@demo.haqlink.test`, `client2@…`, `lawyer1@…` … `lawyer12@…` (all `@demo.haqlink.test`).

**Environment truth:** the npm registry is blocked in this sandbox, so nothing can be installed or booted and you cannot see your page render. The three check scripts are the only machine verification, so be deliberate about what they cannot catch: props a kit component does not accept (read its signature), response fields a route does not return, `undefined` access on optional data, hook order, missing `key`s, effects without cleanup.
