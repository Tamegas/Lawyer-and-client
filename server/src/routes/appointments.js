// GET  /api/appointments/slots?lawyer=<slug>   public -> { timezone, slotMinutes, slots:[{ startsAt, endsAt }] } bookable slots (UTC ISO strings)
// POST /api/appointments                       client { lawyerSlug, startsAt, mode, reason, consent:true } -> 201 { appointment }
//        409 slot_taken (someone booked it first), 400 validation_error (slot not offered / mode not offered). Creates the conversation if needed.
// GET  /api/appointments?status=               both roles, their own -> { appointments:[appointment] }
// GET  /api/appointments/:id                   -> { appointment }
// POST /api/appointments/:id/confirm           lawyer { meetingInstructions?, note? }   requested -> confirmed
// POST /api/appointments/:id/decline           lawyer { note? }                         requested -> declined
// POST /api/appointments/:id/cancel            either participant { note? }             requested|confirmed -> cancelled
// POST /api/appointments/:id/complete          lawyer                                   confirmed -> completed (only after the start time)
//   Anything else -> 409 invalid_state. Video calls are NOT built in: online appointments use the lawyer's own meeting link/instructions.
//   appointment = { id, conversationId, status, startsAt, endsAt, mode, reason, lawyerNote, meetingInstructions, client:{name}, lawyer:{name,slug,timezone}, viewerRole, hasReview }
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { one, query, tx } from '../db.js';
import { loadAppointment } from '../lib/access.js';
import { generateSlots, findSlot } from '../lib/slots.js';
import { parseInstant } from '../lib/time.js';
import { optText, text } from '../lib/validators.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError, notFound, parse, uuidParam } from '../middleware/errors.js';

const bookSchema = z.object({
  lawyerSlug: z.string().min(1).max(80),
  startsAt: z.string({ required_error: 'Choose a time' }),
  mode: z.enum(['online', 'in_person'], { errorMap: () => ({ message: 'Choose online or in person' }) }),
  reason: text(5, 1000, 'Reason'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm that you agree to share this reason with the lawyer' }) }),
});
const confirmSchema = z.object({ meetingInstructions: optText(1000, 'Instructions'), note: optText(1000, 'Note') });
const noteSchema = z.object({ note: optText(1000, 'Note') });
const STATUSES = ['requested', 'confirmed', 'declined', 'cancelled', 'completed'];

const fieldError = (field, message) => new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { [field]: message });
const invalid = () => new HttpError(409, 'This appointment cannot be changed that way right now.', 'invalid_state');

const map = (a, user) => ({
  id: a.id, conversationId: a.conversation_id, status: a.status, startsAt: a.starts_at, endsAt: a.ends_at, mode: a.mode, reason: a.reason,
  lawyerNote: a.lawyer_note, meetingInstructions: a.status === 'confirmed' || a.status === 'completed' ? a.meeting_instructions : null,
  client: { name: a.client_name }, lawyer: { name: a.lawyer_name, slug: a.lawyer_slug, timezone: a.lawyer_timezone },
  viewerRole: a.client_id === user.id ? 'client' : 'lawyer', hasReview: Boolean(a.has_review),
});

const SELECT = `SELECT a.*, lp.user_id AS lawyer_user_id, lp.slug AS lawyer_slug, lp.timezone AS lawyer_timezone, lu.full_name AS lawyer_name, cu.full_name AS client_name,
                EXISTS (SELECT 1 FROM reviews r WHERE r.appointment_id = a.id) AS has_review
           FROM appointments a JOIN lawyer_profiles lp ON lp.id = a.lawyer_profile_id JOIN users lu ON lu.id = lp.user_id JOIN users cu ON cu.id = a.client_id`;

async function slotsFor(profileId, profile) {
  const now = Date.now();
  const horizonEnd = new Date(now + (config.appointmentHorizonDays + 1) * 86_400_000);
  const [avail, busy] = await Promise.all([
    query('SELECT weekday, start_time, end_time FROM lawyer_availability WHERE lawyer_profile_id = $1', [profileId]),
    query(`SELECT starts_at, ends_at FROM appointments WHERE lawyer_profile_id = $1 AND status IN ('requested','confirmed') AND ends_at > now() AND starts_at < $2`, [profileId, horizonEnd]),
  ]);
  return generateSlots({
    availability: avail.rows.map((r) => ({ weekday: r.weekday, startTime: r.start_time, endTime: r.end_time })),
    timezone: profile.timezone, slotMinutes: profile.slot_minutes, now,
    minNoticeHours: config.appointmentMinNoticeHours, horizonDays: config.appointmentHorizonDays,
    busy: busy.rows.map((b) => ({ start: b.starts_at, end: b.ends_at })),
  });
}

export default function appointmentRoutes({ limiters }) {
  const router = Router();

  router.get('/slots', async (req, res) => {
    const slug = typeof req.query.lawyer === 'string' ? req.query.lawyer : '';
    const profile = await one(`SELECT id, timezone, slot_minutes FROM lawyer_profiles WHERE slug = $1 AND profile_status = 'published'`, [slug.slice(0, 80)]);
    if (!profile) throw notFound();
    res.json({ timezone: profile.timezone, slotMinutes: profile.slot_minutes, slots: await slotsFor(profile.id, profile) });
  });

  router.use(requireAuth);

  router.post('/', requireRole('client'), limiters.write, async (req, res) => {
    const d = parse(bookSchema, req.body);
    const profile = await one(
      `SELECT id, timezone, slot_minutes, consultation_modes, accepting_new_clients FROM lawyer_profiles WHERE slug = $1 AND profile_status = 'published'`, [d.lawyerSlug]);
    if (!profile) throw notFound('That lawyer could not be found.');
    if (!profile.accepting_new_clients) throw new HttpError(409, 'This lawyer is not taking new appointment requests right now.', 'not_accepting');
    if (!profile.consultation_modes.includes(d.mode)) throw fieldError('mode', 'This lawyer does not offer that consultation option');
    const startMs = parseInstant(d.startsAt);
    if (startMs == null) throw fieldError('startsAt', 'Choose one of the available times');
    const slot = findSlot(await slotsFor(profile.id, profile), startMs);
    if (!slot) throw fieldError('startsAt', 'That time is not available. Please choose another.');
    let id;
    try {
      id = await tx(async (db) => {
        let conv = (await db.query('SELECT id, status FROM conversations WHERE client_id = $1 AND lawyer_profile_id = $2', [req.user.id, profile.id])).rows[0];
        if (conv && conv.status !== 'open') throw new HttpError(409, 'Your conversation with this lawyer is closed. Reopen it from your messages first.', 'conversation_closed');
        if (!conv) conv = (await db.query('INSERT INTO conversations (client_id, lawyer_profile_id) VALUES ($1, $2) RETURNING id', [req.user.id, profile.id])).rows[0];
        const { rows: [a] } = await db.query(
          `INSERT INTO appointments (conversation_id, client_id, lawyer_profile_id, starts_at, ends_at, mode, reason) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [conv.id, req.user.id, profile.id, slot.startsAt, slot.endsAt, d.mode, d.reason]);
        return a.id;
      });
    } catch (err) {
      if (err.code === '23P01') throw new HttpError(409, 'Someone just booked that time. Please choose another.', 'slot_taken');
      throw err;
    }
    res.status(201).json({ appointment: map(await one(`${SELECT} WHERE a.id = $1`, [id]), req.user) });
  });

  router.get('/', async (req, res) => {
    const status = typeof req.query.status === 'string' && STATUSES.includes(req.query.status) ? req.query.status : null;
    const { rows } = await query(
      `${SELECT} WHERE (a.client_id = $1 OR lp.user_id = $1) AND ($2::text IS NULL OR a.status::text = $2) ORDER BY a.starts_at DESC LIMIT 200`, [req.user.id, status]);
    res.json({ appointments: rows.map((a) => map(a, req.user)) });
  });

  router.get('/:id', async (req, res) => {
    const found = await loadAppointment({ query }, uuidParam(req.params.id), req.user);
    if (!found) throw notFound();
    res.json({ appointment: map(await one(`${SELECT} WHERE a.id = $1`, [found.id]), req.user) });
  });

  const load = async (req) => {
    const a = await loadAppointment({ query }, uuidParam(req.params.id), req.user);
    if (!a) throw notFound();
    return a;
  };
  const respond = async (req, res, id) => res.json({ appointment: map(await one(`${SELECT} WHERE a.id = $1`, [id]), req.user) });

  router.post('/:id/confirm', requireRole('lawyer'), limiters.write, async (req, res) => {
    const a = await load(req);
    if (a.lawyer_user_id !== req.user.id) throw notFound();
    if (a.status !== 'requested' || new Date(a.starts_at) <= new Date()) throw invalid();
    const d = parse(confirmSchema, req.body);
    await query(`UPDATE appointments SET status = 'confirmed', meeting_instructions = $2, lawyer_note = $3, decided_at = now() WHERE id = $1`, [a.id, d.meetingInstructions, d.note]);
    await respond(req, res, a.id);
  });

  router.post('/:id/decline', requireRole('lawyer'), limiters.write, async (req, res) => {
    const a = await load(req);
    if (a.lawyer_user_id !== req.user.id) throw notFound();
    if (a.status !== 'requested') throw invalid();
    const d = parse(noteSchema, req.body);
    await query(`UPDATE appointments SET status = 'declined', lawyer_note = $2, decided_at = now() WHERE id = $1`, [a.id, d.note]);
    await respond(req, res, a.id);
  });

  router.post('/:id/cancel', limiters.write, async (req, res) => {
    const a = await load(req);
    if (!['requested', 'confirmed'].includes(a.status)) throw invalid();
    const d = parse(noteSchema, req.body);
    const byLawyer = a.lawyer_user_id === req.user.id;
    await query(`UPDATE appointments SET status = 'cancelled', cancelled_by = $2, decided_at = now(), lawyer_note = CASE WHEN $4::boolean THEN COALESCE($3, lawyer_note) ELSE lawyer_note END WHERE id = $1`,
      [a.id, req.user.id, d.note, byLawyer]);
    await respond(req, res, a.id);
  });

  router.post('/:id/complete', requireRole('lawyer'), limiters.write, async (req, res) => {
    const a = await load(req);
    if (a.lawyer_user_id !== req.user.id) throw notFound();
    if (a.status !== 'confirmed') throw invalid();
    if (new Date(a.starts_at) > new Date()) throw new HttpError(409, 'An appointment can only be marked completed after it has started.', 'too_early');
    await query(`UPDATE appointments SET status = 'completed', decided_at = now() WHERE id = $1`, [a.id]);
    await respond(req, res, a.id);
  });

  return router;
}
