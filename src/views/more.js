import { h, svgIcon, icons } from '../ui/dom.js';

export async function render(container, ctx) {
  const items = [
    ['/routines', 'Routines', 'Programs, days, exercises, rotation'],
    ['/exercises', 'Exercise library', 'Custom exercises, notes, substitutions'],
    ['/profiles', 'Profiles', 'Add or edit people'],
    ['/settings', 'Settings', 'Units, training days, timers, increments, backup'],
    ['/import', 'Apple Health import', 'Weight, workouts, heart rate from export.zip'],
  ];
  container.append(
    h('div.card.pad-0', h('div.list', items.map(([path, title, sub]) => h('button.list-item', { onclick: () => ctx.navigate(path) },
      h('div.body', h('div.title', title), h('div.sub', sub)), svgIcon(icons.chevron, 18))))),
    h('p.note', { style: { marginTop: '16px' } }, 'No account. Data lives in this browser only, per profile. Back it up under Settings.'),
  );
}
