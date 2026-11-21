// The lawyer's own workspace. Mounted at /api/lawyer, role `lawyer` only. Every row is scoped to the caller's own profile.
//   GET  /profile                  -> { profile:{...private+public fields, specializationIds}, checklist, requireVerificationToPublish }
//   PUT  /profile                  { professionalTitle, bio?, qualifications?, yearsExperience?, locationId?, officeAddress?, languages[], consultationModes[], acceptingNewClients? }
//   PUT  /specializations          { categoryIds:[int] (1..6) }
//   PUT  /fees                     { consultationFee?, hourlyRate?, feeNegotiable?, paymentPlans? }   (empty fee = "Contact for pricing")
//   GET|POST /fixed-fees           { title, description?, amount };  PUT|DELETE /fixed-fees/:id
//   GET|PUT  /availability         { timezone, slotMinutes, ranges:[{ weekday 0-6 (0=Sunday), startTime 'HH:MM', endTime }] } overlaps rejected
//   GET|POST /cases                { categoryId, title, description, lawyerRole, outcome?, publicReference?, caseYear, confidentialityConfirmed:true }
//   PUT|DELETE /cases/:id          every edit puts the summary back to `pending` moderation; `evidenceLevel` is lawyer_claim or public_reference (admins may raise it)
//   PUT  /contact                  { publicEmail?, publicPhone? }  (publishing makes them visible to everyone; empty = private)
//   GET  /credentials              -> { credentials:[{ id, credentialType, issuingBody, referenceNumber, issuedOn, expiresOn, originalFilename, mimeType, sizeBytes, status, reviewNote, createdAt }] }
//   POST /credentials              multipart: file + { credentialType, issuingBody?, referenceNumber?, issuedOn?, expiresOn? }   (limiters.upload)
//   DELETE /credentials/:id        (not allowed once verified);  GET /credentials/:id/file  (owner download)
//   GET  /verification             -> { verificationStatus, application:{ id, status, lawyerNote, adminNote, submittedAt, decidedAt }|null }
//   POST /verification/submit      { note? } needs at least one uploaded credential
//   POST /publish | /unpublish     publish needs the required checklist items (and verification when REQUIRE_VERIFICATION_TO_PUBLISH=true)
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { one, query, tx } from '../db.js';
import { loadChecklist } from '../lib/checklist.js';
import { ALLOWED_TYPES, sniffFileType, streamCredential } from '../lib/credentialFile.js';
import { CONSULT_MODES } from '../lib/reference.js';
import { deleteStored, saveCredentialFile } from '../lib/storage.js';
import { isValidTimeZone } from '../lib/time.js';
import { intId, language, optIntId, optIsoDate, optMoney, optText, text } from '../lib/validators.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError, notFound, parse, uuidParam } from '../middleware/errors.js';
import { uploadOne } from '../middleware/upload.js';

const fieldError = (field, message) => new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { [field]: message });
const hhmm = (t) => String(t).slice(0, 5);
const optInt = (min, max, label) => z.preprocess((v) => (v === '' || v === undefined ? null : v),
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} cannot be below ${min}`).max(max, `${label} cannot be above ${max}`).nullable());

const basicsSchema = z.object({
  professionalTitle: text(2, 120, 'Professional title'),
  bio: optText(4000, 'Biography'),
  qualifications: optText(3000, 'Qualifications'),
  yearsExperience: optInt(0, 70, 'Years of experience'),
  locationId: optIntId,
  officeAddress: optText(300, 'Office address'),
  languages: z.array(language).max(10, 'List at most 10 languages').default([]),
  consultationModes: z.array(z.enum(CONSULT_MODES)).min(1, 'Choose at least one consultation option').default(['online']),
  acceptingNewClients: z.boolean().default(true),
});
const feesSchema = z.object({ consultationFee: optMoney, hourlyRate: optMoney, feeNegotiable: z.boolean().default(false), paymentPlans: z.boolean().default(false) });
const fixedFeeSchema = z.object({ title: text(2, 120, 'Title'), description: optText(500, 'Description'), amount: z.coerce.number().min(0, 'The amount cannot be negative').max(1_000_000_000) });
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const availabilitySchema = z.object({
  timezone: z.string().refine(isValidTimeZone, 'Choose a valid time zone'),
  slotMinutes: z.coerce.number().int().min(15, 'Slots must be at least 15 minutes').max(240, 'Slots can be at most 240 minutes'),
  ranges: z.array(z.object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(TIME_RE, 'Use HH:MM'),
    endTime: z.string().regex(TIME_RE, 'Use HH:MM'),
  })).max(42, 'Too many time ranges'),
});
const thisYear = () => new Date().getFullYear();
const caseSchema = z.object({
  categoryId: intId,
  title: text(3, 140, 'Title'),
  description: text(20, 1500, 'Description'),
  lawyerRole: text(2, 160, 'Your role'),
  outcome: optText(600, 'Outcome'),
  publicReference: optText(300, 'Public reference'),
  caseYear: z.coerce.number({ invalid_type_error: 'Enter a year' }).int().min(1950, 'Enter a year from 1950').refine((y) => y <= thisYear(), 'The year cannot be in the future'),
  confidentialityConfirmed: z.literal(true, { errorMap: () => ({ message: 'Please confirm that this summary contains no confidential or identifying details' }) }),
});
const contactSchema = z.object({
  publicEmail: optText(254, 'Email').refine((v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address'),
  publicPhone: optText(30, 'Phone').refine((v) => v == null || (v.length >= 5 && /^[+\d\s().-]+$/.test(v)), 'Enter a valid phone number'),
});
const credentialSchema = z.object({
  credentialType: z.enum(['bar_license', 'law_degree', 'professional_certificate', 'other'], { errorMap: () => ({ message: 'Choose a document type' }) }),
  issuingBody: optText(160, 'Issuing body'),
  referenceNumber: optText(80, 'Reference number'),
  issuedOn: optIsoDate,
  expiresOn: optIsoDate,
});

const mapCase = (c) => ({
  id: c.id, categoryId: c.category_id, categoryName: c.category_name, title: c.title, description: c.description, lawyerRole: c.lawyer_role,
  outcome: c.outcome, publicReference: c.public_reference, caseYear: c.case_year, evidenceLevel: c.evidence_level, status: c.status,
  moderationNote: c.moderation_note, isDemo: c.is_demo, createdAt: c.created_at, updatedAt: c.updated_at,
});
const mapCredential = (c) => ({
  id: c.id, credentialType: c.credential_type, issuingBody: c.issuing_body, referenceNumber: c.reference_number, issuedOn: c.issued_on,
  expiresOn: c.expires_on, originalFilename: c.original_filename, mimeType: c.mime_type, sizeBytes: c.size_bytes,
  status: c.status, reviewNote: c.review_note, createdAt: c.created_at, reviewedAt: c.reviewed_at,
});
const mapFixed = (f) => ({ id: f.id, title: f.title, description: f.description, amount: f.amount });

const CASE_SELECT = `SELECT ce.*, c.name AS category_name FROM case_experience ce JOIN legal_categories c ON c.id = ce.category_id`;

export default function lawyerSelfRoutes({ limiters }) {
  const router = Router();
  router.use(requireRole('lawyer'));

  // Attach the caller's profile row to every request (their own, never anybody else's).
  router.use(async (req, res, next) => {
    req.profile = await one('SELECT * FROM lawyer_profiles WHERE user_id = $1', [req.user.id]);
    if (!req.profile) return next(notFound('No lawyer profile found for this account.'));
    return next();
  });

  router.get('/profile', async (req, res) => {
    const p = req.profile;
    const [specs, checklist] = await Promise.all([
      query('SELECT category_id FROM lawyer_specializations WHERE lawyer_profile_id = $1', [p.id]),
      loadChecklist({ query }, p.id),
    ]);
    res.json({
      profile: {
        id: p.id, slug: p.slug, professionalTitle: p.professional_title, bio: p.bio, qualifications: p.qualifications,
        yearsExperience: p.years_experience, locationId: p.location_id, officeAddress: p.office_address, languages: p.languages,
        consultationModes: p.consultation_modes, acceptingNewClients: p.accepting_new_clients, currency: p.currency,
        consultationFee: p.consultation_fee, hourlyRate: p.hourly_rate, feeNegotiable: p.fee_negotiable, paymentPlans: p.payment_plans,
        timezone: p.timezone, slotMinutes: p.slot_minutes, publicEmail: p.public_email, publicPhone: p.public_phone,
        profileStatus: p.profile_status, verificationStatus: p.verification_status, verifiedAt: p.verified_at, isDemo: p.is_demo,
        specializationIds: specs.rows.map((s) => s.category_id),
      },
      checklist,
      requireVerificationToPublish: config.requireVerificationToPublish,
    });
  });

  router.put('/profile', limiters.write, async (req, res) => {
    const d = parse(basicsSchema, req.body);
    if (d.locationId) {
      const loc = await one('SELECT id FROM locations WHERE id = $1 AND is_active', [d.locationId]);
      if (!loc) throw fieldError('locationId', 'Choose a listed location');
    }
    await query(
      `UPDATE lawyer_profiles SET professional_title = $2, bio = $3, qualifications = $4, years_experience = $5, location_id = $6,
              office_address = $7, languages = $8, consultation_modes = $9, accepting_new_clients = $10 WHERE id = $1`,
      [req.profile.id, d.professionalTitle, d.bio, d.qualifications, d.yearsExperience, d.locationId, d.officeAddress, d.languages, d.consultationModes, d.acceptingNewClients]);
    res.json({ ok: true });
  });

  router.put('/specializations', limiters.write, async (req, res) => {
    const { categoryIds } = parse(z.object({ categoryIds: z.array(intId).min(1, 'Choose at least one practice area').max(6, 'Choose at most 6 practice areas') }), req.body);
    const unique = [...new Set(categoryIds)];
    const ok = await one('SELECT count(*)::int AS n FROM legal_categories WHERE id = ANY ($1) AND is_active', [unique]);
    if (ok.n !== unique.length) throw fieldError('categoryIds', 'Choose from the listed categories');
    await tx(async (db) => {
      await db.query('DELETE FROM lawyer_specializations WHERE lawyer_profile_id = $1', [req.profile.id]);
      await db.query('INSERT INTO lawyer_specializations (lawyer_profile_id, category_id) SELECT $1, unnest($2::int[])', [req.profile.id, unique]);
    });
    res.json({ ok: true });
  });

  router.put('/fees', limiters.write, async (req, res) => {
    const d = parse(feesSchema, req.body);
    await query('UPDATE lawyer_profiles SET consultation_fee = $2, hourly_rate = $3, fee_negotiable = $4, payment_plans = $5 WHERE id = $1',
      [req.profile.id, d.consultationFee, d.hourlyRate, d.feeNegotiable, d.paymentPlans]);
    res.json({ ok: true });
  });

  // ---- Fixed-fee services ---------------------------------------------------------------------
  router.get('/fixed-fees', async (req, res) => {
    const { rows } = await query('SELECT id, title, description, amount FROM lawyer_fixed_fee_services WHERE lawyer_profile_id = $1 ORDER BY sort_order, created_at', [req.profile.id]);
    res.json({ fixedFees: rows.map(mapFixed) });
  });
  router.post('/fixed-fees', limiters.write, async (req, res) => {
    const d = parse(fixedFeeSchema, req.body);
    const n = await one('SELECT count(*)::int AS n FROM lawyer_fixed_fee_services WHERE lawyer_profile_id = $1', [req.profile.id]);
    if (n.n >= 20) throw new HttpError(409, 'You can list up to 20 fixed-fee services.', 'limit_reached');
    const row = await one('INSERT INTO lawyer_fixed_fee_services (lawyer_profile_id, title, description, amount, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id, title, description, amount',
      [req.profile.id, d.title, d.description, d.amount, n.n]);
    res.status(201).json({ fixedFee: mapFixed(row) });
  });
  router.put('/fixed-fees/:id', limiters.write, async (req, res) => {
    const d = parse(fixedFeeSchema, req.body);
    const row = await one('UPDATE lawyer_fixed_fee_services SET title = $3, description = $4, amount = $5 WHERE id = $1 AND lawyer_profile_id = $2 RETURNING id, title, description, amount',
      [uuidParam(req.params.id), req.profile.id, d.title, d.description, d.amount]);
    if (!row) throw notFound();
    res.json({ fixedFee: mapFixed(row) });
  });
  router.delete('/fixed-fees/:id', limiters.write, async (req, res) => {
    const row = await one('DELETE FROM lawyer_fixed_fee_services WHERE id = $1 AND lawyer_profile_id = $2 RETURNING id', [uuidParam(req.params.id), req.profile.id]);
    if (!row) throw notFound();
    res.json({ ok: true });
  });

  // ---- Availability ---------------------------------------------------------------------------
  router.get('/availability', async (req, res) => {
    const { rows } = await query('SELECT weekday, start_time, end_time FROM lawyer_availability WHERE lawyer_profile_id = $1 ORDER BY weekday, start_time', [req.profile.id]);
    res.json({
      timezone: req.profile.timezone, slotMinutes: req.profile.slot_minutes,
      ranges: rows.map((r) => ({ weekday: r.weekday, startTime: hhmm(r.start_time), endTime: hhmm(r.end_time) })),
    });
  });
  router.put('/availability', limiters.write, async (req, res) => {
    const d = parse(availabilitySchema, req.body);
    d.ranges.forEach((r, i) => {
      if (r.startTime >= r.endTime) throw fieldError(`ranges.${i}`, 'The end time must be after the start time');
    });
    const sorted = [...d.ranges].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].weekday === sorted[i - 1].weekday && sorted[i].startTime < sorted[i - 1].endTime) {
        throw fieldError('ranges', 'Two time ranges on the same day overlap. Please merge or adjust them.');
      }
    }
    await tx(async (db) => {
      await db.query('UPDATE lawyer_profiles SET timezone = $2, slot_minutes = $3 WHERE id = $1', [req.profile.id, d.timezone, d.slotMinutes]);
      await db.query('DELETE FROM lawyer_availability WHERE lawyer_profile_id = $1', [req.profile.id]);
      for (const r of sorted) {
        await db.query('INSERT INTO lawyer_availability (lawyer_profile_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)', [req.profile.id, r.weekday, r.startTime, r.endTime]);
      }
    });
    res.json({ ok: true });
  });

  // ---- Case summaries ---------------------------------------------------------------------------
  router.get('/cases', async (req, res) => {
    const { rows } = await query(`${CASE_SELECT} WHERE ce.lawyer_profile_id = $1 ORDER BY ce.case_year DESC, ce.created_at DESC`, [req.profile.id]);
    res.json({ cases: rows.map(mapCase) });
  });
  const checkCategory = async (id) => {
    if (!(await one('SELECT id FROM legal_categories WHERE id = $1 AND is_active', [id]))) throw fieldError('categoryId', 'Choose a listed category');
  };
  router.post('/cases', limiters.write, async (req, res) => {
    const d = parse(caseSchema, req.body);
    await checkCategory(d.categoryId);
    const n = await one('SELECT count(*)::int AS n FROM case_experience WHERE lawyer_profile_id = $1', [req.profile.id]);
    if (n.n >= 30) throw new HttpError(409, 'You can add up to 30 case summaries.', 'limit_reached');
    const created = await one(
      `INSERT INTO case_experience (lawyer_profile_id, category_id, title, description, lawyer_role, outcome, public_reference, case_year, evidence_level, confidentiality_confirmed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING id`,
      [req.profile.id, d.categoryId, d.title, d.description, d.lawyerRole, d.outcome, d.publicReference, d.caseYear, d.publicReference ? 'public_reference' : 'lawyer_claim']);
    res.status(201).json({ case: mapCase(await one(`${CASE_SELECT} WHERE ce.id = $1`, [created.id])) });
  });
  router.put('/cases/:id', limiters.write, async (req, res) => {
    const id = uuidParam(req.params.id);
    const d = parse(caseSchema, req.body);
    await checkCategory(d.categoryId);
    const row = await one(
      `UPDATE case_experience SET category_id = $3, title = $4, description = $5, lawyer_role = $6, outcome = $7, public_reference = $8, case_year = $9,
              evidence_level = $10, status = 'pending', moderation_note = NULL, moderated_by = NULL, moderated_at = NULL
        WHERE id = $1 AND lawyer_profile_id = $2 RETURNING id`,
      [id, req.profile.id, d.categoryId, d.title, d.description, d.lawyerRole, d.outcome, d.publicReference, d.caseYear, d.publicReference ? 'public_reference' : 'lawyer_claim']);
    if (!row) throw notFound();
    res.json({ case: mapCase(await one(`${CASE_SELECT} WHERE ce.id = $1`, [id])) });
  });
  router.delete('/cases/:id', limiters.write, async (req, res) => {
    const row = await one('DELETE FROM case_experience WHERE id = $1 AND lawyer_profile_id = $2 RETURNING id', [uuidParam(req.params.id), req.profile.id]);
    if (!row) throw notFound();
    res.json({ ok: true });
  });

  // ---- Contact visibility -----------------------------------------------------------------------
  router.put('/contact', limiters.write, async (req, res) => {
    const d = parse(contactSchema, req.body);
    await query('UPDATE lawyer_profiles SET public_email = $2, public_phone = $3 WHERE id = $1', [req.profile.id, d.publicEmail, d.publicPhone]);
    res.json({ ok: true });
  });

  // ---- Credentials (private documents) ----------------------------------------------------------
  router.get('/credentials', async (req, res) => {
    const { rows } = await query('SELECT * FROM professional_credentials WHERE lawyer_profile_id = $1 ORDER BY created_at DESC', [req.profile.id]);
    res.json({ credentials: rows.map(mapCredential) });
  });
  router.post('/credentials', limiters.upload, uploadOne, async (req, res) => {
    const d = parse(credentialSchema, req.body);
    if (!req.file) throw fieldError('file', 'Choose a file to upload');
    const type = sniffFileType(req.file.buffer);
    if (!type) throw fieldError('file', `That file type is not accepted. Upload a ${ALLOWED_TYPES.map((t) => t.label).join(', ')} file.`);
    const n = await one('SELECT count(*)::int AS n FROM professional_credentials WHERE lawyer_profile_id = $1', [req.profile.id]);
    if (n.n >= 10) throw new HttpError(409, 'You can upload up to 10 documents. Delete one first.', 'limit_reached');
    const stored = await saveCredentialFile(req.file.buffer, type.ext);
    const original = String(req.file.originalname ?? 'document').replace(/[^\w.\- ]/g, '_').slice(0, 120);
    let row;
    try {
      row = await one(
        `INSERT INTO professional_credentials (lawyer_profile_id, credential_type, issuing_body, reference_number, issued_on, expires_on,
                original_filename, stored_filename, mime_type, size_bytes, sha256)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,encode(digest($11::bytea, 'sha256'), 'hex')) RETURNING *`,
        [req.profile.id, d.credentialType, d.issuingBody, d.referenceNumber, d.issuedOn, d.expiresOn, original, stored, type.mime, req.file.size, req.file.buffer]);
    } catch (err) {
      await deleteStored(stored);
      throw err;
    }
    res.status(201).json({ credential: mapCredential(row) });
  });
  router.delete('/credentials/:id', limiters.write, async (req, res) => {
    const id = uuidParam(req.params.id);
    const row = await one('SELECT id, status, stored_filename FROM professional_credentials WHERE id = $1 AND lawyer_profile_id = $2', [id, req.profile.id]);
    if (!row) throw notFound();
    if (row.status === 'verified') throw new HttpError(409, 'A verified document cannot be removed. Contact support if it needs to change.', 'invalid_state');
    await query('DELETE FROM professional_credentials WHERE id = $1', [id]);
    await deleteStored(row.stored_filename);
    res.json({ ok: true });
  });
  router.get('/credentials/:id/file', async (req, res) => {
    const row = await one('SELECT * FROM professional_credentials WHERE id = $1 AND lawyer_profile_id = $2', [uuidParam(req.params.id), req.profile.id]);
    if (!row) throw notFound();
    streamCredential(res, row);
  });

  // ---- Verification application -----------------------------------------------------------------
  router.get('/verification', async (req, res) => {
    const app = await one('SELECT * FROM verification_applications WHERE lawyer_profile_id = $1 ORDER BY submitted_at DESC LIMIT 1', [req.profile.id]);
    res.json({
      verificationStatus: req.profile.verification_status,
      application: app ? { id: app.id, status: app.status, lawyerNote: app.lawyer_note, adminNote: app.admin_note, submittedAt: app.submitted_at, decidedAt: app.decided_at } : null,
    });
  });
  router.post('/verification/submit', limiters.write, async (req, res) => {
    const { note } = parse(z.object({ note: optText(1500, 'Note') }), req.body);
    if (req.profile.verification_status === 'verified') throw new HttpError(409, 'Your profile is already verified.', 'invalid_state');
    const creds = await one(`SELECT count(*)::int AS n FROM professional_credentials WHERE lawyer_profile_id = $1 AND status <> 'rejected'`, [req.profile.id]);
    if (creds.n === 0) throw new HttpError(400, 'Upload at least one credential document before submitting.', 'validation_error', { credentials: 'Upload at least one credential document' });
    await tx(async (db) => {
      const open = (await db.query(`SELECT id FROM verification_applications WHERE lawyer_profile_id = $1 AND status IN ('submitted','more_info_requested') FOR UPDATE`, [req.profile.id])).rows[0];
      if (open) {
        await db.query(`UPDATE verification_applications SET status = 'submitted', lawyer_note = $2, submitted_at = now() WHERE id = $1`, [open.id, note]);
      } else {
        await db.query('INSERT INTO verification_applications (lawyer_profile_id, lawyer_note) VALUES ($1, $2)', [req.profile.id, note]);
      }
      await db.query(`UPDATE lawyer_profiles SET verification_status = 'pending' WHERE id = $1`, [req.profile.id]);
    });
    res.status(201).json({ ok: true });
  });

  // ---- Publishing -------------------------------------------------------------------------------
  router.post('/publish', limiters.write, async (req, res) => {
    const p = req.profile;
    if (p.profile_status === 'suspended') throw new HttpError(403, 'This profile has been suspended by an administrator.', 'profile_suspended');
    const missing = (await loadChecklist({ query }, p.id)).filter((c) => c.required && !c.done).map((c) => c.label);
    if (missing.length) throw new HttpError(409, `Before publishing: ${missing.join('; ')}.`, 'profile_incomplete', { checklist: missing.join('; ') });
    if (config.requireVerificationToPublish && p.verification_status !== 'verified') {
      throw new HttpError(409, 'This platform only publishes profiles after an administrator has verified your credentials. Submit your documents for verification first.', 'verification_required');
    }
    await query(`UPDATE lawyer_profiles SET profile_status = 'published' WHERE id = $1`, [p.id]);
    res.json({ ok: true, profileStatus: 'published' });
  });
  router.post('/unpublish', limiters.write, async (req, res) => {
    if (req.profile.profile_status === 'suspended') throw new HttpError(403, 'This profile has been suspended by an administrator.', 'profile_suspended');
    await query(`UPDATE lawyer_profiles SET profile_status = 'draft' WHERE id = $1`, [req.profile.id]);
    res.json({ ok: true, profileStatus: 'draft' });
  });

  return router;
}
