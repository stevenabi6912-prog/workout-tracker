// Hash router: #/path/segments?query
const listeners = new Set();

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path: '/' + segments.join('/'), segments, query };
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) emit();
}

export function back(fallback = '/') {
  if (history.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

export function onRoute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  const route = parseHash();
  for (const fn of listeners) fn(route);
}

window.addEventListener('hashchange', emit);

export function start() {
  if (!location.hash) history.replaceState(null, '', '#/');
  emit();
}
