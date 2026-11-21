// Appointment slot generation. Pure: no database, no clock of its own (the caller passes `now`).
//
// A lawyer publishes WEEKLY availability as wall-clock ranges in their own time zone (lawyer_availability:
// weekday 0 = Sunday, start_time, end_time) and a slot length (slot_minutes). Concrete slots are computed, never stored:
//   * every range is expanded for each calendar day of the lawyer's zone inside the horizon;
//   * slots are laid end to end from the start of the range, in real elapsed time (a range that spans a DST change
//     still gets slots of exactly slot_minutes each, and no slot overlaps another);
//   * a slot is offered only if it starts at least `minNoticeHours` after `now` and before `now + horizonDays`;
//   * slots that overlap a requested/confirmed appointment (`busy`) are removed.
// The result is sorted by start time; `startsAt` / `endsAt` are UTC ISO strings.

import { addDays, dayNumber, parseTimeOfDay, TIME, toIso, weekdayOf, zonedParts, zonedTimeToUtc, isValidTimeZone } from './time.js';

export const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa';
const MAX_HORIZON_DAYS = 366;

const toMs = (value) => (value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : value);

/** The lawyer's zone if it is a zone this runtime knows, otherwise the platform default (a bad row must not 500). */
export const safeTimeZone = (timeZone) => (isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE);

/** Half-open interval overlap: [aStart, aEnd) with [bStart, bEnd). Back-to-back appointments do not overlap. */
export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * @param {object} o
 * @param {{weekday:number,startTime:string,endTime:string}[]} o.availability  weekly ranges (times as 'HH:MM' or 'HH:MM:SS')
 * @param {string} o.timezone       IANA zone of the lawyer
 * @param {number} o.slotMinutes    slot length
 * @param {number|Date} [o.now]     the current instant
 * @param {number} [o.minNoticeHours]
 * @param {number} [o.horizonDays]
 * @param {{start:number|Date|string,end:number|Date|string}[]} [o.busy]  intervals that are already taken
 * @returns {{startsAt:string,endsAt:string}[]}
 */
export function generateSlots({ availability, timezone, slotMinutes, now = Date.now(), minNoticeHours = 12, horizonDays = 30, busy = [] }) {
  const zone = safeTimeZone(timezone);
  const nowMs = toMs(now);
  const slotMs = Math.max(1, Math.floor(slotMinutes)) * TIME.MINUTE;
  const horizon = Math.min(Math.max(0, Math.floor(horizonDays)), MAX_HORIZON_DAYS);
  const earliest = nowMs + Math.max(0, minNoticeHours) * TIME.HOUR;
  const latest = nowMs + horizon * TIME.DAY;
  if (!Array.isArray(availability) || availability.length === 0 || !(latest > earliest)) return [];

  const ranges = availability
    .map((r) => ({ weekday: Number(r.weekday), start: parseTimeOfDay(r.startTime), end: parseTimeOfDay(r.endTime) }))
    .filter((r) => Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6 && r.start && r.end);

  const byStart = new Map();
  const firstDay = zonedParts(nowMs, zone);
  const lastDayNumber = dayNumber(zonedParts(latest, zone));
  for (let day = { year: firstDay.year, month: firstDay.month, day: firstDay.day }; dayNumber(day) <= lastDayNumber; day = addDays(day, 1)) {
    const weekday = weekdayOf(day);
    for (const range of ranges) {
      if (range.weekday !== weekday) continue;
      const rangeStart = zonedTimeToUtc({ ...day, ...range.start }, zone);
      const rangeEnd = zonedTimeToUtc({ ...day, ...range.end }, zone);
      for (let start = rangeStart; start + slotMs <= rangeEnd; start += slotMs) {
        if (start >= earliest && start < latest) byStart.set(start, start + slotMs);
      }
    }
  }

  const slots = [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, end]) => ({ startsAt: toIso(start), endsAt: toIso(end) }));
  return excludeBusy(slots, busy);
}

/** Remove the slots that overlap any busy interval. */
export function excludeBusy(slots, busy = []) {
  if (!busy.length) return slots;
  const intervals = busy.map((b) => [toMs(b.start), toMs(b.end)]);
  return slots.filter((s) => {
    const start = Date.parse(s.startsAt);
    const end = Date.parse(s.endsAt);
    return !intervals.some(([bs, be]) => overlaps(start, end, bs, be));
  });
}

/** The slot that starts exactly at `startsAtMs`, or undefined. */
export const findSlot = (slots, startsAtMs) => slots.find((s) => Date.parse(s.startsAt) === startsAtMs);
