// Time-zone arithmetic built on Intl.DateTimeFormat only (no date library, no dependency).
// Everything here is a pure function of its inputs. Instants are epoch milliseconds (numbers); a "local" value is
// { year, month (1-12), day, hour, minute, second } as a wall clock would show it in some IANA zone.
//
// Daylight saving rules used by zonedTimeToUtc (same as Temporal's "compatible" disambiguation):
//   * a wall-clock time that happens twice (clocks go back) resolves to the FIRST occurrence;
//   * a wall-clock time that never happens (clocks go forward) is moved forward by the length of the gap.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatters = new Map();

function formatterFor(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** True for an IANA zone name this runtime knows (e.g. 'Africa/Addis_Ababa', 'Europe/London'). */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock fields of an instant in a zone. */
export function zonedParts(ms, timeZone) {
  const out = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour === 24 ? 0 : out.hour, minute: out.minute, second: out.second };
}

/** Offset of the zone from UTC at an instant, in milliseconds (Addis Ababa: +10_800_000; New York in July: -14_400_000). */
export function tzOffsetMs(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

const sameLocal = (a, b) => a.year === b.year && a.month === b.month && a.day === b.day
  && a.hour === b.hour && a.minute === b.minute && a.second === b.second;

/** Wall-clock time in a zone -> UTC instant (ms). See the DST rules at the top of this file. */
export function zonedTimeToUtc(local, timeZone) {
  const wanted = { year: local.year, month: local.month, day: local.day, hour: local.hour ?? 0, minute: local.minute ?? 0, second: local.second ?? 0 };
  const asUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute, wanted.second);
  // The offset can only differ from the one in force a day earlier/later if a transition is near, so those two
  // offsets are the only candidates; a candidate is right when it maps back to the same wall-clock fields.
  const before = tzOffsetMs(asUtc - DAY, timeZone);
  const after = tzOffsetMs(asUtc + DAY, timeZone);
  const matches = [];
  for (const offset of new Set([before, after])) {
    const utc = asUtc - offset;
    if (sameLocal(zonedParts(utc, timeZone), wanted)) matches.push(utc);
  }
  if (matches.length > 0) return Math.min(...matches);
  return asUtc - before; // inside a spring-forward gap: use the old offset, which lands after the gap
}

/** Calendar arithmetic on { year, month, day } (no time zone involved). */
export function addDays({ year, month, day }, days) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday ... 6 = Saturday, the numbering used by lawyer_availability.weekday. */
export const weekdayOf = ({ year, month, day }) => new Date(Date.UTC(year, month - 1, day)).getUTCDay();

/** Whole days since 1970-01-01 for a calendar date; handy to compare or count days. */
export const dayNumber = ({ year, month, day }) => Math.round(Date.UTC(year, month - 1, day) / DAY);

const pad = (n, width = 2) => String(n).padStart(width, '0');

/** 'YYYY-MM-DD' of an instant as seen in a zone. */
export function localDateString(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** 'YYYY-MM-DD HH:mm' of an instant as seen in a zone (useful in logs and tests). */
export function formatLocal(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Postgres `time` text ('09:30' or '09:30:00') -> { hour, minute, second }, or null when it is not a time of day. */
export function parseTimeOfDay(value) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] ? Number(m[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Strict ISO-8601 instant WITH an explicit offset ('2026-12-01T06:00:00Z', '...+03:00') -> epoch ms, else null. */
export function parseInstant(value) {
  if (typeof value !== 'string' || !INSTANT_RE.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export const toIso = (ms) => new Date(ms).toISOString();

export const TIME = { MINUTE, HOUR, DAY };
