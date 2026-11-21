// Administrator API. Mounted at /api/admin; role `admin` only. Every state change runs in a transaction and writes the audit log.
// Lists accept ?page=&pageSize= and return { <items>, total, page, pageSize }.
//   GET  /overview                         counts only
//   GET  /applications?status=&q=          verification queue;  GET /applications/:id  detail (profile snapshot, credentials, history)
//   POST /applications/:id/approve         { note? }           submitted -> approved (profile becomes "verified"; pending documents verified)
//   POST /applications/:id/reject          { note }            -> rejected (profile verification_status rejected)
//   POST /applications/:id/request-info    { note }            -> more_info_requested (lawyer sees the note and may resubmit)
//   GET  /credentials/:id/file             streams the private document (audited)
//   POST /credentials/:id/review           { status:'verified'|'rejected', note? }
//   GET  /reports?status=&targetType=      GET /reports/:id (with a snapshot of the reported item);  POST /reports/:id/resolve { note } | /dismiss { note? }
//   GET  /reviews?status=                  POST /reviews/:id/hide { note? } | /restore
//   GET  /cases?status=                    POST /cases/:id/approve { evidenceLevel?, note? } | /reject { note } | /unpublish { note? }
//   GET|POST /categories, PATCH /categories/:id      { name, slug?, description?, isActive?, sortOrder? }
//   GET|POST /locations,  PATCH /locations/:id       { name, region?, countryCode?, isActive?, sortOrder? }
//   GET  /users?q=&role=&status=           POST /users/:id/suspend { reason } | /reinstate   (cannot suspend yourself or another admin)
//   GET  /audit?action=&actor=             read-only audit trail
import { Router } from 'express';
import { z } from 'zod';
import { audit, one, query, tx } from '../db.js';
import { streamCredential } from '../lib/credentialFile.js';
import { slugify } from '../lib/text.js';
import { optText, text } from '../lib/validators.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError, notFound, parse, uuidParam } from '../middleware/errors.js';

const noteOpt = z.object({ note: optText(1500, 'Note') });
const noteReq = (label = 'Note') => z.object({ note: text(3, 1500, label) });
const invalid = (msg = 'That action is not available for the item in its current state.') => new HttpError(409, msg, 'invalid_state');
const oneOf = (value, allowed) => (typeof value === 'string' && allowed.includes(value) ? value : null);
const pageOf = (req) => {
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(req.query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
};
const like = (q) => `%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`).slice(0, 100)}%`;
const fieldError = (field, message) => new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { [field]: message });

const mapCred = (c) => ({
  id: c.id, credentialType: c.credential_type, issuingBody: c.issuing_body, referenceNumber: c.reference_number, issuedOn: c.issued_on, expiresOn: c.expires_on,
  originalFilename: c.original_filename, mimeType: c.mime_type, sizeBytes: c.size_bytes, status: c.status, reviewNote: c.review_note, reviewedAt: c.reviewed_at, createdAt: c.created_at,
});

export default function adminRoutes({ limiters }) {
  const router = Router();
  router.use(requireRole('admin'));

  // ---- Overview ---------------------------------------------------------------------------------
  router.get('/overview', async (req, res) => {
    const [accounts, profiles, work, totals] = await Promise.all([
      query(`SELECT role, count(*)::int AS n FROM users WHERE status <> 'deleted' GROUP BY role`),
      query(`SELECT profile_status, verification_status, count(*)::int AS n FROM lawyer_profiles GROUP BY 1, 2`),
      one(`SELECT (SELECT count(*) FROM verification_applications WHERE status = 'submitted')::int AS applications,
                  (SELECT count(*) FROM reports WHERE status = 'open')::int AS reports,
                  (SELECT count(*) FROM case_experience WHERE status = 'pending')::int AS cases`),
      one(`SELECT (SELECT count(*) FROM legal_requests)::int AS requests, (SELECT count(*) FROM conversations)::int AS conversations,
                  (SELECT count(*) FROM quotations)::int AS quotations, (SELECT count(*) FROM appointments)::int AS appointments,
                  (SELECT count(*) FROM reviews WHERE status = 'published')::int AS reviews`),
    ]);
    const byProfile = {}; const byVerification = {};
    profiles.rows.forEach((r) => {
      byProfile[r.profile_status] = (byProfile[r.profile_status] ?? 0) + r.n;
      byVerification[r.verification_status] = (byVerification[r.verification_status] ?? 0) + r.n;
    });
    res.json({
      accountsByRole: Object.fromEntries(accounts.rows.map((r) => [r.role, r.n])),
      profilesByStatus: byProfile, profilesByVerification: byVerification,
      attention: { pendingApplications: work.applications, openReports: work.reports, casesAwaitingModeration: work.cases },
      totals,
    });
  });

  // ---- Verification -----------------------------------------------------------------------------
  router.get('/applications', async (req, res) => {
    const { page, pageSize, offset } = pageOf(req);
    const status = oneOf(req.query.status, ['submitted', 'more_info_requested', 'approved', 'rejected', 'withdrawn']);
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? like(req.query.q.trim()) : null;
    const { rows } = await query(
      `SELECT va.id, va.status, va.submitted_at, va.decided_at, lp.slug, lp.professional_title, lp.verification_status, u.full_name,
              (SELECT count(*) FROM professional_credentials pc WHERE pc.lawyer_profile_id = lp.id)::int AS credential_count, count(*) OVER ()::int AS total
         FROM verification_applications va JOIN lawyer_profiles lp ON lp.id = va.lawyer_profile_id JOIN users u ON u.id = lp.user_id
        WHERE ($1::text IS NULL OR va.status::text = $1) AND ($2::text IS NULL OR u.full_name ILIKE $2 OR lp.professional_title ILIKE $2)
        ORDER BY (va.status = 'submitted') DESC, va.submitted_at DESC LIMIT $3 OFFSET $4`, [status, q, pageSize, offset]);
    res.json({
      applications: rows.map((a) => ({
        id: a.id, status: a.status, submittedAt: a.submitted_at, decidedAt: a.decided_at, credentialCount: a.credential_count,
        lawyer: { name: a.full_name, slug: a.slug, title: a.professional_title, verificationStatus: a.verification_status },
      })),
      total: rows[0]?.total ?? 0, page, pageSize,
    });
  });

  router.get('/applications/:id', async (req, res) => {
    const a = await one(
      `SELECT va.*, lp.id AS profile_id, lp.slug, lp.professional_title, lp.bio, lp.qualifications, lp.years_experience, lp.languages, lp.profile_status,
              lp.verification_status, lp.is_demo, u.full_name, u.email, loc.name AS location_name
         FROM verification_applications va JOIN lawyer_profiles lp ON lp.id = va.lawyer_profile_id JOIN users u ON u.id = lp.user_id
         LEFT JOIN locations loc ON loc.id = lp.location_id WHERE va.id = $1`, [uuidParam(req.params.id)]);
    if (!a) throw notFound();
    const [creds, history] = await Promise.all([
      query('SELECT * FROM professional_credentials WHERE lawyer_profile_id = $1 ORDER BY created_at', [a.profile_id]),
      query('SELECT id, status, admin_note, submitted_at, decided_at FROM verification_applications WHERE lawyer_profile_id = $1 ORDER BY submitted_at DESC', [a.profile_id]),
    ]);
    res.json({
      application: { id: a.id, status: a.status, lawyerNote: a.lawyer_note, adminNote: a.admin_note, submittedAt: a.submitted_at, decidedAt: a.decided_at },
      lawyer: {
        name: a.full_name, email: a.email, slug: a.slug, title: a.professional_title, bio: a.bio, qualifications: a.qualifications,
        yearsExperience: a.years_experience, languages: a.languages, location: a.location_name, profileStatus: a.profile_status,
        verificationStatus: a.verification_status, isDemo: a.is_demo,
      },
      credentials: creds.rows.map(mapCred),
      history: history.rows.map((h) => ({ id: h.id, status: h.status, adminNote: h.admin_note, submittedAt: h.submitted_at, decidedAt: h.decided_at })),
    });
  });

  const decide = (path, { schema, from, toStatus, profileStatus, verified }) => {
    router.post(`/applications/:id/${path}`, limiters.write, async (req, res) => {
      const d = parse(schema, req.body);
      await tx(async (db) => {
        const app = (await db.query('SELECT id, status, lawyer_profile_id FROM verification_applications WHERE id = $1 FOR UPDATE', [uuidParam(req.params.id)])).rows[0];
        if (!app) throw notFound();
        if (!from.includes(app.status)) throw invalid('This application has already been decided or is not waiting for review.');
        await db.query('UPDATE verification_applications SET status = $2, admin_note = $3, decided_at = $4, decided_by = $5 WHERE id = $1',
          [app.id, toStatus, d.note, toStatus === 'more_info_requested' ? null : new Date(), toStatus === 'more_info_requested' ? null : req.user.id]);
        await db.query(
          `UPDATE lawyer_profiles SET verification_status = $2, verified_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
                  verified_by = CASE WHEN $3::boolean THEN $4::uuid ELSE NULL END WHERE id = $1`,
          [app.lawyer_profile_id, profileStatus, verified, req.user.id]);
        if (verified) {
          await db.query(`UPDATE professional_credentials SET status = 'verified', reviewed_by = $2, reviewed_at = now() WHERE lawyer_profile_id = $1 AND status = 'pending'`, [app.lawyer_profile_id, req.user.id]);
        }
        await audit(db, { actor: req.user, action: `verification.${path.replace('-', '_')}`, targetType: 'verification_application', targetId: app.id, details: { note: d.note, lawyerProfileId: app.lawyer_profile_id } });
      });
      res.json({ ok: true, status: toStatus });
    });
  };
  decide('approve', { schema: noteOpt, from: ['submitted'], toStatus: 'approved', profileStatus: 'verified', verified: true });
  decide('reject', { schema: noteReq('Reason'), from: ['submitted', 'more_info_requested'], toStatus: 'rejected', profileStatus: 'rejected', verified: false });
  decide('request-info', { schema: noteReq('Message to the lawyer'), from: ['submitted'], toStatus: 'more_info_requested', profileStatus: 'pending', verified: false });

  router.get('/credentials/:id/file', async (req, res) => {
    const c = await one('SELECT * FROM professional_credentials WHERE id = $1', [uuidParam(req.params.id)]);
    if (!c) throw notFound();
    await audit({ query }, { actor: req.user, action: 'credential.view', targetType: 'credential', targetId: c.id });
    streamCredential(res, c);
  });

  router.post('/credentials/:id/review', limiters.write, async (req, res) => {
    const d = parse(z.object({ status: z.enum(['verified', 'rejected']), note: optText(1000, 'Note') }), req.body);
    await tx(async (db) => {
      const c = (await db.query('UPDATE professional_credentials SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now() WHERE id = $1 RETURNING id', [uuidParam(req.params.id), d.status, d.note, req.user.id])).rows[0];
      if (!c) throw notFound();
      await audit(db, { actor: req.user, action: `credential.${d.status}`, targetType: 'credential', targetId: c.id, details: { note: d.note } });
    });
    res.json({ ok: true });
  });

  // ---- Reports ----------------------------------------------------------------------------------
  router.get('/reports', async (req, res) => {
    const { page, pageSize, offset } = pageOf(req);
    const status = oneOf(req.query.status, ['open', 'resolved', 'dismissed']);
    const targetType = oneOf(req.query.targetType, ['lawyer_profile', 'review', 'case', 'message']);
    const { rows } = await query(
      `SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, r.resolved_at, ru.full_name AS reporter_name, count(*) OVER ()::int AS total
         FROM reports r LEFT JOIN users ru ON ru.id = r.reporter_id
        WHERE ($1::text IS NULL OR r.status::text = $1) AND ($2::text IS NULL OR r.target_type::text = $2)
        ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT $3 OFFSET $4`, [status, targetType, pageSize, offset]);
    res.json({
      reports: rows.map((r) => ({ id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at, reporterName: r.reporter_name })),
      total: rows[0]?.total ?? 0, page, pageSize,
    });
  });

  async function targetSnapshot(r) {
    if (r.target_type === 'lawyer_profile') {
      const t = await one(`SELECT lp.slug, lp.professional_title, lp.profile_status, lp.verification_status, u.full_name FROM lawyer_profiles lp JOIN users u ON u.id = lp.user_id WHERE lp.id = $1`, [r.target_id]);
      return t && { kind: 'lawyer_profile', name: t.full_name, title: t.professional_title, slug: t.slug, profileStatus: t.profile_status, verificationStatus: t.verification_status };
    }
    if (r.target_type === 'review') {
      const t = await one(`SELECT r2.rating, r2.body, r2.status, lp.slug FROM reviews r2 JOIN lawyer_profiles lp ON lp.id = r2.lawyer_profile_id WHERE r2.id = $1`, [r.target_id]);
      return t && { kind: 'review', rating: t.rating, body: t.body, status: t.status, lawyerSlug: t.slug };
    }
    if (r.target_type === 'case') {
      const t = await one(`SELECT ce.title, ce.description, ce.outcome, ce.status, ce.evidence_level, lp.slug FROM case_experience ce JOIN lawyer_profiles lp ON lp.id = ce.lawyer_profile_id WHERE ce.id = $1`, [r.target_id]);
      return t && { kind: 'case', title: t.title, description: t.description, outcome: t.outcome, status: t.status, evidenceLevel: t.evidence_level, lawyerSlug: t.slug };
    }
    const t = await one(`SELECT m.body, m.created_at, u.full_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1`, [r.target_id]);
    return t && { kind: 'message', body: t.body, sentAt: t.created_at, senderName: t.full_name };
  }

  router.get('/reports/:id', async (req, res) => {
    const r = await one('SELECT r.*, ru.full_name AS reporter_name FROM reports r LEFT JOIN users ru ON ru.id = r.reporter_id WHERE r.id = $1', [uuidParam(req.params.id)]);
    if (!r) throw notFound();
    res.json({
      report: { id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at, resolutionNote: r.resolution_note, resolvedAt: r.resolved_at, reporterName: r.reporter_name },
      target: await targetSnapshot(r),
    });
  });

  for (const [path, status, schema] of [['resolve', 'resolved', noteReq('Resolution note')], ['dismiss', 'dismissed', noteOpt]]) {
    router.post(`/reports/:id/${path}`, limiters.write, async (req, res) => {
      const d = parse(schema, req.body);
      await tx(async (db) => {
        const r = (await db.query(`UPDATE reports SET status = $2, resolution_note = $3, resolved_by = $4, resolved_at = now() WHERE id = $1 AND status = 'open' RETURNING id`, [uuidParam(req.params.id), status, d.note, req.user.id])).rows[0];
        if (!r) throw invalid('This report is not open.');
        await audit(db, { actor: req.user, action: `report.${status}`, targetType: 'report', targetId: r.id, details: { note: d.note } });
      });
      res.json({ ok: true });
    });
  }

  // ---- Reviews ----------------------------------------------------------------------------------
  router.get('/reviews', async (req, res) => {
    const { page, pageSize, offset } = pageOf(req);
    const status = oneOf(req.query.status, ['published', 'hidden']);
    const { rows } = await query(
      `SELECT r.id, r.rating, r.body, r.status, r.moderation_note, r.created_at, lp.slug, lu.full_name AS lawyer_name, cu.full_name AS client_name,
              (SELECT count(*) FROM reports rp WHERE rp.target_type = 'review' AND rp.target_id = r.id AND rp.status = 'open')::int AS open_reports, count(*) OVER ()::int AS total
         FROM reviews r JOIN lawyer_profiles lp ON lp.id = r.lawyer_profile_id JOIN users lu ON lu.id = lp.user_id LEFT JOIN users cu ON cu.id = r.client_id
        WHERE ($1::text IS NULL OR r.status::text = $1) ORDER BY open_reports DESC, r.created_at DESC LIMIT $2 OFFSET $3`, [status, pageSize, offset]);
    res.json({
      reviews: rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, status: r.status, moderationNote: r.moderation_note, createdAt: r.created_at, lawyerName: r.lawyer_name, lawyerSlug: r.slug, clientName: r.client_name, openReports: r.open_reports })),
      total: rows[0]?.total ?? 0, page, pageSize,
    });
  });
  for (const [path, from, to, schema] of [['hide', 'published', 'hidden', noteOpt], ['restore', 'hidden', 'published', noteOpt]]) {
    router.post(`/reviews/:id/${path}`, limiters.write, async (req, res) => {
      const d = parse(schema, req.body);
      await tx(async (db) => {
        const r = (await db.query('UPDATE reviews SET status = $3, moderation_note = $4 WHERE id = $1 AND status = $2 RETURNING id', [uuidParam(req.params.id), from, to, d.note])).rows[0];
        if (!r) throw invalid();
        await audit(db, { actor: req.user, action: `review.${path}`, targetType: 'review', targetId: r.id, details: { note: d.note } });
      });
      res.json({ ok: true });
    });
  }

  // ---- Case summaries ---------------------------------------------------------------------------
  router.get('/cases', async (req, res) => {
    const { page, pageSize, offset } = pageOf(req);
    const status = oneOf(req.query.status, ['pending', 'published', 'hidden', 'rejected']);
    const { rows } = await query(
      `SELECT ce.id, ce.title, ce.description, ce.lawyer_role, ce.outcome, ce.public_reference, ce.case_year, ce.evidence_level, ce.status, ce.moderation_note, ce.confidentiality_confirmed,
              ce.is_demo, ce.created_at, c.name AS category_name, lp.slug, u.full_name, count(*) OVER ()::int AS total
         FROM case_experience ce JOIN legal_categories c ON c.id = ce.category_id JOIN lawyer_profiles lp ON lp.id = ce.lawyer_profile_id JOIN users u ON u.id = lp.user_id
        WHERE ($1::text IS NULL OR ce.status::text = $1) ORDER BY (ce.status = 'pending') DESC, ce.created_at DESC LIMIT $2 OFFSET $3`, [status, pageSize, offset]);
    res.json({
      cases: rows.map((c) => ({
        id: c.id, title: c.title, description: c.description, lawyerRole: c.lawyer_role, outcome: c.outcome, publicReference: c.public_reference, caseYear: c.case_year,
        evidenceLevel: c.evidence_level, status: c.status, moderationNote: c.moderation_note, confidentialityConfirmed: c.confidentiality_confirmed, isDemo: c.is_demo,
        createdAt: c.created_at, categoryName: c.category_name, lawyerName: c.full_name, lawyerSlug: c.slug,
      })),
      total: rows[0]?.total ?? 0, page, pageSize,
    });
  });
  const caseAction = (path, { schema, from, to }) => router.post(`/cases/:id/${path}`, limiters.write, async (req, res) => {
    const d = parse(schema, req.body);
    await tx(async (db) => {
      const c = (await db.query(
        `UPDATE case_experience SET status = $3, moderation_note = $4, moderated_by = $5, moderated_at = now(), evidence_level = COALESCE($6::evidence_level, evidence_level)
          WHERE id = $1 AND status = ANY ($2::content_status[]) RETURNING id`,
        [uuidParam(req.params.id), from, to, d.note, req.user.id, d.evidenceLevel ?? null])).rows[0];
      if (!c) throw invalid();
      await audit(db, { actor: req.user, action: `case.${path}`, targetType: 'case', targetId: c.id, details: { note: d.note, evidenceLevel: d.evidenceLevel ?? null } });
    });
    res.json({ ok: true });
  });
  caseAction('approve', { schema: z.object({ note: optText(1000, 'Note'), evidenceLevel: z.enum(['lawyer_claim', 'public_reference', 'verified_document']).optional() }), from: ['pending', 'hidden', 'rejected'], to: 'published' });
  caseAction('reject', { schema: noteReq('Reason'), from: ['pending', 'published', 'hidden'], to: 'rejected' });
  caseAction('unpublish', { schema: noteOpt, from: ['published'], to: 'hidden' });

  // ---- Categories and locations -----------------------------------------------------------------
  router.get('/categories', async (req, res) => {
    const { rows } = await query('SELECT id, name, slug, description, is_active, sort_order, (SELECT count(*) FROM lawyer_specializations s WHERE s.category_id = c.id)::int AS lawyers FROM legal_categories c ORDER BY sort_order, name');
    res.json({ categories: rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, isActive: c.is_active, sortOrder: c.sort_order, lawyerCount: c.lawyers })) });
  });
  const catSchema = z.object({ name: text(2, 80, 'Name'), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and hyphens').max(60).optional(),
    description: optText(300, 'Description'), isActive: z.boolean().optional(), sortOrder: z.coerce.number().int().min(0).max(10000).optional() });
  const uniqueError = (err, field) => { if (err.code === '23505') throw fieldError(field, 'That value is already in use'); throw err; };
  router.post('/categories', limiters.write, async (req, res) => {
    const d = parse(catSchema, req.body);
    try {
      const row = await tx(async (db) => {
        const { rows: [c] } = await db.query('INSERT INTO legal_categories (name, slug, description, sort_order) VALUES ($1,$2,$3,COALESCE($4,(SELECT COALESCE(max(sort_order),0)+1 FROM legal_categories))) RETURNING id', [d.name, d.slug ?? (slugify(d.name) || 'category'), d.description, d.sortOrder ?? null]);
        await audit(db, { actor: req.user, action: 'category.create', targetType: 'category', targetId: c.id, details: { name: d.name } });
        return c;
      });
      res.status(201).json({ id: row.id });
    } catch (err) { uniqueError(err, 'name'); }
  });
  router.patch('/categories/:id', limiters.write, async (req, res) => {
    const d = parse(catSchema.partial(), req.body);
    try {
      await tx(async (db) => {
        const c = (await db.query(`UPDATE legal_categories SET name = COALESCE($2, name), description = CASE WHEN $3::boolean THEN $4 ELSE description END,
              is_active = COALESCE($5, is_active), sort_order = COALESCE($6, sort_order) WHERE id = $1 RETURNING id`,
          [Number(req.params.id) || 0, d.name ?? null, 'description' in d, d.description ?? null, d.isActive ?? null, d.sortOrder ?? null])).rows[0];
        if (!c) throw notFound();
        await audit(db, { actor: req.user, action: 'category.update', targetType: 'category', targetId: c.id, details: d });
      });
      res.json({ ok: true });
    } catch (err) { uniqueError(err, 'name'); }
  });

  router.get('/locations', async (req, res) => {
    const { rows } = await query('SELECT id, name, region, country_code, is_active, sort_order, (SELECT count(*) FROM lawyer_profiles lp WHERE lp.location_id = l.id)::int AS lawyers FROM locations l ORDER BY country_code, sort_order, name');
    res.json({ locations: rows.map((l) => ({ id: l.id, name: l.name, region: l.region, countryCode: l.country_code, isActive: l.is_active, sortOrder: l.sort_order, lawyerCount: l.lawyers })) });
  });
  const locSchema = z.object({ name: text(2, 80, 'Name'), region: optText(80, 'Region'), countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use a two-letter country code').optional(),
    isActive: z.boolean().optional(), sortOrder: z.coerce.number().int().min(0).max(10000).optional() });
  router.post('/locations', limiters.write, async (req, res) => {
    const d = parse(locSchema, req.body);
    try {
      const row = await tx(async (db) => {
        const { rows: [l] } = await db.query(`INSERT INTO locations (name, region, country_code, sort_order) VALUES ($1,$2,COALESCE($3,'ET'),COALESCE($4,(SELECT COALESCE(max(sort_order),0)+1 FROM locations))) RETURNING id`, [d.name, d.region, d.countryCode ?? null, d.sortOrder ?? null]);
        await audit(db, { actor: req.user, action: 'location.create', targetType: 'location', targetId: l.id, details: { name: d.name } });
        return l;
      });
      res.status(201).json({ id: row.id });
    } catch (err) { uniqueError(err, 'name'); }
  });
  router.patch('/locations/:id', limiters.write, async (req, res) => {
    const d = parse(locSchema.partial(), req.body);
    try {
      await tx(async (db) => {
        const l = (await db.query(`UPDATE locations SET name = COALESCE($2, name), region = CASE WHEN $3::boolean THEN $4 ELSE region END, country_code = COALESCE($5, country_code),
              is_active = COALESCE($6, is_active), sort_order = COALESCE($7, sort_order) WHERE id = $1 RETURNING id`,
          [Number(req.params.id) || 0, d.name ?? null, 'region' in d, d.region ?? null, d.countryCode ?? null, d.isActive ?? null, d.sortOrder ?? null])).rows[0];
        if (!l) throw notFound();
        await audit(db, { actor: req.user, action: 'location.update', targetType: 'location', targetId: l.id, details: d });
      });
      res.json({ ok: true });
    } catch (err) { uniqueError(err, 'name'); }
  });

  // ---- Accounts ---------------------------------------------------------------------------------
  router.get('/users', async (req, res) => {
    const { page, pageSize, offset } = pageOf(req);
    const role = oneOf(req.query.role, ['client', 'lawyer', 'admin']);
    const status = oneOf(req.query.status, ['active', 'suspended', 'deleted']);
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? like(req.query.q.trim()) : null;
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.status, u.status_reason, u.created_at, u.last_login_at, u.is_demo, lp.slug, count(*) OVER ()::int AS total
         FROM users u LEFT JOIN lawyer_profiles lp ON lp.user_id = u.id
        WHERE ($1::text IS NULL OR u.role::text = $1) AND ($2::text IS NULL OR u.status::text = $2) AND ($3::text IS NULL OR u.email ILIKE $3 OR u.full_name ILIKE $3)
        ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`, [role, status, q, pageSize, offset]);
    res.json({
      users: rows.map((u) => ({ id: u.id, email: u.email, fullName: u.full_name, role: u.role, status: u.status, statusReason: u.status_reason, createdAt: u.created_at, lastLoginAt: u.last_login_at, isDemo: u.is_demo, lawyerSlug: u.slug, isYou: u.id === req.user.id })),
      total: rows[0]?.total ?? 0, page, pageSize,
    });
  });
  router.post('/users/:id/suspend', limiters.write, async (req, res) => {
    const d = parse(z.object({ reason: text(5, 500, 'Reason') }), req.body);
    const id = uuidParam(req.params.id);
    if (id === req.user.id) throw new HttpError(400, 'You cannot suspend your own account.', 'forbidden_target');
    await tx(async (db) => {
      const u = (await db.query('SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!u) throw notFound();
      if (u.role === 'admin') throw new HttpError(403, 'Administrator accounts cannot be suspended here.', 'forbidden_target');
      if (u.status !== 'active') throw invalid('Only active accounts can be suspended.');
      await db.query(`UPDATE users SET status = 'suspended', status_reason = $2, token_version = token_version + 1 WHERE id = $1`, [id, d.reason]);
      await db.query(`UPDATE lawyer_profiles SET profile_status = 'suspended' WHERE user_id = $1`, [id]);
      await db.query(`UPDATE appointments SET status = 'cancelled', cancelled_by = $2, decided_at = now()
                       WHERE status IN ('requested','confirmed') AND lawyer_profile_id IN (SELECT id FROM lawyer_profiles WHERE user_id = $1)`, [id, req.user.id]);
      await audit(db, { actor: req.user, action: 'user.suspend', targetType: 'user', targetId: id, details: { reason: d.reason } });
    });
    res.json({ ok: true });
  });
  router.post('/users/:id/reinstate', limiters.write, async (req, res) => {
    const id = uuidParam(req.params.id);
    await tx(async (db) => {
      const u = (await db.query(`UPDATE users SET status = 'active', status_reason = NULL WHERE id = $1 AND status = 'suspended' RETURNING id`, [id])).rows[0];
      if (!u) throw invalid('Only suspended accounts can be reinstated.');
      // A reinstated lawyer returns to DRAFT: they must republish deliberately.
      await db.query(`UPDATE lawyer_profiles SET profile_status = 'draft' WHERE user_id = $1 AND profile_status = 'suspended'`, [id]);
      await audit(db, { actor: req.user, action: 'user.reinstate', targetType: 'user', targetId: id });
    });
    res.json({ ok: true });
  });

  // ---- Audit log --------------------------------------------------------------------------------
  router.get('/audit', async (req, res) => {
    const { page, pageSize, offset } = pageOf(req);
    const action = typeof req.query.action === 'string' && req.query.action ? req.query.action.slice(0, 60) : null;
    const actor = typeof req.query.actor === 'string' && req.query.actor.trim() ? like(req.query.actor.trim()) : null;
    const { rows } = await query(
      `SELECT a.id, a.action, a.actor_role, a.target_type, a.target_id, a.details, a.created_at, u.full_name AS actor_name, count(*) OVER ()::int AS total
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
        WHERE ($1::text IS NULL OR a.action = $1) AND ($2::text IS NULL OR u.full_name ILIKE $2 OR u.email ILIKE $2)
        ORDER BY a.created_at DESC, a.id DESC LIMIT $3 OFFSET $4`, [action, actor, pageSize, offset]);
    res.json({
      entries: rows.map((e) => ({ id: e.id, action: e.action, actorName: e.actor_name, actorRole: e.actor_role, targetType: e.target_type, targetId: e.target_id, details: e.details, createdAt: e.created_at })),
      total: rows[0]?.total ?? 0, page, pageSize,
    });
  });

  return router;
}
