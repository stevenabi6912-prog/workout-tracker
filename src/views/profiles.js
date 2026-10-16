import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { sheet, confirm, toast, header } from '../ui/sheet.js';
import * as repo from '../db/repo.js';
import { state, setProfile, reloadProfiles } from '../state.js';
import { fromDisplayWeight, toDisplayWeight, fmtWeight } from '../domain/units.js';

export async function render(container, ctx) {
  const listEl = h('div.card.pad-0');
  container.append(
    header('Profiles', { onBack: () => ctx.navigate('/more') }),
    listEl,
    h('button.btn.block', { style: { marginTop: '12px' }, onclick: () => editProfile(null) }, svgIcon(icons.plus, 20), 'Add profile'),
    h('p.note', { style: { marginTop: '12px' } }, 'Each profile has its own routines, exercises, history, units, and goal. Switch from the button in the header.'),
  );
  draw();

  function draw() {
    clear(listEl);
    listEl.append(h('div.list', state.profiles.map((p) => h('button.list-item', { onclick: () => editProfile(p) },
      h('div.body', h('div.title', p.name), h('div.sub', `${p.goalWeightLb ? 'Goal ' + fmtWeight(p.goalWeightLb, p.units.weight) : 'No goal'} · ${p.units.weight}, ${p.units.distance}`)),
      p.id === state.profile.id ? h('span.badge.accent', 'Active') : null,
      svgIcon(icons.chevron, 18),
    ))));
  }

  async function editProfile(p) {
    const isNew = !p;
    const units = p?.units?.weight || 'lb';
    const result = await sheet((body, close) => {
      const name = h('input.input', { value: p?.name || '', placeholder: 'Name', autocomplete: 'off' });
      const goal = h('input.input.num', { inputmode: 'decimal', value: p?.goalWeightLb ? String(Math.round(toDisplayWeight(p.goalWeightLb, units) * 10) / 10) : '', placeholder: '—' });
      body.append(
        h('div.field', h('label', 'Name'), name),
        h('div.field', h('label', `Goal weight (${units})`), goal),
        h('div.grid-2',
          h('button.btn', { onclick: () => close(undefined) }, 'Cancel'),
          h('button.btn.primary', { onclick: () => close({ name: name.value.trim(), goalWeightLb: fromDisplayWeight(goal.value, units) }) }, isNew ? 'Create' : 'Save'),
        ),
        !isNew && state.profiles.length > 1 ? h('button.btn.danger.block', { onclick: () => close('delete') }, 'Delete profile and all its data') : null,
      );
      setTimeout(() => { if (isNew) name.focus(); }, 50);
    }, { title: isNew ? 'New profile' : p.name });
    if (!result) return;
    if (result === 'delete') {
      const ok = await confirm(`Delete ${p.name} and every workout, weigh-in, and routine for this profile? This cannot be undone.`, { okLabel: 'Delete everything', danger: true });
      if (!ok) return;
      await repo.deleteProfile(p.id);
      await reloadProfiles();
      toast('Profile deleted');
      return draw();
    }
    if (!result.name) { toast('Name is required'); return; }
    if (isNew) {
      const created = await repo.createProfile({ name: result.name, goalWeightLb: result.goalWeightLb });
      await reloadProfiles();
      setProfile(created.id);
      toast(`Created ${created.name}`);
    } else {
      await repo.saveProfile({ ...p, name: result.name, goalWeightLb: result.goalWeightLb });
      await reloadProfiles();
      toast('Saved');
    }
    draw();
  }
}
