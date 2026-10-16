import { h, clear, svgIcon, icons } from './dom.js';

let openSheet = null;

// Opens a bottom sheet. Returns a promise resolving to whatever close(value) is called with.
export function sheet(build, { title, dismissible = true } = {}) {
  closeSheet();
  return new Promise((resolve) => {
    const body = h('div.stack');
    const panel = h('div.sheet', { role: 'dialog', 'aria-modal': 'true' }, h('div.grab'), title ? h('h2', title) : null, body);
    const backdrop = h('div.sheet-backdrop', {
      onclick: (e) => { if (dismissible && e.target === backdrop) close(undefined); },
    }, panel);
    function close(value) {
      if (openSheet !== backdrop) return;
      backdrop.remove();
      openSheet = null;
      document.body.style.overflow = '';
      resolve(value);
    }
    build(body, close);
    document.body.append(backdrop);
    document.body.style.overflow = 'hidden';
    openSheet = backdrop;
  });
}

export function closeSheet() {
  if (openSheet) { openSheet.remove(); openSheet = null; document.body.style.overflow = ''; }
}

export function confirm(message, { okLabel = 'OK', danger = false, title } = {}) {
  return sheet((body, close) => {
    body.append(
      h('p', message),
      h('div.grid-2', { style: { marginTop: '8px' } },
        h('button.btn', { onclick: () => close(false) }, 'Cancel'),
        h('button.btn', { class: danger ? 'danger solid' : 'primary', onclick: () => close(true) }, okLabel),
      ),
    );
  }, { title }).then((v) => v === true);
}

export function prompt(label, { value = '', type = 'text', okLabel = 'Save', title, inputmode } = {}) {
  return sheet((body, close) => {
    const input = h('input.input', { type, value, inputmode, placeholder: label, autocomplete: 'off' });
    const form = h('form.stack', {
      onsubmit: (e) => { e.preventDefault(); close(input.value); },
    },
      h('div.field', h('label', label), input),
      h('div.grid-2',
        h('button.btn', { type: 'button', onclick: () => close(undefined) }, 'Cancel'),
        h('button.btn.primary', { type: 'submit' }, okLabel),
      ),
    );
    body.append(form);
    setTimeout(() => input.focus(), 50);
  }, { title });
}

// Pick one from a list of { label, sub, value }
export function pick(items, { title } = {}) {
  return sheet((body, close) => {
    body.append(h('div.list', items.map((it) => h('button.list-item', { onclick: () => close(it.value) },
      h('div.body', h('div.title', it.label), it.sub ? h('div.sub', it.sub) : null),
      svgIcon(icons.chevron, 18),
    ))));
  }, { title });
}

let toastTimer;
export function toast(message, ms = 2200) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = h('div.toast', { role: 'status' }, message);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

export function header(title, { onBack, right } = {}) {
  return h('div.row.between', { style: { marginBottom: '12px' } },
    h('div.row', onBack ? h('button.btn.icon.ghost', { onclick: onBack, 'aria-label': 'Back' }, svgIcon(icons.back, 22)) : null, h('h1', title)),
    right ? h('div.row', right) : null,
  );
}

export { clear };
