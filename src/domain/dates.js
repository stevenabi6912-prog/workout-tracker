// Dates are stored as local ISO calendar dates: 'YYYY-MM-DD'.
export function toISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function today() { return toISODate(new Date()); }

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
// 0 = Sunday ... 6 = Saturday (JS convention)
export function dayOfWeek(iso) { return parseISODate(iso).getDay(); }

// Monday-start week containing iso
export function weekStart(iso) {
  const dow = dayOfWeek(iso);
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}
export function weekDates(iso) {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function monthStart(iso) { return iso.slice(0, 7) + '-01'; }
export function addMonths(iso, n) {
  const d = parseISODate(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISODate(d);
}
export function daysInMonth(iso) {
  const d = parseISODate(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_MIN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso, { weekday = false, year = false } = {}) {
  const d = parseISODate(iso);
  let s = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (weekday) s = `${DOW_SHORT[d.getDay()]}, ${s}`;
  if (year) s += `, ${d.getFullYear()}`;
  return s;
}
export function fmtMonth(iso) {
  const d = parseISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtMonthShort(iso) {
  const d = parseISODate(iso);
  return MONTHS[d.getMonth()];
}
export function relativeDay(iso) {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  return fmtDate(iso, { weekday: true });
}
export function fmtTime(isoTs) {
  const d = new Date(isoTs);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
