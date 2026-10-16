import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { sheet, confirm, toast, header, prompt } from '../ui/sheet.js';
import { pickExercise } from '../ui/exercisePicker.js';
import * as repo from '../db/repo.js';
import { fromDisplayWeight, toDisplayWeight } from '../domain/units.js';

const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
const REGIONS = ['upper', 'lower', 'core'];

export async function render(container, ctx) {
  const { profile, navigate } = ctx;
  const exercises = await repo.getExercises(profile.id);
  const exById = new Map(exercises.map((e) => [e.id, e]));

  if (ctx.params.id) return renderDetail(ctx.params.id);

  let q = '';
  let filter = 'all';
  const listEl = h('div.card.pad-0');
  const search = h('input.input', { type: 'search', placeholder: 'Search exercises', autocomplete: 'off', oninput: (e) => { q = e.target.value.trim().toLowerCase(); drawList(); } });
  container.append(
    header('Exercises', { onBack: () => navigate('/more'), right: [h('button.btn.sm.primary', { onclick: createExercise }, svgIcon(icons.plus, 18), 'New')] }),
    search,
    h('div.chips', { style: { margin: '10px 0' } }, ['all', ...EQUIPMENT, 'custom'].map((f) => h('button.chip', { class: filter === f ? 'on' : '', style: { minHeight: '34px', padding: '0 10px' }, onclick: () => { filter = f; container.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.textContent === cap(f))); drawList(); } }, cap(f)))),
    listEl,
  );
  drawList();

  function drawList() {
    clear(listEl);
    const rows = exercises.filter((e) => (!q || e.name.toLowerCase().includes(q) || e.muscles?.some((m) => m.includes(q))) && (filter === 'all' || (filter === 'custom' ? !e.builtIn : e.equipment === filter)));
    if (!rows.length) { listEl.append(h('div.empty-state', 'No exercises match.')); return; }
    listEl.append(h('div.list', rows.map((e) => h('button.list-item', { onclick: () => navigate(`/exercises/${e.id}`) },
      h('div.body', h('div.title', e.name), h('div.sub', [e.equipment, e.region, e.muscles?.join(', ')].filter(Boolean).join(' · '))),
      !e.builtIn ? h('span.badge', 'Custom') : null,
      svgIcon(icons.chevron, 18),
    ))));
  }

  async function createExercise() {
    const name = (await prompt('Exercise name', { title: 'New exercise' }))?.trim();
    if (!name) return;
    const ex = { id: repo.uid(), profileId: profile.id, name, equipment: 'machine', region: 'upper', muscles: [], notes: '', substitutions: [], builtIn: false };
    await repo.saveExercise(ex);
    navigate(`/exercises/${ex.id}`);
  }

  async function renderDetail(id) {
    const ex = exById.get(id);
    if (!ex) { container.append(h('div.card', 'Exercise not found.')); return; }
    const units = profile.units.weight;
    const workouts = (await repo.getWorkouts(profile.id)).filter((w) => w.status === 'done' && w.entries?.some((e) => e.exerciseId === id)).sort((a, b) => b.date.localeCompare(a.date));
    const save = async () => { await repo.saveExercise(ex); };
    const body = h('div.stack');
    container.append(header(ex.name, { onBack: () => navigate('/exercises') }), body);
    draw();

    function draw() {
      clear(body);
      body.append(
        h('div.card', h('div.stack',
          h('div.field', h('label', 'Name'), h('input.input', { value: ex.name, onchange: async (e) => { ex.name = e.target.value.trim() || ex.name; await save(); container.querySelector('h1').textContent = ex.name; } })),
          h('div.grid-2',
            h('div.field', h('label', 'Equipment'), sel(EQUIPMENT, ex.equipment, async (v) => { ex.equipment = v; await save(); })),
            h('div.field', h('label', 'Region'), sel(REGIONS, ex.region, async (v) => { ex.region = v; await save(); })),
          ),
          h('div.field', h('label', 'Muscles (comma separated)'), h('input.input', { value: (ex.muscles || []).join(', '), onchange: async (e) => { ex.muscles = e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean); await save(); } })),
          h('div.field', h('label', `Weight step override (${units}, blank = use profile default)`), h('input.input.num', { inputmode: 'decimal', value: ex.incrementLb ? String(toDisplayWeight(ex.incrementLb, units)) : '', placeholder: ex.region === 'lower' ? String(toDisplayWeight(profile.settings.increments.lower, units)) : String(toDisplayWeight(profile.settings.increments.upper, units)), onchange: async (e) => { ex.incrementLb = e.target.value.trim() === '' ? null : fromDisplayWeight(e.target.value, units); await save(); } })),
          h('div.field', h('label', 'Notes'), h('textarea.textarea', { value: ex.notes || '', placeholder: 'Setup, seat height, cues. Shown in the logger.', onchange: async (e) => { ex.notes = e.target.value; await save(); } })),
        )),
        h('div.section-title', h('h2', 'Substitutions'), h('button.btn.sm.ghost', { onclick: async () => {
          const p = await pickExercise(exercises.filter((e) => e.id !== ex.id && !ex.substitutions.includes(e.id)), { title: 'Add substitution', allowCreate: false });
          if (!p) return;
          ex.substitutions.push(p.id); await save(); draw();
        } }, svgIcon(icons.plus, 18), 'Add')),
        h('div.card.pad-0', ex.substitutions.length ? h('div.list', ex.substitutions.map((sid) => h('div.list-item.static',
          h('div.body', h('div.title', exById.get(sid)?.name || 'Unknown')),
          h('button.btn.icon.ghost.sm', { 'aria-label': 'Remove', onclick: async () => { ex.substitutions = ex.substitutions.filter((x) => x !== sid); await save(); draw(); } }, svgIcon(icons.close, 18)),
        ))) : h('div.empty-state', 'No substitutions. These show first when you swap an exercise mid-workout.')),
        h('div.section-title', h('h2', 'History')),
        h('div.card.pad-0', workouts.length ? h('div.list', workouts.slice(0, 20).map((w) => {
          const entry = w.entries.find((e) => e.exerciseId === id);
          const sets = entry.sets.filter((s) => s.done);
          return h('button.list-item', { onclick: () => navigate(`/workout/${w.id}`) },
            h('div.body', h('div.title', w.date), h('div.sub', sets.map((s) => `${Math.round(toDisplayWeight(s.weightLb ?? 0, units) * 10) / 10}×${s.reps}${s.pr ? '★' : ''}`).join('  '))),
            svgIcon(icons.chevron, 18));
        })) : h('div.empty-state', 'Not logged yet.')),
        h('button.btn.danger.block', { style: { marginTop: '8px' }, onclick: async () => {
          if (!(await confirm(`Delete ${ex.name}? Past workouts keep their data; routines using it will show it as missing.`, { okLabel: 'Delete', danger: true }))) return;
          await repo.deleteExercise(ex.id); toast('Deleted'); navigate('/exercises');
        } }, 'Delete exercise'),
      );
    }
  }
}
function sel(options, value, onChange) {
  return h('select.select', { onchange: (e) => onChange(e.target.value) }, options.map((v) => h('option', { value: v, selected: v === value }, cap(v))));
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
