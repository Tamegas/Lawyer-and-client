// Loads the clearly-labelled FICTIONAL demonstration data from db/demo.sql.
// Re-running replaces the previous demo data (rows with is_demo = true) and never touches real accounts.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'demo.sql');
const isTest = process.env.NODE_ENV === 'test';
const url = isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

if (!url) {
  console.error(`${isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL'} is not set.`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('Refusing to load demo data into a production database (set ALLOW_DEMO_SEED=true to override).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
try {
  await client.connect();
  await client.query(await fs.readFile(file, 'utf8'));
  console.log('Demo data loaded (all fictional).');
  console.log('\nDemo accounts — password for all: Demo#Pass2026');
  console.log('  admin   admin@demo.haqlink.test');
  console.log('  client  client@demo.haqlink.test   (also client2@demo.haqlink.test)');
  console.log('  lawyer  lawyer1@demo.haqlink.test  ... lawyer12@demo.haqlink.test');
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
