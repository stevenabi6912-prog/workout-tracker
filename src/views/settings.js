import { h, clear } from '../ui/dom.js';
import { toast, confirm, header, pick } from '../ui/sheet.js';
import * as repo from '../db/repo.js';
import { state, updateProfile, applyTheme } from '../state.js';
import { exportProfile, exportAll, importBackup, downloadJSON } from '../import/backup.js';
import { fromDisplayWeight, toDisplayWeight } from '../domain/units.js';
import { DOW_SHORT } from '../domain/dates.js';

export async function render(container, ctx) {
  const { navigate } = ctx;
  const body = h('div.stack-lg');
  container.append(header('Settings', { onBack: () => navigate('/more') }), body);
  await draw();

  async function draw() {
    const profile = state.profile;
    const s = profile.settings;
    const units = profile.units.weight;
    const routines = await repo.getRoutines(profile.id);
    clear(body);

    const goal = numField(`Goal weight (${units})`, profile.goalWeightLb ? r1(toDisplayWeight(profile.goalWeightLb, units)) : '', async (v, raw) => { await updateProfile({ goalWeightLb: raw === '' ? null : fromDisplayWeight(v, units) }); toast('Saved'); });

    body.append(section('Profile', [
      h('div.field', h('label', 'Name'), h('input.input', { value: profile.name, onchange: async (e) => { const v = e.target.value.trim(); if (v) { await updateProfile({ name: v }); toast('Saved'); } } })),
      goal,
      h('div.grid-2',
        h('div.field', h('label', 'Weight unit'), select([['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']], profile.units.weight, async (v) => { await updateProfile((p) => ({ ...p, units: { ...p.units, weight: v } })); draw(); })),
        h('div.field', h('label', 'Distance unit'), select([['mi', 'Miles (mi)'], ['km', 'Kilometers (km)']], profile.units.distance, async (v) => { await updateProfile((p) => ({ ...p, units: { ...p.units, distance: v } })); draw(); })),
      ),
      h('div.field', h('label', 'Appearance'), select([['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']], s.theme || 'system', async (v) => { await updateSettings({ theme: v }); applyTheme(); })),
    ]));

    body.append(section('Training', [
      h('div.field', h('label', 'Active routine'), select(routines.map((r) => [r.id, r.name]), s.activeRoutineId, async (v) => { await updateSettings({ activeRoutineId: v, mode: routines.find((r) => r.id === v)?.mode || s.mode }); draw(); })),
      h('div.field', h('label', 'Training days'), h('div.chips', [1, 2, 3, 4, 5, 6, 0].map((d) => h('button.chip', { class: s.trainingDays.includes(d) ? 'on' : '', onclick: async () => {
        const days = s.trainingDays.includes(d) ? s.trainingDays.filter((x) => x !== d) : [...s.trainingDays, d];
        await updateSettings({ trainingDays: days.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) });
        draw();
      } }, DOW_SHORT[d])))),
      h('div.row', { style: { marginTop: '4px' } },
        h('button.btn.sm.grow', { class: s.mode === 'standard' ? 'primary' : '', onclick: () => switchMode('standard') }, 'Standard (3 days)'),
        h('button.btn.sm.grow', { class: s.mode === 'winter' ? 'primary' : '', onclick: () => switchMode('winter') }, 'Winter (4–5 days)'),
      ),
      h('p.note', 'Winter mode switches to the upper/lower routine and sets Mon/Tue/Thu/Fri. Standard goes back to full body on Mon/Tue/Thu. Edit days above afterwards if you like.'),
    ]));

    body.append(section('Progression', [
      h('div.grid-2',
        numField(`Lower body step (${units})`, r1(toDisplayWeight(s.increments.lower, units)), async (v) => updateSettings({ increments: { ...s.increments, lower: fromDisplayWeight(v, units) || 5 } })),
        numField(`Upper body step (${units})`, r1(toDisplayWeight(s.increments.upper, units)), async (v) => updateSettings({ increments: { ...s.increments, upper: fromDisplayWeight(v, units) || 2.5 } })),
      ),
      h('p.note', 'When every set hits the top of its rep range, the next session suggests this much more. Per-exercise overrides live in the exercise library.'),
    ]));

    body.append(section('Rest timer', [
      h('div.grid-2',
        numField('Default rest (sec)', s.restSec, async (v) => updateSettings({ restSec: Math.max(10, Math.round(v)) || 90 })),
        h('div.field', h('label', 'Auto-start after a set'), select([['1', 'On'], ['0', 'Off']], s.autoStartRest ? '1' : '0', async (v) => updateSettings({ autoStartRest: v === '1' }))),
      ),
      h('p.note', 'Routine days can set their own rest per exercise; this is the fallback.'),
    ]));

    body.append(section('Backup', [
      h('div.grid-2',
        h('button.btn', { onclick: async () => { const data = await exportProfile(profile.id); downloadJSON(data, `workout-tracker-${slug(profile.name)}-${today()}.json`); } }, 'Export this profile'),
        h('button.btn', { onclick: async () => { const data = await exportAll(); downloadJSON(data, `workout-tracker-all-${today()}.json`); } }, 'Export everything'),
      ),
      fileButton('Import backup (.json)', async (file) => {
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          const mode = await pick([
            { label: 'Merge', sub: 'Add anything new; keep existing entries', value: 'merge' },
            { label: 'Replace matching profiles', sub: 'Wipe each imported profile\'s data first', value: 'replace' },
          ], { title: 'How to import' });
          if (!mode) return;
          if (mode === 'replace' && !(await confirm('Replace data for the profiles in this file? Existing workouts for those profiles will be deleted first.', { okLabel: 'Replace', danger: true }))) return;
          const result = await importBackup(json, { mode });
          toast(`Imported ${result.profiles} profile${result.profiles === 1 ? '' : 's'}, ${result.records} records`);
          const { reloadProfiles } = await import('../state.js');
          await reloadProfiles();
          draw();
        } catch (err) {
          toast('Import failed: ' + (err.message || err), 4000);
        }
      }),
      h('p.note', 'Export gives you a JSON file with everything for this profile (or all profiles). Save it to Files or iCloud, or AirDrop it to another device and import it there. Apple Health import is under More.'),
    ]));

    body.append(section('Danger zone', [
      h('button.btn.danger.block', { onclick: async () => {
        if (!(await confirm(`Delete all workouts, cardio, weigh-ins, and heart-rate data for ${profile.name}? Routines and exercises stay.`, { okLabel: 'Delete history', danger: true }))) return;
        await repo.clearProfileData(profile.id);
        toast('History cleared');
      } }, 'Clear this profile\'s history'),
    ]));
  }

  async function updateSettings(patch) {
    await updateProfile((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  }

  async function switchMode(mode) {
    const routines = await repo.getRoutines(state.profile.id);
    const r = routines.find((x) => x.mode === mode) || routines[0];
    if (!r) return;
    await updateSettings({ mode, activeRoutineId: r.id, trainingDays: [...(r.trainingDays || (mode === 'winter' ? [1, 2, 4, 5] : [1, 2, 4]))] });
    toast(`${mode === 'winter' ? 'Winter' : 'Standard'} mode: ${r.name}`);
    draw();
  }
}

function section(title, children) {
  return h('div', h('div.section-title', h('h2', title)), h('div.card', h('div.stack', children)));
}
function select(options, value, onChange) {
  return h('select.select', { onchange: (e) => onChange(e.target.value) }, options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)));
}
function numField(label, value, onChange) {
  return h('div.field', h('label', label), h('input.input.num', { inputmode: 'decimal', value: value ?? '', placeholder: '—', onfocus: (e) => e.target.select(), onchange: (e) => { const raw = e.target.value.trim(); const v = Number(raw); onChange(Number.isFinite(v) ? v : 0, raw); } }));
}
function fileButton(label, onFile) {
  const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: (e) => { const f = e.target.files[0]; if (f) onFile(f); e.target.value = ''; } });
  return h('div', h('button.btn.block', { onclick: () => input.click() }, label), input);
}
const r1 = (v) => Math.round(v * 10) / 10;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function today() { return new Date().toISOString().slice(0, 10); }
