import { weekStart } from './dates.js';
import { e1rm } from './prs.js';

export function setVolume(s) {
  if (!s.done || !s.reps || s.weightLb == null) return 0;
  return s.weightLb * s.reps;
}

export function workoutVolume(w) {
  let v = 0;
  for (const e of w.entries || []) for (const s of e.sets || []) v += setVolume(s);
  return v;
}

export function workoutSummary(w) {
  let sets = 0, reps = 0, volume = 0, prs = 0;
  for (const e of w.entries || []) for (const s of e.sets || []) {
    if (!s.done) continue;
    sets++; reps += s.reps || 0; volume += setVolume(s); if (s.pr) prs++;
  }
  return { sets, reps, volume, prs, exercises: (w.entries || []).length };
}

// Per-exercise series over time: [{ date, topWeight, e1rm, volume }]
export function exerciseSeries(workouts, exerciseId) {
  const out = [];
  for (const w of workouts) {
    if (w.status !== 'done') continue;
    for (const e of w.entries || []) {
      if (e.exerciseId !== exerciseId) continue;
      const sets = (e.sets || []).filter((s) => s.done && s.reps && s.weightLb != null);
      if (!sets.length) continue;
      const topWeight = Math.max(...sets.map((s) => s.weightLb));
      const best = Math.max(...sets.map((s) => e1rm(s.weightLb, s.reps)));
      out.push({ date: w.date, topWeight, e1rm: best, volume: sets.reduce((a, s) => a + setVolume(s), 0), workoutId: w.id });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Group by Monday-start week. Returns sorted [{ week, ...agg }]
export function weeklyAggregate(items, dateOf, reduce, init) {
  const map = new Map();
  for (const it of items) {
    const wk = weekStart(dateOf(it));
    map.set(wk, reduce(map.get(wk) ?? init(), it));
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, agg]) => ({ week, ...agg }));
}

export function weeklyLifting(workouts) {
  return weeklyAggregate(
    workouts.filter((w) => w.status === 'done'),
    (w) => w.date,
    (acc, w) => ({ workouts: acc.workouts + 1, volume: acc.volume + workoutVolume(w) }),
    () => ({ workouts: 0, volume: 0 }),
  );
}

export function weeklyCardio(cardio) {
  return weeklyAggregate(
    cardio,
    (c) => c.date,
    (acc, c) => ({ sessions: acc.sessions + 1, minutes: acc.minutes + (c.durationSec || 0) / 60, miles: acc.miles + (c.distanceMi || 0) }),
    () => ({ sessions: 0, minutes: 0, miles: 0 }),
  );
}

// Fill in missing weeks between first and last so bars are evenly spaced.
export function fillWeeks(rows, lastWeek, count, init) {
  const byWeek = new Map(rows.map((r) => [r.week, r]));
  const out = [];
  let wk = lastWeek;
  for (let i = 0; i < count; i++) {
    out.unshift(byWeek.get(wk) || { week: wk, ...init() });
    const d = new Date(wk + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    wk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return out;
}
