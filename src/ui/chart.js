// Minimal responsive SVG charts. Styled through .chart classes in components.css.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};

function niceTicks(min, max, count = 4) {
  if (max === min) { max = min + 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { ticks, min: start, max: end };
}

export function emptyChart(message = 'No data yet', width = 360, height = 160) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart' });
  svg.append(el('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'empty' }, message));
  return svg;
}

// series: [{ points: [{ x: number(ms) , y }], class }], goal: number|null, fmtY, fmtX
export function lineChart({ series, goal = null, width = 360, height = 180, fmtY = (v) => v, fmtX, yMin = null }) {
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return emptyChart('No data yet', width, height);
  const pad = { l: 40, r: 10, t: 10, b: 24 };
  const w = width - pad.l - pad.r;
  const hgt = height - pad.t - pad.b;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y).concat(goal != null ? [goal] : []);
  let xMin = Math.min(...xs), xMax = Math.max(...xs);
  if (xMax === xMin) { xMin -= 86400000; xMax += 86400000; }
  let lo = yMin != null ? Math.min(yMin, ...ys) : Math.min(...ys);
  let hi = Math.max(...ys);
  if (hi - lo < Math.max(1, Math.abs(hi) * 0.02)) { const pad = Math.max(2, Math.abs(hi) * 0.05); lo -= pad; hi += pad; }
  const { ticks, min: y0, max: y1 } = niceTicks(lo, hi);
  const X = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * w;
  const Y = (y) => pad.t + hgt - ((y - y0) / (y1 - y0)) * hgt;

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img' });
  for (const t of ticks) {
    svg.append(el('line', { x1: pad.l, x2: width - pad.r, y1: Y(t), y2: Y(t), class: 'grid' }));
    svg.append(el('text', { x: pad.l - 6, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' }, fmtY(t)));
  }
  // x labels: first, middle, last
  const labelXs = [xMin, (xMin + xMax) / 2, xMax];
  const fx = fmtX || ((ms) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' }));
  labelXs.forEach((x, i) => svg.append(el('text', { x: X(x), y: height - 6, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle', class: 'tick' }, fx(x))));
  if (goal != null) svg.append(el('line', { x1: pad.l, x2: width - pad.r, y1: Y(goal), y2: Y(goal), class: 'goal' }));
  for (const s of series) {
    const sorted = [...s.points].sort((a, b) => a.x - b.x);
    const d = sorted.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    svg.append(el('path', { d, class: `line ${s.class || ''}` }));
    if (sorted.length <= 60 && !s.noDots) for (const p of sorted) svg.append(el('circle', { cx: X(p.x), cy: Y(p.y), r: 3, class: `dot ${s.class || ''}` }));
  }
  return svg;
}

// bars: [{ label, value, value2? }]
export function barChart({ bars, width = 360, height = 160, fmtY = (v) => v, maxLabels = 8 }) {
  if (!bars.length || bars.every((b) => !b.value)) return emptyChart('No data yet', width, height);
  const pad = { l: 40, r: 6, t: 10, b: 24 };
  const w = width - pad.l - pad.r;
  const hgt = height - pad.t - pad.b;
  const { ticks, max: y1 } = niceTicks(0, Math.max(...bars.map((b) => Math.max(b.value || 0, b.value2 || 0))));
  const Y = (v) => pad.t + hgt - (v / y1) * hgt;
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img' });
  for (const t of ticks) {
    svg.append(el('line', { x1: pad.l, x2: width - pad.r, y1: Y(t), y2: Y(t), class: 'grid' }));
    svg.append(el('text', { x: pad.l - 6, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' }, fmtY(t)));
  }
  const n = bars.length;
  const slot = w / n;
  const bw = Math.max(4, slot * 0.6);
  const every = Math.ceil(n / maxLabels);
  bars.forEach((b, i) => {
    const x = pad.l + i * slot + (slot - bw) / 2;
    if (b.value) svg.append(el('rect', { x, y: Y(b.value), width: bw, height: Y(0) - Y(b.value), rx: 2, class: 'bar' }));
    const lastLabeled = Math.floor((n - 1) / every) * every;
    if (i % every === 0 || (i === n - 1 && i - lastLabeled >= Math.max(2, every / 2))) svg.append(el('text', { x: x + bw / 2, y: height - 6, 'text-anchor': 'middle', class: 'tick' }, b.label));
  });
  return svg;
}
