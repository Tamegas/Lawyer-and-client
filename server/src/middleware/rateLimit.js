import rateLimit from 'express-rate-limit';
import { HttpError } from './errors.js';

const WINDOW = 15 * 60 * 1000;

// global: every /api request · auth: login/register (only FAILED attempts count) · write: creating or changing data
// upload: verification documents. Tests pass overrides, e.g. createLimiters({ global: { limit: 100000 } }).
const DEFAULTS = {
  global: { windowMs: WINDOW, limit: 600 },
  auth: { windowMs: WINDOW, limit: 20, skipSuccessfulRequests: true },
  write: { windowMs: WINDOW, limit: 150 },
  upload: { windowMs: 60 * 60 * 1000, limit: 30 },
};

export function createLimiters(overrides = {}) {
  const limiters = {};
  for (const [name, defaults] of Object.entries(DEFAULTS)) {
    limiters[name] = rateLimit({
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      ...defaults,
      ...overrides[name],
      handler: (req, res, next) => next(new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', 'rate_limited')),
    });
  }
  return limiters;
}
