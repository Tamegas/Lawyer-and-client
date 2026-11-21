// Asynchronous in-app messages (NOT real-time chat, no email/SMS notifications). Both roles need a session.
// POST /api/conversations                 client. { lawyerSlug, message, shareRequest?: { requestId, consent:true } } -> 201 { conversation:{ id } }
//     Creates (or reuses) the client's conversation with that published lawyer. Lawyers can never start conversations.
//     The request is shared ONLY with explicit consent:true; otherwise the lawyer sees nothing but the message.
// GET  /api/conversations                 -> { conversations:[{ id, status, counterpart:{ name, slug?, verificationStatus? }, lastMessage:{ body, fromMe, at }, lastMessageAt, unread, requestShared, viewerRole }] }
// GET  /api/conversations/:id             -> { conversation:{ id, status, viewerRole, counterpart, requestShared, requestId?, createdAt, lastMessageAt },
//                                              messages:[{ id, fromMe, senderName, body, createdAt }], request: {..}|null (lawyer: only while shared),
//                                              quotations:[{ id, status, totalEstimate, currency, updatedAt }], appointments:[{ id, status, startsAt, endsAt, mode }] }
// POST /api/conversations/:id/messages    { body (1..4000) } -> 201 { message }   (closed conversations: 409 conversation_closed)
// POST /api/conversations/:id/read        -> { ok }
// PATCH /api/conversations/:id            { status:'open'|'closed' } either participant -> { ok }
// POST /api/conversations/:id/share-request   client { requestId, consent:true } -> { ok };  DELETE same path -> revoke { ok }
import { Router } from 'express';
import { z } from 'zod';
import { one, query, tx } from '../db.js';
import { loadConversation } from '../lib/access.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError, notFound, parse, uuidParam } from '../middleware/errors.js';
import { text } from '../lib/validators.js';
import { mapRequest } from './requests.js';

const consent = z.literal(true, { errorMap: () => ({ message: 'Please confirm that you agree to share this request with the lawyer' }) });
const startSchema = z.object({
  lawyerSlug: z.string().min(1).max(80),
  message: text(1, 4000, 'Message'),
  shareRequest: z.object({ requestId: z.string().uuid(), consent }).optional(),
});
const messageSchema = z.object({ body: text(1, 4000, 'Message') });
const shareSchema = z.object({ requestId: z.string().uuid(), consent });

const REQUEST_JOIN = `SELECT r.*, c.name AS category_name, c.slug AS category_slug, loc.name AS location_name
  FROM legal_requests r JOIN legal_categories c ON c.id = r.category_id LEFT JOIN locations loc ON loc.id = r.location_id`;

const isClientOf = (conv, user) => conv.client_id === user.id;

export default function conversationRoutes({ limiters }) {
  const router = Router();
  router.use(requireAuth);

  router.post('/', requireRole('client'), limiters.write, async (req, res) => {
    const d = parse(startSchema, req.body);
    const profile = await one(`SELECT id, user_id FROM lawyer_profiles WHERE slug = $1 AND profile_status = 'published'`, [d.lawyerSlug]);
    if (!profile) throw notFound('That lawyer could not be found.');
    let request = null;
    if (d.shareRequest) {
      request = await one('SELECT id FROM legal_requests WHERE id = $1 AND client_id = $2', [d.shareRequest.requestId, req.user.id]);
      if (!request) throw new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { requestId: 'Choose one of your own requests' });
    }
    const id = await tx(async (db) => {
      let conv = (await db.query('SELECT id, status FROM conversations WHERE client_id = $1 AND lawyer_profile_id = $2 FOR UPDATE', [req.user.id, profile.id])).rows[0];
      if (conv && conv.status !== 'open') throw new HttpError(409, 'This conversation is closed. Reopen it from your messages first.', 'conversation_closed');
      if (!conv) conv = (await db.query('INSERT INTO conversations (client_id, lawyer_profile_id) VALUES ($1, $2) RETURNING id', [req.user.id, profile.id])).rows[0];
      await db.query('INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)', [conv.id, req.user.id, d.message]);
      await db.query(
        `UPDATE conversations SET last_message_at = now(), client_last_read_at = now(),
                request_id = CASE WHEN $2::uuid IS NOT NULL THEN $2::uuid ELSE request_id END,
                request_shared_at = CASE WHEN $2::uuid IS NOT NULL THEN now() ELSE request_shared_at END WHERE id = $1`,
        [conv.id, request?.id ?? null]);
      return conv.id;
    });
    res.status(201).json({ conversation: { id } });
  });

  router.get('/', async (req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.status, c.last_message_at, c.request_shared_at, c.request_id, c.client_id, c.client_last_read_at, c.lawyer_last_read_at,
              lp.slug, lp.verification_status, lu.full_name AS lawyer_name, cu.full_name AS client_name,
              lm.body AS last_body, lm.sender_id AS last_sender
         FROM conversations c
         JOIN lawyer_profiles lp ON lp.id = c.lawyer_profile_id
         JOIN users lu ON lu.id = lp.user_id
         JOIN users cu ON cu.id = c.client_id
         LEFT JOIN LATERAL (SELECT body, sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) lm ON true
        WHERE c.client_id = $1 OR lp.user_id = $1
        ORDER BY c.last_message_at DESC LIMIT 100`, [req.user.id]);
    res.json({
      conversations: rows.map((c) => {
        const asClient = c.client_id === req.user.id;
        const myRead = asClient ? c.client_last_read_at : c.lawyer_last_read_at;
        return {
          id: c.id, status: c.status, viewerRole: asClient ? 'client' : 'lawyer',
          counterpart: asClient ? { name: c.lawyer_name, slug: c.slug, verificationStatus: c.verification_status } : { name: c.client_name },
          lastMessage: c.last_body == null ? null : { body: c.last_body.slice(0, 160), fromMe: c.last_sender === req.user.id, at: c.last_message_at },
          lastMessageAt: c.last_message_at,
          unread: c.last_sender !== req.user.id && (!myRead || new Date(myRead) < new Date(c.last_message_at)),
          requestShared: Boolean(c.request_id && c.request_shared_at),
        };
      }),
    });
  });

  router.get('/:id', async (req, res) => {
    const conv = await loadConversation({ query }, uuidParam(req.params.id), req.user);
    if (!conv) throw notFound();
    const asClient = isClientOf(conv, req.user);
    const shared = Boolean(conv.request_id && conv.request_shared_at);
    const [msgs, quotes, appts, request] = await Promise.all([
      query(`SELECT m.id, m.sender_id, m.body, m.created_at, u.full_name FROM messages m JOIN users u ON u.id = m.sender_id
              WHERE m.conversation_id = $1 ORDER BY m.created_at, m.id LIMIT 500`, [conv.id]),
      query('SELECT id, status, total_estimate, currency, updated_at FROM quotations WHERE conversation_id = $1 ORDER BY updated_at DESC', [conv.id]),
      query(`SELECT id, status, starts_at, ends_at, mode FROM appointments WHERE conversation_id = $1 ORDER BY starts_at DESC`, [conv.id]),
      // The lawyer reads the request only while the client has shared it; the client always sees their own.
      (asClient ? conv.request_id : shared) ? one(`${REQUEST_JOIN} WHERE r.id = $1`, [conv.request_id]) : Promise.resolve(null),
    ]);
    res.json({
      conversation: {
        id: conv.id, status: conv.status, viewerRole: asClient ? 'client' : 'lawyer',
        counterpart: asClient ? { name: conv.lawyer_name, slug: conv.lawyer_slug, verificationStatus: conv.lawyer_verification_status } : { name: conv.client_name },
        requestShared: shared, ...(asClient ? { requestId: conv.request_id } : {}),
        createdAt: conv.created_at, lastMessageAt: conv.last_message_at,
      },
      messages: msgs.rows.map((m) => ({ id: m.id, fromMe: m.sender_id === req.user.id, senderName: m.full_name, body: m.body, createdAt: m.created_at })),
      request: request ? mapRequest(request) : null,
      quotations: quotes.rows.map((q) => ({ id: q.id, status: q.status, totalEstimate: q.total_estimate, currency: q.currency, updatedAt: q.updated_at })),
      appointments: appts.rows.map((a) => ({ id: a.id, status: a.status, startsAt: a.starts_at, endsAt: a.ends_at, mode: a.mode })),
    });
  });

  router.post('/:id/messages', limiters.write, async (req, res) => {
    const conv = await loadConversation({ query }, uuidParam(req.params.id), req.user);
    if (!conv) throw notFound();
    if (conv.status !== 'open') throw new HttpError(409, 'This conversation is closed.', 'conversation_closed');
    const { body } = parse(messageSchema, req.body);
    const asClient = isClientOf(conv, req.user);
    const message = await tx(async (db) => {
      const { rows: [m] } = await db.query('INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at', [conv.id, req.user.id, body]);
      await db.query(`UPDATE conversations SET last_message_at = $2, ${asClient ? 'client_last_read_at' : 'lawyer_last_read_at'} = $2 WHERE id = $1`, [conv.id, m.created_at]);
      return m;
    });
    res.status(201).json({ message: { id: message.id, fromMe: true, senderName: req.user.fullName, body: message.body, createdAt: message.created_at } });
  });

  router.post('/:id/read', async (req, res) => {
    const conv = await loadConversation({ query }, uuidParam(req.params.id), req.user);
    if (!conv) throw notFound();
    await query(`UPDATE conversations SET ${isClientOf(conv, req.user) ? 'client_last_read_at' : 'lawyer_last_read_at'} = now() WHERE id = $1`, [conv.id]);
    res.json({ ok: true });
  });

  router.patch('/:id', limiters.write, async (req, res) => {
    const conv = await loadConversation({ query }, uuidParam(req.params.id), req.user);
    if (!conv) throw notFound();
    const { status } = parse(z.object({ status: z.enum(['open', 'closed']) }), req.body);
    await query('UPDATE conversations SET status = $2 WHERE id = $1', [conv.id, status]);
    res.json({ ok: true });
  });

  router.post('/:id/share-request', requireRole('client'), limiters.write, async (req, res) => {
    const conv = await loadConversation({ query }, uuidParam(req.params.id), req.user);
    if (!conv || !isClientOf(conv, req.user)) throw notFound();
    const d = parse(shareSchema, req.body);
    const request = await one('SELECT id FROM legal_requests WHERE id = $1 AND client_id = $2', [d.requestId, req.user.id]);
    if (!request) throw new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { requestId: 'Choose one of your own requests' });
    await query('UPDATE conversations SET request_id = $2, request_shared_at = now() WHERE id = $1', [conv.id, request.id]);
    res.json({ ok: true });
  });

  router.delete('/:id/share-request', requireRole('client'), limiters.write, async (req, res) => {
    const conv = await loadConversation({ query }, uuidParam(req.params.id), req.user);
    if (!conv || !isClientOf(conv, req.user)) throw notFound();
    await query('UPDATE conversations SET request_id = NULL, request_shared_at = NULL WHERE id = $1', [conv.id]);
    res.json({ ok: true });
  });

  return router;
}
