// Minimal migration runner: applies db/migrations/*.sql in filename order, once each, inside a
// transaction, and records them in schema_migrations.
//   npm run db:migrate            apply pending migrations
//   npm run db:reset              DEVELOPMENT ONLY: drop everything, re-migrate, re-seed
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const isTest = process.env.NODE_ENV === 'test';
const url = (isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL);
const reset = process.argv.includes('--reset');

if (!url) {
  console.error(`${isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL'} is not set. Copy server/.env.example to server/.env and edit it.`);
  process.exit(1);
}
if (reset && process.env.NODE_ENV === 'production') {
  console.error('Refusing to reset a production database.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
try {
  await client.connect();
  if (reset) {
    console.log('Resetting schema "public" ...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
    console.log(`Applied ${file}`);
    count += 1;
  }
  console.log(count === 0 ? 'Database is up to date.' : `Applied ${count} migration(s).`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
