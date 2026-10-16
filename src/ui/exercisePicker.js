import { h, svgIcon, icons } from './dom.js';
import { sheet, prompt } from './sheet.js';
import * as repo from '../db/repo.js';

// Searchable exercise picker. Resolves to an exercise object, or undefined if dismissed.
export function pickExercise(exercises, { title = 'Choose exercise', profileId, allowCreate = true, highlight = [] } = {}) {
  return sheet((body, close) => {
    const input = h('input.input', { type: 'search', placeholder: 'Search', autocomplete: 'off' });
    const list = h('div.list');
    const hl = new Set(highlight);
    function draw() {
      const q = input.value.trim().toLowerCase();
      list.replaceChildren();
      const matches = exercises.filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscles?.some((m) => m.includes(q)) || e.equipment.includes(q));
      matches.sort((a, b) => (hl.has(b.id) - hl.has(a.id)) || a.name.localeCompare(b.name));
      for (const e of matches.slice(0, 80)) {
        list.append(h('button.list-item', { onclick: () => close(e) },
          h('div.body', h('div.title', e.name), h('div.sub', `${e.equipment} · ${e.region}${e.muscles?.length ? ' · ' + e.muscles.join(', ') : ''}`)),
          hl.has(e.id) ? h('span.badge.accent', 'Sub') : null,
          svgIcon(icons.chevron, 18),
        ));
      }
      if (allowCreate && profileId) {
        list.append(h('button.list-item', { onclick: async () => {
          const name = (await prompt('Exercise name', { value: input.value.trim(), title: 'New exercise' }))?.trim();
          if (!name) return;
          const ex = { id: repo.uid(), profileId, name, equipment: 'machine', region: 'upper', muscles: [], notes: '', substitutions: [], builtIn: false };
          await repo.saveExercise(ex);
          exercises.push(ex);
          close(ex);
        } }, svgIcon(icons.plus, 20), h('div.body', h('div.title', `Create "${input.value.trim() || 'new exercise'}"`), h('div.sub', 'Edit details later in the library'))));
      }
      if (!matches.length && !allowCreate) list.append(h('div.empty-state', 'No matches'));
    }
    input.addEventListener('input', draw);
    body.append(input, list);
    draw();
    setTimeout(() => { if (!('ontouchstart' in window)) input.focus(); }, 50);
  }, { title });
}
