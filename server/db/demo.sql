-- ======================================================================================================
-- HaqLink DEMONSTRATION DATA — EVERYTHING HERE IS FICTIONAL.
-- The people, firms, licences, cases, fees and messages below do not exist. Names are invented, every lawyer bio starts
-- with a "DEMONSTRATION PROFILE" notice, and every row is flagged is_demo = true (the UI shows a "Demo profile" badge).
-- The 'verified' status on six profiles is a FIXTURE so the verified UI can be demonstrated; no real verification happened.
-- Re-running replaces the previous demo data (rows with is_demo = true) and never touches real accounts.
-- Password for every demo account: Demo#Pass2026
-- ======================================================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $demo$
DECLARE
  pw constant text := crypt('Demo#Pass2026', gen_salt('bf', 10));
  admin_id uuid; c1 uuid; c2 uuid; uid uuid; pid uuid; l1 uuid; l2 uuid; conv1 uuid; conv2 uuid; q1 uuid; r record;
  day0 constant timestamptz := date_trunc('day', now());
BEGIN
  DELETE FROM users WHERE is_demo;

  INSERT INTO users (email, password_hash, role, full_name, is_demo, terms_accepted_at)
    VALUES ('admin@demo.haqlink.test', pw, 'admin', 'Demo Administrator (fictional)', true, now()) RETURNING id INTO admin_id;
  INSERT INTO users (email, password_hash, role, full_name, preferred_language, is_demo, terms_accepted_at)
    VALUES ('client@demo.haqlink.test', pw, 'client', 'Demo Client One (fictional)', 'English', true, now()) RETURNING id INTO c1;
  INSERT INTO users (email, password_hash, role, full_name, preferred_language, is_demo, terms_accepted_at)
    VALUES ('client2@demo.haqlink.test', pw, 'client', 'Demo Client Two (fictional)', 'Amharic', true, now()) RETURNING id INTO c2;

  FOR r IN SELECT * FROM (VALUES
    (1,  'Meron Tesfaye Alemu',   'Family Law Attorney',               12, 'Addis Ababa', ARRAY['Amharic','English']::text[],                ARRAY['online','in_person']::text[], 500::numeric,  1200::numeric, true,  true,  ARRAY['family-law']::text[],                                   'verified',   'Fictional example: advises on divorce, custody and family agreements.'),
    (2,  'Dawit Bekele Gebre',    'Criminal Defence Lawyer',           15, 'Addis Ababa', ARRAY['Amharic','English'],                        ARRAY['in_person','online'],         800,           1800,          false, false, ARRAY['criminal-law'],                                    'verified',   'Fictional example: represents people accused in criminal matters.'),
    (3,  'Hana Girma Wolde',      'Commercial and Contracts Counsel',   9, 'Addis Ababa', ARRAY['English','Amharic','French'],               ARRAY['online'],                     NULL,          2500,          true,  true,  ARRAY['business-and-commercial-law','contract-disputes'], 'verified',   'Fictional example: helps small companies with agreements and disputes.'),
    (4,  'Abdi Hussein Kedir',    'Land and Property Lawyer',          11, 'Dire Dawa',   ARRAY['Afaan Oromo','Amharic','Somali'],          ARRAY['in_person'],                  400,           NULL,          true,  false, ARRAY['property-and-land-disputes'],                      'verified',   'Fictional example: works on boundary, lease and eviction disagreements.'),
    (5,  'Selamawit Haile Mariam','Employment and Labour Lawyer',       8, 'Adama',       ARRAY['Amharic','Afaan Oromo','English'],         ARRAY['online','in_person'],         450,           1000,          true,  true,  ARRAY['employment-and-labor-law'],                        'verified',   'Fictional example: assists employees and employers with workplace disputes.'),
    (6,  'Yonas Tadesse Assefa',  'Immigration Lawyer',                 7, 'Addis Ababa', ARRAY['English','Arabic','Amharic'],              ARRAY['online'],                     1000,          2200,          false, true,  ARRAY['immigration-law'],                                 'verified',   'Fictional example: guides visa and residence applications.'),
    (7,  'Tigist Abebe Negash',   'Civil Litigation Lawyer',            6, 'Bahir Dar',   ARRAY['Amharic','English'],                       ARRAY['in_person','online'],         350,           NULL,          true,  false, ARRAY['civil-disputes','contract-disputes'],              'unverified', 'Fictional example: civil claims and contract disagreements.'),
    (8,  'Kebede Lemma Tolera',   'Criminal Law Practitioner',         10, 'Jimma',       ARRAY['Afaan Oromo','Amharic'],                   ARRAY['in_person'],                  NULL,          NULL,          false, false, ARRAY['criminal-law'],                                    'unverified', 'Fictional example: no listed fee, shows "Contact for pricing".'),
    (9,  'Rahel Mulugeta Desta',  'Family and Inheritance Lawyer',      5, 'Hawassa',     ARRAY['Amharic','Sidama','English'],              ARRAY['online','in_person'],         300,           900,           true,  true,  ARRAY['family-law'],                                      'unverified', 'Fictional example: family matters and inheritance planning.'),
    (10, 'Gebre Kiros Berhe',     'Property Law Advisor',               4, 'Mekelle',     ARRAY['Tigrinya','Amharic','English'],            ARRAY['in_person'],                  400,           NULL,          false, false, ARRAY['property-and-land-disputes'],                      'unverified', 'Fictional example: property registration and disputes.'),
    (11, 'Fatuma Ali Mohammed',   'General Legal Adviser',              3, 'Harar',       ARRAY['Afaan Oromo','Arabic','Amharic'],          ARRAY['online','in_person'],         250,           NULL,          true,  true,  ARRAY['other-legal-issues','family-law'],                 'unverified', 'Fictional example: general guidance and referrals.'),
    (12, 'Biniam Worku Shiferaw', 'Employment Law Associate',           2, 'Gondar',      ARRAY['Amharic','English'],                       ARRAY['online'],                     600,           1500,          false, false, ARRAY['employment-and-labor-law'],                        'pending',    'Fictional example: applied for verification; application is under review.')
  ) AS t(n, name, title, years, city, langs, modes, fee, hourly, negotiable, plans, cats, vstatus, blurb)
  LOOP
    INSERT INTO users (email, password_hash, role, full_name, preferred_language, is_demo, terms_accepted_at)
      VALUES ('lawyer' || r.n || '@demo.haqlink.test', pw, 'lawyer', r.name, r.langs[1], true, now()) RETURNING id INTO uid;
    INSERT INTO lawyer_profiles (user_id, slug, professional_title, bio, qualifications, years_experience, location_id, office_address, languages,
                                 consultation_modes, consultation_fee, hourly_rate, fee_negotiable, payment_plans, accepting_new_clients, slot_minutes,
                                 profile_status, verification_status, verified_at, verified_by, is_demo)
    VALUES (uid, lower(regexp_replace(trim(r.name), '\s+', '-', 'g')), r.title,
            '[DEMONSTRATION PROFILE — fictional person, not a real lawyer.] ' || r.blurb || ' This text is placeholder content used to show how a profile looks.',
            'LLB (fictional demonstration institution). Placeholder qualifications.', r.years,
            (SELECT id FROM locations WHERE name = r.city), 'Demo Street ' || r.n || ', ' || r.city || ' (fictional address)', r.langs,
            r.modes, r.fee, r.hourly, r.negotiable, r.plans, r.n <> 8, CASE WHEN r.n IN (3, 6) THEN 30 ELSE 60 END,
            'published', r.vstatus::verification_status, CASE WHEN r.vstatus = 'verified' THEN now() END, CASE WHEN r.vstatus = 'verified' THEN admin_id END, true)
    RETURNING id INTO pid;

    INSERT INTO lawyer_specializations (lawyer_profile_id, category_id) SELECT pid, id FROM legal_categories WHERE slug = ANY (r.cats);

    IF r.n <= 11 THEN
      INSERT INTO lawyer_availability (lawyer_profile_id, weekday, start_time, end_time)
        SELECT pid, d, t.s::time, t.e::time FROM generate_series(1, 5) d, (VALUES ('09:00', '12:00'), ('14:00', '17:00')) AS t(s, e);
      IF r.n IN (1, 2, 5) THEN INSERT INTO lawyer_availability (lawyer_profile_id, weekday, start_time, end_time) VALUES (pid, 6, '09:00', '12:00'); END IF;
    END IF;

    IF r.vstatus = 'verified' THEN
      INSERT INTO professional_credentials (lawyer_profile_id, credential_type, issuing_body, reference_number, issued_on, expires_on, original_filename, status, reviewed_by, reviewed_at)
        VALUES (pid, 'bar_license', 'Fictional Demo Bar Association', 'DEMO-' || lpad(r.n::text, 4, '0'), current_date - 2000, current_date + 365, 'demo-licence.pdf (no real file)', 'verified', admin_id, now());
    END IF;
    IF r.vstatus = 'pending' THEN
      INSERT INTO professional_credentials (lawyer_profile_id, credential_type, issuing_body, reference_number, original_filename, status)
        VALUES (pid, 'bar_license', 'Fictional Demo Bar Association', 'DEMO-0012', 'demo-licence.pdf (no real file)', 'pending');
      INSERT INTO verification_applications (lawyer_profile_id, status, lawyer_note) VALUES (pid, 'submitted', 'Demonstration application (fictional).');
    END IF;
    IF r.fee IS NOT NULL AND r.n IN (1, 3, 5) THEN
      INSERT INTO lawyer_fixed_fee_services (lawyer_profile_id, title, description, amount, sort_order)
        VALUES (pid, 'Document review (demo)', 'Fictional fixed-fee service: review of one document.', 1500, 0),
               (pid, 'Draft a standard agreement (demo)', 'Fictional fixed-fee service: one standard agreement.', 4000, 1);
    END IF;
  END LOOP;

  -- Fictional case summaries. Evidence levels are shown honestly: only "verified_document" means an administrator checked it, and nothing here was.
  INSERT INTO case_experience (lawyer_profile_id, category_id, title, description, lawyer_role, outcome, public_reference, case_year, evidence_level, confidentiality_confirmed, status, is_demo)
  SELECT lp.id, cat.id, v.title, v.descr, v.role, v.outcome, v.ref, v.yr, v.ev::evidence_level, true, 'published', true
    FROM (VALUES
      ('lawyer1@demo.haqlink.test', 'family-law', '[Fictional] Agreement on parenting arrangements', 'Invented example: parents reached a written agreement about how a child''s time would be shared.', 'Lead adviser', 'Agreement reached without a hearing (fictional).', NULL, 2023, 'lawyer_claim'),
      ('lawyer1@demo.haqlink.test', 'family-law', '[Fictional] Property division after separation', 'Invented example: advice on dividing shared property.', 'Adviser', NULL, NULL, 2022, 'lawyer_claim'),
      ('lawyer2@demo.haqlink.test', 'criminal-law', '[Fictional] Bail application', 'Invented example: representation at a bail hearing.', 'Defence counsel', 'Bail granted with conditions (fictional).', 'Fictional demo reference — no real case', 2024, 'public_reference'),
      ('lawyer3@demo.haqlink.test', 'contract-disputes', '[Fictional] Supply agreement dispute', 'Invented example: negotiation of a disagreement over delivery terms.', 'Negotiator and drafter', 'Settled (fictional).', NULL, 2023, 'lawyer_claim'),
      ('lawyer4@demo.haqlink.test', 'property-and-land-disputes', '[Fictional] Boundary disagreement', 'Invented example: mediation between neighbours about a shared boundary.', 'Mediator-adviser', NULL, NULL, 2021, 'lawyer_claim'),
      ('lawyer5@demo.haqlink.test', 'employment-and-labor-law', '[Fictional] Unpaid wages claim', 'Invented example: claim for unpaid wages by an employee.', 'Representative', 'Claim resolved in the employee''s favour (fictional, illustrates a documented-outcome label).', 'Fictional demo document — checked by no one', 2022, 'verified_document'),
      ('lawyer6@demo.haqlink.test', 'immigration-law', '[Fictional] Residence permit renewal', 'Invented example: guidance through a permit renewal.', 'Adviser', NULL, NULL, 2024, 'lawyer_claim')
    ) AS v(email, cat, title, descr, role, outcome, ref, yr, ev)
    JOIN users u ON u.email = v.email JOIN lawyer_profiles lp ON lp.user_id = u.id JOIN legal_categories cat ON cat.slug = v.cat;

  -- Sample client activity (no reviews on purpose: "No reviews yet" is the honest empty state).
  SELECT lp.id INTO l1 FROM lawyer_profiles lp JOIN users u ON u.id = lp.user_id WHERE u.email = 'lawyer1@demo.haqlink.test';
  SELECT lp.id INTO l2 FROM lawyer_profiles lp JOIN users u ON u.id = lp.user_id WHERE u.email = 'lawyer2@demo.haqlink.test';

  INSERT INTO legal_requests (client_id, category_id, summary, location_id, issue_started_on, has_urgent_deadline, deadline_on, help_type, preferred_language, consultation_preference, budget_min, budget_max)
  VALUES (c1, (SELECT id FROM legal_categories WHERE slug = 'family-law'), '[Fictional demo request] I would like general guidance about arrangements for a child after a separation.',
          (SELECT id FROM locations WHERE name = 'Addis Ababa'), current_date - 40, false, NULL, 'consultation', 'Amharic', 'either', 500, 3000);
  INSERT INTO legal_requests (client_id, category_id, summary, location_id, help_type, consultation_preference)
  VALUES (c2, (SELECT id FROM legal_categories WHERE slug = 'employment-and-labor-law'), '[Fictional demo request] I want to understand my options about unpaid overtime at work.',
          (SELECT id FROM locations WHERE name = 'Adama'), 'consultation', 'online');

  INSERT INTO conversations (client_id, lawyer_profile_id, request_id, request_shared_at, client_last_read_at, lawyer_last_read_at, last_message_at)
  VALUES (c1, l1, (SELECT id FROM legal_requests WHERE client_id = c1), now() - interval '2 days', now() - interval '1 day', now() - interval '3 days', now() - interval '1 day') RETURNING id INTO conv1;
  INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES
    (conv1, c1, '[Demo] Hello, I shared my request with you. Could we discuss a first consultation?', now() - interval '2 days'),
    (conv1, (SELECT user_id FROM lawyer_profiles WHERE id = l1), '[Demo] Thank you for reaching out. I can explain how I work and what the first consultation covers.', now() - interval '1 day 20 hours'),
    (conv1, c1, '[Demo] Could you send an itemised estimate for a first consultation and one document review?', now() - interval '1 day');

  INSERT INTO quotations (conversation_id, client_id, lawyer_profile_id, status, client_budget, client_scope_notes, itemized_requested, fee_type, total_estimate, scope_of_work,
                          payment_schedule, exclusions, expenses_note, valid_until, lawyer_note, responded_at)
  VALUES (conv1, c1, l1, 'proposed', 2500, 'A first consultation and one document review.', true, 'itemized', 2000,
          'One 60-minute consultation and review of one document (fictional).', '50% before the work, 50% when it is delivered (fictional).',
          'Court appearances and drafting additional documents are not included.', 'Translation or travel, if needed, would be quoted separately.',
          current_date + 14, '[Demo] This is a fictional, non-binding proposal.', now() - interval '12 hours') RETURNING id INTO q1;
  INSERT INTO quotation_items (quotation_id, description, amount, sort_order) VALUES (q1, 'Initial consultation (60 minutes)', 500, 0), (q1, 'Review of one document', 1500, 1);

  INSERT INTO conversations (client_id, lawyer_profile_id, last_message_at) VALUES (c1, l2, now() - interval '3 days') RETURNING id INTO conv2;
  INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (conv2, c1, '[Demo] I would like to book a consultation.', now() - interval '3 days');

  -- Appointments relative to today (10:00 Addis Ababa time = 07:00 UTC).
  INSERT INTO appointments (conversation_id, client_id, lawyer_profile_id, starts_at, ends_at, mode, reason, status, decided_at) VALUES
    (conv1, c1, l1, day0 + interval '10 days 7 hours', day0 + interval '10 days 8 hours', 'online',    '[Demo] First consultation about family arrangements.', 'requested', NULL),
    (conv2, c1, l2, day0 + interval '5 days 8 hours',  day0 + interval '5 days 9 hours',  'in_person', '[Demo] Consultation about a criminal-law question.',  'confirmed', now()),
    (conv1, c1, l1, day0 - interval '10 days' + interval '7 hours', day0 - interval '10 days' + interval '8 hours', 'online', '[Demo] Past consultation (completed) so the review flow can be tried.', 'completed', now() - interval '11 days');
END
$demo$;
