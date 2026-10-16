import { weekDates, dayOfWeek, today as todayISO } from './dates.js';

// Compute the plan for a week.
//
// routine: active routine with days[] and rotation[] (routineDay ids)
// trainingDays: JS day-of-week numbers (0 = Sunday)
// plans: explicit overrides for dates ({ date, routineDayId | null })
// workouts: workouts in the window (any status)
// rotationPointer: count of completed rotation workouts so far; upcoming days continue from it
//
// Returns [{ date, kind: 'done'|'in_progress'|'planned'|'rest'|'missed', routineDay, workout, override }]
export function planWeek({ anchor, routine, trainingDays, plans = [], workouts = [], rotationPointer = 0, today = todayISO() }) {
  const dates = weekDates(anchor);
  const overrides = new Map(plans.map((p) => [p.date, p]));
  const byDate = new Map();
  for (const w of workouts) {
    const list = byDate.get(w.date) || [];
    list.push(w);
    byDate.set(w.date, list);
  }
  const dayById = new Map((routine?.days || []).map((d) => [d.id, d]));
  const rotation = routine?.rotation || [];

  // Pass 1: classify days.
  const rows = dates.map((date) => {
    const ws = byDate.get(date) || [];
    const done = ws.find((w) => w.status === 'done');
    const inProgress = ws.find((w) => w.status === 'in_progress');
    const override = overrides.get(date);
    if (done) return { date, kind: 'done', routineDay: dayById.get(done.routineDayId) || null, workout: done, override };
    if (inProgress) return { date, kind: 'in_progress', routineDay: dayById.get(inProgress.routineDayId) || null, workout: inProgress, override };
    const isPast = date < today;
    if (override) {
      if (!override.routineDayId) return { date, kind: 'rest', routineDay: null, override };
      const rd = dayById.get(override.routineDayId) || null;
      return { date, kind: isPast ? 'missed' : 'planned', routineDay: rd, override, fixed: true };
    }
    const isTraining = trainingDays.includes(dayOfWeek(date));
    if (!isTraining) return { date, kind: 'rest', routineDay: null };
    if (isPast) return { date, kind: 'missed', routineDay: null };
    return { date, kind: 'planned', routineDay: null, auto: true };
  });

  // Pass 2: the upcoming rotation sequence covers every planned day (fixed or automatic).
  // Fixed days claim their entry from the sequence; automatic days take what's left in order.
  if (rotation.length) {
    const upcoming = rows.filter((r) => r.kind === 'planned');
    const seq = upcoming.map((_, i) => rotation[(rotationPointer + i) % rotation.length]);
    for (const r of upcoming) {
      if (!r.fixed) continue;
      const idx = seq.indexOf(r.routineDay?.id);
      if (idx >= 0) seq.splice(idx, 1);
    }
    for (const r of upcoming) {
      if (!r.auto) continue;
      r.routineDay = dayById.get(seq.shift()) || null;
    }
  }
  for (const r of rows) { delete r.auto; delete r.fixed; }
  return rows;
}

// Number of completed workouts for this routine whose day is part of the rotation.
export function rotationPointer(routine, workouts) {
  const rot = new Set(routine?.rotation || []);
  return workouts.filter((w) => w.status === 'done' && w.routineId === routine?.id && rot.has(w.routineDayId)).length;
}

// Which rotation day comes next, ignoring the calendar (used by "Start workout" when today is unplanned).
export function nextRotationDay(routine, workouts) {
  if (!routine?.rotation?.length) return null;
  const p = rotationPointer(routine, workouts);
  const id = routine.rotation[p % routine.rotation.length];
  return routine.days.find((d) => d.id === id) || null;
}
