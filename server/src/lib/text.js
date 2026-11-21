/** URL-safe slug: lowercase ascii letters, digits and single hyphens. */
export function slugify(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** "Meron Alemu Tesfaye" -> "Meron A." (used where a full name is not needed). */
export function shortName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

/** Escape % _ \ so user text can be used inside ILIKE '%...%' literally. */
export function escapeLike(input) {
  return String(input ?? '').replace(/[\\%_]/g, (c) => `\\${c}`);
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /(https?:\/\/|www\.)\S+/i;
const PHONE_RE = /(?:\+?\d[\s().-]*){8,}/;

/** True when free text seems to contain an email address, a web link or a phone number (not allowed in reviews). */
export function containsContactDetails(input) {
  const s = String(input ?? '');
  return EMAIL_RE.test(s) || URL_RE.test(s) || PHONE_RE.test(s);
}
