-- Optional but recommended for production: run the API as a least-privilege database role.
-- The application only needs to read and write rows; it never needs to create, alter or drop tables.
-- Run once, as the database owner, AFTER the migrations:
--
--   psql "$DATABASE_ADMIN_URL" -v app_password="'a-long-random-password'" -f db/roles.sql
--
-- Then point DATABASE_URL at haqlink_app and keep the owner's URL for migrations (and DATABASE_ADMIN_URL
-- for `npm run retention:purge`, which needs DELETE on users).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'haqlink_app') THEN
    CREATE ROLE haqlink_app LOGIN;
  END IF;
END $$;

ALTER ROLE haqlink_app PASSWORD :app_password;

GRANT CONNECT ON DATABASE :"DBNAME" TO haqlink_app;
GRANT USAGE ON SCHEMA public TO haqlink_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO haqlink_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO haqlink_app;

-- The audit trail is append-only for the application.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM haqlink_app;
-- Accounts are anonymised (UPDATE), never deleted, by the app; only the retention job removes rows.
REVOKE DELETE ON users FROM haqlink_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM haqlink_app;

-- Migrations that run later should also grant the same privileges on new tables:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO haqlink_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO haqlink_app;
