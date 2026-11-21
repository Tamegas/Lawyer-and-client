// The "lawyer card": the public summary used by the directory, matches, saved lawyers and profile header.
// Only public fields. Private contact details, licence numbers and documents never appear here.

export const CARD_COLUMNS = `
  lp.id, lp.slug, lp.professional_title, lp.years_experience, lp.languages, lp.consultation_modes, lp.currency,
  lp.consultation_fee, lp.hourly_rate, lp.fee_negotiable, lp.payment_plans, lp.accepting_new_clients,
  lp.verification_status, lp.is_demo, u.full_name, loc.id AS location_id, loc.name AS location_name,
  rv.avg_rating, rv.review_count,
  EXISTS (SELECT 1 FROM lawyer_availability a WHERE a.lawyer_profile_id = lp.id) AS has_availability,
  COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) ORDER BY c.sort_order)
              FROM lawyer_specializations s JOIN legal_categories c ON c.id = s.category_id
             WHERE s.lawyer_profile_id = lp.id), '[]'::json) AS specializations`;

export const CARD_FROM = `
  FROM lawyer_profiles lp
  JOIN users u ON u.id = lp.user_id
  LEFT JOIN locations loc ON loc.id = lp.location_id
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(r.rating)::numeric, 1)::float AS avg_rating, COUNT(*)::int AS review_count
      FROM reviews r WHERE r.lawyer_profile_id = lp.id AND r.status = 'published'
  ) rv ON true`;

export function mapCard(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.full_name,
    title: row.professional_title,
    yearsExperience: row.years_experience,
    location: row.location_id ? { id: row.location_id, name: row.location_name } : null,
    languages: row.languages ?? [],
    consultationModes: row.consultation_modes ?? [],
    currency: row.currency,
    consultationFee: row.consultation_fee,   // null = "Contact for pricing"
    hourlyRate: row.hourly_rate,
    feeNegotiable: row.fee_negotiable,
    paymentPlans: row.payment_plans,
    acceptingNewClients: row.accepting_new_clients,
    hasAvailability: row.has_availability,
    verificationStatus: row.verification_status,   // 'verified' is the ONLY value that may be shown as "Verified"
    isDemo: row.is_demo,                            // fictional demonstration profile
    specializations: row.specializations ?? [],     // [{ id, name, slug }]
    rating: row.review_count > 0 ? { average: row.avg_rating, count: row.review_count } : null,   // null = "No reviews yet"
  };
}
