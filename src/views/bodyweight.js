import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { toast, confirm } from '../ui/sheet.js';
import * as repo from '../db/repo.js';
import { lineChart } from '../ui/chart.js';
import { today, fmtDate, parseISODate, addDays, relativeDay } from '../domain/dates.js';
import { fmtWeight, toDisplayWeight, fromDisplayWeight, round } from '../domain/units.js';

export async function render(container, ctx) {
  const { profile, navigate } = ctx;
  const units = profile.units.weight;
  let range = 90;
  const rows = await repo.getBodyweight(profile.id);
  const latest = rows[rows.length - 1] || null;
  const goal = profile.goalWeightLb;

  const dateInput = h('input.input', { type: 'date', value: ctx.query.date || today() });
  const weightInput = h('input.input.num', { type: 'text', inputmode: 'decimal', placeholder: latest ? fmtWeight(latest.weightLb, units, { unit: false }) : '—', onfocus: (e) => e.target.select() });
  const chartEl = h('div');
  const listEl = h('div');

  container.append(
    h('div.stats',
      h('div.stat', h('div.k', 'Current'), h('div.v', latest ? fmtWeight(latest.weightLb, units) : '—')),
      h('div.stat', h('div.k', 'Goal'), h('div.v', goal ? fmtWeight(goal, units) : '—')),
      h('div.stat', h('div.k', 'To go'), h('div.v', latest && goal ? fmtWeight(Math.max(0, latest.weightLb - goal), units) : '—')),
    ),
    h('div.card', { style: { marginTop: '12px' } },
      h('form.stack', { onsubmit: async (e) => { e.preventDefault(); await logWeight(); } },
        h('div.grid-2', h('div.field', h('label', `Weight (${units})`), weightInput), h('div.field', h('label', 'Date'), dateInput)),
        h('button.btn.primary.block', { type: 'submit' }, 'Log weigh-in'),
      ),
    ),
    h('div.card', { style: { marginTop: '12px' } },
      h('div.row.between', { style: { marginBottom: '8px' } },
        h('div.card-title', 'Trend'),
        h('div.chips', [30, 90, 365, 0].map((r) => h('button.chip', { class: r === range ? 'on' : '', style: { minHeight: '34px', padding: '0 10px' }, onclick: () => { range = r; drawChart(); } }, r ? `${r}d` : 'All'))),
      ),
      chartEl,
      goal ? h('p.note', { style: { marginTop: '6px' } }, `Dashed line is your goal of ${fmtWeight(goal, units)}. 7-day average in gray.`) : h('p.note', { style: { marginTop: '6px' } }, 'Set a goal weight under More → Settings to see it on the chart.'),
    ),
    listEl,
  );
  drawChart();
  drawList();

  async function logWeight() {
    const lb = fromDisplayWeight(weightInput.value, units);
    if (!lb || lb < 50 || lb > 1000) { toast('Enter a weight'); return; }
    await repo.saveBodyweight({ id: repo.uid(), profileId: profile.id, date: dateInput.value || today(), at: new Date().toISOString(), weightLb: round(lb, 1), source: 'app', externalId: null });
    toast('Weigh-in logged');
    ctx.refresh();
  }

  function drawChart() {
    clear(chartEl);
    const from = range ? addDays(today(), -range) : '0000';
    const pts = rows.filter((r) => r.date >= from).map((r) => ({ x: parseISODate(r.date).getTime(), y: toDisplayWeight(r.weightLb, units) }));
    // 7-day rolling average
    const avg = [];
    for (let i = 0; i < pts.length; i++) {
      const windowStart = pts[i].x - 7 * 86400000;
      const w = pts.filter((p) => p.x > windowStart && p.x <= pts[i].x);
      avg.push({ x: pts[i].x, y: w.reduce((a, p) => a + p.y, 0) / w.length });
    }
    chartEl.append(lineChart({
      series: [{ points: pts }, ...(pts.length > 7 ? [{ points: avg, class: 'secondary', noDots: true }] : [])],
      goal: goal ? toDisplayWeight(goal, units) : null,
      fmtY: (v) => Math.round(v),
    }));
  }

  function drawList() {
    clear(listEl);
    const recent = [...rows].reverse().slice(0, 14);
    if (!recent.length) return;
    listEl.append(h('div.section-title', { style: { marginTop: '16px' } }, h('h2', 'Recent')),
      h('div.card.pad-0', h('div.list', recent.map((r) => h('div.list-item.static',
        h('div.body', h('div.title', fmtWeight(r.weightLb, units)), h('div.sub', `${relativeDay(r.date)}${r.source === 'apple_health' ? ' · Apple Health' : ''}`)),
        h('button.btn.icon.ghost.sm', { 'aria-label': 'Delete', onclick: async () => { if (await confirm('Delete this weigh-in?', { okLabel: 'Delete', danger: true })) { await repo.deleteBodyweight(r.id); ctx.refresh(); } } }, svgIcon(icons.trash, 18)),
      )))));
  }
}
