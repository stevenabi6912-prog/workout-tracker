import { h, clear } from '../ui/dom.js';
import { pickExercise } from '../ui/exercisePicker.js';
import * as repo from '../db/repo.js';
import { lineChart, barChart } from '../ui/chart.js';
import { exerciseSeries, weeklyLifting, weeklyCardio, fillWeeks } from '../domain/stats.js';
import { today, weekStart, parseISODate, fmtMonthShort, addDays } from '../domain/dates.js';
import { toDisplayWeight, toDisplayDistance, fmtWeight } from '../domain/units.js';

export async function render(container, ctx) {
  const { profile } = ctx;
  const units = profile.units.weight;
  const dunits = profile.units.distance;
  const [workouts, cardio, exercises] = await Promise.all([repo.getWorkouts(profile.id), repo.getCardio(profile.id), repo.getExercises(profile.id)]);
  const done = workouts.filter((w) => w.status === 'done');
  const exById = new Map(exercises.map((e) => [e.id, e]));

  // Exercises with history, most recent first
  const seen = new Map();
  for (const w of [...done].sort((a, b) => b.date.localeCompare(a.date))) for (const e of w.entries || []) if (!seen.has(e.exerciseId) && e.sets?.some((s) => s.done)) seen.set(e.exerciseId, w.date);
  const withHistory = [...seen.keys()].map((id) => exById.get(id)).filter(Boolean);
  let exerciseId = localStorage.getItem('wt:progressExercise');
  if (!seen.has(exerciseId)) exerciseId = withHistory[0]?.id || null;
  let metric = 'topWeight';
  let weeks = 12;

  const exCard = h('div.card');
  const weeklyEl = h('div.stack', { style: { marginTop: '12px' } });
  container.append(exCard, weeklyEl);
  drawExercise();
  drawWeekly();

  function drawExercise() {
    clear(exCard);
    const ex = exById.get(exerciseId);
    exCard.append(h('div.row.between', { style: { marginBottom: '8px' } },
      h('div.card-title', 'Exercise'),
      h('button.btn.sm', { onclick: async () => { const p = await pickExercise(withHistory.length ? withHistory : exercises, { title: 'Exercise', allowCreate: false }); if (p) { exerciseId = p.id; localStorage.setItem('wt:progressExercise', p.id); drawExercise(); } } }, ex ? ex.name : 'Choose'),
    ));
    if (!ex) { exCard.append(h('div.empty-state', 'Finish a workout to see per-exercise progress.')); return; }
    const series = exerciseSeries(done, ex.id);
    const metrics = [['topWeight', 'Top set'], ['e1rm', 'Est. 1RM'], ['volume', 'Volume']];
    exCard.append(h('div.chips', { style: { marginBottom: '8px' } }, metrics.map(([k, label]) => h('button.chip', { class: metric === k ? 'on' : '', style: { minHeight: '34px', padding: '0 10px' }, onclick: () => { metric = k; drawExercise(); } }, label))));
    const pts = series.map((p) => ({ x: parseISODate(p.date).getTime(), y: metric === 'volume' ? toDisplayWeight(p[metric], units) : toDisplayWeight(p[metric], units) }));
    exCard.append(lineChart({ series: [{ points: pts }], fmtY: (v) => metric === 'volume' ? fmtK(v) : Math.round(v) }));
    const last = series[series.length - 1];
    const best = series.reduce((a, p) => Math.max(a, p.e1rm), 0);
    exCard.append(h('div.stats', { style: { marginTop: '10px' } },
      h('div.stat', h('div.k', 'Sessions'), h('div.v', String(series.length))),
      h('div.stat', h('div.k', 'Last top set'), h('div.v', last ? fmtWeight(last.topWeight, units, { unit: false }) : '—')),
      h('div.stat', h('div.k', 'Best est. 1RM'), h('div.v', best ? fmtWeight(best, units, { unit: false }) : '—')),
    ));
  }

  function drawWeekly() {
    clear(weeklyEl);
    const thisWeek = weekStart(today());
    const lift = fillWeeks(weeklyLifting(done), thisWeek, weeks, () => ({ workouts: 0, volume: 0 }));
    const card = fillWeeks(weeklyCardio(cardio), thisWeek, weeks, () => ({ sessions: 0, minutes: 0, miles: 0 }));
    const label = (w) => { const d = parseISODate(w); return `${fmtMonthShort(w)} ${d.getDate()}`; };
    const rangeChips = h('div.chips', [8, 12, 26, 52].map((n) => h('button.chip', { class: n === weeks ? 'on' : '', style: { minHeight: '34px', padding: '0 10px' }, onclick: () => { weeks = n; drawWeekly(); } }, `${n}w`)));
    const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
    weeklyEl.append(
      h('div.row.between', h('div.section-title', { style: { margin: 0 } }, h('h2', 'Weekly')), rangeChips),
      h('div.stats',
        h('div.stat', h('div.k', 'Workouts'), h('div.v', String(sum(lift, 'workouts')))),
        h('div.stat', h('div.k', 'Cardio min'), h('div.v', String(Math.round(sum(card, 'minutes'))))),
        h('div.stat', h('div.k', `Cardio ${dunits}`), h('div.v', toDisplayDistance(sum(card, 'miles'), dunits).toFixed(1))),
      ),
      chartCard('Workouts per week', barChart({ bars: lift.map((r) => ({ label: label(r.week), value: r.workouts })), height: 140 })),
      chartCard(`Lifting volume per week (${units})`, barChart({ bars: lift.map((r) => ({ label: label(r.week), value: toDisplayWeight(r.volume, units) })), fmtY: fmtK, height: 140 })),
      chartCard('Cardio minutes per week', barChart({ bars: card.map((r) => ({ label: label(r.week), value: Math.round(r.minutes) })), height: 140 })),
      chartCard(`Cardio ${dunits} per week`, barChart({ bars: card.map((r) => ({ label: label(r.week), value: +toDisplayDistance(r.miles, dunits).toFixed(2) })), height: 140 })),
    );
  }

  function chartCard(title, chart) { return h('div.card', h('div.card-title', { style: { marginBottom: '6px' } }, title), chart); }
}
const fmtK = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));
