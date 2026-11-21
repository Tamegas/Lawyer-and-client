// GET  /api/reviews/lawyer/:slug        public -> { reviews:[{ id, rating, body, createdAt, author }], summary:{ average, count, distribution:{1..5} } }  (published reviews of a published profile)
// GET  /api/reviews/eligibility/:slug   client -> { eligible, appointmentId?, reason }
// POST /api/reviews                     client { appointmentId, rating 1-5, body 20-2000 } -> 201 { review }
//   Only for the client's OWN completed appointment, once per appointment; text with an email, phone number or link is rejected.
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { containsContactDetails, shortName } from '../lib/text.js';
import { text } from '../lib/validators.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError, notFound, parse } from '../middleware/errors.js';

const reviewSchema = z.object({
  appointmentId: z.string().uuid('Choose a completed appointment'),
  rating: z.coerce.number({ invalid_type_error: 'Choose a star rating' }).int('Choose a star rating').min(1, 'Choose a star rating').max(5, 'Choose a star rating'),
  body: text(20, 2000, 'Review'),
});

export default function reviewRoutes({ limiters }) {
  const router = Router();

  router.get('/lawyer/:slug', async (req, res) => {
    const profile = await one(`SELECT id FROM lawyer_profiles WHERE slug = $1 AND profile_status = 'published'`, [String(req.params.slug).slice(0, 80)]);
    if (!profile) throw notFound();
    const [list, dist] = await Promise.all([
      query(`SELECT r.id, r.rating, r.body, r.created_at, u.full_name FROM reviews r LEFT JOIN users u ON u.id = r.client_id
              WHERE r.lawyer_profile_id = $1 AND r.status = 'published' ORDER BY r.created_at DESC LIMIT 100`, [profile.id]),
      query(`SELECT rating, count(*)::int AS n FROM reviews WHERE lawyer_profile_id = $1 AND status = 'published' GROUP BY rating`, [profile.id]),
    ]);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    dist.rows.forEach((d) => { distribution[d.rating] = d.n; });
    const count = Object.values(distribution).reduce((a, b) => a + b, 0);
    const sum = Object.entries(distribution).reduce((a, [k, v]) => a + Number(k) * v, 0);
    res.json({
      reviews: list.rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.created_at, author: r.full_name && r.full_name !== 'Deleted account' ? shortName(r.full_name) : 'Former client' })),
      summary: { average: count ? Math.round((sum / count) * 10) / 10 : null, count, distribution },
    });
  });

  router.get('/eligibility/:slug', requireRole('client'), async (req, res) => {
    const profile = await one(`SELECT id FROM lawyer_profiles WHERE slug = $1 AND profile_status = 'published'`, [String(req.params.slug).slice(0, 80)]);
    if (!profile) throw notFound();
    const appt = await one(
      `SELECT a.id FROM appointments a WHERE a.client_id = $1 AND a.lawyer_profile_id = $2 AND a.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.appointment_id = a.id) ORDER BY a.starts_at DESC LIMIT 1`, [req.user.id, profile.id]);
    if (appt) return res.json({ eligible: true, appointmentId: appt.id, reason: 'You had a completed appointment with this lawyer.' });
    const any = await one(`SELECT 1 AS yes FROM appointments WHERE client_id = $1 AND lawyer_profile_id = $2 AND status = 'completed'`, [req.user.id, profile.id]);
    return res.json({
      eligible: false,
      reason: any ? 'You have already reviewed your completed appointment(s) with this lawyer.'
        : 'Reviews can be written only after an appointment with this lawyer has been marked completed.',
    });
  });

  router.post('/', requireRole('client'), limiters.write, async (req, res) => {
    const d = parse(reviewSchema, req.body);
    const fieldError = (field, message) => new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { [field]: message });
    if (containsContactDetails(d.body)) throw fieldError('body', 'Please remove email addresses, phone numbers and links from your review');
    const appt = await one('SELECT id, lawyer_profile_id, status FROM appointments WHERE id = $1 AND client_id = $2', [d.appointmentId, req.user.id]);
    if (!appt) throw notFound();
    if (appt.status !== 'completed') throw new HttpError(409, 'You can review an appointment only after it has been completed.', 'not_eligible');
    try {
      const row = await one(
        `INSERT INTO reviews (lawyer_profile_id, client_id, appointment_id, rating, body) VALUES ($1,$2,$3,$4,$5) RETURNING id, rating, body, created_at`,
        [appt.lawyer_profile_id, req.user.id, appt.id, d.rating, d.body]);
      res.status(201).json({ review: { id: row.id, rating: row.rating, body: row.body, createdAt: row.created_at } });
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'You have already reviewed this appointment.', 'already_reviewed');
      throw err;
    }
  });

  return router;
}
