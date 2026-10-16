import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { sheet, confirm, toast, header, prompt, pick } from '../ui/sheet.js';
import { pickExercise } from '../ui/exercisePicker.js';
import * as repo from '../db/repo.js';
import { state, updateProfile } from '../state.js';
import { CARDIO_TYPES } from './cardio.js';
import { finisherLabel, estimateMinutes } from './today.js';

export async function render(container, ctx) {
  const { profile, navigate } = ctx;
  const exercises = await repo.getExercises(profile.id);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const routines = await repo.getRoutines(profile.id);

  if (ctx.params.id) return renderEditor(ctx.params.id);

  container.append(
    header('Routines', { onBack: () => navigate('/more'), right: [h('button.btn.sm.primary', { onclick: newRoutine }, svgIcon(icons.plus, 18), 'New')] }),
    h('div.card.pad-0', h('div.list', routines.map((r) => h('button.list-item', { onclick: () => navigate(`/routines/${r.id}`) },
      h('div.body', h('div.title', r.name), h('div.sub', `${r.days.length} days · ${r.mode === 'winter' ? 'winter' : 'standard'} · rotation ${r.rotation.map((id) => r.days.find((d) => d.id === id)?.label).filter(Boolean).join(' → ') || 'none'}`)),
      r.id === profile.settings.activeRoutineId ? h('span.badge.accent', 'Active') : null,
      svgIcon(icons.chevron, 18),
    )))),
    h('p.note', { style: { marginTop: '12px' } }, 'The active routine drives the weekly plan. Rotation is the order its days cycle through on your training days.'),
  );

  async function newRoutine() {
    const c = await pick([{ label: 'Blank routine', value: 'blank' }, ...routines.map((r) => ({ label: `Copy of ${r.name}`, value: r.id }))], { title: 'New routine' });
    if (!c) return;
    const name = (await prompt('Routine name', { value: c === 'blank' ? '' : `${routines.find((r) => r.id === c).name} (copy)` }))?.trim();
    if (!name) return;
    let r;
    if (c === 'blank') r = { id: repo.uid(), profileId: profile.id, name, mode: 'standard', trainingDays: [1, 2, 4], days: [], rotation: [], builtIn: false };
    else {
      const src = routines.find((x) => x.id === c);
      const idMap = new Map();
      r = { ...structuredClone(src), id: repo.uid(), name, builtIn: false };
      r.days = r.days.map((d) => { const nid = repo.uid(); idMap.set(d.id, nid); return { ...d, id: nid, slots: d.slots.map((s) => ({ ...s, id: repo.uid() })) }; });
      r.rotation = r.rotation.map((id) => idMap.get(id)).filter(Boolean);
    }
    await repo.saveRoutine(r);
    navigate(`/routines/${r.id}`);
  }

  async function renderEditor(id) {
    const routine = routines.find((r) => r.id === id);
    if (!routine) { container.append(h('div.card', 'Routine not found.')); return; }
    const save = () => repo.saveRoutine(routine);
    const body = h('div.stack');
    const isActive = () => state.profile.settings.activeRoutineId === routine.id;
    container.append(header(routine.name, { onBack: () => navigate('/routines'), right: [h('button.btn.icon.ghost', { onclick: routineMenu, 'aria-label': 'Routine options' }, svgIcon(icons.dots, 22))] }), body);
    draw();

    function draw() {
      clear(body);
      body.append(
        h('div.row', isActive() ? h('span.badge.accent', 'Active routine') : h('button.btn.sm', { onclick: async () => { await updateProfile((p) => ({ ...p, settings: { ...p.settings, activeRoutineId: routine.id, mode: routine.mode, trainingDays: [...(routine.trainingDays || p.settings.trainingDays)] } })); toast('Now active'); draw(); } }, 'Make active'),
          h('span.small.muted', `${routine.mode === 'winter' ? 'Winter' : 'Standard'} · ${routine.days.length} days`)),
        h('div.section-title', h('h2', 'Days'), h('button.btn.sm.ghost', { onclick: addDay }, svgIcon(icons.plus, 18), 'Add day')),
        ...routine.days.map((d, i) => dayCard(d, i)),
        h('div.section-title', h('h2', 'Rotation')),
        h('div.card',
          h('p.small.muted', 'Order the days cycle through on training days. Tap a day to add it; tap an entry to remove it.'),
          h('div.chips', { style: { margin: '8px 0' } }, routine.rotation.map((did, i) => h('button.chip.on', { onclick: async () => { routine.rotation.splice(i, 1); await save(); draw(); } }, `${i + 1}. ${routine.days.find((d) => d.id === did)?.label || '?'}`))),
          h('div.chips', routine.days.map((d) => h('button.chip', { onclick: async () => { routine.rotation.push(d.id); await save(); draw(); } }, svgIcon(icons.plus, 14), d.label))),
        ),
      );
    }

    function dayCard(day, i) {
      const card = h('div.card');
      card.append(h('div.row.between',
        h('div.grow', h('div.card-title', day.label), h('div.small.muted', `${day.slots.length} exercises · ~${estimateMinutes(day)} min${day.optional ? ' · optional' : ''}`)),
        h('button.btn.icon.ghost.sm', { onclick: () => dayMenu(day, i), 'aria-label': 'Day options' }, svgIcon(icons.dots, 20)),
      ));
      const list = h('div.list', { style: { margin: '8px -14px 0' } });
      day.slots.forEach((slot, si) => {
        const ex = exById.get(slot.exerciseId);
        list.append(h('button.list-item', { onclick: () => editSlot(day, slot, si) },
          h('div.body', h('div.title', ex?.name || h('span.danger', 'Missing exercise')), h('div.sub', `${slot.sets} × ${slot.repMin}–${slot.repMax} · rest ${slot.restSec}s`)),
          svgIcon(icons.chevron, 18),
        ));
      });
      card.append(list);
      card.append(h('div.row', { style: { marginTop: '8px' } },
        h('button.btn.sm.subtle.grow', { onclick: async () => {
          const p = await pickExercise(exercises, { profileId: profile.id, title: `Add to ${day.label}` });
          if (!p) return;
          if (!exById.has(p.id)) { exById.set(p.id, p); exercises.push(p); }
          day.slots.push({ id: repo.uid(), exerciseId: p.id, sets: 3, repMin: 8, repMax: 12, restSec: 90 });
          await save(); draw();
        } }, svgIcon(icons.plus, 18), 'Exercise'),
        h('button.btn.sm.subtle.grow', { onclick: () => editFinisher(day) }, day.finisher ? 'Finisher' : 'Add finisher'),
      ));
      if (day.finisher) card.append(h('p.note', { style: { marginTop: '8px' } }, finisherLabel(day.finisher)));
      return card;
    }

    async function addDay() {
      const label = (await prompt('Day name', { value: '', title: 'New day' }))?.trim();
      if (!label) return;
      routine.days.push({ id: repo.uid(), key: label, label, slots: [], finisher: null, optional: false });
      await save(); draw();
    }

    async function dayMenu(day, i) {
      const c = await pick([
        { label: 'Rename', value: 'rename' },
        i > 0 ? { label: 'Move up', value: 'up' } : null,
        i < routine.days.length - 1 ? { label: 'Move down', value: 'down' } : null,
        { label: day.optional ? 'Mark as regular day' : 'Mark as optional', sub: 'Optional days are not auto-scheduled', value: 'optional' },
        { label: 'Delete day', value: 'delete' },
      ].filter(Boolean), { title: day.label });
      if (!c) return;
      if (c === 'rename') { const v = (await prompt('Day name', { value: day.label }))?.trim(); if (v) day.label = v; }
      if (c === 'up') [routine.days[i - 1], routine.days[i]] = [routine.days[i], routine.days[i - 1]];
      if (c === 'down') [routine.days[i + 1], routine.days[i]] = [routine.days[i], routine.days[i + 1]];
      if (c === 'optional') day.optional = !day.optional;
      if (c === 'delete') {
        if (!(await confirm(`Delete ${day.label}?`, { okLabel: 'Delete', danger: true }))) return;
        routine.days.splice(i, 1);
        routine.rotation = routine.rotation.filter((id) => id !== day.id);
      }
      await save(); draw();
    }

    async function editSlot(day, slot, si) {
      const ex = exById.get(slot.exerciseId);
      const v = await sheet((b, close) => {
        const sets = num(slot.sets), min = num(slot.repMin), max = num(slot.repMax), rest = num(slot.restSec);
        b.append(
          h('div.grid-2', h('div.field', h('label', 'Sets'), sets), h('div.field', h('label', 'Rest (sec)'), rest)),
          h('div.grid-2', h('div.field', h('label', 'Min reps'), min), h('div.field', h('label', 'Max reps'), max)),
          h('div.grid-2', h('button.btn', { onclick: () => close(undefined) }, 'Cancel'), h('button.btn.primary', { onclick: () => close({ sets: +sets.value || slot.sets, repMin: +min.value || slot.repMin, repMax: +max.value || slot.repMax, restSec: +rest.value || slot.restSec }) }, 'Save')),
          h('div.divider'),
          h('div.grid-2',
            si > 0 ? h('button.btn', { onclick: () => close('up') }, svgIcon(icons.up, 18), 'Move up') : h('div'),
            si < day.slots.length - 1 ? h('button.btn', { onclick: () => close('down') }, svgIcon(icons.down, 18), 'Move down') : h('div'),
          ),
          h('div.grid-2',
            h('button.btn', { onclick: () => close('swap') }, svgIcon(icons.swap, 18), 'Swap exercise'),
            h('button.btn.danger', { onclick: () => close('remove') }, 'Remove'),
          ),
        );
      }, { title: ex?.name || 'Exercise' });
      if (!v) return;
      if (v === 'remove') day.slots.splice(si, 1);
      else if (v === 'up') [day.slots[si - 1], day.slots[si]] = [day.slots[si], day.slots[si - 1]];
      else if (v === 'down') [day.slots[si + 1], day.slots[si]] = [day.slots[si], day.slots[si + 1]];
      else if (v === 'swap') {
        const p = await pickExercise(exercises, { profileId: profile.id, highlight: ex?.substitutions || [], title: 'Swap exercise' });
        if (!p) return;
        if (!exById.has(p.id)) { exById.set(p.id, p); exercises.push(p); }
        slot.exerciseId = p.id;
      } else Object.assign(slot, v);
      await save(); draw();
    }

    async function editFinisher(day) {
      const f = day.finisher || { kind: 'intervals', cardioType: 'bike', workSec: 30, restSec: 60, rounds: 8, durationMin: 12, note: '' };
      const v = await sheet((b, close) => {
        let kind = f.kind;
        const typeSel = h('select.select', CARDIO_TYPES.map((t) => h('option', { value: t, selected: t === f.cardioType }, cap(t))));
        const work = num(f.workSec || 30), rest = num(f.restSec || 60), rounds = num(f.rounds || 8), minutes = num(f.durationMin || 12);
        const note = h('input.input', { value: f.note || '', placeholder: 'Note (incline, pace…)' });
        const intervalsBox = h('div.grid-3', h('div.field', h('label', 'Work (s)'), work), h('div.field', h('label', 'Rest (s)'), rest), h('div.field', h('label', 'Rounds'), rounds));
        const steadyBox = h('div.field', h('label', 'Minutes'), minutes);
        const kindChips = h('div.chips', [['intervals', 'Intervals'], ['steady', 'Steady']].map(([k, label]) => h('button.chip', { class: kind === k ? 'on' : '', onclick: (e) => { kind = k; kindChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget)); intervalsBox.classList.toggle('hidden', k !== 'intervals'); steadyBox.classList.toggle('hidden', k !== 'steady'); } }, label)));
        intervalsBox.classList.toggle('hidden', kind !== 'intervals');
        steadyBox.classList.toggle('hidden', kind !== 'steady');
        b.append(
          h('div.field', h('label', 'Machine'), typeSel),
          h('div.field', h('label', 'Format'), kindChips),
          intervalsBox, steadyBox,
          h('div.field', h('label', 'Note'), note),
          h('div.grid-2', h('button.btn', { onclick: () => close(undefined) }, 'Cancel'), h('button.btn.primary', { onclick: () => close({ kind, cardioType: typeSel.value, workSec: +work.value || 30, restSec: +rest.value || 0, rounds: +rounds.value || 1, durationMin: +minutes.value || 10, note: note.value.trim() }) }, 'Save')),
          day.finisher ? h('button.btn.danger.block', { onclick: () => close('remove') }, 'Remove finisher') : null,
        );
      }, { title: 'Cardio finisher' });
      if (!v) return;
      day.finisher = v === 'remove' ? null : v;
      await save(); draw();
    }

    async function routineMenu() {
      const c = await pick([
        { label: 'Rename', value: 'rename' },
        { label: `Mode: ${routine.mode === 'winter' ? 'Winter' : 'Standard'}`, sub: 'Which mode button selects this routine', value: 'mode' },
        { label: 'Default training days', sub: (routine.trainingDays || []).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'none', value: 'days' },
        routines.length > 1 ? { label: 'Delete routine', value: 'delete' } : null,
      ].filter(Boolean), { title: routine.name });
      if (!c) return;
      if (c === 'rename') { const v = (await prompt('Routine name', { value: routine.name }))?.trim(); if (v) { routine.name = v; container.querySelector('h1').textContent = v; } }
      if (c === 'mode') routine.mode = routine.mode === 'winter' ? 'standard' : 'winter';
      if (c === 'days') {
        const days = new Set(routine.trainingDays || []);
        const v = await sheet((b, close) => {
          b.append(h('div.chips', [1, 2, 3, 4, 5, 6, 0].map((d) => h('button.chip', { class: days.has(d) ? 'on' : '', onclick: (e) => { days.has(d) ? days.delete(d) : days.add(d); e.currentTarget.classList.toggle('on'); } }, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]))),
            h('button.btn.primary.block', { onclick: () => close([...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) }, 'Save'));
        }, { title: 'Training days' });
        if (v) routine.trainingDays = v;
      }
      if (c === 'delete') {
        if (!(await confirm(`Delete ${routine.name}?`, { okLabel: 'Delete', danger: true }))) return;
        await repo.deleteRoutine(routine.id);
        if (isActive()) { const other = routines.find((r) => r.id !== routine.id); await updateProfile((p) => ({ ...p, settings: { ...p.settings, activeRoutineId: other?.id || null } })); }
        toast('Deleted'); return navigate('/routines');
      }
      await save(); draw();
    }
  }
}
const num = (v) => h('input.input.num', { type: 'number', inputmode: 'numeric', value: v });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
