import { z } from 'zod';

// Shared zod building blocks. Optional values normalise to `null` (never '' or undefined) so they can go
// straight into SQL parameters.

const blankToNull = (v) => (v === '' || v === undefined ? null : v);

/** Required trimmed text with friendly length messages. */
export const text = (min, max, label = 'This field') =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

/** Optional trimmed text; '' / missing -> null. */
export const optText = (max, label = 'This field') =>
  z.preprocess(blankToNull, z.string({ invalid_type_error: `${label} must be text` }).trim().max(max, `${label} must be at most ${max} characters`).nullable())
    .transform((v) => (v === '' ? null : v));

const amount = z.union([z.number(), z.string()], { errorMap: () => ({ message: 'Enter a valid amount' }) })
  .transform((v) => (typeof v === 'string' ? Number(v.trim().replace(/,/g, '')) : v))
  .refine((n) => Number.isFinite(n), 'Enter a valid amount')
  .refine((n) => n >= 0, 'The amount cannot be negative')
  .refine((n) => n <= 1_000_000_000, 'The amount is too large')
  .transform((n) => Math.round(n * 100) / 100);

/** Money amount >= 0, rounded to 2 decimals. Accepts 1500, "1500", "1,500.50". */
export const money = amount;
export const optMoney = z.preprocess(blankToNull, amount.nullable());

const isRealDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
/** Calendar date as 'YYYY-MM-DD'. */
export const isoDate = z.string({ required_error: 'Date is required', invalid_type_error: 'Enter a valid date' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine(isRealDate, 'Enter a real calendar date');
export const optIsoDate = z.preprocess(blankToNull, isoDate.nullable());

/** Integer primary keys of reference tables (categories, locations). */
export const intId = z.coerce.number({ invalid_type_error: 'Choose an option' }).int('Choose an option').positive('Choose an option');
export const optIntId = z.preprocess(blankToNull, intId.nullable());

export const language = z.string().trim().min(2, 'Enter a language').max(40, 'Language name is too long');
export const optLanguage = z.preprocess(blankToNull, language.nullable());

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const email = z.string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address');
