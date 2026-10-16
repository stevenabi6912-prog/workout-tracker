import { h, clear, svgIcon, icons } from './ui/dom.js';
import { sheet, toast } from './ui/sheet.js';
import { onRoute, start, navigate, parseHash } from './router.js';
import { state, initState, setProfile, onState } from './state.js';
import * as repo from './db/repo.js';
import { unlockAudio } from './ui/audio.js';

const TABS = [
  ['/', 'Today', icons.today],
  ['/history', 'History', icons.history],
  ['/progress', 'Progress', icons.progress],
  ['/weight', 'Weight', icons.weight],
  ['/more', 'More', icons.more],
];

const ROUTES = [
  [/^\/$/, () => import('./views/today.js')],
  [/^\/workout\/([^/]+)$/, () => import('./views/workout.js'), ['id']],
  [/^\/cardio(?:\/([^/]+))?$/, () => import('./views/cardio.js'), ['id']],
  [/^\/history$/, () => import('./views/history.js')],
  [/^\/progress$/, () => import('./views/progress.js')],
  [/^\/weight$/, () => import('./views/bodyweight.js')],
  [/^\/more$/, () => import('./views/more.js')],
  [/^\/exercises(?:\/([^/]+))?$/, () => import('./views/exercises.js'), ['id']],
  [/^\/routines(?:\/([^/]+))?$/, () => import('./views/routines.js'), ['id']],
  [/^\/settings$/, () => import('./views/settings.js')],
  [/^\/import$/, () => import('./views/import.js')],
  [/^\/profiles$/, () => import('./views/profiles.js')],
];

let cleanup = null;
let main;
let profileBtn;
let tabbar;

export async function mountApp(root) {
  profileBtn = h('button.btn.sm.subtle', { onclick: openProfileSwitcher, 'aria-label': 'Switch profile' }, svgIcon(icons.user, 18), h('span.profile-name'));
  main = h('main.main');
  tabbar = h('nav.tabbar', TABS.map(([path, label, icon]) => h('a', { href: '#' + path, dataset: { path } }, svgIcon(icon, 24), h('span', label))));
  const shell = h('div.shell',
    h('header.topbar', h('div.left', h('h1', 'Workouts')), h('div.right', profileBtn)),
    main,
    tabbar,
  );
  clear(root).append(shell);

  document.addEventListener('touchend', unlockAudio, { once: true, passive: true });
  document.addEventListener('click', unlockAudio, { once: true });

  try {
    await initState();
  } catch (err) {
    main.append(h('div.card', h('p', 'Could not open local storage. Private browsing on iOS blocks IndexedDB; open the site normally or add it to the home screen.'), h('p.small.muted', String(err))));
    return;
  }
  onState(renderProfileButton);
  renderProfileButton();
  onRoute(renderRoute);
  start();
}

function renderProfileButton() {
  profileBtn.querySelector('.profile-name').textContent = state.profile?.name || '';
}

async function openProfileSwitcher() {
  await sheet((body, close) => {
    body.append(
      h('div.list', state.profiles.map((p) => h('button.list-item', { onclick: () => { setProfile(p.id); close(); toast(`Switched to ${p.name}`); renderRoute(parseHash()); } },
        h('div.body', h('div.title', p.name), h('div.sub', p.goalWeightLb ? `Goal ${p.goalWeightLb} ${p.units.weight}` : 'No goal set')),
        p.id === state.profile.id ? svgIcon(icons.check, 20) : null,
      ))),
      h('button.btn.block', { onclick: () => { close(); navigate('/profiles'); } }, 'Manage profiles'),
    );
  }, { title: 'Profile' });
}

async function renderRoute(route) {
  for (const a of tabbar.querySelectorAll('a')) {
    const p = a.dataset.path;
    a.classList.toggle('active', p === '/' ? route.path === '/' || route.path.startsWith('/workout') || route.path.startsWith('/cardio') : route.path.startsWith(p) || (p === '/more' && /^\/(exercises|routines|settings|import|profiles)/.test(route.path)));
  }
  for (const [re, loader, names = []] of ROUTES) {
    const m = route.path.match(re);
    if (!m) continue;
    const params = Object.fromEntries(names.map((n, i) => [n, m[i + 1]]));
    if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
    cleanup = null;
    const container = h('div.view');
    clear(main).append(container);
    window.scrollTo(0, 0);
    try {
      const mod = await loader();
      const ctx = { params, query: route.query, profile: state.profile, navigate, refresh: () => renderRoute(parseHash()), repo };
      cleanup = await mod.render(container, ctx);
    } catch (err) {
      console.error(err);
      container.append(h('div.card', h('p', 'Something went wrong loading this screen.'), h('p.small.muted', String(err?.message || err))));
    }
    return;
  }
  navigate('/', { replace: true });
}
