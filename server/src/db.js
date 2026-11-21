import pg from 'pg';
import { config } from './config.js';

// numeric -> JS number (money columns are numeric(12,2)); date -> 'YYYY-MM-DD' string (no time-zone shifting).
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number.parseFloat(value)));
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  max: 10,
});

/** query(sql, params) -> { rows }. Always pass user input as params ($1, $2 ...), never concatenate it. */
export const query = (text, params) => pool.query(text, params);

/** First row or null. */
export async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

/** Runs fn(db) inside a transaction; db.query(...) uses the same connection. Rolls back if fn throws. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Append an entry to the audit trail. `db` may be the pool-level { query } or a transaction client. */
export async function audit(db, { actor, action, targetType = null, targetId = null, details = {} }) {
  await db.query(
    'INSERT INTO audit_log (actor_id, actor_role, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
    [actor?.id ?? null, actor?.role ?? null, action, targetType, targetId == null ? null : String(targetId), JSON.stringify(details)],
  );
}

export const closePool = () => pool.end();
