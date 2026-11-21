import { Router } from 'express';
import { z } from 'zod';
import { one, query, tx } from '../db.js';
import { HttpError, notFound, parse, uuidParam } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadConversation, loadQuotation } from '../lib/access.js';
import { computeTotal } from '../lib/money.js';
import { isoDate, money, optIsoDate, optMoney, optText, text } from '../lib/validators.js';

// The Fee Discussion Assistant backend. Quotations are an in-app, non-binding way to discuss fees:
// the client describes the scope (and an optional budget), the lawyer answers with a proposal, and the
// client can accept, decline or ask for a revision. Nothing here pressures a lawyer to accept a price,
// and accepting is not a contract — the lawyer and client still agree their engagement directly.

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  scopeNotes: text(5, 1500, 'Scope'),
  budget: optMoney,
  itemized: z.boolean().default(false),
});

const proposalSchema = z.object({
  feeType: z.enum(['fixed', 'hourly', 'itemized']),
  fixedAmount: optMoney,
  hourlyRate: optMoney,
  estimatedHours: z.union([z.coerce.number().positive().max(10_000), z.null(), z.literal('')]).optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  items: z.array(z.object({ description: text(2, 200, 'Item description'), amount: money })).max(30).default([]),
  scopeOfWork: text(10, 2000, 'Scope of work'),
  paymentSchedule: optText(1000, 'Payment schedule'),
  exclusions: optText(1500, 'Exclusions'),
  expensesNote: optText(1000, 'Expenses note'),
  validUntil: optIsoDate,
  lawyerNote: optText(1000, 'Note'),
});

const decisionSchema = z.object({
  decision: z.enum(['accept', 'decline', 'revise']),
  note: optText(1000, 'Note'),
});

const declineSchema = z.object({ note: optText(1000, 'Note') });

const OPEN_STATUSES = ['requested', 'proposed', 'revision_requested'];
const todayIso = () => new Date().toISOString().slice(0, 10);

async function mapQuotation(row, viewerIsClient) {
  const { rows: items } = await query(
    'SELECT id, description, amount FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order, id', [row.id]);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client: { name: row.client_name },
    lawyer: { name: row.lawyer_name, slug: row.lawyer_slug },
    viewerRole: viewerIsClient ? 'client' : 'lawyer',
    request: {
      scopeNotes: row.client_scope_notes,
      budget: row.client_budget,
      itemizedRequested: row.itemized_requested,
    },
    proposal: row.fee_type
      ? {
        feeType: row.fee_type,
        fixedAmount: row.fixed_amount,
        hourlyRate: row.hourly_rate,
        estimatedHours: row.estimated_hours,
        totalEstimate: row.total_estimate,
        currency: row.currency,
        items: items.map((i) => ({ id: i.id, description: i.description, amount: i.amount })),
        scopeOfWork: row.scope_of_work,
        paymentSchedule: row.payment_schedule,
        exclusions: row.exclusions,
        expensesNote: row.expenses_note,
        validUntil: row.valid_until,
        respondedAt: row.responded_at,
      }
      : null,
    lawyerNote: row.lawyer_note,
    clientResponseNote: row.client_response_note,
    decidedAt: row.decided_at,
  };
}

export default function quotationRoutes({ limiters }) {
  const router = Router();
  router.use(requireAuth);

  // Client asks for a fee quotation within an existing conversation.
  router.post('/', requireRole('client'), limiters.write, async (req, res) => {
    const d = parse(requestSchema, req.body);
    const conv = await loadConversation({ query }, d.conversationId, req.user);
    if (!conv || conv.client_id !== req.user.id) throw notFound('Conversation not found.');
    if (conv.status !== 'open') throw new HttpError(409, 'This conversation is closed.', 'conversation_closed');
    const open = await one(
      `SELECT COUNT(*)::int AS n FROM quotations WHERE conversation_id = $1 AND status = ANY ($2)`, [conv.id, OPEN_STATUSES]);
    if (open.n >= 3) throw new HttpError(409, 'There are already several open quotations in this conversation.', 'too_many_open');

    const created = await one(
      `INSERT INTO quotations (conversation_id, client_id, lawyer_profile_id, client_budget, client_scope_notes, itemized_requested)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [conv.id, req.user.id, conv.lawyer_profile_id, d.budget, d.scopeNotes, d.itemized],
    );
    const row = await loadQuotation({ query }, created.id, req.user);
    res.status(201).json({ quotation: await mapQuotation(row, true) });
  });

  // Both sides see their own quotations. Optional ?status= filter.
  router.get('/', async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const { rows } = await query(
      `SELECT q.*, lp.user_id AS lawyer_user_id, lp.slug AS lawyer_slug, lu.full_name AS lawyer_name, cu.full_name AS client_name
         FROM quotations q
         JOIN lawyer_profiles lp ON lp.id = q.lawyer_profile_id
         JOIN users lu ON lu.id = lp.user_id
         JOIN users cu ON cu.id = q.client_id
        WHERE (q.client_id = $1 OR lp.user_id = $1) AND ($2::text IS NULL OR q.status::text = $2)
        ORDER BY q.updated_at DESC LIMIT 100`,
      [req.user.id, status],
    );
    res.json({ quotations: await Promise.all(rows.map((r) => mapQuotation(r, r.client_id === req.user.id))) });
  });

  router.get('/:id', async (req, res) => {
    const row = await loadQuotation({ query }, uuidParam(req.params.id), req.user);
    if (!row) throw notFound();
    res.json({ quotation: await mapQuotation(row, row.client_id === req.user.id) });
  });

  // Lawyer sends (or revises) a proposal.
  router.post('/:id/respond', requireRole('lawyer'), limiters.write, async (req, res) => {
    const row = await loadQuotation({ query }, uuidParam(req.params.id), req.user);
    if (!row || row.lawyer_user_id !== req.user.id) throw notFound();
    if (!['requested', 'revision_requested'].includes(row.status)) {
      throw new HttpError(409, 'This quotation is not waiting for your proposal.', 'invalid_state');
    }
    const d = parse(proposalSchema, req.body);

    const fieldError = (field, message) => new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { [field]: message });
    if (row.itemized_requested && d.items.length === 0) {
      throw fieldError('items', 'The client asked for an itemized quotation. Please list each item.');
    }
    if (d.validUntil && d.validUntil < todayIso()) throw fieldError('validUntil', 'The validity date cannot be in the past');
    const { total, error } = computeTotal({ ...d, items: d.feeType === 'itemized' || d.items.length ? d.items : [] });
    if (error) throw fieldError(d.feeType === 'hourly' ? 'hourlyRate' : d.feeType === 'fixed' ? 'fixedAmount' : 'items', error);

    await tx(async (db) => {
      await db.query(
        `UPDATE quotations SET status = 'proposed', fee_type = $2, fixed_amount = $3, hourly_rate = $4, estimated_hours = $5,
                total_estimate = $6, scope_of_work = $7, payment_schedule = $8, exclusions = $9, expenses_note = $10,
                valid_until = $11, lawyer_note = $12, responded_at = now(), decided_at = NULL
          WHERE id = $1`,
        [row.id, d.feeType, d.fixedAmount, d.hourlyRate, d.estimatedHours, total, d.scopeOfWork, d.paymentSchedule,
          d.exclusions, d.expensesNote, d.validUntil, d.lawyerNote],
      );
      await db.query('DELETE FROM quotation_items WHERE quotation_id = $1', [row.id]);
      for (const [i, item] of d.items.entries()) {
        await db.query('INSERT INTO quotation_items (quotation_id, description, amount, sort_order) VALUES ($1, $2, $3, $4)',
          [row.id, item.description, item.amount, i]);
      }
    });
    const fresh = await loadQuotation({ query }, row.id, req.user);
    res.json({ quotation: await mapQuotation(fresh, false) });
  });

  // Lawyer declines to quote (no reason is required, but a short note is welcome).
  router.post('/:id/decline', requireRole('lawyer'), limiters.write, async (req, res) => {
    const row = await loadQuotation({ query }, uuidParam(req.params.id), req.user);
    if (!row || row.lawyer_user_id !== req.user.id) throw notFound();
    if (!['requested', 'revision_requested'].includes(row.status)) {
      throw new HttpError(409, 'This quotation is not waiting for your proposal.', 'invalid_state');
    }
    const { note } = parse(declineSchema, req.body);
    await query(`UPDATE quotations SET status = 'declined', lawyer_note = $2, decided_at = now() WHERE id = $1`, [row.id, note]);
    res.json({ ok: true });
  });

  router.post('/:id/withdraw', requireRole('lawyer'), limiters.write, async (req, res) => {
    const row = await loadQuotation({ query }, uuidParam(req.params.id), req.user);
    if (!row || row.lawyer_user_id !== req.user.id) throw notFound();
    if (row.status !== 'proposed') throw new HttpError(409, 'Only an open proposal can be withdrawn.', 'invalid_state');
    await query(`UPDATE quotations SET status = 'withdrawn', decided_at = now() WHERE id = $1`, [row.id]);
    res.json({ ok: true });
  });

  // Client responds to a proposal.
  router.post('/:id/decision', requireRole('client'), limiters.write, async (req, res) => {
    const row = await loadQuotation({ query }, uuidParam(req.params.id), req.user);
    if (!row || row.client_id !== req.user.id) throw notFound();
    if (row.status !== 'proposed') throw new HttpError(409, 'There is no open proposal to respond to.', 'invalid_state');
    const d = parse(decisionSchema, req.body);

    if (d.decision === 'revise' && !d.note) {
      throw new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { note: 'Tell the lawyer what you would like changed' });
    }
    if (d.decision === 'accept' && row.valid_until && row.valid_until < todayIso()) {
      throw new HttpError(409, 'This proposal has expired. Ask the lawyer to confirm or update it.', 'expired');
    }
    const next = { accept: 'accepted', decline: 'declined', revise: 'revision_requested' }[d.decision];
    await query(
      `UPDATE quotations SET status = $2, client_response_note = $3, decided_at = CASE WHEN $2 = 'revision_requested' THEN NULL ELSE now() END
        WHERE id = $1`,
      [row.id, next, d.note],
    );
    res.json({ ok: true, status: next });
  });

  return router;
}
