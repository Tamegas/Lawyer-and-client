// Public. GET /api/lawyers?q&category(slug)&location(id)&minExperience&minFee&maxFee&language&available&verified&mode&sort&page&pageSize
//   -> { lawyers:[card], total, page, pageSize, ratingsAvailable }   (published profiles only)
// GET /api/lawyers/:slug -> { lawyer } = card + { bio, qualifications, officeAddress, profileStatus, timezone, slotMinutes,
//   contact:{email?,phone?} (only what the lawyer chose to publish), verification:{status,verifiedAt,license:{issuingBody,validUntil}|null},
//   fixedFeeServices[], cases[] (published only), availability[{weekday,startTime,endTime}], saved }
//   Drafts/suspended profiles are 404 except for their owner and administrators.
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { buildDirectoryQuery } from '../lib/directory.js';
import { CARD_COLUMNS, CARD_FROM, mapCard } from '../lib/lawyerQueries.js';
import { intId, language, pagination } from '../lib/validators.js';
import { notFound, parse } from '../middleware/errors.js';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugParam = (value) => {
  if (typeof value !== 'string' || value.length > 80 || !SLUG_RE.test(value)) throw notFound();
  return value;
};

const directoryQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().regex(SLUG_RE).max(60).optional(),
  location: intId.optional(),
  minExperience: z.coerce.number().int().min(0).max(70).optional(),
  minFee: z.coerce.number().min(0).max(100_000_000).optional(),
  maxFee: z.coerce.number().min(0).max(100_000_000).optional(),
  language: language.optional(),
  available: z.enum(['true', 'false']).optional(),
  verified: z.enum(['true', 'false']).optional(),
  mode: z.enum(['online', 'in_person']).optional(),
  sort: z.enum(['relevance', 'experience', 'fee_asc', 'rating']).default('relevance'),
}).merge(pagination);

const hhmm = (t) => String(t).slice(0, 5);

export default function lawyerRoutes() {
  const router = Router();

  router.get('/', async (req, res) => {
    // Treat empty query-string values (e.g. "?location=") as "not set".
    const cleaned = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== ''));
    const filters = parse(directoryQuery, cleaned);
    const { sql, params } = buildDirectoryQuery(filters);
    const [{ rows }, ratings] = await Promise.all([
      query(sql, params),
      one(`SELECT EXISTS (SELECT 1 FROM reviews r JOIN lawyer_profiles lp ON lp.id = r.lawyer_profile_id
                           WHERE r.status = 'published' AND lp.profile_status = 'published') AS available`),
    ]);
    res.json({
      lawyers: rows.map(mapCard),
      total: rows[0]?.total ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      ratingsAvailable: ratings.available, // "Highest rated" is only offered once genuine reviews exist
    });
  });

  router.get('/:slug', async (req, res) => {
    const slug = slugParam(req.params.slug);
    const row = await one(
      `SELECT ${CARD_COLUMNS}, lp.user_id, lp.bio, lp.qualifications, lp.office_address, lp.public_email, lp.public_phone,
              lp.timezone, lp.slot_minutes, lp.profile_status, lp.verified_at
         ${CARD_FROM}
        WHERE lp.slug = $1`, [slug]);
    if (!row) throw notFound();
    const isOwner = req.user?.id === row.user_id;
    const isAdmin = req.user?.role === 'admin';
    if (row.profile_status !== 'published' && !isOwner && !isAdmin) throw notFound();

    const [fixedFees, cases, license, availability, saved] = await Promise.all([
      query(`SELECT id, title, description, amount FROM lawyer_fixed_fee_services WHERE lawyer_profile_id = $1 ORDER BY sort_order, created_at`, [row.id]),
      query(
        `SELECT ce.id, ce.title, ce.description, ce.lawyer_role, ce.outcome, ce.public_reference, ce.case_year,
                ce.evidence_level, ce.is_demo, c.name AS category_name, c.slug AS category_slug
           FROM case_experience ce JOIN legal_categories c ON c.id = ce.category_id
          WHERE ce.lawyer_profile_id = $1 AND ce.status = 'published'
          ORDER BY ce.case_year DESC, ce.created_at DESC`, [row.id]),
      row.verification_status === 'verified'
        // Only the issuing body and validity are public. The licence number and the document itself never are.
        ? one(`SELECT issuing_body, expires_on FROM professional_credentials
                WHERE lawyer_profile_id = $1 AND credential_type = 'bar_license' AND status = 'verified'
                ORDER BY reviewed_at DESC NULLS LAST LIMIT 1`, [row.id])
        : Promise.resolve(null),
      query(`SELECT weekday, start_time, end_time FROM lawyer_availability WHERE lawyer_profile_id = $1 ORDER BY weekday, start_time`, [row.id]),
      req.user?.role === 'client'
        ? one('SELECT 1 AS yes FROM saved_lawyers WHERE client_id = $1 AND lawyer_profile_id = $2', [req.user.id, row.id])
        : Promise.resolve(null),
    ]);

    const contact = {};
    if (row.public_email) contact.email = row.public_email;
    if (row.public_phone) contact.phone = row.public_phone;

    res.json({
      lawyer: {
        ...mapCard(row),
        bio: row.bio,
        qualifications: row.qualifications,
        officeAddress: row.office_address,
        profileStatus: row.profile_status,
        timezone: row.timezone,
        slotMinutes: row.slot_minutes,
        contact,
        verification: {
          status: row.verification_status,
          verifiedAt: row.verified_at,
          license: license ? { issuingBody: license.issuing_body, validUntil: license.expires_on } : null,
        },
        fixedFeeServices: fixedFees.rows.map((f) => ({ id: f.id, title: f.title, description: f.description, amount: f.amount })),
        cases: cases.rows.map((c) => ({
          id: c.id, title: c.title, description: c.description, lawyerRole: c.lawyer_role, outcome: c.outcome,
          publicReference: c.public_reference, year: c.case_year, evidenceLevel: c.evidence_level, isDemo: c.is_demo,
          category: { name: c.category_name, slug: c.category_slug },
        })),
        availability: availability.rows.map((a) => ({ weekday: a.weekday, startTime: hhmm(a.start_time), endTime: hhmm(a.end_time) })),
        saved: Boolean(saved),
      },
    });
  });

  return router;
}
