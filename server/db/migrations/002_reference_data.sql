-- Reference data. Not demo data: these are the categories and cities the product starts with.
-- Administrators can add, rename or deactivate rows in the admin console; other countries are just more rows.

INSERT INTO legal_categories (name, slug, description, sort_order) VALUES
  ('Criminal Law',                'criminal-law',                'Being accused of, or affected by, a crime; police and court procedures.', 1),
  ('Family Law',                  'family-law',                  'Marriage, divorce, child custody and support, inheritance within the family.', 2),
  ('Property and Land Disputes',  'property-and-land-disputes',  'Ownership, boundaries, leases, evictions and land-use disagreements.', 3),
  ('Business and Commercial Law', 'business-and-commercial-law', 'Starting, running or closing a business; partnerships and commercial dealings.', 4),
  ('Employment and Labor Law',    'employment-and-labor-law',    'Hiring, dismissal, pay, workplace conditions and employer–employee disputes.', 5),
  ('Civil Disputes',              'civil-disputes',              'Disagreements between people or organisations that are not criminal matters.', 6),
  ('Contract Disputes',           'contract-disputes',           'Agreements that were broken, unclear or need reviewing or drafting.', 7),
  ('Immigration Law',             'immigration-law',             'Visas, residence, work permits and related procedures.', 8),
  ('Other Legal Issues',          'other-legal-issues',          'Anything that does not fit the other categories.', 9);

INSERT INTO locations (name, region, country_code, sort_order) VALUES
  ('Addis Ababa', 'Addis Ababa',     'ET', 1),
  ('Dire Dawa',   'Dire Dawa',       'ET', 2),
  ('Adama',       'Oromia',          'ET', 3),
  ('Bahir Dar',   'Amhara',          'ET', 4),
  ('Gondar',      'Amhara',          'ET', 5),
  ('Hawassa',     'Sidama',          'ET', 6),
  ('Mekelle',     'Tigray',          'ET', 7),
  ('Jimma',       'Oromia',          'ET', 8),
  ('Harar',       'Harari',          'ET', 9);
