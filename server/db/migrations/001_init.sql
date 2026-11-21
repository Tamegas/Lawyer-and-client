-- HaqLink schema. PostgreSQL 14+. Run through `npm run db:migrate` (see db/migrate.js).
-- Principles: public lawyer data (lawyer_profiles & friends) is kept apart from private client data
-- (legal_requests, conversations, messages, quotations, appointments). Verification documents are rows
-- that only point at a private file on disk; the file itself is never served statically.

CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid(), crypt() (demo seed)
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- no double-booked appointments

-- ---------------------------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------------------------
CREATE TYPE user_role           AS ENUM ('client', 'lawyer', 'admin');
CREATE TYPE account_status      AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE profile_status      AS ENUM ('draft', 'published', 'suspended');
-- unverified = never reviewed, pending = application under review, verified / rejected = admin decision.
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE application_status  AS ENUM ('submitted', 'more_info_requested', 'approved', 'rejected', 'withdrawn');
CREATE TYPE credential_type     AS ENUM ('bar_license', 'law_degree', 'professional_certificate', 'other');
CREATE TYPE credential_status   AS ENUM ('pending', 'verified', 'rejected');
-- Used by reviews (published|hidden) and case summaries (pending|published|rejected|hidden).
CREATE TYPE content_status      AS ENUM ('pending', 'published', 'hidden', 'rejected');
-- lawyer_claim = submitted by the lawyer, not independently checked;
-- public_reference = the lawyer cited a public judgment / reference (not yet checked by us);
-- verified_document = an administrator checked it against a public source or document.
CREATE TYPE evidence_level      AS ENUM ('lawyer_claim', 'public_reference', 'verified_document');
CREATE TYPE request_status      AS ENUM ('open', 'closed');
CREATE TYPE conversation_status AS ENUM ('open', 'closed');
CREATE TYPE quotation_status    AS ENUM ('requested', 'proposed', 'revision_requested', 'accepted', 'declined', 'withdrawn');
CREATE TYPE fee_type            AS ENUM ('fixed', 'hourly', 'itemized');
CREATE TYPE appointment_status  AS ENUM ('requested', 'confirmed', 'declined', 'cancelled', 'completed');
CREATE TYPE appointment_mode    AS ENUM ('online', 'in_person');
CREATE TYPE report_target       AS ENUM ('lawyer_profile', 'review', 'case', 'message');
CREATE TYPE report_reason       AS ENUM ('misleading', 'impersonation', 'inappropriate', 'confidential_info', 'abusive', 'spam', 'other');
CREATE TYPE report_status       AS ENUM ('open', 'resolved', 'dismissed');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------------------------
-- Reference data (managed by administrators; country-agnostic so new markets are just rows)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE legal_categories (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE CHECK (length(name) BETWEEN 2 AND 80),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE locations (
  id           serial PRIMARY KEY,
  name         text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  region       text,
  country_code char(2) NOT NULL DEFAULT 'ET',
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  UNIQUE (country_code, name)
);

-- ---------------------------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------------------------
CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL CHECK (length(email) BETWEEN 5 AND 254 AND position('@' IN email) > 1),
  password_hash      text NOT NULL,
  role               user_role NOT NULL,
  full_name          text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 120),
  phone              text CHECK (phone IS NULL OR length(phone) BETWEEN 5 AND 30),   -- private, never exposed publicly
  preferred_language text NOT NULL DEFAULT 'English',
  status             account_status NOT NULL DEFAULT 'active',
  status_reason      text,                      -- why an administrator suspended the account
  terms_accepted_at  timestamptz,
  token_version      int NOT NULL DEFAULT 0,    -- bump to invalidate every session of this user
  last_login_at      timestamptz,
  deleted_at         timestamptz,
  is_demo            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
CREATE INDEX users_role_status_idx ON users (role, status);
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Public lawyer profile (separate from the account row so private fields never leak by accident)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE lawyer_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug                  text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  professional_title    text NOT NULL CHECK (length(btrim(professional_title)) BETWEEN 2 AND 120),
  bio                   text CHECK (length(bio) <= 4000),
  qualifications        text CHECK (length(qualifications) <= 3000),
  years_experience      int CHECK (years_experience BETWEEN 0 AND 70),
  location_id           int REFERENCES locations(id),
  office_address        text CHECK (length(office_address) <= 300),
  languages             text[] NOT NULL DEFAULT '{}',
  consultation_modes    text[] NOT NULL DEFAULT '{online}' CHECK (consultation_modes <@ ARRAY['online', 'in_person']::text[]),
  currency              char(3) NOT NULL DEFAULT 'ETB',
  consultation_fee      numeric(12,2) CHECK (consultation_fee >= 0),   -- NULL = "Contact for pricing"
  hourly_rate           numeric(12,2) CHECK (hourly_rate >= 0),
  fee_negotiable        boolean NOT NULL DEFAULT false,
  payment_plans         boolean NOT NULL DEFAULT false,
  accepting_new_clients boolean NOT NULL DEFAULT true,
  timezone              text NOT NULL DEFAULT 'Africa/Addis_Ababa',
  slot_minutes          int NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 240),
  public_email          text CHECK (public_email IS NULL OR position('@' IN public_email) > 1),   -- only if the lawyer chose to publish
  public_phone          text CHECK (public_phone IS NULL OR length(public_phone) BETWEEN 5 AND 30),
  profile_status        profile_status NOT NULL DEFAULT 'draft',
  verification_status   verification_status NOT NULL DEFAULT 'unverified',
  verified_at           timestamptz,
  verified_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  is_demo               boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lawyer_profiles_listing_idx ON lawyer_profiles (profile_status, verification_status);
CREATE INDEX lawyer_profiles_location_idx ON lawyer_profiles (location_id);
CREATE TRIGGER lawyer_profiles_updated BEFORE UPDATE ON lawyer_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE lawyer_specializations (
  lawyer_profile_id uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  category_id       int  NOT NULL REFERENCES legal_categories(id),
  PRIMARY KEY (lawyer_profile_id, category_id)
);
CREATE INDEX lawyer_specializations_category_idx ON lawyer_specializations (category_id);

CREATE TABLE lawyer_fixed_fee_services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  title             text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
  description       text CHECK (length(description) <= 500),
  amount            numeric(12,2) NOT NULL CHECK (amount >= 0),
  sort_order        int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lawyer_fixed_fee_services_profile_idx ON lawyer_fixed_fee_services (lawyer_profile_id);

-- Weekly availability in the lawyer's own timezone. Concrete bookable slots are computed, never stored.
CREATE TABLE lawyer_availability (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  weekday           smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
  start_time        time NOT NULL,
  end_time          time NOT NULL,
  CHECK (start_time < end_time)
);
CREATE INDEX lawyer_availability_profile_idx ON lawyer_availability (lawyer_profile_id, weekday);

-- ---------------------------------------------------------------------------------------------
-- Verification: credentials (private documents) and the application an administrator decides on
-- ---------------------------------------------------------------------------------------------
CREATE TABLE professional_credentials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  credential_type   credential_type NOT NULL,
  issuing_body      text CHECK (length(issuing_body) <= 160),
  reference_number  text CHECK (length(reference_number) <= 80),   -- licence number: private, admin-only
  issued_on         date,
  expires_on        date,
  original_filename text,
  stored_filename   text,       -- random name inside UPLOAD_DIR; never returned by any API
  mime_type         text,
  size_bytes        int CHECK (size_bytes IS NULL OR size_bytes > 0),
  sha256            text,
  status            credential_status NOT NULL DEFAULT 'pending',
  review_note       text,
  reviewed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX professional_credentials_profile_idx ON professional_credentials (lawyer_profile_id);

CREATE TABLE verification_applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  status            application_status NOT NULL DEFAULT 'submitted',
  lawyer_note       text CHECK (length(lawyer_note) <= 1500),
  admin_note        text CHECK (length(admin_note) <= 1500),    -- shown to the lawyer
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  decided_at        timestamptz,
  decided_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- At most one open application per lawyer.
CREATE UNIQUE INDEX verification_applications_open_key ON verification_applications (lawyer_profile_id)
  WHERE status IN ('submitted', 'more_info_requested');
CREATE INDEX verification_applications_status_idx ON verification_applications (status, submitted_at);
CREATE TRIGGER verification_applications_updated BEFORE UPDATE ON verification_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Case experience: lawyer-submitted summaries, moderated, with an explicit evidence level
-- ---------------------------------------------------------------------------------------------
CREATE TABLE case_experience (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id       uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  category_id             int NOT NULL REFERENCES legal_categories(id),
  title                   text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 140),
  description             text NOT NULL CHECK (length(description) BETWEEN 20 AND 1500),
  lawyer_role             text NOT NULL CHECK (length(btrim(lawyer_role)) BETWEEN 2 AND 160),
  outcome                 text CHECK (length(outcome) <= 600),      -- only if it can lawfully be disclosed
  public_reference        text CHECK (length(public_reference) <= 300),
  case_year               int NOT NULL CHECK (case_year BETWEEN 1950 AND 2100),
  evidence_level          evidence_level NOT NULL DEFAULT 'lawyer_claim',
  confidentiality_confirmed boolean NOT NULL CHECK (confidentiality_confirmed),   -- lawyer attests: no identifying details, disclosure permitted
  status                  content_status NOT NULL DEFAULT 'pending',
  moderation_note         text,
  moderated_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  moderated_at            timestamptz,
  is_demo                 boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX case_experience_profile_idx ON case_experience (lawyer_profile_id, status);
CREATE TRIGGER case_experience_updated BEFORE UPDATE ON case_experience FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Private client data: requests, conversations, messages, quotations, appointments
-- ---------------------------------------------------------------------------------------------
CREATE TABLE legal_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id             int NOT NULL REFERENCES legal_categories(id),
  summary                 text NOT NULL CHECK (length(summary) BETWEEN 20 AND 3000),
  location_id             int REFERENCES locations(id),
  issue_started_on        date,
  has_urgent_deadline     boolean NOT NULL DEFAULT false,
  deadline_on             date,
  help_type               text NOT NULL DEFAULT 'consultation'
                          CHECK (help_type IN ('consultation', 'representation', 'document_review', 'document_drafting', 'mediation', 'general_information')),
  preferred_language      text,
  consultation_preference text NOT NULL DEFAULT 'either' CHECK (consultation_preference IN ('online', 'in_person', 'either')),
  budget_min              numeric(12,2) CHECK (budget_min >= 0),
  budget_max              numeric(12,2) CHECK (budget_max >= 0),
  currency                char(3) NOT NULL DEFAULT 'ETB',
  status                  request_status NOT NULL DEFAULT 'open',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min)
);
CREATE INDEX legal_requests_client_idx ON legal_requests (client_id, created_at DESC);
CREATE TRIGGER legal_requests_updated BEFORE UPDATE ON legal_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_profile_id   uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  -- The client's request is readable by the lawyer ONLY while request_id is set AND request_shared_at is not null
  -- (explicit consent, revocable by the client; deleting the request clears request_id).
  request_id          uuid REFERENCES legal_requests(id) ON DELETE SET NULL,
  request_shared_at   timestamptz,
  status              conversation_status NOT NULL DEFAULT 'open',
  client_last_read_at timestamptz,
  lawyer_last_read_at timestamptz,
  last_message_at     timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, lawyer_profile_id)
);
CREATE INDEX conversations_lawyer_idx ON conversations (lawyer_profile_id, last_message_at DESC);
CREATE INDEX conversations_client_idx ON conversations (client_id, last_message_at DESC);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

CREATE TABLE quotations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_profile_id  uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  status             quotation_status NOT NULL DEFAULT 'requested',
  client_budget      numeric(12,2) CHECK (client_budget >= 0),
  client_scope_notes text NOT NULL CHECK (length(client_scope_notes) BETWEEN 5 AND 1500),
  itemized_requested boolean NOT NULL DEFAULT false,
  fee_type           fee_type,
  fixed_amount       numeric(12,2) CHECK (fixed_amount >= 0),
  hourly_rate        numeric(12,2) CHECK (hourly_rate >= 0),
  estimated_hours    numeric(8,2) CHECK (estimated_hours > 0),
  total_estimate     numeric(12,2) CHECK (total_estimate >= 0),
  currency           char(3) NOT NULL DEFAULT 'ETB',
  scope_of_work      text CHECK (length(scope_of_work) <= 2000),
  payment_schedule   text CHECK (length(payment_schedule) <= 1000),
  exclusions         text CHECK (length(exclusions) <= 1500),
  expenses_note      text CHECK (length(expenses_note) <= 1000),
  valid_until        date,
  lawyer_note        text CHECK (length(lawyer_note) <= 1000),
  client_response_note text CHECK (length(client_response_note) <= 1000),
  responded_at       timestamptz,
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quotations_client_idx ON quotations (client_id, updated_at DESC);
CREATE INDEX quotations_lawyer_idx ON quotations (lawyer_profile_id, status, updated_at DESC);
CREATE INDEX quotations_conversation_idx ON quotations (conversation_id);
CREATE TRIGGER quotations_updated BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quotation_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description  text NOT NULL CHECK (length(btrim(description)) BETWEEN 2 AND 200),
  amount       numeric(12,2) NOT NULL CHECK (amount >= 0),
  sort_order   int NOT NULL DEFAULT 0
);
CREATE INDEX quotation_items_quotation_idx ON quotation_items (quotation_id, sort_order);

CREATE TABLE appointments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id      uuid REFERENCES conversations(id) ON DELETE SET NULL,
  client_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_profile_id    uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  starts_at            timestamptz NOT NULL,     -- a UTC instant; shown in each viewer's time zone
  ends_at              timestamptz NOT NULL,
  mode                 appointment_mode NOT NULL,
  reason               text NOT NULL CHECK (length(reason) BETWEEN 5 AND 1000),
  status               appointment_status NOT NULL DEFAULT 'requested',
  lawyer_note          text CHECK (length(lawyer_note) <= 1000),          -- decline reason / short note to the client
  meeting_instructions text CHECK (length(meeting_instructions) <= 1000), -- link or directions the lawyer shares (no built-in video)
  cancelled_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  -- A lawyer cannot be double-booked by pending or confirmed appointments.
  EXCLUDE USING gist (lawyer_profile_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status IN ('requested', 'confirmed'))
);
CREATE INDEX appointments_client_idx ON appointments (client_id, starts_at DESC);
CREATE INDEX appointments_lawyer_idx ON appointments (lawyer_profile_id, starts_at DESC);
CREATE TRIGGER appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE saved_lawyers (
  client_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_profile_id uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, lawyer_profile_id)
);

-- ---------------------------------------------------------------------------------------------
-- Reviews (only after a completed appointment; one per appointment) and reports
-- ---------------------------------------------------------------------------------------------
CREATE TABLE reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id uuid NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES users(id) ON DELETE SET NULL,           -- NULL once the client's account is purged
  appointment_id    uuid NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  rating            int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body              text NOT NULL CHECK (length(btrim(body)) BETWEEN 20 AND 2000),
  status            content_status NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  moderation_note   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_profile_idx ON reviews (lawyer_profile_id, status, created_at DESC);
CREATE TRIGGER reviews_updated BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type     report_target NOT NULL,
  target_id       uuid NOT NULL,                 -- id of the profile / review / case / message (no FK: polymorphic)
  reason          report_reason NOT NULL,
  details         text CHECK (length(details) <= 1500),
  status          report_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- One open report per person per item.
CREATE UNIQUE INDEX reports_open_once_key ON reports (reporter_id, target_type, target_id) WHERE status = 'open';
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);

-- ---------------------------------------------------------------------------------------------
-- Audit trail of administrator (and security-relevant) actions. Append-only for the app role (see roles.sql).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role  user_role,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action, created_at DESC);
