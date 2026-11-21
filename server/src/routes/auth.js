// POST /api/auth/register  { role:'client'|'lawyer', fullName, email, password, preferredLanguage?, acceptTerms:true, professionalTitle? } -> 201 { user }
//   Never accepts role 'admin' (validation error). Unknown keys are ignored. A lawyer gets a DRAFT profile (not public, "Not verified").
// POST /api/auth/login     { email, password } -> { user }. Same 401 `invalid_credentials` for unknown email and wrong password. 403 `account_suspended`. Limited by limiters.auth.
// POST /api/auth/logout    -> { ok }
// GET  /api/auth/me        -> { user } | { user: null }  (never 401)
//   user = { id, email, role, fullName, language, phone, lawyer?: { profileId, slug, profileStatus, verificationStatus } }
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { one, query, tx } from '../db.js';
import { randomName } from '../lib/codes.js';
import { slugify } from '../lib/text.js';
import { email, optLanguage, optText, text } from '../lib/validators.js';
import { clearSession, issueSession } from '../middleware/auth.js';
import { HttpError, parse } from '../middleware/errors.js';

const registerSchema = z.object({
  role: z.enum(['client', 'lawyer'], { errorMap: () => ({ message: 'Choose an account type' }) }),
  fullName: text(2, 120, 'Full name'),
  email,
  password: z.string({ required_error: 'Password is required' })
    .min(10, 'Use at least 10 characters')
    .max(72, 'Use at most 72 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number'),
  preferredLanguage: optLanguage,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue' }) }),
  professionalTitle: optText(120, 'Professional title'),
});
const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(200) });

let dummyHash;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('not-a-real-password', config.bcryptRounds));

export async function userPayload(id, db = { query }) {
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.role, u.full_name, u.preferred_language, u.phone,
            lp.id AS profile_id, lp.slug, lp.profile_status, lp.verification_status
       FROM users u LEFT JOIN lawyer_profiles lp ON lp.user_id = u.id WHERE u.id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  const user = { id: r.id, email: r.email, role: r.role, fullName: r.full_name, language: r.preferred_language, phone: r.phone };
  if (r.role === 'lawyer' && r.profile_id) {
    user.lawyer = { profileId: r.profile_id, slug: r.slug, profileStatus: r.profile_status, verificationStatus: r.verification_status };
  }
  return user;
}

const fieldError = (field, message) => new HttpError(400, 'Please check the highlighted fields.', 'validation_error', { [field]: message });

export default function authRoutes({ limiters }) {
  const router = Router();

  router.post('/register', limiters.auth, async (req, res) => {
    const d = parse(registerSchema, req.body);
    const hash = await bcrypt.hash(d.password, config.bcryptRounds);
    let created;
    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      try {
        created = await tx(async (db) => {
          const { rows: [u] } = await db.query(
            `INSERT INTO users (email, password_hash, role, full_name, preferred_language, terms_accepted_at)
             VALUES ($1, $2, $3, $4, COALESCE($5, 'English'), now()) RETURNING id, token_version`,
            [d.email, hash, d.role, d.fullName, d.preferredLanguage]);
          if (d.role === 'lawyer') {
            const slug = `${slugify(d.fullName) || 'lawyer'}-${randomName(3)}`;
            await db.query(
              `INSERT INTO lawyer_profiles (user_id, slug, professional_title) VALUES ($1, $2, $3)`,
              [u.id, slug, d.professionalTitle ?? 'Legal professional']);
          }
          return u;
        });
      } catch (err) {
        if (err.code === '23505' && err.constraint === 'users_email_lower_key') throw fieldError('email', 'An account with this email already exists');
        if (err.code === '23505' && attempt < 2) continue; // slug clash: try another random suffix
        throw err;
      }
    }
    issueSession(res, created);
    res.status(201).json({ user: await userPayload(created.id) });
  });

  router.post('/login', limiters.auth, async (req, res) => {
    const d = parse(loginSchema, req.body);
    const row = await one('SELECT id, password_hash, status, token_version FROM users WHERE lower(email) = lower($1)', [d.email]);
    const ok = await bcrypt.compare(d.password, row?.password_hash ?? getDummyHash());
    if (!row || !ok || row.status === 'deleted') {
      throw new HttpError(401, 'The email or password is not correct.', 'invalid_credentials');
    }
    if (row.status === 'suspended') {
      throw new HttpError(403, 'This account has been suspended. Please contact support if you think this is a mistake.', 'account_suspended');
    }
    await one('UPDATE users SET last_login_at = now() WHERE id = $1 RETURNING id', [row.id]);
    issueSession(res, row);
    res.json({ user: await userPayload(row.id) });
  });

  router.post('/logout', (req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  router.get('/me', async (req, res) => {
    res.json({ user: req.user ? await userPayload(req.user.id) : null });
  });

  return router;
}
