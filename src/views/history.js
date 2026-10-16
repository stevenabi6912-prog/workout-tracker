import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { pick, confirm, toast } from '../ui/sheet.js';
import * as repo from '../db/repo.js';
import { today, monthStart, addMonths, daysInMonth, parseISODate, fmtMonth, relativeDay, DOW_MIN, addDays, fmtTime } from '../domain/dates.js';
import { workoutSummary } from '../domain/stats.js';
import { fmtDuration, fmtWeight, fmtDistance } from '../domain/units.js';

export async function render(container, ctx) {
  const { profile, navigate } = ctx;
  let selected = ctx.query.date || today();
  let month = monthStart(selected);
  const units = profile.units.weight;

  const [workouts, cardio, bodyweight] = await Promise.all([
    repo.getWorkouts(profile.id), repo.getCardio(profile.id), repo.getBodyweight(profile.id),
  ]);
  const byDate = new Map();
  const add = (d, k, v) => { const o = byDate.get(d) || { workouts: [], cardio: [], bodyweight: [] }; o[k].push(v); byDate.set(d, o); };
  for (const w of workouts) add(w.date, 'workouts', w);
  for (const c of cardio) add(c.date, 'cardio', c);
  for (const b of bodyweight) add(b.date, 'bodyweight', b);

  const calEl = h('div');
  const dayEl = h('div', { style: { marginTop: '16px' } });
  container.append(
    h('div.row.between', { style: { marginBottom: '8px' } },
      h('button.btn.icon.ghost.sm', { onclick: () => { month = addMonths(month, -1); drawCal(); }, 'aria-label': 'Previous month' }, svgIcon(icons.back, 20)),
      h('h1', { style: { fontSize: '17px' } }, ''),
      h('button.btn.icon.ghost.sm', { onclick: () => { month = addMonths(month, 1); drawCal(); }, 'aria-label': 'Next month' }, svgIcon(icons.chevron, 20)),
    ),
    calEl, dayEl,
  );
  drawCal();
  drawDay();

  function drawCal() {
    container.querySelector('h1').textContent = fmtMonth(month);
    clear(calEl);
    const grid = h('div.cal');
    for (const d of ['M', 'T', 'W', 'T', 'F', 'S', 'S']) grid.append(h('div.hd', d));
    const first = parseISODate(month);
    const lead = (first.getDay() + 6) % 7; // Monday start
    const n = daysInMonth(month);
    const t = today();
    for (let i = 0; i < lead; i++) grid.append(h('div'));
    for (let d = 1; d <= n; d++) {
      const iso = `${month.slice(0, 8)}${String(d).padStart(2, '0')}`;
      const data = byDate.get(iso);
      const has = data && (data.workouts.length || data.cardio.length || data.bodyweight.length);
      grid.append(h('button.cell', { class: [has ? 'has' : '', iso === t ? 'today' : '', iso === selected ? 'sel' : '', iso > t ? 'other' : ''].join(' '), onclick: () => { selected = iso; drawCal(); drawDay(); } },
        h('span.n', String(d)),
        h('span.dots',
          data?.workouts.length ? h('i') : null,
          data?.cardio.length ? h('i.cardio') : null,
          data?.bodyweight.length ? h('i.bw') : null,
        ),
      ));
    }
    calEl.append(grid, h('div.row.small.muted', { style: { marginTop: '8px', gap: '14px' } },
      h('span.row', h('i', { style: dot('var(--accent)') }), 'Lifting'), h('span.row', h('i', { style: dot('var(--ok)') }), 'Cardio'), h('span.row', h('i', { style: dot('var(--fg-faint)') }), 'Weigh-in')));
  }

  function dot(bg) { return { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: bg }; }

  function drawDay() {
    clear(dayEl);
    const data = byDate.get(selected) || { workouts: [], cardio: [], bodyweight: [] };
    dayEl.append(h('div.section-title', h('h2', relativeDay(selected)), h('button.btn.sm.ghost', { onclick: addMenu }, svgIcon(icons.plus, 18), 'Add')));
    if (!data.workouts.length && !data.cardio.length && !data.bodyweight.length) {
      dayEl.append(h('div.card', h('div.empty-state', 'Nothing logged this day.')));
      return;
    }
    const list = h('div.card.pad-0', h('div.list'));
    const ul = list.firstChild;
    for (const w of data.workouts) {
      const s = workoutSummary(w);
      ul.append(h('button.list-item', { onclick: () => navigate(`/workout/${w.id}`) },
        h('div.body', h('div.title', `${w.label}${w.status === 'in_progress' ? ' (in progress)' : ''}`), h('div.sub', w.source === 'apple_health' ? `Apple Health · ${fmtDuration(w.durationSec)}${w.avgHr ? ' · ' + w.avgHr + ' bpm' : ''}` : `${s.exercises} exercises · ${s.sets} sets · ${Math.round(s.volume).toLocaleString()} ${units}${s.prs ? ` · ${s.prs} PR` : ''}`)),
        h('div.trail', w.startedAt ? fmtTime(w.startedAt) : '', svgIcon(icons.chevron, 18)),
      ));
    }
    for (const c of data.cardio) {
      ul.append(h('button.list-item', { onclick: () => navigate(`/cardio/${c.id}`) },
        h('div.body', h('div.title', `${cap(c.type)}${c.intervals ? ' intervals' : ''}`), h('div.sub', [fmtDuration(c.durationSec), c.distanceMi ? fmtDistance(c.distanceMi, profile.units.distance) : null, c.avgHr ? `${c.avgHr} bpm` : null, c.source === 'apple_health' ? 'Apple Health' : null].filter(Boolean).join(' · '))),
        h('div.trail', svgIcon(icons.chevron, 18)),
      ));
    }
    for (const b of data.bodyweight) {
      ul.append(h('button.list-item', { onclick: async () => {
        const c = await pick([{ label: 'Delete weigh-in', value: 'del' }], { title: fmtWeight(b.weightLb, units) });
        if (c === 'del') { await repo.deleteBodyweight(b.id); toast('Deleted'); ctx.refresh(); }
      } },
        h('div.body', h('div.title', `Weigh-in · ${fmtWeight(b.weightLb, units)}`), h('div.sub', b.source === 'apple_health' ? 'Apple Health' : 'Logged in app')),
        h('div.trail', svgIcon(icons.chevron, 18)),
      ));
    }
    dayEl.append(list);
  }

  async function addMenu() {
    const c = await pick([
      { label: 'Log a workout for this day', value: 'workout' },
      { label: 'Log cardio', value: 'cardio' },
      { label: 'Log weigh-in', value: 'weight' },
    ], { title: relativeDay(selected) });
    if (c === 'cardio') navigate(`/cardio?date=${selected}`);
    if (c === 'weight') navigate(`/weight?date=${selected}`);
    if (c === 'workout') navigate(`/?start=${selected}`);
  }
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
