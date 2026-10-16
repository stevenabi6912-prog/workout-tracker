export const LB_PER_KG = 2.2046226218;
export const MI_PER_KM = 0.6213711922;

export function toDisplayWeight(lb, units) {
  if (lb == null || Number.isNaN(lb)) return null;
  return units === 'kg' ? lb / LB_PER_KG : lb;
}
export function fromDisplayWeight(value, units) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return null;
  const v = Number(value);
  return units === 'kg' ? v * LB_PER_KG : v;
}
export function toDisplayDistance(mi, units) {
  if (mi == null || Number.isNaN(mi)) return null;
  return units === 'km' ? mi / MI_PER_KM : mi;
}
export function fromDisplayDistance(value, units) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return null;
  const v = Number(value);
  return units === 'km' ? v * MI_PER_KM : v;
}

export function fmtWeight(lb, units = 'lb', { unit = true } = {}) {
  const v = toDisplayWeight(lb, units);
  if (v == null) return '—';
  const s = round(v, units === 'kg' ? 1 : 1).toString();
  return unit ? `${s} ${units}` : s;
}
export function fmtDistance(mi, units = 'mi', { unit = true } = {}) {
  const v = toDisplayDistance(mi, units);
  if (v == null) return '—';
  const s = round(v, 2).toString();
  return unit ? `${s} ${units}` : s;
}
export function fmtDuration(sec) {
  if (sec == null) return '—';
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const hh = Math.floor(m / 60);
    return `${hh}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function round(v, dp = 1) {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
// Round to the nearest plate-friendly step (2.5 lb by default).
export function roundToStep(v, step = 2.5) {
  return Math.round(v / step) * step;
}
