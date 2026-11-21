import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'haqlink_session';

/**
 * The session is a signed JWT in an httpOnly, SameSite=Lax cookie (never readable by page scripts).
 * `tv` is the user's token_version: bumping it (password change, suspension, account closure) revokes every session.
 */
export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionDays}d`,
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });
}

/** Sets req.user = { id, email, role, fullName, language } for a valid session of an active account, else null. */
export async function authenticate(req, res, next) {
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return next(); // expired or tampered: treat as signed out
  }
  const row = await one(
    'SELECT id, email, role, full_name, preferred_language, status, token_version FROM users WHERE id = $1', [payload.sub]);
  if (row && row.status === 'active' && row.token_version === payload.tv) {
    req.user = { id: row.id, email: row.email, role: row.role, fullName: row.full_name, language: row.preferred_language };
  }
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue.', 'unauthenticated'));
  return next();
}

/** requireRole('lawyer') or requireRole('admin', 'lawyer'). 401 when signed out, 403 for the wrong role. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue.', 'unauthenticated'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Your account type cannot do this.', 'forbidden'));
  return next();
};
