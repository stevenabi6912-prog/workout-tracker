import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { sheet, pick, toast, confirm, prompt, header } from '../ui/sheet.js';
import { pickExercise } from '../ui/exercisePicker.js';
import { startRestTimer, stopRestTimer } from '../ui/resttimer.js';
import { keepAwake } from '../ui/timer.js';
import * as repo from '../db/repo.js';
import { bestsFromWorkouts, classifySet } from '../domain/prs.js';
import { suggestWeight, incrementFor } from '../domain/progression.js';
import { findLastEntry, sortDesc, finishWorkout } from '../domain/session.js';
import { fmtWeight, toDisplayWeight, fromDisplayWeight, fmtDuration, roundToStep } from '../domain/units.js';
import { relativeDay, fmtTime, today } from '../domain/dates.js';
import { workoutSummary } from '../domain/stats.js';
import { finisherLabel } from './today.js';

export async function render(container, ctx) {
  const { profile, navigate } = ctx;
  const units = profile.units.weight;
  const workout = await repo.getWorkout(ctx.params.id);
  if (!workout || workout.profileId !== profile.id) {
    container.append(h('div.card', 'Workout not found.'), h('button.btn.block', { onclick: () => navigate('/') }, 'Back to Today'));
    return;
  }
  const [exercises, allWorkouts, cardioToday] = await Promise.all([
    repo.getExercises(profile.id),
    repo.getWorkouts(profile.id),
    repo.getCardio(profile.id, workout.date, workout.date),
  ]);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const workoutsDesc = sortDesc(allWorkouts.filter((w) => w.id !== workout.id));
  const prior = allWorkouts.filter((w) => w.id !== workout.id && w.status === 'done' && (w.date < workout.date || (w.date === workout.date && (w.startedAt || '') < (workout.startedAt || ''))));
  const bestsCache = new Map();
  const bests = (exId) => { if (!bestsCache.has(exId)) bestsCache.set(exId, bestsFromWorkouts(prior, exId)); return bestsCache.get(exId); };
  const editing = workout.status === 'done';
  const inc = (exId) => incrementFor(exById.get(exId), profile.settings);

  let saveTimer = null;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => repo.saveWorkout(workout), 250); };
  const saveNow = () => { clearTimeout(saveTimer); return repo.saveWorkout(workout); };

  if (!editing) { window.__keepAwakeWanted = true; keepAwake(true); }

  const elapsedEl = h('span.mono.muted.small');
  let elapsedHandle = null;
  if (!editing) {
    const tickElapsed = () => { elapsedEl.textContent = fmtDuration((Date.now() - new Date(workout.startedAt).getTime()) / 1000); };
    tickElapsed();
    elapsedHandle = setInterval(tickElapsed, 1000);
  }

  const entriesEl = h('div.stack');
  const finisherEl = h('div');

  container.append(
    header(workout.label || 'Workout', {
      onBack: () => navigate(editing ? '/history?date=' + workout.date : '/'),
      right: [h('button.btn.icon.ghost', { onclick: menu, 'aria-label': 'Workout options' }, svgIcon(icons.dots, 22))],
    }),
    h('div.row.between.small.muted', { style: { marginBottom: '12px' } },
      h('span', `${relativeDay(workout.date)}${workout.startedAt ? ' · ' + fmtTime(workout.startedAt) : ''}`),
      editing ? h('span', workout.endedAt ? `Duration ${fmtDuration((new Date(workout.endedAt) - new Date(workout.startedAt)) / 1000)}` : '') : elapsedEl,
    ),
    entriesEl,
    h('button.btn.block', { style: { marginTop: '12px' }, onclick: addExercise }, svgIcon(icons.plus, 20), 'Add exercise'),
    finisherEl,
    h('div.stack', { style: { marginTop: '20px' } },
      h('button.btn.primary.block', { onclick: finish }, editing ? 'Save changes' : 'Finish workout'),
      editing ? null : h('button.btn.ghost.block', { onclick: () => navigate('/') }, 'Pause and come back later'),
    ),
  );

  drawEntries();
  drawFinisher();

  function drawEntries() {
    clear(entriesEl);
    if (!workout.entries.length) entriesEl.append(h('div.empty-state', 'No exercises yet. Add one below.'));
    workout.entries.forEach((entry, idx) => entriesEl.append(entryCard(entry, idx)));
  }

  function entryCard(entry, idx) {
    const ex = exById.get(entry.exerciseId);
    const card = h('div.card');
    const t = entry.target;
    const targetText = t ? `${t.sets} × ${t.repMin}–${t.repMax} · rest ${fmtDuration(t.restSec || profile.settings.restSec)}` : '';
    card.append(h('div.row.between',
      h('div.grow', h('div.card-title', ex?.name || 'Exercise'), targetText ? h('div.small.muted', targetText) : null),
      h('button.btn.icon.ghost.sm', { onclick: () => entryMenu(entry, idx), 'aria-label': 'Exercise options' }, svgIcon(icons.dots, 20)),
    ));
    if (ex?.notes) card.append(h('p.note', ex.notes));

    const s = entry.suggestion;
    if (s && !editing) {
      const last = findLastEntry(workoutsDesc, entry.exerciseId);
      const lastText = last ? `Last: ${last.entry.sets.filter((x) => x.done).map((x) => `${fmtWeight(x.weightLb, units, { unit: false })}×${x.reps}`).join(', ')}` : '';
      if (s.kind === 'increase') {
        const applyWeight = (lb, accepted) => { for (const st of entry.sets) if (!st.done) st.weightLb = lb; s.accepted = accepted; save(); redraw(); };
        card.append(h('div.callout', { style: { margin: '8px 0' } },
          h('div', h('strong', `Suggested: ${fmtWeight(s.toLb, units)}`), ' ', h('span.muted', s.reason)),
          lastText ? h('div.small.muted', lastText) : null,
          h('div.row', { style: { marginTop: '6px' } },
            h('button.chip', { class: s.accepted ? 'on' : '', onclick: () => applyWeight(s.toLb, true) }, `Use ${fmtWeight(s.toLb, units, { unit: false })}`),
            h('button.chip', { class: !s.accepted ? 'on' : '', onclick: () => applyWeight(s.fromLb, false) }, `Keep ${fmtWeight(s.fromLb, units, { unit: false })}`),
          ),
        ));
      } else if (lastText) {
        card.append(h('p.small.muted', { style: { marginTop: '6px' } }, `${lastText}. ${s.reason}`));
      }
    }

    card.append(h('div.set-head', h('span', 'Set'), h('span', units), h('span', 'Reps'), h('span', ''), h('span', '')));
    const rows = h('div');
    entry.sets.forEach((set, i) => rows.append(setRow(entry, set, i)));
    card.append(rows);
    card.append(h('div.row', { style: { marginTop: '8px' } },
      h('button.btn.sm.subtle.grow', { onclick: () => { const prev = entry.sets[entry.sets.length - 1]; entry.sets.push({ weightLb: prev?.weightLb ?? null, reps: prev?.reps ?? null, done: false, pr: null }); save(); redraw(); } }, svgIcon(icons.plus, 18), 'Add set'),
      h('button.btn.sm.subtle.grow', { onclick: () => noteSheet(entry) }, entry.notes ? 'Edit note' : 'Add note'),
    ));
    if (entry.notes) card.append(h('p.note', { style: { marginTop: '8px', whiteSpace: 'pre-wrap' } }, entry.notes));
    return card;

    function redraw() { const fresh = entryCard(entry, idx); card.replaceWith(fresh); }
  }

  function setRow(entry, set, i) {
    const row = h('div.set-row', { class: set.done ? 'done' : '' });
    const weight = h('input.input.num', {
      type: 'text', inputmode: 'decimal', placeholder: '—', 'aria-label': 'Weight',
      value: set.weightLb != null ? String(round1(toDisplayWeight(set.weightLb, units))) : '',
      onfocus: (e) => e.target.select(),
      onchange: (e) => { set.weightLb = fromDisplayWeight(e.target.value, units); if (set.weightLb != null) set.weightLb = roundToStep(set.weightLb, 0.5); e.target.value = set.weightLb != null ? String(round1(toDisplayWeight(set.weightLb, units))) : ''; save(); updateBadge(); },
    });
    const reps = h('input.input.num', {
      type: 'text', inputmode: 'numeric', placeholder: set.targetReps ? String(set.targetReps) : '—', 'aria-label': 'Reps',
      value: set.reps != null ? String(set.reps) : '',
      onfocus: (e) => e.target.select(),
      onchange: (e) => { const v = parseInt(e.target.value, 10); set.reps = Number.isFinite(v) ? v : null; e.target.value = set.reps ?? ''; save(); updateBadge(); },
    });
    const check = h('button.check', { class: set.done ? 'on' : '', 'aria-label': set.done ? 'Mark not done' : 'Mark done', onclick: () => toggleDone() }, svgIcon(icons.check, 22));
    const remove = h('button.remove', { 'aria-label': 'Remove set', onclick: () => { entry.sets.splice(i, 1); save(); drawEntries(); } }, '×');
    const idx = h('div.idx', String(i + 1));
    const badge = h('span.badge.ok.small', { style: { display: 'none', position: 'absolute', transform: 'translate(-6px, -22px)', fontSize: '10px', padding: '1px 6px' } }, 'PR');
    idx.style.position = 'relative';
    idx.append(badge);
    row.append(idx, weight, reps, check, remove);
    updateBadge();
    return row;

    function toggleDone() {
      if (!set.done) {
        if (set.reps == null && set.targetReps) { set.reps = set.targetReps; reps.value = String(set.reps); }
        if (set.weightLb == null && weight.value) set.weightLb = fromDisplayWeight(weight.value, units);
        set.done = true;
        if (!editing && profile.settings.autoStartRest) startRestTimer(entry.target?.restSec || profile.settings.restSec);
        // Pre-fill the next set with this set's numbers if it is empty.
        const next = entry.sets[i + 1];
        if (next && !next.done && next.weightLb == null) next.weightLb = set.weightLb;
      } else {
        set.done = false;
      }
      save();
      drawEntries();
    }
    function updateBadge() {
      const pr = classifySet(set, bests(entry.exerciseId));
      set.pr = set.done ? pr : null;
      badge.style.display = pr && set.done ? 'inline-flex' : 'none';
    }
  }

  async function noteSheet(entry) {
    const v = await sheet((body, close) => {
      const ta = h('textarea.textarea', { value: entry.notes || '', placeholder: 'Form cues, how it felt, machine settings…' });
      body.append(ta, h('div.grid-2', h('button.btn', { onclick: () => close(undefined) }, 'Cancel'), h('button.btn.primary', { onclick: () => close(ta.value) }, 'Save')));
      setTimeout(() => ta.focus(), 50);
    }, { title: exById.get(entry.exerciseId)?.name || 'Note' });
    if (v === undefined) return;
    entry.notes = v.trim();
    save();
    drawEntries();
  }

  async function entryMenu(entry, idx) {
    const ex = exById.get(entry.exerciseId);
    const choice = await pick([
      { label: 'Swap exercise', sub: ex?.substitutions?.length ? `Substitutions: ${ex.substitutions.map((id) => exById.get(id)?.name).filter(Boolean).join(', ')}` : 'Pick from the library', value: 'swap' },
      { label: 'Edit target', sub: entry.target ? `${entry.target.sets} × ${entry.target.repMin}–${entry.target.repMax}, rest ${entry.target.restSec}s` : 'Sets, rep range, rest', value: 'target' },
      idx > 0 ? { label: 'Move up', value: 'up' } : null,
      idx < workout.entries.length - 1 ? { label: 'Move down', value: 'down' } : null,
      { label: 'Remove from this workout', value: 'remove' },
    ].filter(Boolean), { title: ex?.name });
    if (!choice) return;
    if (choice === 'remove') { workout.entries.splice(idx, 1); save(); drawEntries(); }
    if (choice === 'up') { [workout.entries[idx - 1], workout.entries[idx]] = [workout.entries[idx], workout.entries[idx - 1]]; save(); drawEntries(); }
    if (choice === 'down') { [workout.entries[idx + 1], workout.entries[idx]] = [workout.entries[idx], workout.entries[idx + 1]]; save(); drawEntries(); }
    if (choice === 'swap') {
      const picked = await pickExercise(exercises, { profileId: profile.id, highlight: ex?.substitutions || [], title: `Swap ${ex?.name || ''}` });
      if (!picked) return;
      if (!exById.has(picked.id)) exById.set(picked.id, picked);
      entry.exerciseId = picked.id;
      const last = findLastEntry(workoutsDesc, picked.id);
      const slot = entry.target ? { ...entry.target } : { sets: entry.sets.length, repMin: 8, repMax: 12 };
      entry.suggestion = last ? suggestWeight({ slot, exercise: picked, lastEntry: last.entry, settings: profile.settings }) : null;
      if (entry.suggestion) entry.suggestion.accepted = entry.suggestion.kind === 'increase';
      const lastSets = last ? last.entry.sets.filter((s) => s.done) : [];
      entry.sets = entry.sets.map((s, i) => s.done ? s : { ...s, weightLb: entry.suggestion ? entry.suggestion.toLb : lastSets[i]?.weightLb ?? null, reps: lastSets[i]?.reps ?? null });
      save();
      drawEntries();
    }
    if (choice === 'target') {
      const t = entry.target || { sets: entry.sets.length, repMin: 8, repMax: 12, restSec: profile.settings.restSec };
      const v = await sheet((body, close) => {
        const sets = h('input.input.num', { type: 'number', inputmode: 'numeric', value: t.sets });
        const min = h('input.input.num', { type: 'number', inputmode: 'numeric', value: t.repMin });
        const max = h('input.input.num', { type: 'number', inputmode: 'numeric', value: t.repMax });
        const rest = h('input.input.num', { type: 'number', inputmode: 'numeric', value: t.restSec || profile.settings.restSec });
        body.append(
          h('div.grid-2', h('div.field', h('label', 'Sets'), sets), h('div.field', h('label', 'Rest (sec)'), rest)),
          h('div.grid-2', h('div.field', h('label', 'Min reps'), min), h('div.field', h('label', 'Max reps'), max)),
          h('div.grid-2', h('button.btn', { onclick: () => close(undefined) }, 'Cancel'), h('button.btn.primary', { onclick: () => close({ sets: +sets.value || t.sets, repMin: +min.value || t.repMin, repMax: +max.value || t.repMax, restSec: +rest.value || t.restSec }) }, 'Save')),
        );
      }, { title: 'Target' });
      if (!v) return;
      entry.target = v;
      while (entry.sets.length < v.sets) { const prev = entry.sets[entry.sets.length - 1]; entry.sets.push({ weightLb: prev?.weightLb ?? null, reps: null, targetReps: v.repMax, done: false, pr: null }); }
      save();
      drawEntries();
    }
  }

  async function addExercise() {
    const picked = await pickExercise(exercises, { profileId: profile.id, title: 'Add exercise' });
    if (!picked) return;
    if (!exById.has(picked.id)) exById.set(picked.id, picked);
    const last = findLastEntry(workoutsDesc, picked.id);
    const lastSets = last ? last.entry.sets.filter((s) => s.done) : [];
    const n = Math.max(3, lastSets.length || 0);
    const slot = { sets: n, repMin: 8, repMax: 12, restSec: profile.settings.restSec };
    const suggestion = last ? suggestWeight({ slot, exercise: picked, lastEntry: last.entry, settings: profile.settings }) : null;
    if (suggestion) suggestion.accepted = suggestion.kind === 'increase';
    workout.entries.push({
      id: repo.uid(), exerciseId: picked.id, slotId: null, target: slot, suggestion, notes: '',
      sets: Array.from({ length: n }, (_, i) => ({ weightLb: suggestion ? suggestion.toLb : lastSets[i]?.weightLb ?? null, reps: lastSets[i]?.reps ?? null, targetReps: slot.repMax, done: false, pr: null })),
    });
    save();
    drawEntries();
    setTimeout(() => entriesEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function drawFinisher() {
    clear(finisherEl);
    const linked = cardioToday.filter((c) => c.workoutId === workout.id);
    const f = workout.finisher;
    if (!f && !linked.length) {
      finisherEl.append(h('div.row', { style: { marginTop: '12px' } }, h('button.btn.block.subtle', { onclick: () => navigate(`/cardio?workout=${workout.id}&date=${workout.date}`) }, 'Add cardio finisher')));
      return;
    }
    const card = h('div.card', { style: { marginTop: '12px' } }, h('div.card-title', 'Cardio finisher'));
    if (f) card.append(h('p.small.muted', finisherLabel(f)));
    if (linked.length) card.append(h('div.list', { style: { marginTop: '8px' } }, linked.map((c) => h('button.list-item', { onclick: () => navigate(`/cardio/${c.id}`) },
      h('div.body', h('div.title', cap(c.type) + (c.intervals ? ' intervals' : '')), h('div.sub', `${fmtDuration(c.durationSec)}${c.distanceMi ? ' · ' + c.distanceMi.toFixed(2) + ' ' + profile.units.distance : ''}${c.avgHr ? ' · ' + c.avgHr + ' bpm' : ''}`)),
      svgIcon(icons.check, 18),
    ))));
    const q = `workout=${workout.id}&date=${workout.date}` + (f ? `&type=${f.cardioType || ''}${f.kind === 'intervals' ? `&work=${f.workSec}&rest=${f.restSec}&rounds=${f.rounds}` : `&minutes=${f.durationMin || ''}`}` : '');
    card.append(h('div.row', { style: { marginTop: '10px' } },
      f?.kind === 'intervals' ? h('button.btn.primary.grow', { onclick: () => navigate(`/cardio?${q}&start=1`) }, svgIcon(icons.timer, 20), 'Start interval timer') : null,
      h('button.btn.grow', { onclick: () => navigate(`/cardio?${q}`) }, linked.length ? 'Log another' : 'Log cardio'),
    ));
    finisherEl.append(card);
  }

  async function menu() {
    const choice = await pick([
      { label: 'Rename workout', value: 'rename' },
      { label: 'Change date', sub: workout.date, value: 'date' },
      { label: 'Workout note', value: 'note' },
      { label: editing ? 'Delete workout' : 'Discard workout', value: 'delete' },
    ], { title: workout.label });
    if (choice === 'rename') { const v = await prompt('Workout name', { value: workout.label }); if (v) { workout.label = v.trim() || workout.label; await saveNow(); ctx.refresh(); } }
    if (choice === 'date') { const v = await prompt('Date', { value: workout.date, type: 'date' }); if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) { workout.date = v; await saveNow(); ctx.refresh(); } }
    if (choice === 'note') { const v = await prompt('Note', { value: workout.notes || '' }); if (v !== undefined) { workout.notes = v; await saveNow(); } }
    if (choice === 'delete') {
      const ok = await confirm(editing ? 'Delete this workout permanently?' : 'Discard this workout? Nothing will be saved.', { okLabel: 'Delete', danger: true });
      if (!ok) return;
      stopRestTimer();
      await repo.deleteWorkout(workout.id);
      navigate(editing ? '/history' : '/');
    }
  }

  async function finish() {
    const anyDone = workout.entries.some((e) => e.sets.some((s) => s.done));
    if (!editing && !anyDone) {
      const ok = await confirm('No sets are marked done. Finish anyway?', { okLabel: 'Finish' });
      if (!ok) return;
    }
    stopRestTimer();
    clearTimeout(saveTimer);
    await finishWorkout(workout);
    const s = workoutSummary(workout);
    toast(editing ? 'Saved' : `Done: ${s.sets} sets${s.prs ? `, ${s.prs} PR${s.prs > 1 ? 's' : ''}` : ''}`);
    navigate(editing ? '/history?date=' + workout.date : '/');
  }

  return () => {
    clearInterval(elapsedHandle);
    stopRestTimer();
    clearTimeout(saveTimer);
    if (saveTimer) repo.saveWorkout(workout);
    window.__keepAwakeWanted = false;
    keepAwake(false);
  };
}

const round1 = (v) => Math.round(v * 10) / 10;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
