import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config.js';
import { HttpError } from './errors.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
});

export const corsMiddleware = () => cors({ origin: config.clientOrigin, credentials: true });

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cross-site request check for cookie sessions (defence in depth on top of SameSite=Lax): a state-changing request
 * that declares a foreign Origin — or is flagged cross-site by the browser — is refused.
 * Requests without either header (curl, server-to-server, tests) are allowed: they do not carry a victim's cookie.
 */
export function originCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    const allowed = new Set([config.clientOrigin, `${req.protocol}://${req.get('host')}`]);
    if (!allowed.has(origin)) return next(new HttpError(403, 'This request was blocked because it came from another site.', 'bad_origin'));
  } else if (req.get('sec-fetch-site') === 'cross-site') {
    return next(new HttpError(403, 'This request was blocked because it came from another site.', 'bad_origin'));
  }
  return next();
}
