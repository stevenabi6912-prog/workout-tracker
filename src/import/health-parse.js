// Streaming scanner for Apple Health export.xml. Feed it string chunks of any size; it emits
// each <Record .../> and <Workout>...</Workout> element as a plain object as soon as the
// element is complete. The file is a flat list of these under <HealthData>, so a
// full XML parser is unnecessary and would need the whole file in memory.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
export function unescapeXml(s) {
  return s.indexOf('&') === -1 ? s : s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-fA-F]+);/g, (m, name, dec, hex) => {
    if (name) return ENTITIES[m];
    if (dec) return String.fromCodePoint(+dec);
    return String.fromCodePoint(parseInt(hex, 16));
  });
}

const ATTR_RE = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
export function parseAttrs(tagText) {
  const out = {};
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(tagText))) out[m[1]] = unescapeXml(m[2]);
  return out;
}

// Parse an Apple Health date "2024-01-05 07:12:33 -0500" into epoch ms and a local ISO date.
export function parseHKDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!m) { const t = Date.parse(s); return Number.isNaN(t) ? null : { ms: t, date: s.slice(0, 10) }; }
  const [, y, mo, d, h, mi, se, sign, oh, om] = m;
  const offsetMin = (sign === '-' ? -1 : 1) * (+oh * 60 + +om);
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) - offsetMin * 60000;
  // The local date is the wall-clock date in the recorded offset, which is what the user saw.
  return { ms, date: `${y}-${mo}-${d}` };
}

export function createHealthScanner({ onRecord, onWorkout, onOther } = {}) {
  let buf = '';
  let records = 0, workouts = 0;

  function push(chunk) {
    buf += chunk;
    let pos = 0;
    for (;;) {
      const i = buf.indexOf('<', pos);
      if (i === -1) { pos = buf.length; break; }
      // Need at least a few chars to know what tag this is.
      if (buf.length - i < 12) { pos = i; break; }
      if (buf.startsWith('<Record ', i) || buf.startsWith('<Record\n', i) || buf.startsWith('<Record\t', i)) {
        const end = buf.indexOf('>', i);
        if (end === -1) { pos = i; break; }
        const selfClosing = buf[end - 1] === '/';
        let close = end + 1;
        if (!selfClosing) {
          close = buf.indexOf('</Record>', end);
          if (close === -1) { pos = i; break; }
          close += '</Record>'.length;
        }
        const attrs = parseAttrs(buf.slice(i + 8, selfClosing ? end - 1 : end));
        if (!selfClosing) attrs.__inner = buf.slice(end + 1, close - '</Record>'.length);
        records++;
        onRecord?.(attrs);
        pos = close;
        continue;
      }
      if (buf.startsWith('<Workout ', i)) {
        const end = buf.indexOf('>', i);
        if (end === -1) { pos = i; break; }
        const selfClosing = buf[end - 1] === '/';
        let close = end + 1;
        let inner = '';
        if (!selfClosing) {
          close = buf.indexOf('</Workout>', end);
          if (close === -1) { pos = i; break; }
          inner = buf.slice(end + 1, close);
          close += '</Workout>'.length;
        }
        const attrs = parseAttrs(buf.slice(i + 9, selfClosing ? end - 1 : end));
        attrs.__inner = inner;
        workouts++;
        onWorkout?.(attrs);
        pos = close;
        continue;
      }
      // Some other tag (HealthData, ExportDate, Me, ActivitySummary, Correlation...). Skip past it.
      const end = buf.indexOf('>', i);
      if (end === -1) { pos = i; break; }
      if (onOther && (buf.startsWith('<ExportDate', i) || buf.startsWith('<Me ', i))) onOther(parseAttrs(buf.slice(i, end)));
      pos = end + 1;
    }
    // Keep only the unconsumed tail. Guard against a pathological unclosed element growing forever.
    buf = buf.slice(pos);
    if (buf.length > 8 * 1024 * 1024) buf = buf.slice(buf.length - 1024 * 1024);
  }

  function end() { buf = ''; return { records, workouts }; }
  return { push, end };
}

// Nested WorkoutStatistics inside a <Workout> (iOS 16+ exports put distance/energy/HR here).
const STAT_RE = /<WorkoutStatistics\b([^>]*)\/?>/g;
export function parseWorkoutStatistics(inner) {
  const stats = {};
  if (!inner) return stats;
  STAT_RE.lastIndex = 0;
  let m;
  while ((m = STAT_RE.exec(inner))) {
    const a = parseAttrs(m[1]);
    if (a.type) stats[a.type] = a;
  }
  return stats;
}
