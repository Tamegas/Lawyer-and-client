// Permanently removes accounts that were closed (status 'deleted') more than DELETED_ACCOUNT_RETENTION_DAYS ago.
//   npm run retention:purge            (schedule it, e.g. daily, with cron)
// Closing an account already anonymised it (email, name, phone, requests); purging deletes what is left of the row.
// Uses DATABASE_ADMIN_URL when set (the least-privilege app role has no DELETE on users — see roles.sql), else DATABASE_URL.
import pg from 'pg';

const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
const days = Number.parseInt(process.env.DELETED_ACCOUNT_RETENTION_DAYS ?? '30', 10);
if (!url) { console.error('DATABASE_URL (or DATABASE_ADMIN_URL) is not set.'); process.exit(1); }
if (!Number.isFinite(days) || days < 0) { console.error('DELETED_ACCOUNT_RETENTION_DAYS must be a non-negative number.'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
try {
  await client.connect();
  await client.query('BEGIN');
  const { rows } = await client.query(
    `DELETE FROM users WHERE status = 'deleted' AND deleted_at IS NOT NULL AND deleted_at < now() - make_interval(days => $1) RETURNING id`, [days]);
  await client.query(`INSERT INTO audit_log (action, target_type, details) VALUES ('retention.purge', 'user', $1)`, [JSON.stringify({ purged: rows.length, retentionDays: days })]);
  await client.query('COMMIT');
  console.log(`Purged ${rows.length} account(s) deleted more than ${days} day(s) ago.`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Retention purge failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
