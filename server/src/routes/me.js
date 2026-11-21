// All routes need a session.
// GET    /api/me/dashboard      client -> { stats:{ openRequests, activeConversations, quotationsAwaitingResponse, upcomingAppointments, savedLawyers }, upcomingAppointments:[{id,lawyerName,lawyerSlug,startsAt,mode,status}] }
//                               lawyer -> { stats:{ inquiriesAwaitingReply, quotationRequestsAwaiting, pendingAppointments, upcomingAppointments }, verification:{status}, profile:{ slug, profileStatus, checklist:[{key,label,done,required}], completed, total } }
//                               admin -> 403 (use /api/admin/overview)
// PATCH  /api/me                { fullName?, preferredLanguage?, phone? } -> { user }
// POST   /api/me/password       { currentPassword, newPassword } -> { ok } (all other sessions are revoked, this one re-issued)
// GET    /api/me/export         -> JSON download of the person's own data
// POST   /api/me/delete         { password } -> { ok, retentionDays } (account anonymised and closed; session cleared)
// GET    /api/me/saved          client -> { lawyers:[card] };  PUT|DELETE /api/me/saved/:profileId  client -> { ok }
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { one, query, tx } from '../db.js';
import { loadChecklist } from '../lib/checklist.js';
import { CARD_COLUMNS, CARD_FROM, mapCard } from '../lib/lawyerQueries.js';
import { optLanguage, optText, text } from '../lib/validators.js';
import { clearSession, issueSession, requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError, notFound, parse, uuidParam } from '../middleware/errors.js';
import { userPayload } from './auth.js';

const profileSchema = z.object({
  fullName: text(2, 120, 'Full name').optional(),
  preferredLanguage: optLanguage.optional(),
  phone: optText(30, 'Phone').optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: z.string().min(10, 'Use at least 10 characters').max(72, 'Use at most 72 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number'),
});
const deleteSchema = z.object({ password: z.string().min(1, 'Enter your password to confirm').max(200) });


export default function meRoutes({ limiters }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/dashboard', async (req, res) => {
    const { id, role } = req.user;
    if (role === 'client') {
      const [stats, upcoming] = await Promise.all([
        one(`SELECT
              (SELECT count(*) FROM legal_requests WHERE client_id = $1 AND status = 'open')::int AS open_requests,
              (SELECT count(*) FROM conversations WHERE client_id = $1 AND status = 'open')::int AS active_conversations,
              (SELECT count(*) FROM quotations WHERE client_id = $1 AND status = 'proposed')::int AS quotations_awaiting,
              (SELECT count(*) FROM appointments WHERE client_id = $1 AND status IN ('requested','confirmed') AND starts_at > now())::int AS upcoming_appointments,
              (SELECT count(*) FROM saved_lawyers WHERE client_id = $1)::int AS saved_lawyers`, [id]),
        query(`SELECT a.id, a.starts_at, a.mode, a.status, lp.slug, u.full_name
                 FROM appointments a JOIN lawyer_profiles lp ON lp.id = a.lawyer_profile_id JOIN users u ON u.id = lp.user_id
                WHERE a.client_id = $1 AND a.status IN ('requested','confirmed') AND a.starts_at > now()
                ORDER BY a.starts_at LIMIT 5`, [id]),
      ]);
      return res.json({
        stats: {
          openRequests: stats.open_requests, activeConversations: stats.active_conversations,
          quotationsAwaitingResponse: stats.quotations_awaiting, upcomingAppointments: stats.upcoming_appointments, savedLawyers: stats.saved_lawyers,
        },
        upcomingAppointments: upcoming.rows.map((a) => ({
          id: a.id, lawyerName: a.full_name, lawyerSlug: a.slug, startsAt: a.starts_at, mode: a.mode, status: a.status,
        })),
      });
    }
    if (role === 'lawyer') {
      const profile = await one('SELECT id, slug, profile_status, verification_status FROM lawyer_profiles WHERE user_id = $1', [id]);
      if (!profile) throw notFound();
      const [stats, checklist] = await Promise.all([
        one(`SELECT
              (SELECT count(*) FROM conversations c WHERE c.lawyer_profile_id = $1 AND c.status = 'open'
                  AND (c.lawyer_last_read_at IS NULL OR c.lawyer_last_read_at < c.last_message_at))::int AS inquiries,
              (SELECT count(*) FROM quotations WHERE lawyer_profile_id = $1 AND status IN ('requested','revision_requested'))::int AS quotes,
              (SELECT count(*) FROM appointments WHERE lawyer_profile_id = $1 AND status = 'requested' AND starts_at > now())::int AS pending,
              (SELECT count(*) FROM appointments WHERE lawyer_profile_id = $1 AND status = 'confirmed' AND starts_at > now())::int AS upcoming`, [profile.id]),
        loadChecklist({ query }, profile.id),
      ]);
      return res.json({
        stats: { inquiriesAwaitingReply: stats.inquiries, quotationRequestsAwaiting: stats.quotes, pendingAppointments: stats.pending, upcomingAppointments: stats.upcoming },
        verification: { status: profile.verification_status },
        profile: {
          slug: profile.slug, profileStatus: profile.profile_status, checklist,
          completed: checklist.filter((c) => c.done).length, total: checklist.length,
        },
      });
    }
    throw new HttpError(403, 'Administrators use the admin overview.', 'forbidden');
  });

  router.patch('/', limiters.write, async (req, res) => {
    const d = parse(profileSchema, req.body);
    await query(
      `UPDATE users SET full_name = COALESCE($2, full_name), preferred_language = COALESCE($3, preferred_language),
                        phone = CASE WHEN $4::boolean THEN $5 ELSE phone END WHERE id = $1`,
      [req.user.id, d.fullName ?? null, d.preferredLanguage ?? null, 'phone' in d, d.phone ?? null]);
    res.json({ user: await userPayload(req.user.id) });
  });

  router.post('/password', limiters.auth, async (req, res) => {
    const d = parse(passwordSchema, req.body);
    const row = await one('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(d.currentPassword, row.password_hash))) {
      throw new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { currentPassword: 'That is not your current password' });
    }
    const hash = await bcrypt.hash(d.newPassword, config.bcryptRounds);
    const updated = await one('UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING id, token_version', [req.user.id, hash]);
    issueSession(res, updated);
    res.json({ ok: true });
  });

  router.get('/export', async (req, res) => {
    const { id, role } = req.user;
    const user = await one('SELECT id, email, role, full_name, phone, preferred_language, created_at, terms_accepted_at FROM users WHERE id = $1', [id]);
    const data = { exportedAt: new Date().toISOString(), account: user };
    if (role === 'client') {
      data.requests = (await query('SELECT * FROM legal_requests WHERE client_id = $1 ORDER BY created_at', [id])).rows;
      data.conversations = (await query(
        `SELECT c.id, c.created_at, c.request_shared_at, lp.slug AS lawyer_slug,
                (SELECT json_agg(json_build_object('sentAt', m.created_at, 'fromYou', m.sender_id = $1, 'body', m.body) ORDER BY m.created_at)
                   FROM messages m WHERE m.conversation_id = c.id) AS messages
           FROM conversations c JOIN lawyer_profiles lp ON lp.id = c.lawyer_profile_id WHERE c.client_id = $1`, [id])).rows;
      data.quotations = (await query('SELECT id, status, client_budget, client_scope_notes, total_estimate, scope_of_work, created_at FROM quotations WHERE client_id = $1', [id])).rows;
      data.appointments = (await query('SELECT id, starts_at, ends_at, mode, reason, status FROM appointments WHERE client_id = $1', [id])).rows;
      data.savedLawyers = (await query('SELECT lp.slug, s.created_at FROM saved_lawyers s JOIN lawyer_profiles lp ON lp.id = s.lawyer_profile_id WHERE s.client_id = $1', [id])).rows;
      data.reviews = (await query('SELECT id, rating, body, status, created_at FROM reviews WHERE client_id = $1', [id])).rows;
    } else if (role === 'lawyer') {
      data.profile = await one(
        `SELECT slug, professional_title, bio, qualifications, years_experience, languages, consultation_modes, consultation_fee, hourly_rate,
                public_email, public_phone, profile_status, verification_status, created_at FROM lawyer_profiles WHERE user_id = $1`, [id]);
    }
    res.set('Content-Disposition', 'attachment; filename="haqlink-my-data.json"').set('Cache-Control', 'private, no-store');
    res.json(data);
  });

  router.post('/delete', limiters.auth, async (req, res) => {
    const d = parse(deleteSchema, req.body);
    if (req.user.role === 'admin') throw new HttpError(403, 'Administrator accounts cannot be closed here.', 'forbidden');
    const row = await one('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(d.password, row.password_hash))) {
      throw new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { password: 'That password is not correct' });
    }
    const randomHash = await bcrypt.hash(`${Math.random()}${Date.now()}`, 4);
    await tx(async (db) => {
      const id = req.user.id;
      await db.query(
        `UPDATE users SET email = $2, full_name = 'Deleted account', phone = NULL, password_hash = $3, status = 'deleted',
                          deleted_at = now(), token_version = token_version + 1 WHERE id = $1`,
        [id, `deleted-${id}@deleted.invalid`, randomHash]);
      await db.query(`UPDATE appointments SET status = 'cancelled', cancelled_by = $1, decided_at = now()
                       WHERE status IN ('requested','confirmed') AND (client_id = $1 OR lawyer_profile_id IN (SELECT id FROM lawyer_profiles WHERE user_id = $1))`, [id]);
      await db.query('DELETE FROM legal_requests WHERE client_id = $1', [id]);
      await db.query('DELETE FROM saved_lawyers WHERE client_id = $1', [id]);
      await db.query(
        `UPDATE lawyer_profiles SET profile_status = 'draft', public_email = NULL, public_phone = NULL, office_address = NULL, bio = NULL
          WHERE user_id = $1`, [id]);
    });
    clearSession(res);
    res.json({ ok: true, retentionDays: config.deletedAccountRetentionDays });
  });

  // ---- Saved lawyers (clients) ------------------------------------------------------------------
  router.get('/saved', requireRole('client'), async (req, res) => {
    const { rows } = await query(
      `SELECT ${CARD_COLUMNS} ${CARD_FROM} JOIN saved_lawyers sv ON sv.lawyer_profile_id = lp.id
        WHERE sv.client_id = $1 AND lp.profile_status = 'published' ORDER BY sv.created_at DESC LIMIT 100`, [req.user.id]);
    res.json({ lawyers: rows.map(mapCard) });
  });
  router.put('/saved/:profileId', requireRole('client'), limiters.write, async (req, res) => {
    const profileId = uuidParam(req.params.profileId);
    const exists = await one(`SELECT id FROM lawyer_profiles WHERE id = $1 AND profile_status = 'published'`, [profileId]);
    if (!exists) throw notFound();
    await query('INSERT INTO saved_lawyers (client_id, lawyer_profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, profileId]);
    res.json({ ok: true });
  });
  router.delete('/saved/:profileId', requireRole('client'), limiters.write, async (req, res) => {
    await query('DELETE FROM saved_lawyers WHERE client_id = $1 AND lawyer_profile_id = $2', [req.user.id, uuidParam(req.params.profileId)]);
    res.json({ ok: true });
  });

  return router;
}
