import { escapeLike } from './text.js';
import { CARD_COLUMNS, CARD_FROM } from './lawyerQueries.js';

/**
 * Build the directory search for already-validated filters. Every user-supplied value goes through a
 * bind parameter ($1, $2, ...); nothing is concatenated into the SQL text except fixed fragments.
 */
export function buildDirectoryQuery(f) {
  const params = [];
  const add = (value) => { params.push(value); return `$${params.length}`; };
  const where = [`lp.profile_status = 'published'`];

  if (f.category) {
    where.push(`EXISTS (SELECT 1 FROM lawyer_specializations s JOIN legal_categories c ON c.id = s.category_id
                         WHERE s.lawyer_profile_id = lp.id AND c.slug = ${add(f.category)})`);
  }
  if (f.location) where.push(`lp.location_id = ${add(f.location)}`);
  if (f.minExperience != null) where.push(`lp.years_experience >= ${add(f.minExperience)}`);
  // Lawyers with no listed fee ("Contact for pricing") cannot match a fee range, so they are excluded when one is set.
  if (f.minFee != null) where.push(`lp.consultation_fee >= ${add(f.minFee)}`);
  if (f.maxFee != null) where.push(`lp.consultation_fee <= ${add(f.maxFee)}`);
  if (f.language) where.push(`${add(f.language)} = ANY (lp.languages)`);
  if (f.mode) where.push(`${add(f.mode)} = ANY (lp.consultation_modes)`);
  if (f.verified === 'true') where.push(`lp.verification_status = 'verified'`);
  // "Available" = taking new clients AND has published weekly hours people can book.
  if (f.available === 'true') {
    where.push(`lp.accepting_new_clients AND EXISTS (SELECT 1 FROM lawyer_availability a WHERE a.lawyer_profile_id = lp.id)`);
  }

  let relevance = `(lp.verification_status = 'verified') DESC, lp.accepting_new_clients DESC, lp.years_experience DESC NULLS LAST`;
  if (f.q) {
    const p = add(`%${escapeLike(f.q)}%`);
    const categoryMatch = `EXISTS (SELECT 1 FROM lawyer_specializations s JOIN legal_categories c ON c.id = s.category_id
                                    WHERE s.lawyer_profile_id = lp.id AND c.name ILIKE ${p})`;
    where.push(`(u.full_name ILIKE ${p} OR lp.professional_title ILIKE ${p} OR lp.bio ILIKE ${p}
                 OR loc.name ILIKE ${p} OR ${categoryMatch})`);
    relevance = `(CASE WHEN u.full_name ILIKE ${p} THEN 4 ELSE 0 END
                + CASE WHEN lp.professional_title ILIKE ${p} THEN 3 ELSE 0 END
                + CASE WHEN ${categoryMatch} THEN 3 ELSE 0 END
                + CASE WHEN lp.bio ILIKE ${p} THEN 1 ELSE 0 END) DESC, ${relevance}`;
  }

  const orderBy = {
    relevance,
    experience: 'lp.years_experience DESC NULLS LAST',
    fee_asc: 'lp.consultation_fee ASC NULLS LAST',
    rating: 'rv.avg_rating DESC NULLS LAST, rv.review_count DESC NULLS LAST',
  }[f.sort ?? 'relevance'];

  const limit = add(f.pageSize);
  const offset = add((f.page - 1) * f.pageSize);

  const sql = `
    SELECT ${CARD_COLUMNS}, COUNT(*) OVER ()::int AS total
    ${CARD_FROM}
    WHERE ${where.join('\n      AND ')}
    ORDER BY ${orderBy}, u.full_name ASC, lp.id ASC
    LIMIT ${limit} OFFSET ${offset}`;
  return { sql, params };
}
