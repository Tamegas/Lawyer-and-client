import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (value, fallback = false) => (value == null || value === '' ? fallback : ['1', 'true', 'yes'].includes(String(value).toLowerCase()));

const nodeEnv = env.NODE_ENV || 'development';

export const config = {
  env: nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  serverRoot,
  port: int(env.PORT, 4000),
  // Integration tests use their own database so they can wipe and re-seed it.
  databaseUrl: nodeEnv === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL,
  databaseSsl: bool(env.DATABASE_SSL),
  jwtSecret: env.JWT_SECRET,
  sessionDays: int(env.SESSION_DAYS, 7),
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  trustProxy: env.TRUST_PROXY ? int(env.TRUST_PROXY, 1) : false,
  bcryptRounds: int(env.BCRYPT_ROUNDS, 12),
  uploadDir: path.resolve(serverRoot, env.UPLOAD_DIR || 'storage/credentials'),
  maxUploadBytes: int(env.MAX_UPLOAD_MB, 5) * 1024 * 1024,
  requireVerificationToPublish: bool(env.REQUIRE_VERIFICATION_TO_PUBLISH),
  appointmentMinNoticeHours: int(env.APPOINTMENT_MIN_NOTICE_HOURS, 12),
  appointmentHorizonDays: int(env.APPOINTMENT_HORIZON_DAYS, 30),
  deletedAccountRetentionDays: int(env.DELETED_ACCOUNT_RETENTION_DAYS, 30),
  clientDist: env.CLIENT_DIST ? path.resolve(serverRoot, env.CLIENT_DIST) : null,
};

/** Fail fast at start-up (not on the first request) when something required is missing or weak. */
export function assertConfig() {
  const problems = [];
  if (!config.databaseUrl) problems.push(config.isTest ? 'DATABASE_URL_TEST is not set.' : 'DATABASE_URL is not set.');
  if (!config.jwtSecret) problems.push('JWT_SECRET is not set (generate one with: openssl rand -hex 48).');
  else if (config.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters.');
  if (config.isProd && /change-me/i.test(config.databaseUrl || '')) problems.push('DATABASE_URL still contains the placeholder password.');
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
}
