import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { notFound, parse, uuidParam } from '../middleware/errors.js';
import { requireRole } from '../middleware/auth.js';
import { CARD_COLUMNS, CARD_FROM, mapCard } from '../lib/lawyerQueries.js';
import { rankMatches } from '../lib/matching.js';
import { CONSULT_PREFERENCES, HELP_TYPES } from '../lib/reference.js';
import { intId, optIntId, optIsoDate, optLanguage, optMoney, text } from '../lib/validators.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

const requestSchema = z.object({
  categoryId: intId,
  summary: text(20, 3000, 'Description'),
  locationId: optIntId,
  issueStartedOn: optIsoDate,
  hasUrgentDeadline: z.boolean().default(false),
  deadlineOn: optIsoDate,
  helpType: z.enum(HELP_TYPES).default('consultation'),
  preferredLanguage: optLanguage,
  consultationPreference: z.enum(CONSULT_PREFERENCES).default('either'),
  budgetMin: optMoney,
  budgetMax: optMoney,
  privacyAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm that you have read the privacy notice' }),
  }),
}).superRefine((v, ctx) => {
  if (v.budgetMin != null && v.budgetMax != null && v.budgetMax < v.budgetMin) {
    ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'Maximum budget must be at least the minimum' });
  }
  if (v.issueStartedOn && v.issueStartedOn > todayIso()) {
    ctx.addIssue({ code: 'custom', path: ['issueStartedOn'], message: 'The start date cannot be in the future' });
  }
  if (v.deadlineOn && !v.hasUrgentDeadline) {
    ctx.addIssue({ code: 'custom', path: ['hasUrgentDeadline'], message: 'Tick this box if you have a deadline or court date' });
  }
});

export function mapRequest(r) {
  return {
    id: r.id,
    category: { id: r.category_id, name: r.category_name, slug: r.category_slug },
    summary: r.summary,
    location: r.location_id ? { id: r.location_id, name: r.location_name } : null,
    issueStartedOn: r.issue_started_on,
    hasUrgentDeadline: r.has_urgent_deadline,
    deadlineOn: r.deadline_on,
    helpType: r.help_type,
    preferredLanguage: r.preferred_language,
    consultationPreference: r.consultation_preference,
    budgetMin: r.budget_min,
    budgetMax: r.budget_max,
    currency: r.currency,
    status: r.status,
    createdAt: r.created_at,
  };
}

const REQUEST_SELECT = `
  SELECT r.*, c.name AS category_name, c.slug AS category_slug, loc.name AS location_name
    FROM legal_requests r
    JOIN legal_categories c ON c.id = r.category_id
    LEFT JOIN locations loc ON loc.id = r.location_id`;

async function matchesFor(request) {
  const { rows } = await query(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM}
      WHERE lp.profile_status = 'published'
        AND EXISTS (SELECT 1 FROM lawyer_specializations s WHERE s.lawyer_profile_id = lp.id AND s.category_id = $1)
      LIMIT 200`,
    [request.category_id],
  );
  return rankMatches(
    {
      categoryId: request.category_id,
      locationId: request.location_id,
      preferredLanguage: request.preferred_language,
      consultationPreference: request.consultation_preference,
      budgetMax: request.budget_max,
    },
    rows.map(mapCard),
    10,
  );
}

export default function requestRoutes({ limiters }) {
  const router = Router();
  router.use(requireRole('client'));

  router.post('/', limiters.write, async (req, res) => {
    const d = parse(requestSchema, req.body);
    const category = await one('SELECT id FROM legal_categories WHERE id = $1 AND is_active', [d.categoryId]);
    if (!category) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'Please check the highlighted fields.', fields: { categoryId: 'Choose a legal category' } } });
    }
    if (d.locationId) {
      const loc = await one('SELECT id FROM locations WHERE id = $1 AND is_active', [d.locationId]);
      if (!loc) {
        return res.status(400).json({ error: { code: 'validation_error', message: 'Please check the highlighted fields.', fields: { locationId: 'Choose a listed location' } } });
      }
    }
    const created = await one(
      `INSERT INTO legal_requests (client_id, category_id, summary, location_id, issue_started_on, has_urgent_deadline,
                                   deadline_on, help_type, preferred_language, consultation_preference, budget_min, budget_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [req.user.id, d.categoryId, d.summary, d.locationId, d.issueStartedOn, d.hasUrgentDeadline, d.deadlineOn,
        d.helpType, d.preferredLanguage, d.consultationPreference, d.budgetMin, d.budgetMax],
    );
    const row = await one(`${REQUEST_SELECT} WHERE r.id = $1 AND r.client_id = $2`, [created.id, req.user.id]);
    // Nothing is sent to any lawyer here. Matching only lists suitable professionals; the client then
    // chooses whom (if anyone) to contact and explicitly consents to share the request with each of them.
    return res.status(201).json({ request: mapRequest(row), matches: await matchesFor(row) });
  });

  router.get('/', async (req, res) => {
    const { rows } = await query(
      `${REQUEST_SELECT} WHERE r.client_id = $1 ORDER BY r.created_at DESC LIMIT 100`, [req.user.id],
    );
    res.json({ requests: rows.map(mapRequest) });
  });

  router.get('/:id', async (req, res) => {
    const id = uuidParam(req.params.id);
    const row = await one(`${REQUEST_SELECT} WHERE r.id = $1 AND r.client_id = $2`, [id, req.user.id]);
    if (!row) throw notFound();
    const [matches, shared] = await Promise.all([
      matchesFor(row),
      query(
        `SELECT c.id AS conversation_id, c.request_shared_at, lp.slug, u.full_name
           FROM conversations c JOIN lawyer_profiles lp ON lp.id = c.lawyer_profile_id JOIN users u ON u.id = lp.user_id
          WHERE c.request_id = $1 AND c.client_id = $2 AND c.request_shared_at IS NOT NULL
          ORDER BY c.request_shared_at`,
        [id, req.user.id],
      ),
    ]);
    res.json({
      request: mapRequest(row),
      matches,
      // Who can currently read this request (the client can revoke each one from the conversation).
      sharedWith: shared.rows.map((s) => ({
        conversationId: s.conversation_id, lawyerSlug: s.slug, lawyerName: s.full_name, sharedAt: s.request_shared_at,
      })),
    });
  });

  router.patch('/:id', limiters.write, async (req, res) => {
    const id = uuidParam(req.params.id);
    const { status } = parse(z.object({ status: z.enum(['open', 'closed']) }), req.body);
    const row = await one(
      'UPDATE legal_requests SET status = $3 WHERE id = $1 AND client_id = $2 RETURNING id', [id, req.user.id, status],
    );
    if (!row) throw notFound();
    res.json({ ok: true });
  });

  // Deleting a request also removes lawyers' access to it (conversations keep their messages).
  router.delete('/:id', limiters.write, async (req, res) => {
    const id = uuidParam(req.params.id);
    const row = await one('DELETE FROM legal_requests WHERE id = $1 AND client_id = $2 RETURNING id', [id, req.user.id]);
    if (!row) throw notFound();
    res.json({ ok: true });
  });

  return router;
}
