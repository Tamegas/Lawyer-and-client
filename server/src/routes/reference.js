// GET /api/reference  (public)  -> { categories, locations, languages, helpTypes, consultPreferences, modes, feeTypes, currencies, limits }
// Active categories and locations only. Reference data is data: another country is just more rows.
import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { ALLOWED_TYPES } from '../lib/credentialFile.js';
import { CONSULT_MODES, CONSULT_PREFERENCES, CURRENCIES, FEE_TYPES, HELP_TYPES, LANGUAGES } from '../lib/reference.js';

export default function referenceRoutes() {
  const router = Router();
  router.get('/', async (req, res) => {
    const [cats, locs] = await Promise.all([
      query('SELECT id, name, slug, description FROM legal_categories WHERE is_active ORDER BY sort_order, name'),
      query('SELECT id, name, region, country_code FROM locations WHERE is_active ORDER BY sort_order, name'),
    ]);
    res.json({
      categories: cats.rows,
      locations: locs.rows.map((l) => ({ id: l.id, name: l.name, region: l.region, countryCode: l.country_code })),
      languages: LANGUAGES,
      helpTypes: HELP_TYPES,
      consultPreferences: CONSULT_PREFERENCES,
      modes: CONSULT_MODES,
      feeTypes: FEE_TYPES,
      currencies: CURRENCIES,
      limits: {
        maxUploadMb: Math.round(config.maxUploadBytes / 1024 / 1024),
        allowedUploadTypes: ALLOWED_TYPES.map((t) => t.label),
        appointmentMinNoticeHours: config.appointmentMinNoticeHours,
        appointmentHorizonDays: config.appointmentHorizonDays,
        requireVerificationToPublish: config.requireVerificationToPublish,
        deletedAccountRetentionDays: config.deletedAccountRetentionDays,
      },
    });
  });
  return router;
}
