// Tiny element builder. h('div.card', { onclick }, 'text', child, [children])
export function h(tag, ...args) {
  let props = {};
  if (args.length && args[0] && typeof args[0] === 'object' && !(args[0] instanceof Node) && !Array.isArray(args[0])) {
    props = args.shift();
  }
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && k !== 'form') {
      try { el[k] = v; } catch { el.setAttribute(k, v); }
    } else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, args);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function svgIcon(path, size = 20) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of [].concat(path)) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

export const icons = {
  today: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 3v5h5M12 7v5l3 2',
  progress: 'M3 3v18h18M7 14l4-4 4 4 5-6',
  weight: 'M12 3a4 4 0 0 1 4 4v1h2.5a2 2 0 0 1 2 1.7l1.3 9a2 2 0 0 1-2 2.3H4.2a2 2 0 0 1-2-2.3l1.3-9A2 2 0 0 1 5.5 8H8V7a4 4 0 0 1 4-4zM10 8h4V7a2 2 0 0 0-4 0v1z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M20 6L9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevron: 'M9 18l6-6-6-6',
  back: 'M15 18l-6-6 6-6',
  close: 'M18 6L6 18M6 6l12 12',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  swap: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  timer: 'M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5l3 2M9 2h6',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  play: 'M6 4l14 8-14 8z',
  pause: 'M8 5v14M16 5v14',
  dots: 'M12 5h.01M12 12h.01M12 19h.01',
  star: 'M12 2l3 7 7 .6-5.3 4.6L18.5 21 12 17.3 5.5 21l1.8-6.8L2 9.6 9 9z',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  upload: 'M12 15V3m0 0L8 7m4-4l4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
};
