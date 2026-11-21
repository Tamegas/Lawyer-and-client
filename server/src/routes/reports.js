// POST /api/reports  any signed-in user { targetType:'lawyer_profile'|'review'|'case'|'message', targetId (uuid), reason, details? } -> 201 { ok }
//   The target must exist and be reportable (published profile / published review / published case / a message in a conversation the reporter takes part in).
//   A second open report by the same person about the same item -> 409 duplicate_report.
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { optText } from '../lib/validators.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, notFound, parse } from '../middleware/errors.js';

const schema = z.object({
  targetType: z.enum(['lawyer_profile', 'review', 'case', 'message'], { errorMap: () => ({ message: 'Choose what you are reporting' }) }),
  targetId: z.string().uuid('That item could not be found'),
  reason: z.enum(['misleading', 'impersonation', 'inappropriate', 'confidential_info', 'abusive', 'spam', 'other'], { errorMap: () => ({ message: 'Choose a reason' }) }),
  details: optText(1500, 'Details'),
});

const TARGET_CHECKS = {
  lawyer_profile: (id) => one(`SELECT id FROM lawyer_profiles WHERE id = $1 AND profile_status = 'published'`, [id]),
  review: (id) => one(`SELECT r.id FROM reviews r JOIN lawyer_profiles lp ON lp.id = r.lawyer_profile_id WHERE r.id = $1 AND r.status = 'published' AND lp.profile_status = 'published'`, [id]),
  case: (id) => one(`SELECT ce.id FROM case_experience ce JOIN lawyer_profiles lp ON lp.id = ce.lawyer_profile_id WHERE ce.id = $1 AND ce.status = 'published' AND lp.profile_status = 'published'`, [id]),
};

export default function reportRoutes({ limiters }) {
  const router = Router();
  router.use(requireAuth);
  router.post('/', limiters.write, async (req, res) => {
    const d = parse(schema, req.body);
    const target = d.targetType === 'message'
      ? await one(`SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN lawyer_profiles lp ON lp.id = c.lawyer_profile_id
                    WHERE m.id = $1 AND (c.client_id = $2 OR lp.user_id = $2)`, [d.targetId, req.user.id])
      : await TARGET_CHECKS[d.targetType](d.targetId);
    if (!target) throw notFound('That item could not be found.');
    try {
      await query('INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES ($1,$2,$3,$4,$5)', [req.user.id, d.targetType, d.targetId, d.reason, d.details]);
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'You have already reported this. Our team will review it.', 'duplicate_report');
      throw err;
    }
    res.status(201).json({ ok: true });
  });
  return router;
}
