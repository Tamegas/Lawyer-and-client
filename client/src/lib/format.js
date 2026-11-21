const toDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) { // a calendar date: never shift it by a time zone
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};
const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());

export function formatMoney(amount, currency = 'ETB') {
  if (amount == null || amount === '' || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
/** A consultation fee, or "Contact for pricing" when the lawyer has not listed one. */
export function formatFee(fee, currency = 'ETB') {
  return fee == null ? 'Contact for pricing' : formatMoney(fee, currency);
}
export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  const d = toDate(value);
  return valid(d) ? new Intl.DateTimeFormat('en-GB', options).format(d) : '—';
}
export function formatTime(value) {
  const d = toDate(value);
  return valid(d) ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d) : '—';
}
export function formatDateTime(value) {
  const d = toDate(value);
  return valid(d) ? `${formatDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, ${formatTime(d)}` : '—';
}
export const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function relativeTime(value, now = new Date()) {
  const d = toDate(value);
  if (!valid(d)) return '';
  const s = Math.round((now - d) / 1000);
  if (Math.abs(s) < 60) return 'just now';
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, secs] of units) {
    if (Math.abs(s) >= secs) {
      const n = Math.round(Math.abs(s) / secs);
      return s > 0 ? `${n} ${unit}${n === 1 ? '' : 's'} ago` : `in ${n} ${unit}${n === 1 ? '' : 's'}`;
    }
  }
  return '';
}
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export function initials(name) {
  const parts = String(name ?? '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function joinList(items) {
  const list = (items ?? []).filter(Boolean);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
/** Drops empty values ('', null, undefined) so an object can be sent as a query string or API body. */
export function compact(obj) {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}
