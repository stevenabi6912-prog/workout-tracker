import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { sheet, pick, toast, confirm } from '../ui/sheet.js';
import * as repo from '../db/repo.js';
import { planWeek, rotationPointer, nextRotationDay } from '../domain/schedule.js';
import { today, weekDates, addDays, fmtDate, relativeDay, DOW_SHORT, parseISODate } from '../domain/dates.js';
import { previewDay, startWorkout, startBlankWorkout, sortDesc } from '../domain/session.js';
import { fmtWeight } from '../domain/units.js';
import { workoutSummary } from '../domain/stats.js';

export async function render(container, ctx) {
  const { profile, navigate } = ctx;
  let anchor = ctx.query.week || today();
  const units = profile.units.weight;

  const [routines, exercises, allWorkouts, inProgress] = await Promise.all([
    repo.getRoutines(profile.id),
    repo.getExercises(profile.id),
    repo.getWorkouts(profile.id),
    repo.getInProgressWorkout(profile.id),
  ]);
  const routine = routines.find((r) => r.id === profile.settings.activeRoutineId) || routines[0] || null;
  const workoutsDesc = sortDesc(allWorkouts);
  const exById = new Map(exercises.map((e) => [e.id, e]));

  async function draw() {
    clear(container);
    const dates = weekDates(anchor);
    const plans = await repo.getPlans(profile.id, dates[0], dates[6]);
    const weekWorkouts = allWorkouts.filter((w) => w.date >= dates[0] && w.date <= dates[6]);
    const pointer = rotationPointer(routine, allWorkouts);
    const plan = planWeek({ anchor, routine, trainingDays: profile.settings.trainingDays, plans, workouts: weekWorkouts, rotationPointer: pointer });
    const t = today();
    const todayRow = plan.find((p) => p.date === t);

    // Week header
    container.append(
      h('div.row.between', { style: { marginBottom: '8px' } },
        h('button.btn.icon.ghost.sm', { onclick: () => { anchor = addDays(anchor, -7); draw(); }, 'aria-label': 'Previous week' }, svgIcon(icons.back, 20)),
        h('button.btn.ghost.sm', { onclick: () => { anchor = t; draw(); } }, weekLabel(dates)),
        h('button.btn.icon.ghost.sm', { onclick: () => { anchor = addDays(anchor, 7); draw(); }, 'aria-label': 'Next week' }, svgIcon(icons.chevron, 20)),
      ),
      h('div.week', plan.map((row) => dayCell(row, t))),
      h('p.note', { style: { marginTop: '8px' } }, 'Tap a day to start, move, or change its workout.'),
    );

    // In-progress
    if (inProgress) {
      container.append(h('div.card.accent', { style: { marginTop: '16px' } },
        h('div.row.between',
          h('div', h('div.card-title', `${inProgress.label} in progress`), h('div.small.muted', `${relativeDay(inProgress.date)} · ${workoutSummary(inProgress).sets} sets done`)),
          h('button.btn.primary', { onclick: () => navigate(`/workout/${inProgress.id}`) }, 'Resume'),
        ),
      ));
    }

    // Today's card
    const todayCard = h('div.card', { style: { marginTop: '16px' } });
    if (!inProgress && todayRow) await fillTodayCard(todayCard, todayRow);
    if (!inProgress) container.append(todayCard);

    // Start anything
    container.append(
      h('div.stack', { style: { marginTop: '16px' } },
        h('button.btn.block', { onclick: () => startAny() }, 'Start any workout'),
        h('button.btn.block', { onclick: () => navigate('/cardio?date=' + t) }, 'Log cardio'),
      ),
    );
  }

  function weekLabel(dates) {
    const a = parseISODate(dates[0]); const b = parseISODate(dates[6]);
    const sameMonth = a.getMonth() === b.getMonth();
    return sameMonth ? `${fmtDate(dates[0])} – ${b.getDate()}` : `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`;
  }

  function dayCell(row, t) {
    const d = parseISODate(row.date);
    const cls = ['day', row.kind, row.date === t ? 'today' : ''].join(' ');
    let tag = '';
    if (row.kind === 'done') tag = (row.routineDay?.label || row.workout.label || 'Done');
    else if (row.kind === 'in_progress') tag = 'Active';
    else if (row.kind === 'planned') tag = row.routineDay?.label || 'Workout';
    else if (row.kind === 'missed') tag = row.routineDay ? row.routineDay.label : 'Missed';
    else tag = 'Rest';
    return h('button', { class: cls, onclick: () => dayMenu(row) },
      h('span.dow', DOW_SHORT[d.getDay()]),
      h('span.dom', d.getDate()),
      h('span.tag', shortLabel(tag)),
      row.kind === 'done' ? svgIcon(icons.check, 14) : null,
    );
  }

  function shortLabel(s) {
    return s.replace('Full Body ', 'FB ').replace('Upper ', 'Up ').replace('Lower ', 'Low ').replace('Conditioning', 'Cond.');
  }

  async function fillTodayCard(card, row) {
    clear(card);
    if (row.kind === 'done') {
      card.append(
        h('div.card-title', `${row.routineDay?.label || row.workout.label} done`),
        h('div.small.muted', summaryLine(row.workout)),
        h('div.row', { style: { marginTop: '10px' } },
          h('button.btn.grow', { onclick: () => navigate(`/workout/${row.workout.id}`) }, 'View'),
          h('button.btn.grow', { onclick: () => startAny() }, 'Start another'),
        ),
      );
      return;
    }
    const rd = row.routineDay;
    if (!rd) {
      card.append(
        h('div.card-title', 'Rest day'),
        h('div.small.muted', routine ? `Next up: ${nextRotationDay(routine, allWorkouts)?.label || '—'}` : 'No active routine. Set one up under More → Routines.'),
      );
      if (routine) card.append(h('button.btn.block', { style: { marginTop: '10px' }, onclick: () => { const d = nextRotationDay(routine, allWorkouts); if (d) beginWorkout(routine, d, today()); } }, `Do ${nextRotationDay(routine, allWorkouts)?.label || 'next workout'} today`));
      return;
    }
    const preview = previewDay({ routineDay: rd, exercises, workoutsDesc, settings: profile.settings });
    const accepted = new Set(preview.filter((p) => p.suggestion?.kind === 'increase').map((p) => p.slot.id));
    card.append(
      h('div.row.between',
        h('div', h('div.card-title', `Today: ${rd.label}`), h('div.small.muted', `${rd.slots.length} exercises · ${estimateMinutes(rd)} min`)),
        h('button.btn.primary', { onclick: () => beginWorkout(routine, rd, today(), accepted) }, 'Start'),
      ),
    );
    const list = h('div.list', { style: { marginTop: '10px' } });
    for (const p of preview) {
      const s = p.suggestion;
      let trail;
      if (!s) trail = h('span.small.faint', 'First time');
      else if (s.kind === 'increase') {
        const chip = h('button.chip.on', { onclick: () => { if (accepted.has(p.slot.id)) { accepted.delete(p.slot.id); chip.classList.remove('on'); chip.textContent = `Keep ${fmtWeight(s.fromLb, units, { unit: false })}`; } else { accepted.add(p.slot.id); chip.classList.add('on'); chip.textContent = `→ ${fmtWeight(s.toLb, units, { unit: false })}`; } } }, `→ ${fmtWeight(s.toLb, units, { unit: false })}`);
        trail = chip;
      } else trail = h('span.small.muted', fmtWeight(s.fromLb, units, { unit: false }));
      list.append(h('div.list-item.static',
        h('div.body', h('div.title', p.exercise?.name || 'Exercise'), h('div.sub', `${p.slot.sets} × ${p.slot.repMin}–${p.slot.repMax}${s ? ' · ' + s.reason : ''}`)),
        h('div.trail', trail),
      ));
    }
    card.append(list);
    if (rd.finisher) card.append(h('p.note', { style: { marginTop: '8px' } }, 'Finisher: ' + finisherLabel(rd.finisher)));
  }

  function summaryLine(w) {
    const s = workoutSummary(w);
    return `${s.exercises} exercises · ${s.sets} sets · ${Math.round(s.volume).toLocaleString()} ${units} volume${s.prs ? ` · ${s.prs} PR` : ''}`;
  }

  async function dayMenu(row) {
    const label = relativeDay(row.date);
    const t = today();
    const items = [];
    if (row.kind === 'done' || row.kind === 'in_progress') items.push({ label: row.kind === 'done' ? 'View workout' : 'Resume workout', value: 'view' });
    if (row.kind !== 'done' && row.kind !== 'in_progress') {
      if (row.routineDay && row.date >= t) items.push({ label: `Start ${row.routineDay.label}${row.date !== t ? ' today' : ''}`, sub: row.date !== t ? 'Logs it for today' : null, value: 'start' });
      if (row.routineDay) items.push({ label: 'Move to another day', value: 'move' });
      items.push({ label: 'Change workout', sub: 'Pick a different day of the routine', value: 'change' });
      if (row.kind !== 'rest') items.push({ label: 'Make it a rest day', value: 'rest' });
      if (row.override) items.push({ label: 'Reset to default schedule', value: 'reset' });
    }
    items.push({ label: 'Log cardio for this day', value: 'cardio' });
    const choice = await pick(items, { title: `${label}${row.routineDay ? ' · ' + row.routineDay.label : ''}` });
    if (!choice) return;
    if (choice === 'view') return navigate(`/workout/${row.workout.id}`);
    if (choice === 'start') return beginWorkout(routine, row.routineDay, t);
    if (choice === 'cardio') return navigate(`/cardio?date=${row.date}`);
    if (choice === 'rest') { await repo.setPlan(profile.id, row.date, null, routine?.id); return draw(); }
    if (choice === 'reset') { await repo.clearPlan(profile.id, row.date); return draw(); }
    if (choice === 'change') {
      const days = routine ? routine.days : [];
      const d = await pick([...days.map((d) => ({ label: d.label, sub: `${d.slots.length} exercises`, value: d.id })), { label: 'Rest', value: null }], { title: 'Workout for ' + label });
      if (d === undefined) return;
      await repo.setPlan(profile.id, row.date, d, routine?.id);
      return draw();
    }
    if (choice === 'move') {
      const dates = weekDates(anchor).concat(weekDates(addDays(anchor, 7)));
      const target = await pick(dates.filter((d) => d !== row.date && d >= t).map((d) => ({ label: relativeDay(d), value: d })), { title: `Move ${row.routineDay.label} to` });
      if (!target) return;
      await repo.setPlan(profile.id, target, row.routineDay.id, routine?.id);
      await repo.setPlan(profile.id, row.date, null, routine?.id);
      toast(`Moved to ${relativeDay(target)}`);
      return draw();
    }
  }

  async function startAny(date = today()) {
    const items = [];
    for (const r of routines) for (const d of r.days) items.push({ label: d.label, sub: `${r.name} · ${d.slots.length} exercises`, value: { r, d } });
    items.push({ label: 'Empty workout', sub: 'Add exercises as you go', value: 'blank' });
    const v = await pick(items, { title: date === today() ? 'Start today' : `Log for ${relativeDay(date)}` });
    if (!v) return;
    if (v === 'blank') { const w = await startBlankWorkout({ profile, date }); return navigate(`/workout/${w.id}`); }
    beginWorkout(v.r, v.d, date);
  }

  async function beginWorkout(r, rd, date, accepted = null) {
    if (inProgress) {
      const ok = await confirm(`${inProgress.label} is still in progress. Discard it and start ${rd.label}?`, { okLabel: 'Discard & start', danger: true });
      if (!ok) return;
      await repo.deleteWorkout(inProgress.id);
    }
    const w = await startWorkout({ profile, routine: r, routineDay: rd, date, exercises, workoutsDesc, accepted });
    navigate(`/workout/${w.id}`);
  }

  await draw();
  if (ctx.query.start && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.start)) {
    history.replaceState(null, '', '#/');
    startAny(ctx.query.start);
  }
}

export function estimateMinutes(rd) {
  let sec = 0;
  for (const s of rd.slots) sec += s.sets * (45 + (s.restSec || 90));
  const f = rd.finisher;
  if (f) sec += f.kind === 'intervals' ? (f.workSec + f.restSec) * f.rounds + 60 : (f.durationMin || 10) * 60;
  return Math.round((sec + 5 * 60) / 60 / 5) * 5;
}

export function finisherLabel(f) {
  if (!f) return '';
  const type = f.cardioType ? f.cardioType[0].toUpperCase() + f.cardioType.slice(1) : 'Cardio';
  if (f.kind === 'intervals') return `${type} intervals · ${f.rounds} × ${f.workSec}s work / ${f.restSec}s rest${f.note ? ' · ' + f.note : ''}`;
  return `${type} · ${f.durationMin} min steady${f.note ? ' · ' + f.note : ''}`;
}
